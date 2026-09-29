/* ============================================================================
 * Upgrade safety: boot the current server on a data directory that looks
 * exactly like a v0.3.1 install (control DB without version tracking, a user
 * DB migrated only up to 0005, real rows) and assert that
 *   • a pre-upgrade snapshot of every DB is written BEFORE migrating,
 *   • all existing rows survive and new structure is backfilled,
 *   • version stamps are written,
 *   • a broken account is isolated (503) while the others boot,
 *   • data written by a newer version is refused (downgrade guard).
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import argon2 from 'argon2';

const root = mkdtempSync(join(tmpdir(), 'dreamward-upgrade-'));
const DATA = join(root, 'data');
const BACKUPS = join(root, 'backups-volume');
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = DATA;
process.env.BACKUP_DIR = BACKUPS;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'unused@test.local';
process.env.DREAMWARD_PASSWORD = 'unused-pass-123';

const V031_MIGRATIONS = 6; // 0000 … 0005 shipped up to v0.3.1

/** Builds a v0.3.1-shaped data dir: control.db (unversioned) + users/1 + a corrupt users/2. */
async function buildLegacyInstall() {
  mkdirSync(join(DATA, 'users', '1', 'assets', 'originals'), { recursive: true });
  mkdirSync(join(DATA, 'users', '2'), { recursive: true });

  // control DB exactly as v0.3.1 created it: baseline DDL, user_version 0.
  const { CONTROL_MIGRATIONS } = await import('../db/control');
  const control = new Database(join(DATA, 'control.db'));
  control.exec(CONTROL_MIGRATIONS[0]!);
  const hash = await argon2.hash('legacy-pass-123', { type: argon2.argon2id });
  control.prepare("INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'admin', 'active')").run('old@test.local', hash);
  control.prepare("INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'user', 'active')").run('broken@test.local', hash);
  control.close();

  // user 1: only migrations 0000-0005 (a copy of drizzle/ with a truncated journal).
  const legacyDrizzle = join(root, 'drizzle-v031');
  cpSync(resolve(process.cwd(), 'drizzle'), legacyDrizzle, { recursive: true });
  const journalPath = join(legacyDrizzle, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  journal.entries = journal.entries.slice(0, V031_MIGRATIONS);
  writeFileSync(journalPath, JSON.stringify(journal));
  const userDb = new Database(join(DATA, 'users', '1', 'lifebook.db'));
  migrate(drizzle(userDb), { migrationsFolder: legacyDrizzle });

  // v0.3.1 data: the 4-section structure (no identity), a goal, a journal entry, an action.
  userDb.exec(`
    INSERT INTO section_types (id, label_en, label_he, shape, default_sort) VALUES
      ('premises','Premises','הנחות','list',1), ('vision','Vision','חזון','statement',2),
      ('purpose','Purpose','מטרה','rich',3), ('strategy','Strategy','אסטרטגיה','composite',4);
    INSERT INTO categories (id, label_en, label_he, icon, sort_order) VALUES ('career','Career','קריירה','Briefcase',10);
    INSERT INTO category_sections (id, category_id, section_type, sort_order, content, body_richtext) VALUES
      ('career:premises','career','premises',1,'{"items":[{"id":"p1","text":"Work is craft","order":0}]}',NULL),
      ('career:vision','career','vision',2,'{}','<p>Build things that matter</p>'),
      ('career:purpose','career','purpose',3,'{}',NULL),
      ('career:strategy','career','strategy',4,'{"habits":[],"leverages":[]}',NULL);
    INSERT INTO goals (id, category_id, title, status) VALUES ('g-legacy','career','Ship my own product','partial');
    INSERT INTO journal_entries (id, title, body_richtext) VALUES ('j-legacy','Old entry','<p>written in v0.3</p>');
    INSERT INTO actions (id, goal_id, title, linked_type, linked_id) VALUES ('a-legacy','g-legacy','Write the plan','goal','g-legacy');
  `);
  userDb.close();
  writeFileSync(join(DATA, 'users', '1', 'assets', 'originals', 'photo.jpg'), 'fake-image-bytes');

  // user 2: a corrupt database file — must be isolated, not crash the boot.
  writeFileSync(join(DATA, 'users', '2', 'lifebook.db'), 'this is not a sqlite database'.repeat(200));
}

await buildLegacyInstall();
const { buildServer } = await import('../server');
const { closeControlDb, openControlDb } = await import('../db/control');
const { closeAllUserDbs, openUserDb } = await import('../db/registry');
const { DowngradeError, resetUpgradeRun } = await import('../db/upgrade');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let cookie: string;

beforeAll(async () => {
  ({ app } = await buildServer());
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'old@test.local', password: 'legacy-pass-123' },
  });
  expect(res.statusCode).toBe(200);
  cookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(root, { recursive: true, force: true });
});

const preUpgradeRuns = () => {
  const dir = join(BACKUPS, 'pre-upgrade');
  return existsSync(dir) ? readdirSync(dir) : [];
};

describe('upgrade from v0.3.1', () => {
  it('writes a pre-upgrade snapshot of every migrated database into BACKUP_DIR', () => {
    const runs = preUpgradeRuns();
    expect(runs).toHaveLength(1);
    const run = join(BACKUPS, 'pre-upgrade', runs[0]!);
    expect(runs[0]).toMatch(/-to-v\d+\.\d+\.\d+/);
    expect(existsSync(join(run, 'control.db'))).toBe(true);
    expect(existsSync(join(run, 'user-1.db'))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(run, 'manifest.json'), 'utf8')) as { file: string; fromVersion: string }[];
    expect(manifest.map((m) => m.file).sort()).toEqual(['control.db', 'user-1.db']);
    expect(manifest.every((m) => m.fromVersion === 'pre-0.4')).toBe(true);

    // the snapshot is the OLD schema: 6 migrations, no identity section
    const snap = new Database(join(run, 'user-1.db'), { readonly: true });
    expect((snap.prepare('SELECT COUNT(*) AS n FROM __drizzle_migrations').get() as { n: number }).n).toBe(V031_MIGRATIONS);
    expect(snap.prepare("SELECT title FROM goals WHERE id='g-legacy'").get()).toEqual({ title: 'Ship my own product' });
    snap.close();
  });

  it('keeps every existing row and backfills the new structure', async () => {
    const goals = (await app.inject({ method: 'GET', url: '/api/goals', headers: { cookie } })).json() as { id: string; title: string }[];
    expect(goals.map((g) => g.title)).toContain('Ship my own product');
    const actions = (await app.inject({ method: 'GET', url: '/api/actions', headers: { cookie } })).json() as { id: string }[];
    expect(actions.map((a) => a.id)).toContain('a-legacy');
    const journal = (await app.inject({ method: 'GET', url: '/api/journal', headers: { cookie } })).json() as { id: string }[];
    expect(journal.map((j) => j.id)).toContain('j-legacy');

    const career = (await app.inject({ method: 'GET', url: '/api/categories/career', headers: { cookie } })).json() as {
      sections: { sectionType: string; sortOrder: number; content: unknown; bodyRichtext: string | null }[];
    };
    expect(career.sections.map((s) => s.sectionType)).toEqual(['premises', 'vision', 'identity', 'purpose', 'strategy']);
    expect(career.sections.find((s) => s.sectionType === 'vision')!.bodyRichtext).toBe('<p>Build things that matter</p>');
    expect(career.sections.find((s) => s.sectionType === 'premises')!.content).toMatchObject({ items: [{ text: 'Work is craft' }] });
    expect(existsSync(join(DATA, 'users', '1', 'assets', 'originals', 'photo.jpg'))).toBe(true);
  });

  it('stamps version metadata on every database', () => {
    const control = new Database(join(DATA, 'control.db'), { readonly: true });
    expect(control.pragma('user_version', { simple: true })).toBe(1);
    const cmeta = Object.fromEntries((control.prepare('SELECT key, value FROM app_meta').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    expect(cmeta.created_version).toBe('pre-0.4');
    expect(cmeta.app_version_last).toMatch(/^\d+\.\d+\.\d+/);
    control.close();

    const user = new Database(join(DATA, 'users', '1', 'lifebook.db'), { readonly: true });
    const umeta = Object.fromEntries((user.prepare('SELECT key, value FROM app_meta').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    expect(Number(umeta.schema_version)).toBeGreaterThan(V031_MIGRATIONS);
    user.close();
  });

  it('isolates a broken account instead of failing the whole boot', async () => {
    const health = (await app.inject({ method: 'GET', url: '/api/health' })).json() as {
      ok: boolean;
      version: string;
      unavailableAccounts: number;
    };
    expect(health.ok).toBe(true);
    expect(health.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(health.unavailableAccounts).toBe(1);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'broken@test.local', password: 'legacy-pass-123' },
    });
    const brokenCookie = `lb_session=${login.cookies.find((c) => c.name === 'lb_session')!.value}`;
    const res = await app.inject({ method: 'GET', url: '/api/goals', headers: { cookie: brokenCookie } });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: 'account_unavailable' });
  });

  it('a second boot on already-upgraded data takes no new snapshot', async () => {
    const before = preUpgradeRuns().length;
    closeAllUserDbs();
    resetUpgradeRun();
    openUserDb(1); // up to date → no pending migrations → no snapshot
    expect(preUpgradeRuns().length).toBe(before);
  });
});

describe('downgrade guard', () => {
  it('refuses a user DB that contains migrations newer than this build', () => {
    closeAllUserDbs();
    const db = new Database(join(DATA, 'users', '1', 'lifebook.db'));
    db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run('from-the-future', 9_999_999_999_999);
    db.prepare("UPDATE app_meta SET value = '9.9.9' WHERE key = 'app_version_last'").run();
    db.close();
    expect(() => openUserDb(1)).toThrow(DowngradeError);
    expect(() => openUserDb(1)).toThrow(/v9\.9\.9/);
  });

  it('refuses a control DB from a newer version', () => {
    closeControlDb();
    const c = new Database(join(DATA, 'control.db'));
    c.pragma('user_version = 99');
    c.close();
    expect(() => openControlDb(DATA)).toThrow(DowngradeError);
  });
});
