# Monthly Retainer Invoicing — Design Spec

**Date**: 2026-03-25
**Status**: Approved

## Overview

Add monthly retainer invoicing with two billing modes (flat-fee and usage-based), automatic draft generation on renewal day, and overage billing. Integrates into the existing invoice/email workflow.

## Billing Modes

Each retainer client has a `retainerBillingMode` setting:

### Flat-Fee (`flat`)

- Single line item: "Monthly Retainer — [Month Year]"
- Amount is `retainerFlatRate` on the Client record
- Hours tracked during the period are informational (shown on invoice but not priced per-hour)
- Overage: hours beyond `retainerHours` are auto-billed at the contractor's `hourlyRate` as additional line items

### Usage-Based (`usage`)

- Line items pulled from all completed work items with `deductFromRetainer === true` during the retainer period
- Total hours compared against `retainerHours` allocation
- Within allocation: billed at $0 per hour (covered by retainer), but still shown
- Overage: excess hours billed at contractor's `hourlyRate` as a separate "Overage" line item

### Unused Hours

Use-it-or-lose-it. Unused retainer hours expire at the end of each period. No rollover.

## Auto-Draft Generation

### Cloud Function: `generateRetainerInvoices`

Runs daily via Firebase Cloud Scheduler (e.g., 6:00 AM UTC).

**Logic:**
1. Query all clients where `retainerHours > 0` and `retainerPaused !== true` and `retainerBillingMode` is set
2. For each client, check if today matches their `retainerRenewalDay` (clamped to last day of month for months with fewer days)
3. Check no retainer invoice already exists for this period (prevent duplicates via `retainerPeriodStart` + `retainerPeriodEnd` uniqueness)
4. Generate a draft `WorkItem` based on billing mode:

**Flat-fee draft:**
```
subject: "Monthly Retainer — April 2026"
type: 'maintenance'
status: 'completed'
invoiceStatus: 'draft'
isRetainerInvoice: true
retainerPeriodStart: <period start>
retainerPeriodEnd: <period end>
lineItems: [
  { description: "Monthly Retainer — April 2026", hours: retainerHours, cost: retainerFlatRate }
]
+ overage line items if hours exceeded
```

**Usage-based draft:**
```
subject: "Retainer Usage — April 2026"
type: 'maintenance'
status: 'completed'
invoiceStatus: 'draft'
isRetainerInvoice: true
retainerPeriodStart: <period start>
retainerPeriodEnd: <period end>
lineItems: [copied from completed deductFromRetainer work items in period]
+ overage line item if total hours > retainerHours
```

5. Send push notification to contractor: "Retainer invoice drafted for [Client Name]"

### Overage Calculation

```
overageHours = max(0, totalHoursWorked - retainerHours)
overageCost = overageHours * hourlyRate
retainerOverageHours = overageHours (stored on WorkItem for display)
```

Overage is added as a final line item: "Overage — X.X hrs beyond retainer @ $Y/hr"

## Data Model Changes

### Client (additions)

| Field | Type | Description |
|-------|------|-------------|
| `retainerBillingMode` | `'flat' \| 'usage'` | Optional. How to bill retainer clients |
| `retainerFlatRate` | `number` | Optional. Monthly flat fee (only for `flat` mode) |

### WorkItem (additions)

| Field | Type | Description |
|-------|------|-------------|
| `isRetainerInvoice` | `boolean` | Optional. Marks this as an auto-generated retainer invoice |
| `retainerPeriodStart` | `Date` | Optional. Start of the retainer billing period |
| `retainerPeriodEnd` | `Date` | Optional. End of the retainer billing period |
| `retainerOverageHours` | `number` | Optional. Hours billed beyond the retainer allocation |

## UI Changes

### Client Detail — Retainer Billing Section

Below the existing retainer summary card, add a "Billing" subsection:

- **Mode toggle**: Flat-fee / Usage-based (radio or segmented control)
- **Flat rate input**: Shown only when mode is `flat`. Currency input for `retainerFlatRate`
- **Invoice preview**: Read-only card showing what the next retainer invoice would look like based on current period data
  - For flat-fee: shows the flat amount + any current overage
  - For usage-based: shows work items completed so far in the period + running total

### Invoices Page

- Retainer invoices display a small "Retainer" badge next to the client name in the InvoiceTable
- Filter tabs: add retainer invoices to the existing "draft" / "sent" / "paid" / "overdue" filters (no separate tab — they're just invoices)

### InvoiceCard / InvoicePreview

- When `isRetainerInvoice === true`:
  - Show "Retainer Invoice" subtitle instead of work order type
  - Show period range: "Billing Period: Mar 25 — Apr 24, 2026"
  - If overage exists, show overage line item with visual callout (orange text)
  - For usage-based: show "Retainer: X.X / Y.Y hrs used" summary line above the total

### EmailComposer

- When sending a retainer invoice, default subject to: "Monthly Retainer Invoice — [Month Year] — [Client Name]"
- Default message to: "Please find your monthly retainer invoice for [Month Year]. [Overage note if applicable]"
- The order details card in the email shows the retainer period and usage summary

### NewInvoiceModal

- Add "Generate Retainer Invoice" as a third option alongside One-Time and Recurring
- Pre-fills client, line items, and amounts from the retainer configuration
- Useful for mid-cycle manual generation or re-generation if the auto-draft needs to be recreated

## Firestore Rules

- Retainer invoices follow the same ownership rules as regular work items (`ownerId == request.auth.uid`)
- The Cloud Function writes with admin credentials (no rule changes needed for server-side writes)
- Client fields `retainerBillingMode` and `retainerFlatRate` are covered by existing client document rules

## Error Handling

- If Cloud Scheduler fires but client has no completed work items (usage mode): still generate draft with zero line items and a note "No billable work this period"
- If `retainerFlatRate` is not set for a flat-fee client: skip generation, log warning
- If `retainerRenewalDay` > days in current month: clamp to last day of month
- Duplicate prevention: check for existing `isRetainerInvoice` with matching `retainerPeriodStart` before creating

## Testing

- Unit tests for overage calculation logic
- Unit tests for period boundary calculation (especially month-end clamping)
- Integration test for Cloud Function: mock Firestore, verify correct draft creation for both modes
- UI tests: verify retainer billing section renders correctly for both modes
- Edge case: client with 0 retainer hours should not trigger invoice generation
- Edge case: paused retainer should not trigger invoice generation
