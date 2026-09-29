/* ============================================================================
 * apps/api — routes/actions.ts
 * Full CRUD for actions: granular next steps, optionally linked to any
 * dreamward entity (goal / section / content block / life-vision prompt).
 * Deletes are soft (deleted_at) — every read filters them out.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { asc, eq, and, isNull } from 'drizzle-orm';
import { createActionSchema, updateActionSchema, reorderSchema } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { nowMs } from '../lib/id';
import { createAction, updateAction, deleteAction } from '../services/mutations';

export default async function actionRoutes(app: FastifyInstance) {
  app.get('/actions', async (req) => {
    const q = req.query as {
      status?: string;
      priority?: string;
      linked_type?: string;
      linked_id?: string;
      goal_id?: string;
    };
    const db = getDb();
    let rows = db
      .select()
      .from(schema.actions)
      .where(isNull(schema.actions.deletedAt))
      .orderBy(asc(schema.actions.sortOrder))
      .all();
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    if (q.priority) rows = rows.filter((r) => r.priority === q.priority);
    if (q.linked_type) rows = rows.filter((r) => r.linkedType === q.linked_type);
    if (q.linked_id) rows = rows.filter((r) => r.linkedId === q.linked_id);
    if (q.goal_id) rows = rows.filter((r) => r.goalId === q.goal_id);
    return rows;
  });

  app.post('/actions', async (req, reply) => {
    const parsed = createActionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      // req.apiKey is set by the /api/v1 bearer-auth plugin (absent on cookie auth).
      const viaApiKey = Boolean((req as { apiKey?: unknown }).apiKey);
      const id = createAction({ ...parsed.data, createdBy: viaApiKey ? 'api' : 'user' });
      return db_get(id);
    } catch (err) {
      return reply.code(422).send({ error: err instanceof Error ? err.message : 'invalid' });
    }
  });

  // Must be declared before /actions/:id so 'reorder' isn't captured as an id.
  app.patch('/actions/reorder', async (req, reply) => {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const ts = nowMs();
    db.transaction((tx) => {
      parsed.data.order.forEach((actionId, idx) => {
        tx.update(schema.actions)
          .set({ sortOrder: idx, updatedAt: ts })
          .where(eq(schema.actions.id, actionId))
          .run();
      });
    });
    return { ok: true };
  });

  app.patch('/actions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateActionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      updateAction({ actionId: id, ...parsed.data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'invalid';
      return reply.code(msg.includes('not found') ? 404 : 422).send({ error: msg });
    }
    return db_get(id);
  });

  app.delete('/actions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      deleteAction({ actionId: id });
    } catch {
      return reply.code(404).send({ error: 'not_found' });
    }
    return { ok: true };
  });
}

function db_get(id: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.actions)
    .where(and(eq(schema.actions.id, id), isNull(schema.actions.deletedAt)))
    .get();
}
