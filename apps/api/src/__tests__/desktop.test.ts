/* ============================================================================
 * Desktop mode: one local account created automatically, the session is only
 * handed out for the per-launch DESKTOP_TOKEN, the server binds to localhost,
 * invites are capped, and the built web app is served with an SPA fallback.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'dreamward-desktop-'));
const web = join(root, 'web');
mkdirSync(join(web, 'assets'), { recursive: true });
writeFileSync(join(web, 'index.html'), '<!doctype html><title>shell</title>');
writeFileSync(join(web, 'assets', 'app.js'), 'console.log(1)');

const TOKEN = 'd'.repeat(48);
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = join(root, 'data');
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DESKTOP_MODE = 'true';
process.env.DESKTOP_TOKEN = TOKEN;
process.env.WEB_DIST_DIR = web;
delete process.env.DREAMWARD_EMAIL;
delete process.env.DREAMWARD_PASSWORD;
delete process.env.ALLOW_PRIVATE_AI_URLS;

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let env: Awaited<ReturnType<typeof buildServer>>['env'];

beforeAll(async () => {
  ({ app, env } = await buildServer());
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(root, { recursive: true, force: true });
});

const session = async (token?: string) =>
  app.inject({ method: 'POST', url: '/api/desktop/session', headers: token ? { 'x-desktop-token': token } : {} });

describe('desktop mode', () => {
  it('forces a localhost-only, single-person configuration', () => {
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.MAX_USERS).toBe(1);
    expect(env.ALLOW_PRIVATE_AI_URLS).toBe('true');
  });

  it('creates the local account up front — no setup link', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/setup/status' })).json()).toEqual({ needsSetup: false });
    expect(existsSync(join(root, 'data', 'setup-token'))).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/api/health' })).json()).toMatchObject({ ok: true, desktop: true });
  });

  it('refuses a missing or wrong token', async () => {
    expect((await session()).statusCode).toBe(401);
    expect((await session('x'.repeat(48))).statusCode).toBe(401);
    expect((await session(TOKEN.slice(1))).statusCode).toBe(401);
  });

  it('opens the local session with the launch token', async () => {
    const res = await session(TOKEN);
    expect(res.statusCode).toBe(200);
    const cookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json().user).toMatchObject({ email: 'me@desktop.local', role: 'admin' });
    // The book is provisioned and usable.
    const cats = await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie } });
    expect(cats.statusCode).toBe(200);
    expect(cats.json()).toHaveLength(12);
  });

  it('serves the web app with an SPA fallback, but keeps API 404s as JSON', async () => {
    const index = await app.inject({ method: 'GET', url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.body).toContain('<title>shell</title>');
    const asset = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(asset.body).toBe('console.log(1)');
    const deep = await app.inject({ method: 'GET', url: '/ikigai?step=2' });
    expect(deep.statusCode).toBe(200);
    expect(deep.headers['content-type']).toContain('text/html');
    const api = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: 'not_found' });
  });
});
