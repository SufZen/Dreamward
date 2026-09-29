/* ============================================================================
 * apps/api — db/registry.ts
 * Registry of open per-user DB handles. Handles are opened lazily on first
 * request, migrated once per boot, and kept open for the process lifetime
 * (better-sqlite3 connections cost a few MB each; MAX_USERS is small).
 * ========================================================================= */
import { rmSync } from 'node:fs';
import { loadEnv } from '../env';
import { resolveDataDir, userDataRoot, dbPath } from '../lib/paths';
import Database from 'better-sqlite3';
import { configureDb, runWithDbContext, type DbHandle } from './client';
import { migrateUserDb } from './migrate';
import { seedStructure } from './seed';
import { getControlDb, controlSchema, type Role } from './control';
import { DowngradeError, CorruptDatabaseError } from './upgrade';

export interface UserHandle extends DbHandle {
  userDataRoot: string;
}

const handles = new Map<number, UserHandle>();

/** Opens (or returns) a user's DB; migrates, ensures FTS and re-seeds structure on first open per boot. */
export function openUserDb(uid: number): UserHandle {
  const cached = handles.get(uid);
  if (cached) return cached;
  const dataRoot = resolveDataDir(loadEnv().DATA_DIR);
  const root = userDataRoot(dataRoot, uid); // ensures dir layout
  const file = dbPath(root);
  const sqlite = new Database(file);
  try {
    const { db } = configureDb(sqlite);
    migrateUserDb(db, sqlite, { label: `user ${uid}`, snapshotName: `user-${uid}.db` });
    const handle: UserHandle = { db, sqlite, userDataRoot: root };
    // Idempotent structural seed — backfills section types added in later
    // releases (e.g. identity) into books provisioned before them.
    runWithDbContext({ uid, role: 'user', ...handle }, () => seedStructure());
    handles.set(uid, handle);
    return handle;
  } catch (err) {
    sqlite.close(); // never leak a half-opened handle (corrupt file, downgrade…)
    throw err;
  }
}

/** Runs fn inside a user's DB context — for scripts and provisioning. */
export function runAsUser<T>(uid: number, role: Role, fn: () => T): T {
  const handle = openUserDb(uid);
  return runWithDbContext({ uid, role, ...handle }, fn);
}

/**
 * Creates a brand-new user workspace: directory layout, migrated DB and the
 * structural seed (categories, sections, content blocks, life-vision prompts)
 * so a fresh account opens onto a complete empty Dreamward.
 */
export function provisionUser(uid: number, role: Role = 'user'): UserHandle {
  const handle = openUserDb(uid); // first open seeds the structure
  runWithDbContext({ uid, role, ...handle }, () => seedStructure()); // cached handle → seed explicitly
  return handle;
}

/** Closes one account's handle (next access re-opens + re-migrates it). */
export function closeUserDb(uid: number): void {
  const handle = handles.get(uid);
  if (handle) {
    handle.sqlite.close();
    handles.delete(uid);
  }
}

/** Closes the handle and irreversibly deletes the user's data directory. */
export function deleteUserData(uid: number): void {
  const handle = handles.get(uid);
  if (handle) {
    handle.sqlite.close();
    handles.delete(uid);
  }
  const dataRoot = resolveDataDir(loadEnv().DATA_DIR);
  const root = userDataRoot(dataRoot, uid);
  rmSync(root, { recursive: true, force: true });
}

/** Test-only: close every handle so a fresh DATA_DIR can be used. */
export function closeAllUserDbs(): void {
  for (const h of handles.values()) h.sqlite.close();
  handles.clear();
}

/* ── Boot-time upgrade of every workspace ─────────────────────────────────── */

export interface UserUpgradeFailure {
  uid: number;
  error: string;
}

/** Accounts whose DB could not be opened/migrated this boot (they get 503s). */
const unavailable = new Map<number, string>();

export function unavailableUsers(): UserUpgradeFailure[] {
  return [...unavailable.entries()].map(([uid, error]) => ({ uid, error }));
}

export function isUserUnavailable(uid: number): string | null {
  return unavailable.get(uid) ?? null;
}

/**
 * Opens (and therefore migrates, snapshots and stamps) every account's DB at
 * boot, so an upgrade happens once, up front, with a backup — not lazily on
 * whichever request comes first. A downgrade anywhere is fatal (rethrown);
 * any other per-user failure is isolated: that account is marked unavailable
 * (its data untouched — migrations are transactional) and the rest boot.
 */
export function migrateAllUsers(): { migrated: number; failed: UserUpgradeFailure[] } {
  const ids = getControlDb().select({ id: controlSchema.controlUsers.id }).from(controlSchema.controlUsers).all();
  let migrated = 0;
  for (const { id } of ids) {
    try {
      openUserDb(id);
      unavailable.delete(id);
      migrated++;
    } catch (err) {
      if (err instanceof DowngradeError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      unavailable.set(id, msg);
      console.error(`[upgrade] user ${id} could not be opened${err instanceof CorruptDatabaseError ? ' (corrupt)' : ''}: ${msg}`);
    }
  }
  return { migrated, failed: unavailableUsers() };
}
