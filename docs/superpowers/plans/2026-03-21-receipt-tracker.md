# Receipt Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add receipt upload, Gemini OCR extraction, auto-matching to transactions, and manual reassignment to the Ten99 finance module.

**Architecture:** New `receipts` Firestore collection with its own lifecycle. Storage trigger fires a Cloud Function that sends images to Gemini 2.5 Flash for extraction, then auto-matches against transactions. Frontend gets a gallery grid page, detail view, and inline indicators on existing pages. PWA share target enables sharing from native scanner apps.

**Tech Stack:** React 19, TypeScript, Firebase (Firestore, Storage, Cloud Functions), Gemini 2.5 Flash, Vite, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-21-receipt-tracker-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `web/src/components/finance/ReceiptGrid.tsx` | Gallery grid of receipt cards with upload card |
| `web/src/components/finance/ReceiptCard.tsx` | Individual receipt card: rendered extraction, status badge |
| `web/src/components/finance/ReceiptDetail.tsx` | Split panel: rendered receipt + data + actions |
| `web/src/components/finance/ReceiptUploader.tsx` | Upload zone: mobile scan, desktop drag-drop, file validation |
| `web/src/components/finance/TransactionPicker.tsx` | Searchable transaction list for reassignment |
| `web/src/components/finance/ReceiptBadge.tsx` | Inline receipt status indicator for transaction rows |
| `web/src/routes/contractor/Receipts.tsx` | Receipts page route component |
| `functions/src/processReceipt.ts` | Storage trigger: Gemini extraction + auto-match |
| `functions/src/receiptMatchOnTransaction.ts` | Firestore trigger: match receipts when transactions arrive |
| `functions/src/utils/receiptMatching.ts` | Receipt-to-transaction scoring algorithm |
| `web/public/manifest.json` | PWA manifest with share target |
| `web/src/sw.ts` | Service worker for share target interception |

### Modified Files

| File | Change |
|------|--------|
| `web/src/lib/types.ts` | Add `Receipt` type, `ReceiptStatus` union, update `Transaction.receiptIds` |
| `web/src/services/firestore.ts` | Add receipt CRUD functions, `subscribeReceipts`, `docToReceipt` |
| `web/src/hooks/useFirestore.ts` | Add `useReceipts` hook |
| `web/src/App.tsx` | Add Receipts lazy import + route + share route |
| `web/src/components/Sidebar.tsx` | Add Receipts nav item under Finance |
| `web/src/components/finance/TransactionRow.tsx` | Add ReceiptBadge column |
| `web/src/components/finance/ExpenseForm.tsx` | Update to use new receipt service |
| `web/src/routes/contractor/Transactions.tsx` | Add receipt column header |
| `web/src/routes/contractor/Expenses.tsx` | Update receipt display to use Receipt docs |
| `firestore.rules` | Add receipts collection rules |
| `functions/src/index.ts` | Export new Cloud Functions |

---

### Task 1: Receipt Type & Firestore Rules

**Files:**
- Modify: `web/src/lib/types.ts:345` (after MatchStatus)
- Modify: `web/src/lib/types.ts:361-380` (Transaction interface)
- Modify: `firestore.rules:248` (after transactions rules)

- [ ] **Step 1: Add Receipt type to types.ts**

Add after the `MatchStatus` type on line 345:

```typescript
export type ReceiptStatus = 'processing' | 'unmatched' | 'matched' | 'confirmed';

export interface Receipt {
  id: string;
  ownerId: string;
  status: ReceiptStatus;
  imageUrl: string;
  fileName: string;
  uploadedAt: Date;
  vendor?: string;
  amount?: number;
  date?: Date;
  category?: string;
  lineItems?: Array<{ description: string; amount: number }>;
  rawText?: string;
  transactionId?: string;
  matchConfidence?: number;
  matchMethod?: 'auto' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Update Transaction interface**

In `web/src/lib/types.ts`, replace `receiptUrl?: string;` (line 376) with:

```typescript
receiptUrl?: string;    // Legacy — migrate to receiptIds
receiptIds?: string[];  // Linked Receipt document IDs
```

Keep `receiptUrl` for backward compatibility during migration.

- [ ] **Step 3: Add Firestore rules for receipts**

In `firestore.rules`, add after the `transactions` rules block (around line 259):

```
    match /receipts/{receiptId} {
      allow read: if isContractor() && resource.data.ownerId == request.auth.uid;
      allow create: if isContractor() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isContractor() && resource.data.ownerId == request.auth.uid
                     && request.resource.data.ownerId == request.auth.uid;
      allow delete: if isContractor() && resource.data.ownerId == request.auth.uid;
    }
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/types.ts firestore.rules
git commit -m "feat(receipts): add Receipt type and Firestore security rules"
```

---

### Task 2: Receipt Service Layer

**Files:**
- Modify: `web/src/services/firestore.ts:863` (after subscribeConnectedAccounts)

- [ ] **Step 1: Add docToReceipt converter**

Add after the `subscribeConnectedAccounts` function (around line 863) in `web/src/services/firestore.ts`:

```typescript
function docToReceipt(id: string, data: DocumentData): Receipt {
  return {
    id,
    ownerId: data.ownerId ?? '',
    status: data.status ?? 'processing',
    imageUrl: data.imageUrl ?? '',
    fileName: data.fileName ?? '',
    uploadedAt: data.uploadedAt?.toDate?.() ?? new Date(),
    vendor: data.vendor ?? undefined,
    amount: data.amount ?? undefined,
    date: data.date?.toDate?.() ?? undefined,
    category: data.category ?? undefined,
    lineItems: data.lineItems ?? undefined,
    rawText: data.rawText ?? undefined,
    transactionId: data.transactionId ?? undefined,
    matchConfidence: data.matchConfidence ?? undefined,
    matchMethod: data.matchMethod ?? undefined,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  };
}
```

- [ ] **Step 2: Add subscribeReceipts function**

Follow the `subscribeConnectedAccounts` pattern (lines 837-863):

```typescript
export function subscribeReceipts(
  callback: (receipts: Receipt[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, 'receipts'),
    where('ownerId', '==', user.uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const receipts = snapshot.docs
        .map((doc) => docToReceipt(doc.id, doc.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(receipts);
    },
    (error) => {
      console.error('receipts subscription error:', error);
      callback([]);
    }
  );
}
```

- [ ] **Step 3: Add uploadReceiptFile function**

```typescript
export async function uploadReceiptFile(file: File): Promise<{ imageUrl: string; receiptId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const timestamp = Date.now();
  const storageRef = ref(storage, `receipts/${user.uid}/${timestamp}-${file.name}`);
  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);

  // Create receipt doc client-side for instant UI feedback
  const docRef = await addDoc(collection(db, 'receipts'), {
    ownerId: user.uid,
    status: 'processing',
    imageUrl,
    fileName: file.name,
    uploadedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { imageUrl, receiptId: docRef.id };
}
```

- [ ] **Step 4: Add confirmReceiptMatch function**

```typescript
export async function confirmReceiptMatch(receiptId: string): Promise<void> {
  await updateDoc(doc(db, 'receipts', receiptId), {
    status: 'confirmed',
    updatedAt: Timestamp.now(),
  });
}
```

- [ ] **Step 5: Add reassignReceipt function**

```typescript
export async function reassignReceipt(
  receiptId: string,
  oldTransactionId: string | undefined,
  newTransactionId: string
): Promise<void> {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  // Update receipt
  batch.update(doc(db, 'receipts', receiptId), {
    transactionId: newTransactionId,
    matchMethod: 'manual',
    matchConfidence: 1.0,
    status: 'confirmed',
    updatedAt: now,
  });

  // Remove from old transaction
  if (oldTransactionId) {
    const oldTxRef = doc(db, 'transactions', oldTransactionId);
    const oldTxSnap = await getDoc(oldTxRef);
    if (oldTxSnap.exists()) {
      const oldIds: string[] = oldTxSnap.data().receiptIds ?? [];
      batch.update(oldTxRef, {
        receiptIds: oldIds.filter((id) => id !== receiptId),
        updatedAt: now,
      });
    }
  }

  // Add to new transaction
  const newTxRef = doc(db, 'transactions', newTransactionId);
  const newTxSnap = await getDoc(newTxRef);
  if (newTxSnap.exists()) {
    const newIds: string[] = newTxSnap.data().receiptIds ?? [];
    batch.update(newTxRef, {
      receiptIds: [...newIds, receiptId],
      updatedAt: now,
    });
  }

  await batch.commit();
}
```

- [ ] **Step 6: Add createExpenseFromReceipt function**

```typescript
export async function createExpenseFromReceipt(receiptId: string, receipt: Receipt): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const now = Timestamp.now();

  // Create manual expense transaction
  const txRef = await addDoc(collection(db, 'transactions'), {
    ownerId: user.uid,
    provider: 'manual',
    externalId: null,
    date: receipt.date ? Timestamp.fromDate(receipt.date) : now,
    amount: -(receipt.amount ?? 0),
    description: receipt.vendor ?? 'Receipt expense',
    category: receipt.category ?? 'Uncategorized',
    type: 'expense',
    matchStatus: 'unmatched',
    isManual: true,
    taxDeductible: false,
    receiptIds: [receiptId],
    createdAt: now,
    updatedAt: now,
  });

  // Link receipt to the new transaction
  await updateDoc(doc(db, 'receipts', receiptId), {
    transactionId: txRef.id,
    matchMethod: 'manual',
    matchConfidence: 1.0,
    status: 'confirmed',
    updatedAt: now,
  });

  return txRef.id;
}
```

- [ ] **Step 7: Add deleteReceipt function**

```typescript
export async function deleteReceipt(receiptId: string, imageUrl: string): Promise<void> {
  const storageRef = ref(storage, imageUrl);
  try {
    await deleteObject(storageRef);
  } catch {
    // Storage file may already be deleted — continue
  }
  await deleteDoc(doc(db, 'receipts', receiptId));
}
```

- [ ] **Step 8: Add necessary imports**

Add the following imports to `firestore.ts`:

- From `firebase/storage`: `ref`, `uploadBytes`, `getDownloadURL`, `deleteObject` (add to existing storage import or create new one)
- From `firebase/firestore`: `getDoc` (if not already imported)
- From `../lib/firebase`: `storage` (the Firebase Storage instance)
- From `../lib/types`: `Receipt`

- [ ] **Step 9: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add web/src/services/firestore.ts
git commit -m "feat(receipts): add receipt service layer (CRUD, subscription, upload)"
```

---

### Task 3: useReceipts Hook

**Files:**
- Modify: `web/src/hooks/useFirestore.ts:228` (after useConnectedAccounts)

- [ ] **Step 1: Add useReceipts hook**

Add after `useConnectedAccounts` (line 228) in `web/src/hooks/useFirestore.ts`:

```typescript
export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = whenAuthReady(() =>
      subscribeReceipts((items) => {
        setReceipts(items);
        setLoading(false);
      }),
    );
    return unsubscribe;
  }, []);

  return { receipts, loading };
}
```

- [ ] **Step 2: Add imports**

Add `Receipt` to the types import and `subscribeReceipts` to the firestore service import at the top of the file.

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add web/src/hooks/useFirestore.ts
git commit -m "feat(receipts): add useReceipts real-time hook"
```

---

### Task 4: Receipt Matching Algorithm (Cloud Functions)

**Files:**
- Create: `functions/src/utils/receiptMatching.ts`

- [ ] **Step 1: Write receipt matching scoring functions**

Create `functions/src/utils/receiptMatching.ts`. Model after existing `functions/src/utils/matching.ts` (118 lines) but adapted for receipt-to-transaction matching:

```typescript
/**
 * Scoring utilities for matching receipts to bank transactions.
 * All scores are in the range [0, 1].
 */

export interface ReceiptData {
  vendor?: string;
  amount?: number;
  date?: Date;
}

export interface TransactionData {
  amount: number;
  date: Date;
  description: string;
}

/**
 * Scores how closely a receipt amount matches a transaction amount.
 * Compares absolute values since transactions store expenses as negative.
 *
 * - Exact match: 1.0
 * - Within ±$1: 0.8
 * - Within ±5%: 0.5
 * - Otherwise: 0
 */
export function scoreReceiptAmount(receiptAmount: number, txAmount: number): number {
  const ra = Math.abs(receiptAmount);
  const ta = Math.abs(txAmount);

  if (ra === 0 && ta === 0) return 1.0;
  if (ra === 0 || ta === 0) return 0;

  const diff = Math.abs(ra - ta);

  if (diff === 0) return 1.0;
  if (diff <= 1.0) return 0.8;
  if (diff / ra <= 0.05) return 0.5;
  return 0;
}

/**
 * Scores how closely a receipt date matches a transaction date.
 *
 * - Same day: 1.0
 * - Within ±1 day: 0.8
 * - Within ±3 days: 0.5
 * - Otherwise: 0
 */
export function scoreReceiptDate(receiptDate: Date, txDate: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diffDays = Math.abs(receiptDate.getTime() - txDate.getTime()) / MS_PER_DAY;

  if (diffDays < 0.5) return 1.0;
  if (diffDays <= 1) return 0.8;
  if (diffDays <= 3) return 0.5;
  return 0;
}

/**
 * Scores how closely a receipt vendor matches a transaction description.
 * Case-insensitive comparison.
 *
 * - Substring match: 1.0
 * - Normalized partial match (>50% of vendor in description): 0.7
 * - Otherwise: 0
 */
export function scoreReceiptVendor(vendor: string, description: string): number {
  const v = vendor.toLowerCase().trim();
  const d = description.toLowerCase().trim();

  if (!v || !d) return 0;
  if (d.includes(v) || v.includes(d)) return 1.0;

  // Check if significant words from vendor appear in description
  const vendorWords = v.split(/\s+/).filter((w) => w.length > 2);
  if (vendorWords.length === 0) return 0;

  const matchedWords = vendorWords.filter((w) => d.includes(w));
  const ratio = matchedWords.length / vendorWords.length;

  if (ratio > 0.5) return 0.7;
  return 0;
}

/**
 * Computes a weighted composite match score between a receipt and a transaction.
 *
 * Weights:
 * - Amount: 0.5
 * - Vendor: 0.3
 * - Date:   0.2
 */
export function computeReceiptMatchScore(receipt: ReceiptData, tx: TransactionData): number {
  const amountScore = receipt.amount != null ? scoreReceiptAmount(receipt.amount, tx.amount) : 0;
  const vendorScore = receipt.vendor ? scoreReceiptVendor(receipt.vendor, tx.description) : 0;
  const dateScore = receipt.date ? scoreReceiptDate(receipt.date, tx.date) : 0;

  return amountScore * 0.5 + vendorScore * 0.3 + dateScore * 0.2;
}
```

- [ ] **Step 2: Verify functions build**

Run: `cd functions && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add functions/src/utils/receiptMatching.ts
git commit -m "feat(receipts): add receipt-to-transaction matching algorithm"
```

---

### Task 5: processReceipt Cloud Function (Storage Trigger)

**Files:**
- Create: `functions/src/processReceipt.ts`
- Modify: `functions/src/index.ts:25` (add export)

- [ ] **Step 1: Create processReceipt Cloud Function**

Create `functions/src/processReceipt.ts`:

```typescript
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getGeminiClient } from './utils/geminiClient';
import { computeReceiptMatchScore, ReceiptData, TransactionData } from './utils/receiptMatching';
import * as logger from 'firebase-functions/logger';

const EXPENSE_CATEGORIES = [
  'Software & Subscriptions', 'Equipment & Tools', 'Office Supplies', 'Travel',
  'Meals & Entertainment', 'Vehicle & Fuel', 'Insurance', 'Professional Services',
  'Advertising & Marketing', 'Utilities & Telecom', 'Subcontractors',
  'Materials & Supplies', 'Education & Training', 'Uncategorized',
] as const;

const MATCH_THRESHOLD = 0.7;

export const onReceiptUploaded = onObjectFinalized(
  { bucket: undefined }, // default bucket
  async (event) => {
    const filePath = event.data.name;
    if (!filePath) return;

    // Only process files in receipts/ directory
    const match = filePath.match(/^receipts\/([^/]+)\//);
    if (!match) return;

    const userId = match[1];
    const contentType = event.data.contentType ?? '';

    // Validate file type
    if (!contentType.startsWith('image/') && contentType !== 'application/pdf') {
      logger.warn('Invalid receipt file type', { filePath, contentType });
      return;
    }

    const db = getFirestore();
    const storage = getStorage();

    // Find the receipt doc created client-side (by imageUrl match)
    const bucket = storage.bucket();
    const file = bucket.file(filePath);
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });

    // Find receipt doc by matching the storage path in imageUrl
    const receiptsSnap = await db
      .collection('receipts')
      .where('ownerId', '==', userId)
      .where('status', '==', 'processing')
      .get();

    // Match by fileName or most recent processing receipt
    const fileName = filePath.split('/').pop() ?? '';
    let receiptDoc = receiptsSnap.docs.find((d) => {
      const data = d.data();
      return data.imageUrl?.includes(fileName);
    });

    if (!receiptDoc) {
      // Fallback: use most recent processing receipt
      receiptDoc = receiptsSnap.docs
        .sort((a, b) => b.data().createdAt?.toMillis() - a.data().createdAt?.toMillis())[0];
    }

    if (!receiptDoc) {
      logger.warn('No matching receipt doc found for uploaded file', { filePath, userId });
      return;
    }

    // Download file for Gemini
    const [fileBuffer] = await file.download();
    const base64Image = fileBuffer.toString('base64');

    // Send to Gemini for extraction
    let extracted: {
      vendor?: string;
      amount?: number;
      date?: string;
      category?: string;
      lineItems?: Array<{ description: string; amount: number }>;
      rawText?: string;
    } = {};

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Extract structured data from this receipt image. Return a JSON object with these fields:
- vendor: string (merchant/store name)
- amount: number (total amount paid, as a positive number)
- date: string (date of purchase in ISO 8601 format YYYY-MM-DD)
- category: string (best match from: ${EXPENSE_CATEGORIES.join(', ')})
- lineItems: array of { description: string, amount: number } (individual items if visible)
- rawText: string (full text content of the receipt)

Return ONLY the JSON object, no markdown formatting.`;

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: contentType,
            data: base64Image,
          },
        },
      ]);

      const responseText = result.response.text().trim();
      // Strip markdown code fences if present
      const jsonStr = responseText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      extracted = JSON.parse(jsonStr);
    } catch (error) {
      logger.error('Gemini extraction failed', { receiptId: receiptDoc.id, error });
      // Set to unmatched with no extracted data — user can enter manually
      await receiptDoc.ref.update({
        status: 'unmatched',
        updatedAt: Timestamp.now(),
      });
      return;
    }

    // Update receipt with extracted data
    const receiptUpdate: Record<string, unknown> = {
      vendor: extracted.vendor ?? null,
      amount: extracted.amount ?? null,
      date: extracted.date ? Timestamp.fromDate(new Date(extracted.date)) : null,
      category: extracted.category ?? 'Uncategorized',
      lineItems: extracted.lineItems ?? [],
      rawText: extracted.rawText ?? null,
      status: 'unmatched',
      updatedAt: Timestamp.now(),
    };

    // Attempt auto-match against owner's expense transactions
    const txSnap = await db
      .collection('transactions')
      .where('ownerId', '==', userId)
      .where('type', '==', 'expense')
      .get();

    const receiptData: ReceiptData = {
      vendor: extracted.vendor,
      amount: extracted.amount,
      date: extracted.date ? new Date(extracted.date) : undefined,
    };

    let bestScore = 0;
    let bestTxId: string | null = null;

    for (const txDoc of txSnap.docs) {
      const txData = txDoc.data();

      // Skip transactions that already have confirmed receipts
      const existingReceiptIds: string[] = txData.receiptIds ?? [];
      if (existingReceiptIds.length > 0) {
        // Check if any linked receipt is confirmed
        const linkedReceipts = await Promise.all(
          existingReceiptIds.map((rid) => db.collection('receipts').doc(rid).get())
        );
        const hasConfirmed = linkedReceipts.some((r) => r.exists && r.data()?.status === 'confirmed');
        if (hasConfirmed) continue;
      }

      const tx: TransactionData = {
        amount: txData.amount as number,
        date: (txData.date as Timestamp).toDate(),
        description: (txData.description as string) ?? '',
      };

      const score = computeReceiptMatchScore(receiptData, tx);
      if (score > bestScore) {
        bestScore = score;
        bestTxId = txDoc.id;
      }
    }

    if (bestScore >= MATCH_THRESHOLD && bestTxId) {
      receiptUpdate.status = 'matched';
      receiptUpdate.transactionId = bestTxId;
      receiptUpdate.matchConfidence = bestScore;
      receiptUpdate.matchMethod = 'auto';

      // Add receipt ID to transaction
      await db.collection('transactions').doc(bestTxId).update({
        receiptIds: FieldValue.arrayUnion(receiptDoc.id),
        updatedAt: Timestamp.now(),
      });

      logger.info('Receipt auto-matched to transaction', {
        receiptId: receiptDoc.id,
        transactionId: bestTxId,
        confidence: bestScore,
      });
    } else {
      logger.info('No transaction match found for receipt', {
        receiptId: receiptDoc.id,
        bestScore,
      });
    }

    await receiptDoc.ref.update(receiptUpdate);
  },
);
```

- [ ] **Step 2: Export from index.ts**

Add to `functions/src/index.ts` after line 25:

```typescript
export { onReceiptUploaded } from './processReceipt';
```

- [ ] **Step 3: Verify functions build**

Run: `cd functions && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add functions/src/processReceipt.ts functions/src/index.ts
git commit -m "feat(receipts): add processReceipt Cloud Function with Gemini OCR"
```

---

### Task 6: receiptMatchOnTransaction Cloud Function

**Files:**
- Create: `functions/src/receiptMatchOnTransaction.ts`
- Modify: `functions/src/index.ts` (add export)

- [ ] **Step 1: Create receiptMatchOnTransaction Cloud Function**

Create `functions/src/receiptMatchOnTransaction.ts`:

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { computeReceiptMatchScore, ReceiptData, TransactionData } from './utils/receiptMatching';
import * as logger from 'firebase-functions/logger';

const MATCH_THRESHOLD = 0.7;

/**
 * When a new expense transaction is created, check for unmatched receipts
 * that could match. Separate from onTransactionCreated (which handles
 * income/invoice matching in matchTransaction.ts).
 */
export const onReceiptMatchOnTransaction = onDocumentCreated(
  'transactions/{docId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();

    // Only process expense transactions
    if (data.type !== 'expense') return;

    // Skip if transaction already has confirmed receipts
    const existingIds: string[] = data.receiptIds ?? [];
    if (existingIds.length > 0) return;

    const ownerId = data.ownerId as string;
    if (!ownerId) return;

    const db = getFirestore();

    // Query unmatched receipts for this owner
    const receiptsSnap = await db
      .collection('receipts')
      .where('ownerId', '==', ownerId)
      .where('status', '==', 'unmatched')
      .get();

    if (receiptsSnap.empty) return;

    const tx: TransactionData = {
      amount: data.amount as number,
      date: (data.date as Timestamp).toDate(),
      description: (data.description as string) ?? '',
    };

    let bestScore = 0;
    let bestReceiptId: string | null = null;
    let bestReceiptData: ReceiptData | null = null;

    for (const receiptDoc of receiptsSnap.docs) {
      const rData = receiptDoc.data();
      const receipt: ReceiptData = {
        vendor: rData.vendor as string | undefined,
        amount: rData.amount as number | undefined,
        date: rData.date ? (rData.date as Timestamp).toDate() : undefined,
      };

      const score = computeReceiptMatchScore(receipt, tx);
      if (score > bestScore) {
        bestScore = score;
        bestReceiptId = receiptDoc.id;
        bestReceiptData = receipt;
      }
    }

    if (bestScore >= MATCH_THRESHOLD && bestReceiptId) {
      const now = Timestamp.now();

      await Promise.all([
        db.collection('receipts').doc(bestReceiptId).update({
          transactionId: snap.id,
          matchConfidence: bestScore,
          matchMethod: 'auto',
          status: 'matched',
          updatedAt: now,
        }),
        snap.ref.update({
          receiptIds: FieldValue.arrayUnion(bestReceiptId),
          updatedAt: now,
        }),
      ]);

      logger.info('Receipt matched to new transaction', {
        receiptId: bestReceiptId,
        transactionId: snap.id,
        confidence: bestScore,
      });
    }
  },
);
```

- [ ] **Step 2: Export from index.ts**

Add to `functions/src/index.ts`:

```typescript
export { onReceiptMatchOnTransaction } from './receiptMatchOnTransaction';
```

- [ ] **Step 3: Verify functions build**

Run: `cd functions && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add functions/src/receiptMatchOnTransaction.ts functions/src/index.ts
git commit -m "feat(receipts): add reverse-match Cloud Function for new transactions"
```

---

### Task 7: ReceiptUploader Component

**Files:**
- Create: `web/src/components/finance/ReceiptUploader.tsx`

- [ ] **Step 1: Create ReceiptUploader component**

Create `web/src/components/finance/ReceiptUploader.tsx`:

```typescript
import { useState, useRef, useCallback } from 'react';
import { uploadReceiptFile } from '../../services/firestore';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'];

interface ReceiptUploaderProps {
  onUploadComplete?: (receiptId: string) => void;
  onError?: (message: string) => void;
}

export default function ReceiptUploader({ onUploadComplete, onError }: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return 'File must be under 10MB';
    if (!ACCEPTED_TYPES.some((t) => file.type.startsWith(t.split('/')[0]) || file.type === t)) {
      return 'Only images and PDFs are accepted';
    }
    return null;
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setUploading(true);

    try {
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          onError?.(error);
          continue;
        }
        const { receiptId } = await uploadReceiptFile(file);
        onUploadComplete?.(receiptId);
      }
    } catch {
      onError?.('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  if (uploading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Uploading...</p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer ${
        dragActive
          ? 'border-[var(--accent)] bg-[var(--accent)]/10'
          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={scanInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <p className="text-2xl">+</p>
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Upload Receipt</p>
      <p className="text-xs text-[var(--text-secondary)]">Drop files or click to browse</p>

      {/* Mobile: show scan button */}
      <button
        className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white sm:hidden"
        onClick={(e) => {
          e.stopPropagation();
          scanInputRef.current?.click();
        }}
      >
        Scan Receipt
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add web/src/components/finance/ReceiptUploader.tsx
git commit -m "feat(receipts): add ReceiptUploader component with mobile scan + drag-drop"
```

---

### Task 8: ReceiptCard Component

**Files:**
- Create: `web/src/components/finance/ReceiptCard.tsx`

- [ ] **Step 1: Create ReceiptCard component**

Create `web/src/components/finance/ReceiptCard.tsx`:

```typescript
import type { Receipt } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

const STATUS_STYLES: Record<Receipt['status'], { bg: string; text: string; label: string }> = {
  processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Processing' },
  unmatched: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Unmatched' },
  matched: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Review Match' },
  confirmed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Confirmed' },
};

interface ReceiptCardProps {
  receipt: Receipt;
  onClick: (receipt: Receipt) => void;
}

export default function ReceiptCard({ receipt, onClick }: ReceiptCardProps) {
  const status = STATUS_STYLES[receipt.status];

  return (
    <button
      className="flex flex-col rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 text-left transition-shadow hover:shadow-lg cursor-pointer"
      onClick={() => onClick(receipt)}
    >
      {/* Rendered extraction preview */}
      <div className="mb-3 flex-1 rounded-lg bg-[var(--bg-page)] p-3 text-xs">
        {receipt.status === 'processing' ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : (
          <>
            <p className="font-bold text-center text-[var(--text-primary)]">
              {receipt.vendor ?? 'Unknown'}
            </p>
            {receipt.lineItems && receipt.lineItems.length > 0 && (
              <div className="mt-2 space-y-0.5 text-[var(--text-secondary)]">
                {receipt.lineItems.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="truncate mr-2">{item.description}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                {receipt.lineItems.length > 3 && (
                  <p className="text-[var(--text-secondary)]/60">
                    +{receipt.lineItems.length - 3} more
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Vendor + amount */}
      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
        {receipt.vendor ?? 'Processing...'}
      </p>
      {receipt.amount != null && (
        <p className="text-sm font-bold text-[var(--accent)]">
          {formatCurrency(receipt.amount)}
        </p>
      )}

      {/* Status badge */}
      <span className={`mt-2 inline-block self-start rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
        {status.label}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add web/src/components/finance/ReceiptCard.tsx
git commit -m "feat(receipts): add ReceiptCard component with rendered extraction"
```

---

### Task 9: TransactionPicker Component

**Files:**
- Create: `web/src/components/finance/TransactionPicker.tsx`

- [ ] **Step 1: Create TransactionPicker component**

Create `web/src/components/finance/TransactionPicker.tsx`:

```typescript
import { useState, useEffect, useMemo } from 'react';
import type { Transaction, Receipt } from '../../lib/types';
import { fetchTransactions } from '../../services/firestore';
import { computeReceiptMatchScoreClient } from '../../lib/receiptMatchClient';
import { formatCurrency, formatDate } from '../../lib/utils';

interface TransactionPickerProps {
  receipt: Receipt;
  onSelect: (transactionId: string) => void;
  onCreateExpense: () => void;
  onClose: () => void;
}

export default function TransactionPicker({ receipt, onSelect, onCreateExpense, onClose }: TransactionPickerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions({ type: 'expense' })
      .then(({ transactions: txs }) => {
        setTransactions(txs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const scored = useMemo(() => {
    return transactions.map((tx) => ({
      tx,
      score: computeReceiptMatchScoreClient(receipt, tx),
    }));
  }, [transactions, receipt]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? scored.filter(({ tx }) =>
          tx.description.toLowerCase().includes(q) ||
          Math.abs(tx.amount).toString().includes(q)
        )
      : scored;
    return list.sort((a, b) => b.score - a.score);
  }, [scored, search]);

  const suggested = filtered.filter(({ score }) => score >= 0.3);
  const rest = filtered.filter(({ score }) => score < 0.3);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="font-semibold text-[var(--text-primary)]">Assign to Transaction</h3>
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          &times;
        </button>
      </div>

      <div className="p-4">
        <input
          type="text"
          placeholder="Search by vendor, amount..."
          className="w-full rounded-lg bg-[var(--bg-page)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading transactions...</p>
        ) : (
          <>
            {suggested.length > 0 && (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Suggested Matches
                </p>
                {suggested.map(({ tx, score }) => (
                  <button
                    key={tx.id}
                    className="mb-2 w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border)] p-3 text-left hover:border-[var(--accent)] transition-colors cursor-pointer"
                    onClick={() => onSelect(tx.id)}
                  >
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{tx.description}</span>
                      <span className="text-sm font-bold text-[var(--accent)]">{formatCurrency(Math.abs(tx.amount))}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-[var(--text-secondary)]">{formatDate(tx.date)}</span>
                      <span className="text-xs text-yellow-400">{Math.round(score * 100)}%</span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {rest.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  All Transactions
                </p>
                {rest.map(({ tx }) => (
                  <button
                    key={tx.id}
                    className="mb-2 w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border)] p-3 text-left hover:border-[var(--accent)] transition-colors cursor-pointer"
                    onClick={() => onSelect(tx.id)}
                  >
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{tx.description}</span>
                      <span className="text-sm font-bold text-[var(--accent)]">{formatCurrency(Math.abs(tx.amount))}</span>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">{formatDate(tx.date)}</span>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        <button
          className="w-full rounded-lg bg-[var(--bg-page)] border border-[var(--border)] py-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          onClick={onCreateExpense}
        >
          No match — Create Manual Expense
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create client-side matching utility**

Create `web/src/lib/receiptMatchClient.ts` — a lightweight client-side version of the scoring algorithm for ranking suggestions in the TransactionPicker:

```typescript
import type { Receipt, Transaction } from './types';

export function computeReceiptMatchScoreClient(receipt: Receipt, tx: Transaction): number {
  let score = 0;

  // Amount (weight: 0.5)
  if (receipt.amount != null) {
    const ra = Math.abs(receipt.amount);
    const ta = Math.abs(tx.amount);
    const diff = Math.abs(ra - ta);
    if (diff === 0) score += 0.5;
    else if (diff <= 1) score += 0.4;
    else if (ra > 0 && diff / ra <= 0.05) score += 0.25;
  }

  // Vendor (weight: 0.3)
  if (receipt.vendor) {
    const v = receipt.vendor.toLowerCase();
    const d = tx.description.toLowerCase();
    if (d.includes(v) || v.includes(d)) score += 0.3;
    else {
      const words = v.split(/\s+/).filter((w) => w.length > 2);
      const matched = words.filter((w) => d.includes(w));
      if (words.length > 0 && matched.length / words.length > 0.5) score += 0.21;
    }
  }

  // Date (weight: 0.2)
  if (receipt.date) {
    const diffMs = Math.abs(receipt.date.getTime() - tx.date.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0.5) score += 0.2;
    else if (diffDays <= 1) score += 0.16;
    else if (diffDays <= 3) score += 0.1;
  }

  return score;
}
```

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add web/src/components/finance/TransactionPicker.tsx web/src/lib/receiptMatchClient.ts
git commit -m "feat(receipts): add TransactionPicker and client-side match scoring"
```

---

### Task 10: ReceiptDetail Component

**Files:**
- Create: `web/src/components/finance/ReceiptDetail.tsx`

- [ ] **Step 1: Create ReceiptDetail component**

Create `web/src/components/finance/ReceiptDetail.tsx`:

```typescript
import { useState, useEffect } from 'react';
import type { Receipt, Transaction } from '../../lib/types';
import { confirmReceiptMatch, reassignReceipt, createExpenseFromReceipt, fetchTransactions } from '../../services/firestore';
import { formatCurrency, formatDate } from '../../lib/utils';
import { EXPENSE_CATEGORIES } from '../../lib/types';
import TransactionPicker from './TransactionPicker';

interface ReceiptDetailProps {
  receipt: Receipt;
  onClose: () => void;
}

export default function ReceiptDetail({ receipt, onClose }: ReceiptDetailProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [matchedTx, setMatchedTx] = useState<Transaction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    if (receipt.transactionId) {
      fetchTransactions({ type: 'expense' }).then(({ transactions }) => {
        const tx = transactions.find((t) => t.id === receipt.transactionId);
        if (tx) setMatchedTx(tx);
      });
    }
  }, [receipt.transactionId]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await confirmReceiptMatch(receipt.id);
    } finally {
      setConfirming(false);
    }
  };

  const handleReassign = async (newTxId: string) => {
    await reassignReceipt(receipt.id, receipt.transactionId, newTxId);
    setShowPicker(false);
  };

  const handleCreateExpense = async () => {
    await createExpenseFromReceipt(receipt.id, receipt);
    setShowPicker(false);
  };

  if (showPicker) {
    return (
      <TransactionPicker
        receipt={receipt}
        onSelect={handleReassign}
        onCreateExpense={handleCreateExpense}
        onClose={() => setShowPicker(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="font-semibold text-[var(--text-primary)]">Receipt Detail</h3>
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          &times;
        </button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1">
        {/* Left: Rendered extraction */}
        <div className="flex-1 p-4 border-b lg:border-b-0 lg:border-r border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Receipt</p>
            <button
              className="text-xs text-[var(--accent)] hover:underline"
              onClick={() => setShowImage(!showImage)}
            >
              {showImage ? 'Show Extraction' : 'Show Original'}
            </button>
          </div>

          {showImage ? (
            <img
              src={receipt.imageUrl}
              alt="Receipt"
              className="w-full rounded-lg border border-[var(--border)]"
            />
          ) : (
            <div className="rounded-lg bg-[var(--bg-page)] p-4 font-mono text-xs leading-relaxed">
              <p className="text-center font-bold text-sm text-[var(--text-primary)]">
                {receipt.vendor ?? 'Unknown Vendor'}
              </p>
              {receipt.date && (
                <p className="text-center text-[var(--text-secondary)] mt-1">
                  {formatDate(receipt.date)}
                </p>
              )}

              {receipt.lineItems && receipt.lineItems.length > 0 && (
                <div className="mt-3 border-t border-dashed border-[var(--border)] pt-2 space-y-1">
                  {receipt.lineItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-[var(--text-primary)]">
                      <span className="truncate mr-2">{item.description}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {receipt.amount != null && (
                <div className="mt-2 border-t border-dashed border-[var(--border)] pt-2">
                  <div className="flex justify-between font-bold text-sm text-[var(--text-primary)]">
                    <span>TOTAL</span>
                    <span>{formatCurrency(receipt.amount)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Extracted data + match */}
        <div className="flex-1 p-4">
          {/* Vendor */}
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-1">Vendor</p>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              {receipt.vendor ?? 'Unknown'}
            </p>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-1">Amount</p>
              <p className="text-base font-bold text-[var(--accent)]">
                {receipt.amount != null ? formatCurrency(receipt.amount) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-1">Date</p>
              <p className="text-base text-[var(--text-primary)]">
                {receipt.date ? formatDate(receipt.date) : '—'}
              </p>
            </div>
          </div>

          {/* Category */}
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-1">Category</p>
            <p className="text-sm text-[var(--text-primary)]">
              {receipt.category ?? 'Uncategorized'}
            </p>
          </div>

          {/* Matched transaction */}
          {(receipt.status === 'matched' || receipt.status === 'confirmed') && matchedTx && (
            <div className="border-t border-[var(--border)] pt-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Matched Transaction
                </p>
                {receipt.matchConfidence != null && (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                    {Math.round(receipt.matchConfidence * 100)}% match
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-[var(--bg-page)] border border-[var(--border)] p-3">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{matchedTx.description}</span>
                  <span className="text-sm font-bold text-[var(--accent)]">
                    {formatCurrency(Math.abs(matchedTx.amount))}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {formatDate(matchedTx.date)}
                </p>
              </div>
            </div>
          )}

          {/* Unmatched state */}
          {receipt.status === 'unmatched' && (
            <div className="border-t border-[var(--border)] pt-4 mb-4">
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                No Match Found
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Assign to a transaction or create a manual expense.
              </p>
            </div>
          )}

          {/* Actions */}
          {receipt.status !== 'processing' && receipt.status !== 'confirmed' && (
            <div className="flex gap-2 mt-4">
              {receipt.status === 'matched' && (
                <button
                  className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  onClick={handleConfirm}
                  disabled={confirming}
                >
                  {confirming ? 'Confirming...' : 'Confirm Match'}
                </button>
              )}
              <button
                className="flex-1 rounded-lg bg-[var(--bg-page)] border border-[var(--border)] py-2.5 text-sm text-[var(--text-primary)] hover:border-[var(--accent)]"
                onClick={() => setShowPicker(true)}
              >
                {receipt.status === 'unmatched' ? 'Assign Transaction' : 'Reassign'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add web/src/components/finance/ReceiptDetail.tsx
git commit -m "feat(receipts): add ReceiptDetail with rendered extraction + reassignment"
```

---

### Task 11: ReceiptGrid, ReceiptBadge & Receipts Page

**Files:**
- Create: `web/src/components/finance/ReceiptGrid.tsx`
- Create: `web/src/components/finance/ReceiptBadge.tsx`
- Create: `web/src/routes/contractor/Receipts.tsx`
- Modify: `web/src/App.tsx:27` (add lazy import + route)
- Modify: `web/src/components/Sidebar.tsx:38` (add nav item)

- [ ] **Step 1: Create ReceiptGrid component**

Create `web/src/components/finance/ReceiptGrid.tsx`:

```typescript
import type { Receipt } from '../../lib/types';
import ReceiptCard from './ReceiptCard';
import ReceiptUploader from './ReceiptUploader';

interface ReceiptGridProps {
  receipts: Receipt[];
  onReceiptClick: (receipt: Receipt) => void;
  onUploadComplete?: (receiptId: string) => void;
  onUploadError?: (message: string) => void;
}

export default function ReceiptGrid({ receipts, onReceiptClick, onUploadComplete, onUploadError }: ReceiptGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <ReceiptUploader onUploadComplete={onUploadComplete} onError={onUploadError} />
      {receipts.map((receipt) => (
        <ReceiptCard key={receipt.id} receipt={receipt} onClick={onReceiptClick} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create ReceiptBadge component**

Create `web/src/components/finance/ReceiptBadge.tsx`:

```typescript
interface ReceiptBadgeProps {
  status: 'confirmed' | 'matched' | 'none';
  onClick?: () => void;
}

export default function ReceiptBadge({ status, onClick }: ReceiptBadgeProps) {
  if (status === 'confirmed') {
    return (
      <button onClick={onClick} className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400 cursor-pointer hover:bg-green-500/30">
        🧾 ✓
      </button>
    );
  }

  if (status === 'matched') {
    return (
      <button onClick={onClick} className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400 cursor-pointer hover:bg-yellow-500/30">
        🧾 ?
      </button>
    );
  }

  return (
    <button onClick={onClick} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer">
      —
    </button>
  );
}
```

- [ ] **Step 3: Create Receipts page route**

Create `web/src/routes/contractor/Receipts.tsx`:

```typescript
import { useState } from 'react';
import { useReceipts } from '../../hooks/useFirestore';
import type { Receipt } from '../../lib/types';
import ReceiptGrid from '../../components/finance/ReceiptGrid';
import ReceiptDetail from '../../components/finance/ReceiptDetail';

export default function Receipts() {
  const { receipts, loading } = useReceipts();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep selected receipt in sync with real-time data
  const currentReceipt = selectedReceipt
    ? receipts.find((r) => r.id === selectedReceipt.id) ?? selectedReceipt
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Receipts</h1>
        <div className="flex gap-2 text-xs text-[var(--text-secondary)]">
          <span>{receipts.filter((r) => r.status === 'unmatched').length} unmatched</span>
          <span>·</span>
          <span>{receipts.filter((r) => r.status === 'matched').length} to review</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <ReceiptGrid
        receipts={receipts}
        onReceiptClick={setSelectedReceipt}
        onUploadError={setError}
      />

      {/* Detail slide-over */}
      {currentReceipt && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedReceipt(null)} />
          <div className="relative ml-auto w-full max-w-2xl bg-[var(--bg-card)] shadow-xl">
            <ReceiptDetail
              receipt={currentReceipt}
              onClose={() => setSelectedReceipt(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add lazy import and route to App.tsx**

In `web/src/App.tsx`, add lazy import after line 27 (`const Expenses = ...`):

```typescript
const Receipts = lazy(() => import('./routes/contractor/Receipts'));
```

Add route after line 315 (`<Route path="finance/expenses" ...>`):

```typescript
<Route path="finance/receipts" element={<Receipts />} />
```

- [ ] **Step 5: Add Receipts to Sidebar navigation**

In `web/src/components/Sidebar.tsx`, add after the expenses nav item (line 38):

```typescript
{ to: '/dashboard/finance/receipts', key: 'finance-receipts', label: 'Receipts', Icon: IconDocument },
```

Note: Use an existing icon from the icon library. Check `Icons.tsx` for an appropriate icon — `IconDocument` or similar.

- [ ] **Step 6: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add web/src/components/finance/ReceiptGrid.tsx web/src/components/finance/ReceiptBadge.tsx web/src/routes/contractor/Receipts.tsx web/src/App.tsx web/src/components/Sidebar.tsx
git commit -m "feat(receipts): add Receipts page, grid, badge, and navigation"
```

---

### Task 12: Inline Receipt Indicators on Transactions Page

**Files:**
- Modify: `web/src/components/finance/TransactionRow.tsx:74-145`
- Modify: `web/src/routes/contractor/Transactions.tsx:359-376` (header row)

- [ ] **Step 1: Add ReceiptBadge to TransactionRow**

In `web/src/components/finance/TransactionRow.tsx`, add the ReceiptBadge import and a receipt column to the row. The component receives the transaction — check `receiptIds` to determine badge status.

Add a new prop `receiptStatus` and render `ReceiptBadge` between the amount cell and category select (around line 126). The parent component will compute the status from receipt data.

- [ ] **Step 2: Add Receipt column header to Transactions page**

In `web/src/routes/contractor/Transactions.tsx`, add "Receipt" to the table header row (around line 370).

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add web/src/components/finance/TransactionRow.tsx web/src/routes/contractor/Transactions.tsx
git commit -m "feat(receipts): add receipt status indicators on Transactions page"
```

---

### Task 13: Update ExpenseForm to Use New Receipt Service

**Files:**
- Modify: `web/src/components/finance/ExpenseForm.tsx:61-69` (receipt upload)
- Modify: `web/src/routes/contractor/Expenses.tsx:135-144` (receipt display)

- [ ] **Step 1: Update ExpenseForm upload logic**

In `web/src/components/finance/ExpenseForm.tsx`, replace the `uploadReceipt` function (lines 61-69) to use the new `uploadReceiptFile` service. After creating the expense transaction, link the receipt to it.

- [ ] **Step 2: Update Expenses page receipt display**

In `web/src/routes/contractor/Expenses.tsx`, update the receipt link display (lines 135-144) to work with both legacy `receiptUrl` and new `receiptIds`.

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add web/src/components/finance/ExpenseForm.tsx web/src/routes/contractor/Expenses.tsx
git commit -m "refactor(receipts): update ExpenseForm to use new receipt service layer"
```

---

### Task 14: PWA Share Target

**Files:**
- Create: `web/public/manifest.json`
- Create: `web/src/sw.ts`
- Modify: `web/src/main.tsx` or `web/index.html` (register service worker + manifest link)
- Modify: `web/src/App.tsx` (add share route)

- [ ] **Step 1: Create manifest.json**

Create `web/public/manifest.json`:

```json
{
  "name": "Ten99",
  "short_name": "Ten99",
  "description": "Work order management for independent contractors",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
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

- [ ] **Step 2: Create service worker**

Create `web/src/sw.ts`:

```typescript
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle share target POST
  if (url.pathname === '/dashboard/finance/receipts/share' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const files = formData.getAll('receipt');

        // Store files temporarily in Cache API for the page to pick up
        const cache = await caches.open('share-target');
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file instanceof File) {
            const response = new Response(file, {
              headers: { 'Content-Type': file.type, 'X-Filename': file.name },
            });
            await cache.put(`/shared-receipt-${i}`, response);
          }
        }

        return Response.redirect('/dashboard/finance/receipts?shared=true', 303);
      })()
    );
  }
});
```

- [ ] **Step 3: Add manifest link and service worker registration**

In `web/index.html`, add to `<head>`:

```html
<link rel="manifest" href="/manifest.json">
```

In `web/src/main.tsx`, add service worker registration after app initialization:

```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

- [ ] **Step 4: Handle shared files on Receipts page**

In `web/src/routes/contractor/Receipts.tsx`, add a `useEffect` that checks for `?shared=true` URL param, reads files from the share-target cache, uploads them, and clears the cache.

- [ ] **Step 5: Configure Vite to copy service worker**

Add the service worker to the Vite build config so it's available at `/sw.js`. This may require a Vite plugin or manual copy step.

- [ ] **Step 6: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds, manifest.json and sw.js in dist/

- [ ] **Step 7: Commit**

```bash
git add web/public/manifest.json web/src/sw.ts web/index.html web/src/main.tsx web/src/routes/contractor/Receipts.tsx
git commit -m "feat(receipts): add PWA manifest and share target for native scanner apps"
```

---

### Task 15: Deploy & Verify

- [ ] **Step 1: Build web**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Build functions**

Run: `cd functions && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Deploy Firestore rules**

Run: `firebase deploy --only firestore:rules`
Expected: Rules deployed successfully

- [ ] **Step 4: Deploy Cloud Functions**

Run: `firebase deploy --only functions`
Expected: Functions deployed (onReceiptUploaded, onReceiptMatchOnTransaction appear in console)

- [ ] **Step 5: Deploy hosting**

Run: `firebase deploy --only hosting`
Expected: Hosting deployed

- [ ] **Step 6: Manual verification**

1. Navigate to `/dashboard/finance/receipts` — empty grid with upload card
2. Upload a receipt image — card shows "Processing...", then populates with extracted data
3. If auto-matched, click to view detail, confirm match
4. If unmatched, click to reassign or create manual expense
5. Check Transactions page — receipt column shows badges
6. Test mobile: tap scan button opens camera

- [ ] **Step 7: Commit any fixes from verification**

```bash
git add -A
git commit -m "fix(receipts): post-deployment fixes"
```
