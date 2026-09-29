/* ============================================================================
 * apps/api — db/migrate.ts
 * Applies generated Drizzle migrations to a per-user DB, then ensures the
 * FTS5 search index and its sync triggers exist. Idempotent: registry.ts runs
 * this on first open of each user DB per boot.
 * CLI mode migrates the control DB + every existing user DB.
 * ========================================================================= */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type Database from 'better-sqlite3';
import type { DB } from './client';
import { DowngradeError, allowDowngrade, readMeta, snapshotBeforeUpgrade, stampVersion } from './upgrade';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Locate the drizzle/ migrations folder across runtimes: tsx runs from
 * src/db/, vitest from src/__tests__/, the tsup bundle from dist/ (chunks sit
 * at the dist root), the Docker workdir is apps/api, and the desktop bundle
 * ships drizzle/ next to itself (or points MIGRATIONS_DIR at it).
 */
function migrationsFolder(): string | null {
  const candidates = [
    ...(process.env.MIGRATIONS_DIR ? [resolve(process.env.MIGRATIONS_DIR)] : []),
    resolve(process.cwd(), 'drizzle'),
    resolve(__dirname, 'drizzle'),
    resolve(__dirname, '../drizzle'),
    resolve(__dirname, '../../drizzle'),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

/** A migration bundled with this build (from drizzle/meta/_journal.json). */
export interface BundledMigration {
  tag: string;
  when: number;
}

let bundledCache: BundledMigration[] | null = null;

export function bundledMigrations(folder = migrationsFolder()): BundledMigration[] {
  if (!folder) return [];
  if (bundledCache) return bundledCache;
  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
    entries: { tag: string; when: number }[];
  };
  bundledCache = journal.entries.map((e) => ({ tag: e.tag, when: e.when }));
  return bundledCache;
}

/** Latest applied migration timestamp + count (drizzle stores the journal `when`). */
function appliedState(sqlite: Database.Database): { latest: number | null; count: number } {
  const has = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'")
    .get();
  if (!has) return { latest: null, count: 0 };
  const row = sqlite.prepare('SELECT MAX(created_at) AS latest, COUNT(*) AS count FROM __drizzle_migrations').get() as {
    latest: number | null;
    count: number;
  };
  return { latest: row.latest === null ? null : Number(row.latest), count: row.count };
}

export interface MigrateOptions {
  /** human label for logs/errors, e.g. "user 3" */
  label?: string;
  /** snapshot file name inside the pre-upgrade run folder, e.g. "user-3.db" */
  snapshotName?: string;
}

/**
 * Upgrade-safe migration of one user DB. Idempotent.
 *  1. refuses data written by a newer build (DowngradeError)
 *  2. snapshots + integrity-checks the file when migrations are pending
 *  3. applies drizzle migrations (transactional) + FTS
 *  4. stamps app_meta with this version
 */
export function migrateUserDb(db: DB, sqlite: Database.Database, opts: MigrateOptions = {}): { applied: number } {
  const folder = migrationsFolder();
  if (!folder) {
    // A user DB without migrations is unusable — fail loudly instead of
    // provisioning an empty database.
    throw new Error('[migrate] drizzle/ migrations folder not found — broken build/packaging');
  }
  const label = opts.label ?? 'user db';
  const bundled = bundledMigrations(folder);
  const bundledLatest = bundled.length ? bundled[bundled.length - 1]!.when : 0;
  const state = appliedState(sqlite);

  if (state.latest !== null && state.latest > bundledLatest && !allowDowngrade()) {
    throw new DowngradeError(label, readMeta(sqlite).app_version_last ?? null);
  }

  const pending = bundled.filter((m) => state.latest === null || m.when > state.latest);
  const existing = state.count > 0;
  if (pending.length && existing) {
    snapshotBeforeUpgrade(sqlite, label, opts.snapshotName ?? `${label.replace(/\W+/g, '-')}.db`, {
      fromVersion: readMeta(sqlite).app_version_last ?? 'pre-0.4',
      fromSchema: state.count,
      pending: pending.map((m) => m.tag),
    });
  }

  migrate(db, { migrationsFolder: folder });
  ensureFts(db);
  stampVersion(sqlite, bundled.length, !existing);
  if (pending.length && existing) console.log(`[migrate] ${label}: applied ${pending.length} migration(s)`);
  return { applied: pending.length };
}

/** FTS5 over journal entries (Drizzle does not model virtual tables). */
function ensureFts(db: DB) {
  db.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS journal_fts USING fts5(
      title, body_richtext, content='journal_entries', content_rowid='rowid'
    );
  `);
  db.run(sql`
    CREATE TRIGGER IF NOT EXISTS journal_ai AFTER INSERT ON journal_entries BEGIN
      INSERT INTO journal_fts(rowid, title, body_richtext)
      VALUES (new.rowid, new.title, new.body_richtext);
    END;
  `);
  db.run(sql`
    CREATE TRIGGER IF NOT EXISTS journal_ad AFTER DELETE ON journal_entries BEGIN
      INSERT INTO journal_fts(journal_fts, rowid, title, body_richtext)
      VALUES ('delete', old.rowid, old.title, old.body_richtext);
    END;
  `);
  db.run(sql`
    CREATE TRIGGER IF NOT EXISTS journal_au AFTER UPDATE ON journal_entries BEGIN
      INSERT INTO journal_fts(journal_fts, rowid, title, body_richtext)
      VALUES ('delete', old.rowid, old.title, old.body_richtext);
      INSERT INTO journal_fts(rowid, title, body_richtext)
      VALUES (new.rowid, new.title, new.body_richtext);
    END;
  `);

  // Global agent search index — standalone (rebuilt wholesale by searchIndex.ts;
  // triggers can't strip TipTap HTML / JSON content, and the corpus is tiny).
  db.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
      doc_type, doc_id UNINDEXED, title, body, tokenize='unicode61'
    );
  `);
}

// CLI: migrate control DB + all user DBs under ${DATA_DIR}/users/*.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.ts')) {
  (async () => {
    const { loadEnv } = await import('../env');
    const { resolveDataDir, usersRoot } = await import('../lib/paths');
    const { openControlDb } = await import('./control');
    const { createDb } = await import('./client');
    const dataRoot = resolveDataDir(loadEnv().DATA_DIR);
    openControlDb(dataRoot); // applies control DDL
    const root = usersRoot(dataRoot);
    const dirs = existsSync(root) ? readdirSync(root).filter((d) => /^\d+$/.test(d)) : [];
    for (const dir of dirs) {
      const file = join(root, dir, 'lifebook.db');
      if (!existsSync(file)) continue;
      const { db, sqlite } = createDb(file);
      migrateUserDb(db, sqlite, { label: `user ${dir}`, snapshotName: `user-${dir}.db` });
      sqlite.close();
      console.log(`[migrate] user ${dir} ok`);
    }
    console.log(`[migrate] done (control + ${dirs.length} user db(s))`);
    process.exit(0);
  })().catch((err) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  });
}
