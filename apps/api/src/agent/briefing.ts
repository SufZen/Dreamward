/* ============================================================================
 * apps/api — agent/briefing.ts
 * Daily briefing: a single non-tool completion against the compact digest +
 * open actions + day-of-week. Cached by local date (zero tokens on re-visit).
 * ========================================================================= */
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import { chatOnce } from '../llm/dispatch';
import { getActiveProvider } from '../llm/providers';
import { buildDigest, contentVersion } from './digest';

const HE_WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

export function todayKey(): string {
  // local date 'YYYY-MM-DD'
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface BriefingResult {
  date: string;
  content: string;
  cached: boolean;
  stale: boolean; // content changed since this briefing was generated
}

export async function getOrCreateBriefing(force = false): Promise<BriefingResult | { error: string }> {
  const db = getDb();
  const date = todayKey();
  const existing = db.select().from(schema.briefings).where(eq(schema.briefings.briefingDate, date)).get();

  if (existing && !force) {
    return { date, content: existing.content, cached: true, stale: existing.digestVersion !== contentVersion() };
  }

  const provider = getActiveProvider();
  if (!provider) return { error: 'no_active_provider' };

  const digest = buildDigest('compact');
  const weekday = HE_WEEKDAYS[new Date().getDay()];
  const isSaturday = new Date().getDay() === 6;

  const system = `אתה "חיימי" (Lify) — חבר הדרך האישי בספר החיים. צור תדריך בוקר חם, אישי ומעורר השראה (3-5 משפטים, בעברית), בגוף ראשון, כאילו אתה פונה אל חבר יקר.
התבסס על החזון, המטרות והפעולות הפתוחות שבתקציר. פתח בנימה חמה, הצע מיקוד אחד ברור להיום, וחבר אותו אל החלום הגדול של המשתמש — כדי שירגיש למה זה חשוב, לא רק מה לעשות.
${isSaturday ? 'היום שבת — הזמן בעדינות וחום לסקירה השבועית (טקס "הסקירה השבועית").' : ''}
אל תמציא תוכן שלא קיים. אל תכלול כותרת, רק את התדריך עצמו.

--- תקציר ספר החיים ---
${digest.markdown}`;

  try {
    const { content } = await chatOnce(provider, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `תן לי את תדריך הבוקר ל${weekday}.` },
      ],
      maxTokens: 600,
      signal: AbortSignal.timeout(60_000),
    });
    const text = content.trim();
    if (!text) return { error: 'empty_response' };

    db.delete(schema.briefings).where(eq(schema.briefings.briefingDate, date)).run();
    db.insert(schema.briefings)
      .values({
        id: uuid(),
        briefingDate: date,
        content: text,
        model: provider.model,
        digestVersion: digest.version,
        createdAt: nowMs(),
      })
      .run();
    return { date, content: text, cached: false, stale: false };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
