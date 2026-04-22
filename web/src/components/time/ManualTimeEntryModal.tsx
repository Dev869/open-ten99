import { useMemo, useState } from 'react';
import { createTimeEntry } from '../../services/firestore';
import { useToast } from '../../hooks/useToast';
import { IconClose } from '../icons';
import { cn } from '../../lib/utils';

interface ManualTimeEntryModalProps {
  clientId: string;
  workItemId: string;
  lineItemId: string;
  appId?: string;
  defaultDescription?: string;
  onClose: () => void;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Creates a TimeEntry by hand, attributed to a specific line item. Used
 * when work wasn't captured live by the timer. Produces a real TimeEntry
 * so that a line item's hours always correlate to its tracked time, with
 * no line-item-level overrides.
 */
export function ManualTimeEntryModal({
  clientId,
  workItemId,
  lineItemId,
  appId,
  defaultDescription,
  onClose,
}: ManualTimeEntryModalProps) {
  const { addToast } = useToast();
  const now = useMemo(() => new Date(), []);
  const [date, setDate] = useState(toDateInput(now));
  const [startTime, setStartTime] = useState(
    toTimeInput(new Date(now.getTime() - 60 * 60 * 1000))
  );
  const [hoursStr, setHoursStr] = useState('1.00');
  const [description, setDescription] = useState(defaultDescription ?? '');
  const [isBillable, setIsBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  const hoursNum = parseFloat(hoursStr);
  const isValid =
    !Number.isNaN(hoursNum) && hoursNum > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(startTime);

  const startedAt = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = startTime.split(':').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  }, [date, startTime]);

  const durationSeconds = Number.isFinite(hoursNum) ? Math.max(0, Math.round(hoursNum * 3600)) : 0;
  const endedAt = useMemo(
    () => new Date(startedAt.getTime() + durationSeconds * 1000),
    [startedAt, durationSeconds]
  );

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await createTimeEntry({
        clientId,
        appId,
        workItemId,
        lineItemId,
        description: description.trim(),
        durationSeconds,
        isBillable,
        startedAt,
        endedAt,
      });
      addToast('Time entry added.', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to add manual time entry', err);
      addToast('Could not add time entry. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
  const labelClass = 'text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]';

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-time-entry-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 id="manual-time-entry-title" className="text-sm font-bold text-[var(--text-primary)]">
            Add time manually
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="man-time-date" className={labelClass}>Date</label>
              <input
                id="man-time-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="man-time-start" className={labelClass}>Start time</label>
              <input
                id="man-time-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="man-time-hours" className={labelClass}>Hours</label>
            <input
              id="man-time-hours"
              type="number"
              step="0.25"
              min="0"
              value={hoursStr}
              onChange={(e) => setHoursStr(e.target.value)}
              className={inputClass}
            />
            <div className="text-[10px] text-[var(--text-secondary)]">
              Ends at {endedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="man-time-desc" className={labelClass}>Description</label>
            <input
              id="man-time-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note about this session"
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] select-none cursor-pointer">
            <input
              type="checkbox"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Billable
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer',
              isValid && !saving
                ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]'
                : 'bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-not-allowed'
            )}
          >
            {saving ? 'Adding…' : 'Add time'}
          </button>
        </div>
      </div>
    </>
  );
}
