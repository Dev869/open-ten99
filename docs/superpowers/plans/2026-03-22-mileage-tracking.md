# Mileage Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated mileage tracking page under Finance where contractors can log trips, classify them as business/personal, and see IRS mileage deduction totals.

**Architecture:** New Firestore collection `mileageTrips` with ownerId scoping. Service layer functions with `writeBatch` for atomic trip+expense creation. Real-time hook with `whenAuthReady`. Business trips auto-create "Vehicle & Fuel" transactions via the existing `createManualExpense` pattern.

**Tech Stack:** React 19, TypeScript, Firestore, Tailwind CSS 4, Vite

**Spec:** `docs/superpowers/specs/2026-03-22-mileage-tracking-design.md`

---

### Task 1: Types — MileageTrip interface and AppSettings update

**Files:**
- Modify: `web/src/lib/types.ts`

- [ ] **Step 1: Add MileagePurpose type and MileageTrip interface**

Add after the `TimeEntry` interface (around line 384):

```typescript
/* ── Mileage Tracking ─────────────────────────────── */

export type MileagePurpose = 'business' | 'personal';

export interface MileageTrip {
  id: string;
  ownerId: string;
  date: Date;
  description: string;
  miles: number;          // Always one-way input value
  purpose: MileagePurpose;
  clientId?: string;
  roundTrip: boolean;
  rate: number;           // IRS rate at time of entry (e.g. 0.70)
  deduction: number;      // effectiveMiles × rate (0 if personal)
  transactionId?: string; // Linked auto-created expense (business only)
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Add mileageRate to AppSettings**

Add after `fcmToken?: string;` in the `AppSettings` interface:

```typescript
  mileageRate?: number;   // IRS standard mileage rate ($/mile), default 0.70
```

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts
git commit -m "feat(mileage): add MileageTrip interface and MileagePurpose type"
```

---

### Task 2: Service layer — Firestore CRUD for mileage trips

**Files:**
- Modify: `web/src/services/firestore.ts`

- [ ] **Step 1: Add docToMileageTrip converter**

Add near the other `docTo*` converters (after `docToReceipt`, around line 894). Follow the same pattern — use `?.toDate?.()` for Timestamp fields:

```typescript
function docToMileageTrip(id: string, data: DocumentData): MileageTrip {
  return {
    id,
    ownerId: data.ownerId ?? '',
    date: data.date?.toDate?.() ?? new Date(),
    description: data.description ?? '',
    miles: data.miles ?? 0,
    purpose: data.purpose ?? 'business',
    clientId: data.clientId ?? undefined,
    roundTrip: data.roundTrip ?? false,
    rate: data.rate ?? 0.70,
    deduction: data.deduction ?? 0,
    transactionId: data.transactionId ?? undefined,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  };
}
```

- [ ] **Step 2: Add subscribeMileageTrips**

Add after the converter. Follow the `subscribeReceipts` pattern:

```typescript
export function subscribeMileageTrips(
  callback: (trips: MileageTrip[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, 'mileageTrips'),
    where('ownerId', '==', user.uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const trips = snapshot.docs
        .map((d) => docToMileageTrip(d.id, d.data()))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
      callback(trips);
    },
    (error) => {
      console.error('mileageTrips subscription error:', error);
      callback([]);
    }
  );
}
```

- [ ] **Step 3: Add createMileageTrip with writeBatch**

This creates the trip doc. For business trips, it also creates a linked "Vehicle & Fuel" expense atomically.

```typescript
export async function createMileageTrip(data: {
  date: Date;
  description: string;
  miles: number;
  purpose: MileagePurpose;
  clientId?: string;
  roundTrip: boolean;
  rate: number;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const effectiveMiles = data.roundTrip ? data.miles * 2 : data.miles;
  const deduction = data.purpose === 'business' ? effectiveMiles * data.rate : 0;

  const tripRef = doc(collection(db, 'mileageTrips'));
  const now = Timestamp.now();

  if (data.purpose === 'business') {
    // Atomic: create trip + expense together
    const txnRef = doc(collection(db, 'transactions'));
    const batch = writeBatch(db);

    batch.set(tripRef, {
      ownerId: user.uid,
      date: Timestamp.fromDate(data.date),
      description: data.description,
      miles: data.miles,
      purpose: data.purpose,
      clientId: data.clientId ?? null,
      roundTrip: data.roundTrip,
      rate: data.rate,
      deduction,
      transactionId: txnRef.id,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(txnRef, {
      ownerId: user.uid,
      provider: 'manual',
      externalId: null,
      date: Timestamp.fromDate(data.date),
      amount: -Math.abs(deduction),
      description: data.description,
      category: 'Vehicle & Fuel',
      type: 'expense',
      matchStatus: 'unmatched',
      isManual: true,
      taxDeductible: true,
      receiptUrl: null,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();
  } else {
    // Personal trip — no expense, but still use batch for consistency
    const batch = writeBatch(db);
    batch.set(tripRef, {
      ownerId: user.uid,
      date: Timestamp.fromDate(data.date),
      description: data.description,
      miles: data.miles,
      purpose: data.purpose,
      clientId: data.clientId ?? null,
      roundTrip: data.roundTrip,
      rate: data.rate,
      deduction: 0,
      transactionId: null,
      createdAt: now,
      updatedAt: now,
    });
    await batch.commit();
  }

  return tripRef.id;
}
```

Note: uses `batch.set()` for both paths — avoids needing a `setDoc` import (which is not in the static imports of firestore.ts).

- [ ] **Step 4: Add deleteMileageTrip with writeBatch**

```typescript
export async function deleteMileageTrip(
  tripId: string,
  transactionId?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const batch = writeBatch(db);
  batch.delete(doc(db, 'mileageTrips', tripId));
  if (transactionId) {
    batch.delete(doc(db, 'transactions', transactionId));
  }
  await batch.commit();
}
```

- [ ] **Step 5: Add updateMileageTrip with purpose transition handling**

Handles all four update scenarios from the spec: business→personal, personal→business, field changes while staying business, and personal field changes.

```typescript
export async function updateMileageTrip(
  tripId: string,
  current: { purpose: MileagePurpose; transactionId?: string },
  data: {
    date: Date;
    description: string;
    miles: number;
    purpose: MileagePurpose;
    clientId?: string;
    roundTrip: boolean;
    rate: number;
  }
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const effectiveMiles = data.roundTrip ? data.miles * 2 : data.miles;
  const deduction = data.purpose === 'business' ? effectiveMiles * data.rate : 0;
  const now = Timestamp.now();
  const batch = writeBatch(db);

  const tripUpdate: Record<string, unknown> = {
    date: Timestamp.fromDate(data.date),
    description: data.description,
    miles: data.miles,
    purpose: data.purpose,
    clientId: data.clientId ?? null,
    roundTrip: data.roundTrip,
    rate: data.rate,
    deduction,
    updatedAt: now,
  };

  if (current.purpose === 'business' && data.purpose === 'personal') {
    // Business → Personal: delete linked transaction
    if (current.transactionId) {
      batch.delete(doc(db, 'transactions', current.transactionId));
    }
    tripUpdate.transactionId = null;
  } else if (current.purpose === 'personal' && data.purpose === 'business') {
    // Personal → Business: create new linked transaction
    const txnRef = doc(collection(db, 'transactions'));
    batch.set(txnRef, {
      ownerId: user.uid,
      provider: 'manual',
      externalId: null,
      date: Timestamp.fromDate(data.date),
      amount: -Math.abs(deduction),
      description: data.description,
      category: 'Vehicle & Fuel',
      type: 'expense',
      matchStatus: 'unmatched',
      isManual: true,
      taxDeductible: true,
      receiptUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    tripUpdate.transactionId = txnRef.id;
  } else if (data.purpose === 'business' && current.transactionId) {
    // Still business: update linked transaction amount
    batch.update(doc(db, 'transactions', current.transactionId), {
      date: Timestamp.fromDate(data.date),
      amount: -Math.abs(deduction),
      description: data.description,
      updatedAt: now,
    });
  }

  batch.update(doc(db, 'mileageTrips', tripId), tripUpdate);
  await batch.commit();
}
```

- [ ] **Step 6: Add the MileageTrip import to the imports section**

At the top of `firestore.ts`, add `MileageTrip` and `MileagePurpose` to the import from `../lib/types`:

```typescript
import type { ..., MileageTrip, MileagePurpose } from '../lib/types';
```

- [ ] **Step 6: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add web/src/services/firestore.ts
git commit -m "feat(mileage): add Firestore CRUD for mileage trips"
```

---

### Task 3: Hook — useMileageTrips with whenAuthReady

**Files:**
- Modify: `web/src/hooks/useFirestore.ts`

- [ ] **Step 1: Add the useMileageTrips hook**

Add after `useTimeEntries`. Follow the exact `useReceipts` pattern with `whenAuthReady`:

```typescript
export function useMileageTrips() {
  const [trips, setTrips] = useState<MileageTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = whenAuthReady(() =>
      subscribeMileageTrips((items) => {
        setTrips(items);
        setLoading(false);
      }),
    );
    return unsubscribe;
  }, []);

  return { trips, loading };
}
```

- [ ] **Step 2: Add imports**

Add `MileageTrip` to the type import from `../lib/types` and `subscribeMileageTrips` to the import from `../services/firestore`.

- [ ] **Step 3: Add mileageRate default to useSettings**

In the `useSettings` hook, add `mileageRate` to the default `AppSettings` object:

```typescript
const [settings, setSettings] = useState<AppSettings>({
  accentColor: '#4BA8A8',
  hourlyRate: 150,
  companyName: 'Your Company',
  sidebarOrder: undefined,
  sidebarHidden: undefined,
  mileageRate: 0.70,       // <-- add this
});
```

- [ ] **Step 4: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useFirestore.ts
git commit -m "feat(mileage): add useMileageTrips hook with whenAuthReady"
```

---

### Task 4: Firestore security rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add mileageTrips rules**

Add after the `receipts` collection rules block. Use `isContractor()` (not bare `request.auth != null`):

```
    match /mileageTrips/{tripId} {
      allow read: if isContractor() && resource.data.ownerId == request.auth.uid;
      allow create: if isContractor() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isContractor() && resource.data.ownerId == request.auth.uid
                     && request.resource.data.ownerId == request.auth.uid;
      allow delete: if isContractor() && resource.data.ownerId == request.auth.uid;
    }
```

Note: the `update` rule checks both `resource.data.ownerId` (existing doc) and `request.resource.data.ownerId` (new data) to prevent ownership transfer. This matches the `receipts` rule pattern.

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(mileage): add Firestore security rules for mileageTrips"
```

---

### Task 5: Mileage page component

**Files:**
- Create: `web/src/routes/contractor/Mileage.tsx`

- [ ] **Step 1: Create the Mileage page**

Create `web/src/routes/contractor/Mileage.tsx` with the full page layout. The component structure:

```typescript
import { useState, useMemo, useCallback } from 'react';
import { useMileageTrips } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useFirestore';
import { createMileageTrip, deleteMileageTrip } from '../../services/firestore';
import { formatCurrency, formatDate, exportToCsv } from '../../lib/utils';
import type { MileagePurpose, Client } from '../../lib/types';

interface MileageProps {
  clients: Client[];
}

export default function Mileage({ clients }: MileageProps) {
  const { user } = useAuth();
  const { settings } = useSettings(user?.uid);
  const { trips, loading } = useMileageTrips();
  const rate = settings.mileageRate ?? 0.70;

  // Year filter
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDesc, setFormDesc] = useState('');
  const [formMiles, setFormMiles] = useState('');
  const [formPurpose, setFormPurpose] = useState<MileagePurpose>('business');
  const [formClientId, setFormClientId] = useState('');
  const [formRoundTrip, setFormRoundTrip] = useState(false);

  // Client map for display
  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.id) map[c.id] = c.name; });
    return map;
  }, [clients]);

  // Available years from trip data
  const years = useMemo(() => {
    const ys = new Set<number>();
    ys.add(currentYear);
    trips.forEach((t) => ys.add(t.date.getFullYear()));
    return [...ys].sort((a, b) => b - a);
  }, [trips, currentYear]);

  // Filtered trips for selected year
  const filtered = useMemo(
    () => trips.filter((t) => t.date.getFullYear() === selectedYear),
    [trips, selectedYear]
  );

  // Summary stats
  const totalBusinessMiles = useMemo(
    () => filtered
      .filter((t) => t.purpose === 'business')
      .reduce((s, t) => s + (t.roundTrip ? t.miles * 2 : t.miles), 0),
    [filtered]
  );
  const totalDeduction = useMemo(
    () => filtered.reduce((s, t) => s + t.deduction, 0),
    [filtered]
  );

  function resetForm() {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDesc('');
    setFormMiles('');
    setFormPurpose('business');
    setFormClientId('');
    setFormRoundTrip(false);
    setShowForm(false);
  }

  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    const miles = parseFloat(formMiles);
    if (!formDesc.trim() || isNaN(miles) || miles <= 0) return;

    setFormLoading(true);
    setError('');
    try {
      await createMileageTrip({
        date: new Date(formDate + 'T12:00:00'),
        description: formDesc.trim(),
        miles,
        purpose: formPurpose,
        clientId: formClientId || undefined,
        roundTrip: formRoundTrip,
        rate,
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trip');
    } finally {
      setFormLoading(false);
    }
  }, [formDate, formDesc, formMiles, formPurpose, formClientId, formRoundTrip, rate]);

  async function handleDelete(tripId: string, transactionId?: string) {
    if (!confirm('Delete this trip? This also removes the linked expense.')) return;
    try {
      await deleteMileageTrip(tripId, transactionId);
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  }

  function handleExport() {
    const headers = ['Date', 'Description', 'Miles', 'Effective Miles', 'Purpose', 'Client', 'Rate', 'Deduction'];
    const rows = filtered.map((t) => {
      const effective = t.roundTrip ? t.miles * 2 : t.miles;
      return [
        formatDate(t.date),
        t.description,
        t.miles.toFixed(1),
        effective.toFixed(1),
        t.purpose,
        t.clientId ? (clientMap[t.clientId] ?? '') : '',
        `$${t.rate.toFixed(2)}`,
        `$${t.deduction.toFixed(2)}`,
      ];
    });
    exportToCsv(`mileage-log-${selectedYear}.csv`, headers, rows);
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-[var(--bg-card)] rounded-xl" />
        <div className="h-12 bg-[var(--bg-card)] rounded-xl" />
        <div className="h-48 bg-[var(--bg-card)] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Summary bar */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
            {selectedYear} Mileage
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] text-xs"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-baseline gap-4 mt-1">
          <div>
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {totalBusinessMiles.toFixed(1)}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] ml-1">business mi</span>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-[var(--accent)]">
              {formatCurrency(totalDeduction)}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] ml-1">deduction</span>
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowForm((p) => !p)}
          className="flex-1 h-9 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--accent-dark)] transition-colors"
        >
          {showForm ? 'Cancel' : '+ Log Trip'}
        </button>
        {filtered.length > 0 && (
          <button
            onClick={handleExport}
            className="h-9 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
          >
            Export
          </button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 mb-3 space-y-3 animate-fade-in-up">
          {/* Date + Miles row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full mt-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)]"
              />
            </div>
            <div className="w-24">
              <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">Miles</label>
              <input
                type="number"
                value={formMiles}
                onChange={(e) => setFormMiles(e.target.value)}
                min="0.1"
                step="0.1"
                placeholder="0.0"
                className="w-full mt-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">Description</label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="e.g. Client site visit"
              className="w-full mt-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)]"
            />
          </div>

          {/* Purpose toggle + Round trip */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setFormPurpose('business')}
                className={`px-3 h-8 text-xs font-semibold transition-colors ${
                  formPurpose === 'business'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                }`}
              >
                Business
              </button>
              <button
                type="button"
                onClick={() => setFormPurpose('personal')}
                className={`px-3 h-8 text-xs font-semibold transition-colors ${
                  formPurpose === 'personal'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                }`}
              >
                Personal
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={formRoundTrip}
                onChange={(e) => setFormRoundTrip(e.target.checked)}
                className="rounded"
              />
              Round trip
            </label>
          </div>

          {/* Client dropdown */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">Client (optional)</label>
            <select
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              className="w-full mt-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)]"
            >
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id!}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Preview + Save */}
          {formMiles && parseFloat(formMiles) > 0 && formPurpose === 'business' && (
            <p className="text-xs text-[var(--text-secondary)]">
              {formRoundTrip ? `${(parseFloat(formMiles) * 2).toFixed(1)} mi` : `${parseFloat(formMiles).toFixed(1)} mi`}
              {' × $'}{rate.toFixed(2)}{' = '}
              <span className="font-bold text-[var(--accent)]">
                {formatCurrency((formRoundTrip ? parseFloat(formMiles) * 2 : parseFloat(formMiles)) * rate)}
              </span>
              {' deduction'}
            </p>
          )}
          {error && (
            <p className="text-xs text-[var(--color-red)]">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={formLoading || !formDesc.trim() || !formMiles || parseFloat(formMiles) <= 0}
            className="w-full h-9 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
          >
            {formLoading ? 'Saving...' : 'Save Trip'}
          </button>
        </div>
      )}

      {/* Trip list */}
      <div className="space-y-2">
        {filtered.map((trip, i) => {
          const effective = trip.roundTrip ? trip.miles * 2 : trip.miles;
          return (
            <div
              key={trip.id}
              className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-[var(--text-secondary)]">{formatDate(trip.date)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      trip.purpose === 'business'
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                    }`}>
                      {trip.purpose === 'business' ? 'Business' : 'Personal'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {trip.description}
                  </p>
                  {trip.clientId && clientMap[trip.clientId] && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{clientMap[trip.clientId]}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {effective.toFixed(1)} mi
                    {trip.roundTrip && <span className="text-[10px] text-[var(--text-secondary)] ml-0.5">↔</span>}
                  </p>
                  {trip.purpose === 'business' && (
                    <p className="text-xs font-semibold text-[var(--accent)]">{formatCurrency(trip.deduction)}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end mt-1">
                <button
                  onClick={() => handleDelete(trip.id, trip.transactionId)}
                  className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--color-red)] transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && !showForm && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 opacity-40 text-[var(--text-primary)]">✦</div>
          <div className="text-sm font-bold text-[var(--text-primary)]">No trips logged yet</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Tap "Log Trip" to track your first drive.
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/contractor/Mileage.tsx
git commit -m "feat(mileage): add Mileage page component with trip form and list"
```

---

### Task 6: Route registration and navigation

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/MobileBottomNav.tsx`
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Add route in App.tsx**

Add to the `pageNames` map (around line 22):
```typescript
'/dashboard/finance/mileage': 'Mileage',
```

Add lazy import near the other finance route imports:
```typescript
const Mileage = lazy(() => import('./routes/contractor/Mileage'));
```

Add the route element after the `finance/accounts` route (around line 378):
```tsx
<Route path="finance/mileage" element={<Mileage clients={clients} />} />
```

- [ ] **Step 2: Add to Sidebar finance sub-nav**

In `web/src/components/Sidebar.tsx`, add to the `finance` children array (after the `finance-accounts` entry). You'll need to add an icon import — use `IconClock` for mileage:

```typescript
{ to: '/dashboard/finance/mileage', key: 'finance-mileage', label: 'Mileage', Icon: IconClock },
```

Add `IconClock` to the icon imports if not already present.

- [ ] **Step 3: Add to MobileBottomNav More menu**

In `web/src/components/MobileBottomNav.tsx`, add to the Finance section items array in `menuSections`:

```typescript
{ to: '/dashboard/finance/mileage', label: 'Mileage', Icon: IconClock },
```

Add `IconClock` to the icon imports if not already present.

- [ ] **Step 4: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build.

- [ ] **Step 5: Verify in dev server**

Run: `cd web && npm run dev`
Navigate to `/dashboard/finance/mileage` — the page should load with the empty state.
Check: Sidebar shows "Mileage" under Finance. Mobile More menu shows "Mileage" in the Finance section.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/components/Sidebar.tsx web/src/components/MobileBottomNav.tsx
git commit -m "feat(mileage): register route and add to sidebar/mobile nav"
```

---

### Task 7: Settings — mileage rate configuration

**Files:**
- Modify: `web/src/routes/contractor/Settings.tsx`

- [ ] **Step 1: Add mileageRate state and sync from settings**

Add a new `useState` for mileageRate:
```typescript
const [mileageRate, setMileageRate] = useState(String(settings.mileageRate ?? 0.70));
```

Add to the `useEffect` that syncs settings to local state:
```typescript
setMileageRate(String(settings.mileageRate ?? 0.70));
```

- [ ] **Step 2: Include mileageRate in handleSave**

In the `handleSave` function, add `mileageRate` to the `updateSettings` call:
```typescript
await updateSettings(userId, {
  companyName: companyName.trim(),
  hourlyRate: Number(hourlyRate) || 0,
  accentColor,
  mileageRate: Number(mileageRate) || 0.70,
});
```

- [ ] **Step 3: Add the mileage rate field to the form**

Add a new section after the Hourly Rate field (after line 168) and before the Accent Color section:

```tsx
{/* Mileage Rate */}
<div>
  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wide">
    IRS Mileage Rate
  </label>
  <div className="relative mt-1.5">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">$</span>
    <input
      type="number"
      value={mileageRate}
      onChange={(e) => setMileageRate(e.target.value)}
      step="0.01"
      min="0"
      className="w-full pl-7 pr-3 py-2.5 min-h-[44px] bg-[var(--bg-input)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    />
  </div>
  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
    Per-mile rate for business mileage deductions (2025 IRS rate: $0.70).
  </p>
</div>
```

- [ ] **Step 4: Verify build and test**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build.

Manually test: go to Settings, verify mileage rate field appears, change the value, save, refresh — value persists.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/contractor/Settings.tsx
git commit -m "feat(mileage): add IRS mileage rate setting"
```

---

### Task 8: End-to-end smoke test

- [ ] **Step 1: Full flow test**

Run the dev server: `cd web && npm run dev`

Test this exact sequence:
1. Go to Settings → set mileage rate to `0.70` → Save
2. Go to Finance → Mileage
3. Verify empty state shows "No trips logged yet"
4. Click "Log Trip"
5. Enter: date=today, description="Office to client", miles=15, purpose=Business, round trip=on
6. Verify preview shows: "30.0 mi × $0.70 = $21.00 deduction"
7. Click "Save Trip"
8. Verify trip appears in list with "30.0 mi ↔" and "$21.00"
9. Verify summary shows "30.0 business mi" and "$21.00 deduction"
10. Go to Finance → Expenses — verify a "Vehicle & Fuel" expense for $21.00 appeared
11. Go back to Mileage → delete the trip
12. Verify trip removed from list AND the expense is removed from Expenses
13. Log a personal trip — verify no expense is created, deduction shows $0
14. Click Export — verify CSV downloads with correct IRS mileage log format

- [ ] **Step 2: Deploy rules**

```bash
firebase deploy --only firestore:rules
```

- [ ] **Step 3: Final commit**

If any fixes were needed during testing, commit them:
```bash
git add -A
git commit -m "fix(mileage): address smoke test issues"
```
