# Line Item Time Tracking

## Summary

Link time tracking to individual line items on work orders. Contractors can start a timer directly from a line item (pre-filling client, app, and description into the global timer) or retroactively link existing time entries to line items. Line item hours are computed from tracked time — no manual estimates. Cost auto-calculates as `trackedHours x hourlyRate` with an optional manual override per line item. A global setting enables rounding tracked time to the nearest quarter hour.

## Data Model Changes

### TimeEntry (existing collection — add two optional fields)

```typescript
interface TimeEntry {
  // ...existing fields (id, ownerId, clientId, appId, description,
  //   durationSeconds, isBillable, startedAt, endedAt, createdAt)
  workItemId?: string;   // links to parent work order
  lineItemId?: string;   // links to specific line item within that work order
}
```

### LineItem (embedded in WorkItem — add cost override)

```typescript
interface LineItem {
  id: string;
  description: string;
  hours: number;          // persisted for backward compat and PDF snapshots only
  cost: number;           // persisted for backward compat and PDF snapshots only
  costOverride?: number;  // when set, replaces auto-calculated cost
}
```

**Source of truth for hours:** Always computed live from linked `timeEntries` via `computeLineItemHours`. The persisted `hours` and `cost` fields on the embedded `LineItem` are **snapshots** — they are written back to Firestore on work order save and before PDF generation, but the live subscription data is authoritative for display. This means `docToWorkItem` and `updateLineItem` must preserve `costOverride` through round-trips.

### AppSettings (existing document — add rounding toggle)

```typescript
interface AppSettings {
  // ...existing fields
  roundTimeToQuarterHour?: boolean;  // global default
}
```

### TimeTrackerState (React context — add work order context)

```typescript
interface TimeTrackerState {
  // ...existing fields
  workItemId?: string;
  lineItemId?: string;
  setWorkItemId: (id: string | undefined) => void;
  setLineItemId: (id: string | undefined) => void;
}
```

These fields are optional — the timer works without them (standalone time tracking). `handleStop` must clear both fields (set to `undefined`) along with the other state resets to prevent stale context leaking into the next session. When the user changes the client in the timer bar mid-session, `workItemId` and `lineItemId` should also be cleared since the work order context is no longer valid.

No new Firestore collections. No Firestore rule changes needed.

## Timer Integration (Starting from a Line Item)

When the user taps the play button on a line item:

1. Pre-fill the global timer context with `clientId`, `appId`, `workItemId`, and `lineItemId` from the work order.
2. Auto-set the timer description to the line item's description text.
3. Open the timer bar (existing UI, now showing work order context).
4. Timer runs as normal — play/pause/stop all work the same.

When the timer stops:

1. `createTimeEntry()` saves with `workItemId` and `lineItemId` included.
2. The line item's tracked hours update in real-time via the existing `onSnapshot` subscription to `timeEntries`.
3. Cost auto-calculates as `trackedHours x hourlyRate` (unless `costOverride` is set).

Edge cases:

- **Timer already running for a different line item:** Prompt the user to stop the current timer first or discard and start a new one.
- **Play/pause button on a line item when the global timer is running without line item context:** The button is disabled/hidden — each line item's play button only controls timers associated with that specific line item.

## Retroactive Linking

### From a line item

"Link existing time entry" button in the expanded breakdown view:

1. Opens a picker showing unlinked time entries for the same client.
2. Filtered by client match, sorted most recent first.
3. Each entry shows date, duration, and description.
4. Select one or more entries — writes `workItemId` + `lineItemId` onto those time entry documents.
5. Line item hours recalculate immediately.

### From a time entry

"Link to Work Order" action in the time entries list/detail:

1. Pick a work order (filtered by same client).
2. Pick a line item within that work order.
3. Saves `workItemId` + `lineItemId` on the time entry.

### Unlinking

"Unlink" button on each time entry in the expanded breakdown:

1. Clears `workItemId` and `lineItemId` from the time entry document.
2. Hours recalculate immediately.

### Re-assigning

To move a time entry from one line item to another, the user must first unlink it (via the "Unlink" button in the expanded breakdown), then re-link it from the target line item's picker. This is intentional — prevents accidental re-assignment.

## Hours Computation & Display

### Utility function: `computeLineItemHours`

1. Takes all subscribed time entries + a `lineItemId`.
2. Filters entries where `lineItemId` matches.
3. Sums `durationSeconds` across all matching entries.
4. If `roundTimeToQuarterHour` is enabled in settings, applies rounding.
5. Returns hours as a number.

### Rounding logic (quarter-hour)

When enabled in global settings, rounding is applied **once to the aggregate sum** of all linked entries for a line item — not per individual entry.

- Sum all linked `durationSeconds` first, then convert total to minutes.
- Find remainder within each 15-minute block.
- 0 minutes remainder: no change (already on a quarter boundary).
- 1-7 minutes past a quarter boundary: round down.
- 8-14 minutes past a quarter boundary: round up.
- Example: 2h 22m becomes 2h 15m. 2h 23m becomes 2h 30m.

### Line item row display

- Primary: rolled-up total (e.g., "4h 23m").
- Secondary: session count (e.g., "3 sessions").
- Expand chevron reveals individual time entries with date, time range, duration, and "Unlink" button.
- Active timer shows pulsing indicator and "recording now" with live elapsed time.

### Cost display

- Default: `computedHours x hourlyRate`.
- If `costOverride` is set: shows override value with indicator that it's manual.
- Click cost to edit — entering a value sets `costOverride`, clearing it reverts to auto-calc.

### Work order totals

- `totalHours` = sum of all line items' computed hours.
- `totalCost` = sum of all line items' cost (respecting overrides).

### PDF generation

Before building a PDF, the caller must:

1. Compute live hours for each line item via `computeLineItemHours` using the current `timeEntries` subscription.
2. Write computed `hours` and `cost` (respecting `costOverride`) back onto each `LineItem` in the work item object.
3. Pass the updated work item to `buildChangeOrderPdf()`.

This ensures the PDF always reflects current tracked time. The write-back also persists the snapshot to Firestore so the work order document has a consistent record. If the Firestore write-back fails, surface the error to the user and do not generate the PDF — this prevents the PDF from showing data that diverges from the stored document.

### Hourly rate

Cost is computed as `computedHours x hourlyRate` where `hourlyRate` comes from the global `AppSettings.hourlyRate`. Cost is recomputed live on every render from the current settings value. When `costOverride` is set on a line item, the hourly rate is irrelevant for that line item.

### Active timer exclusion

The rolled-up hours total for a line item includes only committed time entries (saved to Firestore). The currently active timer session is shown separately as "recording now" in the expanded breakdown but is **not** included in the hours total or cost calculation until the timer is stopped and the entry is saved.

## UI Components

### Line item row (WorkItemDetail)

Each line item shows:

- Play/pause button (left) — shows play when no timer is running; shows pause when the global timer is running for *this* line item; hidden/disabled when the global timer is running for a different line item or without line item context.
- Description text.
- Session count subtitle.
- Tracked hours + cost (right).
- Expand chevron to reveal time entry breakdown.

### Expanded time entry breakdown

Below the line item row when expanded:

- List of linked time entries: date, time range, duration, "Unlink" button.
- Active timer entry with pulsing indicator and live elapsed time.
- "Link existing time entry" dashed button at bottom.

### Time entry linking picker

Modal/popover for selecting unlinked time entries:

- Filtered to same client as work order, most recent 50 entries by default.
- "Load more" button to fetch older entries if needed.
- Shows date, duration, and description for each entry.
- Multi-select with confirm action.

### Settings toggle

In the settings page, a toggle for "Round time to nearest quarter hour" with explanation text about the 1-7/8-14 rounding rule.

## Edge Cases

### Deleting a line item with linked time entries

When a user deletes a line item that has linked time entries, show a confirmation dialog: "This line item has X linked time entries. Deleting it will unlink them." On confirm, clear `workItemId` and `lineItemId` from all affected time entries before removing the line item from the array.

### Discarding/archiving a work order

Time entries linked to a discarded or archived work order retain their linkage. The time entry detail view shows the work order as "(Archived)" or "(Discarded)" — the linkage is informational, not broken. The retroactive "Link to Work Order" picker excludes work orders where `discardedAt` is set (the discard mechanism uses this field, not a status enum) but includes archived ones.

### From a time entry — where the UI lives

The "Link to Work Order" action appears on time entries within the existing time tracking views (e.g., the expanded timer history or any future time entries list). If no dedicated time entries list route exists yet, this action is available in the timer bar's expanded breakdown when viewing past entries.

## Backward Compatibility

- Time entries without `workItemId`/`lineItemId` continue to work as standalone entries.
- Line items without linked time entries show "No time tracked" — manual hour entry remains functional for these.
- Existing work orders with manually-entered hours remain unchanged until time entries are linked.
- No migration needed. All new fields are optional.
- `docToWorkItem` and `updateLineItem` must preserve `costOverride` through serialization round-trips.

## Implementation Checklist (Critical Paths)

These are load-bearing code changes that must not be missed:

### `docToWorkItem` converter (firestore.ts)

The existing line item mapping must include `costOverride`:

```typescript
lineItems: (data.lineItems ?? []).map((li: DocumentData) => ({
  id: li.id ?? crypto.randomUUID(),
  description: li.description ?? '',
  hours: li.hours ?? 0,
  cost: li.cost ?? 0,
  costOverride: li.costOverride ?? undefined,  // NEW — preserve through round-trips
})),
```

### `updateLineItem` function (WorkItemDetail.tsx)

The existing `updateLineItem` unconditionally overwrites `cost` as `hours * hourlyRate` when hours change. This function must be reworked: when a line item has linked time entries, `hours` is computed from `computeLineItemHours` and `cost` respects `costOverride`. The old `if (field === 'hours')` branch that forces `cost = hours * hourlyRate` becomes dead code for time-tracked line items and must not overwrite `costOverride`.

## Firestore & Security

- No new collections.
- No Firestore rule changes — time entries already scoped by `ownerId`. `workItemId` and `lineItemId` are data fields, not cross-collection security boundaries.
- The existing `isOwnerOrLegacy` rule on `workItems` covers line item data since it's embedded.
