import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkItemCard } from '../../components/WorkItemCard';
import { FilterTabs } from '../../components/FilterTabs';
import { NewWorkOrderModal } from '../../components/NewWorkOrderModal';
import type { WorkItem, Client, AppSettings, App } from '../../lib/types';
import { WORK_ITEM_TYPE_LABELS, WORK_ITEM_STATUS_LABELS } from '../../lib/types';
import { formatDate, exportToCsv } from '../../lib/utils';
import { bulkUpdateStatus } from '../../services/firestore';

interface WorkItemsProps {
  workItems: WorkItem[];
  clients: Client[];
  apps: App[];
  settings: AppSettings;
}

const typeTabs = ['All', 'Change Requests', 'Feature Requests', 'Maintenance'];
const statusTabs = ['All', 'Draft', 'In Review', 'Approved', 'Completed'];
const invoiceStatusOptions = ['draft', 'sent', 'paid', 'overdue'];
const invoiceStatusLabels: Record<string, string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue' };

export default function WorkItems({ workItems, clients, apps, settings }: WorkItemsProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Initialize from URL on mount
  useEffect(() => {
    const clientsParam = searchParams.get('clients');
    const appsParam = searchParams.get('apps');
    const invoice = searchParams.get('invoice');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (clientsParam) setSelectedClients(clientsParam.split(','));
    if (appsParam) setSelectedApps(appsParam.split(','));
    if (invoice) setSelectedInvoiceStatus(invoice.split(','));
    if (start) setDateRange(prev => ({ ...prev, start }));
    if (end) setDateRange(prev => ({ ...prev, end }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filters to URL when filter state changes
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedClients.length) params.set('clients', selectedClients.join(','));
    if (selectedApps.length) params.set('apps', selectedApps.join(','));
    if (selectedInvoiceStatus.length) params.set('invoice', selectedInvoiceStatus.join(','));
    if (dateRange.start) params.set('start', dateRange.start);
    if (dateRange.end) params.set('end', dateRange.end);
    setSearchParams(params, { replace: true });
  }, [selectedClients, selectedApps, selectedInvoiceStatus, dateRange, setSearchParams]);

  useEffect(() => {
    updateUrlParams();
  }, [updateUrlParams]);

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) map[c.id] = c.name; });
    return map;
  }, [clients]);

  const appMap = useMemo(() => {
    const map: Record<string, string> = {};
    apps.forEach((a) => { if (a.id) map[a.id] = a.name; });
    return map;
  }, [apps]);

  const availableApps = useMemo(() => {
    if (selectedClients.length === 0) return apps;
    return apps.filter(a => selectedClients.includes(a.clientId));
  }, [apps, selectedClients]);

  const totalNonArchived = workItems.filter(i => i.status !== 'archived').length;

  const hasActiveFilters =
    selectedClients.length > 0 ||
    selectedApps.length > 0 ||
    selectedInvoiceStatus.length > 0 ||
    !!dateRange.start ||
    !!dateRange.end;

  const filtered = useMemo(() => {
    return workItems
      .filter((i) => i.status !== 'archived')
      .filter((i) => {
        if (selectedType === 'Change Requests') return i.type === 'changeRequest';
        if (selectedType === 'Feature Requests') return i.type === 'featureRequest';
        if (selectedType === 'Maintenance') return i.type === 'maintenance';
        return true;
      })
      .filter((i) => {
        if (selectedStatus === 'Draft') return i.status === 'draft';
        if (selectedStatus === 'In Review') return i.status === 'inReview';
        if (selectedStatus === 'Approved') return i.status === 'approved';
        if (selectedStatus === 'Completed') return i.status === 'completed';
        return true;
      })
      .filter((i) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const name = clientMap[i.clientId] ?? '';
        return (
          i.subject.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q)
        );
      })
      // client filter
      .filter((i) => selectedClients.length === 0 || selectedClients.includes(i.clientId))
      // app filter
      .filter((i) => selectedApps.length === 0 || (i.appId ? selectedApps.includes(i.appId) : false))
      // invoice status filter
      .filter((i) => selectedInvoiceStatus.length === 0 || (i.invoiceStatus ? selectedInvoiceStatus.includes(i.invoiceStatus) : false))
      // date range filter
      .filter((i) => {
        if (dateRange.start && i.createdAt < new Date(dateRange.start)) return false;
        if (dateRange.end && i.createdAt > new Date(dateRange.end + 'T23:59:59')) return false;
        return true;
      });
  }, [workItems, selectedType, selectedStatus, search, clientMap, selectedClients, selectedApps, selectedInvoiceStatus, dateRange]);

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleBulkApprove() {
    const ids = [...selectedIds].filter((id) => {
      const item = workItems.find((i) => i.id === id);
      return item && (item.status === 'draft' || item.status === 'inReview');
    });
    if (!ids.length) return;
    setBulkLoading(true);
    await bulkUpdateStatus(ids, 'approved');
    setSelectedIds(new Set());
    setBulkLoading(false);
  }

  function handleExport() {
    const headers = ['Subject', 'Client', 'Type', 'Status', 'Hours', 'Cost', 'Billable', 'Created', 'Updated'];
    const rows = filtered.map(item => [
      item.subject,
      clientMap[item.clientId] ?? 'Unknown',
      WORK_ITEM_TYPE_LABELS[item.type],
      WORK_ITEM_STATUS_LABELS[item.status],
      item.totalHours.toFixed(1),
      item.totalCost.toFixed(2),
      item.isBillable ? 'Yes' : 'No',
      formatDate(item.createdAt),
      formatDate(item.updatedAt),
    ]);
    const date = new Date().toISOString().split('T')[0];
    exportToCsv(`openchanges-work-items-${date}.csv`, headers, rows);
  }

  async function handleBulkArchive() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkLoading(true);
    await bulkUpdateStatus(ids, 'archived');
    setSelectedIds(new Set());
    setBulkLoading(false);
  }

  function clearAllFilters() {
    setSelectedClients([]);
    setSelectedApps([]);
    setSelectedInvoiceStatus([]);
    setDateRange({ start: '', end: '' });
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Work Items
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 py-2.5 px-4 min-h-[44px] rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] active:scale-[0.97] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowNewOrder(true)}
            className="px-4 py-2 min-h-[44px] bg-[var(--accent)] text-white text-sm font-semibold rounded-full hover:bg-[var(--accent-dark)] transition-colors"
          >
            + New Work Order
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search work items..."
          className="w-full px-4 py-2.5 min-h-[44px] bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        <FilterTabs tabs={typeTabs} selected={selectedType} onSelect={setSelectedType} />
        <FilterTabs tabs={statusTabs} selected={selectedStatus} onSelect={setSelectedStatus} />
      </div>

      {/* Advanced Filter Bar */}
      <div className="mb-4 p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] space-y-2">
        <div className="flex flex-wrap items-start gap-3">

          {/* Client filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedClients.map(id => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                {clientMap[id] ?? id}
                <button
                  onClick={() => {
                    const next = selectedClients.filter(c => c !== id);
                    setSelectedClients(next);
                    setSelectedApps(prev => prev.filter(appId => apps.some(a => a.id === appId && next.includes(a.clientId))));
                  }}
                  className="hover:text-red-500 leading-none"
                >
                  &times;
                </button>
              </span>
            ))}
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !selectedClients.includes(val)) {
                  setSelectedClients(prev => [...prev, val]);
                }
              }}
              className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-xs"
            >
              <option value="">+ Client</option>
              {clients.filter(c => c.id && !selectedClients.includes(c.id)).map(c => (
                <option key={c.id} value={c.id!}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* App filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedApps.map(id => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                {appMap[id] ?? id}
                <button
                  onClick={() => setSelectedApps(prev => prev.filter(a => a !== id))}
                  className="hover:text-red-500 leading-none"
                >
                  &times;
                </button>
              </span>
            ))}
            {availableApps.filter(a => a.id && !selectedApps.includes(a.id)).length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !selectedApps.includes(val)) {
                    setSelectedApps(prev => [...prev, val]);
                  }
                }}
                className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-xs"
              >
                <option value="">+ App</option>
                {availableApps.filter(a => a.id && !selectedApps.includes(a.id)).map(a => (
                  <option key={a.id} value={a.id!}>{a.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Invoice status filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedInvoiceStatus.map(status => (
              <span key={status} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                {invoiceStatusLabels[status] ?? status}
                <button
                  onClick={() => setSelectedInvoiceStatus(prev => prev.filter(s => s !== status))}
                  className="hover:text-red-500 leading-none"
                >
                  &times;
                </button>
              </span>
            ))}
            {invoiceStatusOptions.filter(s => !selectedInvoiceStatus.includes(s)).length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !selectedInvoiceStatus.includes(val)) {
                    setSelectedInvoiceStatus(prev => [...prev, val]);
                  }
                }}
                className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-xs"
              >
                <option value="">+ Invoice</option>
                {invoiceStatusOptions.filter(s => !selectedInvoiceStatus.includes(s)).map(s => (
                  <option key={s} value={s}>{invoiceStatusLabels[s]}</option>
                ))}
              </select>
            )}
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-xs"
            />
            <span className="text-xs text-[var(--text-tertiary)]">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-xs"
            />
          </div>
        </div>

        {/* Footer row: clear all + result count */}
        <div className="flex items-center gap-3 pt-1">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Clear all
            </button>
          )}
          <span className="text-xs text-[var(--text-tertiary)] ml-auto">
            Showing {filtered.length} of {totalNonArchived} work orders
          </span>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
          <span className="text-sm text-[var(--text-secondary)]">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkApprove}
            disabled={bulkLoading}
            className="px-3 py-1.5 min-h-[44px] bg-[#27AE60] text-white text-xs font-semibold rounded-full hover:bg-[#219A52] disabled:opacity-50"
          >
            Approve Selected
          </button>
          <button
            onClick={handleBulkArchive}
            disabled={bulkLoading}
            className="px-3 py-1.5 min-h-[44px] bg-[#888] text-white text-xs font-semibold rounded-full hover:bg-[#666] disabled:opacity-50"
          >
            Archive Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs min-h-[44px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] sm:ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {filtered.map((item, i) => (
          <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
            <WorkItemCard
              item={item}
              clientName={clientMap[item.clientId] ?? 'Unknown'}
              appName={item.appId ? appMap[item.appId] : undefined}
              selectable
              selected={selectedIds.has(item.id!)}
              onSelect={toggleSelect}
            />
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4 opacity-40">✦</div>
          <div className="text-lg font-bold text-[var(--text-primary)]">Nothing here yet</div>
          <div className="text-sm text-[var(--text-secondary)] mt-1">
            Try adjusting your filters or create a new work order.
          </div>
        </div>
      )}

      {showNewOrder && (
        <NewWorkOrderModal
          clients={clients}
          apps={apps}
          hourlyRate={settings.hourlyRate}
          onClose={() => setShowNewOrder(false)}
        />
      )}
    </div>
  );
}
