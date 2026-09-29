/* ============================================================================
 * apps/api — db/seed.ts
 * Idempotent seed: creates the data-driven Dreamward structure (categories,
 * section types, sections, content blocks, life-vision prompts), then merges
 * imported content from SEED_IMPORT_FILE (a content JSON) if it is set.
 * Re-running is safe (upsert by stable id).
 * ========================================================================= */
import { sql } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STANDARD_SECTIONS, QOL_EXTRA_SECTIONS } from '@dreamward/shared';
import { activeFramework } from '../lib/framework';
import { getDb, schema } from './client';
import { applyImport } from './applyImport';

/** Deterministic section id keeps seeding idempotent. */
const sectionId = (categoryId: string, type: string) => `${categoryId}:${type}`;

function defaultSectionContent(type: string): Record<string, unknown> {
  if (type === 'strategy') return { habits: [], leverages: [] };
  if (type === 'identity') return { statement: '', states: [], standards: [], beliefShifts: [] };
  if (type === 'vision' || type === 'purpose') return {};
  return { items: [] };
}

/** Structural seed for ONE user DB — must run inside runWithDbContext(). */
export function seedStructure() {
  const db = getDb();
  // Wording comes from the active framework pack and is re-applied every boot
  // (labels only — the person's own content is never touched).
  const { categories: CATEGORIES, sectionTypes: SECTION_TYPES, contentBlocks: CONTENT_BLOCKS, visionPrompts: LIFE_VISION_PROMPTS } =
    activeFramework().structure;

  db.transaction(() => {
    // section types
    for (const t of SECTION_TYPES) {
      db.insert(schema.sectionTypes)
        .values({ id: t.id, labelEn: t.labelEn, labelHe: t.labelHe, shape: t.shape, defaultSort: t.defaultSort })
        .onConflictDoUpdate({
          target: schema.sectionTypes.id,
          set: { labelEn: t.labelEn, labelHe: t.labelHe, shape: t.shape, defaultSort: t.defaultSort },
        })
        .run();
    }

    // categories
    CATEGORIES.forEach((c, idx) => {
      db.insert(schema.categories)
        .values({ id: c.id, labelEn: c.labelEn, labelHe: c.labelHe, icon: c.icon, sortOrder: idx + 1 })
        .onConflictDoUpdate({
          target: schema.categories.id,
          set: { labelEn: c.labelEn, labelHe: c.labelHe, icon: c.icon, sortOrder: idx + 1 },
        })
        .run();

      // standard sections + QoL extras
      const types = c.id === 'quality_of_life' ? [...STANDARD_SECTIONS, ...QOL_EXTRA_SECTIONS] : STANDARD_SECTIONS;
      types.forEach((type, sIdx) => {
        const id = sectionId(c.id, type);
        const existing = db
          .select()
          .from(schema.categorySections)
          .where(sql`${schema.categorySections.id} = ${id}`)
          .get();
        if (!existing) {
          const sortOrder = sIdx + 1;
          // Backfill for existing books: a section type added later (e.g. identity)
          // slots in at its position — push the later sections down one.
          db.update(schema.categorySections)
            .set({ sortOrder: sql`${schema.categorySections.sortOrder} + 1` })
            .where(sql`${schema.categorySections.categoryId} = ${c.id} AND ${schema.categorySections.sortOrder} >= ${sortOrder}`)
            .run();
          db.insert(schema.categorySections)
            .values({ id, categoryId: c.id, sectionType: type, sortOrder, content: defaultSectionContent(type), bodyRichtext: null })
            .run();
        }
      });
    });

    // content blocks
    CONTENT_BLOCKS.forEach((b, idx) => {
      const existing = db.select().from(schema.contentBlocks).where(sql`${schema.contentBlocks.id} = ${b.id}`).get();
      if (!existing) {
        db.insert(schema.contentBlocks)
          .values({
            id: b.id,
            group: b.group,
            labelEn: b.labelEn,
            labelHe: b.labelHe,
            kind: b.kind,
            content: b.kind === 'list' ? { items: [] } : {},
            bodyRichtext: null,
            sortOrder: idx + 1,
          })
          .run();
      } else {
        db.update(schema.contentBlocks)
          .set({ group: b.group, labelEn: b.labelEn, labelHe: b.labelHe, kind: b.kind, sortOrder: idx + 1 })
          .where(sql`${schema.contentBlocks.id} = ${b.id}`)
          .run();
      }
    });

    // life vision prompts
    LIFE_VISION_PROMPTS.forEach((p, idx) => {
      const existing = db
        .select()
        .from(schema.lifeVisionPrompts)
        .where(sql`${schema.lifeVisionPrompts.id} = ${p.id}`)
        .get();
      if (!existing) {
        db.insert(schema.lifeVisionPrompts)
          .values({ id: p.id, question: p.he, answerRichtext: null, sortOrder: idx + 1 })
          .run();
      } else {
        db.update(schema.lifeVisionPrompts)
          .set({ question: p.he, sortOrder: idx + 1 })
          .where(sql`${schema.lifeVisionPrompts.id} = ${p.id}`)
          .run();
      }
    });
  });
}

/** Merge imported content (SEED_IMPORT_FILE, or a legacy scripts/import/out/seed.json) if available. */
function mergeImport() {
  const file = process.env.SEED_IMPORT_FILE ? resolve(process.env.SEED_IMPORT_FILE) : resolve(process.cwd(), 'scripts/import/out/seed.json');
  const alt = resolve(process.cwd(), '../../scripts/import/out/seed.json');
  const path = existsSync(file) ? file : existsSync(alt) ? alt : null;
  if (!path) {
    console.log('[seed] no import output found — structure-only seed');
    return;
  }
  console.log(`[seed] merging import from ${path}`);
  const counts = applyImport(JSON.parse(readFileSync(path, 'utf8')));
  console.log('[seed] import merged', counts);
}

/** Seeds structure + merges import for the CURRENT context's DB. */
export function runSeed() {
  seedStructure();
  mergeImport();
  const db = getDb();
  const counts = {
    categories: db.select().from(schema.categories).all().length,
    sections: db.select().from(schema.categorySections).all().length,
    contentBlocks: db.select().from(schema.contentBlocks).all().length,
    lifeVision: db.select().from(schema.lifeVisionPrompts).all().length,
  };
  console.log('[seed] done', counts);
  return counts;
}

// CLI: seeds the ADMIN user's dreamward (creating the admin account if needed).
const isMain = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMain) {
  (async () => {
    const { loadEnv } = await import('../env');
    const { resolveDataDir } = await import('../lib/paths');
    const { openControlDb, ensureAdminUser } = await import('./control');
    const { migrateLegacyLayout } = await import('../scripts/migrate-to-multiuser');
    const { runAsUser } = await import('./registry');
    const env = loadEnv();
    const dataRoot = resolveDataDir(env.DATA_DIR);
    const legacy = migrateLegacyLayout(dataRoot);
    openControlDb(dataRoot);
    const adminId = await ensureAdminUser({ email: env.DREAMWARD_EMAIL, password: env.DREAMWARD_PASSWORD, legacy });
    if (adminId === null) throw new Error('No admin account yet — finish first-run setup (or set DREAMWARD_EMAIL/PASSWORD) before seeding');
    runAsUser(adminId, 'admin', () => runSeed());
    process.exit(0);
  })().catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
}
