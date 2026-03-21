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

    // Suppress unused variable warning — url was obtained for potential future use
    void url;
  },
);
