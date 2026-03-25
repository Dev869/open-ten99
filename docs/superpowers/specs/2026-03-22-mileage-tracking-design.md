# Mileage Tracking — Design Spec

## Overview

Add a dedicated mileage tracking feature to the Finance section of the contractor dashboard. Contractors can manually log trips with start details, miles, purpose (business/personal), and optional client association. Business trips auto-create "Vehicle & Fuel" expense entries and calculate IRS standard mileage deductions.

## Data Model

### MileageTrip (Firestore collection: `mileageTrips`)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Firestore doc ID |
| ownerId | string | Contractor's Firebase UID |
| date | Date | Trip date |
| description | string | e.g. "Client site visit - Acme Corp" |
| miles | number | One-way miles driven |
| purpose | 'business' \| 'personal' | Trip classification |
| clientId | string? | Optional link to a Client |
| roundTrip | boolean | If true, effective miles = miles * 2 |
| rate | number | IRS rate at time of entry (e.g. 0.70) |
| deduction | number | Computed: effectiveMiles × rate (0 if personal) |
| transactionId | string? | Linked auto-created expense (business only) |
| createdAt | Date | |
| updatedAt | Date | |

### AppSettings Addition

New field: `mileageRate: number` — defaults to `0.70` (2025 IRS standard rate). User-configurable on the Settings page.

## Route & Navigation

- **Route**: `/dashboard/finance/mileage`
- **Mobile header label**: "Mileage"
- **More menu**: Added to Finance section in `MobileBottomNav.tsx`
- **Sidebar**: Added to Finance sub-nav in `Sidebar.tsx`
- **App.tsx**: New lazy-loaded route under `finance/*`

## Page Layout (Mileage.tsx)

### Summary Bar
- Total business miles for selected year
- Estimated deduction (total business miles × current rate)
- Styled as a compact card at the top, consistent with FinanceOverview KPI cards

### Year Filter
- Dropdown defaulting to current year
- Filters the trip list and recalculates summary stats

### Log Trip Button
- Prominent CTA below summary
- Opens an inline expandable form (same pattern as Expenses.tsx "Add Expense" form)

### Trip List
- Sorted by date descending
- Each row displays:
  - Date (formatted)
  - Description (truncated if long)
  - Miles (with "↔" round-trip indicator if applicable)
  - Client name (if linked, muted text)
  - Business/Personal badge (accent color for business, muted for personal)
  - Deduction amount (business only, e.g. "$14.00")
- Empty state: "No trips logged yet" with prompt to log first trip

## Trip Entry Form

### Fields
1. **Date** — date picker, defaults to today
2. **Description** — text input, required
3. **Miles** — number input, required, min 0.1
4. **Purpose** — toggle/segmented control: Business (default) | Personal
5. **Client** — optional dropdown from existing clients
6. **Round trip** — toggle, defaults to off

### On Save (Business Trip)
1. Calculate `effectiveMiles = roundTrip ? miles * 2 : miles`
2. Calculate `deduction = effectiveMiles * rate`
3. Create MileageTrip document in Firestore
4. Call `createManualExpense()` with:
   - description: trip description
   - amount: deduction value
   - category: "Vehicle & Fuel"
   - date: trip date
   - taxDeductible: true
5. Store returned transaction ID on the MileageTrip document

### On Save (Personal Trip)
1. Create MileageTrip document with deduction = 0, no transactionId

## Settings Integration

Add to Settings page (`Settings.tsx`):
- New section: "Mileage"
- Field: "IRS Mileage Rate ($/mile)" — number input with step 0.01
- Default: 0.70
- Stored on AppSettings document

## Service Layer (firestore.ts)

### New Functions
- `subscribeMileageTrips(callback): () => void` — real-time listener on `mileageTrips` collection, filtered by ownerId, sorted by date desc
- `createMileageTrip(data): Promise<string>` — create trip doc + linked expense in a single `writeBatch`. For business trips: batch creates the trip doc and the "Vehicle & Fuel" transaction together atomically, then stores the transactionId on the trip doc.
- `updateMileageTrip(id, data): Promise<void>` — update trip using `writeBatch`. Handles purpose transitions:
  - **business → personal**: delete linked transaction, clear `transactionId`, set `deduction = 0`
  - **personal → business**: create new linked transaction, store `transactionId`, calculate deduction
  - **miles/roundTrip/rate changed (still business)**: recalculate deduction, update linked transaction amount
  - Always recalculate `deduction` from `miles`, `roundTrip`, and `rate` — never accept it as input.
- `deleteMileageTrip(id, transactionId?): Promise<void>` — delete trip and linked expense atomically using `writeBatch` (same pattern as `confirmMatch` in firestore.ts)

### Firestore Converter
- `docToMileageTrip(id, data): MileageTrip` — standard converter with date parsing. `deduction` is stored (not computed in converter) but always recalculated on write.

## Hooks (useFirestore.ts)

### New Hook
- `useMileageTrips()` — returns `{ trips: MileageTrip[], loading: boolean }`. Must use the `whenAuthReady` wrapper pattern (same as `useReceipts`, `useConnectedAccounts`, `useTimeEntries`) to prevent empty results on hard page reload when `auth.currentUser` is initially null.

## Types (types.ts)

- `export type MileagePurpose = 'business' | 'personal'`
- `miles` field always stores the one-way input value. `effectiveMiles` (= `miles * 2` if roundTrip) is a derived value used for calculation, never stored separately.
- Add `mileageRate?: number` to `AppSettings` interface. Default `0.70` in the `useSettings` hook's hardcoded default object.

## Firestore Security Rules

Contractor-only access using `isContractor()` helper (same pattern as receipts/transactions/connectedAccounts in `firestore.rules`):
```
match /mileageTrips/{tripId} {
  allow read: if isContractor() && resource.data.ownerId == request.auth.uid;
  allow create: if isContractor() && request.resource.data.ownerId == request.auth.uid;
  allow update, delete: if isContractor() && resource.data.ownerId == request.auth.uid;
}
```

## Files to Create/Modify

### New Files
- `web/src/routes/contractor/Mileage.tsx` — main page component

### Modified Files
- `web/src/lib/types.ts` — add MileageTrip interface, MileagePurpose type
- `web/src/services/firestore.ts` — add mileage CRUD functions
- `web/src/hooks/useFirestore.ts` — add useMileageTrips hook
- `web/src/App.tsx` — register route, add page name
- `web/src/components/MobileBottomNav.tsx` — add to Finance section in More menu
- `web/src/components/Sidebar.tsx` — add to Finance sub-nav
- `web/src/routes/contractor/Settings.tsx` — add mileage rate setting
- `firestore.rules` — add mileageTrips rules

## Design Decisions

1. **Manual-only tracking** — this is a web app, not native mobile, so GPS auto-tracking isn't feasible. Manual entry keeps it simple and reliable.
2. **Auto-create expenses** — business trips automatically create "Vehicle & Fuel" transactions so they appear in Expenses and Reports without double-entry.
3. **Rate stored per trip** — the IRS rate at time of entry is stored on each trip, so historical trips remain accurate even if the user updates their rate setting later.
4. **Standalone collection** — mileageTrips is its own Firestore collection rather than a field on transactions, keeping the data model clean and queryable.
5. **Atomic writes** — all multi-document operations (create trip + expense, delete trip + expense, update purpose transitions) use Firestore `writeBatch` for atomicity, following the `confirmMatch` pattern.
6. **Mileage CSV export** — the Mileage page includes its own "Export" button that generates an IRS-format mileage log (date, description, miles, purpose, client, deduction) separate from the dollar-only expense export in Reports.
7. **Form loading state** — trip form uses `formLoading` state to disable submit and show spinner during async save, matching the pattern in Expenses.tsx.
8. **Year filtering** — done client-side on the subscribed collection. Acceptable for single-contractor use; the full trip history is small enough to load in one listener. Firestore composite index on `(ownerId, date)` is not required initially but can be added if performance degrades.
