import { useState, useMemo } from 'react';
import type { App, WorkItem, Client } from '../../lib/types';
import { APP_PLATFORM_LABELS, APP_STATUS_LABELS } from '../../lib/types';
import { AppCard } from '../../components/AppCard';
import { AppFormModal } from '../../components/AppFormModal';
import { GitHubImportModal } from '../../components/GitHubImportModal';
import { IconPlus, IconSearch } from '../../components/icons';
import { useIntegration } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';

interface AppsListProps {
  apps: App[];
  workItems: WorkItem[];
  clients: Client[];
}

export default function AppsList({ apps, workItems, clients }: AppsListProps) {
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showNewApp, setShowNewApp] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { user } = useAuth();
  const { integration } = useIntegration(user?.uid);

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) map[c.id] = c.name; });
    return map;
  }, [clients]);

  const workOrderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    workItems.forEach((wi) => {
      if (wi.appId) counts[wi.appId] = (counts[wi.appId] || 0) + 1;
    });
    return counts;
  }, [workItems]);

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      if (filterClient && app.clientId !== filterClient) return false;
      if (filterPlatform && app.platform !== filterPlatform) return false;
      if (filterStatus && app.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const clientName = clientMap[app.clientId] ?? '';
        const matchesSearch =
          app.name.toLowerCase().includes(q) ||
          (app.description ?? '').toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [apps, filterClient, filterPlatform, filterStatus, search, clientMap]);

  const hasAnyFilter = search.trim() || filterClient || filterPlatform || filterStatus;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Apps</h1>
          {apps.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)]">
              {apps.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {integration.github?.connected && (
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-semibold text-sm hover:bg-[var(--bg-input)] transition-colors min-h-[44px] whitespace-nowrap"
            >
              <span className="hidden sm:inline">Import from GitHub</span>
              <span className="sm:hidden">Import</span>
            </button>
          )}
          <button
            onClick={() => setShowNewApp(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all min-h-[44px] whitespace-nowrap"
          >
            <IconPlus size={16} className="flex-shrink-0" />
            New App
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <IconSearch
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps..."
          className="w-full pl-11 pr-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] shadow-sm transition-shadow min-h-[44px]"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
        >
          <option value="">All Platforms</option>
          {(Object.entries(APP_PLATFORM_LABELS) as [string, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[44px]"
        >
          <option value="">All Statuses</option>
          {(Object.entries(APP_STATUS_LABELS) as [string, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Card Grid */}
      {filteredApps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app, i) => (
            <div
              key={app.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <AppCard
                app={app}
                clientName={clientMap[app.clientId] ?? 'Unknown'}
                workOrderCount={workOrderCounts[app.id!] ?? 0}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredApps.length === 0 && (
        <div className="text-center py-24 animate-fade-in-up">
          <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              className="text-[var(--accent)]"
            >
              <rect x="4" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
              <rect x="20" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
              <rect x="4" y="20" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
              <rect x="20" y="20" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className="text-lg font-bold text-[var(--text-primary)]">
            {hasAnyFilter ? 'No apps match your filters' : 'No apps yet'}
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-xs mx-auto">
            {hasAnyFilter
              ? 'Try adjusting your search or filters.'
              : 'Add your first app to start tracking platforms, repos, and work orders.'}
          </div>
          {!hasAnyFilter && (
            <button
              onClick={() => setShowNewApp(true)}
              className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] active:scale-[0.97] transition-all min-h-[44px]"
            >
              <IconPlus size={16} />
              Add your first app
            </button>
          )}
        </div>
      )}

      {/* New App Modal */}
      {showNewApp && (
        <AppFormModal
          clients={clients}
          onClose={() => setShowNewApp(false)}
        />
      )}

      {/* GitHub Import Modal */}
      {showImport && (
        <GitHubImportModal
          clients={clients}
          apps={apps}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
