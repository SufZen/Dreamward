/* ============================================================================
 * apps/api — scripts/migrate-to-multiuser.ts
 * One-time, automatic layout migration: a pre-multiuser data dir has
 * ${DATA_DIR}/lifebook.db + ${DATA_DIR}/assets. The multi-user layout is
 * ${DATA_DIR}/control.db + ${DATA_DIR}/users/<uid>/{lifebook.db,assets}.
 * The existing single user becomes admin (uid=1); their email + argon2 hash
 * are carried into the control DB by the caller (ensureAdminUser).
 * Runs at boot before anything opens a DB. Idempotent: no legacy db → no-op.
 * ========================================================================= */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { controlDbPath } from '../db/control';

export interface LegacyUser {
  email: string;
  passwordHash: string;
}

export function migrateLegacyLayout(dataRoot: string): LegacyUser | null {
  const legacyDb = join(dataRoot, 'lifebook.db');
  if (!existsSync(legacyDb) || existsSync(controlDbPath(dataRoot))) return null;

  console.log('[migrate-multiuser] legacy single-user layout detected — moving to users/1/');
  const userRoot = join(dataRoot, 'users', '1');
  mkdirSync(userRoot, { recursive: true });

  // Move DB + WAL sidecars (nothing has opened the DB yet at boot time).
  for (const suffix of ['', '-wal', '-shm']) {
    const src = join(dataRoot, `lifebook.db${suffix}`);
    if (existsSync(src)) renameSync(src, join(userRoot, `lifebook.db${suffix}`));
  }

  // Move the assets tree wholesale (same volume → rename is atomic and free).
  const legacyAssets = join(dataRoot, 'assets');
  const targetAssets = join(userRoot, 'assets');
  if (existsSync(legacyAssets) && !existsSync(targetAssets)) {
    renameSync(legacyAssets, targetAssets);
  }

  // Extract the single user's credentials for the control-DB bootstrap.
  const sqlite = new Database(join(userRoot, 'lifebook.db'), { readonly: true });
  try {
    const row = sqlite.prepare('SELECT email, password_hash FROM users LIMIT 1').get() as
      | { email: string; password_hash: string }
      | undefined;
    if (!row) return null;
    console.log(`[migrate-multiuser] carried over account ${row.email} as admin (uid=1)`);
    return { email: row.email, passwordHash: row.password_hash };
  } finally {
    sqlite.close();
  }
}
