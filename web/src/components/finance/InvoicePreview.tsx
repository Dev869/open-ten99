import type { WorkItem, Client } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';

interface InvoicePreviewProps {
  workItem: WorkItem;
  client: Client | undefined;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_COLORS: Record<string, { color: string }> = {
  draft: { color: 'var(--color-gray)' },
  sent: { color: 'var(--color-orange)' },
  paid: { color: 'var(--color-green)' },
  overdue: { color: 'var(--color-red)' },
};

export function InvoicePreview({ workItem, client, onClose, onNavigate, onDelete }: InvoicePreviewProps) {
  const status = workItem.invoiceStatus ?? 'draft';
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.draft!;
  const now = new Date().getTime();

  const daysInfo = (() => {
    if (status === 'paid' && workItem.invoicePaidDate) {
      return `Paid on ${formatDate(workItem.invoicePaidDate)}`;
    }
    if (status === 'overdue' && workItem.invoiceDueDate) {
      const days = Math.floor((now - workItem.invoiceDueDate.getTime()) / (1000 * 60 * 60 * 24));
      return `${days} day${days !== 1 ? 's' : ''} overdue`;
    }
    if (status === 'sent' && workItem.invoiceDueDate) {
      const days = Math.floor((workItem.invoiceDueDate.getTime() - now) / (1000 * 60 * 60 * 24));
      return days > 0 ? `Due in ${days} day${days !== 1 ? 's' : ''}` : 'Due today';
    }
    return null;
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-md z-50 flex flex-col bg-[var(--bg-page)] border-l border-[var(--border)] shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Invoice Preview</h2>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `color-mix(in srgb, ${statusColor.color} 15%, transparent)`, color: statusColor.color }}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close preview"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Work order info */}
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {workItem.subject || '(No subject)'}
            </h3>
            <div className="text-sm text-[var(--text-secondary)] mt-1">
              {client?.name ?? 'Unknown Client'}
            </div>
            {daysInfo && (
              <div className="text-xs mt-2" style={{ color: statusColor.color }}>
                {daysInfo}
              </div>
            )}
          </div>

          {/* Invoice dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
              <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)]">Sent Date</div>
              <div className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {workItem.invoiceSentDate ? formatDate(workItem.invoiceSentDate) : '—'}
              </div>
            </div>
            <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
              <div className="text-[0.65rem] uppercase tracking-wide text-[var(--text-secondary)]">Due Date</div>
              <div className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {workItem.invoiceDueDate ? formatDate(workItem.invoiceDueDate) : '—'}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
              Line Items
            </h4>
            {workItem.lineItems.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)] italic">No line items</div>
            ) : (
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-card)]">
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)]">Description</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-secondary)]">Hours</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-secondary)]">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workItem.lineItems.map((li, i) => (
                      <tr key={li.id ?? i} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2 text-[var(--text-primary)]">{li.description || '—'}</td>
                        <td className="px-3 py-2 text-right text-[var(--text-secondary)] font-mono">{li.hours.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-[var(--text-primary)] font-mono">{formatCurrency(li.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)] space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Total Hours</span>
              <span className="font-mono text-[var(--text-primary)]">{workItem.totalHours.toFixed(1)} hrs</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-[var(--border)]">
              <span className="font-semibold text-[var(--text-primary)]">Total</span>
              <span className="font-bold text-lg" style={{ color: statusColor.color }}>
                {formatCurrency(workItem.totalCost)}
              </span>
            </div>
          </div>

          {/* Retainer note */}
          {workItem.deductFromRetainer && (
            <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
              Deducted from retainer
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 sm:px-6 py-4 border-t border-[var(--border)] flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => onNavigate(workItem.id ?? '')}
            className="flex-1 min-w-0 px-4 py-2.5 min-h-[44px] rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-90 transition-all"
          >
            Open Full Detail
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${workItem.subject}"? This will archive the work order.`)) {
                onDelete(workItem.id ?? '');
              }
            }}
            className="px-3 py-2.5 min-h-[44px] min-w-[44px] rounded-lg text-sm text-[var(--color-red)] hover:bg-[var(--color-red)]/10 transition-colors flex items-center justify-center"
            aria-label="Delete invoice"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
