/* ============================================================================
 * apps/api — db/applyImport.ts
 * Merges imported content (SEED_IMPORT_FILE, see seed.ts) into the DB. Idempotent and edit-safe:
 * imported content only fills targets that are still empty, so re-running
 * after a parser fix never clobbers in-app edits.
 * ========================================================================= */
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from './client';

interface SeedFile {
  blocks: { id: string; content?: unknown; bodyRichtext?: string }[];
  sections: { categoryId: string; sectionType: string; content?: unknown; bodyRichtext?: string }[];
  lifeVision: { id: string; answerRichtext: string }[];
  assets: {
    id: string;
    originalPath: string;
    webPath: string;
    thumbPath: string;
    mime: string;
    width: number;
    height: number;
    bytes: number;
    source: string;
    alt: string | null;
  }[];
  boards: {
    id: string;
    title: string;
    theme: string;
    visionStatement: string | null;
    sortOrder: number;
    items: { id: string; assetId: string; x: number; y: number; width: number; height: number; zIndex: number }[];
  }[];
  journalEntries: { id: string; title: string; bodyRichtext: string }[];
}

const hasListContent = (c: unknown): boolean => {
  if (!c || typeof c !== 'object') return false;
  const o = c as { items?: unknown[]; habits?: unknown[]; leverages?: unknown[] };
  return (o.items?.length ?? 0) > 0 || (o.habits?.length ?? 0) > 0 || (o.leverages?.length ?? 0) > 0;
};

export function applyImport(seed: SeedFile): Record<string, number> {
  const db = getDb();
  const counts = { blocks: 0, sections: 0, lifeVision: 0, assets: 0, boards: 0, items: 0, journal: 0, skipped: 0 };
  const ts = Date.now();

  db.transaction((tx) => {
    // content blocks — fill only if empty
    for (const b of seed.blocks ?? []) {
      const row = tx.select().from(schema.contentBlocks).where(eq(schema.contentBlocks.id, b.id)).get();
      if (!row) continue;
      const empty = !row.bodyRichtext && !hasListContent(row.content);
      if (!empty) {
        counts.skipped++;
        continue;
      }
      tx.update(schema.contentBlocks)
        .set({
          content: b.content !== undefined ? b.content : row.content,
          bodyRichtext: b.bodyRichtext ?? row.bodyRichtext,
          updatedAt: ts,
        })
        .where(eq(schema.contentBlocks.id, b.id))
        .run();
      counts.blocks++;
    }

    // category sections — fill only if empty
    for (const s of seed.sections ?? []) {
      const row = tx
        .select()
        .from(schema.categorySections)
        .where(
          and(
            eq(schema.categorySections.categoryId, s.categoryId),
            eq(schema.categorySections.sectionType, s.sectionType),
          ),
        )
        .get();
      if (!row) continue;
      const empty = !row.bodyRichtext && !hasListContent(row.content);
      if (!empty) {
        counts.skipped++;
        continue;
      }
      tx.update(schema.categorySections)
        .set({
          content: s.content !== undefined ? s.content : row.content,
          bodyRichtext: s.bodyRichtext ?? row.bodyRichtext,
          updatedAt: ts,
        })
        .where(eq(schema.categorySections.id, row.id))
        .run();
      counts.sections++;
    }

    // life vision answers — fill only if empty
    for (const v of seed.lifeVision ?? []) {
      const row = tx.select().from(schema.lifeVisionPrompts).where(eq(schema.lifeVisionPrompts.id, v.id)).get();
      if (!row) continue;
      if (row.answerRichtext) {
        counts.skipped++;
        continue;
      }
      tx.update(schema.lifeVisionPrompts)
        .set({ answerRichtext: v.answerRichtext, updatedAt: ts })
        .where(eq(schema.lifeVisionPrompts.id, v.id))
        .run();
      counts.lifeVision++;
    }

    // assets — upsert by id (paths/dimensions may improve between runs)
    for (const a of seed.assets ?? []) {
      const existing = tx.select().from(schema.assets).where(eq(schema.assets.id, a.id)).get();
      if (existing) {
        tx.update(schema.assets)
          .set({
            originalPath: a.originalPath,
            webPath: a.webPath,
            thumbPath: a.thumbPath,
            mime: a.mime,
            width: a.width,
            height: a.height,
            bytes: a.bytes,
          })
          .where(eq(schema.assets.id, a.id))
          .run();
      } else {
        tx.insert(schema.assets)
          .values({ ...a, source: a.source as 'pptx_import' | 'upload', createdAt: ts })
          .run();
      }
      counts.assets++;
    }

    // moodboards + items — create board if missing; place items only when the
    // board has none yet (preserves in-app canvas edits)
    for (const b of seed.boards ?? []) {
      const existing = tx.select().from(schema.moodboards).where(eq(schema.moodboards.id, b.id)).get();
      if (!existing) {
        tx.insert(schema.moodboards)
          .values({
            id: b.id,
            title: b.title,
            theme: b.theme,
            visionStatement: b.visionStatement,
            canvasWidth: 1920,
            canvasHeight: 1080,
            background: { color: '#0a0a0f' },
            sortOrder: b.sortOrder,
            createdAt: ts,
            updatedAt: ts,
          })
          .run();
        counts.boards++;
      }
      const itemCount = tx
        .select()
        .from(schema.moodboardItems)
        .where(eq(schema.moodboardItems.moodboardId, b.id))
        .all().length;
      if (itemCount === 0) {
        for (const it of b.items) {
          tx.insert(schema.moodboardItems)
            .values({
              id: it.id,
              moodboardId: b.id,
              assetId: it.assetId,
              x: it.x,
              y: it.y,
              width: it.width,
              height: it.height,
              rotation: 0,
              zIndex: it.zIndex,
              crop: { x: 0, y: 0, w: 1, h: 1 },
              cornerRadius: 0,
              opacity: 1,
              createdAt: ts,
              updatedAt: ts,
            })
            .run();
          counts.items++;
        }
      } else {
        counts.skipped++;
      }
    }

    // journal entries from import — insert once
    for (const j of seed.journalEntries ?? []) {
      const existing = tx.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, j.id)).get();
      if (existing) {
        counts.skipped++;
        continue;
      }
      tx.insert(schema.journalEntries)
        .values({ id: j.id, entryDate: ts, title: j.title, bodyRichtext: j.bodyRichtext, createdAt: ts, updatedAt: ts })
        .run();
      counts.journal++;
    }
  });

  return counts;
}
