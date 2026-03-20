import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { WorkItem, Client, App } from '../../lib/types';
import { APP_PLATFORM_LABELS, APP_STATUS_LABELS } from '../../lib/types';
import { WorkItemCard } from '../../components/WorkItemCard';
import { AppFormModal } from '../../components/AppFormModal';
import { updateClient, deleteClient } from '../../services/firestore';
import { formatDate, getRetainerPeriodStart } from '../../lib/utils';
import { useToast } from '../../hooks/useToast';
import { IconChevronLeft, IconEdit, IconClose, IconCheckSmall, IconTrash } from '../../components/icons';

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

interface ClientDetailProps {
  workItems: WorkItem[];
  clients: Client[];
  apps: App[];
}

export default function ClientDetail({ workItems, clients, apps }: ClientDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const source = clients.find((c) => c.id === id);
  const [client, setClient] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewApp, setShowNewApp] = useState(false);

  useEffect(() => {
    if (source) setClient({ ...source });
  }, [source]);

  const clientItems = useMemo(
    () => workItems.filter((i) => i.clientId === id && i.status !== 'archived'),
    [workItems, id]
  );

  const clientApps = useMemo(
    () => apps.filter(a => a.clientId === client?.id),
    [apps, client?.id]
  );

  const retainerUsage = useMemo(() => {
    if (!client?.retainerHours || !client?.retainerRenewalDay) return null;
    const periodStart = getRetainerPeriodStart(client.retainerRenewalDay);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const usedHours = clientItems
      .filter(
        (i) =>
          i.deductFromRetainer &&
          i.status !== 'draft' &&
          i.updatedAt >= periodStart &&
          i.updatedAt < periodEnd
      )
      .reduce((sum, i) => sum + i.totalHours, 0);

    return {
      total: client.retainerHours,
      used: usedHours,
      remaining: client.retainerHours - usedHours,
      periodStart,
      periodEnd,
      paused: client.retainerPaused ?? false,
    };
  }, [client, clientItems]);

  if (!client) {
    return <div className="text-center py-20 text-[var(--text-secondary)]">Client not found.</div>;
  }

  async function handleSave() {
    if (!client) return;
    setSaving(true);
    try {
      await updateClient(client);
    } catch (err) {
      console.error('Failed to update client:', err);
    }
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (clientApps.length > 0) {
      addToast(`This client has ${clientApps.length} app${clientApps.length !== 1 ? 's' : ''}. Remove or reassign apps before deleting.`, 'error');
      setShowDeleteConfirm(false);
      return;
    }
    await deleteClient(client!.id!);
    navigate('/dashboard/clients');
  }

  return (
    <div className="max-w-4xl animate-fade-in-up">
      {/* Back Button */}
      <button
        onClick={() => navigate('/dashboard/clients')}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] hover:shadow-sm border border-transparent hover:border-[var(--border)] active:scale-[0.97] transition-all mb-5 min-h-[44px]"
      >
        <IconChevronLeft size={16} className="flex-shrink-0" />
        Clients
      </button>

      {/* Client Header */}
      <div className="bg-gradient-to-br from-[#1A1A2E] to-[#444] rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{client.name}</h1>
            <div className="text-sm text-white/70">{client.email}</div>
            {client.company && (
              <div className="text-sm text-white/50">{client.company}</div>
            )}
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 hover:bg-[var(--bg-card)]/10 rounded-xl active:scale-[0.97] transition-all min-h-[44px]"
          >
            {editing ? (
              <>
                <IconClose size={14} />
                Cancel
              </>
            ) : (
              <>
                <IconEdit size={14} />
                Edit
              </>
            )}
          </button>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-white/50">
          <span>{clientItems.length} work items</span>
          <span>Client since {formatDate(client.createdAt)}</span>
          {client.phone && <span>{client.phone}</span>}
        </div>
      </div>

      {/* Retainer Summary */}
      {retainerUsage && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Retainer
            </h2>
            <div className="flex items-center gap-2">
              {retainerUsage.paused && (
                <span className="text-xs font-semibold text-[#E67E22] bg-[#E67E22]/10 px-2.5 py-1 rounded-full">
                  Paused
                </span>
              )}
              {editing && client.retainerHours && (
                <button
                  onClick={() =>
                    setClient({ ...client, retainerPaused: !client.retainerPaused })
                  }
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] min-h-[44px] ${
                    client.retainerPaused
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20'
                      : 'bg-[#E67E22]/10 text-[#E67E22] hover:bg-[#E67E22]/20'
                  }`}
                >
                  {client.retainerPaused ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M4 2.5l8 4.5-8 4.5V2.5z" fill="currentColor" />
                      </svg>
                      Resume
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="3" y="2" width="2.5" height="10" rx="0.5" fill="currentColor" />
                        <rect x="8.5" y="2" width="2.5" height="10" rx="0.5" fill="currentColor" />
                      </svg>
                      Pause
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">
                {retainerUsage.remaining.toFixed(1)}
                <span className="text-sm font-normal text-[var(--text-secondary)]"> hrs remaining</span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                {retainerUsage.used.toFixed(1)} of {retainerUsage.total} hrs used
              </div>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (retainerUsage.used / retainerUsage.total) * 100)}%`,
                    backgroundColor: retainerUsage.used > retainerUsage.total ? '#E74C3C' : '#4BA8A8',
                  }}
                />
              </div>
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-2">
            Period: {formatDate(retainerUsage.periodStart)} — {formatDate(retainerUsage.periodEnd)}
            {' · '}Renews on the {client!.retainerRenewalDay}{ordinalSuffix(client!.retainerRenewalDay!)}
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4 space-y-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">Name</label>
            <input
              type="text"
              value={client.name}
              onChange={(e) => setClient({ ...client, name: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">Email</label>
            <input
              type="email"
              value={client.email}
              onChange={(e) => setClient({ ...client, email: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">Phone</label>
            <input
              type="tel"
              value={client.phone ?? ''}
              onChange={(e) => setClient({ ...client, phone: e.target.value || undefined })}
              className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">Company</label>
            <input
              type="text"
              value={client.company ?? ''}
              onChange={(e) => setClient({ ...client, company: e.target.value || undefined })}
              className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">Notes</label>
            <textarea
              value={client.notes ?? ''}
              onChange={(e) => setClient({ ...client, notes: e.target.value || undefined })}
              rows={3}
              className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] resize-none border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
            />
          </div>

          {/* Retainer Settings */}
          <div className="border-t border-[var(--border)] pt-4">
            <h3 className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide mb-3">
              Retainer
            </h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                  Hours / Month
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={client.retainerHours ?? ''}
                  placeholder="e.g. 10"
                  onChange={(e) =>
                    setClient({
                      ...client,
                      retainerHours: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all min-h-[44px]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                  Renewal Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={client.retainerRenewalDay ?? ''}
                  placeholder="e.g. 1"
                  onChange={(e) =>
                    setClient({
                      ...client,
                      retainerRenewalDay: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all min-h-[44px]"
                />
              </div>
            </div>
            {client.retainerHours && (
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] mt-3">
                <input
                  type="checkbox"
                  checked={client.retainerPaused ?? false}
                  onChange={(e) => setClient({ ...client, retainerPaused: e.target.checked })}
                  className="accent-[#E67E22] w-4 h-4"
                />
                Pause renewal (retainer not active)
              </label>
            )}
          </div>

          {/* Save Button - Full Width */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 active:scale-[0.98] transition-all min-h-[48px] mt-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <IconCheckSmall size={16} />
                Save Changes
              </>
            )}
          </button>

          {/* Delete Button */}
          <div className="border-t border-[var(--border)] pt-4">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 hover:border-red-300 active:scale-[0.97] transition-all min-h-[44px]"
            >
              <IconTrash size={16} />
              Delete Client
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <IconTrash size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Delete this client?</h3>
              <p className="text-sm text-[var(--text-secondary)]">This action cannot be undone. All client data will be permanently removed.</p>
            </div>
            <div className="flex gap-3 p-5 border-t border-[var(--border)]">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] active:scale-[0.98] transition-all min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 active:scale-[0.98] transition-all min-h-[44px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Work Items */}
      <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Work Items ({clientItems.length})
        </h2>
        <div className="space-y-2">
          {clientItems.map((item, i) => (
            <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${200 + Math.min(i, 8) * 50}ms` }}>
              <WorkItemCard
                item={item}
                clientName={client.name}
              />
            </div>
          ))}
        </div>

        {/* Empty State for Work Items */}
        {clientItems.length === 0 && (
          <div className="text-center py-16 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[var(--bg-input)] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-[var(--text-secondary)]/50">
                <rect x="4" y="6" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M4 11h20" stroke="currentColor" strokeWidth="1.8" />
                <path d="M9 16h10M9 19h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">No work items yet</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
              Work items linked to {client.name} will appear here.
            </div>
          </div>
        )}
      </div>

      {/* Apps */}
      <div className="animate-fade-in-up mt-6" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
            Apps
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)] text-[10px] font-bold">
              {clientApps.length}
            </span>
          </h2>
          <button
            onClick={() => setShowNewApp(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 active:scale-[0.97] transition-all min-h-[36px]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add App
          </button>
        </div>

        {clientApps.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clientApps.map((app) => (
              <Link
                key={app.id}
                to={`/dashboard/apps/${app.id}`}
                className="flex items-center gap-3 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-sm active:scale-[0.98] transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{app.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)]">
                      {APP_PLATFORM_LABELS[app.platform]}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      app.status === 'active'
                        ? 'bg-green-500/10 text-green-600'
                        : app.status === 'development'
                        ? 'bg-blue-500/10 text-blue-600'
                        : app.status === 'maintenance'
                        ? 'bg-yellow-500/10 text-yellow-600'
                        : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                    }`}>
                      {APP_STATUS_LABELS[app.status]}
                    </span>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--text-secondary)]/40 flex-shrink-0">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
            <div className="text-sm text-[var(--text-secondary)]">No apps yet</div>
          </div>
        )}
      </div>

      {/* New App Modal */}
      {showNewApp && (
        <AppFormModal
          clients={clients}
          clientId={client.id}
          onClose={() => setShowNewApp(false)}
        />
      )}
    </div>
  );
}
