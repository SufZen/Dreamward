/* ============================================================================
 * First-run onboarding: the shared resume logic, the web-only status route
 * with progress derived from the book, and Clarity's first-move suggestions.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firstOpenStep, isFreshBook, updateOnboardingSchema, type OnboardingProgress } from '@dreamward/shared';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'dreamward-onboarding-'));
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let cookie: string;

beforeAll(async () => {
  ({ app } = await buildServer());
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.local', password: 'admin-pass-123' },
  });
  cookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

const req = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api${url}`, headers: { cookie }, payload: payload as object | undefined });

describe('onboarding logic', () => {
  const p = (o: Partial<OnboardingProgress> = {}): OnboardingProgress => ({
    hasChapter: false,
    focusCount: 0,
    ratedCount: 0,
    hasIkigai: false,
    hasAction: false,
    ...o,
  });

  it('a book is fresh without a chapter and goals', () => {
    expect(isFreshBook({ hasChapter: false, goalCount: 0 })).toBe(true);
    expect(isFreshBook({ hasChapter: true, goalCount: 0 })).toBe(false);
    expect(isFreshBook({ hasChapter: false, goalCount: 1 })).toBe(false);
  });

  it('resumes at the first step whose data is missing', () => {
    expect(firstOpenStep(p())).toBe('chapter');
    expect(firstOpenStep(p({ hasChapter: true }))).toBe('wheel');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3 }))).toBe('focus');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3, focusCount: 2 }))).toBe('ikigai');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3, focusCount: 2 }), { ikigaiSeen: true })).toBe('move');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3, focusCount: 2, hasIkigai: true }))).toBe('move');
    expect(
      firstOpenStep(p({ hasChapter: true, ratedCount: 3, focusCount: 2, hasIkigai: true, hasAction: true })),
    ).toBe('done');
  });

  it('rejects unknown statuses and extra keys', () => {
    expect(updateOnboardingSchema.safeParse({ status: 'completed' }).success).toBe(true);
    expect(updateOnboardingSchema.safeParse({ status: 'done' }).success).toBe(false);
    expect(updateOnboardingSchema.safeParse({ status: 'completed', x: 1 }).success).toBe(false);
  });
});

describe('/api/onboarding', () => {
  it('an empty book is fresh and pending', async () => {
    const r = await req('GET', '/onboarding');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      status: 'pending',
      fresh: true,
      progress: { hasChapter: false, focusCount: 0, ratedCount: 0, hasIkigai: false, hasAction: false },
    });
  });

  it('progress follows the book', async () => {
    const ch = (await req('POST', '/chapters', { title: 'Season of roots' })).json() as { id: string };
    expect((await req('POST', '/ratings', { categoryId: 'health_fitness', score: 4 })).statusCode).toBe(201);
    await req('PUT', `/chapters/${ch.id}`, { focusCategoryIds: ['health_fitness'] });
    await req('POST', '/actions', { title: 'Walk 20 minutes' });
    const o = (await req('GET', '/onboarding')).json();
    expect(o.fresh).toBe(false);
    expect(o.progress).toEqual({ hasChapter: true, focusCount: 1, ratedCount: 1, hasIkigai: false, hasAction: true });
  });

  it('stores the status and validates it', async () => {
    expect((await req('PUT', '/onboarding', { status: 'nope' })).statusCode).toBe(400);
    expect((await req('PUT', '/onboarding', {})).statusCode).toBe(400);
    expect((await req('GET', '/onboarding')).json().status).toBe('pending');
    expect((await req('PUT', '/onboarding', { status: 'dismissed' })).json().status).toBe('dismissed');
    expect((await req('GET', '/onboarding')).json().status).toBe('dismissed');
    expect((await req('PUT', '/onboarding', { status: 'completed' })).json().status).toBe('completed');
  });

  it('is not part of the /api/v1 agent surface', async () => {
    const key = await req('POST', '/api-keys', { name: 'onboarding-test', scope: 'write' });
    expect(key.statusCode).toBeLessThan(300);
    const { token } = key.json() as { token: string };
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(404);
  });
});

describe('/api/agent/onboarding/suggest', () => {
  it('needs an AI provider', async () => {
    const r = await req('POST', '/agent/onboarding/suggest', { lang: 'en' });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toEqual({ error: 'no_active_provider' });
  });

  it('rejects an unknown language', async () => {
    expect((await req('POST', '/agent/onboarding/suggest', { lang: 'fr' })).statusCode).toBe(400);
  });
});
