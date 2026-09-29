/* ============================================================================
 * apps/api — routes/routines.ts
 * Settings surface for autonomous agent routines: list (self-seeding),
 * update schedule/toggles, and a manual "run now" trigger.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ROUTINE_KINDS, type RoutineKind } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { nowMs } from '../lib/id';
import { runRoutine } from '../agent/routines';

const updateRoutineSchema = z.object({
  enabled: z.boolean().optional(),
  scheduleHour: z.number().int().min(0).max(23).optional(),
  autoApprove: z.boolean().optional(),
});

/** Ensures one row per routine kind exists (idempotent, cheap). */
function seedRoutines() {
  const db = getDb();
  const existing = new Set(db.select({ id: schema.agentRoutines.id }).from(schema.agentRoutines).all().map((r) => r.id));
  for (const kind of ROUTINE_KINDS) {
    if (!existing.has(kind)) {
      db.insert(schema.agentRoutines).values({ id: kind, kind, enabled: 0, scheduleHour: 7, autoApprove: 0 }).run();
    }
  }
}

export default async function routineRoutes(app: FastifyInstance) {
  app.get('/routines', async () => {
    seedRoutines();
    const db = getDb();
    return db.select().from(schema.agentRoutines).all();
  });

  app.patch('/routines/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!ROUTINE_KINDS.includes(id as RoutineKind)) return reply.code(404).send({ error: 'not_found' });
    const parsed = updateRoutineSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    seedRoutines();
    const db = getDb();
    const patch: Record<string, unknown> = {};
    if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled ? 1 : 0;
    if (parsed.data.autoApprove !== undefined) patch.autoApprove = parsed.data.autoApprove ? 1 : 0;
    if (parsed.data.scheduleHour !== undefined) patch.scheduleHour = parsed.data.scheduleHour;
    db.update(schema.agentRoutines).set(patch).where(eq(schema.agentRoutines.id, id)).run();
    return db.select().from(schema.agentRoutines).where(eq(schema.agentRoutines.id, id)).get();
  });

  /** Manual trigger (also used to test a routine before enabling it). */
  app.post('/routines/:id/run', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!ROUTINE_KINDS.includes(id as RoutineKind)) return reply.code(404).send({ error: 'not_found' });
    seedRoutines();
    const db = getDb();
    const routine = db.select().from(schema.agentRoutines).where(eq(schema.agentRoutines.id, id)).get()!;
    db.update(schema.agentRoutines)
      .set({ lastRunAt: nowMs(), lastStatus: 'running' })
      .where(eq(schema.agentRoutines.id, id))
      .run();
    try {
      const res = await runRoutine(id as RoutineKind, routine.autoApprove === 1);
      const status = `ok: ${res.proposals} proposals, ${res.autoApplied} applied`;
      db.update(schema.agentRoutines).set({ lastStatus: status }).where(eq(schema.agentRoutines.id, id)).run();
      return { ok: true, ...res };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      db.update(schema.agentRoutines)
        .set({ lastStatus: msg === 'no_provider' ? 'no_provider' : `error: ${msg.slice(0, 200)}` })
        .where(eq(schema.agentRoutines.id, id))
        .run();
      const code = msg === 'no_provider' ? 409 : 500;
      return reply.code(code).send({ error: msg });
    }
  });
}
