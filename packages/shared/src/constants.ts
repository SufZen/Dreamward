/* ============================================================================
 * @dreamward/shared — constants.ts
 * Domain constants shared across api, web and agents.
 *
 * The book's STRUCTURE (ids, shapes, icons, order) lives here and is stored in
 * every book. Its WORDING comes from a framework pack (./frameworks) — the
 * default pack, or a custom one the server loads (FRAMEWORK_PACK_FILE).
 * ========================================================================= */
import {
  CATEGORY_KEYS,
  DEFAULT_PACK,
  VISION_PROMPT_KEYS,
  type CategoryId,
  type ContentBlockId,
  type FrameworkPack,
  type SectionTypeId,
} from './frameworks';

export type { CategoryId, ContentBlockId, LifeVisionPromptId, SectionTypeId } from './frameworks';

/** The 12 life areas, in book order. `icon` = lucide-react icon name. */
const CATEGORY_DEFS = [
  { id: 'health_fitness', icon: 'HeartPulse' },
  { id: 'intellectual', icon: 'Brain' },
  { id: 'emotional', icon: 'Heart' },
  { id: 'character', icon: 'Award' },
  { id: 'spiritual', icon: 'Sparkles' },
  { id: 'love', icon: 'HeartHandshake' },
  { id: 'parenting', icon: 'Baby' },
  { id: 'social', icon: 'Users' },
  { id: 'financial', icon: 'Coins' },
  { id: 'career', icon: 'Briefcase' },
  { id: 'sex', icon: 'Flame' },
  { id: 'quality_of_life', icon: 'Sun' },
] as const satisfies readonly { id: CategoryId; icon: string }[];

/** Section shapes drive how the UI renders + edits a section. */
export const SECTION_SHAPES = ['list', 'statement', 'rich', 'composite', 'identity'] as const;
export type SectionShape = (typeof SECTION_SHAPES)[number];

/** Section types (the repeating per-area structure + quality-of-life extras). */
const SECTION_TYPE_DEFS = [
  { id: 'premises', shape: 'list', defaultSort: 1 },
  { id: 'vision', shape: 'statement', defaultSort: 2 },
  // Who I am when I live this vision: statement, desired states, standards, belief shifts.
  { id: 'identity', shape: 'identity', defaultSort: 3 },
  { id: 'purpose', shape: 'rich', defaultSort: 4 },
  { id: 'strategy', shape: 'composite', defaultSort: 5 },
  { id: 'qol_experiences', shape: 'list', defaultSort: 6 },
  { id: 'qol_environment', shape: 'list', defaultSort: 7 },
  { id: 'qol_materialistic', shape: 'list', defaultSort: 8 },
] as const satisfies readonly { id: SectionTypeId; shape: SectionShape; defaultSort: number }[];

/** Which section types each area gets at seed time. */
export const STANDARD_SECTIONS: SectionTypeId[] = ['premises', 'vision', 'identity', 'purpose', 'strategy'];
export const QOL_EXTRA_SECTIONS: SectionTypeId[] = ['qol_experiences', 'qol_environment', 'qol_materialistic'];

/** Front-matter + implementation singleton blocks. */
const CONTENT_BLOCK_DEFS = [
  { id: 'cover', group: 'front_matter', kind: 'rich' },
  { id: 'gratitude_intro', group: 'front_matter', kind: 'rich' },
  { id: 'current_assessments', group: 'front_matter', kind: 'list' },
  { id: 'what_i_want', group: 'front_matter', kind: 'rich' },
  { id: 'what_makes_me_happy', group: 'front_matter', kind: 'rich' },
  { id: 'impl_effective', group: 'implementation', kind: 'rich' },
  { id: 'impl_funnel', group: 'implementation', kind: 'rich' },
  { id: 'impl_lifestyle', group: 'implementation', kind: 'rich' },
  { id: 'impl_stepping_in', group: 'implementation', kind: 'rich' },
] as const satisfies readonly { id: ContentBlockId; group: string; kind: 'rich' | 'list' }[];

/** The full structure with the wording of `pack`. */
export function structureFor(pack: FrameworkPack) {
  return {
    categories: CATEGORY_DEFS.map((d) => ({ ...d, labelEn: pack.categories[d.id].en, labelHe: pack.categories[d.id].he })),
    sectionTypes: SECTION_TYPE_DEFS.map((d) => ({ ...d, labelEn: pack.sectionTypes[d.id].en, labelHe: pack.sectionTypes[d.id].he })),
    contentBlocks: CONTENT_BLOCK_DEFS.map((d) => ({ ...d, labelEn: pack.contentBlocks[d.id].en, labelHe: pack.contentBlocks[d.id].he })),
    visionPrompts: VISION_PROMPT_KEYS.map((id) => ({ id, en: pack.visionPrompts[id].en, he: pack.visionPrompts[id].he })),
  };
}
export type BookStructure = ReturnType<typeof structureFor>;

const DEFAULT_STRUCTURE = structureFor(DEFAULT_PACK);

/** Default-pack wording. Servers may use another pack — prefer labels from the API in UIs. */
export const CATEGORIES = DEFAULT_STRUCTURE.categories;
export const CATEGORY_IDS = [...CATEGORY_KEYS] as CategoryId[];
export const SECTION_TYPES = DEFAULT_STRUCTURE.sectionTypes;
export const CONTENT_BLOCKS = DEFAULT_STRUCTURE.contentBlocks;
/** The reflective vision prompts. */
export const LIFE_VISION_PROMPTS = DEFAULT_STRUCTURE.visionPrompts;

/** Goal / measurement statuses. */
export const GOAL_STATUSES = ['achieved', 'partial', 'not_achieved', 'not_relevant'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** Action priorities. */
export const ACTION_PRIORITIES = ['low', 'medium', 'high'] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

/** Entity kinds an action can link to (or none — standalone). */
export const ACTION_LINK_TYPES = ['goal', 'section', 'content_block', 'life_vision', 'ikigai'] as const;
export type ActionLinkType = (typeof ACTION_LINK_TYPES)[number];

/** Who created an entity (provenance). */
export const CREATED_BY = ['user', 'agent', 'api'] as const;
export type CreatedBy = (typeof CREATED_BY)[number];

/** Goal progress risk levels (computed rollups). */
export const GOAL_RISKS = ['on_track', 'stalled', 'at_risk'] as const;
export type GoalRisk = (typeof GOAL_RISKS)[number];
/** A goal is `stalled` when it has open actions but none completed within this window. */
export const STALLED_AFTER_DAYS = 14;
/** A goal is `at_risk` when targetDate is within this window and progress < 50%. */
export const AT_RISK_WINDOW_DAYS = 30;

/** Current Life Chapter — the season that decides what matters now. */
export const MAX_FOCUS_AREAS = 5;
/** Default length of a chapter before its review date (days). */
export const CHAPTER_DEFAULT_DAYS = 90;

/** Life-wheel rating scale: "how close is today to my vision" (1-10). */
export const RATING_MIN = 1;
export const RATING_MAX = 10;

/** Autonomous agent routines ("the reality engine"). */
export const ROUTINE_KINDS = ['daily_plan', 'weekly_review_prep', 'goal_drift'] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

/** Moodboard themes. */
export const MOODBOARD_THEMES = [
  'experiences',
  'environment',
  'materialistic',
  'category_list',
  'vision_statements',
  'other',
] as const;
export type MoodboardTheme = (typeof MOODBOARD_THEMES)[number];

/** Default design canvas for a moodboard (logical units). */
export const DEFAULT_CANVAS = { width: 1920, height: 1080 } as const;

/** Export formats: aspect ratios for different screens. */
export const EXPORT_FORMATS = [
  { id: 'desktop', labelEn: 'Desktop', labelHe: 'מחשב', width: 1920, height: 1080 },
  { id: 'phone', labelEn: 'Phone', labelHe: 'טלפון', width: 1080, height: 1920 },
  { id: 'square', labelEn: 'Square', labelHe: 'ריבוע', width: 1080, height: 1080 },
  { id: 'tablet', labelEn: 'Tablet', labelHe: 'טאבלט', width: 2048, height: 1536 },
] as const;

export type ExportFormatId = (typeof EXPORT_FORMATS)[number]['id'];
