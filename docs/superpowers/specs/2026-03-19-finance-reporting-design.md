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
- Sidebar refactor: expandable nav groups

### Phase 2: Bank & Payment Integration
- Plaid Link for bank account connections
- Stripe API integration for payment data
- Unified transaction ledger with cursor-based pagination
- Account balances and sync status
- Server-only encrypted token storage

### Phase 3: Reconciliation & Expenses
- Smart match suggestions (amount + date + memo scoring)
- Manual expense entry with receipt upload
- Auto-categorization of bank transactions
- Profit & Loss statements
- 1099-ready income categorization

## Navigation

Analytics is replaced by Finance with expandable sidebar sub-items. The current `Sidebar.tsx` uses a flat `NavItem[]` array — this requires adding an expandable group concept (children array + collapse/expand toggle, consistent with the existing sidebar expand/collapse pattern).

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

#### `connectedAccounts/{docId}` (client-readable)

Contains display-safe metadata only. No secrets.

| Field | Type | Description |
|-------|------|-------------|
| `ownerId` | string | Contractor who owns this connection |
| `provider` | `'plaid' \| 'stripe'` | Integration provider |
| `accountName` | string | Display name (e.g., "Chase Business Checking") |
| `institutionName` | string | Bank name (Plaid only) |
| `accountMask` | string | Last 4 digits |
| `status` | `'active' \| 'error' \| 'disconnected'` | Connection health |
| `errorMessage` | string? | Human-readable error (e.g., "Re-authentication required") |
| `lastSyncedAt` | Date | Last successful sync |
| `createdAt` | Date | When connected |
| `updatedAt` | Date | Last modified |

#### `_secrets/connectedAccountTokens/{docId}` (server-only)

Access tokens stored in a server-only collection. Client Firestore rules deny all access. Only Cloud Functions (admin SDK) can read/write.

| Field | Type | Description |
|-------|------|-------------|
| `accountId` | string | Ref to connectedAccounts doc |
| `ownerId` | string | Contractor scope (for admin queries) |
| `accessToken` | string | AES-256-GCM encrypted Plaid access token or Stripe restricted key |
| `itemId` | string? | Plaid item ID |
| `syncCursor` | string? | Plaid Transactions Sync cursor for incremental fetches |
| `createdAt` | Date | When stored |
| `updatedAt` | Date | Last modified |

#### `transactions/{docId}` (unified — includes manual expenses)

Single source of truth for all financial transactions. Manual expenses are transactions with `isManual: true` and `type: 'expense'`. This eliminates the need for a separate `expenses` collection and prevents data drift.

| Field | Type | Description |
|-------|------|-------------|
| `ownerId` | string | Contractor scope |
| `accountId` | string? | Ref to connectedAccounts (null for manual entries) |
| `provider` | `'plaid' \| 'stripe' \| 'manual'` | Source |
| `externalId` | string? | Plaid transaction_id or Stripe charge ID (null for manual) |
| `date` | Date | Transaction date |
| `amount` | number | Positive = income, negative = expense |
| `description` | string | Merchant name or memo |
| `category` | string | Auto or manual category (see Expense Categories) |
| `type` | `'income' \| 'expense' \| 'transfer' \| 'uncategorized'` | Classification |
| `matchedWorkItemId` | string? | Linked invoice (Phase 3) |
| `matchConfidence` | number? | 0-1 score from smart matching |
| `matchStatus` | `'unmatched' \| 'suggested' \| 'confirmed' \| 'rejected'` | Reconciliation state |
| `isManual` | boolean | True for manually entered expenses |
| `receiptUrl` | string? | Firebase Storage path |
| `taxDeductible` | boolean? | For expenses — deductible flag |
| `createdAt` | Date | Import/creation time |
| `updatedAt` | Date | Last modified |

### Firestore Security Rules

```javascript
// connectedAccounts — client can read/write display metadata (no secrets)
match /connectedAccounts/{docId} {
  allow read: if request.auth != null
    && resource.data.ownerId == request.auth.uid;
  allow create: if request.auth != null
    && request.resource.data.ownerId == request.auth.uid;
  allow update: if request.auth != null
    && resource.data.ownerId == request.auth.uid
    && request.resource.data.ownerId == request.auth.uid;
  allow delete: if request.auth != null
    && resource.data.ownerId == request.auth.uid;
}

// _secrets — deny ALL client access, admin SDK only
match /_secrets/{document=**} {
  allow read, write: if false;
}

// transactions — standard ownerId pattern
match /transactions/{docId} {
  allow read: if request.auth != null
    && resource.data.ownerId == request.auth.uid;
  allow create: if request.auth != null
    && request.resource.data.ownerId == request.auth.uid;
  allow update: if request.auth != null
    && resource.data.ownerId == request.auth.uid
    && request.resource.data.ownerId == request.auth.uid;
  allow delete: if request.auth != null
    && resource.data.ownerId == request.auth.uid;
}
```

### Firebase Storage Rules

Receipt uploads stored under `receipts/{userId}/{fileName}`:

```javascript
match /receipts/{userId}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId
    && request.resource.size < 10 * 1024 * 1024  // 10MB max
    && request.resource.contentType.matches('image/.*|application/pdf');
}
```

Report PDFs stored under `reports/{userId}/{fileName}`:

```javascript
match /reports/{userId}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false;  // Only Cloud Functions write reports
}
```

## Cloud Functions

### Plaid Integration

| Function | Type | Purpose |
|----------|------|---------|
| `onPlaidLinkToken` | Callable | Generate Plaid Link token for client-side UI. Uses `PLAID_ENV` secret to target Sandbox/Production. |
| `onPlaidExchange` | Callable | Exchange public_token for access_token, encrypt and store in `_secrets/connectedAccountTokens`. Create `connectedAccounts` doc with display metadata. Trigger initial sync. |
| `onPlaidSync` | Scheduled (6h) | Incremental transaction sync via cursor-based Transactions Sync API. Stores cursor in `_secrets`. |
| `onPlaidWebhook` | HTTP | Real-time updates, error handling, `ITEM_LOGIN_REQUIRED` → sets `status: 'error'` + `errorMessage` on `connectedAccounts`. |

### Stripe Integration

| Function | Type | Purpose |
|----------|------|---------|
| `onStripeConnect` | Callable | Receives user's Stripe restricted key. Validates by calling `stripe.balance.retrieve()`. Required scopes: `charges:read`, `balance:read`, `payment_intents:read`. Encrypts and stores in `_secrets`. |
| `onStripeSync` | Scheduled (6h) | Fetch new charges/payments from Stripe, normalize to transaction format. On `401`/`403`, sets `status: 'error'` + `errorMessage: 'API key revoked or invalid'`. |
| `onStripeWebhook` | HTTP | Real-time payment events (`charge.succeeded`, `payment_intent.succeeded`). Validates via `STRIPE_WEBHOOK_SECRET`. |

### Manual Sync

| Function | Type | Purpose |
|----------|------|---------|
| `onManualSync` | Callable | On-demand sync for a specific `connectedAccount`. Shares sync logic with scheduled functions. Throttled to 1 call per 15 minutes per account (checked via `lastSyncedAt`). |

### Reconciliation (Phase 3)

| Function | Type | Purpose |
|----------|------|---------|
| `onTransactionCreated` | Firestore trigger | Smart matching algorithm (see Matching Algorithm section below). |
| `onGenerateReport` | Callable | Server-side PDF generation via pdf-lib. Accepts report type + date range. Writes to deterministic path `reports/{ownerId}/{reportType}-{startDate}-{endDate}.pdf` (overwrites on regeneration). Returns signed download URL (7-day expiry). |

### Report Cleanup

| Function | Type | Purpose |
|----------|------|---------|
| `onReportCleanup` | Scheduled (daily) | Deletes report PDFs from Storage older than 30 days. |

### Token Security

- Encryption: AES-256-GCM in `functions/src/lib/crypto.ts` (server-side, separate from client Vault crypto)
- All secrets via `firebase functions:secrets:set`:
  - `PLAID_ENCRYPTION_KEY` — encrypts access tokens at rest
  - `PLAID_CLIENT_ID`, `PLAID_SECRET` — Plaid API credentials
  - `PLAID_ENV` — `sandbox` | `development` | `production`
  - `STRIPE_WEBHOOK_SECRET` — Stripe webhook validation
- Access tokens stored in `_secrets/` collection — **never readable by client code**
- Encrypted tokens are decrypted server-side only for API calls

**Key decision:** Plaid/Stripe tokens use server-side encryption in a client-inaccessible collection, NOT the zero-knowledge Vault. Cloud Functions need to decrypt tokens for automated syncing, which is incompatible with zero-knowledge architecture.

### Matching Algorithm (Phase 3)

Scoring weights for `onTransactionCreated`:

| Signal | Weight | Scoring |
|--------|--------|---------|
| Amount match | 0.5 | Exact = 1.0, within 2% = 0.8, within 5% = 0.5, otherwise 0 |
| Date proximity | 0.3 | Same day = 1.0, ±3 days = 0.8, ±7 days = 0.5, ±14 days = 0.2, otherwise 0 |
| Client name match | 0.2 | Fuzzy match (Levenshtein) of transaction description against client names. Exact substring = 1.0, >0.8 similarity = 0.7, otherwise 0 |

Combined score = (amount_score × 0.5) + (date_score × 0.3) + (name_score × 0.2)

- Score > 0.7 → write `matchStatus: 'suggested'` with `matchConfidence` and `matchedWorkItemId`
- Score ≤ 0.7 → leave as `matchStatus: 'unmatched'`
- Never auto-confirm — user always confirms

### Error Handling — Plaid Link Flow

| Scenario | Handling |
|----------|----------|
| User closes Plaid Link without completing | `onExit` callback — no action needed, show toast "Connection cancelled" |
| `onPlaidExchange` fails (expired public_token) | Return error to client, show toast "Connection failed, please try again" |
| `ITEM_LOGIN_REQUIRED` (re-auth needed) | Set `status: 'error'`, `errorMessage: 'Re-authentication required'` on `connectedAccounts`. Show banner on Finance pages with "Re-connect" button that opens Plaid Link in update mode. |
| Plaid API rate limit (429) | Exponential backoff in Cloud Function, max 3 retries. If still failing, set `status: 'error'` and log. |
| Plaid webhook validation failure | Return 401, log attempt. Do not process. |

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
- **CSV export:** Client-side generation (data already loaded), no Cloud Function needed

### Transactions (`/dashboard/finance/transactions`)

- **Connected accounts bar:** Shows each account with status and last sync time, + "Connect Account" button
- **Unified ledger:** All transactions from Plaid + Stripe + manual, reverse chronological
- **Pagination:** Cursor-based (Firestore `startAfter` + `limit` of 50), NOT `onSnapshot` for full collection. Transactions can grow to thousands — must paginate.
- **Smart match suggestions:** Highlighted rows with confidence score, linked invoice preview, Confirm/Reject buttons
- **Category badges:** Auto-assigned from Plaid MCC codes, editable inline
- **Filters:** By account, date range, type (income/expense), match status

### Expenses (`/dashboard/finance/expenses`)

- **Manual entry form:** Description, amount, category dropdown, date, receipt upload (images/PDFs, 10MB max), tax-deductible toggle
- **Expense list:** Queries `transactions` where `type == 'expense'` (both `isManual: true` and auto-imported). Single source of truth.
- **Category summary:** Totals by category for the selected period
- **Receipt viewer:** Click to view uploaded receipt images/PDFs

### Reports (`/dashboard/finance/reports`)

Six report types, each with PDF and CSV export:
1. **Profit & Loss** — Revenue, expenses, net income by period
2. **Income by Client** — 1099-ready breakdown per client
3. **Tax Summary** — Annual income, categorized expenses, estimated quarterly tax
4. **Hours & Billing** — Hours worked, effective rate, billable vs non-billable
5. **Aging Report** — Outstanding invoices by age bucket
6. **Expense Report** — All expenses by category with receipt links

PDF reports generated server-side via `onGenerateReport` Cloud Function using pdf-lib. CSV exports generated client-side (data already loaded in browser).

### Accounts (`/dashboard/finance/accounts`)

- **Connected account list:** Provider, account name, mask, status, last sync, error banner if status is 'error'
- **Actions:** Connect new (Plaid Link / Stripe key input), disconnect, re-authenticate (Plaid update mode)
- **Sync controls:** Manual sync trigger (throttled to 1 per 15 min), sync status indicator

## TypeScript Interfaces

All new interfaces go in `web/src/lib/types.ts`. Include `ownerId: string` explicitly on all new types.

```typescript
type AccountProvider = 'plaid' | 'stripe';
type AccountStatus = 'active' | 'error' | 'disconnected';
type TransactionType = 'income' | 'expense' | 'transfer' | 'uncategorized';
type TransactionProvider = 'plaid' | 'stripe' | 'manual';
type MatchStatus = 'unmatched' | 'suggested' | 'confirmed' | 'rejected';

interface ConnectedAccount {
  id: string;
  ownerId: string;
  provider: AccountProvider;
  accountName: string;
  institutionName: string;
  accountMask: string;
  status: AccountStatus;
  errorMessage?: string;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Transaction {
  id: string;
  ownerId: string;
  accountId?: string;
  provider: TransactionProvider;
  externalId?: string;
  date: Date;
  amount: number;
  description: string;
  category: string;
  type: TransactionType;
  matchedWorkItemId?: string;
  matchConfidence?: number;
  matchStatus: MatchStatus;
  isManual: boolean;
  receiptUrl?: string;
  taxDeductible?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

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

Replace manual CSS bar charts with **Recharts** (already in `web/package.json`):
- `BarChart` for revenue vs expenses comparison
- `LineChart` for trend lines
- `ResponsiveContainer` for responsive sizing
- Composable components that accept WorkItem/Transaction arrays directly

## New Dependencies

### Web (`web/package.json`)
- `react-plaid-link` — Plaid Link React component (Phase 2)

### Functions (`functions/package.json`)
- `plaid` — Plaid Node.js client (Phase 2)
- `stripe` — Stripe Node.js SDK (Phase 2)

Note: `recharts` is already installed. Native `Date` methods and `Intl.DateTimeFormat` are used for date formatting (no `date-fns` dependency needed — consistent with existing codebase patterns).

## Migration Path

- Analytics page (`/dashboard/analytics`) redirects to `/dashboard/finance`
- Analytics route component is replaced by FinanceOverview
- Existing Analytics chart logic (revenue calculations, by-client, by-type) is preserved and enhanced
- No data migration needed — Phase 1 reads from existing WorkItem data
- Sidebar component refactored to support expandable nav groups (children array + toggle)

## Testing Strategy

- Unit tests for financial calculations (revenue aggregation, aging buckets, matching algorithm scoring)
- Integration tests for Plaid/Stripe Cloud Functions (using Plaid Sandbox + Stripe test keys)
- E2E tests for invoice management workflow and report generation
- Manual testing for Plaid Link flow (requires Plaid Sandbox credentials)
- Plaid environment config: use `PLAID_ENV=sandbox` for dev/test, `production` for live
