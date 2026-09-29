import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { getDb, getUserDataRoot, schema } from '../db/client';
import { assetsDir } from '../lib/paths';
import { uuid, nowMs } from '../lib/id';
import { processImage } from '../lib/images';

/** Removes an asset's files from disk: original + its derived/<id>/ directory. */
async function unlinkAssetFiles(userRoot: string, row: typeof schema.assets.$inferSelect): Promise<void> {
  const root = assetsDir(userRoot);
  const original = join(root, row.originalPath);
  // derived files live under derived/<id>/… — remove the whole per-asset dir
  const derivedDir = row.thumbPath.includes('/') ? join(root, dirname(row.thumbPath)) : null;
  await Promise.allSettled([
    rm(original, { force: true }),
    derivedDir ? rm(derivedDir, { recursive: true, force: true }) : Promise.resolve(),
  ]);
}

export default async function assetRoutes(app: FastifyInstance) {
  app.get('/assets', async (req) => {
    const { source } = req.query as { source?: string };
    const db = getDb();
    let rows = db.select().from(schema.assets).orderBy(desc(schema.assets.createdAt)).all();
    if (source) rows = rows.filter((r) => r.source === source);

    // fold in "used in N moodboards" (distinct boards per asset)
    const usage = db
      .select({
        assetId: schema.moodboardItems.assetId,
        n: sql<number>`COUNT(DISTINCT ${schema.moodboardItems.moodboardId})`,
      })
      .from(schema.moodboardItems)
      .groupBy(schema.moodboardItems.assetId)
      .all();
    const usedBy = new Map(usage.map((u) => [u.assetId, u.n]));
    return rows.map((r) => ({ ...r, usedIn: usedBy.get(r.id) ?? 0 }));
  });

  app.post('/assets', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'no_file' });
    if (!file.mimetype?.startsWith('image/')) return reply.code(415).send({ error: 'unsupported_type' });
    const buffer = await file.toBuffer();
    const ext = (file.filename.split('.').pop() ?? 'jpg').toLowerCase();
    const id = uuid();
    const processed = await processImage(getUserDataRoot(), id, buffer, ext);
    const ts = nowMs();
    const db = getDb();
    db.insert(schema.assets)
      .values({
        id,
        originalPath: processed.originalPath,
        webPath: processed.webPath,
        thumbPath: processed.thumbPath,
        mime: processed.mime,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        source: 'upload',
        alt: null,
        createdAt: ts,
      })
      .run();
    const row = db.select().from(schema.assets).where(eq(schema.assets.id, id)).get()!;
    return { ...row, usedIn: 0 };
  });

  app.delete('/assets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { force } = req.query as { force?: string };
    const db = getDb();
    const row = db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });

    // which moodboards reference it?
    const boards = db
      .select({ id: schema.moodboards.id, title: schema.moodboards.title })
      .from(schema.moodboardItems)
      .innerJoin(schema.moodboards, eq(schema.moodboardItems.moodboardId, schema.moodboards.id))
      .where(eq(schema.moodboardItems.assetId, id))
      .groupBy(schema.moodboards.id)
      .all();

    if (boards.length > 0 && force !== 'true') {
      return reply.code(409).send({ error: 'in_use', boards });
    }

    // DB first (transaction): detach board items if forcing, then drop the row.
    db.transaction((tx) => {
      if (boards.length > 0) {
        tx.delete(schema.moodboardItems).where(eq(schema.moodboardItems.assetId, id)).run();
      }
      tx.delete(schema.assets).where(eq(schema.assets.id, id)).run();
    });

    // Files second — orphaned files (on crash) are harmless and GC-able.
    await unlinkAssetFiles(getUserDataRoot(), row);
    return { ok: true, detachedFrom: boards.length };
  });
}
