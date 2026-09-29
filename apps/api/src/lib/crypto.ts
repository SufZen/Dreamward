/* ============================================================================
 * apps/api — lib/crypto.ts
 * At-rest encryption for LLM API keys / OAuth bundles (AES-256-GCM).
 * Format: enc:v1:<iv b64url>:<ciphertext b64url>:<tag b64url>
 * Values not carrying the prefix are returned verbatim by decryptSecret() —
 * that lazily tolerates rows written before encryption existed; they are
 * re-encrypted the next time they're saved.
 * ========================================================================= */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { loadEnv } from '../env';

const PREFIX = 'enc:v1:';
let warned = false;

function key(): Buffer {
  const env = loadEnv();
  let secret = env.KEY_ENCRYPTION_SECRET;
  if (!secret) {
    // Dev/test convenience only — production requires the dedicated secret (env.ts fail-fast).
    secret = `derived:${env.JWT_SECRET}`;
    if (!warned) {
      warned = true;
      console.warn('[crypto] KEY_ENCRYPTION_SECRET not set — deriving from JWT_SECRET (dev only)');
    }
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${ct.toString('base64url')}:${tag.toString('base64url')}`;
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext row
  const [ivB64, ctB64, tagB64] = value.slice(PREFIX.length).split(':');
  if (!ivB64 || !ctB64 || !tagB64) throw new Error('malformed encrypted secret');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string | null): boolean {
  return !!value?.startsWith(PREFIX);
}
