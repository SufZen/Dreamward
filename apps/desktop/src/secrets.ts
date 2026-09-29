/* ============================================================================
 * Secrets the engine needs (session signing + at-rest encryption of AI keys),
 * generated on first run and stored encrypted with the OS keychain via
 * Electron safeStorage (DPAPI on Windows, Keychain on macOS, libsecret/kwallet
 * on Linux). Where no keychain exists, a 0600 file is used instead.
 * ========================================================================= */
import { safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface EngineSecrets {
  JWT_SECRET: string;
  KEY_ENCRYPTION_SECRET: string;
}

export class SecretsUnreadableError extends Error {}

const ENCRYPTED = Buffer.from('LBS1');
const PLAIN = Buffer.from('LBP1');

const file = (dir: string) => join(dir, 'secrets.bin');

function generate(): EngineSecrets {
  return { JWT_SECRET: randomBytes(48).toString('hex'), KEY_ENCRYPTION_SECRET: randomBytes(32).toString('hex') };
}

function save(dir: string, secrets: EngineSecrets) {
  const json = JSON.stringify(secrets);
  const body = safeStorage.isEncryptionAvailable()
    ? Buffer.concat([ENCRYPTED, safeStorage.encryptString(json)])
    : Buffer.concat([PLAIN, Buffer.from(json)]);
  writeFileSync(file(dir), body, { mode: 0o600 });
}

export function loadSecrets(dir: string): EngineSecrets {
  if (!existsSync(file(dir))) {
    const fresh = generate();
    save(dir, fresh);
    return fresh;
  }
  const raw = readFileSync(file(dir));
  try {
    const magic = raw.subarray(0, 4);
    const json = magic.equals(ENCRYPTED)
      ? safeStorage.decryptString(raw.subarray(4))
      : magic.equals(PLAIN)
        ? raw.subarray(4).toString('utf8')
        : null;
    const parsed = json ? (JSON.parse(json) as Partial<EngineSecrets>) : null;
    if (parsed?.JWT_SECRET && parsed.KEY_ENCRYPTION_SECRET) return parsed as EngineSecrets;
  } catch {
    /* keychain unavailable or changed */
  }
  throw new SecretsUnreadableError('secrets.bin could not be read');
}

/** New secrets; the old file is kept aside. Saved AI keys must be re-entered afterwards. */
export function resetSecrets(dir: string): EngineSecrets {
  if (existsSync(file(dir))) copyFileSync(file(dir), `${file(dir)}.${Date.now()}.bak`);
  const fresh = generate();
  save(dir, fresh);
  return fresh;
}
