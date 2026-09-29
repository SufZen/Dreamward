import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { updateLifeVisionSchema } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { nowMs } from '../lib/id';
import { activeFramework } from '../lib/framework';

export default async function lifeVisionRoutes(app: FastifyInstance) {
  app.get('/life-vision', async () => {
    const db = getDb();
    const labels = new Map<string, { en: string; he: string }>(activeFramework().structure.visionPrompts.map((p) => [p.id, p]));
    return db
      .select()
      .from(schema.lifeVisionPrompts)
      .orderBy(asc(schema.lifeVisionPrompts.sortOrder))
      .all()
      .map((p) => ({ ...p, labelEn: labels.get(p.id)?.en ?? p.question, labelHe: labels.get(p.id)?.he ?? p.question }));
  });

  app.put('/life-vision/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateLifeVisionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });

    const db = getDb();
    const updatedAt = nowMs();
    const res = db
      .update(schema.lifeVisionPrompts)
      .set({ answerRichtext: parsed.data.answerRichtext, updatedAt })
      .where(eq(schema.lifeVisionPrompts.id, id))
      .run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    return { ok: true, updatedAt };
  });
}
