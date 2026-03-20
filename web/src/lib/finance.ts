import type { WorkItem, Client, WorkItemType } from './types';

// ── Exported Types ──────────────────────────────────────────────────────────

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
  month: string;   // e.g. "Jan 2026"
  year: number;
  monthIndex: number;
  revenue: number;
}

export interface ClientRevenue {
  clientId: string;
  clientName: string;
  revenue: number;
  count: number;
}

export interface TypeRevenue {
  type: WorkItemType;
  revenue: number;
  count: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the start month of the quarter containing the given month (0-indexed). */
function quarterStartMonth(month: number): number {
  return Math.floor(month / 3) * 3;
}

/** Returns true if date is within [start, end] inclusive (compares by date value). */
function inRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** Difference in whole days between two dates (a - b), ignoring time. */
function diffDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const aDay = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((aDay - bDay) / msPerDay);
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Returns a date range for a given preset relative to `ref` (defaults to now).
 * - mtd: from the 1st of the current month to ref
 * - qtd: from the 1st of the current quarter to ref
 * - ytd: from Jan 1 of the current year to ref
 * - custom: returns { start: ref, end: ref } as a no-op placeholder
 */
export function getDateRange(preset: DateRangePreset, ref: Date = new Date()): DateRange {
  const year = ref.getFullYear();
  const month = ref.getMonth();

  switch (preset) {
    case 'mtd':
      return {
        start: new Date(Date.UTC(year, month, 1)),
        end: ref,
      };
    case 'qtd':
      return {
        start: new Date(Date.UTC(year, quarterStartMonth(month), 1)),
        end: ref,
      };
    case 'ytd':
      return {
        start: new Date(Date.UTC(year, 0, 1)),
        end: ref,
      };
    case 'custom':
      return { start: ref, end: ref };
  }
}

/**
 * Sums totalCost of billable work items whose invoiceStatus is 'paid'
 * and whose invoicePaidDate falls within range.
 */
export function calculateRevenue(items: readonly WorkItem[], range: DateRange): number {
  return items.reduce((sum, item) => {
    if (
      item.isBillable &&
      item.invoiceStatus === 'paid' &&
      item.invoicePaidDate &&
      inRange(item.invoicePaidDate, range)
    ) {
      return sum + item.totalCost;
    }
    return sum;
  }, 0);
}

/**
 * Sums totalCost of billable work items with invoiceStatus === 'sent'.
 * These are sent but not yet overdue or paid — i.e. awaiting payment.
 */
export function calculateOutstanding(items: readonly WorkItem[]): number {
  return items.reduce((sum, item) => {
    if (item.isBillable && item.invoiceStatus === 'sent') {
      return sum + item.totalCost;
    }
    return sum;
  }, 0);
}

/**
 * Sums totalCost of billable work items with invoiceStatus === 'overdue'.
 */
export function calculateOverdue(items: readonly WorkItem[]): number {
  return items.reduce((sum, item) => {
    if (item.isBillable && item.invoiceStatus === 'overdue') {
      return sum + item.totalCost;
    }
    return sum;
  }, 0);
}

/**
 * Categorizes unpaid invoices (sent or overdue) into aging buckets based on
 * days past their invoiceDueDate relative to `now`.
 *
 * - current:    due date is in the future (not yet past due)
 * - days1to30:  1–30 days past due
 * - days31to60: 31–60 days past due
 * - days60plus: 61+ days past due
 */
export function getAgingBuckets(items: readonly WorkItem[], now: Date = new Date()): AgingBuckets {
  const buckets: AgingBuckets = { current: 0, days1to30: 0, days31to60: 0, days60plus: 0 };

  for (const item of items) {
    if (!item.isBillable) continue;
    if (item.invoiceStatus !== 'sent' && item.invoiceStatus !== 'overdue') continue;

    if (!item.invoiceDueDate) {
      // No due date — treat as current
      buckets.current += item.totalCost;
      continue;
    }

    const daysPastDue = diffDays(now, item.invoiceDueDate);

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

/**
 * Returns an array of monthly revenue totals for the last `months` months
 * ending at `ref` (defaults to now). Array is ordered oldest → newest.
 */
export function getMonthlyRevenue(
  items: readonly WorkItem[],
  months: number = 6,
  ref: Date = new Date(),
): MonthlyRevenue[] {
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Build month buckets oldest→newest
  const buckets: MonthlyRevenue[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    buckets.push({
      month: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      revenue: 0,
    });
  }

  for (const item of items) {
    if (!item.isBillable || item.invoiceStatus !== 'paid' || !item.invoicePaidDate) continue;
    const paidYear = item.invoicePaidDate.getFullYear();
    const paidMonth = item.invoicePaidDate.getMonth();
    const bucket = buckets.find(b => b.year === paidYear && b.monthIndex === paidMonth);
    if (bucket) {
      bucket.revenue += item.totalCost;
    }
  }

  return buckets;
}

/**
 * Returns revenue totals per client, sorted descending by revenue.
 * Uses the `clients` array to resolve clientId → name.
 */
export function getRevenueByClient(
  items: readonly WorkItem[],
  clients: readonly Client[],
  range: DateRange,
): ClientRevenue[] {
  const map = new Map<string, ClientRevenue>();

  for (const item of items) {
    if (
      !item.isBillable ||
      item.invoiceStatus !== 'paid' ||
      !item.invoicePaidDate ||
      !inRange(item.invoicePaidDate, range)
    ) {
      continue;
    }

    const existing = map.get(item.clientId);
    if (existing) {
      map.set(item.clientId, {
        ...existing,
        revenue: existing.revenue + item.totalCost,
        count: existing.count + 1,
      });
    } else {
      const client = clients.find(c => c.id === item.clientId);
      map.set(item.clientId, {
        clientId: item.clientId,
        clientName: client?.name ?? item.clientId,
        revenue: item.totalCost,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/**
 * Returns revenue totals per WorkItemType, sorted descending by revenue.
 */
export function getRevenueByType(items: readonly WorkItem[], range: DateRange): TypeRevenue[] {
  const map = new Map<WorkItemType, TypeRevenue>();

  for (const item of items) {
    if (
      !item.isBillable ||
      item.invoiceStatus !== 'paid' ||
      !item.invoicePaidDate ||
      !inRange(item.invoicePaidDate, range)
    ) {
      continue;
    }

    const existing = map.get(item.type);
    if (existing) {
      map.set(item.type, {
        ...existing,
        revenue: existing.revenue + item.totalCost,
        count: existing.count + 1,
      });
    } else {
      map.set(item.type, {
        type: item.type,
        revenue: item.totalCost,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/**
 * Filters billable work items by optional invoiceStatus.
 * If no status is provided, returns all billable items.
 */
export function getInvoicesByStatus(
  items: readonly WorkItem[],
  status?: WorkItem['invoiceStatus'],
): WorkItem[] {
  if (status === undefined) {
    return items.filter(item => item.isBillable);
  }
  return items.filter(item => item.isBillable && item.invoiceStatus === status);
}

/**
 * Returns counts of billable work items by invoiceStatus.
 * Items with no invoiceStatus are counted as 'draft'.
 * `all` is the total count of billable items.
 */
export function getInvoiceStatusCounts(items: readonly WorkItem[]): Record<string, number> {
  const counts: Record<string, number> = { all: 0, draft: 0, sent: 0, paid: 0, overdue: 0 };

  for (const item of items) {
    if (!item.isBillable) continue;
    counts.all += 1;
    const status = item.invoiceStatus ?? 'draft';
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return counts;
}

/**
 * Calculates the percentage change from `previous` to `current`.
 * Returns 100 if previous is 0 and current > 0.
 * Returns 0 if both are 0.
 */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}
