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

  it('treats a set invoicedAt as an invoice even when not yet sent', () => {
    const item = make({ invoicedAt: new Date('2026-02-01'), invoiceStatus: 'draft' });
    expect(isInvoice(item)).toBe(true);
    expect(isWorkOrder(item)).toBe(false);
  });

  it('treats invoicedAt as an invoice with no invoiceStatus at all', () => {
    const item = make({ invoicedAt: new Date('2026-03-01') });
    expect(isInvoice(item)).toBe(true);
    expect(isWorkOrder(item)).toBe(false);
  });

  it('remains a work order when invoicedAt is unset (backward compatible)', () => {
    const item = make({ invoiceStatus: 'draft' });
    expect(item.invoicedAt).toBeUndefined();
    expect(isInvoice(item)).toBe(false);
    expect(isWorkOrder(item)).toBe(true);
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

  it('convert-to-invoice effect: stamping invoicedAt flips a work order to an invoice', () => {
    const workOrder = make({ invoiceStatus: 'draft' });
    expect(isWorkOrder(workOrder)).toBe(true);

    // Mirrors convertToInvoice(): set invoicedAt, keep existing invoiceStatus.
    const converted = { ...workOrder, invoicedAt: new Date('2026-05-18') };
    expect(isInvoice(converted)).toBe(true);
    expect(isWorkOrder(converted)).toBe(false);
    // Original is untouched (immutability).
    expect(isWorkOrder(workOrder)).toBe(true);
  });
});
