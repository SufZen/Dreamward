/* ============================================================================
 * Framework packs — the wording of the book's structure.
 *
 * The engine owns the STRUCTURE (which life areas, sections, blocks and
 * prompts exist, their ids, shapes, icons and order). Ids are stored in every
 * book, so they never change. A framework pack only supplies the WORDS: the
 * labels people see, in English and Hebrew. That keeps methods and their
 * vocabulary separate from the code — a community or a coach can ship their
 * own pack (see docs/framework-packs.md) without touching data or migrations.
 * ========================================================================= */

export const CATEGORY_KEYS = [
  'health_fitness',
  'intellectual',
  'emotional',
  'character',
  'spiritual',
  'love',
  'parenting',
  'social',
  'financial',
  'career',
  'sex',
  'quality_of_life',
] as const;
export type CategoryId = (typeof CATEGORY_KEYS)[number];

export const SECTION_TYPE_KEYS = ['premises', 'vision', 'identity', 'purpose', 'strategy', 'qol_experiences', 'qol_environment', 'qol_materialistic'] as const;
export type SectionTypeId = (typeof SECTION_TYPE_KEYS)[number];

export const CONTENT_BLOCK_KEYS = [
  'cover',
  'gratitude_intro',
  'current_assessments',
  'what_i_want',
  'what_makes_me_happy',
  'impl_effective',
  'impl_funnel',
  'impl_lifestyle',
  'impl_stepping_in',
] as const;
export type ContentBlockId = (typeof CONTENT_BLOCK_KEYS)[number];

export const VISION_PROMPT_KEYS = [
  'dream_home',
  'ideal_day',
  'health_fitness',
  'intellectual',
  'emotions',
  'character',
  'spiritual',
  'ideal_relationship',
  'family',
  'friendships',
  'financial',
  'career',
  'lifestyle',
  'sex',
] as const;
export type LifeVisionPromptId = (typeof VISION_PROMPT_KEYS)[number];

export interface Label {
  en: string;
  he: string;
}

export interface FrameworkPack {
  /** kebab-case id, e.g. `dreamward-default` */
  id: string;
  name: Label;
  description: Label;
  /** SPDX id of the pack's text (packs may be licensed separately from the code). */
  license?: string;
  categories: Record<CategoryId, Label>;
  sectionTypes: Record<SectionTypeId, Label>;
  contentBlocks: Record<ContentBlockId, Label>;
  visionPrompts: Record<LifeVisionPromptId, Label>;
}

/** What a custom pack file may contain: any subset — missing labels fall back to the default pack. */
export interface FrameworkPackOverride {
  id?: string;
  name?: Partial<Label>;
  description?: Partial<Label>;
  license?: string;
  categories?: Partial<Record<CategoryId, Partial<Label>>>;
  sectionTypes?: Partial<Record<SectionTypeId, Partial<Label>>>;
  contentBlocks?: Partial<Record<ContentBlockId, Partial<Label>>>;
  visionPrompts?: Partial<Record<LifeVisionPromptId, Partial<Label>>>;
}
