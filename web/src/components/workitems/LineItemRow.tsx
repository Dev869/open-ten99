import { useState } from 'react';
import type { LineItem, TimeEntry } from '../../lib/types';
import { computeLineItemHours, computeLineItemCost } from '../../lib/timeComputation';
import { formatCurrency } from '../../lib/utils';
import { updateTimeEntry } from '../../services/firestore';
import { useTimeTracker } from '../time/TimeTracker';
import { cn } from '../../lib/utils';
import {
  IconPlay,
  IconPause,
  IconChevronDown,
  IconClose,
} from '../icons';

interface LineItemRowProps {
  lineItem: LineItem;
  workItemId: string;
  clientId: string;
  appId?: string;
  timeEntries: TimeEntry[];
  hourlyRate: number;
  roundToQuarter: boolean;
  onDescriptionChange: (description: string) => void;
  onCostOverrideChange: (costOverride: number | undefined) => void;
  onRemove: () => void;
  onLinkEntries: () => void;
}

export function LineItemRow({
  lineItem,
  workItemId,
  clientId,
  appId,
  timeEntries,
  hourlyRate,
  roundToQuarter,
  onDescriptionChange,
  onCostOverrideChange,
  onRemove,
  onLinkEntries,
}: LineItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState('');
  const timer = useTimeTracker();

  const linkedEntries = timeEntries.filter((te) => te.lineItemId === lineItem.id);
  const hours = computeLineItemHours(timeEntries, lineItem.id, roundToQuarter);
  const cost = computeLineItemCost(hours, hourlyRate, lineItem.costOverride);
  const sessionCount = linkedEntries.length;

  const isTimerRunningForThis = timer.isRunning && timer.lineItemId === lineItem.id;
  const isTimerRunningForOther = timer.isRunning && timer.lineItemId !== lineItem.id;

  function handleStartTimer() {
    if (timer.isRunning) return;
    timer.setClientId(clientId);
    if (appId) timer.setAppId(appId);
    timer.setWorkItemId(workItemId);
    timer.setLineItemId(lineItem.id);
    timer.setDescription(lineItem.description);
    timer.setIsBillable(true);
    timer.handlePlayPause();
    if (!timer.isOpen) timer.toggleOpen();
  }

  function handlePauseTimer() {
    if (isTimerRunningForThis) {
      timer.handlePlayPause();
    }
  }

  async function handleUnlink(entryId: string) {
    await updateTimeEntry(entryId, {
      workItemId: undefined,
      lineItemId: undefined,
    });
  }

  function handleCostClick() {
    setCostInput(lineItem.costOverride !== undefined ? String(lineItem.costOverride) : '');
    setEditingCost(true);
  }

  function handleCostSubmit() {
    const val = parseFloat(costInput);
    onCostOverrideChange(isNaN(val) || costInput === '' ? undefined : val);
    setEditingCost(false);
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  function formatTimeRange(entry: TimeEntry): string {
    const start = entry.startedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const end = entry.endedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const date = entry.startedAt.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${date} \u00b7 ${start} \u2013 ${end}`;
  }

  return (
    <div className="border-b border-[var(--border)]">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Play/pause button */}
        <button
          onClick={isTimerRunningForThis ? handlePauseTimer : handleStartTimer}
          disabled={isTimerRunningForOther}
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer',
            isTimerRunningForThis
              ? 'bg-[var(--accent)] text-white'
              : isTimerRunningForOther
                ? 'bg-[var(--bg-input)] text-[var(--text-secondary)] opacity-40 cursor-not-allowed'
                : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-white'
          )}
          title={
            isTimerRunningForThis
              ? 'Pause timer'
              : isTimerRunningForOther
                ? 'Another timer is running'
                : 'Start timer'
          }
        >
          {isTimerRunningForThis ? <IconPause size={10} /> : <IconPlay size={10} />}
          {isTimerRunningForThis && (
            <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)] animate-ping opacity-30 pointer-events-none" />
          )}
        </button>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={lineItem.description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Line item description..."
            className="w-full text-sm text-[var(--text-primary)] bg-transparent outline-none placeholder:text-[var(--text-secondary)]"
          />
          <div className="text-[11px] text-[var(--text-secondary)]">
            {sessionCount > 0
              ? `${sessionCount} session${sessionCount > 1 ? 's' : ''}${isTimerRunningForThis ? ' + recording now' : ''}`
              : 'No time tracked'}
          </div>
        </div>

        {/* Hours + cost */}
        <div className="text-right flex-shrink-0">
          <div className={cn(
            'text-sm font-bold tabular-nums',
            hours > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
          )}>
            {formatDuration(hours * 3600)}
          </div>
          {editingCost ? (
            <input
              type="number"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              onBlur={handleCostSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleCostSubmit()}
              placeholder="Auto"
              autoFocus
              className="w-20 text-right text-[11px] bg-[var(--bg-input)] border border-[var(--border)] rounded px-1 py-0.5 outline-none focus:border-[var(--accent)]"
            />
          ) : (
            <button
              onClick={handleCostClick}
              className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
              title="Click to override cost"
            >
              {formatCurrency(cost)}
              {lineItem.costOverride !== undefined && (
                <span className="ml-1 text-[9px] text-[var(--accent)]">(manual)</span>
              )}
            </button>
          )}
        </div>

        {/* Expand/remove controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <IconChevronDown
              size={14}
              className={cn('transition-transform', expanded && 'rotate-180')}
            />
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
            title="Remove line item"
          >
            <IconClose size={12} />
          </button>
        </div>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="bg-[var(--bg-page)] px-4 pb-3 pt-1 ml-11 space-y-1">
          {linkedEntries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 py-1.5 text-xs border-b border-[var(--border)] last:border-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] flex-shrink-0" />
              <span className="flex-1 text-[var(--text-secondary)]">{formatTimeRange(entry)}</span>
              <span className="font-semibold text-[var(--text-primary)] tabular-nums">{formatDuration(entry.durationSeconds)}</span>
              <button
                onClick={() => handleUnlink(entry.id)}
                className="text-[10px] text-[var(--text-secondary)] border border-[var(--border)] px-2 py-0.5 rounded hover:text-red-400 hover:border-red-400 transition-colors cursor-pointer"
              >
                Unlink
              </button>
            </div>
          ))}

          {/* Active timer indicator */}
          {isTimerRunningForThis && (
            <div className="flex items-center gap-2 py-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
              <span className="flex-1 text-[var(--accent)]">Now {'\u00b7'} recording</span>
              <span className="font-semibold text-[var(--accent)] tabular-nums">
                {formatDuration(timer.elapsedSeconds)}
              </span>
            </div>
          )}

          {/* Link existing entry button */}
          <button
            onClick={onLinkEntries}
            className="w-full mt-2 py-1.5 text-[11px] text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            + Link existing time entry
          </button>
        </div>
      )}
    </div>
  );
}
