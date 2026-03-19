import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { WorkItem, Client } from '../../lib/types';
import { WorkItemCard } from '../../components/WorkItemCard';
import { updateClient, deleteClient } from '../../services/firestore';
import { formatDate, getRetainerPeriodStart } from '../../lib/utils';

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

interface ClientDetailProps {
  workItems: WorkItem[];
  clients: Client[];
}

export default function ClientDetail({ workItems, clients }: ClientDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const source = clients.find((c) => c.id === id);
  const [client, setClient] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (source) setClient({ ...source });
  }, [source]);

  const clientItems = useMemo(
    () => workItems.filter((i) => i.clientId === id && i.status !== 'archived'),
    [workItems, id]
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
    return <div className="text-center py-20 text-[#86868B]">Client not found.</div>;
  }

  function handleSave() {
    if (!client) return;
    updateClient(client).catch(console.error);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this client? This cannot be undone.')) return;
    await deleteClient(client!.id!);
    navigate('/dashboard/clients');
  }

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/dashboard/clients')}
        className="text-sm text-[#86868B] hover:text-[#1A1A2E] mb-4"
      >
        ← Back to Clients
      </button>

      {/* Client Header */}
      <div className="bg-gradient-to-br from-[#1A1A2E] to-[#444] rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#4BA8A8] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
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
            className="text-xs text-white/60 hover:text-white border border-white/20 px-3 py-1.5 rounded-lg"
          >
            {editing ? 'Cancel' : 'Edit'}
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
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider">
              Retainer
            </h2>
            {retainerUsage.paused && (
              <span className="text-xs font-semibold text-[#E67E22] bg-[#E67E22]/10 px-2 py-0.5 rounded-full">
                Paused
              </span>
            )}
          </div>
          <div className="flex items-end gap-6">
            <div>
              <div className="text-2xl font-extrabold text-[#1A1A2E]">
                {retainerUsage.remaining.toFixed(1)}
                <span className="text-sm font-normal text-[#86868B]"> hrs remaining</span>
              </div>
              <div className="text-xs text-[#86868B] mt-1">
                {retainerUsage.used.toFixed(1)} of {retainerUsage.total} hrs used
              </div>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
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
          <div className="text-xs text-[#86868B] mt-2">
            Period: {formatDate(retainerUsage.periodStart)} — {formatDate(retainerUsage.periodEnd)}
            {' · '}Renews on the {client!.retainerRenewalDay}{ordinalSuffix(client!.retainerRenewalDay!)}
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 space-y-3">
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold">Name</label>
            <input
              type="text"
              value={client.name}
              onChange={(e) => setClient({ ...client, name: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold">Email</label>
            <input
              type="email"
              value={client.email}
              onChange={(e) => setClient({ ...client, email: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold">Phone</label>
            <input
              type="tel"
              value={client.phone ?? ''}
              onChange={(e) => setClient({ ...client, phone: e.target.value || undefined })}
              className="w-full mt-1 px-3 py-2.5 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold">Company</label>
            <input
              type="text"
              value={client.company ?? ''}
              onChange={(e) => setClient({ ...client, company: e.target.value || undefined })}
              className="w-full mt-1 px-3 py-2.5 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>
          <div>
            <label className="text-xs text-[#86868B] uppercase font-semibold">Notes</label>
            <textarea
              value={client.notes ?? ''}
              onChange={(e) => setClient({ ...client, notes: e.target.value || undefined })}
              rows={3}
              className="w-full mt-1 px-3 py-2.5 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] resize-none focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
            />
          </div>

          {/* Retainer Settings */}
          <div className="border-t border-[#E5E5EA] pt-3">
            <h3 className="text-xs text-[#86868B] uppercase font-semibold tracking-wide mb-3">
              Retainer
            </h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-[#86868B] uppercase font-semibold">
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
                  className="w-full mt-1 px-3 py-2.5 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#86868B] uppercase font-semibold">
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
                  className="w-full mt-1 px-3 py-2.5 bg-[#F2F2F7] rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4BA8A8]"
                />
              </div>
            </div>
            {client.retainerHours && (
              <label className="flex items-center gap-2 text-sm text-[#1A1A2E] mt-2">
                <input
                  type="checkbox"
                  checked={client.retainerPaused ?? false}
                  onChange={(e) => setClient({ ...client, retainerPaused: e.target.checked })}
                  className="accent-[#E67E22]"
                />
                Pause renewal (retainer not active)
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDelete}
              className="py-2 px-4 rounded-xl border border-red-300 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              Delete Client
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto py-2 px-6 rounded-xl bg-[#4BA8A8] text-white text-sm font-semibold hover:bg-[#3A9090] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Work Items */}
      <div>
        <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider mb-3">
          Work Items ({clientItems.length})
        </h2>
        <div className="space-y-2">
          {clientItems.map((item) => (
            <WorkItemCard
              key={item.id}
              item={item}
              clientName={client.name}
            />
          ))}
        </div>
        {clientItems.length === 0 && (
          <div className="text-center py-12 text-[#86868B] text-sm">
            No work items for this client yet.
          </div>
        )}
      </div>
    </div>
  );
}
