/* ============================================================================
 * API keys + /api/v1 agent surface: tenant resolution, scope enforcement,
 * revocation, disabled users, admin-surface isolation, and the audit trail.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'dreamward-apikeys-'));
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { getControlDb, controlSchema, closeControlDb } = await import('../db/control');
const { provisionUser, closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let adminCookie: string;
let writeToken: string;
let readToken: string;
let user2Token: string;
let writeKeyId: number;

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

async function login(email: string, password: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  return `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
}

beforeAll(async () => {
  ({ app } = await buildServer());
  adminCookie = await login('admin@test.local', 'admin-pass-123');

  // second user with their own key — tenant isolation check
  const hash = await argon2.hash('user-pass-123', { type: argon2.argon2id });
  const row = getControlDb()
    .insert(controlSchema.controlUsers)
    .values({ email: 'user2@test.local', passwordHash: hash, role: 'user', status: 'active' })
    .returning({ id: controlSchema.controlUsers.id })
    .get();
  provisionUser(row.id);
  const user2Cookie = await login('user2@test.local', 'user-pass-123');

  const w = await app.inject({
    method: 'POST',
    url: '/api/api-keys',
    headers: { cookie: adminCookie },
    payload: { name: 'test write key', scope: 'write' },
  });
  ({ token: writeToken, key: { id: writeKeyId } } = w.json() as { token: string; key: { id: number } });

  const r = await app.inject({
    method: 'POST',
    url: '/api/api-keys',
    headers: { cookie: adminCookie },
    payload: { name: 'test read key', scope: 'read' },
  });
  readToken = (r.json() as { token: string }).token;

  const u2 = await app.inject({
    method: 'POST',
    url: '/api/api-keys',
    headers: { cookie: user2Cookie },
    payload: { name: 'user2 key', scope: 'write' },
  });
  user2Token = (u2.json() as { token: string }).token;
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

describe('key lifecycle', () => {
  it('returns the raw token once and only stores hash + prefix', async () => {
    expect(writeToken).toMatch(/^lbk_/);
    const list = await app.inject({ method: 'GET', url: '/api/api-keys', headers: { cookie: adminCookie } });
    const keys = list.json() as { tokenPrefix: string; name: string }[];
    const mine = keys.find((k) => k.name === 'test write key')!;
    expect(mine.tokenPrefix).toBe(writeToken.slice(0, 12));
    expect(JSON.stringify(keys)).not.toContain(writeToken);
  });

  it('rejects missing/garbage tokens', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/v1/goals' });
    expect(anon.statusCode).toBe(401);
    const bad = await app.inject({ method: 'GET', url: '/api/v1/goals', headers: bearer('lbk_garbage') });
    expect(bad.statusCode).toBe(401);
  });
});

describe('/api/v1 surface', () => {
  it('write key: full CRUD on actions, provenance createdBy=api', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: bearer(writeToken),
      payload: { title: 'from agent', priority: 'high' },
    });
    expect(created.statusCode).toBe(200);
    const action = created.json() as { id: string; createdBy: string; priority: string };
    expect(action.createdBy).toBe('api');
    expect(action.priority).toBe('high');

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/actions/${action.id}`,
      headers: bearer(writeToken),
      payload: { status: 'done' },
    });
    expect((patched.json() as { status: string }).status).toBe('done');
  });

  it('read key: GET allowed, writes 403', async () => {
    const ok = await app.inject({ method: 'GET', url: '/api/v1/actions', headers: bearer(readToken) });
    expect(ok.statusCode).toBe(200);
    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: bearer(readToken),
      payload: { title: 'nope' },
    });
    expect(denied.statusCode).toBe(403);
    expect((denied.json() as { error: string }).error).toBe('insufficient_scope');
  });

  it('keeps tenants isolated: user2 key sees only user2 data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/actions', headers: bearer(user2Token) });
    expect(res.statusCode).toBe(200);
    expect((res.json() as unknown[]).length).toBe(0); // admin's action invisible
  });

  it('markdown endpoints work (journal + search)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/journal/markdown',
      headers: bearer(writeToken),
      payload: { title: 'agent note', bodyMarkdown: '# Hello\nfrom the **agent**' },
    });
    expect(created.statusCode).toBe(201);
    const search = await app.inject({ method: 'GET', url: '/api/v1/search?q=agent', headers: bearer(readToken) });
    expect(search.statusCode).toBe(200);
  });

  it('never exposes admin/auth/llm surfaces', async () => {
    for (const url of ['/api/v1/admin/users', '/api/v1/llm/providers', '/api/v1/auth/me', '/api/v1/proposals']) {
      const res = await app.inject({ method: 'GET', url, headers: bearer(writeToken) });
      expect([404]).toContain(res.statusCode);
    }
  });
});

describe('audit trail', () => {
  it('records mutations with prior state, visible via cookie route', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/agent-activity?limit=20',
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    const rows = list.json() as { action: string | null; keyName: string; priorState: string | null; status: number }[];
    expect(rows.length).toBeGreaterThanOrEqual(3); // create + patch + journal
    const patch = rows.find((r) => r.action === 'action.update');
    expect(patch).toBeDefined();
    expect(patch!.keyName).toBe('test write key');
    expect(patch!.priorState).toContain('from agent'); // pre-update row captured
    expect(rows.every((r) => !JSON.stringify(r).includes(writeToken))).toBe(true);
  });
});

describe('calendar feed', () => {
  it('serves ICS with a read key via query param; refuses write keys', async () => {
    // seed one dated action so the feed has an event
    await app.inject({
      method: 'POST',
      url: '/api/actions',
      headers: { cookie: adminCookie },
      payload: { title: 'Calendar test action', dueDate: Date.parse('2026-08-01') },
    });

    const ok = await app.inject({ method: 'GET', url: `/api/feeds/calendar.ics?key=${readToken}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toContain('text/calendar');
    expect(ok.body).toContain('BEGIN:VCALENDAR');
    expect(ok.body).toContain('Calendar test action');
    expect(ok.body).toContain('DTSTART;VALUE=DATE:20260801');

    const writeDenied = await app.inject({ method: 'GET', url: `/api/feeds/calendar.ics?key=${writeToken}` });
    expect(writeDenied.statusCode).toBe(403);

    const anon = await app.inject({ method: 'GET', url: '/api/feeds/calendar.ics' });
    expect(anon.statusCode).toBe(401);
  });
});

describe('revocation & account state', () => {
  it('revoked key → 401 immediately', async () => {
    const revoked = await app.inject({
      method: 'DELETE',
      url: `/api/api-keys/${writeKeyId}`,
      headers: { cookie: adminCookie },
    });
    expect(revoked.statusCode).toBe(200);
    const denied = await app.inject({ method: 'GET', url: '/api/v1/goals', headers: bearer(writeToken) });
    expect(denied.statusCode).toBe(401);
  });

  it('disabled user → all their keys die', async () => {
    const { eq } = await import('drizzle-orm');
    getControlDb()
      .update(controlSchema.controlUsers)
      .set({ status: 'disabled' })
      .where(eq(controlSchema.controlUsers.email, 'user2@test.local'))
      .run();
    const denied = await app.inject({ method: 'GET', url: '/api/v1/goals', headers: bearer(user2Token) });
    expect(denied.statusCode).toBe(401);
  });
});
