import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Client, App, WorkItem, TimeEntry } from '../../lib/types';
import { useTimeEntries, useClients, useApps, useWorkItems } from '../../hooks/useFirestore';
import { deleteTimeEntry, updateTimeEntry } from '../../services/firestore';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';
import { IconClock, IconEdit, IconTrash, IconDollar } from '../../components/icons';
import { cn, formatDate } from '../../lib/utils';

/* ── Helpers ──────────────────────────────────────────── */

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ── Edit modal ───────────────────────────────────────── */

interface EditTimeEntryModalProps {
  entry: TimeEntry;
  clients: Client[];
  apps: App[];
  workItems: WorkItem[];
  onClose: () => void;
}

function EditTimeEntryModal({ entry, clients, apps, workItems, onClose }: EditTimeEntryModalProps) {
  const { addToast } = useToast();
  const [clientId, setClientId] = useState(entry.clientId);
  const [appId, setAppId] = useState(entry.appId ?? '');
  const [workItemId, setWorkItemId] = useState(entry.workItemId ?? '');
  const [description, setDescription] = useState(entry.description);
  const [isBillable, setIsBillable] = useState(entry.isBillable);
  const [date, setDate] = useState(toDateInput(entry.startedAt));
  const [startTime, setStartTime] = useState(toTimeInput(entry.startedAt));
  const initialHours = (entry.durationSeconds / 3600).toFixed(2);
  const [hoursStr, setHoursStr] = useState(initialHours);
  const [saving, setSaving] = useState(false);

  const filteredApps = apps.filter((a) => a.clientId === clientId);
  const filteredWorkItems = workItems
    .filter((w) => w.clientId === clientId && w.status !== 'archived')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const hoursNum = parseFloat(hoursStr);
  const isValid =
    clientId &&
    !Number.isNaN(hoursNum) &&
    hoursNum > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    /^\d{2}:\d{2}$/.test(startTime);

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const [y, m, d] = date.split('-').map(Number);
      const [hh, mm] = startTime.split(':').map(Number);
      const startedAt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
      const durationSeconds = Math.max(0, Math.round(hoursNum * 3600));
      const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

      await updateTimeEntry(entry.id, {
        clientId,
        appId: appId || null,
        workItemId: workItemId || null,
        lineItemId: workItemId ? entry.lineItemId ?? null : null,
        description,
        durationSeconds,
        isBillable,
        startedAt,
        endedAt,
      });
      addToast('Time entry updated.', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to update time entry', err);
      addToast('Could not update time entry.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all';
  const labelClass =
    'block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5';

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit time entry"
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-[2] h-11 rounded-xl bg-[var(--accent)] text-white text-sm font-bold shadow-sm hover:bg-[var(--accent-dark)] disabled:bg-[var(--border)] disabled:text-[var(--text-secondary)] disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-4">
        <div>
          <label className={labelClass}>Client</label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setAppId('');
              setWorkItemId('');
            }}
            className={inputClass}
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {filteredApps.length > 0 && (
          <div>
            <label className={labelClass}>App</label>
            <select
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className={inputClass}
            >
              <option value="">None</option>
              {filteredApps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>Work order</label>
          <select
            value={workItemId}
            onChange={(e) => setWorkItemId(e.target.value)}
            className={inputClass}
            disabled={!clientId}
          >
            <option value="">Unassigned</option>
            {filteredWorkItems.map((w) => (
              <option key={w.id} value={w.id}>
                {w.subject || '(no subject)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What were you working on?"
            className={cn(inputClass, 'placeholder:text-[var(--text-secondary)]')}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Start</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Hours</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hoursStr}
              onChange={(e) => setHoursStr(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className={labelClass}>Billable</label>
          <button
            type="button"
            role="switch"
            aria-checked={isBillable}
            onClick={() => setIsBillable(!isBillable)}
            className={cn(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              isBillable ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--bg-card)] shadow-sm transition duration-200',
                isBillable ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Page ─────────────────────────────────────────────── */

export default function TimeLogs() {
  const { entries, loading } = useTimeEntries();
  const { clients } = useClients();
  const { apps } = useApps();
  const { workItems } = useWorkItems();
  const { addToast } = useToast();

  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TimeEntry | null>(null);
  const [filterClientId, setFilterClientId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'assigned'>('all');

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id ?? '', c])), [clients]);
  const appById = useMemo(() => new Map(apps.map((a) => [a.id ?? '', a])), [apps]);
  const workItemById = useMemo(() => new Map(workItems.map((w) => [w.id ?? '', w])), [workItems]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterClientId && e.clientId !== filterClientId) return false;
      if (filterStatus === 'unassigned' && e.workItemId) return false;
      if (filterStatus === 'assigned' && !e.workItemId) return false;
      return true;
    });
  }, [entries, filterClientId, filterStatus]);

  const totals = useMemo(() => {
    const seconds = filtered.reduce((s, e) => s + e.durationSeconds, 0);
    const billableSeconds = filtered.filter((e) => e.isBillable).reduce((s, e) => s + e.durationSeconds, 0);
    return {
      total: seconds,
      billable: billableSeconds,
      count: filtered.length,
    };
  }, [filtered]);

  async function handleDelete(entry: TimeEntry) {
    try {
      await deleteTimeEntry(entry.id);
      addToast('Time entry deleted.', 'success');
      setConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete time entry', err);
      addToast('Could not delete time entry.', 'error');
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-6xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <IconClock size={24} />
            Time Logs
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Every tracked session. Edit, reassign, or delete entries.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">Entries</div>
          <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{totals.count}</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">Total time</div>
          <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
            {formatDuration(totals.total)}
          </div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">Billable</div>
          <div className="text-xl font-bold text-[var(--accent)] tabular-nums mt-0.5">
            {formatDuration(totals.billable)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterClientId}
          onChange={(e) => setFilterClientId(e.target.value)}
          className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-1">
          {(['all', 'unassigned', 'assigned'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize',
                filterStatus === s
                  ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-input)] flex items-center justify-center mb-3">
              <IconClock size={20} />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">No time entries yet. Start the timer to track work.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-input)] text-left">
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Date</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Client / App</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Description</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Work order</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] text-right">Duration</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const client = clientById.get(entry.clientId);
                  const app = entry.appId ? appById.get(entry.appId) : undefined;
                  const workItem = entry.workItemId ? workItemById.get(entry.workItemId) : undefined;
                  return (
                    <tr
                      key={entry.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--bg-input)]/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-[var(--text-primary)] whitespace-nowrap">
                        {formatDate(entry.startedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[var(--text-primary)] font-medium">{client?.name ?? 'Unknown'}</div>
                        {app && (
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{app.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] max-w-xs">
                        <div className="truncate">{entry.description || <span className="text-[var(--text-secondary)] italic">—</span>}</div>
                      </td>
                      <td className="px-4 py-3">
                        {workItem ? (
                          <Link
                            to={`/dashboard/work-items/${workItem.id}`}
                            className="text-[var(--accent)] hover:underline truncate inline-block max-w-[200px]"
                          >
                            {workItem.subject || '(no subject)'}
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--text-secondary)] italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                          {formatDuration(entry.durationSeconds)}
                        </div>
                        {entry.isBillable && (
                          <div className="inline-flex items-center gap-0.5 text-[10px] text-[var(--accent)] mt-0.5">
                            <IconDollar size={10} /> Billable
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditing(entry)}
                          className="inline-flex w-7 h-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors"
                          title="Edit"
                          aria-label="Edit time entry"
                        >
                          <IconEdit />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(entry)}
                          className="inline-flex w-7 h-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--color-red,#dc2626)] transition-colors ml-1"
                          title="Delete"
                          aria-label="Delete time entry"
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditTimeEntryModal
          entry={editing}
          clients={clients}
          apps={apps}
          workItems={workItems}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(null)}
          title="Delete time entry?"
          size="sm"
          footer={
            <>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 h-11 rounded-xl bg-[var(--color-red,#dc2626)] text-white text-sm font-bold hover:opacity-90 transition-all"
              >
                Delete
              </button>
            </>
          }
        >
          <div className="px-5 py-5 text-sm text-[var(--text-primary)]">
            This will permanently remove <span className="font-semibold">{formatDuration(confirmDelete.durationSeconds)}</span> logged on {formatDate(confirmDelete.startedAt)}. This can't be undone.
          </div>
        </Modal>
      )}
    </div>
  );
}
