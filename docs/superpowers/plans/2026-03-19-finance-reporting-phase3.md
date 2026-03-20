# Finance Reporting Module — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add smart invoice-to-payment reconciliation, manual expense entry with receipt uploads, auto-categorization of transactions, and enhanced P&L/tax reports that include expense data.

**Architecture:** A Firestore trigger (`onTransactionCreated`) runs the matching algorithm server-side when new transactions are synced. The Expenses page writes manual expenses as `transactions` documents with `isManual: true` and `type: 'expense'`. Receipts upload to Firebase Storage under `receipts/{userId}/`. The existing P&L and Tax Summary PDF reports are enhanced to include expense totals. The Transactions page gets match suggestion UI (confirm/reject inline).

**Tech Stack:** Firebase Cloud Functions (Firestore trigger), Firebase Storage, React 19, TypeScript, Tailwind CSS 4, pdf-lib

**Spec:** `docs/superpowers/specs/2026-03-19-finance-reporting-design.md` (Phase 3 section + Matching Algorithm + Expenses page)

**Prerequisites:** Phases 1-2 complete. `transactions` collection, `ConnectedAccount`/`Transaction` types, `fetchTransactions`, `updateTransactionCategory`, storage rules for `receipts/` all exist.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `functions/src/matchTransaction.ts` | `onTransactionCreated` Firestore trigger + matching algorithm |
| `functions/src/utils/matching.ts` | Pure scoring functions (amount, date, name match) |
| `functions/src/utils/matching.test.ts` | Unit tests for scoring functions |
| `web/src/routes/contractor/Expenses.tsx` | Expenses page — manual entry form + expense list |
| `web/src/components/finance/ExpenseForm.tsx` | Manual expense entry form with receipt upload |
| `web/src/components/finance/MatchSuggestion.tsx` | Inline match suggestion card (confirm/reject) |

### Modified Files
| File | Changes |
|------|---------|
| `functions/src/index.ts` | Export `onTransactionCreated` |
| `web/src/services/firestore.ts` | Add `createManualExpense`, `confirmMatch`, `rejectMatch` functions |
| `web/src/components/finance/TransactionRow.tsx` | Add match suggestion indicator |
| `web/src/routes/contractor/Transactions.tsx` | Add match suggestion UI with confirm/reject |
| `web/src/lib/generateReportPdf.ts` | Enhance P&L and Tax Summary with expense data |
| `web/src/routes/contractor/Reports.tsx` | Update P&L and Expense CSV exports to include transaction expenses |
| `web/src/components/Sidebar.tsx` | Add Expenses nav item to finance group |
| `web/src/App.tsx` | Add Expenses route |

---

### Task 0: Matching Algorithm Utilities (TDD)

**Files:**
- Create: `functions/src/utils/matching.ts`
- Create: `functions/src/utils/matching.test.ts`

- [ ] **Step 1: Write tests for scoring functions**

Create `functions/src/utils/matching.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { scoreAmount, scoreDate, scoreName, computeMatchScore } from './matching';

describe('scoreAmount', () => {
  it('returns 1.0 for exact match', () => {
    expect(scoreAmount(1500, 1500)).toBe(1.0);
  });
  it('returns 0.8 for within 2%', () => {
    expect(scoreAmount(1500, 1520)).toBe(0.8);
  });
  it('returns 0.5 for within 5%', () => {
    expect(scoreAmount(1500, 1560)).toBe(0.5);
  });
  it('returns 0 for >5% difference', () => {
    expect(scoreAmount(1500, 1700)).toBe(0);
  });
  it('handles negative amounts (absolute comparison)', () => {
    expect(scoreAmount(1500, -1500)).toBe(1.0);
  });
});

describe('scoreDate', () => {
  it('returns 1.0 for same day', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-03-15'))).toBe(1.0);
  });
  it('returns 0.8 for within 3 days', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-03-17'))).toBe(0.8);
  });
  it('returns 0.5 for within 7 days', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-03-21'))).toBe(0.5);
  });
  it('returns 0.2 for within 14 days', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-03-28'))).toBe(0.2);
  });
  it('returns 0 for >14 days', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-04-15'))).toBe(0);
  });
});

describe('scoreName', () => {
  it('returns 1.0 for exact substring match', () => {
    expect(scoreName('ACH DEPOSIT ACME CORP', 'Acme Corp')).toBe(1.0);
  });
  it('returns 0.7 for high similarity', () => {
    const score = scoreName('ACME CORPORATION', 'Acme Corp');
    expect(score).toBeGreaterThanOrEqual(0.7);
  });
  it('returns 0 for no match', () => {
    expect(scoreName('WALMART GROCERY', 'Acme Corp')).toBe(0);
  });
});

describe('computeMatchScore', () => {
  it('returns >0.7 for strong match', () => {
    const score = computeMatchScore(
      { amount: 2400, date: new Date('2026-03-15'), description: 'ACH DEPOSIT ACME CORP' },
      { totalCost: 2400, invoiceSentDate: new Date('2026-03-10'), clientName: 'Acme Corp' }
    );
    expect(score).toBeGreaterThan(0.7);
  });
  it('returns <0.7 for weak match', () => {
    const score = computeMatchScore(
      { amount: 500, date: new Date('2026-03-15'), description: 'WALMART' },
      { totalCost: 2400, invoiceSentDate: new Date('2026-01-01'), clientName: 'Acme Corp' }
    );
    expect(score).toBeLessThan(0.7);
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/functions && npx vitest run src/utils/matching.test.ts`

- [ ] **Step 3: Implement scoring functions**

Create `functions/src/utils/matching.ts`:

```typescript
/** Score how closely a transaction amount matches an invoice amount. */
export function scoreAmount(transactionAmount: number, invoiceAmount: number): number {
  const txAbs = Math.abs(transactionAmount);
  const invAbs = Math.abs(invoiceAmount);
  if (invAbs === 0) return txAbs === 0 ? 1.0 : 0;
  const diff = Math.abs(txAbs - invAbs) / invAbs;
  if (diff === 0) return 1.0;
  if (diff <= 0.02) return 0.8;
  if (diff <= 0.05) return 0.5;
  return 0;
}

/** Score how close two dates are. */
export function scoreDate(transactionDate: Date, invoiceDate: Date): number {
  const days = Math.abs(
    Math.floor((transactionDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  if (days === 0) return 1.0;
  if (days <= 3) return 0.8;
  if (days <= 7) return 0.5;
  if (days <= 14) return 0.2;
  return 0;
}

/** Score how well a transaction description matches a client name. */
export function scoreName(description: string, clientName: string): number {
  const descLower = description.toLowerCase();
  const nameLower = clientName.toLowerCase();

  // Exact substring match
  if (descLower.includes(nameLower)) return 1.0;

  // Simple similarity: longest common subsequence ratio
  const lcs = longestCommonSubsequence(descLower, nameLower);
  const similarity = (2 * lcs) / (descLower.length + nameLower.length);
  if (similarity > 0.8) return 0.7;
  return 0;
}

function longestCommonSubsequence(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

interface TransactionInput {
  amount: number;
  date: Date;
  description: string;
}

interface InvoiceInput {
  totalCost: number;
  invoiceSentDate: Date;
  clientName: string;
}

/** Compute weighted match score (0-1). Threshold is 0.7 for suggestion. */
export function computeMatchScore(tx: TransactionInput, invoice: InvoiceInput): number {
  const amountScore = scoreAmount(tx.amount, invoice.totalCost);
  const dateScore = scoreDate(tx.date, invoice.invoiceSentDate);
  const nameScore = scoreName(tx.description, invoice.clientName);
  return amountScore * 0.5 + dateScore * 0.3 + nameScore * 0.2;
}
```

- [ ] **Step 4: Run tests — verify ALL PASS**
- [ ] **Step 5: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add functions/src/utils/matching.ts functions/src/utils/matching.test.ts && git commit -m "feat(finance): add transaction matching scoring algorithm with tests"
```

---

### Task 1: onTransactionCreated Cloud Function

**Files:**
- Create: `functions/src/matchTransaction.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create the Firestore trigger**

Create `functions/src/matchTransaction.ts`:

- Uses `onDocumentCreated` from `firebase-functions/v2/firestore`
- Triggered on `transactions/{docId}`
- Only processes income transactions (`type === 'income'`)
- Loads all unpaid work items (`invoiceStatus` in `['sent', 'overdue']`) for the same `ownerId`
- Also loads clients for that owner to resolve `clientId` → `name`
- For each unpaid work item, calls `computeMatchScore`
- Takes the best match — if score > 0.7, updates the transaction with `matchStatus: 'suggested'`, `matchConfidence: score`, `matchedWorkItemId: bestMatch.id`
- If no match > 0.7, leaves `matchStatus: 'unmatched'`
- Never auto-confirms

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { computeMatchScore } from './utils/matching';
import * as logger from 'firebase-functions/logger';
```

- [ ] **Step 2: Export from index.ts**

Add: `export { onTransactionCreated } from './matchTransaction';`

- [ ] **Step 3: Build**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/functions && npm run build`

- [ ] **Step 4: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add functions/src/matchTransaction.ts functions/src/index.ts && git commit -m "feat(finance): add onTransactionCreated trigger for smart invoice matching"
```

---

### Task 2: Firestore Service — Manual Expenses & Match Actions

**Files:**
- Modify: `web/src/services/firestore.ts`

- [ ] **Step 1: Add createManualExpense function**

```typescript
export async function createManualExpense(data: {
  description: string;
  amount: number;
  category: string;
  date: Date;
  taxDeductible: boolean;
  receiptUrl?: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const docRef = await addDoc(collection(db, 'transactions'), {
    ownerId: user.uid,
    provider: 'manual',
    externalId: null,
    date: Timestamp.fromDate(data.date),
    amount: -Math.abs(data.amount), // Expenses are negative
    description: data.description,
    category: data.category,
    type: 'expense',
    matchStatus: 'unmatched',
    isManual: true,
    taxDeductible: data.taxDeductible,
    receiptUrl: data.receiptUrl ?? null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}
```

- [ ] **Step 2: Add confirmMatch and rejectMatch functions**

```typescript
export async function confirmMatch(transactionId: string, workItemId: string): Promise<void> {
  await updateDoc(doc(db, 'transactions', transactionId), {
    matchStatus: 'confirmed',
    matchedWorkItemId: workItemId,
    updatedAt: Timestamp.now(),
  });
  // Also mark the work item as paid
  await updateInvoiceStatus(workItemId, {
    invoiceStatus: 'paid',
    invoicePaidDate: new Date(),
  });
}

export async function rejectMatch(transactionId: string): Promise<void> {
  await updateDoc(doc(db, 'transactions', transactionId), {
    matchStatus: 'rejected',
    matchedWorkItemId: null,
    matchConfidence: null,
    updatedAt: Timestamp.now(),
  });
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/services/firestore.ts && git commit -m "feat(finance): add createManualExpense, confirmMatch, rejectMatch service functions"
```

---

### Task 3: Match Suggestion UI on Transactions Page

**Files:**
- Create: `web/src/components/finance/MatchSuggestion.tsx`
- Modify: `web/src/components/finance/TransactionRow.tsx`
- Modify: `web/src/routes/contractor/Transactions.tsx`

- [ ] **Step 1: Create MatchSuggestion component**

An inline card shown below a transaction row when `matchStatus === 'suggested'`:

Props:
```typescript
interface MatchSuggestionProps {
  transaction: Transaction;
  workItemSubject: string;
  workItemAmount: number;
  confidence: number;
  onConfirm: (transactionId: string, workItemId: string) => void;
  onReject: (transactionId: string) => void;
}
```

Shows: "Matches: {workItemSubject} ({formatCurrency(workItemAmount)}) — {confidence}% confidence" with Confirm (green) and Reject (gray) buttons.

- [ ] **Step 2: Update TransactionRow to show match indicator**

Add a small badge/icon on transactions with `matchStatus === 'suggested'` or `matchStatus === 'confirmed'`:
- `suggested`: pulsing dot or "Match found" badge
- `confirmed`: checkmark with linked work item subject

- [ ] **Step 3: Update Transactions page to handle match actions**

The Transactions page needs:
- Pass `workItems` prop (add to route in App.tsx) OR fetch work items within the component
- When a suggested match row is expanded/clicked, show `MatchSuggestion`
- Wire `confirmMatch` and `rejectMatch` from firestore service
- Optimistically update local transaction state after confirm/reject

Since Transactions doesn't currently receive `workItems` props, the simplest approach is to pass them via the route. Update `App.tsx`:
```typescript
<Route path="finance/transactions" element={<Transactions workItems={workItems} />} />
```
And update `Transactions.tsx` to accept `workItems?: WorkItem[]` as an optional prop for resolving match suggestions.

- [ ] **Step 4: Verify build and commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/components/finance/MatchSuggestion.tsx web/src/components/finance/TransactionRow.tsx web/src/routes/contractor/Transactions.tsx web/src/App.tsx && git commit -m "feat(finance): add match suggestion UI with confirm/reject on Transactions page"
```

---

### Task 4: Expense Entry Form & Receipt Upload

**Files:**
- Create: `web/src/components/finance/ExpenseForm.tsx`

- [ ] **Step 1: Create ExpenseForm component**

A form for manually entering expenses:

Props:
```typescript
interface ExpenseFormProps {
  onSubmit: (expense: {
    description: string;
    amount: number;
    category: string;
    date: Date;
    taxDeductible: boolean;
    receiptUrl?: string;
  }) => Promise<void>;
  loading?: boolean;
}
```

Fields:
- Description (text input, required)
- Amount (number input, required, positive — the service negates it)
- Category (dropdown of `EXPENSE_CATEGORIES` from types.ts)
- Date (date input, defaults to today)
- Tax Deductible (checkbox toggle)
- Receipt (file input, accept `image/*,.pdf`, max 10MB)
  - On file select, upload to Firebase Storage at `receipts/{userId}/{timestamp}-{filename}`
  - Use `getStorage` and `ref`, `uploadBytes`, `getDownloadURL` from `firebase/storage`
  - Show upload progress or spinner
  - Store the download URL as `receiptUrl`
- Submit button

Style with Tailwind + CSS vars, matching existing form patterns in the app.

- [ ] **Step 2: Verify build and commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/components/finance/ExpenseForm.tsx && git commit -m "feat(finance): add ExpenseForm component with receipt upload"
```

---

### Task 5: Expenses Page

**Files:**
- Create: `web/src/routes/contractor/Expenses.tsx`

- [ ] **Step 1: Create Expenses page**

Default export (lazy-loaded). Does NOT receive props — uses its own data fetching.

Features:
1. **ExpenseForm** at the top for manual entry
   - `onSubmit` calls `createManualExpense` from firestore service
   - Show toast on success
2. **Category summary** — totals by category for the current period
   - Fetch all expenses via `fetchTransactions({ type: 'expense' })`
   - Group by `category`, sum `amount` (absolute values)
   - Render as a simple table or card grid
3. **Expense list** — all transactions where `type === 'expense'`
   - Reuse `TransactionRow` component or a simpler expense-specific row
   - Show receipt link/thumbnail if `receiptUrl` exists
   - Click receipt to open in new tab
4. **Date range filter** — `DateRangeSelector` at top to scope the list and category totals

State management:
- Fetch expenses on mount and when date range changes (reuse `fetchTransactions` with `type: 'expense'`)
- Use same cancelled-flag pattern as Transactions page for cleanup

- [ ] **Step 2: Verify build and commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/routes/contractor/Expenses.tsx && git commit -m "feat(finance): add Expenses page with manual entry, category summary, and receipt viewer"
```

---

### Task 6: Route & Sidebar Wiring for Expenses

**Files:**
- Modify: `web/src/components/Sidebar.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add Expenses nav item to sidebar**

In the finance group children (in `Sidebar.tsx`), add Expenses between Transactions and Reports:

```typescript
{ to: '/dashboard/finance/expenses', key: 'finance-expenses', label: 'Expenses', Icon: IconDollar },
```

Use an appropriate icon from the existing icon library. Read Icons.tsx to pick one — `IconDollar` or similar.

- [ ] **Step 2: Add Expenses route to App.tsx**

Add lazy import:
```typescript
const Expenses = lazy(() => import('./routes/contractor/Expenses'));
```

Add route:
```typescript
<Route path="finance/expenses" element={<Expenses />} />
```

- [ ] **Step 3: Verify build and commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/components/Sidebar.tsx web/src/App.tsx && git commit -m "feat(finance): add Expenses route to sidebar and router"
```

---

### Task 7: Enhanced P&L and Tax Reports with Expenses

**Files:**
- Modify: `web/src/lib/generateReportPdf.ts`
- Modify: `web/src/routes/contractor/Reports.tsx`

- [ ] **Step 1: Update P&L PDF to include expenses**

In `generateReportPdf.ts`, modify `buildProfitLoss` to:
- Accept a `transactions: Transaction[]` parameter
- Calculate total expenses from transactions where `type === 'expense'` in each month
- Show a three-column table: Month | Revenue | Expenses | Net
- Add a Net Income total row at the bottom

- [ ] **Step 2: Update Tax Summary PDF to include categorized expenses**

Modify `buildTaxSummary` to:
- Accept `transactions: Transaction[]`
- Add an "Expenses by Category" section below the income table
- Group expense transactions by `category`, sum amounts
- Show category, amount, and tax line (from EXPENSE_CATEGORIES mapping)
- Add a "Net Income" summary: Total Income - Total Expenses

- [ ] **Step 3: Update Expense Report PDF (replace Phase 3 placeholder)**

Replace the "Coming in Phase 3" placeholder in the `expense` case:
- Build a proper expense report grouped by category
- Show each expense: date, description, amount, category
- Include receipt URLs as text references
- Total by category and grand total

- [ ] **Step 4: Update Reports.tsx to pass transactions**

The Reports page needs transaction data for the enhanced P&L and expense reports:
- Fetch expenses using `fetchTransactions({ type: 'expense' })` on mount
- Pass `transactions` to `generateReportPdf` and `generateCombinedReportPdf`
- Update the CSV exports for P&L and expenses to include transaction data

- [ ] **Step 5: Update generateReportPdf and generateCombinedReportPdf signatures**

Both functions need an optional `transactions?: Transaction[]` parameter:
```typescript
export async function generateReportPdf(
  reportType: ReportType,
  workItems: WorkItem[],
  clients: Client[],
  range: DateRange,
  transactions?: Transaction[]
): Promise<void>
```

- [ ] **Step 6: Verify build and commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/lib/generateReportPdf.ts web/src/routes/contractor/Reports.tsx && git commit -m "feat(finance): enhance P&L, Tax Summary, and Expense reports with transaction expense data"
```

---

### Task 8: Integration Testing & Polish

**Files:**
- All Phase 3 files

- [ ] **Step 1: Run all tests**

```bash
cd /Users/devinwilson/Projects/personal/openchanges/web && npx vitest run
cd /Users/devinwilson/Projects/personal/openchanges/functions && npx vitest run src/utils/matching.test.ts
```

- [ ] **Step 2: Build web and functions**

```bash
cd /Users/devinwilson/Projects/personal/openchanges/web && npm run build
cd /Users/devinwilson/Projects/personal/openchanges/functions && npm run build
```

- [ ] **Step 3: Verify all Phase 3 files exist**

- `functions/src/utils/matching.ts` + `matching.test.ts`
- `functions/src/matchTransaction.ts`
- `web/src/components/finance/ExpenseForm.tsx`
- `web/src/components/finance/MatchSuggestion.tsx`
- `web/src/routes/contractor/Expenses.tsx`

- [ ] **Step 4: Fix any issues, commit specific files**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add <specific-files> && git commit -m "fix(finance): Phase 3 integration polish"
```
