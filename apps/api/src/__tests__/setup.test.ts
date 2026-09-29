/* ============================================================================
 * First-run setup: no env credentials → one-time token → admin created in the
 * browser, signed in, token destroyed, setup closed for good.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'dreamward-setup-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = root;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
delete process.env.DREAMWARD_EMAIL;
delete process.env.DREAMWARD_PASSWORD;

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
const tokenPath = join(root, 'setup-token');

beforeAll(async () => {
  ({ app } = await buildServer());
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(root, { recursive: true, force: true });
});

describe('first-run setup', () => {
  it('reports that setup is needed and stores a one-time token', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/setup/status' })).json()).toEqual({ needsSetup: true });
    expect(existsSync(tokenPath)).toBe(true);
    expect(readFileSync(tokenPath, 'utf8').trim()).toMatch(/^[a-f0-9]{48}$/);
  });

  it('rejects a wrong token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { token: 'f'.repeat(48), email: 'owner@example.com', password: 'long-enough-1' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('creates the admin with the right token and signs in', async () => {
    const token = readFileSync(tokenPath, 'utf8').trim();
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { token, email: 'Owner@Example.com', password: 'long-enough-1' },
    });
    expect(res.statusCode).toBe(200);
    const cookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
    const me = (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).json();
    expect(me).toMatchObject({ user: { email: 'owner@example.com', role: 'admin' } });
    // the new admin's book is provisioned
    const cats = (await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie } })).json() as unknown[];
    expect(cats.length).toBe(12);
    expect(existsSync(tokenPath)).toBe(false);
  });

  it('is closed for good once an account exists', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/setup/status' })).json()).toEqual({ needsSetup: false });
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { token: 'a'.repeat(48), email: 'intruder@example.com', password: 'long-enough-1' },
    });
    expect(res.statusCode).toBe(409);
  });
});
