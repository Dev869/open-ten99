# Finance Reporting Module — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Author:** Claude + Devin Wilson

## Overview

A comprehensive finance module for OpenChanges that replaces the existing Analytics page and adds invoice management, bank/payment integration, expense tracking, smart reconciliation, and tax-ready reporting. Each contractor gets their own financial dashboard with their own connected accounts, scoped by `ownerId`.

## Phased Rollout

### Phase 1: Reports & Invoicing (No new integrations)
- Finance Overview dashboard (replaces Analytics)
- Invoice management with filtering, aging, bulk actions
- Revenue reports (MTD/QTD/YTD)
- Tax-ready CSV/PDF exports
- Client billing summaries

### Phase 2: Bank & Payment Integration
- Plaid Link for bank account connections
- Stripe API integration for payment data
- Unified transaction ledger
- Account balances and sync status
- Encrypted token storage per user

### Phase 3: Reconciliation & Expenses
- Smart match suggestions (amount + date + memo scoring)
- Manual expense entry with receipt upload
- Auto-categorization of bank transactions
- Profit & Loss statements
- 1099-ready income categorization

## Navigation

Analytics is replaced by Finance with expandable sidebar sub-items:
- **Finance** (expandable)
  - Overview (`/dashboard/finance`)
  - Invoices (`/dashboard/finance/invoices`)
  - Transactions (`/dashboard/finance/transactions`)
  - Expenses (`/dashboard/finance/expenses`)
  - Reports (`/dashboard/finance/reports`)
  - Accounts (`/dashboard/finance/accounts`)

## Data Model

### Existing Fields (no changes)

WorkItem invoice fields:
- `invoiceStatus: 'draft' | 'sent' | 'paid' | 'overdue'`
- `invoiceSentDate: Date`
- `invoicePaidDate: Date`
- `invoiceDueDate: Date`
- `totalCost: number`
- `totalHours: number`
- `isBillable: boolean`

### New Collections

#### `connectedAccounts/{docId}`

| Field | Type | Description |
|-------|------|-------------|
| `ownerId` | string | Contractor who owns this connection |
| `provider` | `'plaid' \| 'stripe'` | Integration provider |
| `accountName` | string | Display name (e.g., "Chase Business Checking") |
| `institutionName` | string | Bank name (Plaid only) |
| `accountMask` | string | Last 4 digits |
| `accessToken` | string | Encrypted — Plaid access token or Stripe restricted key |
| `itemId` | string | Plaid item ID |
| `status` | `'active' \| 'error' \| 'disconnected'` | Connection health |
| `lastSyncedAt` | Date | Last successful sync |
| `createdAt` | Date | When connected |

#### `transactions/{docId}`

| Field | Type | Description |
|-------|------|-------------|
| `ownerId` | string | Contractor scope |
| `accountId` | string | Ref to connectedAccounts |
| `provider` | `'plaid' \| 'stripe'` | Source |
| `externalId` | string | Plaid transaction_id or Stripe charge ID |
| `date` | Date | Transaction date |
| `amount` | number | Positive = income, negative = expense |
| `description` | string | Merchant name or memo |
| `category` | string | Auto or manual category |
| `type` | `'income' \| 'expense' \| 'transfer' \| 'uncategorized'` | Classification |
| `matchedWorkItemId` | string? | Linked invoice |
| `matchConfidence` | number? | 0-1 score |
| `matchStatus` | `'unmatched' \| 'suggested' \| 'confirmed' \| 'rejected'` | Reconciliation state |
| `isManual` | boolean | True for manual entries |
| `receiptUrl` | string? | Firebase Storage path |
| `createdAt` | Date | Import/creation time |

#### `expenses/{docId}`

| Field | Type | Description |
|-------|------|-------------|
| `ownerId` | string | Contractor scope |
| `description` | string | What the expense is for |
| `amount` | number | Cost |
| `category` | string | Expense category |
| `date` | Date | When incurred |
| `receiptUrl` | string? | Firebase Storage path |
| `transactionId` | string? | Linked auto-imported transaction |
| `taxDeductible` | boolean | Deductible flag |
| `createdAt` | Date | Entry time |

### Firestore Security Rules

All three new collections use the same `ownerId` pattern as existing collections:
- Contractors can read/write their own documents (`resource.data.ownerId == request.auth.uid`)
- New writes must set `ownerId == request.auth.uid`
- Portal clients have no access to finance collections

## Cloud Functions

### Plaid Integration

| Function | Type | Purpose |
|----------|------|---------|
| `onPlaidLinkToken` | Callable | Generate Plaid Link token for client-side UI |
| `onPlaidExchange` | Callable | Exchange public_token for access_token, encrypt and store |
| `onPlaidSync` | Scheduled (6h) | Incremental transaction sync via cursor-based Transactions Sync API |
| `onPlaidWebhook` | HTTP | Real-time updates, error handling, token expiration |

### Stripe Integration

| Function | Type | Purpose |
|----------|------|---------|
| `onStripeConnect` | Callable | Validate and store encrypted restricted API key |
| `onStripeSync` | Scheduled (6h) | Fetch new charges/payments, normalize to transaction format |
| `onStripeWebhook` | HTTP | Real-time payment events (`charge.succeeded`, `payment_intent.succeeded`) |

### Reconciliation (Phase 3)

| Function | Type | Purpose |
|----------|------|---------|
| `onTransactionCreated` | Firestore trigger | Smart matching — score by amount match, date proximity, client name fuzzy match. Suggest at >0.7 confidence, never auto-confirm |
| `onGenerateReport` | Callable | Server-side PDF generation via pdf-lib. Accepts report type + date range, returns Firebase Storage download URL |

### Token Security

- Encryption: AES-256-GCM in `functions/src/lib/crypto.ts` (server-side, separate from client Vault crypto)
- Encryption key: `PLAID_ENCRYPTION_KEY` via Firebase secrets
- Plaid credentials: `PLAID_CLIENT_ID`, `PLAID_SECRET` via Firebase secrets
- Stripe webhook: `STRIPE_WEBHOOK_SECRET` via Firebase secrets
- Access tokens are decrypted server-side only — never sent to the client

**Key decision:** Plaid/Stripe tokens use server-side encryption, NOT the zero-knowledge Vault. Cloud Functions need to decrypt tokens for automated syncing, which is incompatible with zero-knowledge architecture.

## Frontend Pages

### Finance Overview (`/dashboard/finance`)

Replaces the existing Analytics page. Contains:
- **Date range selector:** MTD, QTD, YTD, Custom
- **KPI cards:** Revenue (with trend %), Outstanding, Overdue, Net Profit (Phase 3) / Expenses
- **Revenue vs Expenses chart:** 6-month stacked bar chart (Recharts)
- **Top Clients:** Horizontal bar breakdown by revenue
- **Recent Activity feed:** Payments received, invoices sent, overdue alerts, expenses logged

### Invoice Management (`/dashboard/finance/invoices`)

- **Status tabs:** All, Draft, Sent, Overdue, Paid (with counts)
- **Aging summary bar:** Current, 1-30 days, 31-60 days, 60+ days
- **Table columns:** Checkbox, Work Order/Client, Amount, Sent date, Due date, Status badge
- **Bulk actions:** Mark as Sent, Mark as Paid, Export selected
- **CSV export** for full invoice list

### Transactions (`/dashboard/finance/transactions`)

- **Connected accounts bar:** Shows each account with status and last sync time, + "Connect Account" button
- **Unified ledger:** All transactions from Plaid + Stripe in reverse chronological order
- **Smart match suggestions:** Highlighted rows with confidence score, linked invoice preview, Confirm/Reject buttons
- **Category badges:** Auto-assigned from Plaid MCC codes, editable inline
- **Filters:** By account, date range, type (income/expense), match status

### Expenses (`/dashboard/finance/expenses`)

- **Manual entry form:** Description, amount, category dropdown, date, receipt upload, tax-deductible toggle
- **Expense list:** All expenses (manual + auto-imported from transactions marked as expenses)
- **Category summary:** Totals by category for the selected period
- **Receipt viewer:** Click to view uploaded receipt images

### Reports (`/dashboard/finance/reports`)

Six report types, each with PDF and CSV export:
1. **Profit & Loss** — Revenue, expenses, net income by period
2. **Income by Client** — 1099-ready breakdown per client
3. **Tax Summary** — Annual income, categorized expenses, estimated quarterly tax
4. **Hours & Billing** — Hours worked, effective rate, billable vs non-billable
5. **Aging Report** — Outstanding invoices by age bucket
6. **Expense Report** — All expenses by category with receipt links

Reports are generated server-side via `onGenerateReport` Cloud Function using pdf-lib.

### Accounts (`/dashboard/finance/accounts`)

- **Connected account list:** Provider, account name, mask, status, last sync
- **Actions:** Connect new (Plaid Link / Stripe key input), disconnect, re-authenticate
- **Sync controls:** Manual sync trigger, sync history log

## Expense Categories

Modeled after Schedule C (sole proprietor tax form):

| Category | Tax Line | Examples |
|----------|----------|----------|
| Software & Subscriptions | Other expenses | Adobe CC, GitHub, hosting |
| Equipment & Tools | Depreciation | Laptop, tools, machinery |
| Office Supplies | Office expense | Paper, printer ink |
| Travel | Travel | Flights, hotels, mileage |
| Meals & Entertainment | Meals | Client dinners (50% deductible) |
| Vehicle & Fuel | Car expense | Gas, maintenance |
| Insurance | Insurance | Liability, E&O |
| Professional Services | Legal/professional | Accountant, lawyer |
| Advertising & Marketing | Advertising | Website, ads |
| Utilities & Telecom | Utilities | Phone, internet |
| Subcontractors | Contract labor | 1099 workers |
| Materials & Supplies | Supplies | Job-specific materials |
| Education & Training | Other expenses | Courses, certifications |
| Uncategorized | — | Needs manual classification |

Plaid MCC codes are mapped to these categories automatically. Users can reclassify any transaction.

## Charting

Replace manual CSS bar charts with **Recharts** library:
- `BarChart` for revenue vs expenses comparison
- `LineChart` for trend lines
- `ResponsiveContainer` for responsive sizing
- Composable components that accept WorkItem/Transaction arrays directly

## New Dependencies

### Web (`web/package.json`)
- `recharts` — charting library
- `react-plaid-link` — Plaid Link React component
- `date-fns` — date manipulation (if not already present)

### Functions (`functions/package.json`)
- `plaid` — Plaid Node.js client
- `stripe` — Stripe Node.js SDK (if not already present)

## Migration Path

- Analytics page (`/dashboard/analytics`) redirects to `/dashboard/finance`
- Analytics route component is replaced by FinanceOverview
- Existing Analytics chart logic (revenue calculations, by-client, by-type) is preserved and enhanced
- No data migration needed — Phase 1 reads from existing WorkItem data

## Testing Strategy

- Unit tests for financial calculations (revenue aggregation, aging buckets, matching algorithm)
- Integration tests for Plaid/Stripe Cloud Functions (using test API keys)
- E2E tests for invoice management workflow and report generation
- Manual testing for Plaid Link flow (requires sandbox credentials)
