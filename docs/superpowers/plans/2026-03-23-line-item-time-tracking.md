# Line Item Time Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link time tracking to individual line items on work orders so tracked hours replace manual estimates, with cost auto-calculation, manual override, and quarter-hour rounding.

**Architecture:** Extend `TimeEntry` with optional `workItemId`/`lineItemId` fields. Hours are computed live client-side from subscribed time entries — the `LineItem.hours` field is a snapshot persisted on save/PDF only. The global timer context gains optional work order fields so starting from a line item pre-fills client, app, and description.

**Tech Stack:** React 19, TypeScript, Firebase Firestore, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-line-item-time-tracking-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `web/src/lib/timeComputation.ts` | `computeLineItemHours`, `roundToQuarterHour`, `computeLineItemCost` utilities |
| `web/src/lib/__tests__/timeComputation.test.ts` | Unit tests for computation utilities |
| `web/src/components/TimeEntryLinkPicker.tsx` | Modal for picking unlinked time entries to link to a line item |
| `web/src/components/LineItemRow.tsx` | Line item row with play button, expandable time entry breakdown, cost display |

### Modified files

| File | Changes |
|------|---------|
| `web/src/lib/types.ts` | Add `costOverride` to `LineItem`, `workItemId`/`lineItemId` to `TimeEntry`, `roundTimeToQuarterHour` to `AppSettings` |
| `web/src/services/firestore.ts` | Update `docToWorkItem` converter, `lineItemToData`, `createTimeEntry`, add `updateTimeEntry`, `unlinkTimeEntries` |
| `web/src/components/TimeTracker.tsx` | Add `workItemId`/`lineItemId` to context state, clear on stop and client change |
| `web/src/routes/contractor/WorkItemDetail.tsx` | Replace inline line item rendering with `LineItemRow`, wire up timer + linking, update save/PDF flow |
| `web/src/routes/contractor/Settings.tsx` | Add rounding toggle |
| `web/src/lib/buildPdf.ts` | No changes needed — it already reads `li.hours` and `li.cost` from the WorkItem object, which gets populated before PDF generation |

---

## Task 1: Type definitions

**Files:**
- Modify: `web/src/lib/types.ts:1-6` (LineItem), `web/src/lib/types.ts:79-98` (AppSettings), `web/src/lib/types.ts:390-401` (TimeEntry)

- [ ] **Step 1: Add `costOverride` to LineItem**

In `web/src/lib/types.ts`, update the `LineItem` interface at line 1:

```typescript
export interface LineItem {
  id: string;
  description: string;
  hours: number;
  cost: number;
  costOverride?: number;
}
```

- [ ] **Step 2: Add `workItemId` and `lineItemId` to TimeEntry**

In `web/src/lib/types.ts`, update the `TimeEntry` interface at line 390:

```typescript
export interface TimeEntry {
  id: string;
  ownerId: string;
  clientId: string;
  appId?: string;
  description: string;
  durationSeconds: number;
  isBillable: boolean;
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
  updatedAt?: Date;
  workItemId?: string;
  lineItemId?: string;
}
```

- [ ] **Step 3: Add `roundTimeToQuarterHour` to AppSettings**

In `web/src/lib/types.ts`, add to the `AppSettings` interface (around line 79):

```typescript
roundTimeToQuarterHour?: boolean;
```

- [ ] **Step 4: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: PASS with no type errors

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/types.ts
git commit -m "feat: add type definitions for line item time tracking"
```

---

## Task 2: Firestore service layer updates

**Files:**
- Modify: `web/src/services/firestore.ts:47-52` (docToWorkItem), `web/src/services/firestore.ts:255-262` (lineItemToData), `web/src/services/firestore.ts:1302-1361` (time entry functions)

- [ ] **Step 1: Update `docToWorkItem` to preserve `costOverride`**

In `web/src/services/firestore.ts`, update the lineItems mapping at line 47:

```typescript
lineItems: (data.lineItems ?? []).map((li: DocumentData) => ({
  id: li.id ?? crypto.randomUUID(),
  description: li.description ?? '',
  hours: li.hours ?? 0,
  cost: li.cost ?? 0,
  costOverride: li.costOverride ?? undefined,
})),
```

- [ ] **Step 2: Update `lineItemToData` to include `costOverride`**

In `web/src/services/firestore.ts`, update `lineItemToData` at line 255:

```typescript
function lineItemToData(li: LineItem) {
  return {
    id: li.id,
    description: li.description,
    hours: li.hours,
    cost: li.cost,
    ...(li.costOverride !== undefined && { costOverride: li.costOverride }),
  };
}
```

- [ ] **Step 3: Update `docToTimeEntry` to read `workItemId` and `lineItemId`**

In `web/src/services/firestore.ts`, update `docToTimeEntry` at line 1302 to include:

```typescript
updatedAt: data.updatedAt?.toDate() ?? undefined,
workItemId: data.workItemId ?? undefined,
lineItemId: data.lineItemId ?? undefined,
```

- [ ] **Step 4: Update `createTimeEntry` to write `workItemId` and `lineItemId`**

In `web/src/services/firestore.ts`, update `createTimeEntry` at line 1342. The function currently accepts a partial payload — add the new fields to what gets written:

```typescript
...(entry.workItemId && { workItemId: entry.workItemId }),
...(entry.lineItemId && { lineItemId: entry.lineItemId }),
```

- [ ] **Step 5: Add `updateTimeEntry` function**

In `web/src/services/firestore.ts`, add after `createTimeEntry`:

```typescript
export async function updateTimeEntry(
  id: string,
  updates: Partial<Pick<TimeEntry, 'workItemId' | 'lineItemId'>>
): Promise<void> {
  const ref = doc(db, 'timeEntries', id);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
```

- [ ] **Step 6: Add `unlinkTimeEntriesForLineItem` function**

In `web/src/services/firestore.ts`, add after `updateTimeEntry`:

```typescript
export async function unlinkTimeEntriesForLineItem(
  timeEntries: TimeEntry[],
  lineItemId: string
): Promise<void> {
  const batch = writeBatch(db);
  const matching = timeEntries.filter((te) => te.lineItemId === lineItemId);
  for (const te of matching) {
    const ref = doc(db, 'timeEntries', te.id);
    batch.update(ref, {
      workItemId: deleteField(),
      lineItemId: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
```

Import `deleteField` from `firebase/firestore` if not already imported.

- [ ] **Step 7: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add web/src/services/firestore.ts
git commit -m "feat: update firestore service for line item time tracking"
```

---

## Task 3: Time computation utilities (TDD)

**Files:**
- Create: `web/src/lib/timeComputation.ts`
- Create: `web/src/lib/__tests__/timeComputation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/src/lib/__tests__/timeComputation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  roundToQuarterHour,
  computeLineItemHours,
  computeLineItemCost,
} from '../timeComputation';
import type { TimeEntry } from '../types';

function makeEntry(overrides: Partial<TimeEntry> & { durationSeconds: number; lineItemId?: string }): TimeEntry {
  return {
    id: crypto.randomUUID(),
    ownerId: 'owner1',
    clientId: 'client1',
    description: '',
    isBillable: true,
    startedAt: new Date(),
    endedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('roundToQuarterHour', () => {
  it('returns 0 for 0 seconds', () => {
    expect(roundToQuarterHour(0)).toBe(0);
  });

  it('rounds down 1-7 minutes past a quarter boundary', () => {
    // 22 minutes = 15 + 7 → round down to 15 min = 0.25h
    expect(roundToQuarterHour(22 * 60)).toBe(0.25);
  });

  it('rounds up 8-14 minutes past a quarter boundary', () => {
    // 23 minutes = 15 + 8 → round up to 30 min = 0.5h
    expect(roundToQuarterHour(23 * 60)).toBe(0.5);
  });

  it('does not change exact quarter boundaries', () => {
    expect(roundToQuarterHour(15 * 60)).toBe(0.25);
    expect(roundToQuarterHour(30 * 60)).toBe(0.5);
    expect(roundToQuarterHour(45 * 60)).toBe(0.75);
    expect(roundToQuarterHour(60 * 60)).toBe(1);
  });

  it('handles 2h 22m → 2h 15m (spec example)', () => {
    expect(roundToQuarterHour(142 * 60)).toBe(2.25);
  });

  it('handles 2h 23m → 2h 30m (spec example)', () => {
    expect(roundToQuarterHour(143 * 60)).toBe(2.5);
  });

  it('rounds down at exactly 7 minutes past', () => {
    // 7 minutes = 0 + 7 → round down to 0
    expect(roundToQuarterHour(7 * 60)).toBe(0);
  });

  it('rounds up at exactly 8 minutes past', () => {
    // 8 minutes = 0 + 8 → round up to 15 min
    expect(roundToQuarterHour(8 * 60)).toBe(0.25);
  });
});

describe('computeLineItemHours', () => {
  it('returns 0 when no entries match', () => {
    const entries = [makeEntry({ durationSeconds: 3600, lineItemId: 'other' })];
    expect(computeLineItemHours(entries, 'target', false)).toBe(0);
  });

  it('sums matching entries and converts to hours', () => {
    const entries = [
      makeEntry({ durationSeconds: 3600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 1800, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 3600, lineItemId: 'other' }),
    ];
    expect(computeLineItemHours(entries, 'target', false)).toBeCloseTo(1.5);
  });

  it('applies rounding when enabled', () => {
    // 3 entries of 10 min each = 30 min total → 0.5h (already on boundary)
    const entries = [
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
    ];
    expect(computeLineItemHours(entries, 'target', true)).toBe(0.5);
  });

  it('applies rounding to aggregate sum not per-entry', () => {
    // 3 entries of 10 min = 30 min → 0.5h exact
    // If rounded per-entry: each 10 min → 8 rounds up to 15 → 45 min = 0.75h
    // Aggregate: 30 min → 0.5h (exact boundary)
    const entries = [
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
      makeEntry({ durationSeconds: 600, lineItemId: 'target' }),
    ];
    expect(computeLineItemHours(entries, 'target', true)).toBe(0.5);
  });
});

describe('computeLineItemCost', () => {
  it('returns hours × hourlyRate when no override', () => {
    expect(computeLineItemCost(2.5, 75, undefined)).toBe(187.5);
  });

  it('returns costOverride when set', () => {
    expect(computeLineItemCost(2.5, 75, 200)).toBe(200);
  });

  it('returns 0 when hours are 0 and no override', () => {
    expect(computeLineItemCost(0, 75, undefined)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/lib/__tests__/timeComputation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the utilities**

Create `web/src/lib/timeComputation.ts`:

```typescript
import type { TimeEntry } from './types';

/**
 * Round total seconds to the nearest quarter hour.
 * 1-7 min past boundary → round down. 8-14 min → round up. 0 min → no change.
 */
export function roundToQuarterHour(totalSeconds: number): number {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const quarterMinutes = 15;
  const remainder = totalMinutes % quarterMinutes;
  const base = totalMinutes - remainder;

  if (remainder === 0) return base / 60;
  if (remainder <= 7) return base / 60;
  return (base + quarterMinutes) / 60;
}

/**
 * Compute total hours for a line item from its linked time entries.
 * Filters by lineItemId, sums durationSeconds, optionally rounds to quarter hour.
 */
export function computeLineItemHours(
  timeEntries: TimeEntry[],
  lineItemId: string,
  roundToQuarter: boolean
): number {
  const totalSeconds = timeEntries
    .filter((te) => te.lineItemId === lineItemId)
    .reduce((sum, te) => sum + te.durationSeconds, 0);

  if (totalSeconds === 0) return 0;
  if (roundToQuarter) return roundToQuarterHour(totalSeconds);
  return totalSeconds / 3600;
}

/**
 * Compute cost for a line item. Uses costOverride if set, otherwise hours × rate.
 */
export function computeLineItemCost(
  hours: number,
  hourlyRate: number,
  costOverride: number | undefined
): number {
  if (costOverride !== undefined) return costOverride;
  return hours * hourlyRate;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/lib/__tests__/timeComputation.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/timeComputation.ts web/src/lib/__tests__/timeComputation.test.ts
git commit -m "feat: add time computation utilities with quarter-hour rounding"
```

---

## Task 4: TimeTracker context — add work order fields

**Files:**
- Modify: `web/src/components/TimeTracker.tsx:10-28` (interface), `web/src/components/TimeTracker.tsx:53-119` (provider), `web/src/components/TimeTracker.tsx:89-107` (handleStop)

- [ ] **Step 1: Add workItemId and lineItemId to TimeTrackerState interface**

In `web/src/components/TimeTracker.tsx`, update the `TimeTrackerState` interface at line 10 to add after the existing fields:

```typescript
workItemId?: string;
lineItemId?: string;
setWorkItemId: (id: string | undefined) => void;
setLineItemId: (id: string | undefined) => void;
```

- [ ] **Step 2: Add state variables to TimeTrackerProvider**

In `TimeTrackerProvider` (line 53), add state declarations near the other `useState` calls:

```typescript
const [workItemId, setWorkItemId] = useState<string | undefined>(undefined);
const [lineItemId, setLineItemId] = useState<string | undefined>(undefined);
```

- [ ] **Step 3: Add to stateRef**

Update the `stateRef` at line 77 to include the new fields:

```typescript
const stateRef = useRef({ clientId, appId, description, elapsedSeconds, isBillable, workItemId, lineItemId });
stateRef.current = { clientId, appId, description, elapsedSeconds, isBillable, workItemId, lineItemId };
```

- [ ] **Step 4: Update handleStop to include and clear the new fields**

In `handleStop` (line 89), update the `createTimeEntry` call to include:

```typescript
workItemId: wId || undefined,
lineItemId: lId || undefined,
```

(extracting `wId` and `lId` from `stateRef.current` alongside the existing destructuring)

After the reset block, add:

```typescript
setWorkItemId(undefined);
setLineItemId(undefined);
```

- [ ] **Step 5: Clear workItemId/lineItemId when client changes**

In the existing `setClientId` handler used in the timer bar's client dropdown (`onChange`), after `setAppId('')`, also call:

```typescript
setWorkItemId(undefined);
setLineItemId(undefined);
```

The simplest approach: wrap `setClientId` in the provider so that changing client always clears work order context. Add a wrapper function in the provider:

```typescript
const handleSetClientId = useCallback((id: string) => {
  setClientId(id);
  setAppId('');
  setWorkItemId(undefined);
  setLineItemId(undefined);
}, []);
```

Expose `handleSetClientId` as `setClientId` in the context value.

- [ ] **Step 6: Update context value object**

At lines 112-115, add the new fields and setters to the context value:

```typescript
workItemId, lineItemId, setWorkItemId, setLineItemId,
```

- [ ] **Step 7: Export useTimeTracker hook**

Ensure `useTimeTracker` is exported (add `export` if it's not already):

```typescript
export function useTimeTracker() {
```

This allows `LineItemRow` and `WorkItemDetail` to access the timer context.

- [ ] **Step 8: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add web/src/components/TimeTracker.tsx
git commit -m "feat: add work order context to time tracker"
```

---

## Task 5: LineItemRow component

**Files:**
- Create: `web/src/components/LineItemRow.tsx`

This component replaces the inline line item rendering in WorkItemDetail. It shows the play button, description, tracked hours, cost, expandable breakdown, and link/unlink controls.

- [ ] **Step 1: Create the component**

Create `web/src/components/LineItemRow.tsx`:

```typescript
import { useState } from 'react';
import type { LineItem, TimeEntry } from '../lib/types';
import { computeLineItemHours, computeLineItemCost } from '../lib/timeComputation';
import { formatCurrency } from '../lib/utils';
import { updateTimeEntry } from '../services/firestore';
import { useTimeTracker } from './TimeTracker';
import { cn } from '../lib/utils';
import {
  IconPlay,
  IconPause,
  IconChevronDown,
  IconClose,
} from './icons';

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
              <span className="flex-1 text-[var(--accent)]">Now \u00b7 recording</span>
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
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/components/LineItemRow.tsx
git commit -m "feat: add LineItemRow component with timer and time entry breakdown"
```

---

## Task 6: TimeEntryLinkPicker component

**Files:**
- Create: `web/src/components/TimeEntryLinkPicker.tsx`

- [ ] **Step 1: Create the modal component**

Create `web/src/components/TimeEntryLinkPicker.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TimeEntryLinkPicker.tsx
git commit -m "feat: add time entry link picker modal"
```

---

## Task 7: Wire up WorkItemDetail with new components

**Files:**
- Modify: `web/src/routes/contractor/WorkItemDetail.tsx`

This is the integration task. WorkItemDetail needs to:
1. Accept `timeEntries` as a prop (subscribed from the parent)
2. Replace inline line item rendering with `LineItemRow`
3. Use `computeLineItemHours` for totals
4. Handle the link picker modal state
5. Update save and PDF generation to write back computed hours
6. Handle line item deletion with linked entries

- [ ] **Step 1: Add timeEntries and settings to WorkItemDetailProps**

In `web/src/routes/contractor/WorkItemDetail.tsx`, update the props interface at line 17:

```typescript
interface WorkItemDetailProps {
  workItems: WorkItem[];
  clients: Client[];
  hourlyRate: number;
  paymentTerms?: string;
  taxRate?: number;
  pdfLogoUrl?: string;
  invoiceFromAddress?: string;
  invoiceTerms?: string;
  invoiceNotes?: string;
  timeEntries: TimeEntry[];
  roundTimeToQuarterHour?: boolean;
}
```

Add the corresponding destructuring in the function signature.

- [ ] **Step 2: Add imports**

Add to the imports at the top of the file:

```typescript
import type { TimeEntry } from '../../lib/types';
import { LineItemRow } from '../../components/LineItemRow';
import { TimeEntryLinkPicker } from '../../components/TimeEntryLinkPicker';
import { computeLineItemHours, computeLineItemCost } from '../../lib/timeComputation';
import { unlinkTimeEntriesForLineItem } from '../../services/firestore';
```

- [ ] **Step 3: Add link picker state**

Inside the component function, add state for the picker modal:

```typescript
const [linkPickerLineItemId, setLinkPickerLineItemId] = useState<string | null>(null);
```

- [ ] **Step 4: Update removeLineItem to handle linked entries**

Replace the existing `removeLineItem` function (line 88) with:

```typescript
async function removeLineItem(index: number) {
  const li = item!.lineItems[index];
  const linkedCount = timeEntries.filter((te) => te.lineItemId === li.id).length;

  if (linkedCount > 0) {
    const confirmed = window.confirm(
      `This line item has ${linkedCount} linked time entr${linkedCount === 1 ? 'y' : 'ies'}. Deleting it will unlink them. Continue?`
    );
    if (!confirmed) return;
    await unlinkTimeEntriesForLineItem(timeEntries, li.id);
  }

  const updated = item!.lineItems.filter((_, i) => i !== index);
  const totalHours = updated.reduce(
    (s, ul) => s + computeLineItemHours(timeEntries, ul.id, roundTimeToQuarterHour ?? false),
    0
  );
  const totalCost = updated.reduce(
    (s, ul) => s + computeLineItemCost(
      computeLineItemHours(timeEntries, ul.id, roundTimeToQuarterHour ?? false),
      hourlyRate,
      ul.costOverride
    ),
    0
  );
  setItem({ ...item!, lineItems: updated, totalHours, totalCost });
}
```

- [ ] **Step 5: Add helper to compute totals from time entries**

Add a function to recompute totals for the current line items:

```typescript
function computeTotals(lineItems: LineItem[]) {
  const totalHours = lineItems.reduce(
    (s, li) => s + computeLineItemHours(timeEntries, li.id, roundTimeToQuarterHour ?? false),
    0
  );
  const totalCost = lineItems.reduce(
    (s, li) => s + computeLineItemCost(
      computeLineItemHours(timeEntries, li.id, roundTimeToQuarterHour ?? false),
      hourlyRate,
      li.costOverride
    ),
    0
  );
  return { totalHours, totalCost };
}
```

- [ ] **Step 6: Update handleSave to write back computed hours**

Before the existing `await updateWorkItem(item!)` call in `handleSave` (line 98), add:

```typescript
const updatedLineItems = item!.lineItems.map((li) => {
  const hours = computeLineItemHours(timeEntries, li.id, roundTimeToQuarterHour ?? false);
  const cost = computeLineItemCost(hours, hourlyRate, li.costOverride);
  return { ...li, hours, cost };
});
const { totalHours, totalCost } = computeTotals(item!.lineItems);
const toSave = { ...item!, lineItems: updatedLineItems, totalHours, totalCost };
```

Then save `toSave` instead of `item!`.

- [ ] **Step 7: Update PDF generation handler**

In `handleApproveAndGenerate` (line 106), before calling `buildChangeOrderPdf`, compute and write back hours the same way as save. Extract a shared helper:

```typescript
function buildSnapshotItem(): WorkItem {
  const updatedLineItems = item!.lineItems.map((li) => {
    const hours = computeLineItemHours(timeEntries, li.id, roundTimeToQuarterHour ?? false);
    const cost = computeLineItemCost(hours, hourlyRate, li.costOverride);
    return { ...li, hours, cost };
  });
  const { totalHours, totalCost } = computeTotals(item!.lineItems);
  return { ...item!, lineItems: updatedLineItems, totalHours, totalCost };
}
```

Use `buildSnapshotItem()` in both `handleSave` and `handleApproveAndGenerate`. In the PDF handler, persist the snapshot to Firestore first — if the write fails, show an error and abort PDF generation:

```typescript
const snapshot = buildSnapshotItem();
try {
  await updateWorkItem(snapshot);
} catch (err) {
  console.error('Failed to persist snapshot:', err);
  // Show error to user — do NOT proceed with PDF
  return;
}
const pdf = await buildChangeOrderPdf(snapshot, pdfClient, { ... });
```

- [ ] **Step 8: Update handleSendToClient to use computed hours**

The existing `handleSendToClient` builds the email body using `li.hours` and `li.cost` directly from the embedded `LineItem`. Update it to compute live hours before building the email body, using the same `buildSnapshotItem()` helper:

```typescript
const snapshot = buildSnapshotItem();
// Use snapshot.lineItems for email body generation
```

- [ ] **Step 9: Replace inline line item rendering with LineItemRow**

In the JSX where line items are rendered (around line 339), replace the existing map with:

```tsx
{item.lineItems.map((li, index) => (
  <LineItemRow
    key={li.id}
    lineItem={li}
    workItemId={item.id!}
    clientId={item.clientId}
    appId={item.appId}
    timeEntries={timeEntries}
    hourlyRate={hourlyRate}
    roundToQuarter={roundTimeToQuarterHour ?? false}
    onDescriptionChange={(desc) => {
      const updated = [...item.lineItems];
      updated[index] = { ...updated[index], description: desc };
      setItem({ ...item, lineItems: updated });
    }}
    onCostOverrideChange={(override) => {
      const updated = [...item.lineItems];
      updated[index] = { ...updated[index], costOverride: override };
      const { totalHours, totalCost } = computeTotals(updated);
      setItem({ ...item, lineItems: updated, totalHours, totalCost });
    }}
    onRemove={() => removeLineItem(index)}
    onLinkEntries={() => setLinkPickerLineItemId(li.id)}
  />
))}
```

- [ ] **Step 10: Add link picker modal**

After the line items section in the JSX, add:

```tsx
{linkPickerLineItemId && (
  <TimeEntryLinkPicker
    timeEntries={timeEntries}
    clientId={item.clientId}
    workItemId={item.id!}
    lineItemId={linkPickerLineItemId}
    onClose={() => setLinkPickerLineItemId(null)}
  />
)}
```

- [ ] **Step 11: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add web/src/routes/contractor/WorkItemDetail.tsx
git commit -m "feat: integrate LineItemRow and time entry linking in WorkItemDetail"
```

---

## Task 8: Pass timeEntries to WorkItemDetail from parent

**Files:**
- Modify: `web/src/App.tsx` (or whichever parent renders `WorkItemDetail`)

- [ ] **Step 1: Find where WorkItemDetail is rendered**

Search for `<WorkItemDetail` in the codebase to find the parent that passes props. This is likely `web/src/App.tsx`.

- [ ] **Step 2: Import and subscribe to time entries**

In the parent component (e.g., `App.tsx`), add the `useTimeEntries` hook import:

```typescript
import { useWorkItems, useClients, useSettings, useApps, useTimeEntries } from './hooks/useFirestore';
```

Call the hook inside the component alongside the existing hooks:

```typescript
const { timeEntries } = useTimeEntries(user?.uid);
```

If `useTimeEntries` does not exist in `useFirestore.ts`, create it following the same pattern as `useWorkItems`:

```typescript
export function useTimeEntries(userId: string | undefined) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeTimeEntries(userId, (entries) => {
      setTimeEntries(entries);
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  return { timeEntries, loading };
}
```

- [ ] **Step 3: Pass timeEntries and settings to WorkItemDetail**

```tsx
<WorkItemDetail
  {...existingProps}
  timeEntries={timeEntries}
  roundTimeToQuarterHour={settings?.roundTimeToQuarterHour}
/>
```

- [ ] **Step 4: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/hooks/useFirestore.ts
git commit -m "feat: wire time entries subscription to WorkItemDetail"
```

---

## Task 9: Settings page — rounding toggle

**Files:**
- Modify: `web/src/routes/contractor/Settings.tsx`

- [ ] **Step 1: Add the rounding toggle to the settings form**

In the settings page component, add a toggle after the existing settings fields:

```tsx
{/* Time Rounding */}
<div className="flex items-center justify-between">
  <div>
    <label className="block text-sm font-semibold text-[var(--text-primary)]">
      Round time to quarter hour
    </label>
    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
      Rounds tracked time: 1-7 min down, 8-14 min up to nearest 15 min
    </p>
  </div>
  <button
    type="button"
    role="switch"
    aria-checked={settings.roundTimeToQuarterHour ?? false}
    onClick={() => updateSettings({ roundTimeToQuarterHour: !(settings.roundTimeToQuarterHour ?? false) })}
    className={cn(
      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
      (settings.roundTimeToQuarterHour ?? false) ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
    )}
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--bg-card)] shadow-sm transition duration-200',
        (settings.roundTimeToQuarterHour ?? false) ? 'translate-x-5' : 'translate-x-0'
      )}
    />
  </button>
</div>
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/contractor/Settings.tsx
git commit -m "feat: add quarter-hour rounding toggle to settings"
```

---

## Task 10: Manual testing and polish

- [ ] **Step 1: Start dev server**

Run: `cd web && npm run dev`

- [ ] **Step 2: Test timer from line item**

1. Open a work order with line items
2. Click play on a line item — verify timer starts with client/app/description pre-filled
3. Stop timer — verify time entry appears in line item breakdown
4. Verify hours and cost update

- [ ] **Step 3: Test retroactive linking**

1. Create a standalone time entry (no work order context)
2. Open a work order, expand a line item, click "Link existing time entry"
3. Verify the picker shows unlinked entries for the same client
4. Select and confirm — verify hours update

- [ ] **Step 4: Test unlinking**

1. Expand a line item with linked entries
2. Click "Unlink" on an entry
3. Verify hours recalculate

- [ ] **Step 5: Test cost override**

1. Click on the cost amount for a line item
2. Enter a manual value, press Enter
3. Verify "(manual)" indicator appears
4. Clear the input and submit — verify it reverts to auto-calc

- [ ] **Step 6: Test rounding**

1. Go to Settings, enable quarter-hour rounding
2. Return to a work order with tracked time
3. Verify hours display rounds correctly

- [ ] **Step 7: Test line item deletion with linked entries**

1. Create a line item, link time entries to it
2. Delete the line item
3. Verify confirmation dialog appears with entry count
4. Confirm — verify time entries are unlinked

- [ ] **Step 8: Test PDF generation**

1. Generate a PDF for a work order with tracked time
2. Verify the PDF shows correct hours and costs

- [ ] **Step 9: Final commit**

Stage only the files that were modified during polish, then commit.

---

## Deferred: "From a time entry" linking direction

The spec describes a "Link to Work Order" action accessible from the time entries list/detail view. This is deferred from this plan because no dedicated time entries list route exists yet. When that route is built, add:

1. A "Link to Work Order" button on each unlinked time entry
2. A two-step picker: select work order (filtered by client, excluding `discardedAt` entries) → select line item
3. Write `workItemId` + `lineItemId` on the time entry

The `updateTimeEntry` function created in Task 2 already supports this — only the UI is missing.
