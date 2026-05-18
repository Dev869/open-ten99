import type { WorkItem } from './types';

/**
 * Domain rule: a WorkItem that has been SENT OUT is an INVOICE, not a work
 * order. "Sent out" means `invoiceSentDate` is set, OR `invoiceStatus` is one
 * of 'sent' | 'paid' | 'overdue' (those statuses imply it was sent).
 *
 * Single source of truth — every work-order-facing list and every
 * invoice-facing list must derive membership from this pair so the two never
 * overlap.
 */
export function isInvoice(item: WorkItem): boolean {
  return (
    Boolean(item.invoiceSentDate) ||
    item.invoiceStatus === 'sent' ||
    item.invoiceStatus === 'paid' ||
    item.invoiceStatus === 'overdue'
  );
}

/** A WorkItem that has NOT been sent out is a work order. */
export function isWorkOrder(item: WorkItem): boolean {
  return !isInvoice(item);
}
