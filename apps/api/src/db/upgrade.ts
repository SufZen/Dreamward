/* ============================================================================
 * apps/api — db/upgrade.ts
 * Upgrade safety for every SQLite database the app owns:
 *   • version stamps  — an `app_meta` table records which app version last
 *     wrote the file, which version created it, and its schema level;
 *   • downgrade guard — refuse to open data written by a NEWER binary
 *     (it may contain schema this build doesn't understand);
 *   • pre-upgrade snapshot — before any pending migration runs, the file is
 *     integrity-checked and copied (VACUUM INTO: consistent, compact, works
 *     while other connections are open) under BACKUP_DIR/pre-upgrade/.
 * Migrations themselves stay transactional (drizzle wraps them in BEGIN/COMMIT).
 * ========================================================================= */
import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../env';
import { APP_VERSION } from '../version';
import { backupsRoot } from '../lib/paths';

/** Thrown when a database was written by a newer app version than this one. */
export class DowngradeError extends Error {
  constructor(
    public readonly label: string,
    public readonly writtenBy: string | null,
  ) {
    super(
      `[upgrade] ${label} was written by a newer version${writtenBy ? ` (v${writtenBy})` : ''} ` +
        `than this one (v${APP_VERSION}). Refusing to start so no data is lost.\n` +
        `  → Install v${writtenBy ?? '<newer>'} or later again, or restore the matching pre-upgrade backup from BACKUP_DIR/pre-upgrade/.\n` +
        `  → To override (not recommended), set ALLOW_DOWNGRADE=true.`,
    );
    this.name = 'DowngradeError';
  }
}

/** Thrown when a database fails SQLite's integrity check before migration. */
export class CorruptDatabaseError extends Error {
  constructor(label: string, detail: string) {
    super(`[upgrade] ${label} failed the integrity check (${detail}). Not migrating — restore it from a backup.`);
    this.name = 'CorruptDatabaseError';
  }
}

/* ── app_meta ────────────────────────────────────────────────────────────── */

export interface AppMeta {
  app_version_last?: string;
  created_version?: string;
  schema_version?: string;
  updated_at?: string;
}

export function ensureMetaTable(sqlite: Database.Database): void {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
}

export function readMeta(sqlite: Database.Database): AppMeta {
  ensureMetaTable(sqlite);
  const rows = sqlite.prepare('SELECT key, value FROM app_meta').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as AppMeta;
}

export function writeMeta(sqlite: Database.Database, patch: AppMeta): void {
  ensureMetaTable(sqlite);
  const stmt = sqlite.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  sqlite.transaction(() => {
    for (const [k, v] of Object.entries({ ...patch, updated_at: String(Date.now()) })) if (v !== undefined) stmt.run(k, v);
  })();
}

/** Stamps the file as written by this build (+ created_version on first stamp). */
export function stampVersion(sqlite: Database.Database, schemaVersion: number, freshlyCreated: boolean): void {
  const meta = readMeta(sqlite);
  writeMeta(sqlite, {
    app_version_last: newerOf(meta.app_version_last, APP_VERSION),
    created_version: meta.created_version ?? (freshlyCreated ? APP_VERSION : 'pre-0.4'),
    schema_version: String(schemaVersion),
  });
}

/* ── semver helpers (x.y.z[-pre]) ────────────────────────────────────────── */

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre] = v.replace(/^v/, '').split('-', 2);
    const nums = (core ?? '0').split('.').map((n) => Number(n) || 0);
    return { nums: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0], pre: pre ?? null };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) if (pa.nums[i] !== pb.nums[i]) return pa.nums[i]! - pb.nums[i]!;
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1; // release > prerelease
  if (pb.pre === null) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}

const newerOf = (a: string | undefined, b: string) => (a && compareVersions(a, b) > 0 ? a : b);

/* ── integrity + snapshots ───────────────────────────────────────────────── */

export function integrityCheck(sqlite: Database.Database): string {
  const rows = sqlite.pragma('quick_check') as { quick_check: string }[];
  return rows.map((r) => r.quick_check).join('; ');
}

let runDir: string | null = null;

/** One folder per boot/upgrade run: pre-upgrade/<timestamp>-to-v<version>/ */
function preUpgradeDir(): string {
  if (!runDir) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    runDir = join(backupsRoot(), 'pre-upgrade', `${ts}-to-v${APP_VERSION}`);
    mkdirSync(runDir, { recursive: true });
  }
  return runDir;
}

/** Test-only: start a fresh snapshot folder. */
export function resetUpgradeRun(): void {
  runDir = null;
}

/**
 * Integrity-checks and snapshots a database before it is migrated.
 * `name` is a relative file name inside the run folder (e.g. "user-3.db").
 */
export function snapshotBeforeUpgrade(sqlite: Database.Database, label: string, name: string, info: Record<string, unknown>): string {
  const check = integrityCheck(sqlite);
  if (check !== 'ok') throw new CorruptDatabaseError(label, check);
  const dir = preUpgradeDir();
  const dest = join(dir, name);
  if (existsSync(dest)) return dest; // already snapshotted in this run
  sqlite.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  const manifestPath = join(dir, 'manifest.json');
  const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown[]) : [];
  manifest.push({ file: name, label, toVersion: APP_VERSION, at: new Date().toISOString(), ...info });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[upgrade] snapshot ${label} → ${dest}`);
  return dest;
}

export function allowDowngrade(): boolean {
  return loadEnv().ALLOW_DOWNGRADE;
}
