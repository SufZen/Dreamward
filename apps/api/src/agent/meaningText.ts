/* ============================================================================
 * apps/api — agent/meaningText.ts
 * Hebrew markdown renderings of the meaning & focus layer (chapter, life
 * wheel, IKIGAI, identity sections) for the Lify digest and get_item.
 * ========================================================================= */
import {
  IKIGAI_CIRCLES,
  IKIGAI_ZONES,
  membershipKey,
  regionFor,
  type BeliefShift,
  type Chapter,
  type IkigaiProfile,
  type LatestRating,
  type ListItem,
} from '@dreamward/shared';
import { categoryLabel } from '../lib/framework';

const catHe = (id: string) => categoryLabel(id, 'he');
const isoDate = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');
const bullets = (items: ListItem[] | undefined) => (items ?? []).map((i) => `- ${i.text}`).join('\n');

export function chapterToText(ch: Chapter): string {
  const lines = [`**${ch.title}** [chapter:${ch.id}] — מאז ${isoDate(ch.startDate)}${ch.reviewDate ? ` · סקירה ב-${isoDate(ch.reviewDate)}` : ''}`];
  if (ch.intention) lines.push(`כוונה: ${ch.intention}`);
  if (ch.focusCategoryIds.length) lines.push(`תחומי מיקוד: ${ch.focusCategoryIds.map(catHe).join(', ')}`);
  if (ch.maintenanceCategoryIds.length) lines.push(`בתחזוקה בלבד: ${ch.maintenanceCategoryIds.map(catHe).join(', ')}`);
  if (ch.notNow.length) lines.push(`לא עכשיו:\n${bullets(ch.notNow)}`);
  if (ch.noLongerAcceptable.length) lines.push(`כבר לא מקובל עליי:\n${bullets(ch.noLongerAcceptable)}`);
  return lines.join('\n');
}

/** Only categories that have been rated; focus categories are marked. */
export function ratingsToText(ratings: LatestRating[], focus: string[] = []): string {
  return ratings
    .filter((r) => r.latest)
    .map((r) => {
      const l = r.latest!;
      const trend = r.delta ? ` (${r.delta > 0 ? '+' : ''}${r.delta})` : '';
      const star = focus.includes(r.categoryId) ? ' ★מיקוד' : '';
      const reality = l.reality ? ` · מצב: ${l.reality}` : '';
      const gap = l.gap ? ` · פער: ${l.gap}` : '';
      return `- ${catHe(r.categoryId)}${star}: ${l.score}/10${trend}${reality}${gap}`;
    })
    .join('\n');
}

export function ikigaiToText(p: IkigaiProfile): string {
  const lines: string[] = [];
  if (p.statement) lines.push(`**האיקיגאי שלי:** ${p.statement}${p.confidence ? ` (ביטחון ${p.confidence}/10)` : ''}`);
  const zoneItems = new Map<string, string[]>();
  for (const it of p.items) {
    const zone = regionFor(it.circles)?.zone;
    if (zone) zoneItems.set(zone, [...(zoneItems.get(zone) ?? []), it.text]);
  }
  for (const [zone, texts] of zoneItems) lines.push(`${IKIGAI_ZONES[zone as keyof typeof IKIGAI_ZONES].labelHe}: ${texts.join('; ')}`);
  for (const c of IKIGAI_CIRCLES) {
    const only = p.items.filter((it) => membershipKey(it.circles) === c.id).map((it) => it.text);
    if (only.length) lines.push(`${c.labelHe}: ${only.join('; ')}`);
  }
  if (p.everyday.length) lines.push(`איקיגאי יומיומי (שמחות קטנות): ${p.everyday.map((e) => e.text).join('; ')}`);
  return lines.join('\n');
}

export function identityToText(c: {
  statement?: string;
  states?: ListItem[];
  standards?: ListItem[];
  beliefShifts?: BeliefShift[];
}): string {
  const parts: string[] = [];
  if (c.statement) parts.push(`אני: ${c.statement}`);
  if (c.states?.length) parts.push(`מצבים פנימיים רצויים: ${c.states.map((s) => s.text).join(', ')}`);
  if (c.standards?.length) parts.push('סטנדרטים וגבולות:\n' + bullets(c.standards));
  if (c.beliefShifts?.length) parts.push('שינויי אמונה:\n' + c.beliefShifts.map((b) => `- ${b.from} → ${b.to}`).join('\n'));
  return parts.join('\n');
}
