/* ============================================================================
 * Invite + admin lifecycle: create invite → accept → new isolated workspace;
 * admin can disable/enable/delete; role enforcement on /api/admin.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'dreamward-inv-'));
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';
process.env.MAX_USERS = '3';

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let adminCookie: string;

beforeAll(async () => {
  ({ app } = await buildServer());
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.local', password: 'admin-pass-123' },
  });
  adminCookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

describe('invite + admin lifecycle', () => {
  let inviteToken: string;
  let invitedUserId: number;
  let invitedCookie: string;

  it('admin creates an invite link', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/invites',
      headers: { cookie: adminCookie },
      payload: { note: 'tester one' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { invite: { token: string }; url: string };
    expect(body.url).toContain('/invite/');
    inviteToken = body.invite.token;
  });

  it('invitee accepts and gets a provisioned isolated workspace', async () => {
    const probe = await app.inject({ method: 'GET', url: `/api/invites/${inviteToken}` });
    expect(probe.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: `/api/invites/${inviteToken}/accept`,
      payload: { email: 'tester1@test.local', password: 'tester-pass-1' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { user: { id: number; role: string } };
    invitedUserId = body.user.id;
    expect(body.user.role).toBe('user');
    invitedCookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;

    expect(existsSync(join(process.env.DATA_DIR!, 'users', String(invitedUserId), 'lifebook.db'))).toBe(true);

    // Seeded structure is there, content is empty.
    const cats = await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie: invitedCookie } });
    expect(cats.statusCode).toBe(200);
    expect((cats.json() as unknown[]).length).toBeGreaterThan(0);
  });

  it('rejects double-spending the invite', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/invites/${inviteToken}/accept`,
      payload: { email: 'tester2@test.local', password: 'tester-pass-2' },
    });
    expect(res.statusCode).toBe(410);
  });

  it('blocks non-admins from /api/admin', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie: invitedCookie } });
    expect(res.statusCode).toBe(403);
  });

  it('enforces MAX_USERS on invite creation', async () => {
    // 2 of 3 seats used; one more invite is fine, then the cap blocks creation.
    const ok = await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie: adminCookie }, payload: {} });
    expect(ok.statusCode).toBe(200);
    const token3 = (ok.json() as { invite: { token: string } }).invite.token;
    const accept3 = await app.inject({
      method: 'POST',
      url: `/api/invites/${token3}/accept`,
      payload: { email: 'tester3@test.local', password: 'tester-pass-3' },
    });
    expect(accept3.statusCode).toBe(200);

    const blocked = await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie: adminCookie }, payload: {} });
    expect(blocked.statusCode).toBe(409);
  });

  it('admin disables, re-enables, then deletes a user with their data', async () => {
    const disable = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${invitedUserId}/disable`,
      headers: { cookie: adminCookie },
    });
    expect(disable.statusCode).toBe(200);
    const dead = await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie: invitedCookie } });
    expect(dead.statusCode).toBe(401);

    const enable = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${invitedUserId}/enable`,
      headers: { cookie: adminCookie },
    });
    expect(enable.statusCode).toBe(200);
    const alive = await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie: invitedCookie } });
    expect(alive.statusCode).toBe(200);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${invitedUserId}`,
      headers: { cookie: adminCookie },
    });
    expect(del.statusCode).toBe(200);
    expect(existsSync(join(process.env.DATA_DIR!, 'users', String(invitedUserId)))).toBe(false);
  });

  it('audit log captured the lifecycle', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/audit', headers: { cookie: adminCookie } });
    const events = (res.json() as { events: { event: string }[] }).events.map((e) => e.event);
    for (const expected of ['invite.created', 'invite.accepted', 'user.disabled', 'user.enabled', 'user.deleted']) {
      expect(events).toContain(expected);
    }
  });
});
