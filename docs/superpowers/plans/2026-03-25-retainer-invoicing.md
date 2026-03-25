# Monthly Retainer Invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable automatic monthly retainer invoice draft generation with flat-fee and usage-based billing modes, overage calculation, and integrated UI.

**Architecture:** New fields on `Client` (billing mode, flat rate) and `WorkItem` (retainer invoice metadata). A Cloud Function runs daily via Cloud Scheduler, checks each retainer client's renewal day, and creates draft invoices. The existing Invoices page, InvoiceCard, InvoicePreview, EmailComposer, and NewInvoiceModal are updated to handle retainer invoices.

**Tech Stack:** TypeScript, React 19, Firebase Cloud Functions v2, Cloud Scheduler, Firestore

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `web/src/lib/types.ts` | Add retainer fields to Client and WorkItem |
| Modify | `web/src/lib/utils.ts` | Add `getRetainerPeriodEnd` utility |
| Create | `web/src/lib/__tests__/retainerUtils.test.ts` | Unit tests for retainer period and overage logic |
| Create | `web/src/lib/retainerInvoice.ts` | Retainer overage calculation and line item builder |
| Modify | `web/src/services/firestore.ts` | Update converters for new fields |
| Modify | `web/src/routes/contractor/ClientDetail.tsx` | Add retainer billing mode/rate UI |
| Modify | `web/src/components/finance/NewInvoiceModal.tsx` | Add "Retainer Invoice" type option |
| Modify | `web/src/components/finance/InvoiceTable.tsx` | Show "Retainer" badge |
| Modify | `web/src/components/finance/InvoiceCard.tsx` | Show retainer period and overage |
| Modify | `web/src/components/finance/InvoicePreview.tsx` | Show retainer metadata |
| Modify | `web/src/routes/contractor/EmailComposer.tsx` | Retainer-specific defaults |
| Create | `functions/src/generateRetainerInvoices.ts` | Cloud Function for auto-draft generation |
| Modify | `functions/src/index.ts` | Export new Cloud Function |

---

### Task 1: Data Model — Add Retainer Fields to Types

**Files:**
- Modify: `web/src/lib/types.ts:66-78` (Client interface)
- Modify: `web/src/lib/types.ts:20-56` (WorkItem interface)

- [ ] **Step 1: Add retainer billing fields to Client interface**

In `web/src/lib/types.ts`, add two fields to the `Client` interface after `retainerPaused`:

```typescript
// Add after line 75 (retainerPaused)
  retainerBillingMode?: 'flat' | 'usage';
  retainerFlatRate?: number;
```

- [ ] **Step 2: Add retainer invoice fields to WorkItem interface**

In `web/src/lib/types.ts`, add four fields to the `WorkItem` interface after `discardedAt`:

```typescript
// Add after line 53 (discardedAt)
  isRetainerInvoice?: boolean;
  retainerPeriodStart?: Date;
  retainerPeriodEnd?: Date;
  retainerOverageHours?: number;
```

- [ ] **Step 3: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS (new optional fields don't break existing code)

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts
git commit -m "feat(types): add retainer billing mode and invoice fields"
```

---

### Task 2: Retainer Period Utility and Overage Logic

**Files:**
- Modify: `web/src/lib/utils.ts:37-47`
- Create: `web/src/lib/retainerInvoice.ts`
- Create: `web/src/lib/__tests__/retainerUtils.test.ts`

- [ ] **Step 1: Write failing tests for `getRetainerPeriodEnd`**

Create `web/src/lib/__tests__/retainerUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getRetainerPeriodStart, getRetainerPeriodEnd } from '../utils';
import { buildRetainerLineItems } from '../retainerInvoice';

describe('getRetainerPeriodEnd', () => {
  it('returns next month renewal day minus one day when today >= renewalDay', () => {
    const now = new Date(2026, 3, 10); // Apr 10
    const result = getRetainerPeriodEnd(5, now);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(4);
  });

  it('returns this month renewal day minus one day when today < renewalDay', () => {
    const now = new Date(2026, 3, 2); // Apr 2
    const result = getRetainerPeriodEnd(5, now);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // Apr
    expect(result.getDate()).toBe(4);
  });

  it('clamps to last day of month for renewalDay=31', () => {
    const now = new Date(2026, 1, 15); // Feb 15
    const result = getRetainerPeriodEnd(31, now);
    // Period started Jan 31, ends Feb 27 (28 days in Feb 2026, day before 28th)
    expect(result.getMonth()).toBe(1); // Feb
  });
});

describe('buildRetainerLineItems', () => {
  const hourlyRate = 25;
  const retainerHours = 10;

  it('builds flat-fee invoice with single line item', () => {
    const result = buildRetainerLineItems({
      mode: 'flat',
      retainerHours,
      retainerFlatRate: 500,
      hourlyRate,
      periodLabel: 'April 2026',
      workItems: [],
      usedHours: 8,
    });
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].description).toContain('Monthly Retainer');
    expect(result.lineItems[0].cost).toBe(500);
    expect(result.overageHours).toBe(0);
    expect(result.totalCost).toBe(500);
  });

  it('adds overage line item for flat-fee when hours exceeded', () => {
    const result = buildRetainerLineItems({
      mode: 'flat',
      retainerHours,
      retainerFlatRate: 500,
      hourlyRate,
      periodLabel: 'April 2026',
      workItems: [],
      usedHours: 14,
    });
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[1].description).toContain('Overage');
    expect(result.lineItems[1].hours).toBe(4);
    expect(result.lineItems[1].cost).toBe(100);
    expect(result.overageHours).toBe(4);
    expect(result.totalCost).toBe(600);
  });

  it('builds usage-based invoice from work items', () => {
    const workItems = [
      { description: 'Fix login bug', hours: 3, cost: 75 },
      { description: 'Update dashboard', hours: 5, cost: 125 },
    ];
    const result = buildRetainerLineItems({
      mode: 'usage',
      retainerHours,
      hourlyRate,
      periodLabel: 'April 2026',
      workItems,
      usedHours: 8,
    });
    expect(result.lineItems).toHaveLength(2);
    expect(result.overageHours).toBe(0);
    expect(result.totalCost).toBe(200);
  });

  it('adds overage for usage-based when hours exceeded', () => {
    const workItems = [
      { description: 'Task A', hours: 7, cost: 175 },
      { description: 'Task B', hours: 5, cost: 125 },
    ];
    const result = buildRetainerLineItems({
      mode: 'usage',
      retainerHours,
      hourlyRate,
      periodLabel: 'April 2026',
      workItems,
      usedHours: 12,
    });
    expect(result.lineItems).toHaveLength(3);
    expect(result.lineItems[2].description).toContain('Overage');
    expect(result.lineItems[2].hours).toBe(2);
    expect(result.overageHours).toBe(2);
  });

  it('returns empty line items for usage-based with no work', () => {
    const result = buildRetainerLineItems({
      mode: 'usage',
      retainerHours,
      hourlyRate,
      periodLabel: 'April 2026',
      workItems: [],
      usedHours: 0,
    });
    expect(result.lineItems).toHaveLength(0);
    expect(result.overageHours).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/lib/__tests__/retainerUtils.test.ts`
Expected: FAIL — functions not defined

- [ ] **Step 3: Add `getRetainerPeriodEnd` to utils.ts**

In `web/src/lib/utils.ts`, add after the `getRetainerPeriodStart` function (line 47):

```typescript
export function getRetainerPeriodEnd(renewalDay: number, now = new Date()): Date {
  const start = getRetainerPeriodStart(renewalDay, now);
  const endDate = new Date(start);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(endDate.getDate() - 1);
  return endDate;
}
```

- [ ] **Step 4: Create `retainerInvoice.ts` with `buildRetainerLineItems`**

Create `web/src/lib/retainerInvoice.ts`:

```typescript
import type { LineItem } from './types';

interface RetainerLineItemInput {
  mode: 'flat' | 'usage';
  retainerHours: number;
  retainerFlatRate?: number;
  hourlyRate: number;
  periodLabel: string;
  workItems: { description: string; hours: number; cost: number }[];
  usedHours: number;
}

interface RetainerLineItemResult {
  lineItems: LineItem[];
  overageHours: number;
  totalHours: number;
  totalCost: number;
}

export function buildRetainerLineItems(input: RetainerLineItemInput): RetainerLineItemResult {
  const { mode, retainerHours, retainerFlatRate, hourlyRate, periodLabel, workItems, usedHours } = input;
  const overageHours = Math.max(0, usedHours - retainerHours);
  const lineItems: LineItem[] = [];

  if (mode === 'flat') {
    lineItems.push({
      id: crypto.randomUUID(),
      description: `Monthly Retainer — ${periodLabel}`,
      hours: retainerHours,
      cost: retainerFlatRate ?? 0,
    });
  } else {
    // Usage-based: copy work item line items
    for (const wi of workItems) {
      lineItems.push({
        id: crypto.randomUUID(),
        description: wi.description,
        hours: wi.hours,
        cost: wi.cost,
      });
    }
  }

  // Add overage line item if hours exceeded
  if (overageHours > 0) {
    const overageCost = overageHours * hourlyRate;
    lineItems.push({
      id: crypto.randomUUID(),
      description: `Overage — ${overageHours.toFixed(1)} hrs beyond retainer @ ${hourlyRate}/hr`,
      hours: overageHours,
      cost: overageCost,
    });
  }

  const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0);
  const totalCost = lineItems.reduce((sum, li) => sum + li.cost, 0);

  return { lineItems, overageHours, totalHours, totalCost };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && npx vitest run src/lib/__tests__/retainerUtils.test.ts`
Expected: PASS

- [ ] **Step 6: Run full type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/utils.ts web/src/lib/retainerInvoice.ts web/src/lib/__tests__/retainerUtils.test.ts
git commit -m "feat: add retainer period end utility and invoice line item builder"
```

---

### Task 3: Update Firestore Converters

**Files:**
- Modify: `web/src/services/firestore.ts`

- [ ] **Step 1: Update `docToWorkItem` converter**

In `web/src/services/firestore.ts`, find the `docToWorkItem` function. Add the new retainer fields to the return object after the `discardedAt` field:

```typescript
    isRetainerInvoice: data.isRetainerInvoice ?? false,
    retainerPeriodStart: data.retainerPeriodStart ? toDate(data.retainerPeriodStart) : undefined,
    retainerPeriodEnd: data.retainerPeriodEnd ? toDate(data.retainerPeriodEnd) : undefined,
    retainerOverageHours: data.retainerOverageHours ?? undefined,
```

- [ ] **Step 2: Update `docToClient` converter**

Find the `docToClient` function. Add the new retainer billing fields after `retainerPaused`:

```typescript
    retainerBillingMode: data.retainerBillingMode ?? undefined,
    retainerFlatRate: data.retainerFlatRate ?? undefined,
```

- [ ] **Step 3: Update `createWorkItem` to serialize retainer dates**

In the `createWorkItem` function (line ~267), add serialization for the new date fields. After the `scheduledDate` line:

```typescript
    retainerPeriodStart: item.retainerPeriodStart ? Timestamp.fromDate(item.retainerPeriodStart) : null,
    retainerPeriodEnd: item.retainerPeriodEnd ? Timestamp.fromDate(item.retainerPeriodEnd) : null,
```

- [ ] **Step 4: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/services/firestore.ts
git commit -m "feat: update Firestore converters for retainer invoice fields"
```

---

### Task 4: Client Detail — Retainer Billing UI

**Files:**
- Modify: `web/src/routes/contractor/ClientDetail.tsx:277-333`

- [ ] **Step 1: Add billing mode and flat rate inputs to the retainer settings section**

In `web/src/routes/contractor/ClientDetail.tsx`, find the retainer settings section (inside the editing form, around line 277-333 where `retainerHours` and `retainerRenewalDay` inputs are). Add the following after the existing retainer fields:

```tsx
            {/* Retainer Billing Mode */}
            {client.retainerHours && client.retainerHours > 0 && (
              <>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                    Billing Mode
                  </label>
                  <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-0.5 h-10 items-center">
                    <button
                      type="button"
                      onClick={() => setClient({ ...client, retainerBillingMode: 'flat' })}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        client.retainerBillingMode === 'flat'
                          ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Flat Fee
                    </button>
                    <button
                      type="button"
                      onClick={() => setClient({ ...client, retainerBillingMode: 'usage' })}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        client.retainerBillingMode === 'usage'
                          ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Usage-Based
                    </button>
                  </div>
                </div>
                {client.retainerBillingMode === 'flat' && (
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] uppercase font-semibold mb-1.5">
                      Monthly Flat Rate
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={client.retainerFlatRate ?? ''}
                        onChange={(e) =>
                          setClient({ ...client, retainerFlatRate: e.target.value ? Number(e.target.value) : undefined })
                        }
                        className="w-full h-10 pl-7 pr-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/contractor/ClientDetail.tsx
git commit -m "feat(ui): add retainer billing mode and flat rate to client detail"
```

---

### Task 5: NewInvoiceModal — Retainer Invoice Option

**Files:**
- Modify: `web/src/components/finance/NewInvoiceModal.tsx`

- [ ] **Step 1: Add a "Retainer" option to the type toggle**

In `web/src/components/finance/NewInvoiceModal.tsx`, find the type toggle (lines 153-184). Replace the two-button toggle with a three-button toggle. Add state for `isRetainerInvoice`:

Add to the component's state declarations (near the top of the component):

```typescript
const [isRetainerInvoice, setIsRetainerInvoice] = useState(false);
```

Replace the type toggle div (lines 158-183) with:

```tsx
              <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => { setInvoiceType('changeRequest'); setRecurrenceFrequency(''); setIsRetainerInvoice(false); }}
                  className={cn(
                    'flex-1 py-2 rounded-md text-xs font-semibold transition-all',
                    !isMaintenance && !isRetainerInvoice
                      ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
                  )}
                >
                  One-Time
                </button>
                <button
                  type="button"
                  onClick={() => { setInvoiceType('maintenance'); setIsRetainerInvoice(false); }}
                  className={cn(
                    'flex-1 py-2 rounded-md text-xs font-semibold transition-all',
                    isMaintenance && !isRetainerInvoice
                      ? 'bg-[var(--bg-card)] text-[var(--color-orange)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
                  )}
                >
                  Recurring
                </button>
                <button
                  type="button"
                  onClick={() => { setInvoiceType('maintenance'); setIsRetainerInvoice(true); setDeductFromRetainer(true); }}
                  className={cn(
                    'flex-1 py-2 rounded-md text-xs font-semibold transition-all',
                    isRetainerInvoice
                      ? 'bg-[var(--bg-card)] text-[var(--color-green)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
                  )}
                >
                  Retainer
                </button>
              </div>
```

- [ ] **Step 2: Auto-populate when Retainer is selected and client changes**

Add an effect that populates retainer invoice fields when a retainer client is selected. Add after the existing state declarations:

```typescript
  // Auto-populate retainer invoice fields
  useEffect(() => {
    if (!isRetainerInvoice || !clientId) return;
    const selectedClient = clients.find((c) => c.id === clientId);
    if (!selectedClient?.retainerHours || !selectedClient.retainerBillingMode) return;

    const { getRetainerPeriodStart, getRetainerPeriodEnd } = await import('../../lib/utils');
    const { buildRetainerLineItems } = await import('../../lib/retainerInvoice');
```

Actually, since we can't use top-level await in an effect, use a synchronous import instead. Add the imports at the top of the file:

```typescript
import { getRetainerPeriodStart, getRetainerPeriodEnd } from '../../lib/utils';
import { buildRetainerLineItems } from '../../lib/retainerInvoice';
```

Then add the effect:

```typescript
  useEffect(() => {
    if (!isRetainerInvoice || !clientId) return;
    const selectedClient = clients.find((c) => c.id === clientId);
    if (!selectedClient?.retainerHours || !selectedClient.retainerBillingMode) return;

    const renewalDay = selectedClient.retainerRenewalDay ?? 1;
    const periodStart = getRetainerPeriodStart(renewalDay);
    const periodEnd = getRetainerPeriodEnd(renewalDay);
    const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Find retainer work items in the period
    const periodWorkItems = workItems
      .filter((wi) =>
        wi.clientId === clientId &&
        wi.deductFromRetainer &&
        wi.status !== 'draft' &&
        wi.updatedAt >= periodStart &&
        wi.updatedAt <= periodEnd &&
        !wi.isRetainerInvoice
      );

    const usedHours = periodWorkItems.reduce((sum, wi) => sum + wi.totalHours, 0);

    const result = buildRetainerLineItems({
      mode: selectedClient.retainerBillingMode,
      retainerHours: selectedClient.retainerHours,
      retainerFlatRate: selectedClient.retainerFlatRate,
      hourlyRate: settings?.hourlyRate ?? 25,
      periodLabel,
      workItems: periodWorkItems.flatMap((wi) =>
        wi.lineItems.map((li) => ({ description: li.description, hours: li.hours, cost: li.cost }))
      ),
      usedHours,
    });

    setSubject(`${selectedClient.retainerBillingMode === 'flat' ? 'Monthly Retainer' : 'Retainer Usage'} — ${periodLabel}`);
    setLineItems(result.lineItems);
    setDeductFromRetainer(true);
  }, [isRetainerInvoice, clientId, clients, workItems, settings?.hourlyRate]);
```

- [ ] **Step 3: Pass retainer flags through `handleSave`**

Update the `handleSave` function to include retainer fields when `isRetainerInvoice` is true. In the `createWorkItem` call, add after `invoiceDueDate`:

```typescript
        isRetainerInvoice,
        ...(isRetainerInvoice && clientId ? (() => {
          const selectedClient = clients.find((c) => c.id === clientId);
          const renewalDay = selectedClient?.retainerRenewalDay ?? 1;
          return {
            retainerPeriodStart: getRetainerPeriodStart(renewalDay),
            retainerPeriodEnd: getRetainerPeriodEnd(renewalDay),
            retainerOverageHours: Math.max(0, totalHours - (selectedClient?.retainerHours ?? 0)),
          };
        })() : {}),
```

- [ ] **Step 4: Add `workItems` and `settings` to the component props**

The component needs `workItems` and `settings` props to calculate retainer data. Update the props interface and the parent that renders it to pass them through. Check the existing props and add:

```typescript
interface NewInvoiceModalProps {
  clients: Client[];
  workItems: WorkItem[];
  settings: AppSettings | null;
  onClose: () => void;
}
```

- [ ] **Step 5: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS (may need to update parent component that renders NewInvoiceModal to pass new props)

- [ ] **Step 6: Commit**

```bash
git add web/src/components/finance/NewInvoiceModal.tsx
git commit -m "feat(ui): add retainer invoice option to NewInvoiceModal"
```

---

### Task 6: InvoiceTable — Retainer Badge

**Files:**
- Modify: `web/src/components/finance/InvoiceTable.tsx:111`

- [ ] **Step 1: Add retainer badge next to client name**

Find line 111 where `{clientName}` is rendered. Replace with:

```tsx
                    {clientName}
                    {item.isRetainerInvoice && (
                      <span className="ml-1.5 text-[10px] font-semibold text-[var(--color-green)] bg-[var(--color-green)]/10 px-1.5 py-0.5 rounded">
                        Retainer
                      </span>
                    )}
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/components/finance/InvoiceTable.tsx
git commit -m "feat(ui): show retainer badge in invoice table"
```

---

### Task 7: InvoiceCard — Retainer Period and Overage Display

**Files:**
- Modify: `web/src/components/finance/InvoiceCard.tsx`

- [ ] **Step 1: Add retainer period and overage display**

In the InvoiceCard component, find where the invoice type/subtitle is rendered (around line 73). Add conditional retainer display after the title:

```tsx
              {item.isRetainerInvoice && (
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  Retainer Invoice
                  {item.retainerPeriodStart && item.retainerPeriodEnd && (
                    <span className="ml-1">
                      &middot; {item.retainerPeriodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {item.retainerPeriodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
              )}
```

Find the totals section. Add overage callout before the total row:

```tsx
                {item.isRetainerInvoice && item.retainerOverageHours && item.retainerOverageHours > 0 && (
                  <tr>
                    <td colSpan={3} className="py-1 text-xs text-[var(--color-orange)]">
                      Includes {item.retainerOverageHours.toFixed(1)} hrs overage beyond retainer allocation
                    </td>
                  </tr>
                )}
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/components/finance/InvoiceCard.tsx
git commit -m "feat(ui): show retainer period and overage in invoice card"
```

---

### Task 8: InvoicePreview — Retainer Metadata

**Files:**
- Modify: `web/src/components/finance/InvoicePreview.tsx`

- [ ] **Step 1: Add retainer metadata to the preview panel**

In `InvoicePreview.tsx`, find the status/header section (around line 51-59). Add below it:

```tsx
            {item.isRetainerInvoice && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-[10px] font-semibold text-[var(--color-green)] bg-[var(--color-green)]/10 px-2 py-0.5 rounded-full">
                  Retainer Invoice
                </span>
                {item.retainerPeriodStart && item.retainerPeriodEnd && (
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {item.retainerPeriodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {item.retainerPeriodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                {item.retainerOverageHours && item.retainerOverageHours > 0 && (
                  <span className="text-[10px] font-semibold text-[var(--color-orange)] bg-[var(--color-orange)]/10 px-2 py-0.5 rounded-full">
                    {item.retainerOverageHours.toFixed(1)} hrs overage
                  </span>
                )}
              </div>
            )}
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/components/finance/InvoicePreview.tsx
git commit -m "feat(ui): show retainer metadata in invoice preview"
```

---

### Task 9: EmailComposer — Retainer-Specific Defaults

**Files:**
- Modify: `web/src/routes/contractor/EmailComposer.tsx:278-293`

- [ ] **Step 1: Update default subject and message for retainer invoices**

Find the subject initialization (line ~278-284). Replace with:

```typescript
  const [subject, setSubject] = useState(() => {
    if (!item) return '';
    if (item.isRetainerInvoice) {
      const periodLabel = item.retainerPeriodStart
        ? item.retainerPeriodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : '';
      return `Monthly Retainer Invoice — ${periodLabel} — ${client?.name ?? ''}`;
    }
    return isInvoice
      ? `Invoice — ${item.subject}`
      : `Work Order Completed! — ${item.subject}`;
  });
```

Find the message initialization (line ~289-293). Replace with:

```typescript
  const [message, setMessage] = useState(() => {
    if (!item) return '';
    if (item.isRetainerInvoice) {
      const overageNote = item.retainerOverageHours && item.retainerOverageHours > 0
        ? ` This period includes ${item.retainerOverageHours.toFixed(1)} hours of overage beyond your retainer allocation.`
        : '';
      return `Please find your monthly retainer invoice for the current billing period.${overageNote}`;
    }
    return isInvoice
      ? 'Please find your invoice details below for the completed work.'
      : 'Great news — your work order has been completed! Here are the details:';
  });
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/contractor/EmailComposer.tsx
git commit -m "feat(email): retainer-specific default subject and message"
```

---

### Task 10: Cloud Function — Auto-Generate Retainer Invoice Drafts

**Files:**
- Create: `functions/src/generateRetainerInvoices.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create the Cloud Function**

Create `functions/src/generateRetainerInvoices.ts`:

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

function getRetainerPeriodStart(renewalDay: number, now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const clampedDay = Math.min(renewalDay, new Date(year, month + 1, 0).getDate());

  if (today >= clampedDay) {
    return new Date(year, month, clampedDay);
  }
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(renewalDay, prevMonthLastDay));
}

function getRetainerPeriodEnd(renewalDay: number, now: Date): Date {
  const start = getRetainerPeriodStart(renewalDay, now);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return end;
}

export const generateRetainerInvoices = onSchedule(
  { schedule: "every day 06:00", timeZone: "America/New_York" },
  async () => {
    const now = new Date();
    const today = now.getDate();

    logger.info("Running retainer invoice generation", { today });

    // Find all clients with active retainers and a billing mode set
    const clientsSnap = await db.collection("clients")
      .where("retainerPaused", "!=", true)
      .get();

    let generated = 0;

    for (const clientDoc of clientsSnap.docs) {
      const client = clientDoc.data();

      // Skip clients without retainer config
      if (!client.retainerHours || client.retainerHours <= 0) continue;
      if (!client.retainerBillingMode) continue;

      const renewalDay = client.retainerRenewalDay ?? 1;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const effectiveRenewalDay = Math.min(renewalDay, daysInMonth);

      // Only generate on the renewal day
      if (today !== effectiveRenewalDay) continue;

      const ownerId = client.ownerId;
      if (!ownerId) continue;

      const periodStart = getRetainerPeriodStart(renewalDay, now);
      const periodEnd = getRetainerPeriodEnd(renewalDay, now);

      // Check for existing retainer invoice for this period (prevent duplicates)
      const existingSnap = await db.collection("workItems")
        .where("ownerId", "==", ownerId)
        .where("clientId", "==", clientDoc.id)
        .where("isRetainerInvoice", "==", true)
        .where("retainerPeriodStart", "==", admin.firestore.Timestamp.fromDate(periodStart))
        .get();

      if (!existingSnap.empty) {
        logger.info("Retainer invoice already exists for period", { clientId: clientDoc.id, periodStart });
        continue;
      }

      // Get the contractor's settings for hourly rate
      const settingsDoc = await db.collection("settings").doc(ownerId).get();
      const hourlyRate = settingsDoc.exists ? (settingsDoc.data()?.hourlyRate ?? 25) : 25;

      const periodLabel = periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      // Build line items based on billing mode
      const lineItems: Array<{ id: string; description: string; hours: number; cost: number }> = [];
      let usedHours = 0;

      if (client.retainerBillingMode === "usage") {
        // Find all completed retainer work items in the period
        const workItemsSnap = await db.collection("workItems")
          .where("ownerId", "==", ownerId)
          .where("clientId", "==", clientDoc.id)
          .where("deductFromRetainer", "==", true)
          .where("isRetainerInvoice", "!=", true)
          .get();

        for (const wiDoc of workItemsSnap.docs) {
          const wi = wiDoc.data();
          if (wi.status === "draft") continue;
          const updatedAt = wi.updatedAt?.toDate?.() ?? new Date(0);
          if (updatedAt < periodStart || updatedAt > periodEnd) continue;

          const wiLineItems = wi.lineItems ?? [];
          for (const li of wiLineItems) {
            lineItems.push({
              id: crypto.randomUUID(),
              description: li.description ?? "(no description)",
              hours: li.hours ?? 0,
              cost: li.cost ?? 0,
            });
          }
          usedHours += wi.totalHours ?? 0;
        }
      } else {
        // Flat-fee: single line item
        // Still need to calculate used hours for overage
        const workItemsSnap = await db.collection("workItems")
          .where("ownerId", "==", ownerId)
          .where("clientId", "==", clientDoc.id)
          .where("deductFromRetainer", "==", true)
          .where("isRetainerInvoice", "!=", true)
          .get();

        for (const wiDoc of workItemsSnap.docs) {
          const wi = wiDoc.data();
          if (wi.status === "draft") continue;
          const updatedAt = wi.updatedAt?.toDate?.() ?? new Date(0);
          if (updatedAt < periodStart || updatedAt > periodEnd) continue;
          usedHours += wi.totalHours ?? 0;
        }

        lineItems.push({
          id: crypto.randomUUID(),
          description: `Monthly Retainer — ${periodLabel}`,
          hours: client.retainerHours,
          cost: client.retainerFlatRate ?? 0,
        });
      }

      // Calculate overage
      const overageHours = Math.max(0, usedHours - client.retainerHours);
      if (overageHours > 0) {
        const overageCost = overageHours * hourlyRate;
        lineItems.push({
          id: crypto.randomUUID(),
          description: `Overage — ${overageHours.toFixed(1)} hrs beyond retainer @ $${hourlyRate}/hr`,
          hours: overageHours,
          cost: overageCost,
        });
      }

      const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0);
      const totalCost = lineItems.reduce((sum, li) => sum + li.cost, 0);

      const subject = client.retainerBillingMode === "flat"
        ? `Monthly Retainer — ${periodLabel}`
        : `Retainer Usage — ${periodLabel}`;

      const nowTimestamp = admin.firestore.Timestamp.now();

      await db.collection("workItems").add({
        type: "maintenance",
        status: "completed",
        clientId: clientDoc.id,
        ownerId,
        subject,
        sourceEmail: "",
        lineItems,
        totalHours,
        totalCost,
        isBillable: true,
        deductFromRetainer: true,
        invoiceStatus: "draft",
        isRetainerInvoice: true,
        retainerPeriodStart: admin.firestore.Timestamp.fromDate(periodStart),
        retainerPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
        retainerOverageHours: overageHours > 0 ? overageHours : null,
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
      });

      generated++;
      logger.info("Generated retainer invoice draft", {
        clientId: clientDoc.id,
        clientName: client.name,
        mode: client.retainerBillingMode,
        totalCost,
        overageHours,
      });
    }

    logger.info("Retainer invoice generation complete", { generated });
  }
);
```

- [ ] **Step 2: Export the new function in `functions/src/index.ts`**

Add to `functions/src/index.ts` after the last export:

```typescript
export { generateRetainerInvoices } from './generateRetainerInvoices';
```

- [ ] **Step 3: Build functions**

Run: `cd functions && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add functions/src/generateRetainerInvoices.ts functions/src/index.ts
git commit -m "feat: add Cloud Function for auto-generating retainer invoice drafts"
```

---

### Task 11: Final Type Check and Integration Test

**Files:**
- All modified files

- [ ] **Step 1: Run full web type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run all web tests**

Run: `cd web && npx vitest run`
Expected: PASS

- [ ] **Step 3: Build functions**

Run: `cd functions && npm run build`
Expected: PASS

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: monthly retainer invoicing with flat-fee and usage-based billing"
```

- [ ] **Step 5: Push**

```bash
git push
```
