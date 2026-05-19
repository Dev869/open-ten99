import type { WorkItem } from './types';

/**
 * Domain rule: a WorkItem is an INVOICE (not a work order) when any of:
 *  - `invoicedAt` is set — it was explicitly created as / converted to an
 *    invoice (independent of whether it has been emailed yet), OR
 *  - `invoiceSentDate` is set, OR
 *  - `invoiceStatus` is one of 'sent' | 'paid' | 'overdue' (those statuses
 *    imply it was sent).
 *
 * `invoicedAt` is backward compatible: legacy invoices that were only ever
 * "sent" still classify correctly via the sent-date / status checks.
 *
 * Single source of truth — every work-order-facing list and every
 * invoice-facing list must derive membership from this pair so the two never
 * overlap.
 */
export function isInvoice(item: WorkItem): boolean {
  return (
    Boolean(item.invoicedAt) ||
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
