/* ============================================================================
 * Backups (scheduled/manual snapshots, integrity, retention) and data
 * portability (export → import round trip, secret stripping, safety copy,
 * version + zip-slip refusal).
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const root = mkdtempSync(join(tmpdir(), 'dreamward-backup-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = join(root, 'data');
process.env.BACKUP_DIR = join(root, 'backups');
process.env.BACKUP_HOUR = '0';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.KEY_ENCRYPTION_SECRET = 'test-key-encryption-secret-123456';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');
const { applyRetention, isBackupDue, snapshotsDir } = await import('../services/backup');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let cookie: string;

function multipart(buffer: Buffer | Uint8Array, filename: string, mime: string) {
  const boundary = '----lbtest' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, Buffer.from(buffer), tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, cookie },
  };
}

const api = (method: 'GET' | 'POST' | 'DELETE' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api${url}`, headers: { cookie }, payload: payload as object | undefined });

beforeAll(async () => {
  ({ app } = await buildServer());
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.local', password: 'admin-pass-123' },
  });
  cookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;

  await api('POST', '/goals', { title: 'Original goal' });
  await api('POST', '/llm/providers', {
    name: 'My OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'some/model',
    apiKey: 'sk-super-secret-value',
  });
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .png()
    .toBuffer();
  const up = multipart(png, 'pic.png', 'image/png');
  const asset = await app.inject({ method: 'POST', url: '/api/assets', payload: up.payload, headers: up.headers });
  expect(asset.statusCode).toBe(200);
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(root, { recursive: true, force: true });
});

describe('backups', () => {
  it('is due when nothing has been backed up yet', () => {
    expect(isBackupDue(new Date())).toBe(true);
  });

  it('takes a verified snapshot of the control DB, every account and its assets', async () => {
    const res = await api('POST', '/admin/backups');
    expect(res.statusCode).toBe(200);
    const result = res.json() as { ok: boolean; path: string; entries: { name: string; ok: boolean; assets?: number }[] };
    expect(result.ok).toBe(true);
    expect(result.entries.map((e) => e.name)).toEqual(['control', 'user 1']);
    expect(result.entries[1]!.assets).toBeGreaterThan(0);
    expect(existsSync(join(result.path, 'control.db'))).toBe(true);
    expect(existsSync(join(result.path, 'manifest.json'))).toBe(true);

    const snap = new Database(join(result.path, 'users', '1', 'lifebook.db'), { readonly: true });
    expect(snap.prepare("SELECT title FROM goals WHERE title = 'Original goal'").get()).toBeTruthy();
    snap.close();

    expect(isBackupDue(new Date())).toBe(false); // today's backup exists
    const list = (await api('GET', '/admin/backups')).json() as { last: { ok: boolean }; items: { kind: string }[] };
    expect(list.last.ok).toBe(true);
    expect(list.items.some((i) => i.kind === 'snapshot')).toBe(true);

    const system = (await api('GET', '/admin/system')).json() as { lastBackupAt: number; lastBackupOk: boolean };
    expect(system.lastBackupOk).toBe(true);
    expect(system.lastBackupAt).toBeGreaterThan(0);
  });

  it('retention removes expired snapshots but always keeps the newest three', () => {
    const base = snapshotsDir();
    const old = Date.now() / 1000 - 400 * 86400;
    for (const name of ['2020-01-01T00-00-00', '2020-01-02T00-00-00', '2020-01-03T00-00-00', '2020-01-04T00-00-00']) {
      mkdirSync(join(base, name), { recursive: true });
      writeFileSync(join(base, name, 'manifest.json'), '{}');
      utimesSync(join(base, name), old, old);
    }
    const before = readdirSync(base).length; // 1 real + 4 old
    const { removed } = applyRetention();
    const after = readdirSync(base);
    expect(before).toBe(5);
    expect(after).toHaveLength(3); // newest three survive regardless of age
    expect(removed).toHaveLength(2);
    expect(after).toContain('2020-01-04T00-00-00');
  });
});

describe('export / import', () => {
  let archive: Uint8Array;

  it('exports the whole book without provider secrets', async () => {
    const res = await api('GET', '/me/export');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    archive = new Uint8Array(res.rawPayload);
    const files = unzipSync(archive);
    const manifest = JSON.parse(strFromU8(files['manifest.json']!));
    expect(manifest).toMatchObject({ format: 'lifebook-export', formatVersion: 1, account: { email: 'admin@test.local' } });

    const data = JSON.parse(strFromU8(files['data.json']!)) as Record<string, { title?: string; api_key?: string | null }[]>;
    expect(data.goals!.map((g) => g.title)).toContain('Original goal');
    expect(data.llm_providers![0]!.api_key).toBeNull();
    expect(strFromU8(files['data.json']!)).not.toContain('sk-super-secret');
    expect(Object.keys(files).some((f) => f.startsWith('assets/originals/'))).toBe(true);

    const tmp = join(root, 'exported.db');
    writeFileSync(tmp, files['lifebook.db']!);
    const db = new Database(tmp, { readonly: true });
    expect(db.prepare('SELECT api_key FROM llm_providers').get()).toEqual({ api_key: null });
    db.close();
  });

  it('requires explicit confirmation to replace the book', async () => {
    const { payload, headers } = multipart(archive, 'export.zip', 'application/zip');
    const res = await app.inject({ method: 'POST', url: '/api/me/import', payload, headers });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'confirmation_required' });
  });

  it('restores the exported book and keeps the replaced one aside', async () => {
    // change the book after exporting
    const goals = (await api('GET', '/goals')).json() as { id: string }[];
    await api('DELETE', `/goals/${goals[0]!.id}`);
    await api('POST', '/goals', { title: 'Goal created after export' });

    const { payload, headers } = multipart(archive, 'export.zip', 'application/zip');
    const res = await app.inject({ method: 'POST', url: '/api/me/import?confirm=replace', payload, headers });
    expect(res.statusCode).toBe(200);

    const titles = ((await api('GET', '/goals')).json() as { title: string }[]).map((g) => g.title);
    expect(titles).toEqual(['Original goal']);
    const assets = (await api('GET', '/assets')).json() as unknown[];
    expect(assets.length).toBe(1);

    const preImport = join(process.env.BACKUP_DIR!, 'pre-import');
    const [run] = readdirSync(preImport);
    const prev = new Database(join(preImport, run!, 'lifebook.db'), { readonly: true });
    expect(prev.prepare("SELECT title FROM goals WHERE title = 'Goal created after export'").get()).toBeTruthy();
    prev.close();
  });

  it('refuses exports from a newer schema and unsafe archive paths', async () => {
    const files = unzipSync(archive);
    const manifest = JSON.parse(strFromU8(files['manifest.json']!));

    const newer = zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify({ ...manifest, schemaVersion: 999, appVersion: '9.0.0' })) });
    let mp = multipart(newer, 'newer.zip', 'application/zip');
    let res = await app.inject({ method: 'POST', url: '/api/me/import?confirm=replace', payload: mp.payload, headers: mp.headers });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'export_from_newer_version' });

    const evil = zipSync({ ...files, 'assets/../../escape.txt': strToU8('pwned') });
    mp = multipart(evil, 'evil.zip', 'application/zip');
    res = await app.inject({ method: 'POST', url: '/api/me/import?confirm=replace', payload: mp.payload, headers: mp.headers });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'unsafe_path' });

    const evilWin = zipSync({ ...files, 'assets/..\\..\\escape.txt': strToU8('pwned') });
    mp = multipart(evilWin, 'evil-win.zip', 'application/zip');
    res = await app.inject({ method: 'POST', url: '/api/me/import?confirm=replace', payload: mp.payload, headers: mp.headers });
    expect(res.json()).toMatchObject({ error: 'unsafe_path' });
    // the refused imports never touched the live book
    expect(((await api('GET', '/goals')).json() as { title: string }[]).map((g) => g.title)).toEqual(['Original goal']);

    mp = multipart(Buffer.from('not a zip at all'), 'x.zip', 'application/zip');
    res = await app.inject({ method: 'POST', url: '/api/me/import?confirm=replace', payload: mp.payload, headers: mp.headers });
    expect(res.statusCode).toBe(400);
  });
});
