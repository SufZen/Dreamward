import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { createGoalSchema, updateGoalSchema, updateGoalStatusSchema, GOAL_STATUSES } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import { computeGoalProgress } from '../services/progress';

export default async function goalRoutes(app: FastifyInstance) {
  app.get('/goals', async (req) => {
    const { category_id, status } = req.query as { category_id?: string; status?: string };
    const db = getDb();
    let rows = db.select().from(schema.goals).orderBy(asc(schema.goals.sortOrder)).all();
    if (category_id) rows = rows.filter((r) => r.categoryId === category_id);
    if (status) rows = rows.filter((r) => r.status === status);
    return rows;
  });

  /** Computed rollups: % done, weekly momentum, risk — one entry per goal. */
  app.get('/goals/progress', async () => {
    return Object.fromEntries(computeGoalProgress());
  });

  app.get('/goals/summary', async () => {
    const db = getDb();
    const rows = db.select().from(schema.goals).all();
    const byStatus = Object.fromEntries(GOAL_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.categoryId) byCategory[r.categoryId] = (byCategory[r.categoryId] ?? 0) + 1;
    }
    return { total: rows.length, byStatus, byCategory };
  });

  app.post('/goals', async (req, reply) => {
    const parsed = createGoalSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const id = uuid();
    const ts = nowMs();
    db.insert(schema.goals)
      .values({
        id,
        categoryId: parsed.data.categoryId ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: parsed.data.status ?? 'not_relevant',
        targetDate: parsed.data.targetDate ?? null,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
    return db.select().from(schema.goals).where(eq(schema.goals.id, id)).get();
  });

  app.get('/goals/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.select().from(schema.goals).where(eq(schema.goals.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return row;
  });

  app.put('/goals/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateGoalSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const res = db
      .update(schema.goals)
      .set({ ...parsed.data, updatedAt: nowMs() })
      .where(eq(schema.goals.id, id))
      .run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    return db.select().from(schema.goals).where(eq(schema.goals.id, id)).get();
  });

  app.patch('/goals/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateGoalStatusSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const ts = nowMs();
    const res = db
      .update(schema.goals)
      .set({ status: parsed.data.status, updatedAt: ts })
      .where(eq(schema.goals.id, id))
      .run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    db.insert(schema.goalStatusHistory)
      .values({ id: uuid(), goalId: id, status: parsed.data.status, note: parsed.data.note ?? null, changedAt: ts })
      .run();
    return { ok: true };
  });

  app.delete('/goals/:id', async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    db.delete(schema.goals).where(eq(schema.goals.id, id)).run();
    return { ok: true };
  });
}
