/* ============================================================================
 * apps/api — services/scheduler.ts
 * Routine scheduler: a 5-minute tick that walks active users, enters each
 * tenant context, and runs any enabled routine that is due. Failures are
 * recorded on the routine row (lastStatus) and never crash the tick.
 * Cost guard: a routine runs at most once per day (isDue), only for users
 * with an active LLM provider.
 * ========================================================================= */
import { eq } from 'drizzle-orm';
import type { RoutineKind } from '@dreamward/shared';
import { getControlDb, controlSchema, type Role } from '../db/control';
import { runAsUser } from '../db/registry';
import { getDb, schema } from '../db/client';
import { nowMs } from '../lib/id';
import { runRoutine } from '../agent/routines';
import { isBackupDue, runBackup } from './backup';

const TICK_MS = 5 * 60 * 1000;

/** Which weekdays a routine kind runs on (JS getDay(): 0=Sun … 6=Sat). */
const ROUTINE_DAYS: Record<RoutineKind, number[] | 'daily'> = {
  daily_plan: 'daily',
  weekly_review_prep: [5], // Friday — prep for the Saturday ritual
  goal_drift: [0, 3], // Sunday + Wednesday
};

type RoutineRow = typeof schema.agentRoutines.$inferSelect;

/**
 * A routine is due when: enabled, today is one of its days, the scheduled
 * hour has passed, and it has not already run since today's scheduled time.
 */
export function isDue(routine: RoutineRow, now = new Date()): boolean {
  if (!routine.enabled) return false;
  const days = ROUTINE_DAYS[routine.kind as RoutineKind] ?? 'daily';
  if (days !== 'daily' && !days.includes(now.getDay())) return false;
  if (now.getHours() < routine.scheduleHour) return false;
  const scheduledToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), routine.scheduleHour).getTime();
  return (routine.lastRunAt ?? 0) < scheduledToday;
}

/** One pass over all active users. Exported for tests and the manual trigger. */
export async function schedulerTick(now = new Date()): Promise<void> {
  const users = getControlDb()
    .select({ id: controlSchema.controlUsers.id, role: controlSchema.controlUsers.role })
    .from(controlSchema.controlUsers)
    .where(eq(controlSchema.controlUsers.status, 'active'))
    .all();

  for (const user of users) {
    try {
      await runAsUser(user.id, user.role as Role, async () => {
        const db = getDb();
        const routines = db.select().from(schema.agentRoutines).all();
        for (const routine of routines) {
          if (!isDue(routine, now)) continue;
          // Stamp lastRunAt up-front so a crashed run doesn't retry all day.
          db.update(schema.agentRoutines)
            .set({ lastRunAt: nowMs(), lastStatus: 'running' })
            .where(eq(schema.agentRoutines.id, routine.id))
            .run();
          try {
            const res = await runRoutine(routine.kind as RoutineKind, routine.autoApprove === 1);
            db.update(schema.agentRoutines)
              .set({ lastStatus: `ok: ${res.proposals} proposals, ${res.autoApplied} applied` })
              .where(eq(schema.agentRoutines.id, routine.id))
              .run();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            db.update(schema.agentRoutines)
              .set({ lastStatus: msg === 'no_provider' ? 'no_provider' : `error: ${msg.slice(0, 200)}` })
              .where(eq(schema.agentRoutines.id, routine.id))
              .run();
          }
        }
      });
    } catch (err) {
      // A broken tenant must not stop the others.
      console.error(`[scheduler] user ${user.id} tick failed:`, err);
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (ticking) return; // a long LLM run must not overlap the next tick
    ticking = true;
    Promise.resolve()
      .then(async () => {
        // Daily backup first — it must not be skipped because a routine is slow.
        if (isBackupDue()) await runBackup('scheduled');
      })
      .catch((err) => console.error('[scheduler] backup failed:', err))
      .then(() => schedulerTick())
      .catch((err) => console.error('[scheduler] tick failed:', err))
      .finally(() => {
        ticking = false;
      });
  }, TICK_MS);
  timer.unref?.(); // never keep the process alive just for the scheduler
  console.log('[scheduler] started (5-minute tick)');
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
