import type { FastifyInstance } from 'fastify';
import { asc, desc, eq } from 'drizzle-orm';
import { createSnapshotSchema } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import { getActiveChapter, getCurrentIkigai, latestRatings } from '../services/meaning';

/** Serialize the full Dreamward + goals state into a portable JSON payload. */
function capturePayload() {
  const db = getDb();
  return {
    categories: db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder)).all(),
    sections: db.select().from(schema.categorySections).all(),
    contentBlocks: db.select().from(schema.contentBlocks).all(),
    lifeVision: db.select().from(schema.lifeVisionPrompts).all(),
    goals: db.select().from(schema.goals).all(),
    // meaning & focus layer (v0.4)
    chapter: getActiveChapter(),
    ratings: latestRatings(),
    ikigai: getCurrentIkigai(),
  };
}

export default async function snapshotRoutes(app: FastifyInstance) {
  app.get('/snapshots', async () => {
    const db = getDb();
    return db
      .select({ id: schema.snapshots.id, label: schema.snapshots.label, createdAt: schema.snapshots.createdAt })
      .from(schema.snapshots)
      .orderBy(desc(schema.snapshots.createdAt))
      .all();
  });

  app.post('/snapshots', async (req, reply) => {
    const parsed = createSnapshotSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const id = uuid();
    db.insert(schema.snapshots).values({ id, label: parsed.data.label, payload: capturePayload(), createdAt: nowMs() }).run();
    return { id };
  });

  app.get('/snapshots/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.select().from(schema.snapshots).where(eq(schema.snapshots.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return row;
  });

  // Diff a snapshot vs current state (shallow: returns both for client-side diffing).
  app.get('/snapshots/:id/diff', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.select().from(schema.snapshots).where(eq(schema.snapshots.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return { snapshot: row.payload, current: capturePayload() };
  });
}
