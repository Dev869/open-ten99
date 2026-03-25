# AI Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 Gemini-powered prediction features that generate on login, cache in Firestore, and render inline as graphs/badges/KPI cards on existing pages.

**Architecture:** Login triggers a callable Cloud Function that runs 7 parallel Gemini 2.5 Flash calls, writes results to a single `insights/{userId}` Firestore document. Frontend subscribes via `useInsights()` hook and renders predictions inline — no new pages, no chat UI.

**Tech Stack:** Gemini 2.5 Flash, Firebase Cloud Functions (callable), Firestore, Recharts (already installed), React 19, TypeScript, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-22-ai-integrations-design.md`

---

## File Map

### New Files — Cloud Functions
| File | Responsibility |
|------|---------------|
| `functions/src/generateInsights.ts` | Callable Cloud Function: staleness/concurrency checks, data fetching, orchestrates 7 parallel analyzers, writes results |
| `functions/src/utils/insights/analyzeExpenses.ts` | Gemini prompt for expense anomalies + category trends |
| `functions/src/utils/insights/analyzeTaxDeductions.ts` | Gemini prompt for missed deductions + tax savings |
| `functions/src/utils/insights/forecastRevenue.ts` | Gemini prompt for 3-month revenue/expense forecast |
| `functions/src/utils/insights/analyzePayments.ts` | Gemini prompt for invoice risk + client payment patterns |
| `functions/src/utils/insights/scoreClients.ts` | Gemini prompt for client LTV, churn risk, concentration |
| `functions/src/utils/insights/projectCashFlow.ts` | Gemini prompt for cash flow projections + runway |
| `functions/src/utils/insights/analyzeProjects.ts` | Gemini prompt for completion estimates, scope creep, utilization |

### New Files — Frontend Components
| File | Responsibility |
|------|---------------|
| `web/src/components/insights/InsightBadge.tsx` | Reusable colored badge with tooltip for risk/anomaly/deduction indicators |
| `web/src/components/insights/CashFlowChart.tsx` | Recharts bar chart: monthly inflow/outflow/net |
| `web/src/components/insights/ConcentrationDonut.tsx` | Recharts pie chart: client revenue share |
| `web/src/components/insights/UtilizationGauge.tsx` | Circular gauge for utilization rate |
| `web/src/components/insights/RunwayCard.tsx` | KPI card showing months of runway with status color |
| `web/src/components/insights/InsightShimmer.tsx` | Loading skeleton for insight components while generating |

### Modified Files
| File | Changes |
|------|---------|
| `web/src/lib/types.ts` | Add `Insights` interface and related types |
| `web/src/services/firestore.ts` | Add `docToInsights()` converter, `subscribeInsights()`, `callGenerateInsights()` |
| `web/src/hooks/useFirestore.ts` | Add `useInsights()` hook |
| `web/src/App.tsx` | Add `useEffect` to trigger `generateInsights` on contractor login |
| `web/src/routes/contractor/FinanceOverview.tsx` | Add tax savings KPI, runway KPI, concentration KPI, cash flow chart, forecast overlay |
| `web/src/routes/contractor/Expenses.tsx` | Add anomaly badges, category trend arrows |
| `web/src/routes/contractor/Invoices.tsx` | Add risk badges, predicted pay date column |
| `web/src/routes/contractor/Transactions.tsx` | Add "potentially deductible" badges |
| `web/src/routes/contractor/Clients.tsx` | Add LTV/churn badges, concentration donut chart |
| `web/src/routes/contractor/Dashboard.tsx` | Add utilization gauge, concentration warning banner |
| `web/src/routes/contractor/WorkItems.tsx` | Add completion estimate badges, scope creep warnings |
| `functions/src/index.ts` | Export `onGenerateInsights` |
| `firestore.rules` | Add `insights/{userId}` read rule |

---

## Task 1: Types + Firestore Rules

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Add Insights types to `web/src/lib/types.ts`**

Add at the end of the file, after the existing types:

```typescript
// --- AI Insights ---

export type InsightStatus = 'generating' | 'ready' | 'error';
export type RiskLevel = 'low' | 'medium' | 'high';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface ExpenseAnomaly {
  transactionId: string;
  description: string;
  amount: number;
  category: string;
  reason: string;
  severity: 'info' | 'warning';
}

export interface CategoryTrend {
  category: string;
  currentMonth: number;
  previousMonth: number;
  trend: TrendDirection;
  percentChange: number;
}

export interface MissedDeduction {
  transactionId: string;
  description: string;
  amount: number;
  suggestedCategory: string;
  reason: string;
}

export interface InvoiceRisk {
  workItemId: string;
  clientName: string;
  amount: number;
  risk: RiskLevel;
  reason: string;
  predictedPayDate: string;
}

export interface ClientPaymentPattern {
  avgDaysToPayment: number;
  onTimeRate: number;
  trend: 'improving' | 'worsening' | 'stable';
}

export interface ClientScore {
  clientId: string;
  clientName: string;
  lifetimeValue: number;
  churnRisk: RiskLevel;
  revenueShare: number;
  reason: string;
}

export interface ConcentrationRisk {
  level: 'healthy' | 'moderate' | 'dangerous';
  topClientShare: number;
  recommendation: string;
}

export interface CashFlowProjection {
  month: string;
  inflow: number;
  outflow: number;
  netCash: number;
}

export interface RunwayEstimate {
  months: number;
  status: 'comfortable' | 'caution' | 'critical';
}

export interface CompletionEstimate {
  workItemId: string;
  title: string;
  estimatedDays: number;
  confidence: number;
}

export interface ScopeCreepAlert {
  workItemId: string;
  title: string;
  reason: string;
  severity: 'warning' | 'info';
}

export interface Utilization {
  currentRate: number;
  trend: TrendDirection;
  recommendation: string;
}

export interface Insights {
  generatedAt: Date;
  status: InsightStatus;
  errors?: string[];

  expenses: {
    anomalies: ExpenseAnomaly[];
    categoryTrends: CategoryTrend[];
  };

  tax: {
    estimatedSavings: number;
    effectiveRate: number;
    missedDeductions: MissedDeduction[];
    deductionsByCategory: Record<string, number>;
    totalDeductible: number;
  };

  forecast: {
    revenue: Array<{ month: string; amount: number }>;
    expenses: Array<{ month: string; amount: number }>;
    confidence: number;
  };

  payments: {
    invoiceRisks: InvoiceRisk[];
    clientPatterns: Record<string, ClientPaymentPattern>;
  };

  clients: {
    scores: ClientScore[];
    concentrationRisk: ConcentrationRisk;
  };

  cashFlow: {
    projections: CashFlowProjection[];
    runway: RunwayEstimate;
  };

  projects: {
    completionEstimates: CompletionEstimate[];
    scopeCreep: ScopeCreepAlert[];
    utilization: Utilization;
  };
}
```

- [ ] **Step 2: Add Firestore rules for insights collection**

In `firestore.rules`, add inside the `match /databases/{database}/documents` block, after the existing `receipts` rule:

```
    match /insights/{userId} {
      allow read: if isContractor() && userId == request.auth.uid;
      allow write: if false;
    }
```

- [ ] **Step 3: Verify web app builds**

Run: `cd web && npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts firestore.rules
git commit -m "feat(insights): add Insights types and Firestore rules"
```

---

## Task 2: Firestore Service Layer

**Files:**
- Modify: `web/src/services/firestore.ts`

- [ ] **Step 1: Add `docToInsights` converter**

Add after the existing `docToReceipt` converter in `firestore.ts`. Follow the same `toDate()` pattern:

```typescript
function docToInsights(data: DocumentData): Insights {
  return {
    generatedAt: data.generatedAt?.toDate?.() ?? new Date(),
    status: data.status ?? 'generating',
    errors: data.errors ?? undefined,
    expenses: {
      anomalies: data.expenses?.anomalies ?? [],
      categoryTrends: data.expenses?.categoryTrends ?? [],
    },
    tax: {
      estimatedSavings: data.tax?.estimatedSavings ?? 0,
      effectiveRate: data.tax?.effectiveRate ?? 0,
      missedDeductions: data.tax?.missedDeductions ?? [],
      deductionsByCategory: data.tax?.deductionsByCategory ?? {},
      totalDeductible: data.tax?.totalDeductible ?? 0,
    },
    forecast: {
      revenue: data.forecast?.revenue ?? [],
      expenses: data.forecast?.expenses ?? [],
      confidence: data.forecast?.confidence ?? 0,
    },
    payments: {
      invoiceRisks: data.payments?.invoiceRisks ?? [],
      clientPatterns: data.payments?.clientPatterns ?? {},
    },
    clients: {
      scores: data.clients?.scores ?? [],
      concentrationRisk: data.clients?.concentrationRisk ?? {
        level: 'healthy',
        topClientShare: 0,
        recommendation: '',
      },
    },
    cashFlow: {
      projections: data.cashFlow?.projections ?? [],
      runway: data.cashFlow?.runway ?? { months: 0, status: 'comfortable' },
    },
    projects: {
      completionEstimates: data.projects?.completionEstimates ?? [],
      scopeCreep: data.projects?.scopeCreep ?? [],
      utilization: data.projects?.utilization ?? {
        currentRate: 0,
        trend: 'stable',
        recommendation: '',
      },
    },
  };
}
```

- [ ] **Step 2: Add `subscribeInsights` function**

Add after the `subscribeReceipts` function. Uses `doc()` instead of `query()` since insights is a single document keyed by userId. Note: if the codebase has a `snapshotWithRetry` wrapper (used by newer subscriptions for auth token retry), use that instead of bare `onSnapshot`:

```typescript
export function subscribeInsights(
  callback: (insights: Insights | null) => void
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const docRef = doc(db, 'insights', user.uid);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(docToInsights(snapshot.data()));
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('insights subscription error:', error);
      callback(null);
    }
  );
}
```

- [ ] **Step 3: Add `callGenerateInsights` function**

Add a callable function wrapper. Uses the `httpsCallable` pattern from the Firebase SDK:

```typescript
export async function callGenerateInsights(force = false): Promise<void> {
  const fn = httpsCallable(functions, 'onGenerateInsights');
  await fn({ force });
}
```

Note: `httpsCallable` and `functions` are already imported at the top of `firestore.ts` (used by `smartCategorize`). Just use them directly — no dynamic imports needed. If `functions` is not yet exported from `web/src/lib/firebase.ts`, add `export const functions = getFunctions(app);` there.

- [ ] **Step 4: Add necessary imports**

Ensure `Insights` is imported from `../lib/types` at the top of `firestore.ts`. Ensure `doc` is imported from `firebase/firestore` (likely already imported).

- [ ] **Step 5: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src/services/firestore.ts web/src/lib/firebase.ts
git commit -m "feat(insights): add Firestore service layer for insights"
```

---

## Task 3: useInsights Hook + Login Trigger

**Files:**
- Modify: `web/src/hooks/useFirestore.ts`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add `useInsights` hook**

Add in `web/src/hooks/useFirestore.ts` after existing hooks. Follow the `useReceipts` pattern:

```typescript
export function useInsights() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = whenAuthReady(() =>
      subscribeInsights((data) => {
        setInsights(data);
        setLoading(false);
      }),
    );
    return unsubscribe;
  }, []);

  const isGenerating = insights?.status === 'generating';
  const lastGenerated = insights?.generatedAt ?? null;
  const errors = insights?.errors ?? [];

  const refreshInsights = async () => {
    await callGenerateInsights(true);
  };

  return { insights, loading, isGenerating, lastGenerated, errors, refreshInsights };
}
```

Add the required imports at the top: `Insights` from types, `subscribeInsights` and `callGenerateInsights` from services.

- [ ] **Step 2: Add login trigger in `App.tsx`**

Find where `useAuth()` is called in `App.tsx`. Add a `useEffect` that triggers insight generation when a contractor user authenticates:

```typescript
// Trigger AI insight generation on contractor login
useEffect(() => {
  if (user && isContractorUser(user)) {
    callGenerateInsights().catch(console.error);
  }
}, [user]);
```

Import `callGenerateInsights` from `../services/firestore` and `isContractorUser` from the auth module (check where this helper lives — likely `useAuth.ts`).

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/hooks/useFirestore.ts web/src/App.tsx
git commit -m "feat(insights): add useInsights hook and login trigger"
```

---

## Task 4: Insight UI Components

**Files:**
- Create: `web/src/components/insights/InsightBadge.tsx`
- Create: `web/src/components/insights/InsightShimmer.tsx`
- Create: `web/src/components/insights/CashFlowChart.tsx`
- Create: `web/src/components/insights/ConcentrationDonut.tsx`
- Create: `web/src/components/insights/UtilizationGauge.tsx`
- Create: `web/src/components/insights/RunwayCard.tsx`

- [ ] **Step 1: Create `InsightBadge.tsx`**

Reusable badge component for risk levels, anomalies, deductions. Uses the app's existing Tailwind + CSS custom property patterns:

```typescript
import { type RiskLevel } from '../../lib/types';

interface InsightBadgeProps {
  label: string;
  level: RiskLevel | 'info' | 'warning' | 'deductible';
  tooltip?: string;
}

const levelColors: Record<string, { bg: string; text: string }> = {
  low: { bg: 'var(--color-green)', text: 'var(--color-green)' },
  medium: { bg: 'var(--color-orange)', text: 'var(--color-orange)' },
  high: { bg: 'var(--color-red)', text: 'var(--color-red)' },
  info: { bg: 'var(--accent)', text: 'var(--accent)' },
  warning: { bg: 'var(--color-orange)', text: 'var(--color-orange)' },
  deductible: { bg: 'var(--color-green)', text: 'var(--color-green)' },
};

export function InsightBadge({ label, level, tooltip }: InsightBadgeProps) {
  const colors = levelColors[level] ?? levelColors.info;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium"
      style={{
        background: `color-mix(in srgb, ${colors.bg} 15%, transparent)`,
        color: colors.text,
      }}
      title={tooltip}
    >
      {level === 'high' && '!'}
      {level === 'warning' && '!'}
      {level === 'deductible' && '$'}
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create `InsightShimmer.tsx`**

Loading skeleton shown while insights are generating:

```typescript
interface InsightShimmerProps {
  className?: string;
  label?: string;
}

export function InsightShimmer({ className = '', label = 'AI insights updating...' }: InsightShimmerProps) {
  return (
    <div className={`animate-pulse rounded-xl p-4 ${className}`} style={{
      background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
      border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)',
    }}>
      <div className="text-[0.6rem] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="mt-2 h-6 w-24 rounded bg-[var(--bg-card)]" />
    </div>
  );
}
```

- [ ] **Step 3: Create `CashFlowChart.tsx`**

Bar chart for monthly inflow/outflow/net. Uses Recharts (already in `web/package.json`):

```typescript
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type CashFlowProjection } from '../../lib/types';

interface CashFlowChartProps {
  projections: CashFlowProjection[];
}

export function CashFlowChart({ projections }: CashFlowChartProps) {
  if (projections.length === 0) return null;

  return (
    <div className="rounded-xl p-4" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)] mb-3">
        Cash Flow Forecast
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={projections}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="inflow" name="Inflow" fill="var(--color-green)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outflow" name="Outflow" fill="var(--color-red)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="netCash" name="Net" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Create `ConcentrationDonut.tsx`**

Pie chart for client revenue share:

```typescript
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type ClientScore } from '../../lib/types';

interface ConcentrationDonutProps {
  scores: ClientScore[];
}

const COLORS = [
  'var(--accent)',
  'var(--color-green)',
  'var(--color-orange)',
  'var(--color-red)',
  'var(--text-secondary)',
];

export function ConcentrationDonut({ scores }: ConcentrationDonutProps) {
  if (scores.length === 0) return null;

  const data = scores.map((s) => ({
    name: s.clientName,
    value: Math.round(s.revenueShare * 100),
  }));

  return (
    <div className="rounded-xl p-4" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)] mb-3">
        Revenue Concentration
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Create `UtilizationGauge.tsx`**

Circular gauge for utilization rate. Uses SVG since Recharts doesn't have a native gauge:

```typescript
import { type Utilization } from '../../lib/types';

interface UtilizationGaugeProps {
  utilization: Utilization;
}

export function UtilizationGauge({ utilization }: UtilizationGaugeProps) {
  const pct = Math.round(utilization.currentRate * 100);
  const color = pct >= 80 ? 'var(--color-green)' : pct >= 50 ? 'var(--color-orange)' : 'var(--color-red)';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - utilization.currentRate);

  return (
    <div className="rounded-xl p-4 flex flex-col items-center" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)] mb-2">Utilization</div>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
          fill="var(--text-primary)" fontSize="20" fontWeight="bold">
          {pct}%
        </text>
      </svg>
      <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
        {utilization.trend === 'up' ? '↑' : utilization.trend === 'down' ? '↓' : '→'}
        {utilization.trend}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `RunwayCard.tsx`**

KPI card for runway estimate:

```typescript
import { type RunwayEstimate } from '../../lib/types';

interface RunwayCardProps {
  runway: RunwayEstimate;
}

const statusColors: Record<string, string> = {
  comfortable: 'var(--color-green)',
  caution: 'var(--color-orange)',
  critical: 'var(--color-red)',
};

export function RunwayCard({ runway }: RunwayCardProps) {
  const color = statusColors[runway.status] ?? 'var(--accent)';

  return (
    <div className="rounded-xl p-4" style={{
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
    }}>
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)]">Cash Runway</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>
        {runway.months} mo
      </div>
      <div className="text-xs mt-0.5 text-[var(--text-secondary)]">{runway.status}</div>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds (components not yet imported by any page).

- [ ] **Step 8: Commit**

```bash
git add web/src/components/insights/
git commit -m "feat(insights): add InsightBadge, charts, gauge, and shimmer components"
```

---

## Task 5: Cloud Function — generateInsights Orchestrator

**Files:**
- Create: `functions/src/generateInsights.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create `generateInsights.ts`**

Callable Cloud Function that orchestrates all 7 analyzers. Start with the orchestrator shell — analyzers will be stubbed and implemented in Tasks 6-8:

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { analyzeExpenses } from './utils/insights/analyzeExpenses';
import { analyzeTaxDeductions } from './utils/insights/analyzeTaxDeductions';
import { forecastRevenue } from './utils/insights/forecastRevenue';
import { analyzePayments } from './utils/insights/analyzePayments';
import { scoreClients } from './utils/insights/scoreClients';
import { projectCashFlow } from './utils/insights/projectCashFlow';
import { analyzeProjects } from './utils/insights/analyzeProjects';

const db = getFirestore();

interface InsightData {
  transactions: FirebaseFirestore.DocumentData[];
  workItems: FirebaseFirestore.DocumentData[];
  clients: FirebaseFirestore.DocumentData[];
}

async function fetchUserData(uid: string): Promise<InsightData> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [transactionsSnap, workItemsSnap, clientsSnap] = await Promise.all([
    db.collection('transactions')
      .where('ownerId', '==', uid)
      .where('date', '>=', twelveMonthsAgo)
      .get(),
    db.collection('workItems')
      .where('ownerId', '==', uid)
      .get(),
    db.collection('clients')
      .where('ownerId', '==', uid)
      .get(),
  ]);

  return {
    transactions: transactionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    workItems: workItemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    clients: clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export const onGenerateInsights = onCall(
  { maxInstances: 10, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = request.auth.uid;
    const force = request.data?.force === true;

    const insightRef = db.collection('insights').doc(uid);
    const existing = await insightRef.get();

    if (existing.exists) {
      const data = existing.data();
      const generatedAt = data?.generatedAt?.toDate?.();
      const status = data?.status;

      // Concurrency guard: skip if already generating within last 5 minutes
      if (status === 'generating' && generatedAt) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (generatedAt > fiveMinAgo) {
          return { skipped: true, reason: 'already_generating' };
        }
      }

      // Staleness guard: skip if generated within last 24 hours (unless forced)
      if (!force && generatedAt) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (generatedAt > twentyFourHoursAgo) {
          return { skipped: true, reason: 'fresh' };
        }
      }
    }

    // Mark as generating
    await insightRef.set(
      { status: 'generating', generatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    try {
      const userData = await fetchUserData(uid);
      const errors: string[] = [];

      // Run all 7 analyzers in parallel with individual error handling
      const [expenses, tax, forecast, payments, clients, cashFlow, projects] =
        await Promise.all([
          analyzeExpenses(userData.transactions).catch((e) => {
            errors.push(`expenses: ${e.message}`);
            return { anomalies: [], categoryTrends: [] };
          }),
          analyzeTaxDeductions(userData.transactions).catch((e) => {
            errors.push(`tax: ${e.message}`);
            return { estimatedSavings: 0, effectiveRate: 0, missedDeductions: [], deductionsByCategory: {}, totalDeductible: 0 };
          }),
          forecastRevenue(userData.transactions, userData.workItems).catch((e) => {
            errors.push(`forecast: ${e.message}`);
            return { revenue: [], expenses: [], confidence: 0 };
          }),
          analyzePayments(userData.workItems, userData.clients).catch((e) => {
            errors.push(`payments: ${e.message}`);
            return { invoiceRisks: [], clientPatterns: {} };
          }),
          scoreClients(userData.clients, userData.workItems, userData.transactions).catch((e) => {
            errors.push(`clients: ${e.message}`);
            return { scores: [], concentrationRisk: { level: 'healthy', topClientShare: 0, recommendation: '' } };
          }),
          projectCashFlow(userData.transactions, userData.workItems).catch((e) => {
            errors.push(`cashFlow: ${e.message}`);
            return { projections: [], runway: { months: 0, status: 'comfortable' } };
          }),
          analyzeProjects(userData.workItems).catch((e) => {
            errors.push(`projects: ${e.message}`);
            return { completionEstimates: [], scopeCreep: [], utilization: { currentRate: 0, trend: 'stable', recommendation: '' } };
          }),
        ]);

      await insightRef.set({
        generatedAt: FieldValue.serverTimestamp(),
        status: 'ready',
        errors: errors.length > 0 ? errors : null,
        expenses,
        tax,
        forecast,
        payments,
        clients,
        cashFlow,
        projects,
      });

      return { success: true, errors };
    } catch (error) {
      logger.error('generateInsights fatal error', { uid, error });
      await insightRef.set(
        { status: 'error', errors: [`fatal: ${(error as Error).message}`] },
        { merge: true }
      );
      throw new HttpsError('internal', 'Failed to generate insights');
    }
  }
);
```

- [ ] **Step 2: Export from `functions/src/index.ts`**

Add:

```typescript
export { onGenerateInsights } from './generateInsights';
```

- [ ] **Step 3: Create stub analyzer modules**

Create `functions/src/utils/insights/` directory with 7 stub files. Each returns the default empty shape so the function compiles. Example for `analyzeExpenses.ts`:

```typescript
export async function analyzeExpenses(
  _transactions: FirebaseFirestore.DocumentData[]
): Promise<{ anomalies: unknown[]; categoryTrends: unknown[] }> {
  return { anomalies: [], categoryTrends: [] };
}
```

Create similar stubs for all 7 files: `analyzeExpenses.ts`, `analyzeTaxDeductions.ts`, `forecastRevenue.ts`, `analyzePayments.ts`, `scoreClients.ts`, `projectCashFlow.ts`, `analyzeProjects.ts`.

- [ ] **Step 4: Verify functions build**

Run: `cd functions && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add functions/src/generateInsights.ts functions/src/index.ts functions/src/utils/insights/
git commit -m "feat(insights): add generateInsights orchestrator with stub analyzers"
```

---

## Task 6: Gemini Analyzers — Expenses + Tax + Forecast

**Files:**
- Modify: `functions/src/utils/insights/analyzeExpenses.ts`
- Modify: `functions/src/utils/insights/analyzeTaxDeductions.ts`
- Modify: `functions/src/utils/insights/forecastRevenue.ts`

- [ ] **Step 1: Implement `analyzeExpenses.ts`**

Replace stub with Gemini call. Follow the `smartCategorize.ts` pattern for structured JSON output:

```typescript
import { getGeminiClient } from '../geminiClient';

export async function analyzeExpenses(
  transactions: FirebaseFirestore.DocumentData[]
): Promise<{
  anomalies: Array<{
    transactionId: string; description: string; amount: number;
    category: string; reason: string; severity: 'info' | 'warning';
  }>;
  categoryTrends: Array<{
    category: string; currentMonth: number; previousMonth: number;
    trend: 'up' | 'down' | 'stable'; percentChange: number;
  }>;
}> {
  if (transactions.length === 0) {
    return { anomalies: [], categoryTrends: [] };
  }

  const expenseTransactions = transactions.filter((t) => t.type === 'expense');
  if (expenseTransactions.length === 0) {
    return { anomalies: [], categoryTrends: [] };
  }

  const summaryData = expenseTransactions.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    category: t.category,
    date: t.date?.toDate?.()?.toISOString?.() ?? '',
  }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent(`
You are a financial analyst for a solo contractor. Analyze these expense transactions and return JSON with two arrays:

1. "anomalies" (max 20): Flag expenses that are unusually high compared to the category average, duplicate-looking charges, or other anomalies.
   Each: { "transactionId": string, "description": string, "amount": number, "category": string, "reason": string (plain English explanation), "severity": "info" | "warning" }

2. "categoryTrends": For each expense category present, compare current month spending to previous month.
   Each: { "category": string, "currentMonth": number, "previousMonth": number, "trend": "up" | "down" | "stable", "percentChange": number }

Transactions:
${JSON.stringify(summaryData)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 2: Implement `analyzeTaxDeductions.ts`**

```typescript
import { getGeminiClient } from '../geminiClient';

export async function analyzeTaxDeductions(
  transactions: FirebaseFirestore.DocumentData[]
): Promise<{
  estimatedSavings: number; effectiveRate: number;
  missedDeductions: Array<{
    transactionId: string; description: string; amount: number;
    suggestedCategory: string; reason: string;
  }>;
  deductionsByCategory: Record<string, number>; totalDeductible: number;
}> {
  const currentYear = new Date().getFullYear();
  const yearTransactions = transactions.filter((t) => {
    const d = t.date?.toDate?.();
    return d && d.getFullYear() === currentYear && t.type === 'expense';
  });

  if (yearTransactions.length === 0) {
    return { estimatedSavings: 0, effectiveRate: 0.153, missedDeductions: [], deductionsByCategory: {}, totalDeductible: 0 };
  }

  const summaryData = yearTransactions.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    category: t.category,
    date: t.date?.toDate?.()?.toISOString?.() ?? '',
  }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a tax advisor for a US self-employed contractor (Schedule C filer). Analyze these expense transactions and return JSON:

1. "missedDeductions" (max 30): Transactions categorized as "Uncategorized" or in a wrong category that are likely tax-deductible. Each: { "transactionId": string, "description": string, "amount": number, "suggestedCategory": string (one of the Schedule C categories), "reason": string }

2. "deductionsByCategory": Object mapping each Schedule C category to the total deductible amount in dollars.

3. "totalDeductible": Sum of all deductible expenses in dollars.

4. "effectiveRate": The self-employment tax rate (use 0.153 for SE tax).

5. "estimatedSavings": totalDeductible * effectiveRate (approximate tax savings).

Schedule C categories: Software & Subscriptions, Equipment & Tools, Office Supplies, Travel, Meals & Entertainment, Vehicle & Fuel, Insurance, Professional Services, Advertising & Marketing, Utilities & Telecom, Subcontractors, Materials & Supplies, Education & Training.

Transactions:
${JSON.stringify(summaryData)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 3: Implement `forecastRevenue.ts`**

```typescript
import { getGeminiClient } from '../geminiClient';

export async function forecastRevenue(
  transactions: FirebaseFirestore.DocumentData[],
  workItems: FirebaseFirestore.DocumentData[]
): Promise<{
  revenue: Array<{ month: string; amount: number }>;
  expenses: Array<{ month: string; amount: number }>;
  confidence: number;
}> {
  if (transactions.length === 0) {
    return { revenue: [], expenses: [], confidence: 0 };
  }

  const monthlyData: Record<string, { revenue: number; expenses: number }> = {};
  for (const t of transactions) {
    const d = t.date?.toDate?.();
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { revenue: 0, expenses: 0 };
    if (t.type === 'income') monthlyData[key].revenue += t.amount;
    if (t.type === 'expense') monthlyData[key].expenses += t.amount;
  }

  const activeWorkItems = workItems
    .filter((w) => ['draft', 'inReview', 'approved'].includes(w.status))
    .map((w) => ({
      subject: w.subject,
      status: w.status,
      totalCost: w.totalCost ?? 0,
      invoiceStatus: w.invoiceStatus ?? null,
    }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const now = new Date();
  const nextMonths = [1, 2, 3].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const result = await model.generateContent(`
You are a financial forecaster for a solo contractor. Based on historical monthly revenue/expense data and active work items, predict the next 3 months.

Return JSON:
{
  "revenue": [{ "month": "YYYY-MM", "amount": number }, ...],  // exactly 3 entries for: ${nextMonths.join(', ')}
  "expenses": [{ "month": "YYYY-MM", "amount": number }, ...], // exactly 3 entries for same months
  "confidence": number  // 0.0 to 1.0, how confident you are in the prediction
}

Consider seasonal patterns, current pipeline (active work items), and trends.

Historical monthly data:
${JSON.stringify(monthlyData)}

Active work items (potential upcoming revenue):
${JSON.stringify(activeWorkItems)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 4: Verify functions build**

Run: `cd functions && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add functions/src/utils/insights/analyzeExpenses.ts functions/src/utils/insights/analyzeTaxDeductions.ts functions/src/utils/insights/forecastRevenue.ts
git commit -m "feat(insights): implement expense, tax, and forecast analyzers"
```

---

## Task 7: Gemini Analyzers — Payments + Clients

**Files:**
- Modify: `functions/src/utils/insights/analyzePayments.ts`
- Modify: `functions/src/utils/insights/scoreClients.ts`

- [ ] **Step 1: Implement `analyzePayments.ts`**

```typescript
import { getGeminiClient } from '../geminiClient';

export async function analyzePayments(
  workItems: FirebaseFirestore.DocumentData[],
  clients: FirebaseFirestore.DocumentData[]
): Promise<{
  invoiceRisks: Array<{
    workItemId: string; clientName: string; amount: number;
    risk: 'low' | 'medium' | 'high'; reason: string; predictedPayDate: string;
  }>;
  clientPatterns: Record<string, {
    avgDaysToPayment: number; onTimeRate: number;
    trend: 'improving' | 'worsening' | 'stable';
  }>;
}> {
  const invoicedItems = workItems.filter((w) => w.invoiceStatus);
  if (invoicedItems.length === 0) {
    return { invoiceRisks: [], clientPatterns: {} };
  }

  const clientMap: Record<string, string> = {};
  for (const c of clients) {
    clientMap[c.id] = c.name ?? c.company ?? 'Unknown';
  }

  const invoiceData = invoicedItems.map((w) => ({
    id: w.id,
    clientId: w.clientId,
    clientName: clientMap[w.clientId] ?? 'Unknown',
    totalCost: w.totalCost ?? 0,
    invoiceStatus: w.invoiceStatus,
    invoiceSentDate: w.invoiceSentDate?.toDate?.()?.toISOString?.() ?? null,
    invoicePaidDate: w.invoicePaidDate?.toDate?.()?.toISOString?.() ?? null,
    invoiceDueDate: w.invoiceDueDate?.toDate?.()?.toISOString?.() ?? null,
  }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a payment risk analyst for a solo contractor. Analyze invoice payment history and predict risks.

Return JSON:
{
  "invoiceRisks": [  // Only for unpaid invoices (invoiceStatus != "paid")
    { "workItemId": string, "clientName": string, "amount": number, "risk": "low"|"medium"|"high", "reason": string, "predictedPayDate": "YYYY-MM-DD" }
  ],
  "clientPatterns": {  // Keyed by clientId. For clients with payment history:
    "clientId": { "avgDaysToPayment": number, "onTimeRate": number (0-1), "trend": "improving"|"worsening"|"stable" }
  }
}

Base risk on: client payment history, invoice age, amount relative to client average.
Today's date: ${new Date().toISOString().split('T')[0]}

Invoice data:
${JSON.stringify(invoiceData)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 2: Implement `scoreClients.ts`**

```typescript
import { getGeminiClient } from '../geminiClient';

export async function scoreClients(
  clients: FirebaseFirestore.DocumentData[],
  workItems: FirebaseFirestore.DocumentData[],
  transactions: FirebaseFirestore.DocumentData[]
): Promise<{
  scores: Array<{
    clientId: string; clientName: string; lifetimeValue: number;
    churnRisk: 'low' | 'medium' | 'high'; revenueShare: number; reason: string;
  }>;
  concentrationRisk: {
    level: 'healthy' | 'moderate' | 'dangerous';
    topClientShare: number; recommendation: string;
  };
}> {
  if (clients.length === 0) {
    return {
      scores: [],
      concentrationRisk: { level: 'healthy', topClientShare: 0, recommendation: '' },
    };
  }

  const clientSummaries = clients.map((c) => {
    const clientWorkItems = workItems.filter((w) => w.clientId === c.id);
    const clientRevenue = clientWorkItems.reduce((sum, w) => sum + (w.totalCost ?? 0), 0);
    const lastActivity = clientWorkItems
      .map((w) => w.updatedAt?.toDate?.())
      .filter(Boolean)
      .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];

    return {
      clientId: c.id,
      clientName: c.name ?? c.company ?? 'Unknown',
      totalRevenue: clientRevenue,
      workItemCount: clientWorkItems.length,
      lastActivityDate: lastActivity?.toISOString?.() ?? null,
    };
  });

  const totalRevenue = clientSummaries.reduce((sum, c) => sum + c.totalRevenue, 0);

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a client relationship analyst for a solo contractor. Score each client and assess revenue concentration risk.

Return JSON:
{
  "scores": [  // One per client
    { "clientId": string, "clientName": string, "lifetimeValue": number (total revenue in $), "churnRisk": "low"|"medium"|"high", "revenueShare": number (0-1 fraction of total revenue), "reason": string (why this churn risk level) }
  ],
  "concentrationRisk": {
    "level": "healthy"|"moderate"|"dangerous",  // dangerous if any client > 50%, moderate if > 40%
    "topClientShare": number (0-1),
    "recommendation": string
  }
}

Churn risk factors: time since last activity, frequency of work, revenue trend.
Today's date: ${new Date().toISOString().split('T')[0]}
Total revenue across all clients: $${totalRevenue}

Client data:
${JSON.stringify(clientSummaries)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 3: Verify functions build**

Run: `cd functions && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add functions/src/utils/insights/analyzePayments.ts functions/src/utils/insights/scoreClients.ts
git commit -m "feat(insights): implement payments and client scoring analyzers"
```

---

## Task 8: Gemini Analyzers — Cash Flow + Projects

**Files:**
- Modify: `functions/src/utils/insights/projectCashFlow.ts`
- Modify: `functions/src/utils/insights/analyzeProjects.ts`

- [ ] **Step 1: Implement `projectCashFlow.ts`**

```typescript
import { getGeminiClient } from '../geminiClient';

export async function projectCashFlow(
  transactions: FirebaseFirestore.DocumentData[],
  workItems: FirebaseFirestore.DocumentData[]
): Promise<{
  projections: Array<{ month: string; inflow: number; outflow: number; netCash: number }>;
  runway: { months: number; status: 'comfortable' | 'caution' | 'critical' };
}> {
  if (transactions.length === 0) {
    return { projections: [], runway: { months: 0, status: 'comfortable' } };
  }

  const monthlyData: Record<string, { inflow: number; outflow: number }> = {};
  for (const t of transactions) {
    const d = t.date?.toDate?.();
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { inflow: 0, outflow: 0 };
    if (t.type === 'income') monthlyData[key].inflow += t.amount;
    if (t.type === 'expense') monthlyData[key].outflow += Math.abs(t.amount);
  }

  const unpaidInvoices = workItems
    .filter((w) => w.invoiceStatus && w.invoiceStatus !== 'paid')
    .map((w) => ({
      amount: w.totalCost ?? 0,
      dueDate: w.invoiceDueDate?.toDate?.()?.toISOString?.() ?? null,
      sentDate: w.invoiceSentDate?.toDate?.()?.toISOString?.() ?? null,
    }));

  const now = new Date();
  const nextMonths = [1, 2, 3].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a cash flow analyst for a solo contractor. Project cash flow for the next 3 months.

Return JSON:
{
  "projections": [  // exactly 3 entries for: ${nextMonths.join(', ')}
    { "month": "YYYY-MM", "inflow": number, "outflow": number, "netCash": number }
  ],
  "runway": {
    "months": number,  // estimated months of positive cash flow remaining
    "status": "comfortable"|"caution"|"critical"  // comfortable: 6+ months, caution: 3-6, critical: <3
  }
}

Factor in: historical patterns, seasonal trends, unpaid invoices (expected inflow), recurring expenses.
Today: ${now.toISOString().split('T')[0]}

Historical monthly cash flow:
${JSON.stringify(monthlyData)}

Unpaid invoices (expected inflow):
${JSON.stringify(unpaidInvoices)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 2: Implement `analyzeProjects.ts`**

```typescript
import { getGeminiClient } from '../geminiClient';

export async function analyzeProjects(
  workItems: FirebaseFirestore.DocumentData[]
): Promise<{
  completionEstimates: Array<{
    workItemId: string; title: string; estimatedDays: number; confidence: number;
  }>;
  scopeCreep: Array<{
    workItemId: string; title: string; reason: string; severity: 'warning' | 'info';
  }>;
  utilization: { currentRate: number; trend: 'up' | 'down' | 'stable'; recommendation: string };
}> {
  if (workItems.length === 0) {
    return {
      completionEstimates: [],
      scopeCreep: [],
      utilization: { currentRate: 0, trend: 'stable', recommendation: 'No work items to analyze.' },
    };
  }

  const activeItems = workItems
    .filter((w) => ['draft', 'inReview', 'approved'].includes(w.status))
    .map((w) => ({
      id: w.id,
      subject: w.subject,
      status: w.status,
      lineItemCount: w.lineItems?.length ?? 0,
      estimatedBusinessDays: w.estimatedBusinessDays ?? null,
      totalCost: w.totalCost ?? 0,
      createdAt: w.createdAt?.toDate?.()?.toISOString?.() ?? null,
      updatedAt: w.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    }));

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const completedItems = workItems
    .filter((w) => {
      const completed = w.status === 'completed';
      const recent = w.updatedAt?.toDate?.() > sixMonthsAgo;
      return completed && recent;
    })
    .map((w) => ({
      lineItemCount: w.lineItems?.length ?? 0,
      estimatedBusinessDays: w.estimatedBusinessDays ?? null,
      totalCost: w.totalCost ?? 0,
      createdAt: w.createdAt?.toDate?.()?.toISOString?.() ?? null,
      completedAt: w.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    }));

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(`
You are a project management analyst for a solo contractor. Analyze work items.

Return JSON:
{
  "completionEstimates": [  // For each active work item
    { "workItemId": string, "title": string, "estimatedDays": number, "confidence": number (0-1) }
  ],
  "scopeCreep": [  // max 10. Flag items showing scope creep signals
    { "workItemId": string, "title": string, "reason": string, "severity": "warning"|"info" }
  ],
  "utilization": {
    "currentRate": number (0-1),  // Based on active items vs capacity
    "trend": "up"|"down"|"stable",
    "recommendation": string
  }
}

Scope creep signals: high line item count relative to estimated days, long time in draft/review, growing cost.
Estimate completion by comparing to completed items with similar complexity.
Today: ${new Date().toISOString().split('T')[0]}

Active work items:
${JSON.stringify(activeItems)}

Recently completed items (for velocity reference):
${JSON.stringify(completedItems)}
  `);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error('Failed to parse Gemini response:', result.response.text());
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 3: Verify functions build**

Run: `cd functions && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add functions/src/utils/insights/projectCashFlow.ts functions/src/utils/insights/analyzeProjects.ts
git commit -m "feat(insights): implement cash flow and project management analyzers"
```

---

## Task 9: Integrate Insights into FinanceOverview Page

**Files:**
- Modify: `web/src/routes/contractor/FinanceOverview.tsx`

- [ ] **Step 1: Add useInsights hook and import components**

At the top of `FinanceOverview.tsx`, add:

```typescript
import { useInsights } from '../../hooks/useFirestore';
import { CashFlowChart } from '../../components/insights/CashFlowChart';
import { RunwayCard } from '../../components/insights/RunwayCard';
import { InsightShimmer } from '../../components/insights/InsightShimmer';
import { KpiCard } from '../../components/finance/KpiCard';
```

Inside the component, add:

```typescript
const { insights, isGenerating } = useInsights();
```

- [ ] **Step 2: Add Tax Savings KPI card**

In the KPI grid section, add a new card:

```typescript
{isGenerating ? (
  <InsightShimmer label="Tax savings loading..." />
) : insights?.tax ? (
  <KpiCard
    label="Est. Tax Savings"
    value={insights.tax.estimatedSavings}
    subtitle={`$${insights.tax.totalDeductible.toLocaleString()} deductible`}
    color="green"
  />
) : null}
```

- [ ] **Step 3: Add Runway KPI card**

```typescript
{isGenerating ? (
  <InsightShimmer label="Runway loading..." />
) : insights?.cashFlow?.runway ? (
  <RunwayCard runway={insights.cashFlow.runway} />
) : null}
```

- [ ] **Step 4: Add Cash Flow Chart**

Below the existing revenue chart section:

```typescript
{isGenerating ? (
  <InsightShimmer className="h-[260px]" label="Cash flow forecast loading..." />
) : insights?.cashFlow?.projections?.length ? (
  <CashFlowChart projections={insights.cashFlow.projections} />
) : null}
```

- [ ] **Step 5: Add forecast overlay data to existing RevenueChart**

Check how the existing `RevenueChart` component accepts data. Pass `insights?.forecast?.revenue` as additional dashed-line data. This depends on the existing chart implementation — modify `RevenueChart` to accept an optional `forecast` prop and render it as a dashed `Line` in the existing `LineChart`/`AreaChart`.

- [ ] **Step 6: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add web/src/routes/contractor/FinanceOverview.tsx web/src/components/finance/RevenueChart.tsx
git commit -m "feat(insights): add tax, runway, cash flow, and forecast to FinanceOverview"
```

---

## Task 10: Integrate Insights into Expenses + Transactions Pages

**Files:**
- Modify: `web/src/routes/contractor/Expenses.tsx`
- Modify: `web/src/routes/contractor/Transactions.tsx`

- [ ] **Step 1: Add anomaly badges to Expenses page**

Import `useInsights` and `InsightBadge`. In the expense list rendering, check if each transaction ID exists in `insights.expenses.anomalies`. If so, render an `InsightBadge` next to the row:

```typescript
const { insights } = useInsights();

// In the row render:
const anomaly = insights?.expenses?.anomalies?.find((a) => a.transactionId === expense.id);
{anomaly && (
  <InsightBadge label={anomaly.severity === 'warning' ? 'Anomaly' : 'Note'} level={anomaly.severity} tooltip={anomaly.reason} />
)}
```

- [ ] **Step 2: Add category trend arrows to Expenses page**

In the category summary section (if it exists), add trend indicators:

```typescript
const trend = insights?.expenses?.categoryTrends?.find((t) => t.category === category);
{trend && (
  <span className="text-xs ml-1" style={{
    color: trend.trend === 'up' ? 'var(--color-red)' : trend.trend === 'down' ? 'var(--color-green)' : 'var(--text-secondary)'
  }}>
    {trend.trend === 'up' ? '↑' : trend.trend === 'down' ? '↓' : '→'} {Math.abs(trend.percentChange)}%
  </span>
)}
```

- [ ] **Step 3: Add deduction badges to Transactions page**

Import `useInsights` and `InsightBadge` in `Transactions.tsx`. In the transaction row render, check `insights.tax.missedDeductions`:

```typescript
const { insights } = useInsights();

// In the row render:
const deduction = insights?.tax?.missedDeductions?.find((d) => d.transactionId === tx.id);
{deduction && (
  <InsightBadge label="Deductible" level="deductible" tooltip={`${deduction.reason} — suggest: ${deduction.suggestedCategory}`} />
)}
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/contractor/Expenses.tsx web/src/routes/contractor/Transactions.tsx
git commit -m "feat(insights): add anomaly and deduction badges to Expenses and Transactions"
```

---

## Task 11: Integrate Insights into Invoices Page

**Files:**
- Modify: `web/src/routes/contractor/Invoices.tsx`

- [ ] **Step 1: Add risk badges to unpaid invoices**

Import `useInsights` and `InsightBadge`. In the invoice list/table rendering, check `insights.payments.invoiceRisks` for each work item:

```typescript
const { insights } = useInsights();

// In the invoice row render:
const risk = insights?.payments?.invoiceRisks?.find((r) => r.workItemId === workItem.id);
{risk && (
  <InsightBadge label={risk.risk} level={risk.risk} tooltip={risk.reason} />
)}
```

- [ ] **Step 2: Add predicted pay date column**

If the invoice table has columns, add a "Predicted" column for unpaid invoices:

```typescript
{risk?.predictedPayDate && (
  <span className="text-xs text-[var(--text-secondary)]">
    ~{new Date(risk.predictedPayDate).toLocaleDateString()}
  </span>
)}
```

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/contractor/Invoices.tsx
git commit -m "feat(insights): add payment risk badges and predicted dates to Invoices"
```

---

## Task 12: Integrate Insights into Clients Page

**Files:**
- Modify: `web/src/routes/contractor/Clients.tsx`

- [ ] **Step 1: Add concentration donut chart**

Import `useInsights` and `ConcentrationDonut`. Add the chart at the top of the Clients page:

```typescript
const { insights, isGenerating } = useInsights();

// Above the client grid/list:
{isGenerating ? (
  <InsightShimmer className="h-[260px]" label="Client analysis loading..." />
) : insights?.clients?.scores?.length ? (
  <ConcentrationDonut scores={insights.clients.scores} />
) : null}
```

- [ ] **Step 2: Add LTV and churn badges to client cards**

In the client card/list rendering, check `insights.clients.scores` for each client:

```typescript
const score = insights?.clients?.scores?.find((s) => s.clientId === client.id);
{score && (
  <div className="flex gap-1.5 mt-1">
    <InsightBadge label={`$${score.lifetimeValue.toLocaleString()}`} level="info" tooltip="Lifetime value" />
    <InsightBadge label={`Churn: ${score.churnRisk}`} level={score.churnRisk} tooltip={score.reason} />
  </div>
)}
```

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/contractor/Clients.tsx
git commit -m "feat(insights): add concentration chart and client scores to Clients page"
```

---

## Task 13: Integrate Insights into Dashboard + WorkItems

**Files:**
- Modify: `web/src/routes/contractor/Dashboard.tsx`
- Modify: `web/src/routes/contractor/WorkItems.tsx`

- [ ] **Step 1: Add utilization gauge to Dashboard**

Import `useInsights`, `UtilizationGauge`, and `InsightShimmer`. Add the gauge in the dashboard grid:

```typescript
const { insights, isGenerating } = useInsights();

{isGenerating ? (
  <InsightShimmer label="Utilization loading..." />
) : insights?.projects?.utilization ? (
  <UtilizationGauge utilization={insights.projects.utilization} />
) : null}
```

- [ ] **Step 2: Add concentration warning banner to Dashboard**

```typescript
{insights?.clients?.concentrationRisk?.level === 'dangerous' && (
  <div className="rounded-xl p-3 text-sm flex items-center gap-2" style={{
    background: 'color-mix(in srgb, var(--color-orange) 10%, transparent)',
    border: '1px solid color-mix(in srgb, var(--color-orange) 25%, transparent)',
    color: 'var(--color-orange)',
  }}>
    <span className="font-medium">Revenue concentration risk:</span>
    {insights.clients.concentrationRisk.recommendation}
  </div>
)}
```

- [ ] **Step 3: Add completion estimates to WorkItems page**

Import `useInsights` and `InsightBadge`. In the work item row rendering:

```typescript
const { insights } = useInsights();

// In the work item row:
const estimate = insights?.projects?.completionEstimates?.find((e) => e.workItemId === workItem.id);
{estimate && (
  <InsightBadge label={`~${estimate.estimatedDays}d`} level="info" tooltip={`Estimated ${estimate.estimatedDays} days (${Math.round(estimate.confidence * 100)}% confidence)`} />
)}

const creep = insights?.projects?.scopeCreep?.find((s) => s.workItemId === workItem.id);
{creep && (
  <InsightBadge label="Scope creep" level={creep.severity} tooltip={creep.reason} />
)}
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/contractor/Dashboard.tsx web/src/routes/contractor/WorkItems.tsx
git commit -m "feat(insights): add utilization, concentration warning, and project insights"
```

---

## Task 14: Final Integration Verification

- [ ] **Step 1: Build both projects**

Run: `cd web && npm run build && cd ../functions && npm run build`
Expected: Both builds succeed with no errors.

- [ ] **Step 2: Run linter**

Run: `cd web && npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Visual check of "last updated" indicator**

Ensure all insight components that render data include a subtle "Last updated X hours ago" indicator. Add this to the `useInsights` return value:

```typescript
const lastUpdatedText = lastGenerated
  ? `Last updated ${Math.round((Date.now() - lastGenerated.getTime()) / 3600000)}h ago`
  : null;
```

Pages should render this near insight sections.

- [ ] **Step 4: Final commit**

Stage all modified insight-related files explicitly and commit:
```bash
git commit -m "feat(insights): final integration and polish"
```
