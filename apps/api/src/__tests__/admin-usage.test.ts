/* ============================================================================
 * Admin usage + system endpoints: per-day/per-model rollups, userId filter,
 * empty-table safety, and system info shape.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'dreamward-usage-'));
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { getControlDb, controlSchema, closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let cookie: string;

beforeAll(async () => {
  ({ app } = await buildServer());
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.local', password: 'admin-pass-123' },
  });
  cookie = `lb_session=${login.cookies.find((c) => c.name === 'lb_session')!.value}`;
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

describe('admin usage + system', () => {
  it('returns empty usage safely when nothing is recorded', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/usage', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { days: number; daily: unknown[]; byModel: unknown[] };
    expect(body.days).toBe(30);
    expect(body.daily).toEqual([]);
    expect(body.byModel).toEqual([]);
  });

  it('rolls up usage by day and model, with userId filter + estimated flag', async () => {
    const db = getControlDb();
    db.insert(controlSchema.aiUsage)
      .values([
        { userId: 1, providerName: 'OpenRouter', model: 'gpt-x', promptTokens: 100, completionTokens: 50, estimated: 0 },
        { userId: 1, providerName: 'OpenRouter', model: 'gpt-x', promptTokens: 30, completionTokens: 20, estimated: 1 },
        { userId: 2, providerName: 'OpenRouter', model: 'gpt-y', promptTokens: 5, completionTokens: 5, estimated: 0 },
      ])
      .run();

    const all = await app.inject({ method: 'GET', url: '/api/admin/usage?days=7', headers: { cookie } });
    const body = all.json() as {
      byModel: { model: string; promptTokens: number; completionTokens: number; estimated: boolean }[];
      daily: { userId: number; promptTokens: number }[];
    };
    const gx = body.byModel.find((m) => m.model === 'gpt-x')!;
    expect(gx.promptTokens).toBe(130);
    expect(gx.completionTokens).toBe(70);
    expect(gx.estimated).toBe(true); // one estimated row in the group
    expect(body.byModel.find((m) => m.model === 'gpt-y')?.estimated).toBe(false);

    const filtered = await app.inject({ method: 'GET', url: '/api/admin/usage?userId=1', headers: { cookie } });
    const fb = filtered.json() as { byModel: { model: string }[] };
    expect(fb.byModel.map((m) => m.model)).toEqual(['gpt-x']);
  });

  it('returns system info', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/system', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const s = res.json() as { version: string; nodeVersion: string; uptimeSeconds: number; controlDbBytes: number };
    expect(typeof s.version).toBe('string');
    expect(s.nodeVersion).toMatch(/^v\d+/);
    expect(s.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(s.controlDbBytes).toBeGreaterThan(0);
  });

  it('filters the audit log by event', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/audit?event=login.success', headers: { cookie } });
    const events = (res.json() as { events: { event: string }[] }).events;
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.event === 'login.success')).toBe(true);
  });
});
