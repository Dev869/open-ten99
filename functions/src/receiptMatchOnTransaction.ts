import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { computeReceiptMatchScore, ReceiptData, TransactionData } from './utils/receiptMatching';
import * as logger from 'firebase-functions/logger';

const MATCH_THRESHOLD = 0.7;

export const onReceiptMatchOnTransaction = onDocumentCreated(
  'transactions/{docId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();

    if (data.type !== 'expense') return;

    const existingIds: string[] = data.receiptIds ?? [];
    if (existingIds.length > 0) return;

    const ownerId = data.ownerId as string;
    if (!ownerId) return;

    const db = getFirestore();

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
