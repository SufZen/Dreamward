/* ============================================================================
 * @dreamward/mcp — tools.ts
 * Transport-independent tool definitions: each tool has a zod input shape and
 * a run(client, args) that calls the Dreamward /api/v1 REST surface. A future
 * remote (Streamable HTTP) MCP endpoint can reuse this table unchanged.
 * ========================================================================= */
import { z, type ZodRawShape } from 'zod';
import type { DreamwardClient } from '@dreamward/client';
import { ACTION_LINK_TYPES, ACTION_PRIORITIES, GOAL_STATUSES } from '@dreamward/shared';

export interface DreamwardTool {
  name: string;
  description: string;
  schema: ZodRawShape;
  run: (client: DreamwardClient, args: Record<string, unknown>) => Promise<unknown>;
}

const json = (v: unknown) => v;
const isoToMs = (iso: string | undefined | null): number | null | undefined => {
  if (iso === undefined) return undefined;
  if (iso === null || iso === '') return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
};

const dueDateArg = z
  .string()
  .nullable()
  .optional()
  .describe('ISO date YYYY-MM-DD (null clears it)');
const listItemsArg = z.array(z.object({ text: z.string() })).optional();

export const TOOLS: DreamwardTool[] = [
  /* ── Read ──────────────────────────────────────────────────────────────── */
  {
    name: 'search_content',
    description:
      "Full-text search across the user's entire Dreamward (categories, vision, goals, journal). Returns matching snippets with [docType:docId] references usable with the get_* tools.",
    schema: { query: z.string(), limit: z.number().int().max(25).optional() },
    run: (c, a) => c.get(`/search?q=${encodeURIComponent(String(a.query))}&limit=${a.limit ?? 8}`),
  },
  {
    name: 'list_categories',
    description: 'List the 12 life categories (id, English/Hebrew labels, icon).',
    schema: {},
    run: (c) => c.get('/categories'),
  },
  {
    name: 'get_category',
    description:
      'Get one life category with all its sections (premises, vision, purpose, strategy…) including content.',
    schema: { categoryId: z.string() },
    run: (c, a) => c.get(`/categories/${a.categoryId}`),
  },
  {
    name: 'list_content_blocks',
    description: 'List front-matter and implementation content blocks (cover, gratitude, funnel of focus…).',
    schema: {},
    run: (c) => c.get('/content-blocks'),
  },
  {
    name: 'get_content_block',
    description: 'Get one content block by id (e.g. cover, impl_funnel, what_i_want).',
    schema: { blockId: z.string() },
    run: (c, a) => c.get(`/content-blocks/${a.blockId}`),
  },
  {
    name: 'get_life_vision',
    description: 'Get all dream-life reflective prompts (the home I love, a perfect ordinary day…) with their answers.',
    schema: {},
    run: (c) => c.get('/life-vision'),
  },
  {
    name: 'list_goals',
    description:
      'List all goals with status, category, target date — plus computed progress (% of linked actions done, weekly momentum, risk: on_track/stalled/at_risk).',
    schema: { status: z.enum(GOAL_STATUSES).optional(), categoryId: z.string().optional() },
    run: async (c, a) => {
      const qs = new URLSearchParams();
      if (a.status) qs.set('status', String(a.status));
      if (a.categoryId) qs.set('category_id', String(a.categoryId));
      const [goals, progress] = await Promise.all([
        c.get<{ id: string }[]>(`/goals${qs.size ? `?${qs}` : ''}`),
        c.get<Record<string, unknown>>('/goals/progress'),
      ]);
      return goals.map((g) => ({ ...g, progress: progress[g.id] ?? null }));
    },
  },
  {
    name: 'get_goal',
    description: 'Get one goal by id.',
    schema: { goalId: z.string() },
    run: (c, a) => c.get(`/goals/${a.goalId}`),
  },
  {
    name: 'list_actions',
    description:
      'List actions (granular next steps below goals). Filter by status (todo/done), priority, or linked goal.',
    schema: {
      status: z.enum(['todo', 'done']).optional(),
      priority: z.enum(ACTION_PRIORITIES).optional(),
      goalId: z.string().optional(),
    },
    run: (c, a) => {
      const qs = new URLSearchParams();
      if (a.status) qs.set('status', String(a.status));
      if (a.priority) qs.set('priority', String(a.priority));
      if (a.goalId) qs.set('goal_id', String(a.goalId));
      return c.get(`/actions${qs.size ? `?${qs}` : ''}`);
    },
  },
  {
    name: 'list_journal_entries',
    description: 'List journal entries (newest first).',
    schema: {},
    run: (c) => c.get('/journal'),
  },
  {
    name: 'get_journal_entry',
    description: 'Get one journal entry by id (body is HTML).',
    schema: { entryId: z.string() },
    run: (c, a) => c.get(`/journal/${a.entryId}`),
  },
  {
    name: 'list_moodboards',
    description: 'List vision moodboards (title, theme, category, vision statement).',
    schema: {},
    run: (c) => c.get('/moodboards'),
  },
  {
    name: 'get_latest_briefing',
    description: "Get the most recent cached morning briefing Lify generated for the user (markdown).",
    schema: {},
    run: (c) => c.get('/briefings/latest'),
  },
  {
    name: 'get_current_chapter',
    description:
      "Get the user's Current Life Chapter — the season that decides what matters now: theme, intention, focus categories (prioritise these), maintenance-only categories, a 'not now' list and what is no longer acceptable. Returns {chapter: null} when none is set.",
    schema: {},
    run: (c) => c.get('/chapters/current'),
  },
  {
    name: 'get_life_wheel',
    description:
      'Get the life wheel: for each of the 12 categories the latest 1-10 rating of how close today is to the vision, the honest current reality, the biggest gap and the change vs. the previous rating.',
    schema: {},
    run: (c) => c.get('/ratings/latest'),
  },
  {
    name: 'get_ikigai',
    description:
      "Get the user's IKIGAI: the current statement, items mapped to the four circles (love / good at / world needs / paid for), everyday joys, any in-progress draft and the version history.",
    schema: {},
    run: (c) => c.get('/ikigai'),
  },

  /* ── Write (requires a write-scope API key) ────────────────────────────── */
  {
    name: 'create_goal',
    description: 'Create a new goal. targetDate is ISO YYYY-MM-DD.',
    schema: {
      title: z.string(),
      description: z.string().optional(),
      categoryId: z.string().optional().describe('one of the 12 category ids, e.g. health_fitness'),
      targetDate: dueDateArg,
    },
    run: (c, a) =>
      c.post('/goals', {
        title: a.title,
        description: a.description ?? null,
        categoryId: a.categoryId ?? null,
        targetDate: isoToMs(a.targetDate as string | null | undefined) ?? null,
      }),
  },
  {
    name: 'update_goal',
    description: 'Update goal fields (title, description, category, targetDate).',
    schema: {
      goalId: z.string(),
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      categoryId: z.string().nullable().optional(),
      targetDate: dueDateArg,
    },
    run: (c, a) =>
      c.put(`/goals/${a.goalId}`, {
        ...(a.title !== undefined && { title: a.title }),
        ...(a.description !== undefined && { description: a.description }),
        ...(a.categoryId !== undefined && { categoryId: a.categoryId }),
        ...(a.targetDate !== undefined && { targetDate: isoToMs(a.targetDate as string | null) }),
      }),
  },
  {
    name: 'set_goal_status',
    description: 'Set goal status (achieved / partial / not_achieved / not_relevant) with an optional note. Recorded in the goal status history.',
    schema: { goalId: z.string(), status: z.enum(GOAL_STATUSES), note: z.string().optional() },
    run: (c, a) => c.patch(`/goals/${a.goalId}/status`, { status: a.status, note: a.note }),
  },
  {
    name: 'delete_goal',
    description: 'Delete a goal permanently (its actions survive, unlinked).',
    schema: { goalId: z.string() },
    run: (c, a) => c.del(`/goals/${a.goalId}`),
  },
  {
    name: 'create_action',
    description:
      'Create an action (granular next step). Optionally link it to a goal, category section, content block, or life-vision prompt.',
    schema: {
      title: z.string(),
      description: z.string().optional(),
      dueDate: dueDateArg,
      priority: z.enum(ACTION_PRIORITIES).optional(),
      goalId: z.string().optional().describe('shorthand for linkedType=goal'),
      linkedType: z.enum(ACTION_LINK_TYPES).optional(),
      linkedId: z.string().optional(),
    },
    run: (c, a) =>
      c.post('/actions', {
        title: a.title,
        description: a.description ?? null,
        dueDate: isoToMs(a.dueDate as string | null | undefined) ?? null,
        priority: a.priority,
        goalId: a.goalId ?? null,
        linkedType: a.linkedType ?? null,
        linkedId: a.linkedId ?? null,
      }),
  },
  {
    name: 'update_action',
    description: 'Update action fields (title, description, dueDate, priority, status).',
    schema: {
      actionId: z.string(),
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      dueDate: dueDateArg,
      priority: z.enum(ACTION_PRIORITIES).optional(),
      status: z.enum(['todo', 'done']).optional(),
    },
    run: (c, a) =>
      c.patch(`/actions/${a.actionId}`, {
        ...(a.title !== undefined && { title: a.title }),
        ...(a.description !== undefined && { description: a.description }),
        ...(a.dueDate !== undefined && { dueDate: isoToMs(a.dueDate as string | null) }),
        ...(a.priority !== undefined && { priority: a.priority }),
        ...(a.status !== undefined && { status: a.status }),
      }),
  },
  {
    name: 'complete_action',
    description: 'Mark an action as done (stamps completedAt).',
    schema: { actionId: z.string() },
    run: (c, a) => c.patch(`/actions/${a.actionId}`, { status: 'done' }),
  },
  {
    name: 'delete_action',
    description: 'Delete an action (soft delete — recoverable from the audit log).',
    schema: { actionId: z.string() },
    run: (c, a) => c.del(`/actions/${a.actionId}`),
  },
  {
    name: 'create_journal_entry',
    description: "Write a journal entry in the user's Dreamward from markdown.",
    schema: { title: z.string().optional(), bodyMarkdown: z.string() },
    run: (c, a) => c.post('/journal/markdown', { title: a.title ?? null, bodyMarkdown: a.bodyMarkdown }),
  },
  {
    name: 'update_journal_entry',
    description: 'Update a journal entry (bodyRichtext is HTML — prefer creating new entries over editing).',
    schema: { entryId: z.string(), title: z.string().nullable().optional(), bodyRichtext: z.string().optional() },
    run: (c, a) =>
      c.put(`/journal/${a.entryId}`, {
        ...(a.title !== undefined && { title: a.title }),
        ...(a.bodyRichtext !== undefined && { bodyRichtext: a.bodyRichtext }),
      }),
  },
  {
    name: 'delete_journal_entry',
    description: 'Delete a journal entry permanently.',
    schema: { entryId: z.string() },
    run: (c, a) => c.del(`/journal/${a.entryId}`),
  },
  {
    name: 'update_section',
    description:
      'Replace the content of a category section (premises/vision/identity/purpose/strategy). Accepts markdown body and/or item lists — full replacement of the provided fields. Identity sections use statement, states, standards and beliefShifts.',
    schema: {
      sectionId: z.string(),
      items: listItemsArg,
      habits: listItemsArg,
      leverages: listItemsArg,
      bodyMarkdown: z.string().optional(),
      quote: z.string().optional(),
      quoteAuthor: z.string().optional(),
      statement: z.string().optional().describe('identity: "who I am when I live this vision"'),
      states: listItemsArg.describe('identity: desired inner states'),
      standards: listItemsArg.describe('identity: standards and boundaries'),
      beliefShifts: z
        .array(z.object({ from: z.string(), to: z.string() }))
        .optional()
        .describe('identity: limiting belief → empowering belief'),
    },
    run: (c, a) => c.put(`/sections/${a.sectionId}/content`, json({ ...a, sectionId: undefined })),
  },
  {
    name: 'update_content_block',
    description: 'Replace the content of a content block (markdown body and/or item list).',
    schema: { blockId: z.string(), items: listItemsArg, bodyMarkdown: z.string().optional() },
    run: (c, a) => c.put(`/content-blocks/${a.blockId}/content`, json({ ...a, blockId: undefined })),
  },
  {
    name: 'rate_category',
    description:
      'Record a life-wheel rating for a category: score 1-10 for how close today is to the vision, plus optional honest reality and biggest gap. Ratings are append-only (history is kept).',
    schema: {
      categoryId: z.string(),
      score: z.number().int().min(1).max(10),
      reality: z.string().optional(),
      gap: z.string().optional(),
    },
    run: (c, a) => c.post('/ratings', a),
  },
  {
    name: 'update_life_vision_answer',
    description: 'Write or replace the answer to a dream-life prompt (markdown).',
    schema: { promptId: z.string(), answerMarkdown: z.string() },
    run: (c, a) => c.put(`/life-vision/${a.promptId}/answer`, { answerMarkdown: a.answerMarkdown }),
  },

  /* ── Meaning & focus (v0.4+) ───────────────────────────────────────────── */
  {
    name: 'get_overview',
    description:
      "The user's whole Dreamward as compact markdown — current chapter, IKIGAI, life wheel, vision, categories, goals, open actions, recent journal. The best first read for context. detail: minimal | compact (default) | full.",
    schema: { detail: z.enum(['minimal', 'compact', 'full']).optional() },
    run: (c, a) => c.get(`/overview${a.detail ? `?detail=${a.detail}` : ''}`),
  },
  {
    name: 'list_rating_history',
    description: 'All past life-wheel ratings (1-10, reality, gap) for one category, oldest first — shows the trend.',
    schema: { categoryId: z.string() },
    run: (c, a) => c.get(`/ratings?categoryId=${encodeURIComponent(String(a.categoryId))}`),
  },
  {
    name: 'start_chapter',
    description:
      'Start a new Current Life Chapter (the previous active one is closed). focusCategoryIds: 1-5 category ids to prioritise; maintenanceCategoryIds: areas kept on maintenance; notNow: good things deliberately parked; noLongerAcceptable: the anti-vision / decision filter.',
    schema: {
      title: z.string().min(1),
      intention: z.string().optional(),
      focusCategoryIds: z.array(z.string()).max(5).optional(),
      maintenanceCategoryIds: z.array(z.string()).optional(),
      notNow: z.array(z.string()).optional(),
      noLongerAcceptable: z.array(z.string()).optional(),
      reviewDate: dueDateArg,
    },
    run: (c, a) =>
      c.post('/chapters', {
        title: a.title,
        intention: a.intention ?? null,
        focusCategoryIds: a.focusCategoryIds,
        maintenanceCategoryIds: a.maintenanceCategoryIds,
        notNow: toListItems(a.notNow),
        noLongerAcceptable: toListItems(a.noLongerAcceptable),
        reviewDate: isoToMs(a.reviewDate as string | null | undefined),
      }),
  },
  {
    name: 'update_chapter',
    description:
      'Update the active chapter. Only the fields you pass change; lists (notNow, noLongerAcceptable) are replaced as a whole.',
    schema: {
      title: z.string().optional(),
      intention: z.string().nullable().optional(),
      focusCategoryIds: z.array(z.string()).max(5).optional(),
      maintenanceCategoryIds: z.array(z.string()).optional(),
      notNow: z.array(z.string()).optional(),
      noLongerAcceptable: z.array(z.string()).optional(),
      reviewDate: dueDateArg,
    },
    run: async (c, a) => {
      const { chapter } = await c.get<{ chapter: { id: string } | null }>('/chapters/current');
      if (!chapter) throw new Error('No active chapter — use start_chapter first.');
      return c.put(`/chapters/${chapter.id}`, {
        title: a.title,
        intention: a.intention,
        focusCategoryIds: a.focusCategoryIds,
        maintenanceCategoryIds: a.maintenanceCategoryIds,
        notNow: toListItems(a.notNow),
        noLongerAcceptable: toListItems(a.noLongerAcceptable),
        reviewDate: isoToMs(a.reviewDate as string | null | undefined),
      });
    },
  },
  {
    name: 'start_ikigai_draft',
    description:
      'Start (or resume) an IKIGAI draft. fromCurrent=true copies the current IKIGAI so it can be revisited. The user completes it in the app.',
    schema: { fromCurrent: z.boolean().optional() },
    run: (c, a) => c.post('/ikigai/draft', { fromCurrent: a.fromCurrent === true }),
  },
  {
    name: 'update_ikigai_draft',
    description:
      "Write into the IKIGAI draft (start one first). items: each with the circles it belongs to — 'love' (what I love), 'good' (what I'm good at), 'needs' (what the world needs), 'paid' (what I can be paid for). everyday: small daily joys. Lists replace the draft's lists as a whole.",
    schema: {
      items: z
        .array(z.object({ text: z.string().min(1), circles: z.array(z.enum(['love', 'good', 'needs', 'paid'])).min(1) }))
        .optional(),
      everyday: z.array(z.string()).optional(),
      statement: z.string().optional(),
      confidence: z.number().int().min(1).max(10).optional(),
    },
    run: async (c, a) => {
      const state = await c.get<{ draft: { id: string } | null }>('/ikigai');
      if (!state.draft) throw new Error('No IKIGAI draft — call start_ikigai_draft first.');
      const items = a.items as { text: string; circles: string[] }[] | undefined;
      return c.put(`/ikigai/${state.draft.id}`, {
        items: items?.map((it, i) => ({ id: `agent-${Date.now().toString(36)}-${i}`, text: it.text, circles: it.circles, source: 'lify' })),
        everyday: toListItems(a.everyday),
        statement: a.statement,
        confidence: a.confidence,
      });
    },
  },
];

function toListItems(v: unknown): { id: string; text: string; order: number }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const stamp = Date.now().toString(36);
  return v.map((text, i) => ({ id: `agent-${stamp}-${i}`, text: String(text), order: i }));
}

/* ── Safety annotations (MCP ToolAnnotations) ──────────────────────────── */

export type ToolAccess = 'read' | 'write' | 'destructive';

/** read = never changes data; destructive = deletes; write = everything else. */
export function toolAccess(name: string): ToolAccess {
  if (/^(get_|list_|search_)/.test(name)) return 'read';
  if (/^delete_/.test(name)) return 'destructive';
  return 'write';
}

export function toolAnnotations(name: string) {
  const access = toolAccess(name);
  return {
    readOnlyHint: access === 'read',
    destructiveHint: access === 'destructive',
    // replacing content / setting a status twice yields the same state
    idempotentHint: access === 'read' || /^(update_|set_|complete_)/.test(name) ? true : false,
    openWorldHint: false,
  };
}
