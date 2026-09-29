/* ============================================================================
 * apps/api — agent/tools.ts
 * The agent's 5 tools (kept deliberately small — weak models degrade past ~5):
 * search_content · get_item · list_goals · list_actions · propose (write gate).
 * Execution is synchronous (better-sqlite3, sub-ms).
 * ========================================================================= */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import {
  PROPOSAL_TYPES,
  proposalEnvelopeSchema,
  type ListItem,
  type ProposalRow,
} from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import type { ToolDef } from '../llm/types';
import { stripHtml } from './text';
import { searchContent } from './searchIndex';
import { computeGoalProgress } from '../services/progress';
import { getActiveChapter, getChapter, getCurrentIkigai, getIkigaiProfile } from '../services/meaning';
import { chapterToText, identityToText, ikigaiToText } from './meaningText';

export const AGENT_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'search_content',
      description: 'חיפוש טקסט חופשי בכל ספר החיים (קטגוריות, חזון, מטרות, יומן). מחזיר קטעים תואמים עם מזהים.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'מילות חיפוש' },
          limit: { type: 'integer', default: 8 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_item',
      description: 'קריאת פריט מלא לפי סוג ומזהה (כפי שמופיע בתקציר או בתוצאות חיפוש). לפרק הנוכחי או לאיקיגאי הנוכחי אפשר להעביר id="current".',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['section', 'content_block', 'life_vision', 'goal', 'journal_entry', 'chapter', 'ikigai'],
          },
          id: { type: 'string' },
        },
        required: ['type', 'id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_goals',
      description: 'רשימת כל המטרות עם סטטוס, קטגוריה, תאריך יעד והפעולות הפתוחות שלהן.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['achieved', 'partial', 'not_achieved', 'not_relevant'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_actions',
      description: 'רשימת פעולות (משימות קטנות). סינון לפי סטטוס, עדיפות או מטרה מקושרת.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['todo', 'done'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          goal_id: { type: 'string', description: 'רק פעולות המקושרות למטרה זו' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose',
      description: 'הגשת הצעת שינוי לאישור המשתמש. לעולם אינך משנה ישירות — רק מציע.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...PROPOSAL_TYPES] },
          summary: { type: 'string', description: 'שורה אחת בשפת המשתמש המתארת את השינוי' },
          payload: { type: 'object', description: 'שדות לפי הסוג — ראה הנחיות המערכת' },
        },
        required: ['type', 'summary', 'payload'],
      },
    },
  },
];

export interface ToolOutcome {
  /** string fed back to the model as the tool result */
  result: string;
  /** short human-readable line for the UI ToolChip */
  uiSummary: string;
  /** set when the tool created a proposal row (propose) */
  proposal?: ProposalRow;
}

export function executeTool(name: string, rawArgs: string, conversationId: string): ToolOutcome {
  let args: Record<string, unknown>;
  try {
    args = rawArgs.trim() ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { result: 'שגיאה: הארגומנטים אינם JSON תקין. נסה שוב.', uiSummary: 'שגיאת קלט' };
  }

  try {
    switch (name) {
      case 'search_content':
        return toolSearch(args);
      case 'get_item':
        return toolGetItem(args);
      case 'list_goals':
        return toolListGoals(args);
      case 'list_actions':
        return toolListActions(args);
      case 'propose':
        return toolPropose(args, conversationId);
      default:
        return { result: `כלי לא מוכר: ${name}`, uiSummary: `כלי לא מוכר` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { result: `שגיאה בהרצת הכלי: ${msg}`, uiSummary: 'שגיאה' };
  }
}

/* ── tool implementations ────────────────────────────────────────────────── */

function toolSearch(args: Record<string, unknown>): ToolOutcome {
  const query = String(args.query ?? '').trim();
  const limit = Math.min(Number(args.limit) || 8, 20);
  if (!query) return { result: 'שאילתת חיפוש ריקה.', uiSummary: 'חיפוש ריק' };
  const hits = searchContent(query, limit);
  if (!hits.length) return { result: `אין תוצאות עבור "${query}".`, uiSummary: `חיפוש: ${query} (0)` };
  const lines = hits.map((h) => `[${h.docType}:${h.docId}] ${h.title} — ${h.snippet}`);
  return { result: lines.join('\n'), uiSummary: `חיפוש: ${query} (${hits.length})` };
}

function toolGetItem(args: Record<string, unknown>): ToolOutcome {
  const type = String(args.type ?? '');
  const id = String(args.id ?? '');
  const db = getDb();

  const found = (title: string, body: string): ToolOutcome => ({
    result: `# ${title}\n${body}`.slice(0, 6000),
    uiSummary: `קריאה: ${title.slice(0, 40)}`,
  });

  switch (type) {
    case 'section': {
      const s = db.select().from(schema.categorySections).where(eq(schema.categorySections.id, id)).get();
      if (!s) break;
      if (s.sectionType === 'identity') {
        const body = identityToText((s.content ?? {}) as Parameters<typeof identityToText>[0]) || '(ריק)';
        return found(`${s.categoryId} · identity [section:${s.id}]`, body);
      }
      const c = s.content as
        | { items?: ListItem[]; habits?: ListItem[]; leverages?: ListItem[]; quote?: string; quoteAuthor?: string }
        | null;
      const body = [
        stripHtml(s.bodyRichtext),
        ...(c?.items ?? []).map((i) => `- ${i.text}`),
        c?.habits?.length ? 'הרגלים:\n' + c.habits.map((i) => `- ${i.text}`).join('\n') : '',
        c?.leverages?.length ? 'מנופים:\n' + c.leverages.map((i) => `- ${i.text}`).join('\n') : '',
        c?.quote ? `ציטוט: "${c.quote}" ${c.quoteAuthor ?? ''}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      return found(`${s.categoryId} · ${s.sectionType} [section:${s.id}]`, body);
    }
    case 'content_block': {
      const b = db.select().from(schema.contentBlocks).where(eq(schema.contentBlocks.id, id)).get();
      if (!b) break;
      const items = ((b.content as { items?: ListItem[] } | null)?.items ?? []).map((i) => `- ${i.text}`);
      return found(b.labelHe, [stripHtml(b.bodyRichtext), ...items].filter(Boolean).join('\n'));
    }
    case 'life_vision': {
      const p = db.select().from(schema.lifeVisionPrompts).where(eq(schema.lifeVisionPrompts.id, id)).get();
      if (!p) break;
      return found(p.question, stripHtml(p.answerRichtext) || '(אין תשובה עדיין)');
    }
    case 'goal': {
      const g = db.select().from(schema.goals).where(eq(schema.goals.id, id)).get();
      if (!g) break;
      const acts = db
        .select()
        .from(schema.actions)
        .where(and(eq(schema.actions.goalId, id), isNull(schema.actions.deletedAt)))
        .all();
      const body = [
        g.description ?? '',
        `סטטוס: ${g.status}`,
        g.targetDate ? `יעד: ${new Date(g.targetDate).toISOString().slice(0, 10)}` : '',
        ...acts.map((a) => `- [action:${a.id}] (${a.status}) ${a.title}`),
      ]
        .filter(Boolean)
        .join('\n');
      return found(g.title, body);
    }
    case 'chapter': {
      const ch = getChapter(id) ?? (id === 'current' ? getActiveChapter() : null);
      if (!ch) break;
      return found(`פרק: ${ch.title}`, chapterToText(ch));
    }
    case 'ikigai': {
      const p = getIkigaiProfile(id) ?? (id === 'current' ? getCurrentIkigai() : null);
      if (!p) break;
      return found('איקיגאי', ikigaiToText(p) || '(עדיין ריק)');
    }
    case 'journal_entry': {
      const e = db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id)).get();
      if (!e) break;
      return found(e.title ?? 'רשומת יומן', stripHtml(e.bodyRichtext));
    }
  }
  return { result: `פריט לא נמצא: ${type}:${id}`, uiSummary: 'פריט לא נמצא' };
}

function toolListGoals(args: Record<string, unknown>): ToolOutcome {
  const db = getDb();
  let goals = db.select().from(schema.goals).orderBy(asc(schema.goals.sortOrder)).all();
  const status = args.status ? String(args.status) : null;
  if (status) goals = goals.filter((g) => g.status === status);
  if (!goals.length) return { result: 'אין מטרות.', uiSummary: 'מטרות (0)' };

  const allActions = db
    .select()
    .from(schema.actions)
    .where(isNull(schema.actions.deletedAt))
    .orderBy(desc(schema.actions.createdAt))
    .all();
  const progress = computeGoalProgress();
  const riskLabel: Record<string, string> = { stalled: ' ⚠ תקועה', at_risk: ' ⚠ בסיכון', on_track: '' };
  const lines = goals.map((g) => {
    const acts = allActions.filter((a) => a.goalId === g.id && a.status === 'todo');
    const sub = acts.map((a) => `    - [action:${a.id}] (${a.priority}) ${a.title}`).join('\n');
    const due = g.targetDate ? ` · יעד ${new Date(g.targetDate).toISOString().slice(0, 10)}` : '';
    const p = progress.get(g.id);
    const pct = p && p.pct !== null ? ` · ${p.pct}% (${p.doneActions}/${p.totalActions} פעולות)` : '';
    const risk = p ? riskLabel[p.risk] : '';
    return `- [goal:${g.id}] ${g.title} — ${g.status}${due}${pct}${risk}${sub ? '\n' + sub : ''}`;
  });
  return { result: lines.join('\n'), uiSummary: `מטרות (${goals.length})` };
}

function toolListActions(args: Record<string, unknown>): ToolOutcome {
  const db = getDb();
  let rows = db
    .select()
    .from(schema.actions)
    .where(isNull(schema.actions.deletedAt))
    .orderBy(asc(schema.actions.sortOrder))
    .all();
  const status = args.status ? String(args.status) : null;
  const priority = args.priority ? String(args.priority) : null;
  const goalId = args.goal_id ? String(args.goal_id) : null;
  if (status) rows = rows.filter((a) => a.status === status);
  if (priority) rows = rows.filter((a) => a.priority === priority);
  if (goalId) rows = rows.filter((a) => a.goalId === goalId);
  if (!rows.length) return { result: 'אין פעולות.', uiSummary: 'פעולות (0)' };

  const lines = rows.map((a) => {
    const due = a.dueDate ? ` · יעד ${new Date(a.dueDate).toISOString().slice(0, 10)}` : '';
    const link = a.linkedType ? ` · מקושר ל-[${a.linkedType}:${a.linkedId}]` : '';
    return `- [action:${a.id}] (${a.status}/${a.priority}) ${a.title}${due}${link}`;
  });
  return { result: lines.join('\n'), uiSummary: `פעולות (${rows.length})` };
}

function toolPropose(args: Record<string, unknown>, conversationId: string): ToolOutcome {
  const parsed = proposalEnvelopeSchema.safeParse(args);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { result: `הצעה לא תקינה — ${issues}. תקן ונסה שוב.`, uiSummary: 'הצעה לא תקינה' };
  }
  const db = getDb();
  const id = uuid();
  const ts = nowMs();
  db.insert(schema.proposals)
    .values({
      id,
      conversationId,
      type: parsed.data.type,
      payload: parsed.data.payload,
      summary: parsed.data.summary,
      status: 'pending',
      createdAt: ts,
    })
    .run();
  const proposal: ProposalRow = {
    id,
    conversationId,
    type: parsed.data.type,
    payload: parsed.data.payload,
    summary: parsed.data.summary,
    status: 'pending',
    error: null,
    resultRef: null,
    createdAt: ts,
    resolvedAt: null,
  };
  return {
    result: `ההצעה נרשמה (${id}) וממתינה לאישור המשתמש. אל תניח שהיא בוצעה.`,
    uiSummary: `הצעה: ${parsed.data.summary.slice(0, 50)}`,
    proposal,
  };
}
