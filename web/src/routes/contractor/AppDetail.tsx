import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { App, WorkItem, Client } from '../../lib/types';
import {
  APP_PLATFORM_LABELS,
  APP_STATUS_LABELS,
  APP_ENVIRONMENT_LABELS,
  WORK_ITEM_TYPE_LABELS,
} from '../../lib/types';
import { StatCard } from '../../components/StatCard';
import { WorkItemCard } from '../../components/WorkItemCard';
import { AppFormModal } from '../../components/AppFormModal';
import { FilterTabs } from '../../components/FilterTabs';
import { deleteApp } from '../../services/firestore';
import {
  IconChevronLeft,
  IconEdit,
  IconTrash,
} from '../../components/icons';

interface AppDetailProps {
  apps: App[];
  workItems: WorkItem[];
  clients: Client[];
}

const statusColors: Record<App['status'], string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  retired: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  development: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};


const TYPE_TABS = ['All', 'Change Requests', 'Feature Requests', 'Maintenance'] as const;

const typeTabToKey: Record<string, string> = {
  'All': 'all',
  'Change Requests': 'changeRequest',
  'Feature Requests': 'featureRequest',
  'Maintenance': 'maintenance',
};

export default function AppDetail({ apps, workItems, clients }: AppDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const app = apps.find((a) => a.id === id);

  const clientName = useMemo(() => {
    if (!app) return '';
    return clients.find((c) => c.id === app.clientId)?.name ?? '';
  }, [app, clients]);

  const appWorkOrders = useMemo(() => {
    if (!app) return [];
    return [...workItems.filter((w) => w.appId === app.id)].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }, [workItems, app]);

  const statusCounts = useMemo(() => {
    return {
      draft: appWorkOrders.filter((w) => w.status === 'draft').length,
      inReview: appWorkOrders.filter((w) => w.status === 'inReview').length,
      approved: appWorkOrders.filter((w) => w.status === 'approved').length,
      completed: appWorkOrders.filter((w) => w.status === 'completed').length,
    };
  }, [appWorkOrders]);

  const filteredWorkOrders = useMemo(() => {
    const key = typeTabToKey[selectedType];
    if (key === 'all') return appWorkOrders;
    return appWorkOrders.filter((w) => w.type === key);
  }, [appWorkOrders, selectedType]);

  if (!app) {
    return (
      <div className="text-center py-20 text-[var(--text-secondary)]">App not found.</div>
    );
  }

  async function handleDelete() {
    if (!app?.id) return;
    setDeleting(true);
    try {
      await deleteApp(app.id);
      navigate('/dashboard/apps');
    } catch (err) {
      console.error('Failed to delete app:', err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const activeCount = statusCounts.inReview + statusCounts.approved;

  return (
    <div className="max-w-5xl animate-fade-in-up">
      {/* Back Link */}
      <Link
        to="/dashboard/apps"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] hover:shadow-sm border border-transparent hover:border-[var(--border)] active:scale-[0.97] transition-all mb-5 min-h-[44px]"
      >
        <IconChevronLeft size={16} className="flex-shrink-0" />
        Apps
      </Link>

      {/* App Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{app.name}</h1>
        {clientName && (
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{clientName}</p>
        )}
        {app.description && (
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">{app.description}</p>
        )}
      </div>

      {/* Stat Cards */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="animate-fade-in-up flex-1 min-w-[120px]" style={{ animationDelay: '0ms' }}>
          <StatCard label="Total" value={String(appWorkOrders.length)} />
        </div>
        <div className="animate-fade-in-up flex-1 min-w-[120px]" style={{ animationDelay: '50ms' }}>
          <StatCard
            label="Active"
            value={String(activeCount)}
            color={activeCount > 0 ? '#22c55e' : undefined}
          />
        </div>
        <div className="animate-fade-in-up flex-1 min-w-[120px]" style={{ animationDelay: '100ms' }}>
          <StatCard
            label="Completed"
            value={String(statusCounts.completed)}
            color={statusCounts.completed > 0 ? 'var(--accent)' : undefined}
          />
        </div>
        <div className="animate-fade-in-up flex-1 min-w-[120px]" style={{ animationDelay: '150ms' }}>
          <StatCard
            label="Draft"
            value={String(statusCounts.draft)}
            color={statusCounts.draft > 0 ? '#9ca3af' : undefined}
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column — Activity */}
        <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Activity ({filteredWorkOrders.length})
            </h2>
          </div>
          <div className="mb-3">
            <FilterTabs
              tabs={[...TYPE_TABS]}
              selected={selectedType}
              onSelect={setSelectedType}
            />
          </div>
          <div className="space-y-2">
            {filteredWorkOrders.map((item, i) => (
              <div
                key={item.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${250 + Math.min(i, 8) * 50}ms` }}
              >
                <WorkItemCard item={item} clientName={clientName} />
              </div>
            ))}
          </div>
          {filteredWorkOrders.length === 0 && (
            <div
              className="text-center py-16 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] animate-fade-in-up"
              style={{ animationDelay: '250ms' }}
            >
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[var(--bg-input)] flex items-center justify-center">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 28 28"
                  fill="none"
                  className="text-[var(--text-secondary)]/50"
                >
                  <rect x="4" y="6" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M4 11h20" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M9 16h10M9 19h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">No work orders yet</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
                {selectedType === 'All'
                  ? 'Work orders linked to this app will appear here.'
                  : `No ${WORK_ITEM_TYPE_LABELS[typeTabToKey[selectedType] as keyof typeof WORK_ITEM_TYPE_LABELS] ?? selectedType.toLowerCase()} work orders yet.`}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Column — App Info */}
        <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
            {/* Platform + Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded bg-[var(--bg-input)] text-xs font-medium text-[var(--text-secondary)]">
                {APP_PLATFORM_LABELS[app.platform]}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[app.status]}`}>
                {APP_STATUS_LABELS[app.status]}
              </span>
            </div>

            {/* App URL */}
            {app.url && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">
                  URL
                </div>
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--accent)] hover:underline break-all"
                >
                  {app.url}
                </a>
              </div>
            )}

            {/* Tech Stack */}
            {app.techStack && app.techStack.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">
                  Tech Stack
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {app.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-input)] text-[var(--text-secondary)]"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Repo Links */}
            {app.repoUrls.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">
                  Repositories
                </div>
                <div className="space-y-1.5">
                  {app.repoUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline break-all"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 opacity-70">
                        <path d="M7 1h4v4M11 1L5 7M4 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Hosting */}
            {app.hosting && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                  Hosting
                </div>
                <div className="text-sm text-[var(--text-primary)]">{app.hosting}</div>
              </div>
            )}

            {/* Environment */}
            {app.environment && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                  Environment
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-input)] text-[var(--text-secondary)]">
                  {APP_ENVIRONMENT_LABELS[app.environment]}
                </span>
              </div>
            )}

            {/* Deployment Notes */}
            {app.deploymentNotes && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                  Deployment Notes
                </div>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {app.deploymentNotes}
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* Edit Button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 w-full justify-center py-2.5 px-4 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] active:scale-[0.97] transition-all min-h-[44px]"
            >
              <IconEdit size={15} />
              Edit App
            </button>

            {/* Delete Button */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 w-full justify-center py-2 px-4 rounded-xl text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 active:scale-[0.97] transition-all min-h-[40px]"
              >
                <IconTrash size={14} />
                Delete App
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-2">
                <p className="text-xs text-red-700 font-medium">
                  Are you sure you want to delete this app?{' '}
                  {appWorkOrders.length > 0 && (
                    <span>{appWorkOrders.length} work order{appWorkOrders.length !== 1 ? 's' : ''} will be unlinked.</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors min-h-[36px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 active:scale-[0.98] transition-all min-h-[36px]"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <AppFormModal
          app={app}
          clients={clients}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
