/* ============================================================================
 * apps/api — db/schema.ts
 * Drizzle schema (SQLite). snake_case columns; epoch-ms integers for time.
 * Kept Postgres-portable (no SQLite-only column tricks).
 * ========================================================================= */
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch() * 1000)`;

/* ── Auth ────────────────────────────────────────────────────────────────── */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

/* ── Dreamward structure (data-driven) ────────────────────────────────────── */
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(), // slug
  labelEn: text('label_en').notNull(),
  labelHe: text('label_he').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const sectionTypes = sqliteTable('section_types', {
  id: text('id').primaryKey(),
  labelEn: text('label_en').notNull(),
  labelHe: text('label_he').notNull(),
  shape: text('shape').notNull(), // list | statement | rich | composite
  defaultSort: integer('default_sort').notNull(),
});

export const categorySections = sqliteTable('category_sections', {
  id: text('id').primaryKey(), // uuid
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  sectionType: text('section_type')
    .notNull()
    .references(() => sectionTypes.id),
  sortOrder: integer('sort_order').notNull(),
  content: text('content', { mode: 'json' }), // typed JSON per shape
  bodyRichtext: text('body_richtext'),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const contentBlocks = sqliteTable('content_blocks', {
  id: text('id').primaryKey(), // slug
  group: text('group').notNull(), // front_matter | implementation
  labelEn: text('label_en').notNull(),
  labelHe: text('label_he').notNull(),
  kind: text('kind').notNull(), // rich | list
  content: text('content', { mode: 'json' }),
  bodyRichtext: text('body_richtext'),
  sortOrder: integer('sort_order').notNull(),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const lifeVisionPrompts = sqliteTable('life_vision_prompts', {
  id: text('id').primaryKey(), // slug
  question: text('question').notNull(),
  answerRichtext: text('answer_richtext'),
  sortOrder: integer('sort_order').notNull(),
  updatedAt: integer('updated_at').notNull().default(now),
});

/* ── Goals / measurement ─────────────────────────────────────────────────── */
export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(), // uuid
  categoryId: text('category_id').references(() => categories.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('not_relevant'),
  targetDate: integer('target_date'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const goalStatusHistory = sqliteTable('goal_status_history', {
  id: text('id').primaryKey(), // uuid
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  note: text('note'),
  changedAt: integer('changed_at').notNull().default(now),
});

/* ── Journal ─────────────────────────────────────────────────────────────── */
export const journalEntries = sqliteTable(
  'journal_entries',
  {
    id: text('id').primaryKey(), // uuid
    entryDate: integer('entry_date').notNull().default(now),
    title: text('title'),
    bodyRichtext: text('body_richtext').notNull().default(''),
    mood: text('mood'),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [index('journal_entry_date_idx').on(t.entryDate)],
);

/* ── Assets & moodboards ─────────────────────────────────────────────────── */
export const assets = sqliteTable(
  'assets',
  {
    id: text('id').primaryKey(), // uuid
    originalPath: text('original_path').notNull(),
    webPath: text('web_path').notNull(),
    thumbPath: text('thumb_path').notNull(),
    mime: text('mime').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    source: text('source').notNull(), // pptx_import | upload
    alt: text('alt'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('assets_source_idx').on(t.source)],
);

export const moodboards = sqliteTable('moodboards', {
  id: text('id').primaryKey(), // uuid
  title: text('title').notNull(),
  theme: text('theme'),
  categoryId: text('category_id').references(() => categories.id),
  canvasWidth: integer('canvas_width').notNull().default(1920),
  canvasHeight: integer('canvas_height').notNull().default(1080),
  background: text('background', { mode: 'json' }),
  templateId: text('template_id'),
  visionStatement: text('vision_statement'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const moodboardItems = sqliteTable('moodboard_items', {
  id: text('id').primaryKey(), // uuid
  moodboardId: text('moodboard_id')
    .notNull()
    .references(() => moodboards.id, { onDelete: 'cascade' }),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id),
  x: real('x').notNull().default(0),
  y: real('y').notNull().default(0),
  width: real('width').notNull().default(300),
  height: real('height').notNull().default(300),
  rotation: real('rotation').notNull().default(0),
  zIndex: integer('z_index').notNull().default(0),
  crop: text('crop', { mode: 'json' }),
  cornerRadius: real('corner_radius').notNull().default(0),
  opacity: real('opacity').notNull().default(1),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const moodboardTextItems = sqliteTable('moodboard_text_items', {
  id: text('id').primaryKey(),
  moodboardId: text('moodboard_id')
    .notNull()
    .references(() => moodboards.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  x: real('x').notNull().default(0),
  y: real('y').notNull().default(0),
  width: real('width').notNull().default(400),
  height: real('height').notNull().default(120),
  rotation: real('rotation').notNull().default(0),
  zIndex: integer('z_index').notNull().default(0),
  color: text('color'),
  fontSize: real('font_size').notNull().default(48),
  align: text('align').notNull().default('start'),
});

/* ── Snapshots ───────────────────────────────────────────────────────────── */
export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(), // uuid
  label: text('label').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  createdAt: integer('created_at').notNull().default(now),
});

/* ════════════════════════ Phase 2 — AI fulfillment engine ═══════════════ */

/* ── LLM providers (user-configured, OpenAI-compatible endpoints) ────────── */
export const llmProviders = sqliteTable('llm_providers', {
  id: text('id').primaryKey(), // uuid
  name: text('name').notNull(),
  kind: text('kind').notNull().default('openai-compat'), // openai-compat | openai-codex
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key'), // nullable — local servers need none; encrypted at rest (enc:v1:...)
  oauthJson: text('oauth_json'), // encrypted OAuth token bundle for kind=openai-codex
  model: text('model').notNull(),
  toolsMode: text('tools_mode').notNull().default('auto'), // auto | on | off
  toolsDetected: integer('tools_detected'), // null=unknown, 0/1 probe result
  contextLength: integer('context_length'), // null=unknown → minimal digest tier
  isActive: integer('is_active').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

/* ── Agent conversations & messages ──────────────────────────────────────── */
export const agentConversations = sqliteTable('agent_conversations', {
  id: text('id').primaryKey(),
  title: text('title'),
  kind: text('kind').notNull().default('chat'), // chat | weekly_review
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const agentMessages = sqliteTable(
  'agent_messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // user | assistant | tool
    content: text('content').notNull().default(''),
    toolCalls: text('tool_calls', { mode: 'json' }), // assistant: [{id,name,arguments}]
    toolCallId: text('tool_call_id'), // tool role: which call this answers
    meta: text('meta', { mode: 'json' }), // {pageContext, model, mode}
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('agent_messages_conversation_idx').on(t.conversationId)],
);

/* ── Proposals — the single write gate ───────────────────────────────────── */
export const proposals = sqliteTable('proposals', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => agentConversations.id, {
    onDelete: 'set null',
  }),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  summary: text('summary').notNull(), // one-line human text in the model's language
  status: text('status').notNull().default('pending'), // pending|approved|rejected|failed
  error: text('error'),
  resultRef: text('result_ref'),
  createdAt: integer('created_at').notNull().default(now),
  resolvedAt: integer('resolved_at'),
});

/* ── Agent memory (append-only facts) ────────────────────────────────────── */
export const agentMemory = sqliteTable('agent_memory', {
  id: text('id').primaryKey(),
  key: text('key'),
  content: text('content').notNull(),
  sourceConversationId: text('source_conversation_id'),
  createdAt: integer('created_at').notNull().default(now),
});

/* ── Daily briefings (date-keyed cache) ──────────────────────────────────── */
export const briefings = sqliteTable('briefings', {
  id: text('id').primaryKey(),
  briefingDate: text('briefing_date').notNull().unique(), // 'YYYY-MM-DD' local
  content: text('content').notNull(), // markdown
  model: text('model').notNull(),
  digestVersion: integer('digest_version').notNull(),
  createdAt: integer('created_at').notNull().default(now),
});

/* ── Weekly reviews (his Saturday ritual) ────────────────────────────────── */
export const weeklyReviews = sqliteTable('weekly_reviews', {
  id: text('id').primaryKey(),
  weekStart: text('week_start').notNull().unique(), // 'YYYY-MM-DD' (Saturday)
  conversationId: text('conversation_id').references(() => agentConversations.id, {
    onDelete: 'set null',
  }),
  summary: text('summary'),
  decisions: text('decisions', { mode: 'json' }),
  status: text('status').notNull().default('in_progress'), // in_progress | completed
  createdAt: integer('created_at').notNull().default(now),
  completedAt: integer('completed_at'),
});

/* ── Actions — next steps (Funnel of Focus output) ───────────────────────── */
export const actions = sqliteTable(
  'actions',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: integer('due_date'),
    status: text('status').notNull().default('todo'), // todo | done
    priority: text('priority').notNull().default('medium'), // low | medium | high
    // Polymorphic link to any dreamward entity (goalId kept for back-compat,
    // dual-written when linkedType === 'goal').
    linkedType: text('linked_type'), // goal | section | content_block | life_vision
    linkedId: text('linked_id'),
    createdBy: text('created_by').notNull().default('user'), // user | agent | api
    sourceProposalId: text('source_proposal_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull().default(now),
    // No DB default (SQLite ADD COLUMN allows constants only) — set in code.
    updatedAt: integer('updated_at'),
    completedAt: integer('completed_at'),
    deletedAt: integer('deleted_at'), // soft delete — list queries filter IS NULL
  },
  (t) => [index('actions_status_idx').on(t.status), index('actions_linked_idx').on(t.linkedType, t.linkedId)],
);

/* ── Autonomous agent routines (the "reality engine" scheduler) ──────────── */
export const agentRoutines = sqliteTable('agent_routines', {
  id: text('id').primaryKey(), // = kind — one instance per routine kind
  kind: text('kind').notNull(), // daily_plan | weekly_review_prep | goal_drift
  enabled: integer('enabled').notNull().default(0),
  scheduleHour: integer('schedule_hour').notNull().default(7), // 0-23, server-local
  autoApprove: integer('auto_approve').notNull().default(0), // 1 → action proposals apply immediately
  lastRunAt: integer('last_run_at'),
  lastStatus: text('last_status'), // ok | error: … | no_provider
  config: text('config', { mode: 'json' }),
});

/* ── API activity audit — every mutation made via /api/v1 (agent keys) ────── */
export const apiActivity = sqliteTable(
  'api_activity',
  {
    id: text('id').primaryKey(), // uuid
    ts: integer('ts').notNull(),
    keyId: integer('key_id').notNull(), // control-DB api_keys.id (no cross-DB FK)
    keyName: text('key_name').notNull(), // denormalized — survives key revocation
    method: text('method').notNull(),
    path: text('path').notNull(),
    action: text('action'), // 'action.create' | 'goal.delete' | …
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    summary: text('summary'), // truncated payload summary (≤500 chars, no secrets)
    priorState: text('prior_state'), // previous row JSON on UPDATE/DELETE — recoverability
    status: integer('status').notNull(), // HTTP status
  },
  (t) => [index('api_activity_ts_idx').on(t.ts)],
);

/* ── Current Life Chapter — the season that decides what matters now ─────── */
export const lifeChapters = sqliteTable('life_chapters', {
  id: text('id').primaryKey(),
  title: text('title').notNull(), // theme / name of the season
  intention: text('intention'), // what this chapter is meant to create
  focusCategoryIds: text('focus_category_ids', { mode: 'json' }).$type<string[]>().notNull(),
  maintenanceCategoryIds: text('maintenance_category_ids', { mode: 'json' }).$type<string[]>().notNull(),
  notNow: text('not_now', { mode: 'json' }).notNull(), // ListItem[] — deliberately parked
  noLongerAcceptable: text('no_longer_acceptable', { mode: 'json' }).notNull(), // ListItem[] — anti-vision
  startDate: integer('start_date').notNull(),
  reviewDate: integer('review_date'),
  status: text('status').notNull().default('active'), // active | closed — at most one active
  closingReflection: text('closing_reflection'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
  closedAt: integer('closed_at'),
});

/* ── Life wheel — append-only "how close is today to my vision" ratings ──── */
export const categoryRatings = sqliteTable(
  'category_ratings',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    score: integer('score').notNull(), // 1-10
    reality: text('reality'), // what is honestly true today
    gap: text('gap'), // the biggest gap to the vision
    ratedAt: integer('rated_at').notNull().default(now),
  },
  (t) => [index('category_ratings_cat_idx').on(t.categoryId, t.ratedAt)],
);

/* ── IKIGAI — versioned profiles (one draft, one current, archived history) ─ */
export const ikigaiProfiles = sqliteTable('ikigai_profiles', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('draft'), // draft | current | archived
  items: text('items', { mode: 'json' }).notNull(), // IkigaiItem[]
  everyday: text('everyday', { mode: 'json' }).notNull(), // ListItem[] — small joys
  statement: text('statement'),
  confidence: integer('confidence'), // 1-10
  reflections: text('reflections', { mode: 'json' }).notNull(), // Record<step, note>
  step: integer('step').notNull().default(0), // wizard resume position
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
  completedAt: integer('completed_at'),
});

/* ── Per-user UI flags (key → JSON), e.g. the onboarding status ──────────── */
export const userFlags = sqliteTable('user_flags', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at').notNull().default(now),
});
