# Receipt Tracker Design Spec

## Overview

Receipt tracking feature for Ten99 that lets contractors upload receipt images (via camera scan, file upload, or PWA share target), automatically extract structured data via Gemini 2.5 Flash, auto-match receipts to bank transactions, and manually reassign mismatches. Unmatched receipts persist and re-attempt matching when new transactions sync.

## Data Model

### New `Receipt` Type

```typescript
interface Receipt {
  id: string;
  ownerId: string;
  status: 'processing' | 'unmatched' | 'matched' | 'confirmed';

  // Upload metadata
  imageUrl: string;        // Firebase Storage URL
  fileName: string;
  uploadedAt: Timestamp;

  // Gemini OCR extraction
  vendor?: string;
  amount?: number;
  date?: Timestamp;
  category?: string;       // From EXPENSE_CATEGORIES
  lineItems?: Array<{ description: string; amount: number }>;
  rawText?: string;         // Full OCR text for reference

  // Transaction matching
  transactionId?: string;   // Linked transaction ID
  matchConfidence?: number;  // 0–1, from auto-match algorithm
  matchMethod?: 'auto' | 'manual';

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Status lifecycle: `processing → unmatched → matched → confirmed`

- `processing`: Image uploaded, Gemini extraction in progress
- `unmatched`: Extraction complete, no matching transaction found
- `matched`: Auto-matched to a transaction (awaiting user confirmation)
- `confirmed`: User confirmed or manually assigned the match

### New `receipts` Firestore Collection

Top-level collection following existing `ownerId` pattern. Since this is a new collection with no legacy data, rules use the direct `ownerId` check (no `isOwnerOrLegacy` needed):

```
match /receipts/{receiptId} {
  allow read: if isContractor() && resource.data.ownerId == request.auth.uid;
  allow create: if isContractor() && request.resource.data.ownerId == request.auth.uid;
  allow update: if isContractor() && resource.data.ownerId == request.auth.uid
                 && request.resource.data.ownerId == request.auth.uid;
  allow delete: if isContractor() && resource.data.ownerId == request.auth.uid;
}
```

### Updated `Transaction` Type

Replace `receiptUrl?: string` with:

```typescript
receiptIds?: string[];  // Array of linked Receipt document IDs
```

Migrate existing `receiptUrl` values during deployment (one-time script or lazy migration).

## Cloud Function Pipeline

### `onReceiptUploaded` — Storage Trigger

Triggered when a file is uploaded to `receipts/{userId}/*`.

1. **Validate**: Check file type (image/\*, application/pdf) and size (≤ 10MB)
2. **Create receipt document**: Write to `receipts` collection with `status: 'processing'`, `ownerId`, `imageUrl`, `fileName`, `uploadedAt`
3. **Send to Gemini 2.5 Flash**: Pass image with structured extraction prompt requesting: vendor name, total amount, date, line items (description + amount), category suggestion mapped to `EXPENSE_CATEGORIES`. Uses the existing `GOOGLE_AI_API_KEY` already configured for email parsing.
4. **Update receipt document**: Write extracted fields, set `status: 'unmatched'`
5. **Attempt auto-match**: Query owner's transactions and score matches

### Auto-Match Algorithm

Score each candidate transaction against extracted receipt data:

| Signal | Weight | Logic |
|--------|--------|-------|
| Amount | 0.5 | Exact match = 1.0, within ±$1 = 0.8, within ±5% = 0.5 |
| Vendor | 0.3 | Fuzzy string match (normalized, lowercased) |
| Date | 0.2 | Same day = 1.0, ±1 day = 0.8, ±3 days = 0.5, beyond = 0 |

- Score ≥ 0.7: Set `status: 'matched'`, link `transactionId`, add receipt ID to transaction's `receiptIds`
- Score < 0.7: Stays `unmatched`
- Only match against transactions without existing confirmed receipts

### `onReceiptMatchOnTransaction` — Separate Firestore Trigger

A **new, separate** Cloud Function (not added to the existing `onTransactionCreated` which handles invoice matching for `income` type transactions). This function triggers on transaction create/update and only processes `expense` type transactions:

1. Guard: exit early if `transaction.type !== 'expense'` or transaction already has confirmed receipts
2. Query unmatched receipts for the same owner
3. Run the same matching algorithm
4. If a match is found (score ≥ 0.7), update both receipt and transaction

This keeps receipt matching isolated from the existing invoice-to-transaction matching pipeline in `matchTransaction.ts`.

## Frontend

### New Route: `/dashboard/finance/receipts`

Gallery grid layout showing receipt cards with:

- Receipt thumbnail or rendered extraction preview
- Vendor name and amount
- Status badge: `confirmed` (green), `matched` (yellow), `unmatched` (red), `processing` (spinner)
- Upload/scan card always visible in the grid

### Upload Flow

**Mobile (iOS/Android):**
- Tap upload card → two options:
  - "Scan Receipt" — `<input type="file" accept="image/*" capture="environment">` triggers native camera with document scanning mode
  - "Choose from Photos" — standard file picker for existing images/PDFs

**Desktop:**
- Drag-and-drop zone with click-to-browse fallback
- Supports multi-file upload (images and PDFs, ≤ 10MB each)

**Processing state:** The client creates the receipt Firestore document with `status: 'processing'` immediately after uploading to Storage (before the Cloud Function triggers). This gives the UI something to render instantly. The Cloud Function then updates the existing document with extracted data. The card shows a spinner with "Processing..." label until the `onSnapshot` listener picks up the extraction results.

Note: Firebase Storage triggers can have 10-30 second cold-start latency, so client-side doc creation ensures responsive UI.

### Receipt Detail View

Split panel (slide-over or modal):

- **Left**: Rendered extraction — vendor name, line items, amounts, totals displayed as a clean formatted receipt (not raw photo). Toggle available to view original uploaded image.
- **Right**: Extracted data fields (vendor, amount, date, category dropdown), line items summary, matched transaction card with confidence score
- **Actions**: "Confirm Match" (sets `status: 'confirmed'`) or "Reassign" (opens transaction picker)

### Reassignment Flow

Searchable transaction picker:

1. **Suggested matches** section — ranked by confidence score with percentage displayed
2. **All transactions** section — searchable by vendor name, amount, date
3. **Fallback** — "No match — Create Manual Expense" button creates a manual transaction from extracted receipt data

### Inline Indicators on Existing Pages

**Transactions page** — new Receipt column:
- `🧾 ✓` (green) — confirmed receipt attached, clickable to view
- `🧾 ?` (yellow) — matched but unconfirmed, clickable to review
- `—` — no receipt, clickable to quick-attach

**Quick-attach popover** (on clicking `—`):
- Scan — opens camera
- Upload — opens file picker
- Link Existing — shows unmatched receipts to link

### New Components

| Component | Purpose |
|-----------|---------|
| `ReceiptGrid` | Gallery grid of receipt cards with status badges |
| `ReceiptCard` | Individual card: thumbnail, vendor, amount, status |
| `ReceiptDetail` | Split panel with rendered extraction + extracted data + actions |
| `ReceiptUploader` | Upload zone with mobile scan / desktop drag-drop |
| `TransactionPicker` | Searchable transaction list for reassignment |
| `ReceiptBadge` | Inline status indicator for transaction/expense rows |

### New Hooks

| Hook | Purpose |
|------|---------|
| `useReceipts` | Real-time subscription to `receipts` collection via `onSnapshot` |

### New Service Functions

| Function | Purpose |
|----------|---------|
| `uploadReceiptFile` | Upload image to Firebase Storage `receipts/{userId}/` |
| `subscribeReceipts` | `onSnapshot` listener with `docToReceipt` converter |
| `confirmReceiptMatch` | Set receipt `status: 'confirmed'` |
| `reassignReceipt` | Unlink from current transaction, link to new one, update both |
| `createExpenseFromReceipt` | Create manual transaction from extracted receipt data |
| `deleteReceipt` | Remove receipt document and storage file |

## PWA Share Target

**Prerequisites:** The app currently has no `manifest.json` or service worker. This phase requires scaffolding PWA infrastructure from scratch:

1. Create `web/public/manifest.json` with app metadata (name, icons, theme, display mode)
2. Create a service worker (`web/src/sw.ts`) with share target interception
3. Register the service worker in the app entry point
4. Configure Vite PWA plugin (or manual registration) for service worker bundling

### manifest.json (New File)

```json
{
  "share_target": {
    "action": "/dashboard/finance/receipts/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [
        {
          "name": "receipt",
          "accept": ["image/*", "application/pdf"]
        }
      ]
    }
  }
}
```

### Service Worker

Intercept the share target POST, extract the file, upload to Firebase Storage, and redirect to the receipts page. The existing Cloud Function pipeline handles the rest.

### Share Route

New route `/dashboard/finance/receipts/share` that:
1. Receives the shared file from the service worker
2. Triggers the upload flow
3. Redirects to the receipts page with a processing indicator

## Firebase Storage

Existing storage rules at `receipts/{userId}/{fileName}` already support this feature:
- Read: user can read their own receipts
- Write: user can write up to 10MB, images/PDF only

No storage rule changes needed.

## Migration

### `Transaction.receiptUrl` → `Transaction.receiptIds`

- Lazy migration: when a transaction with `receiptUrl` (no `receiptIds`) is loaded, create a receipt document from it, populate `receiptIds`, and clear `receiptUrl`
- Or: one-time migration script run during deployment
- Both approaches preserve existing data

### `ExpenseForm.tsx` Reconciliation

The existing `ExpenseForm.tsx` has its own receipt upload logic that writes directly to Storage and sets `receiptUrl` on the transaction. This must be updated to:
1. Use the new `uploadReceiptFile` service function
2. Create a `Receipt` document instead of setting `receiptUrl`
3. Link via `receiptIds` on the transaction

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Gemini extraction fails | Set `status: 'unmatched'` with empty extracted fields, allow manual data entry |
| File too large (>10MB) | Client-side validation prevents upload, show error toast |
| Invalid file type | Client-side validation, show error toast |
| No transactions to match | Receipt stays `unmatched`, auto-retry on future transaction sync |
| Storage upload fails | Show error toast, allow retry |

## Testing

- Unit tests for match scoring algorithm
- Unit tests for receipt service functions
- Integration test for Cloud Function pipeline (upload → extract → match)
- E2E test for upload flow (mobile capture attribute, desktop drag-drop)
- E2E test for confirm/reassign flow
