/* ============================================================================
 * apps/api — services/meaning.ts
 * The "meaning & focus" layer: the Current Life Chapter, the life-wheel
 * ratings and IKIGAI profiles. Single source of truth for the REST routes,
 * the Clarity digest and the agent tools.
 * ========================================================================= */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  CATEGORY_IDS,
  CHAPTER_DEFAULT_DAYS,
  ikigaiCompletionIssues,
  type Chapter,
  type IkigaiCompletionIssue,
  type IkigaiItem,
  type IkigaiProfile,
  type LatestRating,
  type ListItem,
  type Rating,
} from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';

/** Domain error carrying an HTTP status for the routes. */
export class MeaningError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(code);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const validCategories = (ids: string[] | undefined) => (ids ?? []).filter((id) => (CATEGORY_IDS as string[]).includes(id));
const uniq = <T>(xs: T[]) => [...new Set(xs)];

/* ── Chapters ────────────────────────────────────────────────────────────── */

type ChapterRow = typeof schema.lifeChapters.$inferSelect;

function toChapter(r: ChapterRow): Chapter {
  return {
    ...r,
    focusCategoryIds: r.focusCategoryIds ?? [],
    maintenanceCategoryIds: r.maintenanceCategoryIds ?? [],
    notNow: (r.notNow as ListItem[]) ?? [],
    noLongerAcceptable: (r.noLongerAcceptable as ListItem[]) ?? [],
    status: r.status as Chapter['status'],
  };
}

export function getActiveChapter(): Chapter | null {
  const row = getDb().select().from(schema.lifeChapters).where(eq(schema.lifeChapters.status, 'active')).get();
  return row ? toChapter(row) : null;
}

export function listChapters(): Chapter[] {
  return getDb().select().from(schema.lifeChapters).orderBy(desc(schema.lifeChapters.startDate)).all().map(toChapter);
}

export interface ChapterInput {
  title?: string;
  intention?: string | null;
  focusCategoryIds?: string[];
  maintenanceCategoryIds?: string[];
  notNow?: ListItem[];
  noLongerAcceptable?: ListItem[];
  startDate?: number;
  reviewDate?: number | null;
}

/** Focus wins over maintenance when a category is in both. */
function normalizeAreas(focus: string[], maintenance: string[]) {
  const f = uniq(validCategories(focus));
  return { focus: f, maintenance: uniq(validCategories(maintenance)).filter((id) => !f.includes(id)) };
}

/** Starts a new chapter; the previous active one (if any) is closed. */
export function createChapter(input: ChapterInput & { title: string }): Chapter {
  const db = getDb();
  const ts = nowMs();
  const id = uuid();
  const startDate = input.startDate ?? ts;
  const { focus, maintenance } = normalizeAreas(input.focusCategoryIds ?? [], input.maintenanceCategoryIds ?? []);
  db.transaction((tx) => {
    tx.update(schema.lifeChapters)
      .set({ status: 'closed', closedAt: ts, updatedAt: ts })
      .where(eq(schema.lifeChapters.status, 'active'))
      .run();
    tx.insert(schema.lifeChapters)
      .values({
        id,
        title: input.title,
        intention: input.intention ?? null,
        focusCategoryIds: focus,
        maintenanceCategoryIds: maintenance,
        notNow: input.notNow ?? [],
        noLongerAcceptable: input.noLongerAcceptable ?? [],
        startDate,
        reviewDate: input.reviewDate === undefined ? startDate + CHAPTER_DEFAULT_DAYS * DAY_MS : input.reviewDate,
        status: 'active',
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
  });
  return getChapter(id)!;
}

export function getChapter(id: string): Chapter | null {
  const row = getDb().select().from(schema.lifeChapters).where(eq(schema.lifeChapters.id, id)).get();
  return row ? toChapter(row) : null;
}

export function updateChapter(id: string, patch: ChapterInput): Chapter {
  const existing = getChapter(id);
  if (!existing) throw new MeaningError(404, 'not_found');
  const set: Partial<ChapterRow> = { updatedAt: nowMs() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.intention !== undefined) set.intention = patch.intention;
  if (patch.notNow !== undefined) set.notNow = patch.notNow;
  if (patch.noLongerAcceptable !== undefined) set.noLongerAcceptable = patch.noLongerAcceptable;
  if (patch.startDate !== undefined) set.startDate = patch.startDate;
  if (patch.reviewDate !== undefined) set.reviewDate = patch.reviewDate;
  if (patch.focusCategoryIds !== undefined || patch.maintenanceCategoryIds !== undefined) {
    const { focus, maintenance } = normalizeAreas(
      patch.focusCategoryIds ?? existing.focusCategoryIds,
      patch.maintenanceCategoryIds ?? existing.maintenanceCategoryIds,
    );
    set.focusCategoryIds = focus;
    set.maintenanceCategoryIds = maintenance;
  }
  getDb().update(schema.lifeChapters).set(set).where(eq(schema.lifeChapters.id, id)).run();
  return getChapter(id)!;
}

export function closeChapter(id: string, closingReflection: string | null | undefined): Chapter {
  const existing = getChapter(id);
  if (!existing) throw new MeaningError(404, 'not_found');
  if (existing.status === 'closed') throw new MeaningError(409, 'already_closed');
  const ts = nowMs();
  getDb()
    .update(schema.lifeChapters)
    .set({ status: 'closed', closedAt: ts, updatedAt: ts, closingReflection: closingReflection ?? null })
    .where(eq(schema.lifeChapters.id, id))
    .run();
  return getChapter(id)!;
}

/* ── Life-wheel ratings ──────────────────────────────────────────────────── */

export function createRating(input: {
  categoryId: string;
  score: number;
  reality?: string | null;
  gap?: string | null;
}): Rating {
  if (!(CATEGORY_IDS as string[]).includes(input.categoryId)) throw new MeaningError(404, 'category_not_found');
  const row = {
    id: uuid(),
    categoryId: input.categoryId,
    score: input.score,
    reality: input.reality?.trim() || null,
    gap: input.gap?.trim() || null,
    ratedAt: nowMs(),
  };
  getDb().insert(schema.categoryRatings).values(row).run();
  return row;
}

export function ratingHistory(categoryId: string): Rating[] {
  return getDb()
    .select()
    .from(schema.categoryRatings)
    .where(eq(schema.categoryRatings.categoryId, categoryId))
    .orderBy(asc(schema.categoryRatings.ratedAt))
    .all();
}

/** Latest rating per category (every category, in book order) + trend vs. the previous one. */
export function latestRatings(): LatestRating[] {
  const rows = getDb()
    .select()
    .from(schema.categoryRatings)
    .orderBy(desc(schema.categoryRatings.ratedAt))
    .all();
  return CATEGORY_IDS.map((categoryId) => {
    const mine = rows.filter((r) => r.categoryId === categoryId);
    const latest = mine[0] ?? null;
    const previousScore = mine[1]?.score ?? null;
    return {
      categoryId,
      latest,
      previousScore,
      delta: latest && previousScore !== null ? latest.score - previousScore : null,
    };
  });
}

/* ── IKIGAI ──────────────────────────────────────────────────────────────── */

type IkigaiRow = typeof schema.ikigaiProfiles.$inferSelect;

function toProfile(r: IkigaiRow): IkigaiProfile {
  return {
    ...r,
    status: r.status as IkigaiProfile['status'],
    items: (r.items as IkigaiItem[]) ?? [],
    everyday: (r.everyday as ListItem[]) ?? [],
    reflections: (r.reflections as Record<string, string>) ?? {},
  };
}

function profileByStatus(status: 'draft' | 'current'): IkigaiProfile | null {
  const row = getDb().select().from(schema.ikigaiProfiles).where(eq(schema.ikigaiProfiles.status, status)).get();
  return row ? toProfile(row) : null;
}

export function getIkigaiProfile(id: string): IkigaiProfile | null {
  const row = getDb().select().from(schema.ikigaiProfiles).where(eq(schema.ikigaiProfiles.id, id)).get();
  return row ? toProfile(row) : null;
}

export function getCurrentIkigai(): IkigaiProfile | null {
  return profileByStatus('current');
}

export interface IkigaiState {
  current: IkigaiProfile | null;
  draft: IkigaiProfile | null;
  /** completed versions (current + archived), newest first */
  history: { id: string; statement: string | null; status: string; completedAt: number | null }[];
}

export function getIkigaiState(): IkigaiState {
  const history = getDb()
    .select({
      id: schema.ikigaiProfiles.id,
      statement: schema.ikigaiProfiles.statement,
      status: schema.ikigaiProfiles.status,
      completedAt: schema.ikigaiProfiles.completedAt,
    })
    .from(schema.ikigaiProfiles)
    .where(inArray(schema.ikigaiProfiles.status, ['current', 'archived']))
    .orderBy(desc(schema.ikigaiProfiles.completedAt))
    .all();
  return { current: profileByStatus('current'), draft: profileByStatus('draft'), history };
}

/** Returns the existing draft, or starts one (empty, or a copy of the current profile). */
export function createIkigaiDraft(fromCurrent = false): IkigaiProfile {
  const existing = profileByStatus('draft');
  if (existing) return existing;
  const current = fromCurrent ? profileByStatus('current') : null;
  const ts = nowMs();
  const id = uuid();
  getDb()
    .insert(schema.ikigaiProfiles)
    .values({
      id,
      status: 'draft',
      items: current?.items ?? [],
      everyday: current?.everyday ?? [],
      statement: current?.statement ?? null,
      confidence: current?.confidence ?? null,
      reflections: current?.reflections ?? {},
      step: current ? 1 : 0,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  return getIkigaiProfile(id)!;
}

export function updateIkigai(
  id: string,
  patch: Partial<Pick<IkigaiProfile, 'items' | 'everyday' | 'statement' | 'confidence' | 'reflections' | 'step'>>,
): IkigaiProfile {
  const existing = getIkigaiProfile(id);
  if (!existing) throw new MeaningError(404, 'not_found');
  if (existing.status === 'archived') throw new MeaningError(409, 'archived');
  const set: Partial<IkigaiRow> = { updatedAt: nowMs() };
  if (patch.items !== undefined) set.items = patch.items;
  if (patch.everyday !== undefined) set.everyday = patch.everyday;
  if (patch.statement !== undefined) set.statement = patch.statement;
  if (patch.confidence !== undefined) set.confidence = patch.confidence;
  if (patch.reflections !== undefined) set.reflections = patch.reflections;
  if (patch.step !== undefined) set.step = patch.step;
  getDb().update(schema.ikigaiProfiles).set(set).where(eq(schema.ikigaiProfiles.id, id)).run();
  return getIkigaiProfile(id)!;
}

/** Promotes a draft to current; the previous current becomes archived. */
export function completeIkigai(id: string): IkigaiProfile {
  const draft = getIkigaiProfile(id);
  if (!draft) throw new MeaningError(404, 'not_found');
  if (draft.status !== 'draft') throw new MeaningError(409, 'not_a_draft');
  const issues: IkigaiCompletionIssue[] = ikigaiCompletionIssues(draft);
  if (issues.length) throw new MeaningError(422, 'incomplete', issues);
  const ts = nowMs();
  getDb().transaction((tx) => {
    tx.update(schema.ikigaiProfiles)
      .set({ status: 'archived', updatedAt: ts })
      .where(eq(schema.ikigaiProfiles.status, 'current'))
      .run();
    tx.update(schema.ikigaiProfiles)
      .set({ status: 'current', completedAt: ts, updatedAt: ts })
      .where(eq(schema.ikigaiProfiles.id, id))
      .run();
  });
  return getIkigaiProfile(id)!;
}

export function deleteIkigaiDraft(id: string): void {
  const res = getDb()
    .delete(schema.ikigaiProfiles)
    .where(and(eq(schema.ikigaiProfiles.id, id), eq(schema.ikigaiProfiles.status, 'draft')))
    .run();
  if (res.changes === 0) throw new MeaningError(404, 'not_found');
}
