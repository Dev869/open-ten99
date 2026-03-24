# My Time Clock

## Summary

A dedicated time entries log page at `/dashboard/time-clock` plus a weekly summary card on the dashboard. The page shows all saved time entries with flexible date range filters (day/week/month/year), client/app/project filters, day-grouped entries, and inline editing (start/end time, description, client, app, billable toggle, delete). Seconds are stored precisely but displayed rounded to minutes.

## Time Clock Page (`/dashboard/time-clock`)

### Layout

**Top bar:**
- "My Time Clock" page title
- Date range toggle: Day | Week | Month | Year (default: Week)
- Prev/next arrows with date label (e.g., "Mar 17 – 23, 2026")

**Filter row:**
- Client dropdown ("All clients" default)
- App dropdown ("All apps" default, filtered by selected client)
- Work Order dropdown ("All work orders" default — shows work orders filtered by selected client, values are `WorkItem.id`/`WorkItem.subject` pairs, filters entries by `workItemId`)

**Summary strip:**
- Total hours for the selected period (respecting filters)
- Billable hours
- Session count (number of `TimeEntry` documents matching current filters)

**Entry list:**
- Grouped by day, most recent day first
- Each day group has a date header with the day's total hours
- Each entry row shows: time range, duration (hours/minutes), client, app, description, billable indicator, linked work order (if any)

### Filtering

All filtering is client-side — the app already subscribes to all time entries via `useTimeEntries`.

**Date range:**
- Day: single day, defaults to today
- Week: Sun–Sat, defaults to current week (matches dashboard week definition)
- Month: calendar month, defaults to current month
- Year: calendar year, defaults to current year
- Prev/next arrows shift by one period

**Entity filters:**
- Client: filters entries by `clientId`
- App: filters by `appId`, dropdown options filtered by selected client
- Work Order: filters by `workItemId`, dropdown shows work orders (`WorkItem.subject`) filtered by selected client

All filters combine with AND logic. Date range + entity filters apply together.

### Inline Editing

Tapping an entry row expands it into edit mode:

**Editable fields:**
- Start time (time input — updates `startedAt`, preserves date)
- End time (time input — updates `endedAt`, preserves date)
- Description (text input)
- Client (dropdown)
- App (dropdown, filtered by selected client)
- Billable toggle

**Duration** auto-recalculates from edited start/end times as `endedAt - startedAt` in seconds.

**Actions:**
- Save — writes changes to Firestore via `updateTimeEntry` (extended to support all editable fields)
- Cancel — collapses back to read mode, discards changes
- Delete — confirmation dialog, then deletes the time entry. Uses a Firestore `writeBatch`: if the entry is linked to a work order line item (`workItemId`/`lineItemId` set), the batch clears those fields and deletes the document atomically. This ensures no partial state if one write fails. Note: deleting a linked entry reduces the computed hours on that line item — this is expected behavior.

Only one entry can be in edit mode at a time. Expanding a different entry collapses the current one (discarding unsaved changes). Navigating away also discards — no unsaved-changes guard needed.

**Validation:**
- End time must be after start time. If not, the Save button is disabled.
- Changing Client in edit mode clears the App selection (app may not belong to the new client).

**Empty states:**
- No entries for the selected period/filters: show centered message "No time entries" with a prompt to start the timer.
- Summary strip shows "0h 0m" for all totals when empty.

**Quarter-hour rounding:** The `roundTimeToQuarterHour` setting does NOT apply to this page. Durations display as raw hours/minutes. Rounding only applies when computing line item hours on work orders.

### Firestore Changes

Extend the existing `updateTimeEntry` function to accept all editable fields:

```typescript
export async function updateTimeEntry(
  id: string,
  updates: Partial<Pick<TimeEntry, 'workItemId' | 'lineItemId' | 'clientId' | 'appId' | 'description' | 'durationSeconds' | 'isBillable' | 'startedAt' | 'endedAt'>>
): Promise<void>
```

Add a `deleteTimeEntry` function:

```typescript
export async function deleteTimeEntry(id: string): Promise<void>
```

### New Route

Add `/dashboard/time-clock` route to `App.tsx` with a lazy-loaded `TimeClock` component.

Add "Time Clock" to the sidebar/nav.

## Dashboard Summary Card

Replace the existing `work-time` dashboard widget with a new "Time This Week" card. The entire card is clickable and navigates to `/dashboard/time-clock`. Register it in the widget configurator system under the same `work-time` key so existing widget configurations are preserved.

**Content:**
- Title: "Time This Week"
- Date range label (e.g., "Mar 17–23")
- Total hours for the current week (prominently displayed)
- Billable / non-billable split as small badges
- Client breakdown: list of clients with hours per client for the week
- Non-billable entries grouped as "Non-billable" at the bottom

**Week definition:** Use the same week start day as the existing dashboard (Sunday-start via `getDay()`). The Time Clock page also uses Sunday-start weeks to stay consistent.

**Data source:** Same `useTimeEntries` subscription, filtered to current week client-side.

## Data Display

- `durationSeconds` stored precisely (to the second) in Firestore
- Displayed as hours and minutes only (e.g., "1h 22m"), rounded to nearest minute
- Duration format: `Xh Ym` for entries >= 1 hour, `Xm` for entries < 1 hour
- Time ranges shown as `H:MM AM – H:MM PM`
- Day headers show full date: "Friday, Mar 21" (include year if not current year: "Friday, Mar 21, 2025")
- Billable indicator: green `$` badge for billable, gray `--` for non-billable

## No New Data Model Changes

The existing `TimeEntry` interface already has all needed fields: `clientId`, `appId`, `workItemId`, `lineItemId`, `description`, `durationSeconds`, `isBillable`, `startedAt`, `endedAt`. No schema changes required.

The only Firestore service changes are extending `updateTimeEntry` to accept more fields and adding `deleteTimeEntry`.
