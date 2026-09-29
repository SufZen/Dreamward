/* ============================================================================
 * apps/api — db/control.ts
 * Opens the control-plane DB (${DATA_DIR}/control.db) and owns its lifecycle:
 * idempotent DDL (no drizzle-kit pipeline for this small schema — additive
 * changes go here, guarded), admin bootstrap, and audit helpers.
 * ========================================================================= */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import argon2 from 'argon2';
import { join } from 'node:path';
import * as controlSchema from './controlSchema';
import { DowngradeError, allowDowngrade, readMeta, snapshotBeforeUpgrade, stampVersion } from './upgrade';

export type ControlDB = BetterSQLite3Database<typeof controlSchema>;
export type Role = 'admin' | 'user';
export type UserStatus = 'active' | 'disabled';

let _control: ControlDB | null = null;
let _controlSqlite: Database.Database | null = null;

export function controlDbPath(dataRoot: string): string {
  return join(dataRoot, 'control.db');
}

/** Opens (or returns) the control DB singleton, applying idempotent DDL. */
export function openControlDb(dataRoot: string): ControlDB {
  if (_control) return _control;
  const sqlite = new Database(controlDbPath(dataRoot));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  try {
    migrateControlDb(sqlite);
  } catch (err) {
    sqlite.close(); // e.g. DowngradeError — release the file before bubbling up
    throw err;
  }
  _controlSqlite = sqlite;
  _control = drizzle(sqlite, { schema: controlSchema });
  return _control;
}

export function getControlDb(): ControlDB {
  if (!_control) throw new Error('control DB not initialized — call openControlDb() first');
  return _control;
}

/** Raw connection (backups use VACUUM INTO on it). */
export function getControlSqlite(): Database.Database {
  if (!_controlSqlite) throw new Error('control DB not initialized — call openControlDb() first');
  return _controlSqlite;
}

/** Test-only: close + forget the singleton so a fresh DATA_DIR can be opened. */
export function closeControlDb(): void {
  _controlSqlite?.close();
  _controlSqlite = null;
  _control = null;
}

/**
 * Ordered control-DB migrations, tracked with PRAGMA user_version.
 * Rules: append only — never edit an entry that has shipped. Each entry runs
 * once, inside a transaction. Entry 1 is the historical baseline (idempotent
 * CREATE IF NOT EXISTS, so pre-versioning databases adopt it safely).
 */
export const CONTROL_MIGRATIONS: string[] = [
  /* 1 — baseline (v0.1 – v0.3): users, invites, audit, AI usage, API keys */
  `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_login_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      note TEXT,
      created_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      used_by INTEGER
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      user_id INTEGER,
      event TEXT NOT NULL,
      detail TEXT,
      ip TEXT
    );
    CREATE INDEX IF NOT EXISTS audit_ts_idx ON audit_log (ts);
    CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      user_id INTEGER NOT NULL,
      provider_name TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      estimated INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS ai_usage_user_ts_idx ON ai_usage (user_id, ts);
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'read',
      token_hash TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_used_at INTEGER,
      revoked_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id);
  `,
];

function migrateControlDb(sqlite: Database.Database): void {
  const current = sqlite.pragma('user_version', { simple: true }) as number;
  const target = CONTROL_MIGRATIONS.length;
  if (current > target && !allowDowngrade()) {
    throw new DowngradeError('control database', readMeta(sqlite).app_version_last ?? null);
  }
  const hasTables = !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (current < target && hasTables) {
    snapshotBeforeUpgrade(sqlite, 'control database', 'control.db', {
      fromVersion: readMeta(sqlite).app_version_last ?? 'pre-0.4',
      fromSchema: current,
    });
  }
  for (let v = current; v < target; v++) {
    sqlite.transaction(() => {
      sqlite.exec(CONTROL_MIGRATIONS[v]!);
      sqlite.pragma(`user_version = ${v + 1}`);
    })();
  }
  stampVersion(sqlite, Math.max(current, target), !hasTables);
}

/**
 * Ensures an admin account exists. Priority:
 *  1. an existing account (returns the first one)
 *  2. a legacy hash carried over by the single-user -> multi-user migration
 *  3. DREAMWARD_EMAIL / DREAMWARD_PASSWORD from env (automation)
 * Returns null when none applies — the first-run setup link creates the admin.
 */
export async function ensureAdminUser(opts: {
  email?: string;
  password?: string;
  legacy?: { email: string; passwordHash: string } | null;
}): Promise<number | null> {
  const db = getControlDb();
  const existing = db.select().from(controlSchema.controlUsers).limit(1).all();
  if (existing.length > 0) {
    return existing[0]!.id;
  }
  if (!opts.legacy && !(opts.email && opts.password)) return null;
  const email = (opts.legacy?.email ?? opts.email!).toLowerCase();
  const passwordHash = opts.legacy?.passwordHash ?? (await argon2.hash(opts.password!, { type: argon2.argon2id }));
  return createAdmin(email, passwordHash);
}

/** Inserts an admin account (first-run setup or env bootstrap). */
export function createAdmin(email: string, passwordHash: string): number {
  const row = getControlDb()
    .insert(controlSchema.controlUsers)
    .values({ email, passwordHash, role: 'admin', status: 'active' })
    .returning({ id: controlSchema.controlUsers.id })
    .get();
  console.log(`[control] created admin account ${email} (id=${row.id})`);
  return row.id;
}

/** Append-only audit trail. Never put secrets in `detail`. */
export function audit(event: string, opts: { userId?: number | null; detail?: unknown; ip?: string | null } = {}): void {
  try {
    const db = getControlDb();
    db.insert(controlSchema.auditLog)
      .values({
        event,
        userId: opts.userId ?? null,
        detail: opts.detail === undefined ? null : JSON.stringify(opts.detail),
        ip: opts.ip ?? null,
      })
      .run();
  } catch (err) {
    // Auditing must never take down a request.
    console.error('[audit] write failed:', err);
  }
}

export { controlSchema };
