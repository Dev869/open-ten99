import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkItem, Client } from '../../lib/types';
import { getInvoicesByStatus, getInvoiceStatusCounts, getAgingBuckets } from '../../lib/finance';
import { AgingSummary } from '../../components/finance/AgingSummary';
import { InvoiceTable } from '../../components/finance/InvoiceTable';
import { InvoicePreview } from '../../components/finance/InvoicePreview';
import { updateInvoiceStatus, archiveWorkItem } from '../../services/firestore';
import { formatCurrency, formatDate, exportToCsv } from '../../lib/utils';
import { NewInvoiceModal } from '../../components/finance/NewInvoiceModal';

interface InvoicesProps {
  workItems: WorkItem[];
  clients: Client[];
  hourlyRate: number;
}

type InvoiceStatusFilter = 'all' | 'draft' | 'sent' | 'overdue' | 'paid';

const STATUS_TABS: { key: InvoiceStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
];

export default function Invoices({ workItems, clients, hourlyRate }: InvoicesProps) {
  const navigate = useNavigate();
  const [activeStatus, setActiveStatus] = useState<InvoiceStatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<WorkItem | null>(null);
  const [showNewInvoice, setShowNewInvoice] = useState(false);

  const clientMap = useMemo(
    () => new Map(clients.map(c => [c.id, c.name])),
    [clients],
  );

  const statusCounts = useMemo(() => getInvoiceStatusCounts(workItems), [workItems]);

  const filteredItems = useMemo(
    () =>
      activeStatus === 'all'
        ? getInvoicesByStatus(workItems)
        : getInvoicesByStatus(workItems, activeStatus),
    [workItems, activeStatus],
  );

  const agingBuckets = useMemo(() => getAgingBuckets(workItems), [workItems]);

  function handleTabChange(key: InvoiceStatusFilter) {
    setActiveStatus(key);
    setSelectedIds(new Set());
  }

  async function handleMarkAsSent() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          updateInvoiceStatus(id, {
            invoiceStatus: 'sent',
            invoiceSentDate: new Date(),
            invoiceDueDate: dueDate,
          }),
        ),
      );
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleMarkAsPaid() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          updateInvoiceStatus(id, {
            invoiceStatus: 'paid',
            invoicePaidDate: new Date(),
          }),
        ),
      );
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Archive ${selectedIds.size} work order${selectedIds.size !== 1 ? 's' : ''}?`)) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => archiveWorkItem(id)),
      );
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await archiveWorkItem(id);
    setPreviewItem(null);
  }

  function handleExportCsv() {
    const headers = ['Work Order', 'Client', 'Amount', 'Hours', 'Sent Date', 'Due Date', 'Status'];
    const rows = filteredItems.map(item => [
      item.subject || '',
      clientMap.get(item.clientId) ?? item.clientId,
      formatCurrency(item.totalCost),
      item.totalHours.toFixed(1),
      item.invoiceSentDate ? formatDate(item.invoiceSentDate) : '',
      item.invoiceDueDate ? formatDate(item.invoiceDueDate) : '',
      item.invoiceStatus ?? 'draft',
    ]);
    exportToCsv('Invoice_Register.csv', headers, rows);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Invoices</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage and track billable work orders
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowNewInvoice(true)}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New Invoice
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Aging summary */}
      <AgingSummary buckets={agingBuckets} />

      {/* Status filter tabs */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1 border-b border-[var(--border)] min-w-max sm:min-w-0">
          {STATUS_TABS.map(tab => {
            const count = statusCounts[tab.key] ?? 0;
            const isActive = activeStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  isActive
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg">
          <span className="text-sm text-[var(--text-secondary)]">
            {selectedIds.size} selected
          </span>
          <div className="flex-1 hidden sm:block" />
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={handleMarkAsSent}
              disabled={bulkLoading}
              className="px-3 py-1.5 min-h-[44px] text-sm rounded-lg border border-[var(--color-orange)] text-[var(--color-orange)] hover:bg-[var(--color-orange)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark as Sent
            </button>
            <button
              onClick={handleMarkAsPaid}
              disabled={bulkLoading}
              className="px-3 py-1.5 min-h-[44px] text-sm rounded-lg border border-[var(--color-green)] text-[var(--color-green)] hover:bg-[var(--color-green)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark as Paid
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="px-3 py-1.5 min-h-[44px] text-sm rounded-lg border border-[var(--color-red)]/50 text-[var(--color-red)] hover:bg-[var(--color-red)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Invoice table */}
      <InvoiceTable
        workItems={filteredItems}
        clients={clients}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={setPreviewItem}
      />

      {/* Invoice preview slide-over */}
      {previewItem && (
        <InvoicePreview
          workItem={previewItem}
          client={clients.find(c => c.id === previewItem.clientId)}
          onClose={() => setPreviewItem(null)}
          onNavigate={(id) => {
            setPreviewItem(null);
            navigate(`/dashboard/work-items/${id}`);
          }}
          onDelete={handleDelete}
        />
      )}

      {showNewInvoice && (
        <NewInvoiceModal
          clients={clients}
          hourlyRate={hourlyRate}
          onClose={() => setShowNewInvoice(false)}
        />
      )}
    </div>
  );
}
