import type { WorkItem, Client } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';

interface InvoiceTableProps {
  workItems: WorkItem[];
  clients: Client[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (workItem: WorkItem) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#86868B',
  sent: '#D4873E',
  paid: '#5A9A5A',
  overdue: '#ef4444',
};

export function InvoiceTable({ workItems, clients, selectedIds, onSelectionChange, onRowClick }: InvoiceTableProps) {
  const clientMap = new Map(clients.map(c => [c.id, c.name]));

  const allSelected = workItems.length > 0 && workItems.every(item => selectedIds.has(item.id ?? ''));

  function handleSelectAll(checked: boolean) {
    if (checked) {
      onSelectionChange(new Set(workItems.map(item => item.id ?? '')));
    } else {
      onSelectionChange(new Set());
    }
  }

  function handleRowSelect(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    onSelectionChange(next);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--bg-card)] border-b border-[var(--border)]">
            <th className="px-4 py-3 text-left w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={e => handleSelectAll(e.target.checked)}
                className="rounded border-[var(--border)] accent-[var(--accent)]"
                aria-label="Select all"
              />
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
              Work Order / Client
            </th>
            <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
              Amount
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
              Sent Date
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
              Due Date
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wide text-xs">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {workItems.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                No invoices found.
              </td>
            </tr>
          ) : (
            workItems.map(item => {
              const id = item.id ?? '';
              const isSelected = selectedIds.has(id);
              const status = item.invoiceStatus ?? 'draft';
              const clientName = clientMap.get(item.clientId) ?? item.clientId;

              return (
                <tr
                  key={id}
                  className={`border-b border-[var(--border)] last:border-b-0 transition-colors cursor-pointer ${
                    isSelected ? 'bg-[var(--accent)]/5' : 'bg-[var(--bg-page)] hover:bg-[var(--bg-card)]'
                  }`}
                  onClick={() => onRowClick?.(item)}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => handleRowSelect(id, e.target.checked)}
                      className="rounded border-[var(--border)] accent-[var(--accent)]"
                      aria-label={`Select ${item.subject}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)] truncate max-w-xs">
                      {item.subject || '(No subject)'}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">{clientName}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                    {formatCurrency(item.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {item.invoiceSentDate ? formatDate(item.invoiceSentDate) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {item.invoiceDueDate ? formatDate(item.invoiceDueDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: STATUS_COLORS[status] ?? STATUS_COLORS.draft }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
