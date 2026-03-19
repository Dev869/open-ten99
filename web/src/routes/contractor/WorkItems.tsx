import { useState, useMemo } from 'react';
import { WorkItemCard } from '../../components/WorkItemCard';
import { FilterTabs } from '../../components/FilterTabs';
import { NewWorkOrderModal } from '../../components/NewWorkOrderModal';
import type { WorkItem, Client, AppSettings } from '../../lib/types';
import { WORK_ITEM_TYPE_LABELS, WORK_ITEM_STATUS_LABELS } from '../../lib/types';
import { formatDate, exportToCsv } from '../../lib/utils';
import { bulkUpdateStatus } from '../../services/firestore';

interface WorkItemsProps {
  workItems: WorkItem[];
  clients: Client[];
  settings: AppSettings;
}

const typeTabs = ['All', 'Change Requests', 'Feature Requests', 'Maintenance'];
const statusTabs = ['All', 'Draft', 'In Review', 'Approved', 'Completed'];

export default function WorkItems({ workItems, clients, settings }: WorkItemsProps) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) map[c.id] = c.name; });
    return map;
  }, [clients]);

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
      });
  }, [workItems, selectedType, selectedStatus, search, clientMap]);

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

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-extrabold text-[#1A1A2E] uppercase tracking-wider">
          Work Items
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 py-2.5 px-4 min-h-[44px] rounded-xl border border-[#E5E5EA] text-sm font-medium text-[#86868B] hover:bg-[#F2F2F7] active:scale-[0.97] transition-all"
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
            className="px-4 py-2 min-h-[44px] bg-[#4BA8A8] text-white text-sm font-semibold rounded-full hover:bg-[#3A9090] transition-colors"
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
          className="w-full px-4 py-2.5 min-h-[44px] bg-white rounded-xl border border-[#E5E5EA] text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
        />
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        <FilterTabs tabs={typeTabs} selected={selectedType} onSelect={setSelectedType} />
        <FilterTabs tabs={statusTabs} selected={selectedStatus} onSelect={setSelectedStatus} />
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white rounded-xl border border-[#E5E5EA]">
          <span className="text-sm text-[#86868B]">
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
            className="text-xs min-h-[44px] text-[#86868B] hover:text-[#1A1A2E] sm:ml-auto"
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
          <div className="text-lg font-bold text-[#1A1A2E]">Nothing here yet</div>
          <div className="text-sm text-[#86868B] mt-1">
            Try adjusting your filters or create a new work order.
          </div>
        </div>
      )}

      {showNewOrder && (
        <NewWorkOrderModal
          clients={clients}
          hourlyRate={settings.hourlyRate}
          onClose={() => setShowNewOrder(false)}
        />
      )}
    </div>
  );
}
