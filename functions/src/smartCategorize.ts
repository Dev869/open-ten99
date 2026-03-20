import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getGeminiClient } from './utils/geminiClient';
import * as logger from 'firebase-functions/logger';

const EXPENSE_CATEGORIES = [
  'Software & Subscriptions',
  'Equipment & Tools',
  'Office Supplies',
  'Travel',
  'Meals & Entertainment',
  'Vehicle & Fuel',
  'Insurance',
  'Professional Services',
  'Advertising & Marketing',
  'Utilities & Telecom',
  'Subcontractors',
  'Materials & Supplies',
  'Education & Training',
  'Uncategorized',
];

/**
 * Smart categorize: uses Gemini to categorize uncategorized transactions.
 * Batches up to 50 transactions per call to minimize API usage.
 */
export const onSmartCategorize = onCall(
  { maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    // Rate limit: 60 seconds between calls per user
    const COOLDOWN_MS = 60 * 1000;
    const rateLimitRef = db.collection('_rateLimit').doc(`smartCategorize_${uid}`);
    const rateLimitDoc = await rateLimitRef.get();
    const lastCalledAt = rateLimitDoc.data()?.lastCalledAt?.toDate?.();
    if (lastCalledAt && Date.now() - lastCalledAt.getTime() < COOLDOWN_MS) {
      const secondsRemaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastCalledAt.getTime())) / 1000);
      throw new HttpsError(
        'resource-exhausted',
        `Please wait ${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''} before running Smart Sort again.`
      );
    }
    await rateLimitRef.set({ lastCalledAt: Timestamp.now() }, { merge: true });

    // Fetch uncategorized transactions for this user
    const snapshot = await db
      .collection('transactions')
      .where('ownerId', '==', uid)
      .where('category', '==', 'Uncategorized')
      .limit(50)
      .get();

    if (snapshot.empty) {
      return { categorized: 0, message: 'No uncategorized transactions found' };
    }

    // Build the prompt with transaction descriptions
    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      description: doc.data().description as string,
      amount: doc.data().amount as number,
    }));

    const prompt = `You are a bookkeeper categorizing business expenses for an independent contractor.

Categorize each transaction into EXACTLY ONE of these Schedule C categories:
${EXPENSE_CATEGORIES.filter((c) => c !== 'Uncategorized').map((c) => `- ${c}`).join('\n')}

If you cannot determine the category with reasonable confidence, use "Uncategorized".

Transactions to categorize:
${transactions.map((t, i) => `${i + 1}. "${t.description}" ($${Math.abs(t.amount).toFixed(2)})`).join('\n')}

Respond with ONLY a JSON array of objects, one per transaction, in the same order:
[{"index": 1, "category": "Category Name"}, ...]

No explanation, no markdown, just the JSON array.`;

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      let categorizations: { index: number; category: string }[];
      try {
        categorizations = JSON.parse(responseText);
      } catch {
        logger.error('Failed to parse Gemini response', { responseText });
        throw new HttpsError('internal', 'AI returned invalid response');
      }

      // Validate and apply categorizations
      const batch = db.batch();
      let categorizedCount = 0;

      for (const item of categorizations) {
        const txIndex = item.index - 1; // Convert 1-based to 0-based
        if (txIndex < 0 || txIndex >= transactions.length) continue;

        const category = EXPENSE_CATEGORIES.includes(item.category)
          ? item.category
          : 'Uncategorized';

        // Skip if Gemini couldn't categorize it either
        if (category === 'Uncategorized') continue;

        const txDoc = snapshot.docs[txIndex];
        batch.update(txDoc.ref, {
          category,
          updatedAt: Timestamp.now(),
        });
        categorizedCount++;
      }

      if (categorizedCount > 0) {
        await batch.commit();
      }

      logger.info('Smart categorize complete', { uid, total: transactions.length, categorized: categorizedCount });

      return {
        categorized: categorizedCount,
        total: transactions.length,
        message: `Categorized ${categorizedCount} of ${transactions.length} transactions`,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Smart categorize failed', { error });
      throw new HttpsError('internal', 'Failed to categorize transactions');
    }
  }
);
