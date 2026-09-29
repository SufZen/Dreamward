import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { updateSectionSchema, reorderSchema } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { nowMs } from '../lib/id';

export default async function categoryRoutes(app: FastifyInstance) {
  app.get('/categories', async () => {
    const db = getDb();
    return db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder)).all();
  });

  app.get('/categories/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const category = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
    if (!category) return reply.code(404).send({ error: 'not_found' });

    const sectionsRaw = db
      .select()
      .from(schema.categorySections)
      .where(eq(schema.categorySections.categoryId, id))
      .orderBy(asc(schema.categorySections.sortOrder))
      .all();

    // join shape from section_types
    const types = db.select().from(schema.sectionTypes).all();
    const typeById = new Map(types.map((t) => [t.id, t]));
    const sections = sectionsRaw.map((s) => {
      const t = typeById.get(s.sectionType);
      return { ...s, shape: t?.shape ?? 'rich', labelEn: t?.labelEn ?? s.sectionType, labelHe: t?.labelHe ?? s.sectionType };
    });

    return { ...category, sections };
  });

  app.get('/categories/:id/sections', async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    return db
      .select()
      .from(schema.categorySections)
      .where(eq(schema.categorySections.categoryId, id))
      .orderBy(asc(schema.categorySections.sortOrder))
      .all();
  });

  // Autosave a single section.
  app.put('/sections/:sectionId', async (req, reply) => {
    const { sectionId } = req.params as { sectionId: string };
    const parsed = updateSectionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });

    const db = getDb();
    const updatedAt = nowMs();
    const patch: Record<string, unknown> = { updatedAt };
    if (parsed.data.content !== undefined) patch.content = parsed.data.content;
    if (parsed.data.bodyRichtext !== undefined) patch.bodyRichtext = parsed.data.bodyRichtext;
    if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder;

    const res = db
      .update(schema.categorySections)
      .set(patch)
      .where(eq(schema.categorySections.id, sectionId))
      .run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    return { ok: true, updatedAt };
  });

  // Reorder all sections of a category.
  app.patch('/categories/:id/sections/reorder', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });

    const db = getDb();
    db.transaction((tx) => {
      parsed.data.order.forEach((sectionId, idx) => {
        tx.update(schema.categorySections)
          .set({ sortOrder: idx, updatedAt: nowMs() })
          .where(eq(schema.categorySections.id, sectionId))
          .run();
      });
    });
    void id;
    return { ok: true };
  });
}
