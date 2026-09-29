/* ============================================================================
 * apps/api — db/client.ts
 * Per-user DB access via AsyncLocalStorage. Every authenticated request (and
 * every script scope) runs inside runWithDbContext(); feature code keeps
 * calling getDb()/getSqlite() exactly as before the multi-user change.
 * There is intentionally NO global fallback — code touching the DB outside a
 * context is a tenant-isolation bug and must throw.
 * ========================================================================= */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as schema from './schema';
import type { Role } from './control';

export type DB = BetterSQLite3Database<typeof schema>;

export interface DbHandle {
  db: DB;
  sqlite: Database.Database;
}

export interface DbContext extends DbHandle {
  uid: number;
  role: Role;
  /** users/<uid> directory — assets live under <userDataRoot>/assets */
  userDataRoot: string;
}

const als = new AsyncLocalStorage<DbContext>();

/** Pure factory — opens a SQLite file with our standard pragmas. */
export function createDb(file: string): DbHandle {
  const sqlite = new Database(file);
  try {
    return configureDb(sqlite);
  } catch (err) {
    sqlite.close();
    throw err;
  }
}

/** Applies our standard pragmas to an open connection and wraps it with drizzle. */
export function configureDb(sqlite: Database.Database): DbHandle {
  // Durability + concurrency-friendly settings for a single-writer app.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/** Runs fn within a user's DB context (request hook or script scope). */
export function runWithDbContext<T>(ctx: DbContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getDbContext(): DbContext {
  const ctx = als.getStore();
  if (!ctx) throw new Error('No DB context — getDb() called outside an authenticated request or script scope');
  return ctx;
}

export function getDb(): DB {
  return getDbContext().db;
}

export function getSqlite(): Database.Database {
  return getDbContext().sqlite;
}

export function getUid(): number {
  return getDbContext().uid;
}

export function getUserDataRoot(): string {
  return getDbContext().userDataRoot;
}

export { schema };
