import { describe, it, expect } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.KEY_ENCRYPTION_SECRET = 'unit-test-key-encryption-secret';

const { encryptSecret, decryptSecret, isEncrypted } = await import('../lib/crypto');

describe('secret encryption', () => {
  it('round-trips', () => {
    const secret = 'sk-or-v1-abcdef0123456789';
    const enc = encryptSecret(secret);
    expect(enc).toMatch(/^enc:v1:/);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc)).toBe(secret);
    expect(isEncrypted(enc)).toBe(true);
  });

  it('produces unique ciphertexts per call (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('passes legacy plaintext through decryptSecret unchanged', () => {
    expect(decryptSecret('sk-plain-legacy')).toBe('sk-plain-legacy');
    expect(isEncrypted('sk-plain-legacy')).toBe(false);
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptSecret('payload');
    const tampered = enc.slice(0, -3) + 'AAA';
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
