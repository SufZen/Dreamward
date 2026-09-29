import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { updateContentBlockSchema } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { nowMs } from '../lib/id';

export default async function contentBlockRoutes(app: FastifyInstance) {
  app.get('/content-blocks', async (req) => {
    const { group } = req.query as { group?: string };
    const db = getDb();
    const rows = db.select().from(schema.contentBlocks).orderBy(asc(schema.contentBlocks.sortOrder)).all();
    return group ? rows.filter((r) => r.group === group) : rows;
  });

  app.get('/content-blocks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.select().from(schema.contentBlocks).where(eq(schema.contentBlocks.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return row;
  });

  app.put('/content-blocks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateContentBlockSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });

    const db = getDb();
    const updatedAt = nowMs();
    const patch: Record<string, unknown> = { updatedAt };
    if (parsed.data.content !== undefined) patch.content = parsed.data.content;
    if (parsed.data.bodyRichtext !== undefined) patch.bodyRichtext = parsed.data.bodyRichtext;

    const res = db.update(schema.contentBlocks).set(patch).where(eq(schema.contentBlocks.id, id)).run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    return { ok: true, updatedAt };
  });
}
