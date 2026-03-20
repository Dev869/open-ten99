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
  getInvoiceStatusCounts,
  calculateTrend,
} from './finance';
import type { WorkItem, Client } from './types';

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

function makeClient(overrides: Partial<Client>): Client {
  return {
    id: 'client-1',
    name: 'Test Client',
    email: 'test@example.com',
    createdAt: new Date('2026-01-01'),
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
    const { start } = getDateRange('qtd', ref);
    expect(start).toEqual(new Date('2026-04-01'));
  });
  it('returns YTD range', () => {
    const ref = new Date('2026-03-15');
    const { start } = getDateRange('ytd', ref);
    expect(start).toEqual(new Date('2026-01-01'));
  });
});

describe('calculateRevenue', () => {
  it('sums totalCost of billable paid work items in range', () => {
    const items = [
      makeWorkItem({ totalCost: 1000, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-05'), isBillable: true }),
      makeWorkItem({ totalCost: 500, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-03-10'), isBillable: true }),
      makeWorkItem({ totalCost: 200, invoiceStatus: 'sent', isBillable: true }),
      makeWorkItem({ totalCost: 300, invoiceStatus: 'paid', invoicePaidDate: new Date('2026-02-15'), isBillable: true }),
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
      makeWorkItem({ totalCost: 100, invoiceStatus: 'sent', invoiceSentDate: new Date('2026-03-15'), invoiceDueDate: new Date('2026-04-14'), isBillable: true }),
      makeWorkItem({ totalCost: 200, invoiceStatus: 'sent', invoiceSentDate: new Date('2026-02-10'), invoiceDueDate: new Date('2026-03-12'), isBillable: true }),
      makeWorkItem({ totalCost: 300, invoiceStatus: 'overdue', invoiceSentDate: new Date('2026-01-16'), invoiceDueDate: new Date('2026-02-15'), isBillable: true }),
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
    expect(result[2].revenue).toBe(1000);
    expect(result[1].revenue).toBe(800);
    expect(result[0].revenue).toBe(600);
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

describe('getInvoiceStatusCounts', () => {
  it('counts invoices by status', () => {
    const items = [
      makeWorkItem({ isBillable: true, invoiceStatus: 'sent' }),
      makeWorkItem({ isBillable: true, invoiceStatus: 'sent' }),
      makeWorkItem({ isBillable: true, invoiceStatus: 'paid' }),
      makeWorkItem({ isBillable: true }),
      makeWorkItem({ isBillable: false }),
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
