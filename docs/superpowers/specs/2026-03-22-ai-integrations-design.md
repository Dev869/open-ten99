# AI Integrations Design Spec

**Date**: 2026-03-22
**Status**: Draft

## Overview

Add 7 AI-powered prediction features to OpenChanges using Gemini 2.5 Flash. Predictions are generated server-side on login, cached in Firestore, and rendered inline on existing pages as graphs, badges, and KPI cards. No chat interface — AI surfaces through the UI directly.

## Architecture

### Trigger

When a contractor signs in, the web app calls a `generateInsights` callable Cloud Function. The function:

1. Checks staleness — skips regeneration if insights were generated within the last 24 hours
2. Pulls the user's transactions, work items, clients, invoices, and receipts from Firestore
3. Runs 7 parallel Gemini 2.5 Flash calls with structured JSON output
4. Writes combined results to `insights/{userId}` (single document)
5. Frontend subscribes via `useInsights()` hook and renders predictions inline

### Data Flow

```
Login → callGenerateInsights() → Cloud Function
  → Check staleness (skip if < 24hrs)
  → Set insights/{userId}.status = 'generating'
  → Read user's Firestore data (parallel)
  → 7 parallel Gemini 2.5 Flash calls (structured JSON)
  → Write results to insights/{userId}
  → Set status = 'ready'
  → Frontend onSnapshot picks up new data
  → Graphs/cards render predictions
```

### Key Decisions

- **7 parallel Gemini calls** rather than one massive prompt — keeps each prompt focused, easier to debug, stays within token limits
- **12-month lookback** for transactions — enough history for seasonal patterns without excessive data
- **Structured JSON output** mode on all calls (existing pattern from `smartCategorize`)
- **Fire-and-forget** — login triggers the call, `useInsights()` hook picks up results via `onSnapshot`
- **Partial failure** — if any individual analysis fails, write partial results with the rest populated; add `errors[]` field noting which analyses failed
- **Legacy data exclusion** — queries filter by `ownerId == userId`. Legacy documents without `ownerId` are excluded from AI analysis. This is acceptable since only very old pre-migration data is affected.
- **Concurrent invocation guard** — if `status === 'generating'` and `generatedAt` is less than 5 minutes old, skip (another invocation is in progress)
- **Array size limits** — each insight array is capped (see Data Model) to keep the Firestore document well under the 1MB limit

## Features

### 1. Smart Expense Organization (Enhancement)

Enhances existing smart categorization with confidence scores, category trend graphs, and anomaly detection.

**What it predicts**:
- Flags anomalous expenses (e.g. "this $800 charge is 3x your average for Software & Subscriptions")
- Category spending trends (up/down/stable vs previous month)

**Where it surfaces**:
- **Expenses page** — anomaly warning badges on flagged expense rows with tooltip showing reason
- **Expenses page** — category trend arrows next to each category total (up/down/stable + percent change)

**Gemini prompt input**: Last 12 months of transactions with categories and amounts.

### 2. Tax Deduction Maximizer

Analyzes all expenses against Schedule C categories, flags potentially missed deductions, projects estimated tax savings.

**What it predicts**:
- Which uncategorized or miscategorized transactions may be deductible
- Estimated total tax savings from deductions
- Deduction coverage by category

**Where it surfaces**:
- **FinanceOverview page** — "Estimated Tax Savings" KPI card + deduction breakdown chart
- **Transactions page** — "Potentially deductible" badge on flagged transactions

**Gemini prompt input**: All transactions from current tax year, current categories, Schedule C category definitions.

### 3. Accounting AI (Revenue/Expense Forecasting)

Projects revenue and expenses for the next 3 months based on historical patterns, client payment history, and seasonal trends.

**What it predicts**:
- Monthly revenue forecast (3 months)
- Monthly expense forecast (3 months)
- Confidence score for the prediction

**Where it surfaces**:
- **FinanceOverview page** — forecast line overlaid on existing revenue chart (solid = actual, dashed = predicted)

**Gemini prompt input**: Last 12 months of transactions (revenue and expense), work items with billing data, client payment history.

### 4. Payments AI

Scores each unpaid invoice for late payment risk based on client history, amount, and age. Shows payment timing patterns per client.

**What it predicts**:
- Risk level per unpaid invoice (low/medium/high)
- Predicted payment date
- Client payment patterns (average days to payment, on-time rate, trend)

**Where it surfaces**:
- **Invoices page** — risk badge per unpaid invoice (green/yellow/red dot + reason text)
- **Invoices page** — predicted pay date column

**Gemini prompt input**: Work items with `invoiceStatus` set (invoices are fields on `WorkItem`, not a separate collection) — includes `invoiceSentDate`, `invoicePaidDate`, `invoiceDueDate`. Plus client payment history.

### 5. Customer AI

Scores clients on lifetime value, churn risk, and revenue concentration. Flags over-reliance on a single client.

**What it predicts**:
- Client lifetime value score
- Churn risk (low/medium/high) based on activity recency and frequency
- Revenue concentration risk (healthy/moderate/dangerous)

**Where it surfaces**:
- **Clients page** — LTV and churn risk badges per client card
- **Clients page** — revenue concentration donut chart at top of page
- **Dashboard** — revenue concentration warning banner if one client > 40%

**Gemini prompt input**: All clients, work items grouped by client, transaction history by client.

### 6. Finance AI (Cash Flow Forecasting)

Projects cash flow for the next 3 months factoring in expected invoice payments, recurring expenses, and seasonal patterns.

**What it predicts**:
- Monthly inflow/outflow/net cash projections
- Runway estimate (months of cash remaining)
- Runway status (comfortable/caution/critical)

**Where it surfaces**:
- **FinanceOverview page** — cash flow forecast chart (bar chart: inflow/outflow/net by month)
- **FinanceOverview page** — "Cash Runway" KPI card with status color

**Gemini prompt input**: Last 12 months of transactions, unpaid invoices with expected payment dates, recurring expense patterns.

### 7. Project Management AI

Predicts work item completion times, flags scope creep, and shows utilization rate.

**What it predicts**:
- Estimated days to completion per active work item
- Scope creep detection — Gemini estimates from proxy signals (comparing `estimatedBusinessDays` to elapsed time, line item complexity vs. similar past items) since historical line item counts are not tracked
- Current utilization rate and trend

**Where it surfaces**:
- **WorkItems page** — completion estimate badge per work item ("~5 days")
- **WorkItems page** — scope creep warning icon on flagged items
- **Dashboard** — utilization gauge component

**Gemini prompt input**: All active work items with line items and dates, last 6 months of completed work items with actual durations.

## Data Model

Single Firestore document at `insights/{userId}`:

```typescript
interface Insights {
  generatedAt: Date;
  status: 'generating' | 'ready' | 'error';
  errors?: string[];  // which analyses failed, if any

  expenses: {
    anomalies: Array<{  // max 20
      transactionId: string;
      description: string;
      amount: number;
      category: string;
      reason: string;
      severity: 'info' | 'warning';
    }>;
    categoryTrends: Array<{
      category: string;
      currentMonth: number;
      previousMonth: number;
      trend: 'up' | 'down' | 'stable';
      percentChange: number;
    }>;
  };

  tax: {
    estimatedSavings: number;
    effectiveRate: number;
    missedDeductions: Array<{  // max 30
      transactionId: string;
      description: string;
      amount: number;
      suggestedCategory: string;
      reason: string;
    }>;
    deductionsByCategory: Record<string, number>;
    totalDeductible: number;
  };

  forecast: {
    revenue: Array<{ month: string; amount: number }>;
    expenses: Array<{ month: string; amount: number }>;
    confidence: number;
  };

  payments: {
    invoiceRisks: Array<{
      workItemId: string;
      clientName: string;
      amount: number;
      risk: 'low' | 'medium' | 'high';
      reason: string;
      predictedPayDate: string;
    }>;
    clientPatterns: Record<string, {  // keyed by clientId
      avgDaysToPayment: number;
      onTimeRate: number;
      trend: 'improving' | 'worsening' | 'stable';
    }>;
  };

  clients: {
    scores: Array<{
      clientId: string;
      clientName: string;
      lifetimeValue: number;  // total historical revenue in dollars
      churnRisk: 'low' | 'medium' | 'high';
      revenueShare: number;
      reason: string;
    }>;
    concentrationRisk: {
      level: 'healthy' | 'moderate' | 'dangerous';
      topClientShare: number;
      recommendation: string;
    };
  };

  cashFlow: {
    projections: Array<{
      month: string;
      inflow: number;
      outflow: number;
      netCash: number;
    }>;
    runway: {
      months: number;
      status: 'comfortable' | 'caution' | 'critical';
    };
  };

  projects: {
    completionEstimates: Array<{
      workItemId: string;
      title: string;
      estimatedDays: number;
      confidence: number;
    }>;
    scopeCreep: Array<{  // max 10
      workItemId: string;
      title: string;
      reason: string;  // Gemini's explanation of scope creep signals
      severity: 'warning' | 'info';
    }>;
    utilization: {
      currentRate: number;
      trend: 'up' | 'down' | 'stable';
      recommendation: string;
    };
  };
}
```

## Cloud Function Design

### generateInsights (Callable)

```
generateInsights(userId)
  ├── Check staleness (skip if < 24hrs old)
  ├── Set insights/{userId}.status = 'generating'
  ├── Fetch all user data in parallel:
  │   ├── transactions (last 12 months)
  │   ├── workItems (all active + last 6 months completed)
  │   ├── clients (all)
  │   └── receipts (last 12 months)
  ├── Run 7 Gemini calls in parallel:
  │   ├── analyzeExpenses(transactions)
  │   ├── analyzeTaxDeductions(transactions)
  │   ├── forecastRevenue(transactions, workItems)
  │   ├── analyzePayments(workItems, clients)
  │   ├── scoreClients(clients, workItems, transactions)
  │   ├── projectCashFlow(transactions, workItems)
  │   └── analyzeProjects(workItems)
  ├── Write combined results to insights/{userId}
  └── Set status = 'ready'
```

**Timeouts**: 60-second max per Gemini call, 300-second total function timeout (matches `generateReport` precedent for complex operations).

**Concurrency guard**: Before generating, check if `status === 'generating'` and `generatedAt` is less than 5 minutes old — if so, skip to prevent duplicate work from multiple tabs or retries.

**Error handling**: If any individual analysis fails, write partial results. Set status to `'ready'` with `errors[]` noting which analyses failed.

### Gemini Configuration

- **Model**: `gemini-2.5-flash` (consistent with existing functions)
- **Output mode**: Structured JSON (responseMimeType: `application/json`)
- **Client**: Reuse existing `geminiClient.ts` singleton pattern

## Frontend Integration

### Insights Type Location

The `Insights` interface goes in `web/src/lib/types.ts` alongside other domain types. A `docToInsights` converter function is added to `web/src/services/firestore.ts` following the existing `docToWorkItem`/`docToClient` pattern (handles Firestore `Timestamp` → `Date` conversion).

### useInsights() Hook

New hook in `web/src/hooks/useFirestore.ts`:
- Subscribes to `insights/{userId}` via `onSnapshot`
- Uses `whenAuthReady()` pattern consistent with other hooks in the file
- Exposes: `insights`, `isGenerating`, `lastGenerated`, `errors`, `refreshInsights`
- `refreshInsights()` calls the Cloud Function with a `force: true` flag to bypass staleness guard

### Stale Reference Handling

Since insights are cached for up to 24 hours, transaction IDs referenced in `expenses.anomalies` and `tax.missedDeductions` may no longer exist. Frontend components must gracefully skip rendering badges for transaction IDs that don't match live data. Insight components show "Last updated X hours ago" text.

### Login Trigger

A `useEffect` in `App.tsx` fires when the user transitions to authenticated and `isContractorUser(user)` is true. Calls `generateInsights()` fire-and-forget. This keeps auth logic clean and separate from insight generation.

`useInsights()` picks up results as they arrive via `onSnapshot`.

### Page Integration Map

| Page | Components Added |
|------|-----------------|
| **FinanceOverview** | Forecast overlay on revenue chart, "Estimated Tax Savings" KPI, "Cash Runway" KPI, "Revenue Concentration" KPI, cash flow forecast chart |
| **Expenses** | Anomaly badges on flagged rows, category trend arrows |
| **Invoices** | Risk badge per unpaid invoice, predicted pay date column |
| **Transactions** | "Potentially deductible" badge on flagged transactions |
| **Clients** | LTV and churn risk badges per client, concentration donut chart |
| **Dashboard** | Utilization gauge, revenue concentration warning banner |
| **WorkItems** | Completion estimate badge, scope creep warning icon |

### Charting Library

New chart components (`CashFlowChart`, `ConcentrationDonut`, `ForecastOverlay`, `UtilizationGauge`) use **Recharts** — a lightweight, React-native charting library that composes well with existing component patterns. If the existing `RevenueChart` uses a different library, follow that instead.

### New UI Components

| Component | Purpose |
|-----------|---------|
| `InsightBadge` | Reusable colored badge with tooltip (risk levels, anomalies, deductions) |
| `ForecastOverlay` | Dashed line overlay for existing chart components |
| `CashFlowChart` | Bar chart for monthly inflow/outflow/net |
| `ConcentrationDonut` | Donut chart for client revenue share |
| `UtilizationGauge` | Circular gauge for utilization rate |
| `RunwayCard` | KPI card showing months of runway with status color |

### Loading State

While `status === 'generating'`, pages show a subtle shimmer/skeleton on prediction components with "AI insights updating..." text. Existing non-AI data remains visible.

## Firestore Rules

```
match /insights/{userId} {
  allow read: if isContractor() && userId == request.auth.uid;
  allow write: if false;  // Only Cloud Functions write via Admin SDK
}
```

## Security & Cost Controls

- **API key**: Gemini API key stays in Cloud Functions secrets (`GOOGLE_AI_API_KEY`), no new client-side keys
- **24-hour staleness guard**: Prevents excessive Gemini calls on rapid re-logins
- **Cost per login**: ~7 Gemini 2.5 Flash calls with structured JSON output (low token cost)
- **No new environment variables** for the web app
- **Data scoping**: All queries filtered by `ownerId == userId` (legacy docs without `ownerId` excluded — acceptable trade-off)

## Implementation Notes

- Export `generateInsights` from `functions/src/index.ts` (required for deployment)
- Features 3 (Accounting AI forecast) and 6 (Finance AI cash flow) process similar data — consider combining into a single Gemini call that returns both `forecast` and `cashFlow` outputs to reduce cost/latency
- All 7 analyzer functions live in `functions/src/utils/insights/` as separate modules for testability
