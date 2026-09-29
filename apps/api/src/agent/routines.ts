/* ============================================================================
 * apps/api — agent/routines.ts
 * Autonomous agent routines ("the reality engine"): scheduled Lify runs that
 * review the dreamward and act. Each run is a normal agent turn in a
 * kind='routine' conversation — writes flow through the proposal system, and
 * when autoApprove is on, action-scoped proposals (create/update/complete —
 * never delete, never goal/section changes) apply immediately.
 * ========================================================================= */
import { eq } from 'drizzle-orm';
import type { ProposalRow, RoutineKind } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import { getActiveProvider } from '../llm/providers';
import { executeProposal } from '../services/proposalExecutor';
import { runAgentTurn } from './loop';
import { getOrCreateBriefing } from './briefing';

/** Proposal types a routine may apply without the user's click. */
const AUTO_APPROVABLE = new Set(['create_action', 'update_action', 'complete_action']);

const ROUTINE_PROMPTS: Record<RoutineKind, { title: string; message: string }> = {
  daily_plan: {
    title: 'תוכנית יומית (ריצה אוטומטית)',
    message: `זוהי ריצת "תוכנית יומית" אוטומטית — המשתמש לא כתב הודעה.
סקור את המטרות (list_goals, כולל אחוזי התקדמות וסיכון) ואת הפעולות הפתוחות (list_actions).
אם יש "פרק נוכחי" בתקציר — העדף פעולות בתחומי המיקוד שלו ואל תציע דברים מרשימת "לא עכשיו".
בחר את 3-5 הפעולות החשובות להיום: אם חסרות פעולות קונקרטיות למטרה חשובה — הצע create_action (עם priority ו-dueDate); אם פעולה קיימת דחופה — הצע update_action לעדכון עדיפות.
אל תיצור כפילויות של פעולות קיימות. סיים בסיכום קצר וחם של המיקוד להיום (2-3 משפטים).`,
  },
  weekly_review_prep: {
    title: 'הכנה לסקירה שבועית (ריצה אוטומטית)',
    message: `זוהי ריצת "הכנה לסקירה השבועית" אוטומטית, לקראת טקס השבת.
סקור מה קרה השבוע: פעולות שהושלמו (list_actions עם status=done), התקדמות מטרות (list_goals), ונושאים מהיומן (search_content אם צריך).
כתוב סיכום שבועי קצר ומעודד: מה הושג, איפה יש מומנטום, ומה שווה להביא לסקירה של שבת.
אם יש גלגל חיים בתקציר — ציין את הפער הגדול ביותר בתחומי המיקוד של הפרק הנוכחי, והצע צעד מנוף קטן אחד לסגירתו. אם עולות 1-2 פעולות מתבקשות לשבוע הבא — הצע create_action.`,
  },
  goal_drift: {
    title: 'איתור מטרות תקועות (ריצה אוטומטית)',
    message: `זוהי ריצת "איתור סחף מטרות" אוטומטית.
בדוק ב-list_goals אילו מטרות מסומנות תקועות (⚠) או בסיכון. עבור כל אחת: אם חסר צעד קטן וברור — הצע create_action ממוקד; אם המטרה כבר לא רלוונטית — הצע update_goal_status עם הסבר בשדה note.
אל תציף: עד 3 הצעות סה"כ, רק המשמעותיות ביותר. סיים במשפט-שניים על מצב המומנטום הכללי.`,
  },
};

export interface RoutineRunResult {
  conversationId: string;
  proposals: number;
  autoApplied: number;
}

/**
 * Runs one routine inside an existing user DB context.
 * Throws with a readable message on failure (recorded in lastStatus).
 */
export async function runRoutine(kind: RoutineKind, autoApprove: boolean): Promise<RoutineRunResult> {
  const provider = getActiveProvider();
  if (!provider) throw new Error('no_provider');

  const db = getDb();
  const prompt = ROUTINE_PROMPTS[kind];
  const conversationId = uuid();
  const ts = nowMs();
  db.insert(schema.agentConversations)
    .values({ id: conversationId, title: prompt.title, kind: 'routine', createdAt: ts, updatedAt: ts })
    .run();

  const captured: ProposalRow[] = [];
  await runAgentTurn({
    provider,
    conversationId,
    userMessage: prompt.message,
    emit: (ev) => {
      if (ev.type === 'proposal') captured.push(ev.proposal);
    },
    signal: AbortSignal.timeout(180_000),
  });

  let autoApplied = 0;
  if (autoApprove) {
    for (const p of captured) {
      if (!AUTO_APPROVABLE.has(p.type)) continue; // goal/section/delete changes stay pending
      try {
        const resultRef = executeProposal(p.type, p.payload, conversationId, p.id);
        db.update(schema.proposals)
          .set({ status: 'approved', resultRef, resolvedAt: nowMs() })
          .where(eq(schema.proposals.id, p.id))
          .run();
        autoApplied++;
      } catch (err) {
        db.update(schema.proposals)
          .set({ status: 'failed', error: err instanceof Error ? err.message : String(err), resolvedAt: nowMs() })
          .where(eq(schema.proposals.id, p.id))
          .run();
      }
    }
  }

  // The daily plan feeds the morning briefing — regenerate it with fresh actions.
  if (kind === 'daily_plan') {
    try {
      await getOrCreateBriefing(true);
    } catch {
      /* briefing refresh is best-effort */
    }
  }

  return { conversationId, proposals: captured.length, autoApplied };
}
