/* ============================================================================
 * apps/api — lib/framework.ts
 * The active framework pack: the default wording, or a custom pack loaded from
 * FRAMEWORK_PACK_FILE (a JSON file with any subset of labels — see
 * docs/framework-packs.md). Validated once at boot; invalid packs stop the
 * server with a clear message instead of half-applying.
 * ========================================================================= */
import { readFileSync } from 'node:fs';
import { DEFAULT_PACK, frameworkPackOverrideSchema, mergePack, structureFor, type BookStructure, type FrameworkPack } from '@dreamward/shared';

let cached: { pack: FrameworkPack; structure: BookStructure } | null = null;

export function activeFramework(): { pack: FrameworkPack; structure: BookStructure } {
  if (cached) return cached;
  const file = process.env.FRAMEWORK_PACK_FILE;
  let pack = DEFAULT_PACK;
  if (file) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`FRAMEWORK_PACK_FILE ${file} could not be read as JSON: ${(err as Error).message}`);
    }
    const parsed = frameworkPackOverrideSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`FRAMEWORK_PACK_FILE ${file} is not a valid framework pack:\n${issues}`);
    }
    pack = mergePack(parsed.data);
  }
  cached = { pack, structure: structureFor(pack) };
  return cached;
}

/** Tests only. */
export function resetFrameworkCache(): void {
  cached = null;
}

/** Label of a life area in the active pack (falls back to the id). */
export function categoryLabel(id: string, lang: 'en' | 'he' = 'he'): string {
  const c = activeFramework().structure.categories.find((x) => x.id === id);
  return c ? (lang === 'he' ? c.labelHe : c.labelEn) : id;
}
