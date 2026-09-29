/* ============================================================================
 * apps/api — services/setup.ts
 * First-run setup without putting an admin password in any file: when the
 * control DB has no accounts (and DREAMWARD_EMAIL/PASSWORD aren't set), the
 * server creates a one-time setup token, prints the setup link to the logs
 * and stores it in DATA_DIR/setup-token (0600). The first person to open the
 * link creates the admin account; the token is then destroyed.
 * ========================================================================= */
import argon2 from 'argon2';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { controlSchema, createAdmin, getControlDb } from '../db/control';
import { provisionUser } from '../db/registry';

let dataRootRef: string | null = null;
const tokenFile = () => join(dataRootRef!, 'setup-token');

export function needsSetup(): boolean {
  return getControlDb().select({ id: controlSchema.controlUsers.id }).from(controlSchema.controlUsers).limit(1).all().length === 0;
}

/** Called at boot. Returns the setup URL when setup is pending. */
export function prepareSetup(dataRoot: string, publicOrigin: string): string | null {
  dataRootRef = dataRoot;
  if (!needsSetup()) {
    rmSync(tokenFile(), { force: true });
    return null;
  }
  let token = existsSync(tokenFile()) ? readFileSync(tokenFile(), 'utf8').trim() : '';
  if (!/^[a-f0-9]{48}$/.test(token)) {
    token = randomBytes(24).toString('hex');
    writeFileSync(tokenFile(), token + '\n', { mode: 0o600 });
  }
  const url = `${publicOrigin.replace(/\/+$/, '')}/setup?token=${token}`;
  console.log(
    [
      '',
      '  ┌──────────────────────────────────────────────────────────────┐',
      '  │  First run — create the admin account by opening this link:  │',
      '  └──────────────────────────────────────────────────────────────┘',
      `  ${url}`,
      `  (also stored in ${tokenFile()})`,
      '',
    ].join('\n'),
  );
  return url;
}

export class SetupError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

/** Validates the token and creates the admin — only while no account exists. */
export async function completeSetup(token: string, email: string, password: string): Promise<number> {
  if (!needsSetup()) throw new SetupError('already_set_up', 409);
  const expected = dataRootRef && existsSync(tokenFile()) ? readFileSync(tokenFile(), 'utf8').trim() : '';
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) throw new SetupError('invalid_token', 403);
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  if (!needsSetup()) throw new SetupError('already_set_up', 409); // lost a race
  const uid = createAdmin(email.toLowerCase(), hash);
  provisionUser(uid, 'admin');
  rmSync(tokenFile(), { force: true });
  return uid;
}
