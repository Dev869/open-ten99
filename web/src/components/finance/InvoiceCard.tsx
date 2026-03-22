import type { WorkItem, Client, AppSettings } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';

interface InvoiceCardProps {
  workItem: WorkItem;
  client: Client | undefined;
  settings: AppSettings;
  invoiceNumber?: number;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  sent: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Sent' },
  paid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' },
  overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Overdue' },
};

const FALLBACK_BADGE = { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' };

function computeTermsLabel(sentDate: Date | undefined, dueDate: Date | undefined): string {
  if (!sentDate || !dueDate) return '---';
  const diffMs = dueDate.getTime() - sentDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Due on Receipt';
  return `Net ${diffDays}`;
}

function computeRate(lineItem: { hours: number; cost: number }): number {
  if (lineItem.hours <= 0) return lineItem.cost;
  return lineItem.cost / lineItem.hours;
}

export function InvoiceCard({ workItem, client, settings, invoiceNumber }: InvoiceCardProps) {
  const status = workItem.invoiceStatus ?? 'draft';
  const badge = STATUS_BADGE[status] ?? FALLBACK_BADGE;
  const taxRate = settings.invoiceTaxRate;

  const invoiceDate = workItem.invoiceSentDate ?? workItem.createdAt;
  const dueDate = workItem.invoiceDueDate;
  const termsLabel = computeTermsLabel(workItem.invoiceSentDate, dueDate);

  const prefix = settings.invoicePrefix ?? 'INV-';
  const displayNumber = invoiceNumber != null
    ? `${prefix}${String(invoiceNumber).padStart(4, '0')}`
    : null;

  const subtotal = workItem.totalCost;
  const taxAmount = taxRate != null && taxRate > 0 ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + taxAmount;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 max-w-2xl mx-auto relative print:shadow-none print:rounded-none">
      {/* Status badge - top right */}
      <div className="absolute top-6 right-6 md:top-8 md:right-8">
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
      </div>

      {/* Company header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">
          {settings.companyName || 'Your Company'}
        </h2>
        {settings.invoiceFromAddress && (
          <p className="text-sm text-gray-500 whitespace-pre-line mt-1">
            {settings.invoiceFromAddress}
          </p>
        )}
      </div>

      {/* INVOICE title */}
      <h1 className="text-2xl font-bold tracking-wide text-[var(--accent)] mb-4">INVOICE</h1>

      <div className="border-t border-gray-200 mb-6" />

      {/* Bill To / Invoice meta */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
        {/* Bill To */}
        <div>
          <p className="text-[0.65rem] uppercase tracking-widest font-semibold text-gray-400 mb-1">
            Bill To
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {client?.name ?? 'Unknown Client'}
          </p>
          {client?.email && (
            <p className="text-sm text-gray-500">{client.email}</p>
          )}
          {client?.company && (
            <p className="text-sm text-gray-500">{client.company}</p>
          )}
        </div>

        {/* Invoice details */}
        <div className="sm:text-right">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:justify-items-end">
            {displayNumber && (
              <>
                <span className="text-[0.65rem] uppercase tracking-widest font-semibold text-gray-400 self-center">
                  Invoice
                </span>
                <span className="font-medium text-gray-900">{displayNumber}</span>
              </>
            )}
            <span className="text-[0.65rem] uppercase tracking-widest font-semibold text-gray-400 self-center">
              Date
            </span>
            <span className="font-medium text-gray-900">
              {formatDate(invoiceDate)}
            </span>
            <span className="text-[0.65rem] uppercase tracking-widest font-semibold text-gray-400 self-center">
              Terms
            </span>
            <span className="font-medium text-gray-900">{termsLabel}</span>
            {dueDate && (
              <>
                <span className="text-[0.65rem] uppercase tracking-widest font-semibold text-gray-400 self-center">
                  Due
                </span>
                <span className="font-medium text-gray-900">
                  {formatDate(dueDate)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Line items table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--accent)]/10">
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Description
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Qty
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Rate
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {workItem.lineItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400 italic">
                  No line items
                </td>
              </tr>
            ) : (
              workItem.lineItems.map((li, i) => {
                const rate = computeRate(li);
                return (
                  <tr
                    key={li.id ?? i}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="px-3 py-2.5 text-gray-900">
                      {li.description || '---'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 font-mono tabular-nums">
                      {li.hours > 0 ? li.hours.toFixed(1) : '1'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 font-mono tabular-nums">
                      {formatCurrency(rate)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-900 font-mono font-medium tabular-nums">
                      {formatCurrency(li.cost)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Totals section */}
      <div className="border-t border-dashed border-gray-300 pt-4 mb-6">
        <div className="flex flex-col items-end gap-1">
          {/* Subtotal row (shown when tax applies) */}
          {taxRate != null && taxRate > 0 && (
            <>
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono tabular-nums text-gray-900">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span className="text-gray-500">Tax ({taxRate}%)</span>
                <span className="font-mono tabular-nums text-gray-900">
                  {formatCurrency(taxAmount)}
                </span>
              </div>
            </>
          )}

          {/* Balance due */}
          <div className="flex justify-between w-full max-w-xs mt-2 pt-2 border-t border-gray-200">
            <span className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Balance Due
            </span>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer note */}
      {settings.invoiceNotes && (
        <p className="text-sm text-gray-500 whitespace-pre-line mb-4">
          {settings.invoiceNotes}
        </p>
      )}

      {!settings.invoiceNotes && (
        <p className="text-sm text-gray-500 mb-4">
          Thank you for your business.
        </p>
      )}

      {/* Page footer */}
      <p className="text-center text-xs text-gray-300 mt-4">Page 1 of 1</p>
    </div>
  );
}
