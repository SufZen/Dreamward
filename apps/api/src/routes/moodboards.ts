import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import {
  createMoodboardSchema,
  updateMoodboardSchema,
  putItemsSchema,
  DEFAULT_CANVAS,
} from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';

export default async function moodboardRoutes(app: FastifyInstance) {
  app.get('/moodboards', async () => {
    const db = getDb();
    const boards = db.select().from(schema.moodboards).orderBy(asc(schema.moodboards.sortOrder)).all();
    // attach a cover thumb (first item's asset)
    return boards.map((b) => {
      const first = db
        .select()
        .from(schema.moodboardItems)
        .where(eq(schema.moodboardItems.moodboardId, b.id))
        .orderBy(asc(schema.moodboardItems.zIndex))
        .limit(1)
        .get();
      let cover: string | null = null;
      if (first) {
        const asset = db.select().from(schema.assets).where(eq(schema.assets.id, first.assetId)).get();
        cover = asset?.thumbPath ?? null;
      }
      return { ...b, cover };
    });
  });

  app.post('/moodboards', async (req, reply) => {
    const parsed = createMoodboardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const id = uuid();
    const ts = nowMs();
    const count = db.select().from(schema.moodboards).all().length;
    db.insert(schema.moodboards)
      .values({
        id,
        title: parsed.data.title,
        theme: parsed.data.theme ?? null,
        categoryId: parsed.data.categoryId ?? null,
        canvasWidth: parsed.data.canvasWidth ?? DEFAULT_CANVAS.width,
        canvasHeight: parsed.data.canvasHeight ?? DEFAULT_CANVAS.height,
        background: { color: '#0a0a0f' },
        sortOrder: count,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
    return db.select().from(schema.moodboards).where(eq(schema.moodboards.id, id)).get();
  });

  app.get('/moodboards/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const board = db.select().from(schema.moodboards).where(eq(schema.moodboards.id, id)).get();
    if (!board) return reply.code(404).send({ error: 'not_found' });
    const items = db
      .select()
      .from(schema.moodboardItems)
      .where(eq(schema.moodboardItems.moodboardId, id))
      .orderBy(asc(schema.moodboardItems.zIndex))
      .all();
    const textItems = db
      .select()
      .from(schema.moodboardTextItems)
      .where(eq(schema.moodboardTextItems.moodboardId, id))
      .all();
    return { ...board, items, textItems };
  });

  app.put('/moodboards/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateMoodboardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const res = db
      .update(schema.moodboards)
      .set({ ...parsed.data, updatedAt: nowMs() })
      .where(eq(schema.moodboards.id, id))
      .run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    return db.select().from(schema.moodboards).where(eq(schema.moodboards.id, id)).get();
  });

  app.delete('/moodboards/:id', async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    db.delete(schema.moodboards).where(eq(schema.moodboards.id, id)).run();
    return { ok: true };
  });

  // Bulk autosave the whole canvas item set.
  app.put('/moodboards/:id/items', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = putItemsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const ts = nowMs();
    db.transaction((tx) => {
      tx.delete(schema.moodboardItems).where(eq(schema.moodboardItems.moodboardId, id)).run();
      for (const it of parsed.data.items) {
        tx.insert(schema.moodboardItems)
          .values({
            id: it.id || uuid(),
            moodboardId: id,
            assetId: it.assetId,
            x: it.x,
            y: it.y,
            width: it.width,
            height: it.height,
            rotation: it.rotation ?? 0,
            zIndex: it.zIndex ?? 0,
            crop: it.crop ?? { x: 0, y: 0, w: 1, h: 1 },
            cornerRadius: it.cornerRadius ?? 0,
            opacity: it.opacity ?? 1,
            createdAt: ts,
            updatedAt: ts,
          })
          .run();
      }
      tx.update(schema.moodboards).set({ updatedAt: ts }).where(eq(schema.moodboards.id, id)).run();
    });
    return { ok: true, updatedAt: ts };
  });
}
