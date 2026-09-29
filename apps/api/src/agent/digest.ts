/* ============================================================================
 * apps/api — agent/digest.ts
 * Serializes the whole Dreamward into a Hebrew markdown digest for the agent.
 * Cached in module memory keyed by (tier, version=max(updatedAt)) — a cold
 * rebuild on this <100KB corpus is single-digit ms.
 * ========================================================================= */
import { asc, desc, sql } from 'drizzle-orm';
import type { ListItem } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { stripHtml, truncate } from './text';
import { computeGoalProgress } from '../services/progress';
import { getActiveChapter, getCurrentIkigai, latestRatings } from '../services/meaning';
import { chapterToText, identityToText, ikigaiToText, ratingsToText } from './meaningText';

export type DigestTier = 'full' | 'compact' | 'minimal';

export interface Digest {
  markdown: string;
  version: number;
  tier: DigestTier;
}

const TIER_LIMITS: Record<DigestTier, { item: number; total: number }> = {
  full: { item: 2000, total: 32_000 },
  compact: { item: 300, total: 12_000 },
  minimal: { item: 150, total: 6_000 },
};

/** Pick a digest tier from a provider's (possibly unknown) context length. */
export function tierForContext(contextLength: number | null): DigestTier {
  if (contextLength === null) return 'minimal'; // unknown → safest
  if (contextLength >= 32_000) return 'full';
  if (contextLength >= 16_000) return 'compact';
  return 'minimal';
}

/** max(updatedAt) across all agent-visible content. */
export function contentVersion(): number {
  const db = getDb();
  const row = db.get<{ v: number | null }>(sql`
    SELECT MAX(v) AS v FROM (
      SELECT MAX(updated_at) AS v FROM category_sections
      UNION ALL SELECT MAX(updated_at) FROM content_blocks
      UNION ALL SELECT MAX(updated_at) FROM life_vision_prompts
      UNION ALL SELECT MAX(updated_at) FROM goals
      UNION ALL SELECT MAX(updated_at) FROM journal_entries
      UNION ALL SELECT MAX(created_at) FROM actions
      UNION ALL SELECT MAX(created_at) FROM agent_memory
      UNION ALL SELECT MAX(updated_at) FROM life_chapters
      UNION ALL SELECT MAX(rated_at) FROM category_ratings
      UNION ALL SELECT MAX(updated_at) FROM ikigai_profiles
    )
  `);
  return row?.v ?? 0;
}

const cache = new Map<DigestTier, Digest>();

export function buildDigest(tier: DigestTier): Digest {
  const version = contentVersion();
  const cached = cache.get(tier);
  if (cached && cached.version === version) return cached;

  const db = getDb();
  const limits = TIER_LIMITS[tier];
  const t = (s: string) => truncate(s, limits.item);
  const parts: string[] = [];

  parts.push('# ספר החיים');

  /* ── Current chapter first — it decides what matters now ── */
  const chapter = getActiveChapter();
  if (chapter) parts.push(`\n## הפרק הנוכחי\n${t(chapterToText(chapter))}`);

  /* ── IKIGAI — the meaning above the categories ── */
  const ikigai = getCurrentIkigai();
  if (ikigai) parts.push(`\n## איקיגאי\n${t(ikigaiToText(ikigai))}`);

  /* ── Life wheel: how close is today to the vision (1-10) ── */
  const wheel = ratingsToText(latestRatings(), chapter?.focusCategoryIds);
  if (wheel) parts.push(`\n## גלגל החיים (קרבה לחזון, 1-10)\n${wheel}`);

  /* ── Life vision Q&A ── */
  const prompts = db
    .select()
    .from(schema.lifeVisionPrompts)
    .orderBy(asc(schema.lifeVisionPrompts.sortOrder))
    .all();
  const answered = prompts.filter((p) => p.answerRichtext);
  if (answered.length) {
    parts.push('\n## חיי החלומות');
    for (const p of answered) {
      if (tier === 'minimal') {
        parts.push(`- **${p.question}**: ${t(stripHtml(p.answerRichtext))}`);
      } else {
        parts.push(`### ${p.question}\n${t(stripHtml(p.answerRichtext))}`);
      }
    }
  }

  /* ── Categories × sections ── */
  const categories = db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder)).all();
  const sections = db
    .select()
    .from(schema.categorySections)
    .orderBy(asc(schema.categorySections.sortOrder))
    .all();
  const types = new Map(db.select().from(schema.sectionTypes).all().map((x) => [x.id, x]));

  if (tier !== 'minimal') {
    parts.push('\n## קטגוריות החיים');
    for (const cat of categories) {
      const catSections = sections.filter((s) => s.categoryId === cat.id);
      const body: string[] = [];
      for (const s of catSections) {
        const typeLabel = types.get(s.sectionType)?.labelHe ?? s.sectionType;
        const content = sectionToText(s);
        if (content) body.push(`**${typeLabel}** [section:${s.id}]\n${t(content)}`);
      }
      if (body.length) parts.push(`### ${cat.labelHe} (${cat.id})\n${body.join('\n')}`);
    }
  } else {
    // minimal: vision statements only
    parts.push('\n## קטגוריות (חזון בלבד)');
    for (const cat of categories) {
      const vision = sections.find((s) => s.categoryId === cat.id && s.sectionType === 'vision');
      const text = vision ? stripHtml(vision.bodyRichtext) : '';
      if (text) parts.push(`- **${cat.labelHe}**: ${t(text)}`);
    }
  }

  /* ── Content blocks ── */
  if (tier === 'full') {
    const blocks = db.select().from(schema.contentBlocks).orderBy(asc(schema.contentBlocks.sortOrder)).all();
    const withContent = blocks.filter((b) => b.bodyRichtext || hasItems(b.content));
    if (withContent.length) {
      parts.push('\n## אבני יסוד');
      for (const b of withContent) {
        const text = b.bodyRichtext ? stripHtml(b.bodyRichtext) : itemsToText(b.content);
        parts.push(`### ${b.labelHe} [block:${b.id}]\n${t(text)}`);
      }
    }
  }

  /* ── Goals (always full — small) ── */
  const goals = db.select().from(schema.goals).orderBy(asc(schema.goals.sortOrder)).all();
  parts.push('\n## מטרות');
  if (goals.length) {
    const catName = new Map(categories.map((c) => [c.id, c.labelHe]));
    const progress = computeGoalProgress();
    const riskLabel: Record<string, string> = { stalled: ' · ⚠ תקועה', at_risk: ' · ⚠ בסיכון', on_track: '' };
    for (const g of goals) {
      const cat = g.categoryId ? ` (${catName.get(g.categoryId) ?? g.categoryId})` : '';
      const due = g.targetDate ? ` · יעד: ${new Date(g.targetDate).toISOString().slice(0, 10)}` : '';
      const p = progress.get(g.id);
      const pct = p && p.pct !== null ? ` · התקדמות: ${p.pct}%` : '';
      parts.push(`- [goal:${g.id}] ${g.title}${cat} — סטטוס: ${g.status}${due}${pct}${p ? riskLabel[p.risk] : ''}`);
    }
  } else {
    parts.push('(אין מטרות מוגדרות עדיין)');
  }

  /* ── Open actions ── */
  const openActions = db
    .select()
    .from(schema.actions)
    .where(sql`${schema.actions.status} = 'todo' AND ${schema.actions.deletedAt} IS NULL`)
    .orderBy(asc(schema.actions.sortOrder))
    .all();
  if (openActions.length) {
    parts.push('\n## פעולות פתוחות');
    for (const a of openActions) {
      const due = a.dueDate ? ` · עד ${new Date(a.dueDate).toISOString().slice(0, 10)}` : '';
      parts.push(`- [action:${a.id}] ${a.title}${due}`);
    }
  }

  /* ── Recent journal ── */
  const recent = db
    .select()
    .from(schema.journalEntries)
    .orderBy(desc(schema.journalEntries.entryDate))
    .limit(5)
    .all();
  if (recent.length && tier !== 'minimal') {
    parts.push('\n## יומן אחרון');
    for (const e of recent) {
      const date = new Date(e.entryDate).toISOString().slice(0, 10);
      parts.push(`- [journal:${e.id}] ${date} — ${e.title ?? ''}: ${truncate(stripHtml(e.bodyRichtext), 200)}`);
    }
  }

  /* ── Agent memory ── */
  const memory = db
    .select()
    .from(schema.agentMemory)
    .orderBy(desc(schema.agentMemory.createdAt))
    .limit(30)
    .all();
  if (memory.length) {
    parts.push('\n## זיכרונות העוזר');
    for (const m of memory) parts.push(`- ${m.key ? `[${m.key}] ` : ''}${m.content}`);
  }

  let markdown = parts.join('\n');
  if (markdown.length > limits.total) markdown = truncate(markdown, limits.total);

  const digest: Digest = { markdown, version, tier };
  cache.set(tier, digest);
  return digest;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function hasItems(content: unknown): boolean {
  const c = content as { items?: unknown[] } | null;
  return !!c?.items?.length;
}

function itemsToText(content: unknown): string {
  const c = content as { items?: ListItem[] } | null;
  return (c?.items ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((it) => `- ${it.text}`)
    .join('\n');
}

function sectionToText(s: typeof schema.categorySections.$inferSelect): string {
  const c = s.content as
    | { items?: ListItem[]; habits?: ListItem[]; leverages?: ListItem[]; quote?: string; quoteAuthor?: string }
    | null;
  const parts: string[] = [];
  if (s.sectionType === 'identity') return identityToText((c ?? {}) as Parameters<typeof identityToText>[0]);
  if (s.bodyRichtext) parts.push(stripHtml(s.bodyRichtext));
  if (c?.items?.length) parts.push(itemsToText({ items: c.items }));
  if (c?.habits?.length) parts.push('הרגלים:\n' + itemsToText({ items: c.habits }));
  if (c?.leverages?.length) parts.push('מנופים:\n' + itemsToText({ items: c.leverages }));
  if (c?.quote) parts.push(`ציטוט: "${c.quote}"${c.quoteAuthor ? ` — ${c.quoteAuthor}` : ''}`);
  return parts.join('\n');
}
