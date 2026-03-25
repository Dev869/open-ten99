import { useState } from 'react';
import type { TimeEntry } from '../lib/types';
import { updateTimeEntry } from '../services/firestore';
import { cn } from '../lib/utils';
import { IconClose } from './icons';

interface TimeEntryLinkPickerProps {
  timeEntries: TimeEntry[];
  clientId: string;
  workItemId: string;
  lineItemId: string;
  onClose: () => void;
}

export function TimeEntryLinkPicker({
  timeEntries,
  clientId,
  workItemId,
  lineItemId,
  onClose,
}: TimeEntryLinkPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showCount, setShowCount] = useState(50);

  // Unlinked entries for this client, most recent first
  const available = timeEntries
    .filter((te) => te.clientId === clientId && !te.workItemId && !te.lineItemId)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const visible = available.slice(0, showCount);
  const hasMore = available.length > showCount;

  function toggleEntry(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          updateTimeEntry(id, { workItemId, lineItemId })
        )
      );
      onClose();
    } catch (err) {
      console.error('Failed to link entries:', err);
    } finally {
      setSaving(false);
    }
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Link Time Entries</h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              No unlinked time entries for this client.
            </div>
          ) : (
            visible.map((entry) => (
              <button
                key={entry.id}
                onClick={() => toggleEntry(entry.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] text-left transition-colors cursor-pointer',
                  selected.has(entry.id)
                    ? 'bg-[var(--accent)]/10'
                    : 'hover:bg-[var(--bg-input)]'
                )}
              >
                {/* Checkbox */}
                <div className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  selected.has(entry.id)
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--border)]'
                )}>
                  {selected.has(entry.id) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Entry info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--text-secondary)]">
                    {entry.startedAt.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    {' \u00b7 '}
                    {entry.startedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {' \u2013 '}
                    {entry.endedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  {entry.description && (
                    <div className="text-sm text-[var(--text-primary)] truncate">{entry.description}</div>
                  )}
                </div>

                {/* Duration */}
                <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums flex-shrink-0">
                  {formatDuration(entry.durationSeconds)}
                </span>
              </button>
            ))
          )}

          {hasMore && (
            <button
              onClick={() => setShowCount((c) => c + 50)}
              className="w-full py-3 text-xs text-[var(--accent)] hover:bg-[var(--bg-input)] transition-colors cursor-pointer"
            >
              Load more ({available.length - showCount} remaining)
            </button>
          )}
        </div>

        {/* Footer */}
        {visible.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-secondary)]">
              {selected.size} selected
            </span>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0 || saving}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer',
                selected.size > 0
                  ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]'
                  : 'bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-not-allowed'
              )}
            >
              {saving ? 'Linking...' : `Link ${selected.size} entr${selected.size === 1 ? 'y' : 'ies'}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
