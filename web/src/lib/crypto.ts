/**
 * Client-side encryption engine for the Key Vault.
 *
 * Uses Web Crypto API:
 *   - PBKDF2 (600k iterations, SHA-256) to derive a key from master password + salt
 *   - AES-256-GCM for authenticated encryption
 *
 * All secrets are encrypted/decrypted in the browser.
 * Firestore only ever sees ciphertext.
 */

const PBKDF2_ITERATIONS = 600_000;
const VERIFICATION_PHRASE = 'openchanges-vault-verified';

/* ── Helpers ──────────────────────────────────────── */

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/* ── Key Derivation ───────────────────────────────── */

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* ── Encrypt / Decrypt ────────────────────────────── */

export async function encrypt(
  key: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

export async function decrypt(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

/* ── Vault Lifecycle ──────────────────────────────── */

/** Create a new vault — returns the meta to store in Firestore. */
export async function createVaultCrypto(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const key = await deriveKey(password, salt);
  const { ciphertext, iv } = await encrypt(key, VERIFICATION_PHRASE);
  return {
    key,
    meta: {
      salt: toBase64(salt),
      verificationCiphertext: ciphertext,
      verificationIv: iv,
    },
  };
}

/** Attempt to unlock an existing vault. Returns the derived key or null. */
export async function unlockVault(
  password: string,
  saltB64: string,
  verificationCiphertext: string,
  verificationIv: string,
): Promise<CryptoKey | null> {
  const key = await deriveKey(password, fromBase64(saltB64));
  try {
    const result = await decrypt(key, verificationCiphertext, verificationIv);
    return result === VERIFICATION_PHRASE ? key : null;
  } catch {
    return null; // Wrong password — GCM auth tag mismatch
  }
}
