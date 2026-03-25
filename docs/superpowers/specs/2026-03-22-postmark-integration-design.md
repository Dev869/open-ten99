# Postmark Integration — Design Spec

## Problem

The Postmark inbound email webhook is no longer forwarding to the Cloud Function. The webhook secret is managed via Firebase Functions environment config (`defineString`), requiring a redeploy to change. There is no UI to configure or troubleshoot the integration.

## Solution

Add a Postmark section to the Connected Accounts page (`/dashboard/finance/accounts`) that displays the webhook URL and lets the contractor save an encrypted webhook secret — all self-service, no redeploy needed.

## Architecture

### Encryption Flow

```
Browser                          Cloud Function                    Firestore
──────                          ──────────────                    ─────────
User enters secret ──POST──►  onSavePostmarkSecret
                               │ read POSTMARK_ENCRYPTION_KEY
                               │ generate random 12-byte IV
                               │ AES-256-GCM encrypt(secret)
                               │ store { ciphertext, iv } ──────► /integrations/{uid}.postmarkWebhook
                               └─► return { success: true }

Postmark webhook ──POST──►    onEmailReceived
                               │ resolveContractorUid()
                               │ read /integrations/{uid} ◄────── Firestore
                               │ decrypt with POSTMARK_ENCRYPTION_KEY
                               │ timingSafeEqual(header, decrypted)
                               │ ... process email as before
```

### Server-Side Encryption Key

- `POSTMARK_ENCRYPTION_KEY` — a 32-byte hex string (64 hex characters) stored as a Firebase Functions secret via `defineSecret`
- Set once: `firebase functions:secrets:set POSTMARK_ENCRYPTION_KEY`
- Only Cloud Functions can access it; never exposed to the client
- **Key absence handling**: If the key is not set, `onSavePostmarkSecret` returns a clear error ("Encryption not configured — set POSTMARK_ENCRYPTION_KEY in Cloud Functions secrets"). `onEmailReceived` falls back to the env var.
- **Key rotation**: Rotating the key invalidates existing ciphertexts. Contractors must re-enter their Postmark secret after a key rotation. A future enhancement could re-encrypt on rotation.

### New Callable Cloud Function: `onSavePostmarkSecret`

```typescript
// Input: { secret: string }
// Steps:
//   0. If secret === "", delete postmarkWebhook field from /integrations/{uid},
//      return { success: true, cleared: true }. Skip remaining steps.
//   1. Verify caller is authenticated (contractor via Google sign-in provider)
//   2. Validate POSTMARK_ENCRYPTION_KEY is set (64 hex chars); fail with clear error if not
//   3. Validate secret input (length 1–256, printable ASCII only; reject null/undefined/non-string)
//   4. Generate random 12-byte IV
//   5. Encrypt secret with AES-256-GCM
//   6. Write to /integrations/{uid}.postmarkWebhook: { ciphertext, iv, updatedAt }
//   7. Return { success: true }
```

To **disconnect/revoke**, call with `{ secret: "" }` — the function deletes the `postmarkWebhook` field from `/integrations/{uid}` and returns `{ success: true, cleared: true }`.

### Updated `onEmailReceived`

Replace `defineString("POSTMARK_WEBHOOK_SECRET")` with:

1. After `resolveContractorUid()`, read `/integrations/{uid}` doc directly by document ID
2. If `postmarkWebhook.ciphertext` exists, decrypt using `POSTMARK_ENCRYPTION_KEY`
3. Use decrypted value for timing-safe comparison against `x-postmark-secret` header
4. **Fallback**: Only fall back to env var `POSTMARK_WEBHOOK_SECRET` if the `postmarkWebhook` field is **absent** (never configured). If the field exists but decryption fails, return 503 (do not fall back — fail closed).
5. If Firestore read fails (transient error), return 503 so Postmark retries. Never fall back to env var on Firestore errors.

**Fix timing-safe comparison** (existing bug): The current short-circuit `provided.length === expected.length && crypto.timingSafeEqual(...)` leaks length information. Replace with constant-time padded comparison:

```typescript
const provided = Buffer.from(providedSecret);
const expected = Buffer.from(decryptedSecret);
const safeLen = Math.max(provided.length, expected.length);
const paddedProvided = Buffer.alloc(safeLen);
const paddedExpected = Buffer.alloc(safeLen);
provided.copy(paddedProvided);
expected.copy(paddedExpected);
secretValid = crypto.timingSafeEqual(paddedProvided, paddedExpected)
  && provided.length === expected.length;
```

### Data Model

Stored in `/integrations/{uid}` (server-write-only, owner-read-only per existing Firestore rules):

```typescript
// Field on the integrations document
postmarkWebhook?: {
  ciphertext: string;   // AES-256-GCM encrypted secret (hex)
  iv: string;           // hex-encoded 12-byte initialization vector
  updatedAt: Timestamp; // last time secret was saved
}
```

The UI derives "configured" status from `!!postmarkWebhook?.ciphertext` — no separate boolean needed.

Add to `AppSettings` type (for UI consumption via the existing `useIntegration` hook):

```typescript
// No change to AppSettings — postmarkWebhook lives in /integrations, not /settings
```

### Existing Settings Query Fix

The existing `onEmailReceived` reads settings via `where("ownerId", "==", contractorUid)` query. The `updateSettings` and `subscribeSettings` functions in the web app use the UID as document ID directly. Refactor the Cloud Function to read settings via `db.doc("settings", contractorUid)` for consistency.

## UI Design

### Accounts Page — New "Postmark Email" Subsection

Added as a third subsection in the "Add Connection" card, after Bank Account and Stripe:

```
┌─────────────────────────────────────────────┐
│  Postmark Email                    ● Active │
│  Receive client emails as draft work orders │
│                                             │
│  Webhook URL                                │
│  ┌────────────────────────────────────┬────┐│
│  │ https://...cloudfunctions.net/...  │ ⎘  ││
│  └────────────────────────────────────┴────┘│
│                                             │
│  Webhook Secret                             │
│  ┌────────────────────────────────────┐     │
│  │ ••••••••••••••••                   │     │
│  └────────────────────────────────────┘     │
│  Paste this URL and secret into Postmark's  │
│  Inbound webhook settings.                  │
│                                             │
│  [ Save Secret ]          [ Disconnect ]    │
└─────────────────────────────────────────────┘
```

- **Webhook URL**: read-only input with copy-to-clipboard button. Value: `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/onEmailReceived` (project ID from existing env var, region hardcoded to `us-central1` matching the Cloud Function deployment)
- **Status dot**: green if `postmarkWebhook` field exists on the integrations doc, yellow otherwise
- **Secret input**: `type="password"`, clears after successful save
- **Save button**: calls `onSavePostmarkSecret` callable function
- **Disconnect button**: shown only when configured; calls `onSavePostmarkSecret({ secret: "" })` to clear

### Component Structure

Inline in `Accounts.tsx` (following the pattern of the existing Bank Account and Stripe subsections — no separate component file needed).

## Security

- Secret encrypted at rest with AES-256-GCM in Firestore
- Encrypted blob stored in `/integrations/{uid}` — a server-write-only path (`allow write: if false` in Firestore rules). Client can read but only gets ciphertext; decryption key is server-side only
- Encryption key accessible only to Cloud Functions (`defineSecret`)
- Client never reads decrypted secret — only checks field presence for status
- Timing-safe comparison fixed to prevent length leakage (padded buffer approach)
- Input validation: secret must be 1–256 printable ASCII characters
- Fail-closed on decryption errors or Firestore read failures (503, Postmark retries)

## Files Changed

| File | Change |
|------|--------|
| `web/src/routes/contractor/Accounts.tsx` | Add Postmark subsection UI with webhook URL, secret input, disconnect |
| `web/src/hooks/useFirestore.ts` | Extend `useIntegration` hook to expose `postmarkWebhook` field alongside GitHub data |
| `functions/src/postmarkSecret.ts` | New file: `onSavePostmarkSecret` callable (encrypt + store / clear) |
| `functions/src/parseEmail.ts` | Read secret from `/integrations/{uid}`, decrypt, fix timing-safe comparison, refactor settings read |
| `functions/src/index.ts` | Export `onSavePostmarkSecret` |

## Out of Scope

- Postmark API token storage (pull-based email retrieval)
- Sending emails via Postmark
- Postmark server/account management
- Test email / connectivity verification button (future enhancement)
- Encryption key rotation tooling (contractors re-enter secret after rotation)
