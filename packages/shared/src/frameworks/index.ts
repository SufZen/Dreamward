/* Framework packs: merge a (partial) custom pack over the default one. */
import { z } from 'zod';
import { DEFAULT_PACK } from './default';
import {
  CATEGORY_KEYS,
  CONTENT_BLOCK_KEYS,
  SECTION_TYPE_KEYS,
  VISION_PROMPT_KEYS,
  type FrameworkPack,
  type FrameworkPackOverride,
  type Label,
} from './types';

export * from './types';
export { DEFAULT_PACK } from './default';

const label = z.object({ en: z.string().min(1).max(200).optional(), he: z.string().min(1).max(200).optional() }).strict();
const labels = <K extends readonly [string, ...string[]]>(keys: K) =>
  z.record(z.enum(keys), label).optional();

/** Validates a custom pack file. Unknown ids are rejected (ids are stored in every book). */
export const frameworkPackOverrideSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/).optional(),
    name: label.optional(),
    description: z.object({ en: z.string().max(1000).optional(), he: z.string().max(1000).optional() }).strict().optional(),
    license: z.string().max(100).optional(),
    categories: labels(CATEGORY_KEYS),
    sectionTypes: labels(SECTION_TYPE_KEYS),
    contentBlocks: labels(CONTENT_BLOCK_KEYS),
    visionPrompts: labels(VISION_PROMPT_KEYS),
  })
  .strict();

function mergeLabels<K extends string>(base: Record<K, Label>, over?: Partial<Record<K, Partial<Label>>>): Record<K, Label> {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {}) as [K, Partial<Label> | undefined][]) {
    if (v) out[k] = { en: v.en ?? base[k].en, he: v.he ?? base[k].he };
  }
  return out;
}

export function mergePack(over: FrameworkPackOverride, base: FrameworkPack = DEFAULT_PACK): FrameworkPack {
  return {
    id: over.id ?? `${base.id}+custom`,
    name: { en: over.name?.en ?? base.name.en, he: over.name?.he ?? base.name.he },
    description: { en: over.description?.en ?? base.description.en, he: over.description?.he ?? base.description.he },
    license: over.license ?? base.license,
    categories: mergeLabels(base.categories, over.categories),
    sectionTypes: mergeLabels(base.sectionTypes, over.sectionTypes),
    contentBlocks: mergeLabels(base.contentBlocks, over.contentBlocks),
    visionPrompts: mergeLabels(base.visionPrompts, over.visionPrompts),
  };
}
