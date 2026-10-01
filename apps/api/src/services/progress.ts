/* ============================================================================
 * apps/api — services/progress.ts
 * Computed goal progress rollups (no storage): % of linked actions done,
 * weekly momentum, and a risk signal that the dashboard, Clarity's digest and
 * the autonomous routines all key off.
 * ========================================================================= */
import { isNull } from 'drizzle-orm';
import {
  AT_RISK_WINDOW_DAYS,
  STALLED_AFTER_DAYS,
  type GoalProgress,
  type GoalRisk,
} from '@dreamward/shared';
import { getDb, schema } from '../db/client';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rollup for every goal (single scan of the actions table). */
export function computeGoalProgress(now = Date.now()): Map<string, GoalProgress> {
  const db = getDb();
  const goals = db.select().from(schema.goals).all();
  const actions = db.select().from(schema.actions).where(isNull(schema.actions.deletedAt)).all();

  const byGoal = new Map<string, typeof actions>();
  for (const a of actions) {
    if (!a.goalId) continue;
    const list = byGoal.get(a.goalId);
    if (list) list.push(a);
    else byGoal.set(a.goalId, [a]);
  }

  const weekAgo = now - 7 * DAY_MS;
  const twoWeeksAgo = now - 14 * DAY_MS;
  const stalledCutoff = now - STALLED_AFTER_DAYS * DAY_MS;
  const atRiskCutoff = now + AT_RISK_WINDOW_DAYS * DAY_MS;

  const result = new Map<string, GoalProgress>();
  for (const g of goals) {
    const acts = byGoal.get(g.id) ?? [];
    const done = acts.filter((a) => a.status === 'done');
    const open = acts.length - done.length;
    const pct = acts.length ? Math.round((done.length / acts.length) * 100) : null;

    let lastActivityAt: number | null = null;
    for (const a of acts) {
      const t = a.completedAt ?? a.updatedAt ?? a.createdAt;
      if (t !== null && (lastActivityAt === null || t > lastActivityAt)) lastActivityAt = t;
    }

    const doneThisWeek = done.filter((a) => (a.completedAt ?? 0) >= weekAgo).length;
    const donePrevWeek = done.filter(
      (a) => (a.completedAt ?? 0) >= twoWeeksAgo && (a.completedAt ?? 0) < weekAgo,
    ).length;

    let risk: GoalRisk = 'on_track';
    // Achieved / consciously-parked goals are never flagged.
    if (g.status !== 'achieved' && g.status !== 'not_relevant') {
      const lastDone = done.reduce<number | null>(
        (max, a) => (a.completedAt !== null && (max === null || a.completedAt > max) ? a.completedAt : max),
        null,
      );
      const stalled = open > 0 && (lastDone ?? 0) < stalledCutoff && g.createdAt < stalledCutoff;
      const atRisk =
        g.targetDate !== null && g.targetDate <= atRiskCutoff && g.targetDate >= now && (pct ?? 0) < 50;
      if (atRisk) risk = 'at_risk';
      else if (stalled) risk = 'stalled';
    }

    result.set(g.id, {
      goalId: g.id,
      totalActions: acts.length,
      doneActions: done.length,
      pct,
      lastActivityAt,
      doneThisWeek,
      donePrevWeek,
      risk,
    });
  }
  return result;
}
