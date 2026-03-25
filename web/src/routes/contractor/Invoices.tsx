import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { WorkItem, Client, AppSettings } from '../../lib/types';
import { getInvoicesByStatus, getInvoiceStatusCounts, getAgingBuckets } from '../../lib/finance';
import { AgingSummary } from '../../components/finance/AgingSummary';
import { InvoiceTable } from '../../components/finance/InvoiceTable';
import { useInsights } from '../../hooks/useFirestore';
import { InvoicePreview } from '../../components/finance/InvoicePreview';
import { InvoiceCard } from '../../components/finance/InvoiceCard';
import { updateInvoiceStatus, discardWorkItem } from '../../services/firestore';
import { formatCurrency, formatDate, exportToCsv, paymentTermsToDays } from '../../lib/utils';
import { NewInvoiceModal } from '../../components/finance/NewInvoiceModal';
import { IconDollar } from '../../components/icons';

interface InvoicesProps {
  workItems: WorkItem[];
  clients: Client[];
  settings: AppSettings;
  hourlyRate: number;
  paymentTerms?: string;
  taxRate?: number;
}

type InvoiceStatusFilter = 'all' | 'draft' | 'sent' | 'overdue' | 'paid';

const STATUS_TABS: { key: InvoiceStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
];

export default function Invoices({ workItems, clients, settings, hourlyRate, paymentTerms, taxRate }: InvoicesProps) {
  const navigate = useNavigate();
  const [activeStatus, setActiveStatus] = useState<InvoiceStatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<WorkItem | null>(null);
  const [showNewInvoice, setShowNewInvoice] = useState(false);

  const { insights } = useInsights();

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

  const allBillableItems = useMemo(() => getInvoicesByStatus(workItems), [workItems]);

  function handleTabChange(key: InvoiceStatusFilter) {
    setActiveStatus(key);
    setSelectedIds(new Set());
  }

  async function handleMarkAsSent() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsToDays(paymentTerms));
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
    if (!window.confirm(`Discard ${selectedIds.size} invoice${selectedIds.size !== 1 ? 's' : ''}? They will be permanently deleted after 30 days.`)) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => {
          const item = workItems.find(i => i.id === id);
          return discardWorkItem(id, item?.status);
        }),
      );
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const item = workItems.find(i => i.id === id);
    await discardWorkItem(id, item?.status);
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

  if (allBillableItems.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Invoices</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Manage and track billable work orders
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4">
            <IconDollar size={32} color="var(--accent)" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1 text-center">No invoices yet</h2>
          <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs mb-6">
            Mark work orders as billable to start invoicing clients
          </p>
          <Link
            to="/dashboard/work-items"
            className="px-6 py-3 min-h-[44px] bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:brightness-90 transition-all inline-flex items-center"
          >
            Go to Work Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="hidden md:block">
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

      {/* Invoice table + inline preview layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Table column */}
        <div className={previewItem ? 'lg:w-1/2 xl:w-3/5' : 'w-full'}>
          <InvoiceTable
            workItems={filteredItems}
            clients={clients}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onRowClick={setPreviewItem}
            invoiceRisks={insights?.payments?.invoiceRisks}
          />
        </div>

        {/* Inline invoice card preview (desktop) */}
        {previewItem && (
          <div className="hidden lg:block lg:w-1/2 xl:w-2/5">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Invoice Preview
                </h3>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Close preview"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <InvoiceCard
                workItem={previewItem}
                client={clients.find(c => c.id === previewItem.clientId)}
                settings={settings}
                invoiceNumber={(() => {
                  const baseNumber = settings.invoiceNextNumber ?? 1001;
                  const allSorted = [...workItems].sort(
                    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
                  );
                  const idx = allSorted.findIndex(i => i.id === previewItem.id);
                  return idx >= 0 ? baseNumber + idx : baseNumber;
                })()}
              />
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => {
                    navigate(`/dashboard/work-items/${previewItem.id}`);
                    setPreviewItem(null);
                  }}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-90 transition-all"
                >
                  Open Full Detail
                </button>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2.5 min-h-[44px] rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invoice preview slide-over (mobile/tablet) */}
      {previewItem && (
        <div className="lg:hidden">
          <InvoicePreview
            workItem={previewItem}
            client={clients.find(c => c.id === previewItem.clientId)}
            taxRate={taxRate}
            onClose={() => setPreviewItem(null)}
            onNavigate={(id) => {
              setPreviewItem(null);
              navigate(`/dashboard/work-items/${id}`);
            }}
            onDelete={handleDelete}
          />
        </div>
      )}

      {showNewInvoice && (
        <NewInvoiceModal
          clients={clients}
          hourlyRate={hourlyRate}
          paymentTerms={paymentTerms}
          onClose={() => setShowNewInvoice(false)}
        />
      )}
    </div>
  );
}
