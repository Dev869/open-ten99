# Finance Reporting Module — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect bank accounts via Plaid and Stripe payment data, sync transactions into a unified ledger, and display them with cursor-based pagination — all with server-side encrypted token storage.

**Architecture:** Plaid Link handles bank auth client-side, exchanging a temporary public_token for a permanent access_token via Cloud Function. Tokens are AES-256-GCM encrypted and stored in a server-only `_secrets/` Firestore collection that clients cannot read. Scheduled Cloud Functions sync transactions every 6 hours. Stripe uses restricted API keys validated server-side. Both sources normalize into a unified `transactions` collection. The frontend uses cursor-based pagination (not `onSnapshot` for the full collection) since transaction volume can grow to thousands.

**Tech Stack:** Plaid Node SDK, Stripe Node SDK, react-plaid-link, Firebase Cloud Functions v2, AES-256-GCM encryption, Firestore cursor-based pagination

**Spec:** `docs/superpowers/specs/2026-03-19-finance-reporting-design.md` (Phase 2 section)

**Prerequisites:** Phase 1 complete. Security rules for `connectedAccounts`, `_secrets`, and `transactions` already deployed. Types `ConnectedAccount` and `Transaction` need to be added to `types.ts`.

---

## File Structure

### New Files — Cloud Functions (`functions/`)
| File | Responsibility |
|------|---------------|
| `functions/src/utils/crypto.ts` | AES-256-GCM encrypt/decrypt for access tokens |
| `functions/src/utils/crypto.test.ts` | Unit tests for encryption utilities |
| `functions/src/plaid.ts` | Plaid Cloud Functions: onPlaidLinkToken, onPlaidExchange, onPlaidSync, onPlaidWebhook |
| `functions/src/stripe.ts` | Stripe Cloud Functions: onStripeConnect, onStripeSync, onStripeWebhook |
| `functions/src/manualSync.ts` | onManualSync callable (shared sync logic) |

### New Files — Web (`web/`)
| File | Responsibility |
|------|---------------|
| `web/src/routes/contractor/Transactions.tsx` | Transaction ledger page with pagination and filters |
| `web/src/routes/contractor/Accounts.tsx` | Connected accounts management page |
| `web/src/components/finance/TransactionRow.tsx` | Single transaction row with category badge |
| `web/src/components/finance/ConnectedAccountCard.tsx` | Account card with status, sync controls |
| `web/src/components/finance/PlaidLinkButton.tsx` | Wrapper around react-plaid-link |
| `web/src/components/finance/StripeConnectForm.tsx` | Stripe API key input + validation |

### Modified Files
| File | Changes |
|------|---------|
| `functions/src/index.ts` | Export all new Cloud Functions |
| `functions/package.json` | Add `plaid` and `stripe` dependencies |
| `web/package.json` | Add `react-plaid-link` dependency |
| `web/src/lib/types.ts` | Add `ConnectedAccount` and `Transaction` interfaces |
| `web/src/services/firestore.ts` | Add converters, CRUD, and subscription functions for new collections |
| `web/src/hooks/useFirestore.ts` | Add `useConnectedAccounts` hook |
| `web/src/components/Sidebar.tsx` | Add Transactions and Accounts to finance nav group children |
| `web/src/App.tsx` | Add Transactions and Accounts routes |

---

### Task 0: Install Dependencies

**Files:**
- Modify: `functions/package.json`
- Modify: `web/package.json`

- [ ] **Step 1: Install Plaid, Stripe SDKs, and vitest for Cloud Functions**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/functions && npm install plaid stripe && npm install -D vitest`

Add to `functions/package.json` scripts: `"test": "vitest run", "test:watch": "vitest"`

- [ ] **Step 2: Install react-plaid-link for web**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/web && npm install react-plaid-link`

- [ ] **Step 3: Verify both builds**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/functions && npm run build`
Run: `cd /Users/devinwilson/Projects/personal/openchanges/web && npm run build`

- [ ] **Step 4: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add functions/package.json functions/package-lock.json web/package.json web/package-lock.json && git commit -m "chore: add plaid, stripe, and react-plaid-link dependencies"
```

---

### Task 1: Server-Side Encryption Utilities (TDD)

**Files:**
- Create: `functions/src/utils/crypto.ts`
- Create: `functions/src/utils/crypto.test.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/utils/crypto.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from './crypto';

describe('token encryption', () => {
  const testKey = 'a'.repeat(64); // 32-byte hex key

  it('encrypts and decrypts a token round-trip', () => {
    const original = 'access-sandbox-abc123-test-token';
    const encrypted = encryptToken(original, testKey);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':'); // iv:authTag:ciphertext format
    const decrypted = decryptToken(encrypted, testKey);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const original = 'same-token';
    const enc1 = encryptToken(original, testKey);
    const enc2 = encryptToken(original, testKey);
    expect(enc1).not.toBe(enc2);
  });

  it('fails to decrypt with wrong key', () => {
    const original = 'secret-token';
    const encrypted = encryptToken(original, testKey);
    const wrongKey = 'b'.repeat(64);
    expect(() => decryptToken(encrypted, wrongKey)).toThrow();
  });

  it('fails on tampered ciphertext', () => {
    const original = 'secret-token';
    const encrypted = encryptToken(original, testKey);
    const tampered = encrypted.slice(0, -4) + 'xxxx';
    expect(() => decryptToken(tampered, testKey)).toThrow();
  });
});
```

Note: You will need vitest installed in functions/ for these tests. Run `cd /Users/devinwilson/Projects/personal/openchanges/functions && npm install -D vitest` first, and add `"test": "vitest run"` to functions/package.json scripts.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/functions && npx vitest run src/lib/crypto.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement crypto.ts**

Create `functions/src/utils/crypto.ts`:

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Returns format: hex(iv):hex(authTag):hex(ciphertext)
 */
export function encryptToken(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a token encrypted with encryptToken.
 * Input format: hex(iv):hex(authTag):hex(ciphertext)
 */
export function decryptToken(encrypted: string, hexKey: string): string {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted token format');
  }

  const key = Buffer.from(hexKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/functions && npx vitest run src/lib/crypto.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add functions/src/utils/crypto.ts functions/src/utils/crypto.test.ts functions/package.json && git commit -m "feat(finance): add AES-256-GCM token encryption utilities with tests"
```

---

### Task 2: Plaid Cloud Functions

**Files:**
- Create: `functions/src/plaid.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create plaid.ts with all 4 Plaid functions**

Read the existing `functions/src/generatePdf.ts` and `functions/src/generateReport.ts` for the Cloud Function pattern (onCall, auth checks, error handling, logging).

Create `functions/src/plaid.ts` with these functions:

**`onPlaidLinkToken`** (Callable):
- Auth check (require `request.auth`)
- Import `PlaidApi`, `Configuration`, `PlaidEnvironments`, `Products`, `CountryCode` from `plaid`
- Use Firebase secrets: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`
- Configure Plaid client with environment from `PLAID_ENV` (maps to `PlaidEnvironments.sandbox` / `PlaidEnvironments.production`)
- Call `plaidClient.linkTokenCreate({ user: { client_user_id: uid }, client_name: 'OpenChanges', products: [Products.Transactions], country_codes: [CountryCode.Us], language: 'en' })`
- Return `{ linkToken: response.data.link_token }`

**`onPlaidExchange`** (Callable):
- Auth check
- Receives `{ publicToken: string }` from request.data
- Call `plaidClient.itemPublicTokenExchange({ public_token: publicToken })`
- Get access_token and item_id from response
- Call `plaidClient.accountsGet({ access_token })` to get account metadata
- Encrypt access_token using `encryptToken()` from `./lib/crypto`
- Write to `_secrets/connectedAccountTokens/{docId}`: `{ accountId, ownerId, accessToken: encrypted, itemId, syncCursor: null, createdAt, updatedAt }`
- Write to `connectedAccounts/{docId}`: `{ ownerId, provider: 'plaid', accountName, institutionName, accountMask, status: 'active', lastSyncedAt: null, createdAt, updatedAt }`
- Trigger initial sync by calling the shared sync logic
- Return `{ accountId }`

**`syncPlaidAccount(accountId, ownerId)`** (Exported helper — used by both scheduled sync and manual sync):
- Load the corresponding `_secrets/connectedAccountTokens` doc
- Decrypt the access_token
- Call `plaidClient.transactionsSync({ access_token, cursor })` in a loop until `has_more == false`
- For each `added` transaction, write to `transactions` collection with normalized fields
- **Negate Plaid amounts** (`amount: -plaidTransaction.amount`) to match our sign convention (positive = income)
- Update the sync cursor in `_secrets`
- Update `lastSyncedAt` on `connectedAccounts`
- On Plaid API errors, set `status: 'error'` and `errorMessage` on the `connectedAccount`
- Return `{ transactionCount }`

**`onPlaidSync`** (Scheduled, every 6 hours):
- Use `onSchedule` from `firebase-functions/v2/scheduler`
- Query all `connectedAccounts` where `provider == 'plaid'` and `status == 'active'`
- For each, call `syncPlaidAccount(accountId, ownerId)`

**`onPlaidWebhook`** (HTTP):
- Use `onRequest` from `firebase-functions/v2/https`
- Validate the webhook by checking the `Plaid-Verification` header (or skip in sandbox)
- Handle webhook types:
  - `TRANSACTIONS.SYNC_UPDATES_AVAILABLE` → trigger sync for the item
  - `ITEM.ERROR` with `ITEM_LOGIN_REQUIRED` → set `status: 'error'`, `errorMessage: 'Re-authentication required'` on the connectedAccount
- Return 200

For the Plaid client configuration, define a helper at the top of the file:

```typescript
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { defineString } from 'firebase-functions/params';

// Use defineString to match existing codebase pattern (parseEmail.ts, github.ts)
const plaidClientId = defineString('PLAID_CLIENT_ID');
const plaidSecret = defineString('PLAID_SECRET');
const plaidEnv = defineString('PLAID_ENV');
const encryptionKey = defineString('TOKEN_ENCRYPTION_KEY');

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
```

Use `maxInstances: 10` on all callable functions (matching existing `github.ts` pattern).

**Important — Plaid amount sign convention:** Plaid returns amounts where positive = money leaving the account (debit). Our convention is positive = income, negative = expense. The sync logic must negate Plaid amounts: `amount: -plaidTransaction.amount`.

- [ ] **Step 2: Export all functions from index.ts**

Add to `functions/src/index.ts`:
```typescript
export { onPlaidLinkToken, onPlaidExchange, onPlaidSync, onPlaidWebhook } from './plaid';
```

- [ ] **Step 3: Build**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/functions && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add functions/src/plaid.ts functions/src/index.ts && git commit -m "feat(finance): add Plaid Cloud Functions — link token, exchange, sync, webhook"
```

---

### Task 3: Stripe Cloud Functions

**Files:**
- Create: `functions/src/stripe.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create stripe.ts with all 3 Stripe functions**

**`onStripeConnect`** (Callable):
- Auth check
- Receives `{ apiKey: string }` — user's restricted Stripe API key
- Validate by calling `stripe.balance.retrieve()` with the key
- If 401/403, throw HttpsError('invalid-argument', 'Invalid or insufficient Stripe API key')
- Encrypt the API key using `encryptToken()`
- Write to `_secrets/connectedAccountTokens/{docId}`: `{ accountId, ownerId, accessToken: encrypted, createdAt, updatedAt }`
- Write to `connectedAccounts/{docId}`: `{ ownerId, provider: 'stripe', accountName: 'Stripe', institutionName: 'Stripe', accountMask: apiKey.slice(-4), status: 'active', lastSyncedAt: null, createdAt, updatedAt }`
- Trigger initial sync
- Return `{ accountId }`

**`syncStripeAccount(accountId, ownerId)`** (Exported helper — used by both scheduled sync and manual sync):
- Decrypt the API key from `_secrets`
- Create a Stripe client with the key
- Fetch charges using `stripe.charges.list({ created: { gte: lastSyncTimestamp }, limit: 100 })` with auto-pagination
- Normalize each charge into the `transactions` format: positive amount for succeeded charges, description from charge.description or charge.metadata
- On 401/403, set `status: 'error'`, `errorMessage: 'API key revoked or invalid'`
- Update `lastSyncedAt`
- Return `{ transactionCount }`

**`onStripeSync`** (Scheduled, every 6 hours):
- Query all `connectedAccounts` where `provider == 'stripe'` and `status == 'active'`
- For each, call `syncStripeAccount(accountId, ownerId)`

**`onStripeWebhook`** (HTTP):
- **Use `request.rawBody`** (not `request.body`) for signature validation — required by Stripe SDK
- Validate webhook signature using `stripe.webhooks.constructEvent(request.rawBody, sig, webhookSecret)`
- Handle event types:
  - `charge.succeeded` → write transaction to Firestore
  - `payment_intent.succeeded` → write transaction to Firestore
- Return 200

```typescript
import Stripe from 'stripe';
import { defineString } from 'firebase-functions/params';

const stripeWebhookSecret = defineString('STRIPE_WEBHOOK_SECRET');
const encryptionKey = defineString('TOKEN_ENCRYPTION_KEY'); // Reuse same key for all token encryption
```

- [ ] **Step 2: Export from index.ts**

Add to `functions/src/index.ts`:
```typescript
export { onStripeConnect, onStripeSync, onStripeWebhook } from './stripe';
```

- [ ] **Step 3: Build**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/functions && npm run build`

- [ ] **Step 4: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add functions/src/stripe.ts functions/src/index.ts && git commit -m "feat(finance): add Stripe Cloud Functions — connect, sync, webhook"
```

---

### Task 4: Manual Sync Cloud Function

**Files:**
- Create: `functions/src/manualSync.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create manualSync.ts**

`onManualSync` (Callable):
- Auth check
- Receives `{ accountId: string }`
- Load the `connectedAccounts` doc, verify `ownerId == uid`
- Throttle check: if `lastSyncedAt` is within 15 minutes, throw HttpsError('resource-exhausted', 'Please wait 15 minutes between manual syncs')
- Based on `provider`, call the appropriate exported sync helper:
  - `'plaid'` → import and call `syncPlaidAccount(accountId, ownerId)` from `./plaid`
  - `'stripe'` → import and call `syncStripeAccount(accountId, ownerId)` from `./stripe`
- Return `{ success: true, transactionCount }`

- [ ] **Step 2: Export from index.ts**

Add: `export { onManualSync } from './manualSync';`

- [ ] **Step 3: Build and commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges/functions && npm run build
cd /Users/devinwilson/Projects/personal/openchanges && git add functions/src/manualSync.ts functions/src/plaid.ts functions/src/stripe.ts functions/src/index.ts && git commit -m "feat(finance): add manual sync Cloud Function with 15-min throttle"
```

---

### Task 5: TypeScript Types & Firestore Service Layer

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/services/firestore.ts`
- Modify: `web/src/hooks/useFirestore.ts`

- [ ] **Step 1: Add ConnectedAccount and Transaction interfaces to types.ts**

Add after the existing `ExpenseCategory` type (around line 279):

```typescript
// === Phase 2: Bank & Payment Integration ===

export type AccountProvider = 'plaid' | 'stripe';
export type AccountStatus = 'active' | 'error' | 'disconnected';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'uncategorized';
export type TransactionProvider = 'plaid' | 'stripe' | 'manual';
export type MatchStatus = 'unmatched' | 'suggested' | 'confirmed' | 'rejected';

export interface ConnectedAccount {
  id: string;
  ownerId: string;
  provider: AccountProvider;
  accountName: string;
  institutionName: string;
  accountMask: string;
  status: AccountStatus;
  errorMessage?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  ownerId: string;
  accountId?: string;
  provider: TransactionProvider;
  externalId?: string;
  date: Date;
  amount: number;
  description: string;
  category: string;
  type: TransactionType;
  matchedWorkItemId?: string;
  matchConfidence?: number;
  matchStatus: MatchStatus;
  isManual: boolean;
  receiptUrl?: string;
  taxDeductible?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Add Firestore converters and service functions**

Add to `web/src/services/firestore.ts`:

Converters (follow existing `docToWorkItem`/`docToClient` patterns):
- `docToConnectedAccount(id, data)` — converts Firestore doc to ConnectedAccount, handles Timestamp→Date for lastSyncedAt, createdAt, updatedAt
- `docToTransaction(id, data)` — converts Firestore doc to Transaction, handles Timestamp→Date for date, createdAt, updatedAt

**Important — add Firestore imports:** The existing `firestore.ts` imports need `limit`, `startAfter`, `getDocs`, `DocumentSnapshot` added from `firebase/firestore` for pagination support.

Subscription functions:
- `subscribeConnectedAccounts(callback)` — `onSnapshot` on `connectedAccounts` where `ownerId == currentUser.uid`, ordered by `createdAt desc`. Note: This MUST include `where('ownerId', '==', auth.currentUser!.uid)` because the Firestore security rules require `resource.data.ownerId == request.auth.uid` for reads — a collection-wide listener without this filter would be denied. Access `auth` from `../lib/firebase` (same pattern as other functions in this file).

CRUD functions:
- `deleteConnectedAccount(id)` — deletes from `connectedAccounts`. Also call `onDeleteConnectedAccount` callable Cloud Function to clean up the corresponding `_secrets` document (client can't access `_secrets` directly).
- `updateTransactionCategory(id, category)` — updates `category` and `updatedAt` on a transaction

Paginated query (NOT `onSnapshot` — transactions can be thousands):
- `fetchTransactions(options: { limit?: number, startAfter?: DocumentSnapshot, accountId?: string, type?: string, dateFrom?: Date, dateTo?: Date })` — returns `{ transactions: Transaction[], lastDoc: DocumentSnapshot | null, hasMore: boolean }`. Wrap in try/catch for Firestore permission errors (unauthenticated, rules violations) and return empty results on error.

- [ ] **Step 3: Add useConnectedAccounts hook**

Add to `web/src/hooks/useFirestore.ts`:

```typescript
export function useConnectedAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeConnectedAccounts((items) => {
      setAccounts(items);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { accounts, loading };
}
```

Note: No `useTransactions` hook — transactions use paginated fetching, not real-time subscriptions. The Transactions page will manage pagination state locally.

- [ ] **Step 4: Verify build**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/web && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/lib/types.ts web/src/services/firestore.ts web/src/hooks/useFirestore.ts && git commit -m "feat(finance): add ConnectedAccount/Transaction types, Firestore service layer, and hooks"
```

---

### Task 6: Plaid Link Button & Stripe Connect Form

**Files:**
- Create: `web/src/components/finance/PlaidLinkButton.tsx`
- Create: `web/src/components/finance/StripeConnectForm.tsx`

- [ ] **Step 1: Create PlaidLinkButton**

```typescript
import { useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  linkToken: string | null;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
  loading?: boolean;
}

export function PlaidLinkButton({ linkToken, onSuccess, onExit, loading }: PlaidLinkButtonProps) {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => onSuccess(publicToken),
    onExit: () => onExit(),
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading || !linkToken}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Connecting...' : 'Connect Bank Account'}
    </button>
  );
}
```

- [ ] **Step 2: Create StripeConnectForm**

A form with:
- Text input for the restricted API key (masked after 4 chars)
- "Connect" button that calls `onStripeConnect` Cloud Function
- Loading state during validation
- Error display if key is invalid
- Instructions text: "Enter a Stripe restricted API key with charges:read, balance:read, and payment_intents:read permissions"

- [ ] **Step 3: Verify build**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/components/finance/PlaidLinkButton.tsx web/src/components/finance/StripeConnectForm.tsx && git commit -m "feat(finance): add PlaidLinkButton and StripeConnectForm components"
```

---

### Task 7: Connected Accounts Page

**Files:**
- Create: `web/src/components/finance/ConnectedAccountCard.tsx`
- Create: `web/src/routes/contractor/Accounts.tsx`

- [ ] **Step 1: Create ConnectedAccountCard**

A card component showing:
- Provider icon/label (Plaid bank name or "Stripe")
- Account name and mask (e.g., "Chase Business ····4521")
- Status indicator: green dot for active, red for error, gray for disconnected
- Error banner with message when `status == 'error'` and re-connect button
- Last synced timestamp
- "Sync Now" button (calls `onManualSync`, disabled if synced within 15 min)
- "Disconnect" button (calls `deleteConnectedAccount`)

Props: `{ account: ConnectedAccount, onSync: (id: string) => void, onDisconnect: (id: string) => void, onReconnect: (id: string) => void }`

- [ ] **Step 2: Create Accounts page**

`web/src/routes/contractor/Accounts.tsx` (default export, lazy-loaded):

- Uses `useConnectedAccounts()` hook
- Shows list of `ConnectedAccountCard` components
- "Connect Bank Account" section with PlaidLinkButton:
  - On mount/click, calls `onPlaidLinkToken` Cloud Function to get a link token
  - On Plaid Link success, calls `onPlaidExchange` Cloud Function
  - Shows toast on success/failure
- "Connect Stripe" section with StripeConnectForm
- Import `httpsCallable` from `firebase/functions` and the `functions` instance from `../../lib/firebase`

- [ ] **Step 3: Verify build and commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges/web && npx tsc --noEmit
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/components/finance/ConnectedAccountCard.tsx web/src/routes/contractor/Accounts.tsx && git commit -m "feat(finance): add Connected Accounts page with Plaid Link and Stripe connect"
```

---

### Task 8: Transaction Ledger Page

**Files:**
- Create: `web/src/components/finance/TransactionRow.tsx`
- Create: `web/src/routes/contractor/Transactions.tsx`

- [ ] **Step 1: Create TransactionRow**

A table row component for a single transaction:
- Date column
- Description column
- Source badge (Plaid bank name / Stripe / Manual)
- Amount (green for positive/income, red for negative/expense)
- Category badge (editable — clicking opens a dropdown of EXPENSE_CATEGORIES)
- Inline category edit calls `updateTransactionCategory()` from firestore service

Props: `{ transaction: Transaction, accounts: ConnectedAccount[], onCategoryChange: (id: string, category: string) => void }`

- [ ] **Step 2: Create Transactions page**

`web/src/routes/contractor/Transactions.tsx` (default export, lazy-loaded):

Key features:
- **Connected accounts bar** at top: shows each account with status dot and last sync time. Uses `useConnectedAccounts()`. "+ Connect Account" links to `/dashboard/finance/accounts`.
- **Filters row**: account dropdown, date range, type (income/expense/all), search text
- **Transaction table** with TransactionRow components
- **Cursor-based pagination**: "Load More" button at bottom
  - Uses `fetchTransactions()` from firestore service
  - Tracks `lastDoc` for cursor, `hasMore` for showing button
  - Initial load: 50 transactions
  - Each "Load More" appends 50 more
- **Loading states**: skeleton rows on initial load, spinner on "Load More"
- Filter changes reset pagination (clear results, fetch fresh with new filters)

State management:
```typescript
const [transactions, setTransactions] = useState<Transaction[]>([]);
const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
const [hasMore, setHasMore] = useState(true);
const [loading, setLoading] = useState(true);
const [filters, setFilters] = useState({ accountId: '', type: '', dateFrom: null, dateTo: null });
```

- [ ] **Step 3: Verify build and commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/components/finance/TransactionRow.tsx web/src/routes/contractor/Transactions.tsx && git commit -m "feat(finance): add Transactions ledger page with cursor-based pagination"
```

---

### Task 9: Sidebar & Route Wiring

**Files:**
- Modify: `web/src/components/Sidebar.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add Transactions and Accounts to sidebar finance group**

In `Sidebar.tsx`, find the finance nav group children array (around line 28-38) and add two new items:

```typescript
children: [
  { to: '/dashboard/finance', key: 'finance-overview', label: 'Overview', Icon: IconDashboard },
  { to: '/dashboard/finance/invoices', key: 'finance-invoices', label: 'Invoices', Icon: IconDollar },
  { to: '/dashboard/finance/transactions', key: 'finance-transactions', label: 'Transactions', Icon: IconList },
  { to: '/dashboard/finance/reports', key: 'finance-reports', label: 'Reports', Icon: IconDocument },
  { to: '/dashboard/finance/accounts', key: 'finance-accounts', label: 'Accounts', Icon: IconSettings },
],
```

Use appropriate icons from the existing icon library. Read `web/src/components/icons/Icons.tsx` to find suitable icons.

- [ ] **Step 2: Add lazy imports and routes to App.tsx**

Add lazy imports:
```typescript
const Transactions = lazy(() => import('./routes/contractor/Transactions'));
const Accounts = lazy(() => import('./routes/contractor/Accounts'));
```

Add routes alongside existing finance routes:
```typescript
<Route path="finance/transactions" element={<Transactions />} />
<Route path="finance/accounts" element={<Accounts />} />
```

Note: Transactions and Accounts may not need `workItems`/`clients` props — they use their own hooks and fetch functions. Check what the components actually need.

- [ ] **Step 3: Verify build**

Run: `cd /Users/devinwilson/Projects/personal/openchanges/web && npm run build`

- [ ] **Step 4: Commit**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add web/src/components/Sidebar.tsx web/src/App.tsx && git commit -m "feat(finance): add Transactions and Accounts routes to sidebar and router"
```

---

### Task 10: Integration Testing & Polish

**Files:**
- All Phase 2 files

- [ ] **Step 1: Run all tests**

```bash
cd /Users/devinwilson/Projects/personal/openchanges/web && npx vitest run
cd /Users/devinwilson/Projects/personal/openchanges/functions && npx vitest run
```

- [ ] **Step 2: Run web build**

```bash
cd /Users/devinwilson/Projects/personal/openchanges/web && npm run build
```

- [ ] **Step 3: Run functions build**

```bash
cd /Users/devinwilson/Projects/personal/openchanges/functions && npm run build
```

- [ ] **Step 4: Run lint**

```bash
cd /Users/devinwilson/Projects/personal/openchanges/web && npm run lint
```

- [ ] **Step 5: Verify all finance files present**

Check existence of all new files:
- `functions/src/utils/crypto.ts` + `crypto.test.ts`
- `functions/src/plaid.ts`
- `functions/src/stripe.ts`
- `functions/src/manualSync.ts`
- `web/src/components/finance/PlaidLinkButton.tsx`
- `web/src/components/finance/StripeConnectForm.tsx`
- `web/src/components/finance/ConnectedAccountCard.tsx`
- `web/src/components/finance/TransactionRow.tsx`
- `web/src/routes/contractor/Transactions.tsx`
- `web/src/routes/contractor/Accounts.tsx`

- [ ] **Step 6: Fix any issues and commit if needed**

```bash
cd /Users/devinwilson/Projects/personal/openchanges && git add -A && git commit -m "fix(finance): Phase 2 integration polish"
```

---

## Environment Setup Required

Before deploying Phase 2, the following Firebase secrets must be set:

```bash
firebase functions:secrets:set PLAID_CLIENT_ID
firebase functions:secrets:set PLAID_SECRET
firebase functions:secrets:set PLAID_ENV          # 'sandbox' for dev, 'production' for live
firebase functions:secrets:set TOKEN_ENCRYPTION_KEY  # 64-char hex string (32 bytes)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

Generate the encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Testing Notes

- **Plaid Sandbox**: Use Plaid sandbox credentials for all development. Sandbox provides test bank accounts and transactions without real bank connections.
- **Stripe Test Mode**: Use Stripe test API keys (starting with `rk_test_`). Test charges can be created via Stripe dashboard.
- **Manual testing flow**: Connect bank → wait for sync (or trigger manual sync) → verify transactions appear in ledger.

## Phase 3 (Next)

After Phase 2 ships, Phase 3 will add:
- Smart match suggestions (`onTransactionCreated` Firestore trigger)
- Expenses page (manual entry + auto-import from transactions)
- Receipt upload to Firebase Storage
- Full P&L with expense data
- 1099-ready tax summary with categorized deductions
