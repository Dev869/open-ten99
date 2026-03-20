# Finance Reporting Module — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Analytics page with a comprehensive Finance module featuring invoice management, revenue reports, aging analysis, and tax-ready CSV/PDF exports — all from existing WorkItem data with no new integrations.

**Architecture:** Finance module lives under `/dashboard/finance/*` with expandable sidebar navigation. Phase 1 uses only existing Firestore data (WorkItems, Clients). Financial calculations are pure utility functions in a dedicated `finance.ts` module, making them easily testable. Recharts (already installed) replaces manual CSS bar charts. PDF reports generated server-side via Cloud Function using pdf-lib.

**Tech Stack:** React 19, TypeScript, Recharts, Tailwind CSS 4, Firebase Cloud Functions, pdf-lib

**Spec:** `docs/superpowers/specs/2026-03-19-finance-reporting-design.md`

**Scope:** Phase 1 only (Reports & Invoicing). Phases 2 (Bank/Payment Integration) and 3 (Reconciliation & Expenses) will be separate plans.

**Phase 1 routes:**
- `/dashboard/finance` — Finance Overview (replaces Analytics)
- `/dashboard/finance/invoices` — Invoice Management
- `/dashboard/finance/reports` — Report Generation & Export

**Deferred to Phase 2-3:**
- `/dashboard/finance/transactions` — Bank/Stripe ledger
- `/dashboard/finance/expenses` — Manual expense entry
- `/dashboard/finance/accounts` — Connected accounts management

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `web/vitest.config.ts` | Vitest test runner configuration |
| `web/src/lib/finance.ts` | Pure financial calculation functions (revenue, aging, filtering, date ranges) |
| `web/src/lib/finance.test.ts` | Unit tests for financial calculations |
| `web/src/routes/contractor/FinanceOverview.tsx` | Finance Overview page (replaces Analytics) |
| `web/src/routes/contractor/Invoices.tsx` | Invoice management page (table, filtering, bulk actions) |
| `web/src/routes/contractor/Reports.tsx` | Report selection & generation page |
| `web/src/components/finance/DateRangeSelector.tsx` | MTD/QTD/YTD/Custom date range toggle |
| `web/src/components/finance/KpiCard.tsx` | KPI stat card with trend indicator |
| `web/src/components/finance/AgingSummary.tsx` | Aging bucket summary bar |
| `web/src/components/finance/InvoiceTable.tsx` | Invoice table with checkbox selection |
| `web/src/components/finance/RevenueChart.tsx` | Recharts bar chart for revenue vs expenses |
| `web/src/components/finance/TopClients.tsx` | Client revenue breakdown bars |
| `web/src/components/finance/ActivityFeed.tsx` | Recent invoice activity feed |
| `functions/src/generateReport.ts` | Cloud Function for PDF report generation |

### Modified Files
| File | Changes |
|------|---------|
| `web/src/lib/types.ts` | Add finance-related type aliases and invoice status labels |
| `web/src/lib/utils.ts` | No changes — reuse existing formatCurrency, formatDate, exportToCsv |
| `web/src/components/Sidebar.tsx` | Add expandable nav group support, replace Analytics with Finance |
| `web/src/App.tsx` | Add finance route definitions, remove Analytics route |
| `functions/src/index.ts` | Export generateReport function |

---

### Task 0: Install Vitest Test Runner

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `cd web && npm install -D vitest`

- [ ] **Step 2: Create vitest config**

Create `web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `web/package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

Run: `cd web && npx vitest run`
Expected: "No test files found" (no tests yet, but vitest runs)

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/vitest.config.ts web/package-lock.json
git commit -m "chore: add vitest test runner"
```

---

### Task 1: Finance Types & Constants

**Files:**
- Modify: `web/src/lib/types.ts` (after `WORK_ITEM_STATUS_LABELS`, around line 240)

- [ ] **Step 1: Add invoice status labels to types.ts**

Add after the existing `WORK_ITEM_STATUS_LABELS` constant (around line 240).

**Important:** Do NOT add Phase 2-3 types (`ConnectedAccount`, `Transaction`, etc.) yet — those will be added when needed. Only add what Phase 1 uses.

```typescript
// Invoice status
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

// Expense categories (Schedule C aligned)
export const EXPENSE_CATEGORIES = [
  'Software & Subscriptions',
  'Equipment & Tools',
  'Office Supplies',
  'Travel',
  'Meals & Entertainment',
  'Vehicle & Fuel',
  'Insurance',
  'Professional Services',
  'Advertising & Marketing',
  'Utilities & Telecom',
  'Subcontractors',
  'Materials & Supplies',
  'Education & Training',
  'Uncategorized',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/types.ts
git commit -m "feat(finance): add finance types, invoice status labels, and expense categories"
```

---

### Task 2: Financial Calculation Utilities (TDD)

**Files:**
- Create: `web/src/lib/finance.ts`
- Create: `web/src/lib/finance.test.ts`

- [ ] **Step 1: Set up test file with first failing test — getDateRange**

Create `web/src/lib/finance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getDateRange,
  calculateRevenue,
  calculateOutstanding,
  calculateOverdue,
  getAgingBuckets,
  getMonthlyRevenue,
  getRevenueByClient,
  getRevenueByType,
} from './finance';
import type { WorkItem, Client } from './types';

// Helper to create a minimal WorkItem for testing.
// Note: WorkItem has `subject` (not `title`) and no `clientName` field.
// Client name resolution is done via a separate `clients` array lookup.
function makeWorkItem(overrides: Partial<WorkItem>): WorkItem {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    subject: 'Test Work Item',
    clientId: 'client-1',
    type: 'maintenance',
    status: 'completed',
    sourceEmail: '',
    lineItems: [],
    totalHours: 0,
    totalCost: 0,
    isBillable: true,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  } as WorkItem;
}

// Helper to create a minimal Client for testing
function makeClient(overrides: Partial<Client>): Client {
  return {
    id: 'client-1',
    name: 'Test Client',
    email: 'test@example.com',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Client;
}

describe('getDateRange', () => {
  it('returns MTD range', () => {
    const ref = new Date('2026-03-15');
    const { start, end } = getDateRange('mtd', ref);
    expect(start).toEqual(new Date('2026-03-01'));
    expect(end.getTime()).toBeGreaterThanOrEqual(ref.getTime());
  });

  it('returns QTD range', () => {
    const ref = new Date('2026-05-15');
    const { start, end } = getDateRange('qtd', ref);
    expect(start).toEqual(new Date('2026-04-01'));
  });

  it('returns YTD range', () => {
    const ref = new Date('2026-03-15');
    const { start, end } = getDateRange('ytd', ref);
    expect(start).toEqual(new Date('2026-01-01'));
  });
});

describe('calculateRevenue', () => {
  it('sums totalCost of billable paid work items in range', () => {
    const items = [
      makeWorkItem({ totalCost: 1000, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-05'), isBillable: true }),
      makeWorkItem({ totalCost: 500, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-10'), isBillable: true }),
      makeWorkItem({ totalCost: 200, invoiceStatus: 'sent', isBillable: true }), // not paid
      makeWorkItem({ totalCost: 300, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-02-15'), isBillable: true }), // out of range
    ];
    const range = { start: new Date('2026-03-01'), end: new Date('2026-03-31') };
    expect(calculateRevenue(items, range)).toBe(1500);
  });

  it('excludes non-billable items', () => {
    const items = [
      makeWorkItem({ totalCost: 1000, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-05'), isBillable: false }),
    ];
    const range = { start: new Date('2026-03-01'), end: new Date('2026-03-31') };
    expect(calculateRevenue(items, range)).toBe(0);
  });
});

describe('calculateOutstanding', () => {
  it('sums totalCost of sent (not overdue) invoices', () => {
    const items = [
      makeWorkItem({ totalCost: 800, invoiceStatus: 'sent', isBillable: true }),
      makeWorkItem({ totalCost: 400, invoiceStatus: 'sent', isBillable: true }),
      makeWorkItem({ totalCost: 200, invoiceStatus: 'paid', isBillable: true }),
    ];
    expect(calculateOutstanding(items)).toBe(1200);
  });
});

describe('calculateOverdue', () => {
  it('sums totalCost of overdue invoices', () => {
    const items = [
      makeWorkItem({ totalCost: 500, invoiceStatus: 'overdue', isBillable: true }),
      makeWorkItem({ totalCost: 300, invoiceStatus: 'overdue', isBillable: true }),
      makeWorkItem({ totalCost: 1000, invoiceStatus: 'sent', isBillable: true }),
    ];
    expect(calculateOverdue(items)).toBe(800);
  });
});

describe('getAgingBuckets', () => {
  it('categorizes unpaid invoices by days past due date', () => {
    const now = new Date('2026-03-19');
    const items = [
      // Due Apr 14 — not yet due → current
      makeWorkItem({ totalCost: 100, invoiceStatus: 'sent', invoiceSentDate: new Date('2026-03-15'), invoiceDueDate: new Date('2026-04-14'), isBillable: true }),
      // Due Mar 12 — 7 days overdue → 1-30
      makeWorkItem({ totalCost: 200, invoiceStatus: 'sent', invoiceSentDate: new Date('2026-02-10'), invoiceDueDate: new Date('2026-03-12'), isBillable: true }),
      // Due Feb 15 — 32 days overdue → 31-60
      makeWorkItem({ totalCost: 300, invoiceStatus: 'overdue', invoiceSentDate: new Date('2026-01-16'), invoiceDueDate: new Date('2026-02-15'), isBillable: true }),
      // Due Jan 10 — 68 days overdue → 60+
      makeWorkItem({ totalCost: 400, invoiceStatus: 'overdue', invoiceSentDate: new Date('2025-12-11'), invoiceDueDate: new Date('2026-01-10'), isBillable: true }),
    ];
    const buckets = getAgingBuckets(items, now);
    expect(buckets.current).toBe(100);
    expect(buckets.days1to30).toBe(200);
    expect(buckets.days31to60).toBe(300);
    expect(buckets.days60plus).toBe(400);
  });
});

describe('getMonthlyRevenue', () => {
  it('returns revenue by month for the last N months', () => {
    const items = [
      makeWorkItem({ totalCost: 1000, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-05'), isBillable: true }),
      makeWorkItem({ totalCost: 800, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-02-10'), isBillable: true }),
      makeWorkItem({ totalCost: 600, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-01-20'), isBillable: true }),
    ];
    const result = getMonthlyRevenue(items, 3, new Date('2026-03-19'));
    expect(result).toHaveLength(3);
    expect(result[2].revenue).toBe(1000); // March
    expect(result[1].revenue).toBe(800);  // February
    expect(result[0].revenue).toBe(600);  // January
  });
});

describe('getRevenueByClient', () => {
  it('returns top clients by revenue', () => {
    const clients = [
      makeClient({ id: 'c1', name: 'Acme' }),
      makeClient({ id: 'c2', name: 'TechCo' }),
    ];
    const items = [
      makeWorkItem({ totalCost: 1000, clientId: 'c1', invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-05'), isBillable: true }),
      makeWorkItem({ totalCost: 500, clientId: 'c1', invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-10'), isBillable: true }),
      makeWorkItem({ totalCost: 800, clientId: 'c2', invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-08'), isBillable: true }),
    ];
    const range = { start: new Date('2026-03-01'), end: new Date('2026-03-31') };
    const result = getRevenueByClient(items, clients, range);
    expect(result[0].clientName).toBe('Acme');
    expect(result[0].revenue).toBe(1500);
    expect(result[1].clientName).toBe('TechCo');
    expect(result[1].revenue).toBe(800);
  });
});

describe('getRevenueByType', () => {
  it('returns revenue grouped by work item type', () => {
    const items = [
      makeWorkItem({ totalCost: 1000, type: 'maintenance', invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-05'), isBillable: true }),
      makeWorkItem({ totalCost: 500, type: 'changeRequest', invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-10'), isBillable: true }),
      makeWorkItem({ totalCost: 300, type: 'maintenance', invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-12'), isBillable: true }),
    ];
    const range = { start: new Date('2026-03-01'), end: new Date('2026-03-31') };
    const result = getRevenueByType(items, range);
    const maintenance = result.find(r => r.type === 'maintenance');
    expect(maintenance?.revenue).toBe(1300);
    expect(maintenance?.count).toBe(2);
  });
});
```

Add these additional test cases after the `getRevenueByType` describe block:

```typescript
describe('getInvoiceStatusCounts', () => {
  it('counts invoices by status', () => {
    const items = [
      makeWorkItem({ isBillable: true, invoiceStatus: 'sent' }),
      makeWorkItem({ isBillable: true, invoiceStatus: 'sent' }),
      makeWorkItem({ isBillable: true, invoiceStatus: 'paid' }),
      makeWorkItem({ isBillable: true }),  // no invoiceStatus → draft
      makeWorkItem({ isBillable: false }), // non-billable — excluded
    ];
    const counts = getInvoiceStatusCounts(items);
    expect(counts.all).toBe(4);
    expect(counts.draft).toBe(1);
    expect(counts.sent).toBe(2);
    expect(counts.paid).toBe(1);
  });
});

describe('calculateTrend', () => {
  it('calculates positive trend', () => {
    expect(calculateTrend(1200, 1000)).toBe(20);
  });
  it('calculates negative trend', () => {
    expect(calculateTrend(800, 1000)).toBe(-20);
  });
  it('handles zero previous', () => {
    expect(calculateTrend(500, 0)).toBe(100);
    expect(calculateTrend(0, 0)).toBe(0);
  });
});
```

Also add `getInvoiceStatusCounts` and `calculateTrend` to the imports at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/lib/finance.test.ts`
Expected: FAIL — module './finance' not found

- [ ] **Step 3: Implement finance.ts with all calculation functions**

Create `web/src/lib/finance.ts`:

```typescript
import type { WorkItem, WorkItemType, Client } from './types';

export type DateRangePreset = 'mtd' | 'qtd' | 'ytd' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days60plus: number;
}

export interface MonthlyRevenue {
  month: string;    // "Jan 2026"
  revenue: number;
  monthStart: Date;
}

export interface ClientRevenue {
  clientId: string;
  clientName: string;
  revenue: number;
  count: number;
  hours: number;
}

export interface TypeRevenue {
  type: WorkItemType;
  revenue: number;
  count: number;
  hours: number;
}

/** Returns start/end dates for a preset range relative to a reference date. */
export function getDateRange(preset: DateRangePreset, ref: Date = new Date()): DateRange {
  const end = new Date(ref);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'mtd': {
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      return { start, end };
    }
    case 'qtd': {
      const quarterStart = Math.floor(ref.getMonth() / 3) * 3;
      const start = new Date(ref.getFullYear(), quarterStart, 1);
      return { start, end };
    }
    case 'ytd': {
      const start = new Date(ref.getFullYear(), 0, 1);
      return { start, end };
    }
    case 'custom':
      return { start: ref, end };
  }
}

/** Filter billable items with paid invoices in the given date range. */
function paidInRange(items: readonly WorkItem[], range: DateRange): readonly WorkItem[] {
  return items.filter(
    (item) =>
      item.isBillable &&
      item.invoiceStatus === 'paid' &&
      item.invoicePaidDate != null &&
      item.invoicePaidDate >= range.start &&
      item.invoicePaidDate <= range.end
  );
}

/** Sum of totalCost for billable, paid items within the date range. */
export function calculateRevenue(items: readonly WorkItem[], range: DateRange): number {
  return paidInRange(items, range).reduce((sum, item) => sum + item.totalCost, 0);
}

/** Sum of totalCost for billable items with invoiceStatus 'sent'. */
export function calculateOutstanding(items: readonly WorkItem[]): number {
  return items
    .filter((item) => item.isBillable && item.invoiceStatus === 'sent')
    .reduce((sum, item) => sum + item.totalCost, 0);
}

/** Sum of totalCost for billable items with invoiceStatus 'overdue'. */
export function calculateOverdue(items: readonly WorkItem[]): number {
  return items
    .filter((item) => item.isBillable && item.invoiceStatus === 'overdue')
    .reduce((sum, item) => sum + item.totalCost, 0);
}

/** Categorize unpaid billable invoices into aging buckets by days past due date.
 *  "Current" = not yet past due. 1-30/31-60/60+ = days past the due date. */
export function getAgingBuckets(items: readonly WorkItem[], now: Date = new Date()): AgingBuckets {
  const buckets: AgingBuckets = { current: 0, days1to30: 0, days31to60: 0, days60plus: 0 };

  const unpaid = items.filter(
    (item) =>
      item.isBillable &&
      (item.invoiceStatus === 'sent' || item.invoiceStatus === 'overdue') &&
      item.invoiceDueDate != null
  );

  for (const item of unpaid) {
    const daysPastDue = Math.floor(
      (now.getTime() - item.invoiceDueDate!.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysPastDue <= 0) {
      buckets.current += item.totalCost;
    } else if (daysPastDue <= 30) {
      buckets.days1to30 += item.totalCost;
    } else if (daysPastDue <= 60) {
      buckets.days31to60 += item.totalCost;
    } else {
      buckets.days60plus += item.totalCost;
    }
  }

  return buckets;
}

/** Returns revenue per month for the last `months` months. */
export function getMonthlyRevenue(
  items: readonly WorkItem[],
  months: number = 6,
  ref: Date = new Date()
): MonthlyRevenue[] {
  const result: MonthlyRevenue[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const monthEnd = new Date(ref.getFullYear(), ref.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const label = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const revenue = calculateRevenue(items, { start: monthStart, end: monthEnd });
    result.push({ month: label, revenue, monthStart });
  }

  return result;
}

/** Returns revenue grouped by client, sorted descending.
 *  Requires clients array for clientId→name lookup (WorkItem has no clientName field). */
export function getRevenueByClient(
  items: readonly WorkItem[],
  clients: readonly Client[],
  range: DateRange
): ClientRevenue[] {
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));
  const paid = paidInRange(items, range);
  const map = new Map<string, ClientRevenue>();

  for (const item of paid) {
    const existing = map.get(item.clientId) ?? {
      clientId: item.clientId,
      clientName: clientNames.get(item.clientId) ?? 'Unknown',
      revenue: 0,
      count: 0,
      hours: 0,
    };
    existing.revenue += item.totalCost;
    existing.count += 1;
    existing.hours += item.totalHours;
    map.set(item.clientId, existing);
  }

  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

/** Returns revenue grouped by work item type. */
export function getRevenueByType(
  items: readonly WorkItem[],
  range: DateRange
): TypeRevenue[] {
  const paid = paidInRange(items, range);
  const map = new Map<WorkItemType, TypeRevenue>();

  for (const item of paid) {
    const existing = map.get(item.type) ?? {
      type: item.type,
      revenue: 0,
      count: 0,
      hours: 0,
    };
    existing.revenue += item.totalCost;
    existing.count += 1;
    existing.hours += item.totalHours;
    map.set(item.type, existing);
  }

  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

/** Get billable items filtered by invoice status. */
export function getInvoicesByStatus(
  items: readonly WorkItem[],
  status?: 'draft' | 'sent' | 'paid' | 'overdue'
): readonly WorkItem[] {
  const billable = items.filter((item) => item.isBillable);
  if (!status) return billable;
  return billable.filter((item) => item.invoiceStatus === status);
}

/** Count invoices by status. */
export function getInvoiceStatusCounts(
  items: readonly WorkItem[]
): Record<string, number> {
  const billable = items.filter((item) => item.isBillable);
  return {
    all: billable.length,
    draft: billable.filter((i) => !i.invoiceStatus || i.invoiceStatus === 'draft').length,
    sent: billable.filter((i) => i.invoiceStatus === 'sent').length,
    paid: billable.filter((i) => i.invoiceStatus === 'paid').length,
    overdue: billable.filter((i) => i.invoiceStatus === 'overdue').length,
  };
}

/** Calculate trend percentage comparing current period to previous period. */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/lib/finance.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/finance.ts web/src/lib/finance.test.ts
git commit -m "feat(finance): add financial calculation utilities with full test coverage"
```

---

### Task 3: Sidebar Expandable Nav Groups

**Files:**
- Modify: `web/src/components/Sidebar.tsx:14-30` (NavItem interface + default items)

- [ ] **Step 1: Extend NavItem interface to support children**

In `Sidebar.tsx`, modify the `NavItem` interface (line 14) to:

```typescript
interface NavItem {
  to: string;
  key: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
  children?: NavItem[];
}
```

- [ ] **Step 2: Replace Analytics nav item with Finance group**

In the default nav items array (around line 21-30), replace the `analytics` entry with:

```typescript
{
  to: '/dashboard/finance',
  key: 'finance',
  label: 'Finance',
  Icon: AnalyticsIcon,  // reuse existing analytics icon
  children: [
    { to: '/dashboard/finance', key: 'finance-overview', label: 'Overview', Icon: DashboardIcon },
    { to: '/dashboard/finance/invoices', key: 'finance-invoices', label: 'Invoices', Icon: InvoiceIcon },
    { to: '/dashboard/finance/reports', key: 'finance-reports', label: 'Reports', Icon: ReportIcon },
  ],
},
```

Use appropriate icons from the existing icon library (`web/src/components/icons/Icons.tsx`). If suitable icons don't exist, use the closest match.

- [ ] **Step 3: Add expand/collapse rendering logic**

Add `useLocation` import from `react-router-dom` at the top of `Sidebar.tsx`:

```typescript
import { NavLink, useLocation } from 'react-router-dom';
```

In the component body, add state and logic for expandable groups:

```typescript
const location = useLocation();

// Track which nav groups are expanded
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
  // Auto-expand group if current route matches a child
  const expanded = new Set<string>();
  for (const item of navItems) {
    if (item.children?.some(child => location.pathname.startsWith(child.to))) {
      expanded.add(item.key);
    }
  }
  return expanded;
});

const toggleGroup = (key: string) => {
  setExpandedGroups(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
};
```

In the nav item rendering loop, modify to handle items with `children`:
- If `item.children` exists: render a `<button>` (not `NavLink`) as group header with a chevron indicator. On click, call `toggleGroup(item.key)`. Below it, conditionally render children when expanded.
- If no children: render as existing `NavLink` (current behavior unchanged)
- Children render with additional left padding (`pl-10` vs parent `pl-4`)
- When sidebar is **collapsed** (icon-only mode): hide children entirely, only show parent icon. Clicking the parent icon navigates to the first child route.
- When sidebar is **expanded**: show full expand/collapse behavior with chevron.
- Auto-expand when navigating to a child route (check `location.pathname` in a `useEffect`).

- [ ] **Step 4: Update sidebar customization logic**

The `sidebarOrder` and `sidebarHidden` arrays in AppSettings use the `key` field. Updates needed:

1. Finance group uses `key: 'finance'` — the entire group (with children) is one reorderable/hideable unit in CustomizePanel. Children are NOT individually hideable.
2. In the `resolveVisibleNavItems` logic, map `'analytics'` → `'finance'` for users who have `analytics` in their saved `sidebarOrder` array. This prevents the Finance item from disappearing for existing users.
3. In `CustomizePanel`, items with `children` should show the parent label only (e.g., "Finance") — not expand to list sub-items. The panel treats nav groups as atomic units.

- [ ] **Step 5: Verify sidebar renders correctly**

Run: `cd web && npm run dev`
Manually verify:
- Finance group appears in sidebar where Analytics was
- Clicking Finance expands to show Overview, Invoices, Reports
- Clicking again collapses the group
- Navigating to `/dashboard/finance` auto-expands the group
- Other nav items unaffected

- [ ] **Step 6: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "feat(finance): add expandable nav groups to sidebar, replace Analytics with Finance"
```

---

### Task 4: Finance Shared Components

**Files:**
- Create: `web/src/components/finance/DateRangeSelector.tsx`
- Create: `web/src/components/finance/KpiCard.tsx`
- Create: `web/src/components/finance/AgingSummary.tsx`

- [ ] **Step 1: Create DateRangeSelector component**

Create `web/src/components/finance/DateRangeSelector.tsx`:

```typescript
import type { DateRangePreset } from '../../lib/finance';

interface DateRangeSelectorProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
}

// Custom date range deferred — requires date picker UI (Phase 2)
const presets: { value: DateRangePreset; label: string }[] = [
  { value: 'mtd', label: 'MTD' },
  { value: 'qtd', label: 'QTD' },
  { value: 'ytd', label: 'YTD' },
];

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {presets.map((preset) => (
        <button
          key={preset.value}
          onClick={() => onChange(preset.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === preset.value
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create KpiCard component**

Create `web/src/components/finance/KpiCard.tsx`:

```typescript
import { formatCurrency } from '../../lib/utils';

interface KpiCardProps {
  label: string;
  value: number;
  trend?: number;        // percentage change
  subtitle?: string;     // e.g. "4 unpaid invoices"
  color: 'green' | 'orange' | 'red' | 'accent';
}

const colorMap = {
  green: { bg: 'rgba(90, 154, 90, 0.1)', border: 'rgba(90, 154, 90, 0.25)', text: '#5A9A5A' },
  orange: { bg: 'rgba(212, 135, 62, 0.1)', border: 'rgba(212, 135, 62, 0.25)', text: '#D4873E' },
  red: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', text: '#ef4444' },
  accent: { bg: 'rgba(75, 168, 168, 0.1)', border: 'rgba(75, 168, 168, 0.25)', text: 'var(--accent)' },
};

export function KpiCard({ label, value, trend, subtitle, color }: KpiCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1" style={{ color: colors.text }}>
        {formatCurrency(value)}
      </div>
      {trend != null && (
        <div className="text-xs mt-0.5" style={{ color: trend >= 0 ? '#5A9A5A' : '#ef4444' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </div>
      )}
      {subtitle && (
        <div className="text-xs mt-0.5 text-[var(--text-secondary)]">{subtitle}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create AgingSummary component**

Create `web/src/components/finance/AgingSummary.tsx`:

```typescript
import { formatCurrency } from '../../lib/utils';
import type { AgingBuckets } from '../../lib/finance';

interface AgingSummaryProps {
  buckets: AgingBuckets;
}

export function AgingSummary({ buckets }: AgingSummaryProps) {
  return (
    <div className="flex items-center gap-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm">
      <span className="text-xs uppercase text-[var(--text-secondary)] tracking-wide">Aging:</span>
      <span><span className="text-[#5A9A5A]">Current:</span> {formatCurrency(buckets.current)}</span>
      <span><span className="text-[#D4873E]">1-30 days:</span> {formatCurrency(buckets.days1to30)}</span>
      <span><span className="text-[#ef4444]">31-60 days:</span> {formatCurrency(buckets.days31to60)}</span>
      <span><span className="text-[#ef4444]">60+ days:</span> {formatCurrency(buckets.days60plus)}</span>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/src/components/finance/
git commit -m "feat(finance): add DateRangeSelector, KpiCard, and AgingSummary components"
```

---

### Task 5: Finance Overview Page

**Files:**
- Create: `web/src/routes/contractor/FinanceOverview.tsx`
- Create: `web/src/components/finance/RevenueChart.tsx`
- Create: `web/src/components/finance/TopClients.tsx`
- Create: `web/src/components/finance/ActivityFeed.tsx`

- [ ] **Step 1: Create RevenueChart with Recharts**

Create `web/src/components/finance/RevenueChart.tsx`:

```typescript
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { MonthlyRevenue } from '../../lib/finance';

interface RevenueChartProps {
  data: MonthlyRevenue[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-4">Revenue (Last 6 Months)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create TopClients component**

Create `web/src/components/finance/TopClients.tsx`:

```typescript
import { formatCurrency } from '../../lib/utils';
import type { ClientRevenue } from '../../lib/finance';

interface TopClientsProps {
  clients: ClientRevenue[];
  maxClients?: number;
}

const barColors = ['var(--accent)', '#6366f1', '#D4873E', '#5A9A5A', '#888'];

export function TopClients({ clients, maxClients = 5 }: TopClientsProps) {
  const top = clients.slice(0, maxClients);
  const maxRevenue = top[0]?.revenue ?? 1;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-4">Top Clients</h3>
      <div className="space-y-3">
        {top.map((client, i) => (
          <div key={client.clientId}>
            <div className="flex justify-between text-xs mb-1">
              <span>{client.clientName}</span>
              <span style={{ color: barColors[i] ?? '#888' }}>
                {formatCurrency(client.revenue)}
              </span>
            </div>
            <div className="h-1 bg-[var(--border)] rounded-full">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(client.revenue / maxRevenue) * 100}%`,
                  background: barColors[i] ?? '#888',
                }}
              />
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)]">No revenue data yet</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ActivityFeed component**

Create `web/src/components/finance/ActivityFeed.tsx`:

```typescript
import { formatCurrency, formatDate } from '../../lib/utils';
import type { WorkItem, Client } from '../../lib/types';

interface ActivityFeedProps {
  workItems: readonly WorkItem[];
  clients: readonly Client[];
  maxItems?: number;
}

interface ActivityItem {
  label: string;
  amount: number;
  date: Date;
  color: string;
  type: 'payment' | 'sent' | 'overdue';
}

export function ActivityFeed({ workItems, clients, maxItems = 10 }: ActivityFeedProps) {
  // Build clientId→name lookup (WorkItem has no clientName field)
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));
  const getClientName = (id: string) => clientNames.get(id) ?? 'Unknown';

  // Build activity items from invoice events
  const activities: ActivityItem[] = [];

  for (const item of workItems) {
    if (!item.isBillable) continue;

    if (item.invoiceStatus === 'paid' && item.invoicePaidDate) {
      activities.push({
        label: `Payment received — ${getClientName(item.clientId)}`,
        amount: item.totalCost,
        date: item.invoicePaidDate,
        color: '#5A9A5A',
        type: 'payment',
      });
    }
    if (item.invoiceSentDate && item.invoiceStatus !== 'draft') {
      activities.push({
        label: `Invoice sent — ${getClientName(item.clientId)}`,
        amount: item.totalCost,
        date: item.invoiceSentDate,
        color: '#D4873E',
        type: 'sent',
      });
    }
    if (item.invoiceStatus === 'overdue') {
      activities.push({
        label: `Invoice overdue — ${getClientName(item.clientId)}`,
        amount: item.totalCost,
        date: item.invoiceDueDate ?? item.updatedAt,
        color: '#ef4444',
        type: 'overdue',
      });
    }
  }

  // Sort by date descending, take top N
  const sorted = activities
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, maxItems);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
      <div className="divide-y divide-[var(--border)]">
        {sorted.map((activity, i) => (
          <div key={i} className="flex justify-between items-center py-2 text-xs">
            <div>
              <span style={{ color: activity.color }}>●</span>{' '}
              {activity.label}
            </div>
            <div className="flex gap-4">
              <span style={{ color: activity.type === 'payment' ? '#5A9A5A' : activity.type === 'overdue' ? '#ef4444' : 'var(--text-secondary)' }}>
                {activity.type === 'payment' ? '+' : ''}{formatCurrency(activity.amount)}
              </span>
              <span className="text-[var(--text-secondary)]">{formatDate(activity.date)}</span>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)] py-2">No activity yet</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create FinanceOverview page**

Create `web/src/routes/contractor/FinanceOverview.tsx`:

```typescript
import { useState, useMemo } from 'react';
import type { WorkItem, Client } from '../../lib/types';
import {
  getDateRange,
  calculateRevenue,
  calculateOutstanding,
  calculateOverdue,
  calculateTrend,
  getMonthlyRevenue,
  getRevenueByClient,
} from '../../lib/finance';
import type { DateRangePreset } from '../../lib/finance';
import { DateRangeSelector } from '../../components/finance/DateRangeSelector';
import { KpiCard } from '../../components/finance/KpiCard';
import { RevenueChart } from '../../components/finance/RevenueChart';
import { TopClients } from '../../components/finance/TopClients';
import { ActivityFeed } from '../../components/finance/ActivityFeed';

interface FinanceOverviewProps {
  workItems: WorkItem[];
  clients: Client[];
}

export default function FinanceOverview({ workItems, clients }: FinanceOverviewProps) {
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('mtd');

  // Memoize "now" so it doesn't change on every render
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => getDateRange(rangePreset, now), [rangePreset, now]);

  // Previous period for trend calculation
  const prevRange = useMemo(() => {
    const duration = range.end.getTime() - range.start.getTime();
    const prevEnd = new Date(range.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start: prevStart, end: prevEnd };
  }, [range]);

  const revenue = useMemo(() => calculateRevenue(workItems, range), [workItems, range]);
  const prevRevenue = useMemo(() => calculateRevenue(workItems, prevRange), [workItems, prevRange]);
  const trend = calculateTrend(revenue, prevRevenue);
  const outstanding = useMemo(() => calculateOutstanding(workItems), [workItems]);
  const overdue = useMemo(() => calculateOverdue(workItems), [workItems]);

  const monthlyData = useMemo(() => getMonthlyRevenue(workItems, 6, now), [workItems]);
  const clientData = useMemo(() => getRevenueByClient(workItems, clients, range), [workItems, clients, range]);

  const overdueCount = workItems.filter(
    (i) => i.isBillable && i.invoiceStatus === 'overdue'
  ).length;
  const outstandingCount = workItems.filter(
    (i) => i.isBillable && i.invoiceStatus === 'sent'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Finance</h1>
        <DateRangeSelector value={rangePreset} onChange={setRangePreset} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Revenue" value={revenue} trend={trend} color="green" />
        <KpiCard
          label="Outstanding"
          value={outstanding}
          subtitle={`${outstandingCount} unpaid invoice${outstandingCount !== 1 ? 's' : ''}`}
          color="orange"
        />
        <KpiCard
          label="Overdue"
          value={overdue}
          subtitle={overdueCount > 0 ? `${overdueCount} invoice${overdueCount !== 1 ? 's' : ''}` : undefined}
          color="red"
        />
        <KpiCard label="Billed (Period)" value={revenue + outstanding + overdue} color="accent" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={monthlyData} />
        </div>
        <TopClients clients={clientData} />
      </div>

      {/* Activity feed */}
      <ActivityFeed workItems={workItems} clients={clients} />
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/contractor/FinanceOverview.tsx web/src/components/finance/
git commit -m "feat(finance): add Finance Overview page with KPIs, revenue chart, top clients, and activity feed"
```

---

### Task 6: Invoice Management Page

**Files:**
- Create: `web/src/routes/contractor/Invoices.tsx`
- Create: `web/src/components/finance/InvoiceTable.tsx`

- [ ] **Step 1: Create InvoiceTable component**

Create `web/src/components/finance/InvoiceTable.tsx`:

A table component that:
- Accepts `workItems: WorkItem[]` (filtered to billable)
- Renders columns: checkbox, Work Order/Client, Amount, Sent date, Due date, Status badge
- Tracks selected items via `Set<string>` state
- Exposes `selectedIds` to parent via callback
- Status badges use existing color scheme: draft=#86868B, sent=#D4873E, paid=#5A9A5A, overdue=#ef4444
- Rows are clickable to navigate to work item detail

- [ ] **Step 2: Create Invoices page**

Create `web/src/routes/contractor/Invoices.tsx`:

The page should:
- Accept `workItems: WorkItem[]` and `clients: Client[]` as props
- Use `getInvoicesByStatus()` and `getInvoiceStatusCounts()` from `finance.ts`
- Render status filter tabs (All, Draft, Sent, Overdue, Paid) with counts
- Render `AgingSummary` component with `getAgingBuckets()` data
- Render `InvoiceTable` with filtered items
- Implement bulk actions: "Mark as Sent", "Mark as Paid" using `updateInvoiceStatus()` from `firestore.ts`
- Implement CSV export using existing `exportToCsv()` from `utils.ts`
- CSV columns: Work Order, Client, Amount, Hours, Sent Date, Due Date, Status

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/contractor/Invoices.tsx web/src/components/finance/InvoiceTable.tsx
git commit -m "feat(finance): add Invoice Management page with filtering, aging, bulk actions, and CSV export"
```

---

### Task 7: Reports Page & PDF Generation

**Files:**
- Create: `web/src/routes/contractor/Reports.tsx`
- Create: `functions/src/generateReport.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create Reports page**

Create `web/src/routes/contractor/Reports.tsx`:

The page should:
- Display 6 report type cards in a responsive grid (as designed in the spec mockup)
- Each card shows: icon, title, description, available formats (PDF, CSV)
- Clicking CSV triggers client-side generation via `exportToCsv()`
- Clicking PDF calls the `onGenerateReport` Cloud Function and opens the returned URL
- Date range selector at the top to scope report data
- Reports use `workItems` prop data for calculations

Report types to implement:
1. **P&L** — Revenue minus expenses by period (Phase 1: revenue only, expenses added in Phase 3)
2. **Income by Client** — Client name, total paid, work order count, per the date range
3. **Tax Summary** — Annual totals, categorized (Phase 1: income only)
4. **Hours & Billing** — Total hours, billable hours, effective hourly rate, by type
5. **Aging Report** — Aging buckets detail with individual invoice rows
6. **Expense Report** — Placeholder for Phase 3

- [ ] **Step 2: Create generateReport Cloud Function**

Create `functions/src/generateReport.ts`:

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface ReportRequest {
  reportType: 'pnl' | 'incomeByClient' | 'taxSummary' | 'hoursBilling' | 'aging' | 'expenses';
  startDate: string; // ISO string
  endDate: string;   // ISO string
}

export const onGenerateReport = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  const { reportType, startDate, endDate } = request.data as ReportRequest;
  const uid = request.auth.uid;

  // Fetch work items for this user
  const db = getFirestore();
  const snapshot = await db
    .collection('workItems')
    .where('ownerId', '==', uid)
    .get();

  const workItems = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Generate PDF based on report type
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]); // Letter size

  // Header
  page.drawText('OpenChanges', { x: 50, y: 742, font: boldFont, size: 18 });
  page.drawText(`${getReportTitle(reportType)} — ${startDate} to ${endDate}`, {
    x: 50, y: 720, font, size: 11, color: rgb(0.4, 0.4, 0.4),
  });

  // Report-specific content rendered based on reportType
  // Each report type populates the PDF with appropriate tables and summaries
  // Implementation details vary by report type

  const pdfBytes = await pdfDoc.save();

  // Upload to Storage with deterministic path
  const bucket = getStorage().bucket();
  const filePath = `reports/${uid}/${reportType}-${startDate}-${endDate}.pdf`;
  const file = bucket.file(filePath);

  await file.save(Buffer.from(pdfBytes), {
    metadata: { contentType: 'application/pdf' },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return { url: signedUrl };
});

function getReportTitle(type: string): string {
  const titles: Record<string, string> = {
    pnl: 'Profit & Loss Statement',
    incomeByClient: 'Income by Client',
    taxSummary: 'Tax Summary',
    hoursBilling: 'Hours & Billing Report',
    aging: 'Aging Report',
    expenses: 'Expense Report',
  };
  return titles[type] ?? 'Report';
}
```

Note: The PDF content rendering for each report type should be fully implemented with proper table layout, row iteration over work items, and formatted totals. The skeleton above shows the structure — the implementing agent should flesh out each report type with appropriate data queries and PDF table rendering using pdf-lib's `drawText` and line-drawing methods, following the pattern in the existing `functions/src/generatePdf.ts`.

- [ ] **Step 3: Export the new function**

In `functions/src/index.ts`, add:

```typescript
export { onGenerateReport } from './generateReport';
```

- [ ] **Step 4: Build functions**

Run: `cd functions && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/contractor/Reports.tsx functions/src/generateReport.ts functions/src/index.ts
git commit -m "feat(finance): add Reports page with 6 report types and server-side PDF generation"
```

---

### Task 8: Route Setup & Migration

**Files:**
- Modify: `web/src/App.tsx:278-279` (route definitions)

- [ ] **Step 1: Add lazy imports for finance pages**

At the top of `App.tsx`, alongside existing lazy imports, add:

```typescript
const FinanceOverview = lazy(() => import('./routes/contractor/FinanceOverview'));
const Invoices = lazy(() => import('./routes/contractor/Invoices'));
const Reports = lazy(() => import('./routes/contractor/Reports'));
```

- [ ] **Step 2: Replace Analytics route with Finance routes**

Replace the existing Analytics route (line ~278-279):

```typescript
<Route
  path="analytics"
  element={<Analytics workItems={workItems} clients={clients} />}
/>
```

With:

```typescript
{/* Finance module (replaces Analytics) */}
<Route path="finance" element={<FinanceOverview workItems={workItems} clients={clients} />} />
<Route path="finance/invoices" element={<Invoices workItems={workItems} clients={clients} />} />
<Route path="finance/reports" element={<Reports workItems={workItems} clients={clients} />} />

{/* Redirect old analytics path */}
<Route path="analytics" element={<Navigate to="/dashboard/finance" replace />} />
```

Add `Navigate` to the react-router-dom import if not already present.

- [ ] **Step 3: Verify routing works**

Run: `cd web && npm run dev`
Manually verify:
- `/dashboard/finance` shows Finance Overview
- `/dashboard/finance/invoices` shows Invoice Management
- `/dashboard/finance/reports` shows Reports
- `/dashboard/analytics` redirects to `/dashboard/finance`
- All existing routes still work

- [ ] **Step 4: Build and verify**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat(finance): add finance routes, redirect analytics to finance"
```

---

### Task 9: Firestore Security Rules (Phase 2-3 prep)

**Files:**
- Modify: `firestore.rules`
- Modify: `storage.rules`

- [ ] **Step 1: Add finance collection rules to firestore.rules**

Add after the existing collection rules (before the closing `}`):

```javascript
// === Finance Module (Phase 2-3) ===

// connectedAccounts — client can read/write display metadata (no secrets)
match /connectedAccounts/{docId} {
  allow read: if isContractor()
    && resource.data.ownerId == request.auth.uid;
  allow create: if isContractor()
    && request.resource.data.ownerId == request.auth.uid;
  allow update: if isContractor()
    && resource.data.ownerId == request.auth.uid
    && request.resource.data.ownerId == request.auth.uid;
  allow delete: if isContractor()
    && resource.data.ownerId == request.auth.uid;
}

// _secrets — deny ALL client access, admin SDK only
match /_secrets/{document=**} {
  allow read, write: if false;
}

// transactions — standard ownerId pattern
match /transactions/{docId} {
  allow read: if isContractor()
    && resource.data.ownerId == request.auth.uid;
  allow create: if isContractor()
    && request.resource.data.ownerId == request.auth.uid;
  allow update: if isContractor()
    && resource.data.ownerId == request.auth.uid
    && request.resource.data.ownerId == request.auth.uid;
  allow delete: if isContractor()
    && resource.data.ownerId == request.auth.uid;
}
```

Note: Uses `isContractor()` helper (existing in rules file at line 17) for consistency with existing rules, per spec review suggestion S1.

- [ ] **Step 2: Add storage rules for receipts and reports**

Add to `storage.rules`:

```javascript
// Receipt uploads (Phase 3)
match /receipts/{userId}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId
    && request.resource.size < 10 * 1024 * 1024
    && request.resource.contentType.matches('image/.*|application/pdf');
}

// Generated reports (written by Cloud Functions only)
match /reports/{userId}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false;
}
```

- [ ] **Step 3: Commit**

```bash
git add firestore.rules storage.rules
git commit -m "feat(finance): add Firestore and Storage security rules for finance collections"
```

---

### Task 10: Integration Testing & Polish

**Files:**
- All finance files

- [ ] **Step 1: Run full test suite**

Run: `cd web && npx vitest run`
Expected: All tests pass, including finance.test.ts

- [ ] **Step 2: Run full build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `cd web && npm run lint`
Expected: No errors (warnings acceptable)

- [ ] **Step 4: Build functions**

Run: `cd functions && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Manual smoke test**

Run: `cd web && npm run dev`

Verify:
- [ ] Sidebar shows Finance with expandable sub-items
- [ ] Finance Overview shows KPI cards with real data
- [ ] Revenue chart renders with Recharts
- [ ] Top Clients shows correct rankings
- [ ] Activity feed shows recent invoice events
- [ ] Date range selector (MTD/QTD/YTD) updates all widgets
- [ ] Invoice Management shows filterable table
- [ ] Status tabs filter correctly with accurate counts
- [ ] Aging summary shows correct bucket totals
- [ ] Bulk actions (Mark Sent, Mark Paid) work
- [ ] CSV export downloads valid file
- [ ] Reports page shows all 6 report cards
- [ ] `/dashboard/analytics` redirects to `/dashboard/finance`

- [ ] **Step 6: Final commit if any polish needed**

```bash
git add -A
git commit -m "fix(finance): polish and integration fixes for Phase 1"
```

---

## Phase 2 & 3 (Separate Plans)

**Phase 2: Bank & Payment Integration** — will be planned after Phase 1 ships. Covers:
- Plaid Link integration (`react-plaid-link`)
- Stripe API connection
- Cloud Functions: `onPlaidLinkToken`, `onPlaidExchange`, `onPlaidSync`, `onPlaidWebhook`, `onStripeConnect`, `onStripeSync`, `onStripeWebhook`, `onManualSync`
- Server-side encryption (`functions/src/lib/crypto.ts`)
- Transactions page with cursor-based pagination
- Accounts page

**Phase 3: Reconciliation & Expenses** — will be planned after Phase 2 ships. Covers:
- Smart matching algorithm (`onTransactionCreated`)
- Expenses page (manual entry + auto-import)
- Receipt upload to Firebase Storage
- P&L with expenses
- Full tax summary with categorized deductions
