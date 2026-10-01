/* ============================================================================
 * Meaning & focus layer: Current Life Chapter, life-wheel ratings, IKIGAI
 * profiles, identity sections (incl. backfill into an existing book) and the
 * /api/v1 exposure + digest integration.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'dreamward-meaning-'));
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs, runAsUser } = await import('../db/registry');
const { getSqlite } = await import('../db/client');
const { buildDigest } = await import('../agent/digest');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let cookie: string;
let adminUid: number;

beforeAll(async () => {
  ({ app } = await buildServer());
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.local', password: 'admin-pass-123' },
  });
  cookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
  const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
  adminUid = (me.json() as { user: { id: number } }).user.id;
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

const req = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api${url}`, headers: { cookie }, payload: payload as object | undefined });

type Section = { id: string; sectionType: string; sortOrder: number; shape: string; content: unknown };
const sectionsOf = async (categoryId: string) =>
  ((await req('GET', `/categories/${categoryId}`)).json() as { sections: Section[] }).sections;

describe('identity section', () => {
  it('is seeded after vision in every standard category', async () => {
    const sections = await sectionsOf('health_fitness');
    expect(sections.map((s) => s.sectionType)).toEqual(['premises', 'vision', 'identity', 'purpose', 'strategy']);
    const identity = sections.find((s) => s.sectionType === 'identity')!;
    expect(identity.shape).toBe('identity');
    expect(identity.content).toMatchObject({ states: [], standards: [], beliefShifts: [] });
  });

  it('is backfilled into a book provisioned before it existed, keeping order', async () => {
    // Simulate a pre-0.4 book: no identity rows, purpose/strategy at 3/4.
    runAsUser(adminUid, 'admin', () => {
      const db = getSqlite();
      db.prepare(`DELETE FROM category_sections WHERE section_type = 'identity'`).run();
      db.prepare(`UPDATE category_sections SET sort_order = 3 WHERE section_type = 'purpose'`).run();
      db.prepare(`UPDATE category_sections SET sort_order = 4 WHERE section_type = 'strategy'`).run();
    });
    expect((await sectionsOf('career')).map((s) => s.sectionType)).not.toContain('identity');

    closeAllUserDbs(); // next request re-opens → migrate + structural seed
    const sections = await sectionsOf('career');
    expect(sections.map((s) => [s.sectionType, s.sortOrder])).toEqual([
      ['premises', 1],
      ['vision', 2],
      ['identity', 3],
      ['purpose', 4],
      ['strategy', 5],
    ]);
    const qol = await sectionsOf('quality_of_life');
    expect(qol.map((s) => s.sectionType)).toEqual([
      'premises',
      'vision',
      'identity',
      'purpose',
      'strategy',
      'qol_experiences',
      'qol_environment',
      'qol_materialistic',
    ]);
  });

  it('accepts identity content through the agent markdown endpoint service', async () => {
    const identity = (await sectionsOf('health_fitness')).find((s) => s.sectionType === 'identity')!;
    const res = await req('PUT', `/sections/${identity.id}`, {
      content: {
        statement: 'I am someone who moves every day',
        states: [{ id: 'a', text: 'energetic', order: 0 }],
        standards: [],
        beliefShifts: [{ id: 'b', from: 'I have no time', to: 'Ten minutes counts' }],
      },
    });
    expect(res.statusCode).toBe(200);
    const digest = runAsUser(adminUid, 'admin', () => buildDigest('full').markdown);
    expect(digest).toContain('I am someone who moves every day');
    expect(digest).toContain('I have no time → Ten minutes counts');
  });
});

describe('current life chapter', () => {
  let firstId: string;

  it('starts with no active chapter', async () => {
    expect((await req('GET', '/chapters/current')).json()).toEqual({ chapter: null });
  });

  it('creates a chapter, normalizing focus vs maintenance and defaulting the review date', async () => {
    const res = await req('POST', '/chapters', {
      title: 'Building the new base',
      focusCategoryIds: ['career', 'health_fitness', 'not_a_category'],
      maintenanceCategoryIds: ['career', 'social'],
      notNow: [{ id: 'n1', text: 'Moving abroad', order: 0 }],
    });
    expect(res.statusCode).toBe(201);
    const ch = res.json() as {
      id: string;
      status: string;
      focusCategoryIds: string[];
      maintenanceCategoryIds: string[];
      startDate: number;
      reviewDate: number;
    };
    firstId = ch.id;
    expect(ch.status).toBe('active');
    expect(ch.focusCategoryIds).toEqual(['career', 'health_fitness']);
    expect(ch.maintenanceCategoryIds).toEqual(['social']);
    expect(ch.reviewDate - ch.startDate).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('rejects more than 5 focus areas', async () => {
    const res = await req('POST', '/chapters', {
      title: 'Too much',
      focusCategoryIds: ['career', 'health_fitness', 'social', 'love', 'financial', 'sex'],
    });
    expect(res.statusCode).toBe(400);
  });

  it('keeps only one active chapter — a new one closes the previous', async () => {
    const res = await req('POST', '/chapters', { title: 'Second season' });
    const second = res.json() as { id: string };
    const all = (await req('GET', '/chapters')).json() as { id: string; status: string; closedAt: number | null }[];
    expect(all.filter((c) => c.status === 'active').map((c) => c.id)).toEqual([second.id]);
    expect(all.find((c) => c.id === firstId)!.closedAt).not.toBeNull();
  });

  it('updates and closes with a reflection', async () => {
    const current = ((await req('GET', '/chapters/current')).json() as { chapter: { id: string } }).chapter;
    const upd = await req('PUT', `/chapters/${current.id}`, { intention: 'Calm, strong foundations' });
    expect((upd.json() as { intention: string }).intention).toBe('Calm, strong foundations');
    const closed = await req('POST', `/chapters/${current.id}/close`, { closingReflection: 'Learned a lot' });
    expect(closed.json()).toMatchObject({ status: 'closed', closingReflection: 'Learned a lot' });
    expect((await req('POST', `/chapters/${current.id}/close`, {})).statusCode).toBe(409);
    expect((await req('PUT', '/chapters/nope', { title: 'x' })).statusCode).toBe(404);
  });
});

describe('life-wheel ratings', () => {
  it('validates the score range and category', async () => {
    expect((await req('POST', '/ratings', { categoryId: 'career', score: 11 })).statusCode).toBe(400);
    expect((await req('POST', '/ratings', { categoryId: 'career', score: 0 })).statusCode).toBe(400);
    expect((await req('POST', '/ratings', { categoryId: 'nope', score: 5 })).statusCode).toBe(404);
  });

  it('keeps history and reports latest + delta per category', async () => {
    await req('POST', '/ratings', { categoryId: 'career', score: 4, reality: 'Stuck', gap: 'No clear offer' });
    await new Promise((r) => setTimeout(r, 5));
    await req('POST', '/ratings', { categoryId: 'career', score: 6, reality: 'Moving', gap: '' });

    const history = (await req('GET', '/ratings?categoryId=career')).json() as { score: number }[];
    expect(history.map((h) => h.score)).toEqual([4, 6]);

    const latest = (await req('GET', '/ratings/latest')).json() as {
      categoryId: string;
      latest: { score: number; gap: string | null } | null;
      previousScore: number | null;
      delta: number | null;
    }[];
    expect(latest).toHaveLength(12);
    const career = latest.find((r) => r.categoryId === 'career')!;
    expect(career.latest!.score).toBe(6);
    expect(career.latest!.gap).toBeNull(); // blank → null
    expect(career.previousScore).toBe(4);
    expect(career.delta).toBe(2);
    expect(latest.find((r) => r.categoryId === 'love')).toMatchObject({ latest: null, delta: null });
  });
});

describe('ikigai profiles', () => {
  const item = (id: string, text: string, circles: string[]) => ({ id, text, circles, source: 'user' });
  let draftId: string;

  it('starts empty and creates a single draft (idempotent)', async () => {
    expect((await req('GET', '/ikigai')).json()).toEqual({ current: null, draft: null, history: [] });
    const a = (await req('POST', '/ikigai/draft', {})).json() as { id: string; status: string; step: number };
    const b = (await req('POST', '/ikigai/draft', {})).json() as { id: string };
    expect(a.status).toBe('draft');
    expect(a.step).toBe(0);
    expect(b.id).toBe(a.id);
    draftId = a.id;
  });

  it('autosaves partial updates and validates items', async () => {
    const bad = await req('PUT', `/ikigai/${draftId}`, { items: [item('x', 'no circles', [])] });
    expect(bad.statusCode).toBe(400);
    const res = await req('PUT', `/ikigai/${draftId}`, {
      items: [item('1', 'Teaching', ['love', 'good', 'needs', 'paid']), item('2', 'Hiking', ['love'])],
      step: 3,
    });
    expect(res.json()).toMatchObject({ step: 3 });
  });

  it('refuses to complete while a circle is empty or the statement is missing', async () => {
    await req('PUT', `/ikigai/${draftId}`, { items: [item('2', 'Hiking', ['love'])] });
    const res = await req('POST', `/ikigai/${draftId}/complete`);
    expect(res.statusCode).toBe(422);
    const details = (res.json() as { details: { kind: string; circle?: string }[] }).details;
    expect(details).toEqual([
      { kind: 'empty_circle', circle: 'good' },
      { kind: 'empty_circle', circle: 'needs' },
      { kind: 'empty_circle', circle: 'paid' },
      { kind: 'no_statement' },
    ]);
  });

  it('completes a draft into current, then archives it when a revisit completes', async () => {
    await req('PUT', `/ikigai/${draftId}`, {
      items: [item('1', 'Teaching', ['love', 'good', 'needs', 'paid'])],
      statement: 'Helping people grow through teaching',
      everyday: [{ id: 'e1', text: 'Morning coffee', order: 0 }],
    });
    const done = await req('POST', `/ikigai/${draftId}/complete`);
    expect(done.statusCode).toBe(200);
    expect(done.json()).toMatchObject({ status: 'current' });

    // An action can link to the IKIGAI profile ("first small step").
    const action = await req('POST', '/actions', { title: 'Run one workshop', linkedType: 'ikigai', linkedId: draftId });
    expect(action.statusCode).toBe(200);

    const revisit = (await req('POST', '/ikigai/draft', { fromCurrent: true })).json() as {
      id: string;
      statement: string;
      items: unknown[];
      step: number;
    };
    expect(revisit.id).not.toBe(draftId);
    expect(revisit.statement).toBe('Helping people grow through teaching');
    expect(revisit.items).toHaveLength(1);
    expect(revisit.step).toBe(1);

    await req('PUT', `/ikigai/${revisit.id}`, { statement: 'Teaching as a way of life' });
    await req('POST', `/ikigai/${revisit.id}/complete`);

    const state = (await req('GET', '/ikigai')).json() as {
      current: { id: string };
      draft: null;
      history: { id: string; status: string }[];
    };
    expect(state.current.id).toBe(revisit.id);
    expect(state.draft).toBeNull();
    expect(state.history.map((h) => h.status)).toEqual(['current', 'archived']);
    // archived profiles are read-only
    expect((await req('PUT', `/ikigai/${draftId}`, { statement: 'x' })).statusCode).toBe(409);
  });

  it('only deletes drafts', async () => {
    const current = ((await req('GET', '/ikigai')).json() as { current: { id: string } }).current;
    expect((await req('DELETE', `/ikigai/${current.id}`)).statusCode).toBe(404);
    const d = (await req('POST', '/ikigai/draft', {})).json() as { id: string };
    expect((await req('DELETE', `/ikigai/${d.id}`)).statusCode).toBe(200);
  });

  it('shows up in the Clarity digest and in snapshots', async () => {
    const digest = runAsUser(adminUid, 'admin', () => buildDigest('compact').markdown);
    expect(digest).toContain('Teaching as a way of life');
    expect(digest).toContain('גלגל החיים');

    const snap = await req('POST', '/snapshots', { label: 'with meaning' });
    const { id } = snap.json() as { id: string };
    const diff = (await req('GET', `/snapshots/${id}/diff`)).json() as {
      snapshot: { ikigai: { statement: string }; ratings: unknown[] };
    };
    expect(diff.snapshot.ikigai.statement).toBe('Teaching as a way of life');
    expect(diff.snapshot.ratings).toHaveLength(12);
  });

  it('suggest returns 409 without an AI provider', async () => {
    expect((await req('GET', '/agent/available')).json()).toEqual({ available: false });
    const res = await req('POST', '/agent/ikigai/suggest', { mode: 'circle', circle: 'love' });
    expect(res.statusCode).toBe(409);
    expect((await req('POST', '/agent/ikigai/suggest', { mode: 'circle', circle: 'nope' })).statusCode).toBe(400);
  });
});
