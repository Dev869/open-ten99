# Postmark Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-service Postmark webhook integration to the Connected Accounts page, with server-side encrypted secret storage and updated email webhook handler.

**Architecture:** New callable Cloud Function encrypts the webhook secret with AES-256-GCM and stores the ciphertext in the server-write-only `/integrations/{uid}` Firestore path. The existing `onEmailReceived` webhook reads and decrypts the secret from Firestore instead of environment config. The Accounts page UI shows the webhook URL, accepts the secret, and displays configuration status.

**Tech Stack:** Firebase Cloud Functions v2, AES-256-GCM (Node crypto), Firestore, React 19, TypeScript, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-22-postmark-integration-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `functions/src/postmarkSecret.ts` | Create | `onSavePostmarkSecret` callable — validates, encrypts, stores/clears webhook secret |
| `functions/src/parseEmail.ts` | Modify | Read secret from Firestore, decrypt, fix timing-safe comparison, refactor settings read |
| `functions/src/index.ts` | Modify | Export `onSavePostmarkSecret` |
| `web/src/lib/types.ts` | Modify | Add `PostmarkWebhook` interface |
| `web/src/services/firestore.ts` | Modify | Extend `subscribeIntegration` to include `postmarkWebhook` |
| `web/src/hooks/useFirestore.ts` | Modify | Extend `useIntegration` return type |
| `web/src/routes/contractor/Accounts.tsx` | Modify | Add Postmark subsection UI |

---

### Task 1: Create `onSavePostmarkSecret` Cloud Function

**Files:**
- Create: `functions/src/postmarkSecret.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create `functions/src/postmarkSecret.ts`**

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const encryptionKey = defineSecret("POSTMARK_ENCRYPTION_KEY");

// Printable ASCII: space (0x20) through tilde (0x7E)
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

export const onSavePostmarkSecret = onCall(
  { secrets: [encryptionKey] },
  async (request) => {
    // Verify authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    const uid = request.auth.uid;

    // Verify contractor (Google sign-in)
    const user = await admin.auth().getUser(uid);
    const isGoogle = user.providerData.some(
      (p) => p.providerId === "google.com"
    );
    if (!isGoogle) {
      throw new HttpsError("permission-denied", "Contractor access only");
    }

    const secret = request.data?.secret;

    // Step 0: Disconnect — empty string clears the field
    if (secret === "") {
      await admin
        .firestore()
        .doc(`integrations/${uid}`)
        .set(
          { postmarkWebhook: admin.firestore.FieldValue.delete() },
          { merge: true }
        );
      return { success: true, cleared: true };
    }

    // Validate secret
    if (typeof secret !== "string") {
      throw new HttpsError("invalid-argument", "Secret must be a string");
    }
    if (secret.length < 1 || secret.length > 256) {
      throw new HttpsError(
        "invalid-argument",
        "Secret must be 1–256 characters"
      );
    }
    if (!PRINTABLE_ASCII.test(secret)) {
      throw new HttpsError(
        "invalid-argument",
        "Secret must contain only printable ASCII characters"
      );
    }

    // Validate encryption key
    const keyHex = encryptionKey.value();
    if (!keyHex || keyHex.length !== 64) {
      throw new HttpsError(
        "internal",
        "Encryption not configured — set POSTMARK_ENCRYPTION_KEY in Cloud Functions secrets"
      );
    }

    // Encrypt with AES-256-GCM
    const key = Buffer.from(keyHex, "hex");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Store ciphertext + authTag + iv
    await admin
      .firestore()
      .doc(`integrations/${uid}`)
      .set(
        {
          postmarkWebhook: {
            ciphertext: Buffer.concat([encrypted, authTag]).toString("hex"),
            iv: iv.toString("hex"),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    return { success: true };
  }
);
```

- [ ] **Step 2: Export from `functions/src/index.ts`**

Add this line after the existing exports:

```typescript
export { onSavePostmarkSecret } from "./postmarkSecret";
```

- [ ] **Step 3: Build and verify no compile errors**

Run: `cd functions && npm run build`
Expected: Clean compile, no errors

- [ ] **Step 4: Commit**

```bash
git add functions/src/postmarkSecret.ts functions/src/index.ts
git commit -m "feat: add onSavePostmarkSecret callable for encrypted webhook secret storage"
```

---

### Task 2: Update `onEmailReceived` to read secret from Firestore

**Files:**
- Modify: `functions/src/parseEmail.ts`

- [ ] **Step 1: Add decryption helper and update imports**

At the top of `functions/src/parseEmail.ts`, replace the `defineString` import and `webhookSecret` const:

Replace:
```typescript
import { defineString } from "firebase-functions/params";
```
With:
```typescript
import { defineString, defineSecret } from "firebase-functions/params";
```

Replace:
```typescript
const webhookSecret = defineString("POSTMARK_WEBHOOK_SECRET");
```
With:
```typescript
const webhookSecret = defineString("POSTMARK_WEBHOOK_SECRET");
const encryptionKey = defineSecret("POSTMARK_ENCRYPTION_KEY");
```

Add after the `GeminiParseResult` interface (after line 31):

```typescript
/**
 * Decrypts a Postmark webhook secret stored as AES-256-GCM ciphertext.
 * The ciphertext includes the 16-byte auth tag appended.
 */
function decryptSecret(ciphertextHex: string, ivHex: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const raw = Buffer.from(ciphertextHex, "hex");
  // Last 16 bytes are the GCM auth tag
  const authTag = raw.subarray(raw.length - 16);
  const encrypted = raw.subarray(0, raw.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 2: Update `onEmailReceived` to use `secrets` option and Firestore-based secret**

Update the `onRequest` options to include the encryption key secret:

Replace:
```typescript
export const onEmailReceived = onRequest(
  { maxInstances: 10, timeoutSeconds: 120 },
```
With:
```typescript
export const onEmailReceived = onRequest(
  { maxInstances: 10, timeoutSeconds: 120, secrets: [encryptionKey] },
```

- [ ] **Step 3: Replace the secret validation block**

Replace lines 53–73 (the entire secret validation block) with:

```typescript
    // --- Resolve contractor first (needed for Firestore secret lookup) ---
    let contractorUid: string | null;
    try {
      contractorUid = await resolveContractorUid();
    } catch (err) {
      logger.error("Failed to resolve contractor uid", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).send("Service Unavailable");
      return;
    }
    if (!contractorUid) {
      logger.warn(
        "Could not resolve a single contractor uid — skipping email processing"
      );
      res.status(200).send("OK");
      return;
    }

    // --- Validate webhook secret ---
    const providedSecret = req.headers["x-postmark-secret"];
    if (typeof providedSecret !== "string" || providedSecret.length === 0) {
      logger.warn("Missing webhook secret header");
      res.status(401).send("Unauthorized");
      return;
    }

    let expectedSecret: string | null = null;

    // Try Firestore first
    try {
      const integrationSnap = await admin
        .firestore()
        .doc(`integrations/${contractorUid}`)
        .get();
      const pmWebhook = integrationSnap.data()?.postmarkWebhook;

      if (pmWebhook?.ciphertext && pmWebhook?.iv) {
        const keyHex = encryptionKey.value();
        if (!keyHex || keyHex.length !== 64) {
          logger.error("POSTMARK_ENCRYPTION_KEY not configured or invalid");
          res.status(503).send("Service Unavailable");
          return;
        }
        try {
          expectedSecret = decryptSecret(pmWebhook.ciphertext, pmWebhook.iv, keyHex);
        } catch (decryptErr) {
          logger.error("Failed to decrypt Postmark webhook secret", {
            error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr),
          });
          res.status(503).send("Service Unavailable");
          return;
        }
      } else {
        // Field absent — fall back to env var
        const envSecret = webhookSecret.value();
        if (envSecret && envSecret.length > 0) {
          expectedSecret = envSecret;
        }
      }
    } catch (firestoreErr) {
      logger.error("Failed to read integration doc", {
        error: firestoreErr instanceof Error ? firestoreErr.message : String(firestoreErr),
      });
      res.status(503).send("Service Unavailable");
      return;
    }

    if (!expectedSecret) {
      logger.warn("No webhook secret configured (Firestore or env)");
      res.status(401).send("Unauthorized");
      return;
    }

    // Timing-safe comparison with padding to prevent length leakage
    const provided = Buffer.from(providedSecret);
    const expected = Buffer.from(expectedSecret);
    const safeLen = Math.max(provided.length, expected.length);
    const paddedProvided = Buffer.alloc(safeLen);
    const paddedExpected = Buffer.alloc(safeLen);
    provided.copy(paddedProvided);
    expected.copy(paddedExpected);
    const secretValid =
      crypto.timingSafeEqual(paddedProvided, paddedExpected) &&
      provided.length === expected.length;

    if (!secretValid) {
      logger.warn("Invalid webhook secret received");
      res.status(401).send("Unauthorized");
      return;
    }
```

- [ ] **Step 4: Remove the duplicate `resolveContractorUid()` call and refactor settings read**

Since `contractorUid` is now resolved before secret validation, remove the original call inside the `try` block (around line 101 in the original). Also refactor the settings read from query to direct doc:

Replace the old block:
```typescript
      // --- Step 0: Resolve contractor uid ---
      // Inbound emails don't carry a contractor identifier, so we identify the
      // target contractor by finding Firebase Auth users whose sign-in provider
      // is google.com (the only contractor auth method). If exactly one exists
      // we proceed; otherwise we cannot safely scope the data.
      const contractorUid = await resolveContractorUid();
      if (!contractorUid) {
        logger.warn(
          "Could not resolve a single contractor uid — skipping email processing"
        );
        res.status(200).send("OK"); // return 200 so Postmark does not retry
        return;
      }
```
With nothing (delete it — already handled above).

Replace the settings query:
```typescript
      const settingsSnap = await db
        .collection("settings")
        .where("ownerId", "==", contractorUid)
        .limit(1)
        .get();
      let hourlyRate = 150; // sensible default
      if (!settingsSnap.empty) {
        const settingsData = settingsSnap.docs[0].data();
        hourlyRate = settingsData.hourlyRate ?? hourlyRate;
      }
```
With direct doc read:
```typescript
      const settingsSnap = await db.doc(`settings/${contractorUid}`).get();
      let hourlyRate = 150;
      if (settingsSnap.exists) {
        hourlyRate = settingsSnap.data()?.hourlyRate ?? hourlyRate;
      }
```

- [ ] **Step 5: Build and verify**

Run: `cd functions && npm run build`
Expected: Clean compile, no errors

- [ ] **Step 6: Commit**

```bash
git add functions/src/parseEmail.ts
git commit -m "feat: read Postmark secret from Firestore with AES-256-GCM decryption, fix timing-safe comparison"
```

---

### Task 3: Extend `useIntegration` hook to include `postmarkWebhook`

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/services/firestore.ts`
- Modify: `web/src/hooks/useFirestore.ts`

- [ ] **Step 1: Add `PostmarkWebhook` interface to types**

In `web/src/lib/types.ts`, after the `GitHubIntegration` interface (after line 229), add:

```typescript
export interface PostmarkWebhook {
  ciphertext: string;
  iv: string;
  updatedAt: Date;
}

export interface IntegrationData {
  github: GitHubIntegration | null;
  postmarkConfigured: boolean;
}
```

- [ ] **Step 2: Update `subscribeIntegration` in `web/src/services/firestore.ts`**

First, update the import at the top of `firestore.ts` to include `IntegrationData`:

```typescript
// In the existing type import from '../lib/types', add IntegrationData
import type { ..., IntegrationData } from '../lib/types';
```

Replace the `subscribeIntegration` function (lines 764–784):

```typescript
export function subscribeIntegration(
  userId: string,
  callback: (integration: IntegrationData) => void
) {
  const ref = doc(db, 'integrations', userId);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback({ github: null, postmarkConfigured: false });
      return;
    }
    const data = snapshot.data();
    const github: GitHubIntegration | null = data.connected
      ? {
          connected: data.connected ?? false,
          login: data.login ?? '',
          avatarUrl: data.avatarUrl ?? undefined,
          orgs: data.orgs ?? [],
          connectedAt: toDate(data.connectedAt),
          lastSyncAt: data.lastSyncAt ? toDate(data.lastSyncAt) : undefined,
        }
      : null;
    const postmarkConfigured = !!data.postmarkWebhook?.ciphertext;
    callback({ github, postmarkConfigured });
  });
}
```

- [ ] **Step 3: Update `useIntegration` hook in `web/src/hooks/useFirestore.ts`**

First, update the import at the top of `useFirestore.ts` to replace `GitHubIntegration` with `IntegrationData`:

```typescript
// In the existing type import from '../lib/types', replace GitHubIntegration with IntegrationData
import type { ..., IntegrationData } from '../lib/types';
```

Replace the `useIntegration` function (lines 183–198):

```typescript
export function useIntegration(userId: string | undefined) {
  const [integration, setIntegration] = useState<IntegrationData>({
    github: null,
    postmarkConfigured: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeIntegration(userId, (i) => {
      setIntegration(i);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { integration, loading };
}
```

- [ ] **Step 4: Update all consumers of `useIntegration`**

The `useIntegration` hook returns `{ integration }` where `integration` was `GitHubIntegration | null`. Now it's `IntegrationData`. Update `Settings.tsx` which consumes it:

In `web/src/routes/contractor/Settings.tsx`, find where `integration` is used (the GitHub integration section). The hook call looks like:

```typescript
const { integration } = useIntegration(user?.uid);
```

Update all `integration` property accesses in the GitHub section of Settings.tsx:

| Line | Old | New |
|------|-----|-----|
| 424 | `integration?.connected` | `integration.github?.connected` |
| 428 | `integration.avatarUrl` | `integration.github?.avatarUrl` |
| 430 | `integration.avatarUrl` | `integration.github?.avatarUrl` |
| 431 | `integration.login` | `integration.github?.login` |
| 436 | `integration.login.charAt(0)` | `integration.github?.login.charAt(0)` |
| 440 | `integration.login` | `integration.github?.login` |
| 441 | `integration.lastSyncAt` | `integration.github?.lastSyncAt` |
| 443 | `integration.lastSyncAt` | `integration.github?.lastSyncAt` |
| 450 | `integration.orgs.length` | `integration.github?.orgs.length` |
| 452 | `integration.orgs.map` | `integration.github?.orgs.map` |

- [ ] **Step 5: Update `AppsList.tsx`**

In `web/src/routes/contractor/AppsList.tsx` line 75, change:

```typescript
{integration?.connected && (
```
To:
```typescript
{integration.github?.connected && (
```

- [ ] **Step 6: Build and verify**

Run: `cd web && npm run build`
Expected: Clean compile, no errors

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/types.ts web/src/services/firestore.ts web/src/hooks/useFirestore.ts web/src/routes/contractor/Settings.tsx web/src/routes/contractor/AppsList.tsx
git commit -m "feat: extend useIntegration hook with postmarkConfigured status"
```

---

### Task 4: Add Postmark UI to Accounts page

**Files:**
- Modify: `web/src/routes/contractor/Accounts.tsx`

- [ ] **Step 1: Add Postmark state and handler**

At the top of `Accounts.tsx`, add the import for `useIntegration` and `useAuth`, and add state variables after the existing state declarations:

```typescript
import { useConnectedAccounts, useIntegration } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
```

Inside the component, add after the existing state:

```typescript
const { user } = useAuth();
const { integration } = useIntegration(user?.uid);

// Postmark state
const [postmarkSecret, setPostmarkSecret] = useState('');
const [postmarkLoading, setPostmarkLoading] = useState(false);
const [postmarkError, setPostmarkError] = useState<string | null>(null);
const [copied, setCopied] = useState(false);

const webhookUrl = `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/onEmailReceived`;

const handleSavePostmarkSecret = useCallback(async (secret: string) => {
  setPostmarkLoading(true);
  setPostmarkError(null);
  try {
    const fn = httpsCallable(functions, 'onSavePostmarkSecret');
    await fn({ secret });
    setPostmarkSecret('');
    addToast(secret === '' ? 'Postmark disconnected' : 'Postmark secret saved!', 'success');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save Postmark secret';
    setPostmarkError(message);
    addToast(message, 'error');
  } finally {
    setPostmarkLoading(false);
  }
}, [addToast]);

const handleCopyWebhookUrl = useCallback(() => {
  navigator.clipboard.writeText(webhookUrl);
  setCopied(true);
  addToast('Webhook URL copied!', 'info');
  setTimeout(() => setCopied(false), 2000);
}, [webhookUrl, addToast]);
```

- [ ] **Step 2: Add Postmark subsection to the "Add Connection" card**

After the Stripe `</div>` closing tag (line 209) and before the closing `</div>` of the "Add Connection" card (line 210), add:

```tsx
          {/* Postmark Email subsection */}
          <div className="p-5 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Postmark Email
              </h3>
              <span className={`flex items-center gap-1.5 text-xs font-medium ${
                integration.postmarkConfigured
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  integration.postmarkConfigured
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`} />
                {integration.postmarkConfigured ? 'Active' : 'Not configured'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Receive client emails as draft work orders. Paste the URL and secret into your Postmark server's Inbound webhook settings.
            </p>

            {/* Webhook URL */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-sm font-mono select-all"
                />
                <button
                  onClick={handleCopyWebhookUrl}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors text-sm"
                  title="Copy to clipboard"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Webhook Secret */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (postmarkSecret.trim()) handleSavePostmarkSecret(postmarkSecret.trim());
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="postmark-secret" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Webhook Secret
                </label>
                <input
                  id="postmark-secret"
                  type="password"
                  value={postmarkSecret}
                  onChange={(e) => setPostmarkSecret(e.target.value)}
                  placeholder={integration.postmarkConfigured ? '••••••••' : 'Enter your webhook secret'}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  disabled={postmarkLoading}
                />
              </div>
              {postmarkError && (
                <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  {postmarkError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={postmarkLoading || !postmarkSecret.trim()}
                  className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {postmarkLoading ? 'Saving...' : 'Save Secret'}
                </button>
                {integration.postmarkConfigured && (
                  <button
                    type="button"
                    onClick={() => handleSavePostmarkSecret('')}
                    disabled={postmarkLoading}
                    className="px-4 py-2.5 rounded-lg border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </form>
          </div>
```

- [ ] **Step 3: Build and verify**

Run: `cd web && npm run build`
Expected: Clean compile, no errors

- [ ] **Step 4: Manual test**

Run: `cd web && npm run dev`
Navigate to `/dashboard/finance/accounts`. Verify:
- Postmark Email section appears below Stripe
- Webhook URL is displayed and copy button works
- Status shows "Not configured" (yellow dot) initially
- Secret input accepts text and Save button enables
- Disconnect button only shows when configured

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/contractor/Accounts.tsx
git commit -m "feat: add Postmark integration UI to Connected Accounts page"
```
