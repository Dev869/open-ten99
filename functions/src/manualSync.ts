import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { syncPlaidAccount } from './plaid';
import { syncStripeAccount } from './stripe';
import { encryptToken, decryptToken } from './utils/crypto';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import * as logger from 'firebase-functions/logger';

const plaidClientId = defineSecret('PLAID_CLIENT_ID');
const plaidSecret = defineSecret('PLAID_SECRET');
const plaidEnv = defineSecret('PLAID_ENV');
const encryptionKey = defineSecret('TOKEN_ENCRYPTION_KEY');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Suppress unused-import warnings for params not used directly in this file
void encryptToken;

function getPlaidClient(clientId: string, secret: string, env: string): PlaidApi {
  const envMap: Record<string, string> = {
    production: PlaidEnvironments.production,
    development: PlaidEnvironments.development,
    sandbox: PlaidEnvironments.sandbox,
  };
  const configuration = new Configuration({
    basePath: envMap[env] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: { 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret },
    },
  });
  return new PlaidApi(configuration);
}

// ---------------------------------------------------------------------------
// 1. onManualSync — manually trigger a sync for a connected account
// ---------------------------------------------------------------------------

export const onManualSync = onCall(
  { maxInstances: 10, secrets: [plaidClientId, plaidSecret, plaidEnv, encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to sync an account.');
    }

    const { accountId } = request.data as { accountId?: string };
    if (!accountId || typeof accountId !== 'string') {
      throw new HttpsError('invalid-argument', 'accountId is required.');
    }

    const ownerId = request.auth.uid;
    const db = getFirestore();

    // Load account and verify ownership
    const accountSnap = await db.collection('connectedAccounts').doc(accountId).get();
    if (!accountSnap.exists) {
      throw new HttpsError('not-found', 'Connected account not found.');
    }

    const accountData = accountSnap.data()!;
    if (accountData.ownerId !== ownerId) {
      throw new HttpsError('permission-denied', 'You do not have access to this account.');
    }

    // Throttle: prevent syncing more than once per 15 minutes
    const lastSyncedAt = accountData.lastSyncedAt as Timestamp | undefined;
    if (lastSyncedAt) {
      const fifteenMinutesMs = 15 * 60 * 1000;
      const msSinceLastSync = Date.now() - lastSyncedAt.toMillis();
      if (msSinceLastSync < fifteenMinutesMs) {
        throw new HttpsError('resource-exhausted', 'Please wait 15 minutes between manual syncs.');
      }
    }

    const provider = accountData.provider as string;
    let transactionCount = 0;

    try {
      if (provider === 'plaid') {
        const result = await syncPlaidAccount(accountId, ownerId);
        transactionCount = result.transactionCount;
      } else if (provider === 'stripe') {
        const result = await syncStripeAccount(accountId, ownerId);
        transactionCount = result.transactionCount;
      } else {
        throw new HttpsError('invalid-argument', `Unsupported provider: ${provider}`);
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Manual sync failed', { accountId, ownerId, provider, error: errMsg });
      throw new HttpsError('internal', 'Sync failed. Please try again.');
    }

    logger.info('Manual sync complete', { accountId, ownerId, provider, transactionCount });
    return { success: true, transactionCount };
  },
);

// ---------------------------------------------------------------------------
// 2. onDeleteConnectedAccount — remove a connected account and its secrets
// ---------------------------------------------------------------------------

export const onDeleteConnectedAccount = onCall(
  { maxInstances: 10, secrets: [encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to delete an account.');
    }

    const { accountId } = request.data as { accountId?: string };
    if (!accountId || typeof accountId !== 'string') {
      throw new HttpsError('invalid-argument', 'accountId is required.');
    }

    const ownerId = request.auth.uid;
    const db = getFirestore();

    // Load account and verify ownership
    const accountSnap = await db.collection('connectedAccounts').doc(accountId).get();
    if (!accountSnap.exists) {
      throw new HttpsError('not-found', 'Connected account not found.');
    }

    const accountData = accountSnap.data()!;
    if (accountData.ownerId !== ownerId) {
      throw new HttpsError('permission-denied', 'You do not have access to this account.');
    }

    try {
      // Delete the secrets doc at: _secrets/connectedAccountTokens/accounts/{accountId}
      const secretRef = db
        .collection('_secrets')
        .doc('connectedAccountTokens')
        .collection('accounts')
        .doc(accountId);
      await secretRef.delete();

      // Delete the connected account doc
      await db.collection('connectedAccounts').doc(accountId).delete();

      logger.info('Connected account deleted', { accountId, ownerId });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to delete connected account', { accountId, ownerId, error: errMsg });
      throw new HttpsError('internal', 'Failed to delete account. Please try again.');
    }

    return { success: true };
  },
);

// ---------------------------------------------------------------------------
// 3. onPlaidUpdateLinkToken — create a Plaid update-mode link token for re-auth
// ---------------------------------------------------------------------------

export const onPlaidUpdateLinkToken = onCall(
  { maxInstances: 10, secrets: [plaidClientId, plaidSecret, plaidEnv, encryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to re-authenticate.');
    }

    const { accountId } = request.data as { accountId?: string };
    if (!accountId || typeof accountId !== 'string') {
      throw new HttpsError('invalid-argument', 'accountId is required.');
    }

    const ownerId = request.auth.uid;
    const db = getFirestore();

    // Load account and verify ownership and provider
    const accountSnap = await db.collection('connectedAccounts').doc(accountId).get();
    if (!accountSnap.exists) {
      throw new HttpsError('not-found', 'Connected account not found.');
    }

    const accountData = accountSnap.data()!;
    if (accountData.ownerId !== ownerId) {
      throw new HttpsError('permission-denied', 'You do not have access to this account.');
    }
    if (accountData.provider !== 'plaid') {
      throw new HttpsError('invalid-argument', 'This account is not a Plaid account.');
    }

    // Load and decrypt the access token
    const secretSnap = await db
      .collection('_secrets')
      .doc('connectedAccountTokens')
      .collection('accounts')
      .doc(accountId)
      .get();

    if (!secretSnap.exists) {
      throw new HttpsError('not-found', 'Account credentials not found.');
    }

    const secretData = secretSnap.data()!;
    let decryptedToken: string;
    try {
      decryptedToken = decryptToken(secretData.accessToken as string, encryptionKey.value());
    } catch (error) {
      logger.error('Failed to decrypt Plaid access token', { accountId, error });
      throw new HttpsError('internal', 'Failed to load account credentials.');
    }

    // Create Plaid client and generate an update-mode link token
    const plaidClient = getPlaidClient(
      plaidClientId.value(),
      plaidSecret.value(),
      plaidEnv.value(),
    );

    try {
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: ownerId },
        client_name: 'OpenChanges',
        access_token: decryptedToken,
        country_codes: [CountryCode.Us],
        language: 'en',
      });

      logger.info('Plaid update-mode link token created', { accountId, ownerId });
      return { linkToken: response.data.link_token };
    } catch (error) {
      logger.error('Failed to create Plaid update link token', { accountId, error });
      throw new HttpsError('internal', 'Failed to create re-authentication link. Please try again.');
    }
  },
);

// Suppress unused import warning for Products (imported per task spec)
void Products;
