import { describe, it, expect } from 'vitest';
import { isInvoice, isWorkOrder } from './workItem';
import type { WorkItem } from './types';

function make(partial: Partial<WorkItem>): WorkItem {
  return {
    id: 'wi-1',
    title: 'Test',
    status: 'draft',
    type: 'changeRequest',
    clientId: 'c-1',
    lineItems: [],
    totalCost: 0,
    isBillable: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  } as WorkItem;
}

describe('isInvoice / isWorkOrder', () => {
  it('treats an item with no invoice fields as a work order', () => {
    const item = make({});
    expect(isInvoice(item)).toBe(false);
    expect(isWorkOrder(item)).toBe(true);
  });

  it('treats invoiceStatus "draft" (not yet sent) as a work order', () => {
    const item = make({ invoiceStatus: 'draft' });
    expect(isInvoice(item)).toBe(false);
    expect(isWorkOrder(item)).toBe(true);
  });

  it('treats a set invoiceSentDate as an invoice', () => {
    const item = make({ invoiceSentDate: new Date('2026-02-01') });
    expect(isInvoice(item)).toBe(true);
    expect(isWorkOrder(item)).toBe(false);
  });

  it.each(['sent', 'paid', 'overdue'] as const)(
    'treats invoiceStatus "%s" as an invoice even without invoiceSentDate',
    (status) => {
      const item = make({ invoiceStatus: status });
      expect(isInvoice(item)).toBe(true);
      expect(isWorkOrder(item)).toBe(false);
    },
  );

  it('is mutually exclusive — an item is exactly one of the two', () => {
    const sent = make({ invoiceStatus: 'paid' });
    const notSent = make({ invoiceStatus: 'draft' });
    expect(isInvoice(sent)).toBe(!isWorkOrder(sent));
    expect(isInvoice(notSent)).toBe(!isWorkOrder(notSent));
  });
});
