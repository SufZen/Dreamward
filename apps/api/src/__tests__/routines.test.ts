/* ============================================================================
 * Routine scheduler: due-calculation logic, routine seeding/config routes,
 * and graceful no-provider handling on manual runs.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'dreamward-routines-'));
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');
const { isDue } = await import('../services/scheduler');

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

const routine = (over: Partial<Parameters<typeof isDue>[0]> = {}) =>
  ({
    id: 'daily_plan',
    kind: 'daily_plan',
    enabled: 1,
    scheduleHour: 7,
    autoApprove: 0,
    lastRunAt: null,
    lastStatus: null,
    config: null,
    ...over,
  }) as Parameters<typeof isDue>[0];

// A Wednesday at the given hour (2026-07-08 is a Wednesday).
const wednesdayAt = (hour: number) => new Date(2026, 6, 8, hour, 30);

describe('isDue', () => {
  it('not due when disabled', () => {
    expect(isDue(routine({ enabled: 0 }), wednesdayAt(9))).toBe(false);
  });

  it('not due before the scheduled hour', () => {
    expect(isDue(routine(), wednesdayAt(6))).toBe(false);
  });

  it('due after the hour when never run', () => {
    expect(isDue(routine(), wednesdayAt(7))).toBe(true);
  });

  it('not due twice on the same day', () => {
    const ranToday = wednesdayAt(7).getTime();
    expect(isDue(routine({ lastRunAt: ranToday }), wednesdayAt(9))).toBe(false);
  });

  it('due again the next day', () => {
    const ranYesterday = new Date(2026, 6, 7, 8).getTime();
    expect(isDue(routine({ lastRunAt: ranYesterday }), wednesdayAt(9))).toBe(true);
  });

  it('weekly_review_prep only runs on Friday', () => {
    const prep = routine({ id: 'weekly_review_prep', kind: 'weekly_review_prep' });
    expect(isDue(prep, wednesdayAt(9))).toBe(false);
    expect(isDue(prep, new Date(2026, 6, 10, 9))).toBe(true); // 2026-07-10 = Friday
  });

  it('goal_drift runs Sunday and Wednesday only', () => {
    const drift = routine({ id: 'goal_drift', kind: 'goal_drift' });
    expect(isDue(drift, wednesdayAt(9))).toBe(true);
    expect(isDue(drift, new Date(2026, 6, 9, 9))).toBe(false); // Thursday
  });
});

describe('routines routes', () => {
  it('GET seeds one row per kind, disabled by default', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/routines', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as { id: string; enabled: number }[];
    expect(rows.map((r) => r.id).sort()).toEqual(['daily_plan', 'goal_drift', 'weekly_review_prep']);
    expect(rows.every((r) => r.enabled === 0)).toBe(true);
  });

  it('PATCH updates schedule and toggles', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/routines/daily_plan',
      headers: { cookie },
      payload: { enabled: true, scheduleHour: 6, autoApprove: true },
    });
    const row = res.json() as { enabled: number; scheduleHour: number; autoApprove: number };
    expect(row.enabled).toBe(1);
    expect(row.scheduleHour).toBe(6);
    expect(row.autoApprove).toBe(1);
  });

  it('manual run without an LLM provider → 409 no_provider, recorded in lastStatus', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/routines/daily_plan/run', headers: { cookie } });
    expect(res.statusCode).toBe(409);
    const list = await app.inject({ method: 'GET', url: '/api/routines', headers: { cookie } });
    const daily = (list.json() as { id: string; lastStatus: string }[]).find((r) => r.id === 'daily_plan')!;
    expect(daily.lastStatus).toBe('no_provider');
  });

  it('unknown routine id → 404', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/routines/nope', headers: { cookie }, payload: {} });
    expect(res.statusCode).toBe(404);
  });
});
