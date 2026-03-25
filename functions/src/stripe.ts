import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import Stripe from 'stripe';
import { encryptToken, decryptToken } from './utils/crypto';
import { categorizeTransaction } from './utils/categorize';
import * as logger from 'firebase-functions/logger';

const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const encryptionKey = defineSecret('TOKEN_ENCRYPTION_KEY');

/**
 * Callable Cloud Function to connect a Stripe account via API key.
 * Validates the key, encrypts it, stores credentials, and runs an initial sync.
 */
export const onStripeConnect = onCall(
  { cors: true, maxInstances: 10, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to connect a Stripe account.');
    }

    const { apiKey } = request.data as { apiKey?: string };
    if (!apiKey || typeof apiKey !== 'string') {
      throw new HttpsError('invalid-argument', 'apiKey is required and must be a string.');
    }

    // Validate the API key by making a real Stripe API call
    const stripe = new Stripe(apiKey, { apiVersion: '2026-02-25.clover' });
    try {
      await stripe.balance.retrieve();
    } catch (err: unknown) {
      const stripeErr = err as { statusCode?: number };
      if (stripeErr.statusCode === 401 || stripeErr.statusCode === 403) {
        throw new HttpsError(
          'invalid-argument',
          'Invalid or insufficient Stripe API key. Required scopes: charges:read, balance:read, payment_intents:read'
        );
      }
      throw new HttpsError('internal', 'Failed to validate Stripe API key.');
    }

    const db = getFirestore();
    const now = Timestamp.now();
    const ownerId = request.auth.uid;

    // Encrypt the API key before storing
    const encrypted = encryptToken(apiKey, encryptionKey.value());

    // Write connectedAccounts doc
    const accountRef = db.collection('connectedAccounts').doc();
    await accountRef.set({
      ownerId,
      provider: 'stripe',
      accountName: 'Stripe',
      institutionName: 'Stripe',
      accountMask: apiKey.slice(-4),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    // Write secrets doc (same ID, separate collection for security rules)
    await db.collection('_secrets').doc('connectedAccountTokens').collection('accounts').doc(accountRef.id).set({
      accountId: accountRef.id,
      ownerId,
      accessToken: encrypted,
      createdAt: now,
      updatedAt: now,
    });

    logger.info('Stripe account connected', { accountId: accountRef.id, ownerId });

    // Run initial sync
    await syncStripeAccount(accountRef.id, ownerId);

    return { accountId: accountRef.id };
  }
);

/**
 * Exported helper that syncs transactions for a given Stripe connected account.
 * Fetches all succeeded charges since the last sync and writes them as transactions.
 */
export async function syncStripeAccount(
  accountId: string,
  ownerId: string
): Promise<{ transactionCount: number }> {
  const db = getFirestore();

  // Load the encrypted API key from secrets
  const secretSnap = await db
    .collection('_secrets')
    .doc('connectedAccountTokens')
    .collection('accounts')
    .doc(accountId)
    .get();

  if (!secretSnap.exists) {
    throw new Error(`No secret found for account ${accountId}`);
  }

  const secretData = secretSnap.data()!;
  const apiKey = decryptToken(secretData.accessToken as string, encryptionKey.value());

  const stripe = new Stripe(apiKey, { apiVersion: '2026-02-25.clover' });

  // Load account doc to get lastSyncedAt
  const accountSnap = await db.collection('connectedAccounts').doc(accountId).get();
  const accountData = accountSnap.data() ?? {};
  const lastSyncedAt = accountData.lastSyncedAt as Timestamp | undefined;
  const lastSyncTimestamp = lastSyncedAt ? Math.floor(lastSyncedAt.toMillis() / 1000) : 0;

  let transactionCount = 0;

  try {
    // Auto-paginate through all succeeded charges since last sync
    const chargesList = stripe.charges.list({
      created: { gte: lastSyncTimestamp },
      limit: 100,
    });

    await chargesList.autoPagingEach(async (charge: Stripe.Charge) => {
      if (charge.status !== 'succeeded') return;

      // Deduplicate by externalId
      const existingSnap = await db
        .collection('transactions')
        .where('externalId', '==', charge.id)
        .where('ownerId', '==', ownerId)
        .limit(1)
        .get();

      if (!existingSnap.empty) return;

      const now = Timestamp.now();
      const chargeDesc = charge.description ?? (charge.metadata?.description as string | undefined) ?? 'Stripe payment';
      await db.collection('transactions').add({
        ownerId,
        accountId,
        provider: 'stripe',
        externalId: charge.id,
        date: Timestamp.fromMillis(charge.created * 1000),
        amount: charge.amount / 100, // Stripe uses cents; convert to dollars (positive = income)
        description: chargeDesc,
        category: categorizeTransaction(null, chargeDesc),
        type: 'income',
        matchStatus: 'unmatched',
        isManual: false,
        createdAt: now,
        updatedAt: now,
      });

      transactionCount++;
    });
  } catch (err: unknown) {
    const stripeErr = err as { statusCode?: number };
    if (stripeErr.statusCode === 401 || stripeErr.statusCode === 403) {
      logger.warn('Stripe API key revoked or invalid during sync', { accountId });
      await db.collection('connectedAccounts').doc(accountId).update({
        status: 'error',
        errorMessage: 'API key revoked or invalid',
        updatedAt: Timestamp.now(),
      });
      return { transactionCount: 0 };
    }
    throw err;
  }

  // Update lastSyncedAt on success
  await db.collection('connectedAccounts').doc(accountId).update({
    lastSyncedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  logger.info('Stripe sync complete', { accountId, ownerId, transactionCount });

  return { transactionCount };
}

/**
 * Scheduled Cloud Function that syncs all active Stripe connected accounts every 6 hours.
 */
export const onStripeSync = onSchedule({ schedule: 'every 6 hours', secrets: [encryptionKey] }, async () => {
  const db = getFirestore();

  const accountsSnap = await db
    .collection('connectedAccounts')
    .where('provider', '==', 'stripe')
    .where('status', '==', 'active')
    .get();

  const syncPromises = accountsSnap.docs.map((doc) =>
    syncStripeAccount(doc.id, doc.data().ownerId as string).catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('Stripe sync failed for account', { accountId: doc.id, error: errMsg });
    })
  );

  await Promise.all(syncPromises);

  logger.info('Stripe scheduled sync complete', { accountCount: accountsSnap.size });
});

/**
 * HTTP function that handles Stripe webhook events.
 * Validates the webhook signature and processes charge/payment_intent events.
 */
export const onStripeWebhook = onRequest(
  { cors: true, maxInstances: 10 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Use rawBody for signature validation (critical for Stripe webhooks)
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.status(401).send('Missing stripe-signature header');
      return;
    }

    // We need a temporary Stripe instance just for webhook construction
    // The webhook secret is used for validation; no API key needed here
    const stripe = new Stripe('placeholder', { apiVersion: '2026-02-25.clover' });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn('Stripe webhook signature validation failed', { error: errMsg });
      res.status(401).send('Webhook signature validation failed');
      return;
    }

    const db = getFirestore();

    try {
      if (event.type === 'charge.succeeded') {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeSucceeded(db, charge);
      } else if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(db, paymentIntent);
      } else {
        logger.info('Stripe webhook: unhandled event type', { type: event.type });
      }

      res.status(200).json({ received: true });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('Stripe webhook processing error', { error: errMsg, eventType: event.type });
      res.status(500).send('Internal Server Error');
    }
  }
);

/**
 * Handles a charge.succeeded webhook event by writing a transaction doc.
 */
async function handleChargeSucceeded(
  db: FirebaseFirestore.Firestore,
  charge: Stripe.Charge
): Promise<void> {
  // Find the connected account associated with this charge (by iterating active Stripe accounts)
  const accountSnap = await db
    .collection('connectedAccounts')
    .where('provider', '==', 'stripe')
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (accountSnap.empty) {
    logger.warn('charge.succeeded: no active Stripe account found', { chargeId: charge.id });
    return;
  }

  const accountDoc = accountSnap.docs[0];
  const ownerId = accountDoc.data().ownerId as string;

  // Deduplicate
  const existingSnap = await db
    .collection('transactions')
    .where('externalId', '==', charge.id)
    .where('ownerId', '==', ownerId)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    logger.info('charge.succeeded: transaction already exists, skipping', { chargeId: charge.id });
    return;
  }

  const now = Timestamp.now();
  const desc = charge.description ?? (charge.metadata?.description as string | undefined) ?? 'Stripe payment';
  await db.collection('transactions').add({
    ownerId,
    accountId: accountDoc.id,
    provider: 'stripe',
    externalId: charge.id,
    date: Timestamp.fromMillis(charge.created * 1000),
    amount: charge.amount / 100,
    description: desc,
    category: categorizeTransaction(null, desc),
    type: 'income',
    matchStatus: 'unmatched',
    isManual: false,
    createdAt: now,
    updatedAt: now,
  });

  logger.info('charge.succeeded: transaction written', { chargeId: charge.id, ownerId });
}

/**
 * Handles a payment_intent.succeeded webhook event by writing a transaction doc.
 */
async function handlePaymentIntentSucceeded(
  db: FirebaseFirestore.Firestore,
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const accountSnap = await db
    .collection('connectedAccounts')
    .where('provider', '==', 'stripe')
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (accountSnap.empty) {
    logger.warn('payment_intent.succeeded: no active Stripe account found', { piId: paymentIntent.id });
    return;
  }

  const accountDoc = accountSnap.docs[0];
  const ownerId = accountDoc.data().ownerId as string;

  // Deduplicate
  const existingSnap = await db
    .collection('transactions')
    .where('externalId', '==', paymentIntent.id)
    .where('ownerId', '==', ownerId)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    logger.info('payment_intent.succeeded: transaction already exists, skipping', { piId: paymentIntent.id });
    return;
  }

  const now = Timestamp.now();
  const piDesc = paymentIntent.description ?? (paymentIntent.metadata?.description as string | undefined) ?? 'Stripe payment';
  await db.collection('transactions').add({
    ownerId,
    accountId: accountDoc.id,
    provider: 'stripe',
    externalId: paymentIntent.id,
    date: Timestamp.fromMillis(paymentIntent.created * 1000),
    amount: paymentIntent.amount / 100,
    description: piDesc,
    category: categorizeTransaction(null, piDesc),
    type: 'income',
    matchStatus: 'unmatched',
    isManual: false,
    createdAt: now,
    updatedAt: now,
  });

  logger.info('payment_intent.succeeded: transaction written', { piId: paymentIntent.id, ownerId });
}
