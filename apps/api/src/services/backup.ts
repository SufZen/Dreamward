/* ============================================================================
 * apps/api — services/backup.ts
 * In-app backups (replaces the old shell loop in docker-compose):
 *   BACKUP_DIR/snapshots/<timestamp>/
 *     manifest.json                  version, reason, per-DB integrity result
 *     control.db                     VACUUM INTO — consistent while running
 *     users/<uid>/lifebook.db        one per account
 *     users/<uid>/assets/…           hard-linked (cheap, same volume) or copied
 * Every copied database is re-opened and integrity-checked. Retention keeps
 * BACKUP_RETENTION_DAYS of snapshots but never fewer than the newest 3;
 * pre-upgrade runs are kept for 90 days / newest 5.
 * Restore is an offline operation — see scripts/admin.ts (`restore`).
 * ========================================================================= */
import Database from 'better-sqlite3';
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../env';
import { APP_VERSION } from '../version';
import { backupsRoot, dbPath, resolveDataDir, usersRoot } from '../lib/paths';
import { controlSchema, getControlDb, getControlSqlite } from '../db/control';
import { isUserUnavailable, openUserDb } from '../db/registry';
import { integrityCheck } from '../db/upgrade';

export type BackupReason = 'scheduled' | 'manual' | 'pre-update' | 'cli';

export interface BackupEntryResult {
  name: string; // "control" | "user 3"
  ok: boolean;
  bytes: number;
  assets?: number;
  error?: string;
}

export interface BackupResult {
  id: string;
  path: string;
  version: string;
  reason: BackupReason;
  createdAt: number;
  durationMs: number;
  ok: boolean;
  entries: BackupEntryResult[];
}

const KEEP_MIN_SNAPSHOTS = 3;
const PRE_UPGRADE_KEEP_DAYS = 90;
const PRE_UPGRADE_KEEP_MIN = 5;
const DAY = 86_400_000;

export const snapshotsDir = () => join(backupsRoot(), 'snapshots');
const statusFile = () => join(backupsRoot(), 'last-backup.json');

function vacuumInto(sqlite: Database.Database, dest: string): void {
  sqlite.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
}

function verify(file: string): string {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return integrityCheck(db);
  } finally {
    db.close();
  }
}

/**
 * Mirrors a directory tree cheaply:
 *   1. hard-link the live file (same volume as the data), else
 *   2. hard-link the identical file from the previous snapshot (incremental
 *      across volumes — assets are write-once), else
 *   3. copy.
 */
function linkTree(src: string, dest: string, prev: string | null): number {
  if (!existsSync(src)) return 0;
  mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    const before = prev ? join(prev, entry.name) : null;
    if (entry.isDirectory()) {
      count += linkTree(from, to, before);
    } else if (entry.isFile()) {
      try {
        linkSync(from, to);
      } catch {
        try {
          if (!before || !existsSync(before) || statSync(before).size !== statSync(from).size) throw new Error('changed');
          linkSync(before, to);
        } catch {
          copyFileSync(from, to);
        }
      }
      count++;
    }
  }
  return count;
}

/** The newest existing snapshot folder (for incremental asset links). */
function previousSnapshot(): string | null {
  if (!existsSync(snapshotsDir())) return null;
  const dirs = readdirSync(snapshotsDir()).sort().reverse();
  return dirs[0] ? join(snapshotsDir(), dirs[0]) : null;
}

let running: Promise<BackupResult> | null = null;

/** Takes a full backup. Concurrent calls share the in-flight run. */
export function runBackup(reason: BackupReason = 'manual'): Promise<BackupResult> {
  if (!running) {
    running = Promise.resolve()
      .then(() => doBackup(reason))
      .finally(() => {
        running = null;
      });
  }
  return running;
}

function doBackup(reason: BackupReason): BackupResult {
  const started = Date.now();
  const id = new Date(started).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const prev = previousSnapshot();
  const dir = join(snapshotsDir(), id);
  mkdirSync(join(dir, 'users'), { recursive: true });
  const entries: BackupEntryResult[] = [];
  const dataRoot = resolveDataDir(loadEnv().DATA_DIR);

  // control plane
  try {
    const dest = join(dir, 'control.db');
    vacuumInto(getControlSqlite(), dest);
    const check = verify(dest);
    entries.push({ name: 'control', ok: check === 'ok', bytes: statSync(dest).size, error: check === 'ok' ? undefined : check });
  } catch (err) {
    entries.push({ name: 'control', ok: false, bytes: 0, error: err instanceof Error ? err.message : String(err) });
  }

  // every account
  const users = getControlDb().select({ id: controlSchema.controlUsers.id }).from(controlSchema.controlUsers).all();
  for (const { id: uid } of users) {
    const name = `user ${uid}`;
    const userDir = join(dir, 'users', String(uid));
    mkdirSync(userDir, { recursive: true });
    const dest = join(userDir, 'lifebook.db');
    try {
      const liveRoot = join(usersRoot(dataRoot), String(uid));
      if (isUserUnavailable(uid)) {
        // can't open it through the app — keep a raw byte copy for forensics
        copyFileSync(dbPath(liveRoot), dest);
        entries.push({ name, ok: false, bytes: statSync(dest).size, error: 'account unavailable — raw copy only' });
        continue;
      }
      vacuumInto(openUserDb(uid).sqlite, dest);
      const assets = linkTree(join(liveRoot, 'assets'), join(userDir, 'assets'), prev ? join(prev, 'users', String(uid), 'assets') : null);
      const check = verify(dest);
      entries.push({ name, ok: check === 'ok', bytes: statSync(dest).size, assets, error: check === 'ok' ? undefined : check });
    } catch (err) {
      entries.push({ name, ok: false, bytes: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const result: BackupResult = {
    id,
    path: dir,
    version: APP_VERSION,
    reason,
    createdAt: started,
    durationMs: Date.now() - started,
    ok: entries.every((e) => e.ok),
    entries,
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(result, null, 2));
  writeFileSync(statusFile(), JSON.stringify(result, null, 2));
  applyRetention();
  console.log(`[backup] ${result.ok ? 'ok' : 'COMPLETED WITH ERRORS'} → ${dir} (${result.durationMs} ms, ${entries.length} db)`);
  return result;
}

/** Deletes expired snapshots and pre-upgrade runs (never below the minimum counts). */
export function applyRetention(now = Date.now()): { removed: string[] } {
  const removed: string[] = [];
  const prune = (base: string, keepDays: number, keepMin: number) => {
    if (!existsSync(base)) return;
    const dirs = readdirSync(base)
      .filter((d) => statSync(join(base, d)).isDirectory())
      .sort()
      .reverse(); // newest first (ISO-ish names sort chronologically)
    dirs.forEach((d, i) => {
      if (i < keepMin) return;
      const age = now - statSync(join(base, d)).mtimeMs;
      if (age > keepDays * DAY) {
        rmSync(join(base, d), { recursive: true, force: true });
        removed.push(join(base, d));
      }
    });
  };
  prune(snapshotsDir(), loadEnv().BACKUP_RETENTION_DAYS, KEEP_MIN_SNAPSHOTS);
  prune(join(backupsRoot(), 'pre-upgrade'), PRE_UPGRADE_KEEP_DAYS, PRE_UPGRADE_KEEP_MIN);
  return { removed };
}

export function lastBackup(): BackupResult | null {
  try {
    return JSON.parse(readFileSync(statusFile(), 'utf8')) as BackupResult;
  } catch {
    return null;
  }
}

export interface BackupListItem {
  id: string;
  kind: 'snapshot' | 'pre-upgrade';
  path: string;
  createdAt: number;
  ok: boolean | null;
  version: string | null;
}

export function listBackups(): BackupListItem[] {
  const out: BackupListItem[] = [];
  const read = (base: string, kind: BackupListItem['kind']) => {
    if (!existsSync(base)) return;
    for (const d of readdirSync(base)) {
      const path = join(base, d);
      if (!statSync(path).isDirectory()) continue;
      let ok: boolean | null = null;
      let version: string | null = null;
      try {
        const m = JSON.parse(readFileSync(join(path, 'manifest.json'), 'utf8')) as BackupResult | { toVersion: string }[];
        if (Array.isArray(m)) version = m[0]?.toVersion ?? null;
        else {
          ok = m.ok;
          version = m.version;
        }
      } catch {
        /* manifest missing */
      }
      out.push({ id: d, kind, path, createdAt: Math.round(statSync(path).mtimeMs), ok, version });
    }
  };
  read(snapshotsDir(), 'snapshot');
  read(join(backupsRoot(), 'pre-upgrade'), 'pre-upgrade');
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Scheduler hook: one backup per day after BACKUP_HOUR. */
export function isBackupDue(now = new Date()): boolean {
  const env = loadEnv();
  if (!env.BACKUP_ENABLED) return false;
  if (now.getHours() < env.BACKUP_HOUR) return false;
  const scheduledToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), env.BACKUP_HOUR).getTime();
  const last = lastBackup();
  return !last || last.createdAt < scheduledToday;
}
