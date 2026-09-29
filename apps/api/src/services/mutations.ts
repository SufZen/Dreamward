/* ============================================================================
 * apps/api — services/mutations.ts
 * The mutation services behind approved proposals. Single source of truth —
 * REST routes that share semantics (goal status history) call these too.
 * ========================================================================= */
import { eq, sql } from 'drizzle-orm';
import type { ActionLinkType, ActionPriority, CreatedBy, GoalStatus } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import { markdownToHtml } from '../agent/text';

/** Accepts ISO 'YYYY-MM-DD' (proposals) or epoch-ms (REST). */
const dateToMs = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};

const toListItems = (items: { text: string }[] | undefined) =>
  items?.map((it, i) => ({ id: `ai_${uuid().slice(0, 8)}`, text: it.text, order: i }));

export function createGoal(p: {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  targetDate?: string | null;
}): string {
  const db = getDb();
  const id = uuid();
  const ts = nowMs();
  db.insert(schema.goals)
    .values({
      id,
      title: p.title,
      description: p.description ?? null,
      categoryId: p.categoryId ?? null,
      targetDate: dateToMs(p.targetDate),
      status: 'not_achieved',
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  return id;
}

export function updateGoalStatus(p: { goalId: string; status: GoalStatus; note?: string }): string {
  const db = getDb();
  const ts = nowMs();
  const res = db
    .update(schema.goals)
    .set({ status: p.status, updatedAt: ts })
    .where(eq(schema.goals.id, p.goalId))
    .run();
  if (res.changes === 0) throw new Error(`goal not found: ${p.goalId}`);
  db.insert(schema.goalStatusHistory)
    .values({ id: uuid(), goalId: p.goalId, status: p.status, note: p.note ?? null, changedAt: ts })
    .run();
  return p.goalId;
}

/** Throws when a polymorphic action link points at a missing entity. */
function assertLinkTarget(linkedType: ActionLinkType, linkedId: string): void {
  const db = getDb();
  const table = {
    goal: schema.goals,
    section: schema.categorySections,
    content_block: schema.contentBlocks,
    life_vision: schema.lifeVisionPrompts,
    ikigai: schema.ikigaiProfiles,
  }[linkedType];
  const row = db.select({ id: table.id }).from(table).where(eq(table.id, linkedId)).get();
  if (!row) throw new Error(`linked ${linkedType} not found: ${linkedId}`);
}

export function createAction(p: {
  title: string;
  description?: string | null;
  goalId?: string | null;
  dueDate?: string | number | null;
  priority?: ActionPriority;
  linkedType?: ActionLinkType | null;
  linkedId?: string | null;
  createdBy?: CreatedBy;
  sourceProposalId?: string | null;
}): string {
  const db = getDb();

  // Normalize the link: legacy goalId ⇄ polymorphic (goal, id), dual-written.
  let linkedType = p.linkedType ?? null;
  let linkedId = p.linkedId ?? null;
  let goalId = p.goalId ?? null;
  if (!linkedType && goalId) {
    linkedType = 'goal';
    linkedId = goalId;
  }
  if (linkedType && !linkedId) throw new Error('linkedId required when linkedType is set');
  if (linkedType && linkedId) {
    assertLinkTarget(linkedType, linkedId);
    if (linkedType === 'goal') goalId = linkedId;
  }

  const id = uuid();
  const ts = nowMs();
  const maxSort = db
    .select({ max: sql<number | null>`max(${schema.actions.sortOrder})` })
    .from(schema.actions)
    .get();
  db.insert(schema.actions)
    .values({
      id,
      title: p.title,
      description: p.description ?? null,
      goalId,
      linkedType,
      linkedId,
      dueDate: dateToMs(p.dueDate),
      status: 'todo',
      priority: p.priority ?? 'medium',
      createdBy: p.createdBy ?? 'user',
      sourceProposalId: p.sourceProposalId ?? null,
      sortOrder: (maxSort?.max ?? 0) + 1,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  return id;
}

export function updateAction(p: {
  actionId: string;
  title?: string;
  description?: string | null;
  dueDate?: string | number | null;
  priority?: ActionPriority;
  status?: 'todo' | 'done';
  linkedType?: ActionLinkType | null;
  linkedId?: string | null;
}): string {
  const db = getDb();
  const ts = nowMs();
  const patch: Record<string, unknown> = { updatedAt: ts };
  if (p.title !== undefined) patch.title = p.title;
  if (p.description !== undefined) patch.description = p.description;
  if (p.dueDate !== undefined) patch.dueDate = dateToMs(p.dueDate);
  if (p.priority !== undefined) patch.priority = p.priority;
  if (p.status !== undefined) {
    patch.status = p.status;
    patch.completedAt = p.status === 'done' ? ts : null;
  }
  if (p.linkedType !== undefined || p.linkedId !== undefined) {
    const linkedType = p.linkedType ?? null;
    const linkedId = p.linkedId ?? null;
    if (linkedType && !linkedId) throw new Error('linkedId required when linkedType is set');
    if (linkedType && linkedId) assertLinkTarget(linkedType, linkedId);
    patch.linkedType = linkedType;
    patch.linkedId = linkedId;
    patch.goalId = linkedType === 'goal' ? linkedId : null;
  }
  const res = db.update(schema.actions).set(patch).where(eq(schema.actions.id, p.actionId)).run();
  if (res.changes === 0) throw new Error(`action not found: ${p.actionId}`);
  return p.actionId;
}

export function completeAction(p: { actionId: string }): string {
  const db = getDb();
  const ts = nowMs();
  const res = db
    .update(schema.actions)
    .set({ status: 'done', completedAt: ts, updatedAt: ts })
    .where(eq(schema.actions.id, p.actionId))
    .run();
  if (res.changes === 0) throw new Error(`action not found: ${p.actionId}`);
  return p.actionId;
}

/** Soft delete — the row stays for audit/recovery; list queries filter it out. */
export function deleteAction(p: { actionId: string }): string {
  const db = getDb();
  const ts = nowMs();
  const res = db
    .update(schema.actions)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(eq(schema.actions.id, p.actionId))
    .run();
  if (res.changes === 0) throw new Error(`action not found: ${p.actionId}`);
  return p.actionId;
}

export function createJournalEntry(p: { title?: string | null; bodyMarkdown: string }): string {
  const db = getDb();
  const id = uuid();
  const ts = nowMs();
  db.insert(schema.journalEntries)
    .values({
      id,
      entryDate: ts,
      title: p.title ?? null,
      bodyRichtext: markdownToHtml(p.bodyMarkdown),
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  return id;
}

export function updateSectionContent(p: {
  sectionId: string;
  items?: { text: string }[];
  habits?: { text: string }[];
  leverages?: { text: string }[];
  bodyMarkdown?: string;
  quote?: string;
  quoteAuthor?: string;
  statement?: string;
  states?: { text: string }[];
  standards?: { text: string }[];
  beliefShifts?: { from: string; to: string }[];
}): string {
  const db = getDb();
  const row = db
    .select()
    .from(schema.categorySections)
    .where(eq(schema.categorySections.id, p.sectionId))
    .get();
  if (!row) throw new Error(`section not found: ${p.sectionId}`);

  const existing = (row.content ?? {}) as Record<string, unknown>;
  const content: Record<string, unknown> = { ...existing };
  if (p.items) content.items = toListItems(p.items);
  if (p.habits) content.habits = toListItems(p.habits);
  if (p.leverages) content.leverages = toListItems(p.leverages);
  if (p.quote !== undefined) content.quote = p.quote;
  if (p.quoteAuthor !== undefined) content.quoteAuthor = p.quoteAuthor;
  if (p.statement !== undefined) content.statement = p.statement;
  if (p.states) content.states = toListItems(p.states);
  if (p.standards) content.standards = toListItems(p.standards);
  if (p.beliefShifts) {
    content.beliefShifts = p.beliefShifts.map((b) => ({ id: `ai_${uuid().slice(0, 8)}`, from: b.from, to: b.to }));
  }

  db.update(schema.categorySections)
    .set({
      content,
      bodyRichtext: p.bodyMarkdown !== undefined ? markdownToHtml(p.bodyMarkdown) : row.bodyRichtext,
      updatedAt: nowMs(),
    })
    .where(eq(schema.categorySections.id, p.sectionId))
    .run();
  return p.sectionId;
}

export function updateLifeVisionAnswer(p: { promptId: string; answerMarkdown: string }): string {
  const db = getDb();
  const res = db
    .update(schema.lifeVisionPrompts)
    .set({ answerRichtext: markdownToHtml(p.answerMarkdown), updatedAt: nowMs() })
    .where(eq(schema.lifeVisionPrompts.id, p.promptId))
    .run();
  if (res.changes === 0) throw new Error(`life-vision prompt not found: ${p.promptId}`);
  return p.promptId;
}

export function updateContentBlock(p: {
  blockId: string;
  items?: { text: string }[];
  bodyMarkdown?: string;
}): string {
  const db = getDb();
  const row = db.select().from(schema.contentBlocks).where(eq(schema.contentBlocks.id, p.blockId)).get();
  if (!row) throw new Error(`content block not found: ${p.blockId}`);
  db.update(schema.contentBlocks)
    .set({
      content: p.items ? { items: toListItems(p.items) } : row.content,
      bodyRichtext: p.bodyMarkdown !== undefined ? markdownToHtml(p.bodyMarkdown) : row.bodyRichtext,
      updatedAt: nowMs(),
    })
    .where(eq(schema.contentBlocks.id, p.blockId))
    .run();
  return p.blockId;
}

export function saveMemory(p: { key?: string | null; content: string }, conversationId?: string | null): string {
  const db = getDb();
  const id = uuid();
  db.insert(schema.agentMemory)
    .values({
      id,
      key: p.key ?? null,
      content: p.content,
      sourceConversationId: conversationId ?? null,
      createdAt: nowMs(),
    })
    .run();
  return id;
}

export function completeWeeklyReview(
  p: { summary: string; priorities: string[] },
  conversationId?: string | null,
): string {
  const db = getDb();
  const ts = nowMs();
  // resolve the in-progress review (by conversation when known, else latest)
  const review = conversationId
    ? db.select().from(schema.weeklyReviews).where(eq(schema.weeklyReviews.conversationId, conversationId)).get()
    : db.select().from(schema.weeklyReviews).where(eq(schema.weeklyReviews.status, 'in_progress')).get();
  if (!review) throw new Error('no weekly review in progress');
  db.update(schema.weeklyReviews)
    .set({ summary: p.summary, decisions: { priorities: p.priorities }, status: 'completed', completedAt: ts })
    .where(eq(schema.weeklyReviews.id, review.id))
    .run();
  return review.id;
}
