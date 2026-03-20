import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { encryptToken, decryptToken } from './utils/crypto';
import { categorizeTransaction, classifyTransactionType } from './utils/categorize';
import * as logger from 'firebase-functions/logger';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const plaidClientId = defineString('PLAID_CLIENT_ID');
const plaidSecret = defineString('PLAID_SECRET');
const plaidEnv = defineString('PLAID_ENV');
const encryptionKey = defineString('TOKEN_ENCRYPTION_KEY');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Webhook verification
// ---------------------------------------------------------------------------

/**
 * Verifies the Plaid webhook JWT signature using the EC public key fetched
 * from Plaid's /webhook_verification_key/get endpoint.
 *
 * Plaid sends a JWT in the `plaid-verification` header. The JWT:
 *   - Header contains `kid` identifying the signing key
 *   - Body contains `request_body_sha256` — the SHA-256 of the raw request body
 *   - Is signed with ES256 (ECDSA + P-256 + SHA-256)
 *
 * Returns true if the signature and body hash are both valid.
 * Returns false if any step fails (caller should respond with 401).
 */
async function verifyPlaidWebhook(
  rawBody: Buffer,
  jwtToken: string,
  plaidClient: PlaidApi,
): Promise<boolean> {
  // Split JWT into its three parts
  const parts = jwtToken.split('.');
  if (parts.length !== 3) return false;

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header to extract kid
  let kid: string;
  try {
    const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
    const header = JSON.parse(headerJson) as { kid?: string; alg?: string };
    if (!header.kid) return false;
    kid = header.kid;
  } catch {
    return false;
  }

  // Fetch the public key from Plaid
  let jwk: {
    kty: string; crv: string; x: string; y: string;
    expired_at: number | null;
  };
  try {
    const keyResponse = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
    jwk = keyResponse.data.key as typeof jwk;
  } catch (err) {
    logger.warn('Failed to fetch Plaid webhook verification key', {
      kid,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }

  // Reject if the key has been rotated out
  if (jwk.expired_at !== null && jwk.expired_at < Math.floor(Date.now() / 1000)) {
    logger.warn('Plaid webhook verification key is expired', { kid });
    return false;
  }

  // Import the JWK as a Node crypto KeyObject (EC P-256)
  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({
      key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      format: 'jwk',
    });
  } catch {
    return false;
  }

  // Verify the ES256 signature over "headerB64.payloadB64"
  const signingInput = `${headerB64}.${payloadB64}`;
  let signatureValid: boolean;
  try {
    const derSignature = Buffer.from(signatureB64, 'base64url');
    signatureValid = crypto.verify(
      'SHA256',
      Buffer.from(signingInput),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      derSignature,
    );
  } catch {
    return false;
  }

  if (!signatureValid) return false;

  // Verify the body hash claim matches the actual request body
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { request_body_sha256?: string };
    if (!payload.request_body_sha256) return false;
    const actualHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(payload.request_body_sha256),
      Buffer.from(actualHash),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 1. onPlaidLinkToken — create a Plaid Link token for the authenticated user
// ---------------------------------------------------------------------------

export const onPlaidLinkToken = onCall(
  { maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to create a link token.');
    }

    const client = getPlaidClient(
      plaidClientId.value(),
      plaidSecret.value(),
      plaidEnv.value(),
    );

    try {
      const response = await client.linkTokenCreate({
        user: { client_user_id: request.auth.uid },
        client_name: 'OpenChanges',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
      });

      logger.info('Plaid link token created', { uid: request.auth.uid });
      return { linkToken: response.data.link_token };
    } catch (error) {
      logger.error('Failed to create Plaid link token', { error });
      throw new HttpsError('internal', 'Failed to create Plaid link token. Please try again.');
    }
  },
);

// ---------------------------------------------------------------------------
// 2. onPlaidExchange — exchange a public token for an access token and persist
// ---------------------------------------------------------------------------

export const onPlaidExchange = onCall(
  { maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to connect a bank account.');
    }

    const { publicToken } = request.data as { publicToken?: string };
    if (!publicToken || typeof publicToken !== 'string') {
      throw new HttpsError('invalid-argument', 'publicToken is required.');
    }

    const ownerId = request.auth.uid;
    const client = getPlaidClient(
      plaidClientId.value(),
      plaidSecret.value(),
      plaidEnv.value(),
    );

    try {
      // Exchange public token for access token
      const exchangeResponse = await client.itemPublicTokenExchange({
        public_token: publicToken,
      });
      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;

      // Fetch account metadata
      const accountsResponse = await client.accountsGet({ access_token: accessToken });
      const accounts = accountsResponse.data.accounts;
      const firstAccount = accounts[0];

      const accountName = firstAccount?.name ?? 'Unknown Account';
      const accountMask = firstAccount?.mask ?? '';
      const institutionName = accountsResponse.data.item?.institution_id ?? '';

      // Encrypt access token before storing
      const encryptedAccessToken = encryptToken(accessToken, encryptionKey.value());

      const db = getFirestore();
      const now = Timestamp.now();

      // Write connected account metadata
      const accountRef = db.collection('connectedAccounts').doc();
      await accountRef.set({
        ownerId,
        provider: 'plaid',
        accountName,
        institutionName,
        accountMask,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      // Write token secrets to a separate restricted collection
      await db.collection('_secrets').doc('connectedAccountTokens').collection('accounts').doc(accountRef.id).set({
        accountId: accountRef.id,
        ownerId,
        accessToken: encryptedAccessToken,
        itemId,
        syncCursor: null,
        createdAt: now,
        updatedAt: now,
      });

      logger.info('Plaid account connected', { accountId: accountRef.id, ownerId });

      // Kick off initial transaction sync
      await syncPlaidAccount(accountRef.id, ownerId);

      return { accountId: accountRef.id };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Failed to exchange Plaid token', { error, ownerId });
      throw new HttpsError('internal', 'Failed to connect bank account. Please try again.');
    }
  },
);

// ---------------------------------------------------------------------------
// 3. syncPlaidAccount — exported helper to sync transactions for one account
// ---------------------------------------------------------------------------

export async function syncPlaidAccount(
  accountId: string,
  ownerId: string,
): Promise<{ transactionCount: number }> {
  const db = getFirestore();

  try {
    // Load the secret token document
    const secretRef = db
      .collection('_secrets')
      .doc('connectedAccountTokens')
      .collection('accounts')
      .doc(accountId);
    const secretSnap = await secretRef.get();

    if (!secretSnap.exists) {
      throw new Error(`No token found for accountId=${accountId}`);
    }

    const secretData = secretSnap.data()!;
    const accessToken = decryptToken(secretData.accessToken as string, encryptionKey.value());
    const client = getPlaidClient(
      plaidClientId.value(),
      plaidSecret.value(),
      plaidEnv.value(),
    );

    // Paginate through all transaction updates
    let cursor: string = (secretData.syncCursor as string) ?? '';
    let transactionCount = 0;
    let hasMore = true;

    while (hasMore) {
      const syncResponse = await client.transactionsSync({
        access_token: accessToken,
        cursor,
      });

      const { added, removed, next_cursor, has_more } = syncResponse.data;

      // Batch writes for added transactions
      if (added.length > 0) {
        const batch = db.batch();
        const now = Timestamp.now();

        for (const tx of added) {
          const txRef = db.collection('transactions').doc();
          // Negate Plaid amount: Plaid positive = debit (expense), our convention positive = income
          const amount = -tx.amount;
          const description = tx.name ?? (tx as { merchant_name?: string }).merchant_name ?? '';
          // Extract Plaid's personal_finance_category for auto-categorization
          const plaidCategory = (tx as { personal_finance_category?: { primary?: string } }).personal_finance_category?.primary ?? null;
          batch.set(txRef, {
            ownerId,
            accountId,
            provider: 'plaid',
            externalId: tx.transaction_id,
            date: Timestamp.fromDate(new Date(tx.date)),
            amount,
            description,
            category: categorizeTransaction(plaidCategory, description),
            type: classifyTransactionType(amount, plaidCategory),
            matchStatus: 'unmatched',
            isManual: false,
            createdAt: now,
            updatedAt: now,
          });
          transactionCount++;
        }

        await batch.commit();
      }

      // Handle removed transactions
      if (removed.length > 0) {
        const removeBatch = db.batch();
        for (const removedTx of removed) {
          const snap = await db
            .collection('transactions')
            .where('externalId', '==', removedTx.transaction_id)
            .where('accountId', '==', accountId)
            .limit(1)
            .get();
          if (!snap.empty) {
            removeBatch.delete(snap.docs[0].ref);
          }
        }
        await removeBatch.commit();
      }

      cursor = next_cursor;
      hasMore = has_more;
    }

    const now = Timestamp.now();

    // Update sync cursor
    await secretRef.update({
      syncCursor: cursor,
      updatedAt: now,
    });

    // Update account metadata
    await db.collection('connectedAccounts').doc(accountId).update({
      lastSyncedAt: now,
      updatedAt: now,
    });

    logger.info('Plaid sync complete', { accountId, ownerId, transactionCount });
    return { transactionCount };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Plaid sync failed', { accountId, ownerId, error: errMsg });

    // Mark the account as errored so the user knows re-authentication may be needed
    try {
      await db.collection('connectedAccounts').doc(accountId).update({
        status: 'error',
        errorMessage: errMsg,
        updatedAt: Timestamp.now(),
      });
    } catch (updateError) {
      logger.error('Failed to update account error status', { accountId, updateError });
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// 4. onPlaidSync — scheduled job that syncs all active Plaid accounts
// ---------------------------------------------------------------------------

export const onPlaidSync = onSchedule(
  { schedule: 'every 6 hours', timeoutSeconds: 300 },
  async () => {
    const db = getFirestore();

    const accountsSnap = await db
      .collection('connectedAccounts')
      .where('provider', '==', 'plaid')
      .where('status', '==', 'active')
      .get();

    if (accountsSnap.empty) {
      logger.info('No active Plaid accounts to sync');
      return;
    }

    logger.info('Starting scheduled Plaid sync', { accountCount: accountsSnap.size });

    const results = await Promise.allSettled(
      accountsSnap.docs.map((doc) =>
        syncPlaidAccount(doc.id, doc.data().ownerId as string),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info('Scheduled Plaid sync complete', { succeeded, failed, total: results.length });
  },
);

// ---------------------------------------------------------------------------
// 5. onPlaidWebhook — handles Plaid webhook events
// ---------------------------------------------------------------------------

export const onPlaidWebhook = onRequest(
  { maxInstances: 10 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Verify the Plaid-Verification JWT before processing any payload
    const jwtToken = req.headers['plaid-verification'];
    if (!jwtToken || typeof jwtToken !== 'string') {
      logger.warn('Plaid webhook rejected: missing plaid-verification header');
      res.status(401).send('Unauthorized');
      return;
    }

    const webhookClient = getPlaidClient(
      plaidClientId.value(),
      plaidSecret.value(),
      plaidEnv.value(),
    );

    const rawBody: Buffer = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(JSON.stringify(req.body));

    try {
      const verified = await verifyPlaidWebhook(rawBody, jwtToken, webhookClient);
      if (!verified) {
        logger.warn('Plaid webhook rejected: invalid signature');
        res.status(401).send('Unauthorized');
        return;
      }
    } catch (verifyError) {
      logger.warn('Plaid webhook verification threw unexpectedly', {
        error: verifyError instanceof Error ? verifyError.message : String(verifyError),
      });
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const body = req.body as {
        webhook_type?: string;
        webhook_code?: string;
        item_id?: string;
        error?: { error_message?: string };
      };

      const { webhook_type, webhook_code, item_id } = body;

      logger.info('Plaid webhook received', { webhook_type, webhook_code, item_id });

      const db = getFirestore();

      if (webhook_type === 'TRANSACTIONS' && webhook_code === 'SYNC_UPDATES_AVAILABLE') {
        // Find the connected account by itemId and trigger a sync
        if (!item_id) {
          res.status(400).send('Missing item_id');
          return;
        }

        const accountSnap = await db
          .collection('connectedAccounts')
          .where('provider', '==', 'plaid')
          .where('status', '==', 'active')
          .get();

        // Find the account whose secret doc has this itemId
        for (const accountDoc of accountSnap.docs) {
          const secretSnap = await db
            .collection('_secrets')
            .doc('connectedAccountTokens')
            .collection('accounts')
            .doc(accountDoc.id)
            .get();

          if (secretSnap.exists && secretSnap.data()?.itemId === item_id) {
            const ownerId = accountDoc.data().ownerId as string;
            // Trigger sync in the background — don't await so we return 200 quickly
            syncPlaidAccount(accountDoc.id, ownerId).catch((err) => {
              logger.error('Background sync failed after webhook', {
                accountId: accountDoc.id,
                error: err instanceof Error ? err.message : String(err),
              });
            });
            break;
          }
        }
      } else if (webhook_type === 'ITEM' && webhook_code === 'ERROR') {
        // Mark the account as errored so the user knows re-auth is needed
        if (!item_id) {
          res.status(400).send('Missing item_id');
          return;
        }

        const accountSnap = await db
          .collection('connectedAccounts')
          .where('provider', '==', 'plaid')
          .get();

        for (const accountDoc of accountSnap.docs) {
          const secretSnap = await db
            .collection('_secrets')
            .doc('connectedAccountTokens')
            .collection('accounts')
            .doc(accountDoc.id)
            .get();

          if (secretSnap.exists && secretSnap.data()?.itemId === item_id) {
            await accountDoc.ref.update({
              status: 'error',
              errorMessage: 'Re-authentication required',
              updatedAt: Timestamp.now(),
            });
            logger.warn('Plaid item error — marked account for re-auth', {
              accountId: accountDoc.id,
              item_id,
            });
            break;
          }
        }
      } else {
        logger.info('Unhandled Plaid webhook', { webhook_type, webhook_code });
      }

      res.status(200).json({ received: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Plaid webhook handler failed', { error: errMsg });
      res.status(500).send('Internal Server Error');
    }
  },
);
