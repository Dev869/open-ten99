import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkItemCard } from '../../components/workitems/WorkItemCard';
import { FilterTabs } from '../../components/workitems/FilterTabs';
import { NewWorkOrderModal } from '../../components/workitems/NewWorkOrderModal';
import type { WorkItem, Client, AppSettings, App } from '../../lib/types';
import { WORK_ITEM_TYPE_LABELS, WORK_ITEM_STATUS_LABELS } from '../../lib/types';
import { formatDate, exportToCsv } from '../../lib/utils';
import { bulkUpdateStatus } from '../../services/firestore';
import { IconDocument } from '../../components/icons';
import { useInsights } from '../../hooks/useFirestore';
import { InsightBadge } from '../../components/insights/InsightBadge';

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
  const { insights } = useInsights();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Initialize state directly from URL params to avoid race condition
  const [selectedClients, setSelectedClients] = useState<string[]>(() => {
    const val = searchParams.get('clients');
    return val ? val.split(',') : [];
  });
  const [selectedApps, setSelectedApps] = useState<string[]>(() => {
    const val = searchParams.get('apps');
    return val ? val.split(',') : [];
  });
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string[]>(() => {
    const val = searchParams.get('invoice');
    return val ? val.split(',') : [];
  });
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => ({
    start: searchParams.get('start') || '',
    end: searchParams.get('end') || '',
  }));

  const isInitialMount = useRef(true);

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
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
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
    exportToCsv(`ten99-work-items-${date}.csv`, headers, rows);
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

  const [showAdvanced, setShowAdvanced] = useState(hasActiveFilters);
  const activeFilterCount = selectedClients.length + selectedApps.length + selectedInvoiceStatus.length + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0);

  return (
    <div className="animate-fade-in-up">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="hidden md:block text-xl font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
          Work Orders
          <span className="text-sm font-semibold text-[var(--text-secondary)] ml-2 normal-case tracking-normal">
            {filtered.length}
          </span>
        </h1>
        <div className="md:hidden" />
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="h-9 w-9 flex-shrink-0 inline-flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] active:scale-[0.97] transition-all"
            aria-label="Export CSV"
            title="Export CSV"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={() => setShowNewOrder(true)}
            className="h-9 flex-shrink-0 px-4 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all whitespace-nowrap"
          >
            + New
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search work orders..."
          className="w-full px-4 py-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-shadow"
        />
      </div>

      {/* ── Filter row: type + status + advanced toggle ── */}
      <div className="flex items-center gap-1.5 mb-2">
        <FilterTabs tabs={typeTabs} selected={selectedType} onSelect={setSelectedType} label="Types" />
        <FilterTabs tabs={statusTabs} selected={selectedStatus} onSelect={setSelectedStatus} label="Statuses" />
        <button
          onClick={() => setShowAdvanced(prev => !prev)}
          className={`md:hidden h-9 px-2.5 rounded-lg border text-xs font-medium flex-shrink-0 transition-colors ${
            showAdvanced || activeFilterCount > 0
              ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-px">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {activeFilterCount > 0 && (
            <span className="ml-1">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* ── Advanced filters (collapsible on mobile) ── */}
      <div className={`mb-2 md:block ${showAdvanced ? 'block' : 'hidden md:block'}`}>
        <div className="p-2.5 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] space-y-2 overflow-hidden">
          {/* Dropdowns row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Client filter chips + dropdown */}
            {selectedClients.map(id => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                {clientMap[id] ?? id}
                <button
                  onClick={() => {
                    const next = selectedClients.filter(c => c !== id);
                    setSelectedClients(next);
                    setSelectedApps(prev => prev.filter(appId => apps.some(a => a.id === appId && next.includes(a.clientId))));
                  }}
                  className="hover:text-[var(--color-red)] leading-none"
                >&times;</button>
              </span>
            ))}
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !selectedClients.includes(val)) setSelectedClients(prev => [...prev, val]);
              }}
              className="h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-[11px] min-w-0"
            >
              <option value="">+ Client</option>
              {clients.filter(c => c.id && !selectedClients.includes(c.id)).map(c => (
                <option key={c.id} value={c.id!}>{c.name}</option>
              ))}
            </select>

            {/* App filter chips + dropdown */}
            {selectedApps.map(id => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                {appMap[id] ?? id}
                <button onClick={() => setSelectedApps(prev => prev.filter(a => a !== id))} className="hover:text-[var(--color-red)] leading-none">&times;</button>
              </span>
            ))}
            {availableApps.filter(a => a.id && !selectedApps.includes(a.id)).length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !selectedApps.includes(val)) setSelectedApps(prev => [...prev, val]);
                }}
                className="h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-[11px] min-w-0"
              >
                <option value="">+ App</option>
                {availableApps.filter(a => a.id && !selectedApps.includes(a.id)).map(a => (
                  <option key={a.id} value={a.id!}>{a.name}</option>
                ))}
              </select>
            )}

            {/* Invoice status filter chips + dropdown */}
            {selectedInvoiceStatus.map(status => (
              <span key={status} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                {invoiceStatusLabels[status] ?? status}
                <button onClick={() => setSelectedInvoiceStatus(prev => prev.filter(s => s !== status))} className="hover:text-[var(--color-red)] leading-none">&times;</button>
              </span>
            ))}
            {invoiceStatusOptions.filter(s => !selectedInvoiceStatus.includes(s)).length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !selectedInvoiceStatus.includes(val)) setSelectedInvoiceStatus(prev => [...prev, val]);
                }}
                className="h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-[11px] min-w-0"
              >
                <option value="">+ Invoice</option>
                {invoiceStatusOptions.filter(s => !selectedInvoiceStatus.includes(s)).map(s => (
                  <option key={s} value={s}>{invoiceStatusLabels[s]}</option>
                ))}
              </select>
            )}
          </div>

          {/* Date range row */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="flex-1 min-w-0 h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-[11px]"
            />
            <span className="text-[11px] text-[var(--text-secondary)] flex-shrink-0">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="flex-1 min-w-0 h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-[11px]"
            />
          </div>

          {/* Footer: clear */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <button onClick={clearAllFilters} className="text-[11px] text-[var(--accent)] hover:underline">
                Clear all filters
              </button>
              <span className="text-[11px] text-[var(--text-secondary)] ml-auto">
                {filtered.length} of {totalNonArchived}
              </span>
            </div>
          )}
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
            className="px-3 py-1.5 min-h-[44px] bg-[var(--color-green)] text-white text-xs font-semibold rounded-full hover:brightness-110 transition-all disabled:opacity-50"
          >
            Approve Selected
          </button>
          <button
            onClick={handleBulkArchive}
            disabled={bulkLoading}
            className="px-3 py-1.5 min-h-[44px] bg-[var(--color-gray)] text-white text-xs font-semibold rounded-full hover:brightness-110 transition-all disabled:opacity-50"
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
        {filtered.map((item, i) => {
          const estimate = insights?.projects?.completionEstimates?.find((e) => e.workItemId === item.id);
          const creep = insights?.projects?.scopeCreep?.find((s) => s.workItemId === item.id);
          return (
            <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              <WorkItemCard
                item={item}
                clientName={clientMap[item.clientId] ?? 'Unknown'}
                appName={item.appId ? appMap[item.appId] : undefined}
                selectable
                selected={selectedIds.has(item.id!)}
                onSelect={toggleSelect}
              />
              {(estimate || creep) && (
                <div className="flex gap-1.5 px-1 pt-1">
                  {estimate && (
                    <InsightBadge
                      label={`~${estimate.estimatedDays}d`}
                      level="info"
                      tooltip={`Estimated ${estimate.estimatedDays} days (${Math.round(estimate.confidence * 100)}% confidence)`}
                    />
                  )}
                  {creep && (
                    <InsightBadge
                      label="Scope creep"
                      level={creep.severity}
                      tooltip={creep.reason}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4">
            <IconDocument size={32} color="var(--accent)" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1 text-center">No work orders yet</h2>
          <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs mb-6">
            {hasActiveFilters || search || selectedType !== 'All' || selectedStatus !== 'All'
              ? 'Try adjusting your filters or search terms.'
              : 'Create your first work order to start tracking client projects'}
          </p>
          {!(hasActiveFilters || search || selectedType !== 'All' || selectedStatus !== 'All') && (
            <button
              onClick={() => setShowNewOrder(true)}
              className="px-6 py-3 min-h-[44px] bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:brightness-90 transition-all"
            >
              + New Work Order
            </button>
          )}
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
