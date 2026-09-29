/* ============================================================================
 * @dreamward/shared — schemas.ts
 * Zod schemas = the single source of truth for the API contract.
 * Imported by api (validation) and web (typed client).
 * ========================================================================= */
import { z } from 'zod';
import {
  ACTION_LINK_TYPES,
  ACTION_PRIORITIES,
  CREATED_BY,
  GOAL_RISKS,
  GOAL_STATUSES,
  MAX_FOCUS_AREAS,
  MOODBOARD_THEMES,
  RATING_MAX,
  RATING_MIN,
  SECTION_SHAPES,
} from './constants';
import { IKIGAI_CIRCLE_IDS } from './ikigai';

/* ── Reusable list item (premises / habits / leverages / generic lists) ──── */
export const listItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  order: z.number().int(),
});
export type ListItem = z.infer<typeof listItemSchema>;

/* ── Section content, discriminated by shape ─────────────────────────────── */
export const listContentSchema = z.object({ items: z.array(listItemSchema) });
export const statementContentSchema = z.object({}).passthrough(); // prose lives in body_richtext
export const purposeContentSchema = z.object({
  quote: z.string().optional(),
  quoteAuthor: z.string().optional(),
});
export const strategyContentSchema = z.object({
  habits: z.array(listItemSchema),
  leverages: z.array(listItemSchema),
});

/** A limiting belief reframed into an empowering one. */
export const beliefShiftSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
});
export type BeliefShift = z.infer<typeof beliefShiftSchema>;

/** Identity: who I am when I live this category's vision. Every field optional
 *  so an empty section is valid and older rows parse. */
export const identityContentSchema = z.object({
  statement: z.string().optional(),
  states: z.array(listItemSchema).optional(),
  standards: z.array(listItemSchema).optional(),
  beliefShifts: z.array(beliefShiftSchema).optional(),
});
export type IdentityContent = z.infer<typeof identityContentSchema>;

export const sectionContentSchema = z.union([
  listContentSchema,
  statementContentSchema,
  purposeContentSchema,
  strategyContentSchema,
  identityContentSchema,
]);
export type SectionContent = z.infer<typeof sectionContentSchema>;

/* ── Category & sections ─────────────────────────────────────────────────── */
export const categorySchema = z.object({
  id: z.string(),
  labelEn: z.string(),
  labelHe: z.string(),
  icon: z.string(),
  sortOrder: z.number().int(),
});

export const categorySectionSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  sectionType: z.string(),
  /** Section title from the server's framework pack. */
  labelEn: z.string().optional(),
  labelHe: z.string().optional(),
  shape: z.enum(SECTION_SHAPES),
  sortOrder: z.number().int(),
  content: z.unknown(), // validated per-shape on write
  bodyRichtext: z.string().nullable(),
  updatedAt: z.number().int(),
});
export type CategorySection = z.infer<typeof categorySectionSchema>;

export const categoryWithSectionsSchema = categorySchema.extend({
  sections: z.array(categorySectionSchema),
});

export const updateSectionSchema = z.object({
  content: z.unknown().optional(),
  bodyRichtext: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  updatedAt: z.number().int().optional(), // client's last-known, for awareness
});

export const reorderSchema = z.object({ order: z.array(z.string()) });

/* ── Content blocks (front matter + implementation) ──────────────────────── */
export const contentBlockSchema = z.object({
  id: z.string(),
  group: z.string(),
  labelEn: z.string(),
  labelHe: z.string(),
  kind: z.enum(['rich', 'list']),
  content: z.unknown(),
  bodyRichtext: z.string().nullable(),
  sortOrder: z.number().int(),
  updatedAt: z.number().int(),
});
export const updateContentBlockSchema = z.object({
  content: z.unknown().optional(),
  bodyRichtext: z.string().nullable().optional(),
});

/* ── Life vision ─────────────────────────────────────────────────────────── */
export const lifeVisionPromptSchema = z.object({
  id: z.string(),
  question: z.string(),
  /** Wording from the server's framework pack. */
  labelEn: z.string().optional(),
  labelHe: z.string().optional(),
  answerRichtext: z.string().nullable(),
  sortOrder: z.number().int(),
  updatedAt: z.number().int(),
});
export const updateLifeVisionSchema = z.object({ answerRichtext: z.string().nullable() });

/* ── Goals ───────────────────────────────────────────────────────────────── */
export const goalSchema = z.object({
  id: z.string(),
  categoryId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(GOAL_STATUSES),
  targetDate: z.number().int().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export const createGoalSchema = z.object({
  categoryId: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  targetDate: z.number().int().nullable().optional(),
});
export const updateGoalSchema = createGoalSchema.partial();
export const updateGoalStatusSchema = z.object({
  status: z.enum(GOAL_STATUSES),
  note: z.string().optional(),
});

/* ── Actions (granular next steps below goals) ───────────────────────────── */
export const actionSchema = z.object({
  id: z.string(),
  goalId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  dueDate: z.number().int().nullable(),
  status: z.enum(['todo', 'done']),
  priority: z.enum(ACTION_PRIORITIES),
  linkedType: z.enum(ACTION_LINK_TYPES).nullable(),
  linkedId: z.string().nullable(),
  createdBy: z.enum(CREATED_BY),
  sourceProposalId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int().nullable(),
  completedAt: z.number().int().nullable(),
});
export type Action = z.infer<typeof actionSchema>;

export const createActionSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  dueDate: z.number().int().nullable().optional(),
  priority: z.enum(ACTION_PRIORITIES).optional(),
  linkedType: z.enum(ACTION_LINK_TYPES).nullable().optional(),
  linkedId: z.string().nullable().optional(),
  /** legacy convenience — equivalent to linkedType 'goal' + linkedId */
  goalId: z.string().nullable().optional(),
});
export const updateActionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.number().int().nullable().optional(),
  status: z.enum(['todo', 'done']).optional(),
  priority: z.enum(ACTION_PRIORITIES).optional(),
  linkedType: z.enum(ACTION_LINK_TYPES).nullable().optional(),
  linkedId: z.string().nullable().optional(),
});

/* ── Goal progress rollup (computed — no storage) ────────────────────────── */
export const goalProgressSchema = z.object({
  goalId: z.string(),
  totalActions: z.number().int(),
  doneActions: z.number().int(),
  /** 0-100; null when the goal has no actions */
  pct: z.number().int().nullable(),
  lastActivityAt: z.number().int().nullable(),
  doneThisWeek: z.number().int(),
  donePrevWeek: z.number().int(),
  risk: z.enum(GOAL_RISKS),
});
export type GoalProgress = z.infer<typeof goalProgressSchema>;

/* ── Current Life Chapter ────────────────────────────────────────────────── */
export const chapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  intention: z.string().nullable(),
  focusCategoryIds: z.array(z.string()),
  maintenanceCategoryIds: z.array(z.string()),
  notNow: z.array(listItemSchema),
  noLongerAcceptable: z.array(listItemSchema),
  startDate: z.number().int(),
  reviewDate: z.number().int().nullable(),
  status: z.enum(['active', 'closed']),
  closingReflection: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  closedAt: z.number().int().nullable(),
});
export type Chapter = z.infer<typeof chapterSchema>;

export const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  intention: z.string().nullable().optional(),
  focusCategoryIds: z.array(z.string()).max(MAX_FOCUS_AREAS).optional(),
  maintenanceCategoryIds: z.array(z.string()).optional(),
  notNow: z.array(listItemSchema).optional(),
  noLongerAcceptable: z.array(listItemSchema).optional(),
  startDate: z.number().int().optional(),
  reviewDate: z.number().int().nullable().optional(),
});
export const updateChapterSchema = createChapterSchema.partial();
export const closeChapterSchema = z.object({ closingReflection: z.string().nullable().optional() });

/* ── Life wheel: per-category "now vs. vision" ratings ───────────────────── */
export const ratingSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  score: z.number().int(),
  reality: z.string().nullable(),
  gap: z.string().nullable(),
  ratedAt: z.number().int(),
});
export type Rating = z.infer<typeof ratingSchema>;

export const createRatingSchema = z.object({
  categoryId: z.string().min(1),
  score: z.number().int().min(RATING_MIN).max(RATING_MAX),
  reality: z.string().max(2000).nullable().optional(),
  gap: z.string().max(2000).nullable().optional(),
});

/** Latest rating per category, with the previous score for the trend. */
export const latestRatingSchema = z.object({
  categoryId: z.string(),
  latest: ratingSchema.nullable(),
  previousScore: z.number().int().nullable(),
  delta: z.number().int().nullable(),
});
export type LatestRating = z.infer<typeof latestRatingSchema>;

/* ── IKIGAI ──────────────────────────────────────────────────────────────── */
export const ikigaiItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(300),
  circles: z.array(z.enum(IKIGAI_CIRCLE_IDS)).min(1),
  source: z.enum(['user', 'lify']).optional(),
});

export const ikigaiProfileSchema = z.object({
  id: z.string(),
  status: z.enum(['draft', 'current', 'archived']),
  items: z.array(ikigaiItemSchema),
  everyday: z.array(listItemSchema),
  statement: z.string().nullable(),
  confidence: z.number().int().nullable(),
  reflections: z.record(z.string()),
  step: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  completedAt: z.number().int().nullable(),
});
export type IkigaiProfile = z.infer<typeof ikigaiProfileSchema>;

export const updateIkigaiSchema = z.object({
  items: z.array(ikigaiItemSchema).max(200).optional(),
  everyday: z.array(listItemSchema).max(100).optional(),
  statement: z.string().max(2000).nullable().optional(),
  confidence: z.number().int().min(1).max(10).nullable().optional(),
  reflections: z.record(z.string().max(4000)).optional(),
  step: z.number().int().min(0).max(20).optional(),
});
export const createIkigaiDraftSchema = z.object({ fromCurrent: z.boolean().optional() });

export const ikigaiSuggestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('circle'), circle: z.enum(IKIGAI_CIRCLE_IDS), profileId: z.string().optional() }),
  z.object({ mode: z.literal('everyday'), profileId: z.string().optional() }),
  z.object({ mode: z.literal('statement'), profileId: z.string() }),
]);
export type IkigaiSuggestRequest = z.infer<typeof ikigaiSuggestSchema>;

/* ── Journal ─────────────────────────────────────────────────────────────── */
export const journalEntrySchema = z.object({
  id: z.string(),
  entryDate: z.number().int(),
  title: z.string().nullable(),
  bodyRichtext: z.string(),
  mood: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export const createJournalSchema = z.object({
  entryDate: z.number().int().optional(),
  title: z.string().nullable().optional(),
  bodyRichtext: z.string().default(''),
  mood: z.string().nullable().optional(),
});
export const updateJournalSchema = createJournalSchema.partial();

/* ── Assets & moodboards ─────────────────────────────────────────────────── */
export const assetSchema = z.object({
  id: z.string(),
  webPath: z.string(),
  thumbPath: z.string(),
  originalPath: z.string(),
  mime: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  bytes: z.number().int(),
  source: z.enum(['pptx_import', 'upload']),
  alt: z.string().nullable(),
  createdAt: z.number().int(),
  /** how many moodboards reference this asset (0 = safe to delete freely) */
  usedIn: z.number().int().optional(),
});

/** 409 body when deleting an asset still used on moodboards (without ?force). */
export const assetInUseSchema = z.object({
  error: z.literal('in_use'),
  boards: z.array(z.object({ id: z.string(), title: z.string() })),
});

export const cropSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

export const moodboardItemSchema = z.object({
  id: z.string(),
  moodboardId: z.string(),
  assetId: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
  zIndex: z.number().int().default(0),
  crop: cropSchema.default({ x: 0, y: 0, w: 1, h: 1 }),
  cornerRadius: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
});
export type MoodboardItem = z.infer<typeof moodboardItemSchema>;

export const moodboardSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: z.enum(MOODBOARD_THEMES).nullable(),
  categoryId: z.string().nullable(),
  canvasWidth: z.number().int(),
  canvasHeight: z.number().int(),
  background: z.unknown(),
  templateId: z.string().nullable(),
  visionStatement: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export const moodboardWithItemsSchema = moodboardSchema.extend({
  items: z.array(moodboardItemSchema),
});
export const createMoodboardSchema = z.object({
  title: z.string().min(1),
  theme: z.enum(MOODBOARD_THEMES).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  canvasWidth: z.number().int().optional(),
  canvasHeight: z.number().int().optional(),
});
export const updateMoodboardSchema = z.object({
  title: z.string().optional(),
  theme: z.enum(MOODBOARD_THEMES).nullable().optional(),
  background: z.unknown().optional(),
  templateId: z.string().nullable().optional(),
  visionStatement: z.string().nullable().optional(),
  canvasWidth: z.number().int().optional(),
  canvasHeight: z.number().int().optional(),
});
/** Bulk autosave of the whole canvas item set (sans server-managed fields). */
export const putItemsSchema = z.object({
  items: z.array(moodboardItemSchema.omit({ moodboardId: true })),
});

/* ── Snapshots ───────────────────────────────────────────────────────────── */
export const snapshotSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.number().int(),
});
export const createSnapshotSchema = z.object({ label: z.string().min(1) });

/* ── Auth ────────────────────────────────────────────────────────────────── */
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export const userSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  role: z.enum(['admin', 'user']),
});

/* ── Invites & admin ─────────────────────────────────────────────────────── */
export const acceptInviteSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export const createInviteSchema = z.object({
  note: z.string().max(200).optional(),
  /** Days until the link expires (default 7). */
  expiresInDays: z.number().int().min(1).max(90).optional(),
});
export const adminResetPasswordSchema = z.object({ newPassword: z.string().min(8) });
export const adminUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  role: z.enum(['admin', 'user']),
  status: z.enum(['active', 'disabled']),
  createdAt: z.number().int(),
  lastLoginAt: z.number().int().nullable(),
  storageBytes: z.number().int(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
});
export const inviteSchema = z.object({
  id: z.number().int(),
  token: z.string(),
  note: z.string().nullable(),
  createdAt: z.number().int(),
  expiresAt: z.number().int(),
  usedAt: z.number().int().nullable(),
  usedBy: z.number().int().nullable(),
});

/* ── Admin usage & system ────────────────────────────────────────────────── */
export const usageDaySchema = z.object({
  day: z.string(), // YYYY-MM-DD (UTC)
  userId: z.number().int(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
});
export const usageModelSchema = z.object({
  model: z.string(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
  estimated: z.boolean(), // any rows in this model were chars/4 estimates
});
export const adminUsageResponseSchema = z.object({
  days: z.number().int(),
  daily: z.array(usageDaySchema),
  byModel: z.array(usageModelSchema),
});
export const adminSystemSchema = z.object({
  version: z.string(),
  nodeVersion: z.string(),
  uptimeSeconds: z.number(),
  controlDbBytes: z.number().int(),
  userDataBytes: z.number().int(),
  lastBackupAt: z.number().int().nullable(),
});
