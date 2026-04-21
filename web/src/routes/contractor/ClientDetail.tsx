import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { WorkItem, Client, App } from '../../lib/types';
import { APP_PLATFORM_LABELS, APP_STATUS_LABELS, APP_STATUS_COLORS } from '../../lib/types';
import { WorkItemCard } from '../../components/workitems/WorkItemCard';
import { AppFormModal } from '../../components/apps/AppFormModal';
import { GitHubImportModal } from '../../components/apps/GitHubImportModal';
import { updateClient, deleteClient } from '../../services/firestore';
import { formatCurrency, formatDate, getRetainerPeriodStart } from '../../lib/utils';
import { calculateMaintenanceUsage } from '../../lib/maintenanceUsage';
import { useAuth } from '../../hooks/useAuth';
import { useGitHubAccounts } from '../../hooks/useFirestore';
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
  hourlyRate: number;
}

export default function ClientDetail({ workItems, clients, apps, hourlyRate }: ClientDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const { accounts: githubAccounts } = useGitHubAccounts(user?.uid);
  const source = clients.find((c) => c.id === id);
  const [client, setClient] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewApp, setShowNewApp] = useState(false);
  const [showGitHubImport, setShowGitHubImport] = useState(false);

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

  const appMap = useMemo(() => {
    const map: Record<string, string> = {};
    apps.forEach((a) => { if (a.id) map[a.id] = a.name; });
    return map;
  }, [apps]);

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

  const maintenanceUsage = useMemo(
    () => (client ? calculateMaintenanceUsage(client, clientItems, hourlyRate) : null),
    [client, clientItems, hourlyRate]
  );

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
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{client.name}</h1>
            <div className="text-sm text-white/70 truncate">{client.email}</div>
            {client.company && (
              <div className="text-sm text-white/50 truncate">{client.company}</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50 mt-3">
          <span>{clientItems.length} work orders</span>
          <span>Client since {formatDate(client.createdAt)}</span>
          {client.phone && <span>{client.phone}</span>}
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="inline-flex items-center gap-2 px-4 py-2 mt-4 text-xs font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 hover:bg-white/5 rounded-xl active:scale-[0.97] transition-all min-h-[44px]"
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

      {/* Retainer Summary */}
      {retainerUsage && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Retainer
            </h2>
            <div className="flex items-center gap-2">
              {retainerUsage.paused && (
                <span className="text-xs font-semibold text-[var(--color-orange)] bg-[var(--color-orange)]/10 px-2.5 py-1 rounded-full">
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
                      : 'bg-[var(--color-orange)]/10 text-[var(--color-orange)] hover:bg-[var(--color-orange)]/20'
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
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">
                {retainerUsage.remaining.toFixed(1)}
                <span className="text-sm font-normal text-[var(--text-secondary)]"> hrs remaining</span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                {retainerUsage.used.toFixed(1)} of {retainerUsage.total} hrs used
              </div>
            </div>
            <div className="flex-1 min-w-0">
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

      {/* Maintenance Summary */}
      {maintenanceUsage && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 mb-4 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Maintenance
            </h2>
            <div className="flex items-center gap-2">
              {maintenanceUsage.paused && (
                <span className="text-xs font-semibold text-[var(--color-orange)] bg-[var(--color-orange)]/10 px-2.5 py-1 rounded-full">
                  Paused
                </span>
              )}
              {maintenanceUsage.overageHours > 0 && !maintenanceUsage.paused && (
                <span className="text-xs font-semibold text-[var(--color-red)] bg-[var(--color-red)]/10 px-2.5 py-1 rounded-full">
                  Over by {maintenanceUsage.overageHours.toFixed(1)} hrs
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">
                {Math.max(0, maintenanceUsage.remaining).toFixed(1)}
                <span className="text-sm font-normal text-[var(--text-secondary)]"> hrs remaining</span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                {maintenanceUsage.used.toFixed(1)} of {maintenanceUsage.allotted} hrs used
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (maintenanceUsage.used / maintenanceUsage.allotted) * 100)}%`,
                    backgroundColor: maintenanceUsage.overageHours > 0 ? '#E74C3C' : '#4BA8A8',
                  }}
                />
              </div>
            </div>
          </div>
          {maintenanceUsage.overageHours > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-[var(--color-red)]/5 border border-[var(--color-red)]/20 text-xs text-[var(--text-primary)]">
              <span className="font-semibold">Overage:</span>{' '}
              {maintenanceUsage.overageHours.toFixed(1)} hrs × ${maintenanceUsage.overageRate.toFixed(2)}/hr ={' '}
              <span className="font-bold">{formatCurrency(maintenanceUsage.overageCost)}</span>
            </div>
          )}
          <div className="text-xs text-[var(--text-secondary)] mt-2">
            Period: {formatDate(maintenanceUsage.periodStart)} — {formatDate(maintenanceUsage.periodEnd)}
            {' · '}Renews on the {client!.maintenanceRenewalDay}{ordinalSuffix(client!.maintenanceRenewalDay!)}
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
                  className="accent-[var(--color-orange)] w-4 h-4"
                />
                Pause renewal (retainer not active)
              </label>
            )}

            {/* Retainer Billing Mode */}
            {client.retainerHours && client.retainerHours > 0 && (
              <>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                    Billing Mode
                  </label>
                  <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-0.5 h-10 items-center">
                    <button
                      type="button"
                      onClick={() => setClient({ ...client, retainerBillingMode: 'flat' })}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        client.retainerBillingMode === 'flat'
                          ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Flat Fee
                    </button>
                    <button
                      type="button"
                      onClick={() => setClient({ ...client, retainerBillingMode: 'usage' })}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        client.retainerBillingMode === 'usage'
                          ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Usage-Based
                    </button>
                  </div>
                </div>
                {client.retainerBillingMode === 'flat' && (
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                      Monthly Flat Rate
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={client.retainerFlatRate ?? ''}
                        onChange={(e) =>
                          setClient({ ...client, retainerFlatRate: e.target.value ? Number(e.target.value) : undefined })
                        }
                        className="w-full h-10 pl-7 pr-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Maintenance Settings */}
          <div className="border-t border-[var(--border)] pt-4">
            <h3 className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide mb-1">
              Maintenance Allotment
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              Maintenance work orders count toward this monthly bucket. Hours beyond the allotment bill at the overage rate.
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                  Hours / Month
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={client.maintenanceHoursAllotted ?? ''}
                  placeholder="e.g. 5"
                  onChange={(e) =>
                    setClient({
                      ...client,
                      maintenanceHoursAllotted: e.target.value ? Number(e.target.value) : undefined,
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
                  value={client.maintenanceRenewalDay ?? ''}
                  placeholder="e.g. 1"
                  onChange={(e) =>
                    setClient({
                      ...client,
                      maintenanceRenewalDay: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-4 py-3 bg-[var(--bg-input)] rounded-xl text-sm text-[var(--text-primary)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all min-h-[44px]"
                />
              </div>
            </div>
            {client.maintenanceHoursAllotted && client.maintenanceHoursAllotted > 0 && (
              <>
                <div className="mt-3">
                  <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                    Overage Rate <span className="normal-case tracking-normal font-normal">(optional — defaults to ${hourlyRate}/hr)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={client.maintenanceOverageRate ?? ''}
                      onChange={(e) =>
                        setClient({
                          ...client,
                          maintenanceOverageRate: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-full h-10 pl-7 pr-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all"
                      placeholder={`${hourlyRate}`}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] mt-3">
                  <input
                    type="checkbox"
                    checked={client.maintenancePaused ?? false}
                    onChange={(e) => setClient({ ...client, maintenancePaused: e.target.checked })}
                    className="accent-[var(--color-orange)] w-4 h-4"
                  />
                  Pause maintenance allotment
                </label>
              </>
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
              className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-[var(--color-red)] border border-[var(--color-red)]/30 hover:bg-[var(--color-red)]/10 active:scale-[0.97] transition-all min-h-[44px]"
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
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
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
                className="flex-1 py-3 rounded-xl bg-[var(--color-red)] text-white text-sm font-semibold hover:brightness-90 active:scale-[0.98] transition-all min-h-[44px]"
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
          Work Orders ({clientItems.length})
        </h2>
        <div className="space-y-2">
          {clientItems.map((item, i) => (
            <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${200 + Math.min(i, 8) * 50}ms` }}>
              <WorkItemCard
                item={item}
                clientName={client.name}
                appName={item.appId ? appMap[item.appId] : undefined}
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
            <div className="text-sm font-semibold text-[var(--text-primary)]">No work orders yet</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
              Work orders linked to {client.name} will appear here.
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
          <div className="flex items-center gap-2">
            {githubAccounts.length > 0 && (
              <button
                onClick={() => setShowGitHubImport(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-input)] active:scale-[0.97] transition-all min-h-[36px]"
                title="Import repositories from GitHub as apps for this client"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
                </svg>
                Import from GitHub
              </button>
            )}
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
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${APP_STATUS_COLORS[app.status]}`}>
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

      {/* GitHub Import Modal (pre-selects this client as default) */}
      {showGitHubImport && (
        <GitHubImportModal
          clients={clients}
          apps={apps}
          defaultClientId={client.id}
          onClose={() => setShowGitHubImport(false)}
        />
      )}
    </div>
  );
}
