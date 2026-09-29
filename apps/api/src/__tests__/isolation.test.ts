/* ============================================================================
 * Cross-user isolation gate (Phase 1 of the multi-user architecture).
 * Two users, one server: every byte of content must stay inside the owner's
 * users/<uid>/ directory — DB rows, media files, everything.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'dreamward-iso-'));
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { getControlDb, controlSchema, closeControlDb } = await import('../db/control');
const { provisionUser, closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let adminCookie: string;
let userCookie: string;

async function login(email: string, password: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  expect(res.statusCode).toBe(200);
  const cookie = res.cookies.find((c) => c.name === 'lb_session');
  expect(cookie).toBeDefined();
  return `lb_session=${cookie!.value}`;
}

beforeAll(async () => {
  ({ app } = await buildServer());

  // Second account, created the way invites will create them.
  const hash = await argon2.hash('user-pass-123', { type: argon2.argon2id });
  const row = getControlDb()
    .insert(controlSchema.controlUsers)
    .values({ email: 'user2@test.local', passwordHash: hash, role: 'user', status: 'active' })
    .returning({ id: controlSchema.controlUsers.id })
    .get();
  provisionUser(row.id);

  adminCookie = await login('admin@test.local', 'admin-pass-123');
  userCookie = await login('user2@test.local', 'user-pass-123');
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

describe('cross-user isolation', () => {
  it('separates user DB files on disk', () => {
    expect(existsSync(join(process.env.DATA_DIR!, 'users', '1', 'lifebook.db'))).toBe(true);
    expect(existsSync(join(process.env.DATA_DIR!, 'users', '2', 'lifebook.db'))).toBe(true);
  });

  it('keeps journal entries private to their author', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/journal',
      headers: { cookie: adminCookie },
      payload: { title: 'admin secret entry', bodyRichtext: '<p>classified</p>' },
    });
    expect(created.statusCode).toBe(200);

    const adminList = await app.inject({ method: 'GET', url: '/api/journal', headers: { cookie: adminCookie } });
    expect(adminList.json()).toHaveLength(1);

    const userList = await app.inject({ method: 'GET', url: '/api/journal', headers: { cookie: userCookie } });
    expect(userList.json()).toHaveLength(0);
  });

  it('keeps isolation under parallel interleaved requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        app.inject({
          method: 'GET',
          url: '/api/journal',
          headers: { cookie: i % 2 === 0 ? adminCookie : userCookie },
        }),
      ),
    );
    results.forEach((res, i) => {
      const rows = res.json() as { title: string }[];
      if (i % 2 === 0) {
        expect(rows).toHaveLength(1);
        expect(rows[0]!.title).toBe('admin secret entry');
      } else {
        expect(rows).toHaveLength(0);
      }
    });
  });

  it('serves media only from the requester own assets dir', async () => {
    writeFileSync(join(process.env.DATA_DIR!, 'users', '1', 'assets', 'originals', 'secret.jpg'), 'admin-bytes');

    const asAdmin = await app.inject({ method: 'GET', url: '/media/originals/secret.jpg', headers: { cookie: adminCookie } });
    expect(asAdmin.statusCode).toBe(200);

    const asUser = await app.inject({ method: 'GET', url: '/media/originals/secret.jpg', headers: { cookie: userCookie } });
    expect(asUser.statusCode).toBe(404);
  });

  it('blocks media path traversal', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/media/..%2F..%2F..%2Fcontrol.db',
      headers: { cookie: adminCookie },
    });
    expect([403, 404]).toContain(res.statusCode);
  });

  it('rejects unauthenticated and disabled users', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/journal' });
    expect(anon.statusCode).toBe(401);

    const { eq } = await import('drizzle-orm');
    getControlDb()
      .update(controlSchema.controlUsers)
      .set({ status: 'disabled' })
      .where(eq(controlSchema.controlUsers.email, 'user2@test.local'))
      .run();
    // Existing session must die immediately.
    const disabled = await app.inject({ method: 'GET', url: '/api/journal', headers: { cookie: userCookie } });
    expect(disabled.statusCode).toBe(401);
    getControlDb()
      .update(controlSchema.controlUsers)
      .set({ status: 'active' })
      .where(eq(controlSchema.controlUsers.email, 'user2@test.local'))
      .run();
  });
});
