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
    expect(() => decryptToken(tampered, tampered)).toThrow();
  });
});
