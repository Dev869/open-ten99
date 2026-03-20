import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { computeMatchScore } from './utils/matching';
import * as logger from 'firebase-functions/logger';

// ---------------------------------------------------------------------------
// onTransactionCreated — match new income transactions to unpaid invoices
// ---------------------------------------------------------------------------

export const onTransactionCreated = onDocumentCreated(
  'transactions/{docId}',
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.warn('onTransactionCreated: no data in event');
      return;
    }

    const data = snap.data();

    // Early exit guards — do not process manual expenses, non-income transactions,
    // or transactions that already have a match status applied.
    if (data.isManual === true) return;
    if (data.type !== 'income') return;
    if (data.matchStatus === 'suggested' || data.matchStatus === 'confirmed') return;

    const ownerId = data.ownerId as string;
    if (!ownerId) {
      logger.warn('onTransactionCreated: transaction missing ownerId', { docId: snap.id });
      return;
    }

    const db = getFirestore();

    // Query unpaid invoices scoped to this contractor
    const [workItemsSnap, clientsSnap] = await Promise.all([
      db
        .collection('workItems')
        .where('ownerId', '==', ownerId)
        .where('invoiceStatus', 'in', ['sent', 'overdue'])
        .get(),
      db
        .collection('clients')
        .where('ownerId', '==', ownerId)
        .get(),
    ]);

    // Build clientId → name lookup
    const clientNames = new Map<string, string>();
    for (const clientDoc of clientsSnap.docs) {
      const clientData = clientDoc.data();
      clientNames.set(clientDoc.id, (clientData.name as string) ?? '');
    }

    // Build the transaction shape expected by computeMatchScore
    const tx = {
      amount: data.amount as number,
      date: (data.date as Timestamp).toDate(),
      description: (data.description as string) ?? '',
    };

    let bestScore = 0;
    let bestMatchId: string | null = null;

    for (const workItemDoc of workItemsSnap.docs) {
      const workItem = workItemDoc.data();

      const invoiceSentDate: Date | undefined =
        workItem.invoiceSentDate instanceof Timestamp
          ? workItem.invoiceSentDate.toDate()
          : undefined;

      // Skip work items without an invoiceSentDate — date scoring requires it
      if (!invoiceSentDate) continue;

      const invoice = {
        totalCost: workItem.totalCost as number,
        invoiceSentDate,
        clientName: clientNames.get(workItem.clientId as string) ?? '',
      };

      const score = computeMatchScore(tx, invoice);

      if (score > bestScore) {
        bestScore = score;
        bestMatchId = workItemDoc.id;
      }
    }

    if (bestScore > 0.7 && bestMatchId !== null) {
      await snap.ref.update({
        matchStatus: 'suggested',
        matchConfidence: bestScore,
        matchedWorkItemId: bestMatchId,
      });

      logger.info('Transaction match suggested', {
        transactionId: snap.id,
        matchedWorkItemId: bestMatchId,
        matchConfidence: bestScore,
        ownerId,
      });
    } else {
      // Do NOT write back to the document — it already has matchStatus: 'unmatched'.
      // Writing would re-trigger this function in an infinite loop.
      logger.info('No invoice match found for transaction', {
        transactionId: snap.id,
        bestScore,
        ownerId,
      });
    }
  },
);
