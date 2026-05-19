import type { WorkItem, Client, InvoiceRisk } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { InsightBadge } from '../insights/InsightBadge';
import { EntityTable, type EntityTableColumn } from '../common/EntityTable';

interface InvoiceTableProps {
  workItems: WorkItem[];
  clients: Client[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (workItem: WorkItem) => void;
  invoiceRisks?: InvoiceRisk[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--color-gray)',
  sent: 'var(--color-orange)',
  paid: 'var(--color-green)',
  overdue: 'var(--color-red)',
};

export function InvoiceTable({ workItems, clients, selectedIds, onSelectionChange, onRowClick, invoiceRisks }: InvoiceTableProps) {
  const clientMap = new Map(clients.map(c => [c.id, c.name]));

  const columns: EntityTableColumn<WorkItem>[] = [
    {
      key: 'subject',
      header: 'Work Order / Client',
      render: (item) => {
        const clientName = clientMap.get(item.clientId) ?? item.clientId;
        return (
          <>
            <div className="font-medium text-[var(--text-primary)] truncate max-w-xs">
              {item.subject || '(No subject)'}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              {clientName}
              {item.isRetainerInvoice && (
                <span className="ml-1.5 text-[10px] font-semibold text-[var(--color-green)] bg-[var(--color-green)]/10 px-1.5 py-0.5 rounded">
                  Retainer
                </span>
              )}
            </div>
          </>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cellClassName: 'font-mono text-[var(--text-primary)]',
      render: (item) => formatCurrency(item.totalCost),
    },
    {
      key: 'sentDate',
      header: 'Sent Date',
      cellClassName: 'text-[var(--text-secondary)]',
      render: (item) => (item.invoiceSentDate ? formatDate(item.invoiceSentDate) : '—'),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      cellClassName: 'text-[var(--text-secondary)]',
      render: (item) => (item.invoiceDueDate ? formatDate(item.invoiceDueDate) : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const status = item.invoiceStatus ?? 'draft';
        const risk = invoiceRisks?.find((r) => r.workItemId === (item.id ?? ''));
        return (
          <div className="flex flex-col gap-1">
            <span
              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: STATUS_COLORS[status] ?? STATUS_COLORS.draft }}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
            {risk && (
              <InsightBadge label={risk.risk} level={risk.risk} tooltip={risk.reason} />
            )}
            {risk?.predictedPayDate && (
              <span className="text-xs text-[var(--text-secondary)]">
                ~{new Date(risk.predictedPayDate).toLocaleDateString()}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <EntityTable
      items={workItems}
      columns={columns}
      getRowId={(item) => item.id ?? ''}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onRowClick={onRowClick}
      getRowSelectLabel={(item) => `Select ${item.subject}`}
      emptyMessage="No invoices found."
    />
  );
}
