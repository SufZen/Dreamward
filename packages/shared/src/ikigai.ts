/* ============================================================================
 * @dreamward/shared — ikigai.ts
 * IKIGAI domain: the four circles, their overlap zones, Venn geometry and the
 * pure rules that turn a set of items into zones + insights. Used by the api
 * (completion validation, digest) and the web (wizard + Venn).
 *
 * Layout (600×600 viewBox): Love top, Good-at left, World-needs right,
 * Paid-for bottom. Adjacent circles overlap into the four classic zones;
 * all four meet in the centre. Opposite pairs (love+paid, good+needs) have no
 * region of their own in this layout — they are drawn near the centre and
 * flagged `exact: false`.
 * ========================================================================= */

export const IKIGAI_CIRCLE_IDS = ['love', 'good', 'needs', 'paid'] as const;
export type IkigaiCircle = (typeof IKIGAI_CIRCLE_IDS)[number];

export interface IkigaiCircleDef {
  id: IkigaiCircle;
  labelEn: string;
  labelHe: string;
  questionEn: string;
  questionHe: string;
  promptsEn: string[];
  promptsHe: string[];
  /** hex colour — the Venn fill and the item pills */
  color: string;
  /** Venn circle centre */
  cx: number;
  cy: number;
}

export const IKIGAI_VIEWBOX = 600;
export const IKIGAI_RADIUS = 170;

export const IKIGAI_CIRCLES: IkigaiCircleDef[] = [
  {
    id: 'love',
    labelEn: 'What you love',
    labelHe: 'מה שאתה אוהב',
    questionEn: 'What do you love?',
    questionHe: 'מה אתה אוהב?',
    promptsEn: [
      'When do you lose track of time?',
      'What did you love doing as a child?',
      'What would you do even if nobody paid you?',
      'Which topics could you talk about for hours?',
    ],
    promptsHe: [
      'מתי אתה מאבד את תחושת הזמן?',
      'מה אהבת לעשות כשהיית ילד?',
      'מה היית עושה גם אם אף אחד לא היה משלם לך?',
      'על אילו נושאים תוכל לדבר שעות?',
    ],
    color: '#f472b6',
    cx: 300,
    cy: 190,
  },
  {
    id: 'good',
    labelEn: 'What you are good at',
    labelHe: 'מה שאתה טוב בו',
    questionEn: 'What are you good at?',
    questionHe: 'במה אתה טוב?',
    promptsEn: [
      'What do people ask you for help with?',
      'What comes easily to you that others find hard?',
      'Which skills have you been praised for?',
      'What have you practised for years?',
    ],
    promptsHe: [
      'במה אנשים מבקשים את עזרתך?',
      'מה בא לך בקלות וקשה לאחרים?',
      'על אילו כישורים קיבלת מחמאות?',
      'במה התאמנת במשך שנים?',
    ],
    color: '#60a5fa',
    cx: 190,
    cy: 300,
  },
  {
    id: 'needs',
    labelEn: 'What the world needs',
    labelHe: 'מה שהעולם צריך',
    questionEn: 'What does the world need (from you)?',
    questionHe: 'מה העולם צריך (ממך)?',
    promptsEn: [
      'Which problems move you or make you angry?',
      'Who would you love to help?',
      'What change would you like to see around you?',
      'What do the people close to you need most?',
    ],
    promptsHe: [
      'אילו בעיות מזיזות לך או מכעיסות אותך?',
      'למי היית רוצה לעזור?',
      'איזה שינוי היית רוצה לראות סביבך?',
      'מה האנשים הקרובים אליך הכי צריכים?',
    ],
    color: '#34d399',
    cx: 410,
    cy: 300,
  },
  {
    id: 'paid',
    labelEn: 'What you can be paid for',
    labelHe: 'מה שמשלמים לך עליו',
    questionEn: 'What can you be paid for?',
    questionHe: 'על מה אפשר לשלם לך?',
    promptsEn: [
      'What have you been paid for in the past?',
      'What would people pay you to solve for them?',
      'Which of your skills are in demand?',
      'What could become a product, service or role?',
    ],
    promptsHe: [
      'על מה שילמו לך בעבר?',
      'מה אנשים היו משלמים לך כדי שתפתור עבורם?',
      'אילו מהכישורים שלך מבוקשים?',
      'מה יכול להפוך למוצר, שירות או תפקיד?',
    ],
    color: '#fbbf24',
    cx: 300,
    cy: 410,
  },
];

export const IKIGAI_ZONE_IDS = ['passion', 'mission', 'vocation', 'profession', 'ikigai'] as const;
export type IkigaiZone = (typeof IKIGAI_ZONE_IDS)[number];

export const IKIGAI_ZONES: Record<
  IkigaiZone,
  { labelEn: string; labelHe: string; circles: IkigaiCircle[]; x: number; y: number }
> = {
  passion: { labelEn: 'Passion', labelHe: 'תשוקה', circles: ['love', 'good'], x: 205, y: 205 },
  mission: { labelEn: 'Mission', labelHe: 'שליחות', circles: ['love', 'needs'], x: 395, y: 205 },
  profession: { labelEn: 'Profession', labelHe: 'מקצוע', circles: ['good', 'paid'], x: 205, y: 395 },
  vocation: { labelEn: 'Vocation', labelHe: 'ייעוד', circles: ['needs', 'paid'], x: 395, y: 395 },
  ikigai: { labelEn: 'IKIGAI', labelHe: 'איקיגאי', circles: ['love', 'good', 'needs', 'paid'], x: 300, y: 300 },
};

export interface IkigaiItem {
  id: string;
  text: string;
  circles: IkigaiCircle[];
  source?: 'user' | 'lify';
}

export interface IkigaiRegion {
  /** canonical membership key, circles in IKIGAI_CIRCLE_IDS order, joined by '+' */
  key: string;
  /** the named classic zone, when the membership is exactly one of them */
  zone: IkigaiZone | null;
  /** where to anchor the item in the 600×600 Venn */
  x: number;
  y: number;
  /** false when the layout has no region for this exact membership (opposite pairs) */
  exact: boolean;
}

/** Anchor points per canonical membership key — each verified to lie inside
 *  exactly the member circles (except the two opposite pairs). */
const ANCHORS: Record<string, { x: number; y: number; exact: boolean }> = {
  love: { x: 300, y: 62, exact: true },
  good: { x: 62, y: 300, exact: true },
  needs: { x: 538, y: 300, exact: true },
  paid: { x: 300, y: 538, exact: true },
  'love+good': { x: 205, y: 205, exact: true },
  'love+needs': { x: 395, y: 205, exact: true },
  'good+paid': { x: 205, y: 395, exact: true },
  'needs+paid': { x: 395, y: 395, exact: true },
  'love+paid': { x: 300, y: 268, exact: false },
  'good+needs': { x: 268, y: 300, exact: false },
  'love+good+needs': { x: 300, y: 234, exact: true },
  'love+good+paid': { x: 234, y: 300, exact: true },
  'love+needs+paid': { x: 366, y: 300, exact: true },
  'good+needs+paid': { x: 300, y: 366, exact: true },
  'love+good+needs+paid': { x: 300, y: 300, exact: true },
};

/** Canonical key: dedupe + sort by circle order. */
export function membershipKey(circles: readonly IkigaiCircle[]): string {
  return IKIGAI_CIRCLE_IDS.filter((c) => circles.includes(c)).join('+');
}

/** Maps an item's circle membership to its Venn region. Null for no circles. */
export function regionFor(circles: readonly IkigaiCircle[]): IkigaiRegion | null {
  const key = membershipKey(circles);
  const anchor = ANCHORS[key];
  if (!anchor) return null;
  const zone =
    (Object.entries(IKIGAI_ZONES) as [IkigaiZone, (typeof IKIGAI_ZONES)[IkigaiZone]][]).find(
      ([, z]) => membershipKey(z.circles) === key,
    )?.[0] ?? null;
  return { key, zone, ...anchor };
}

/* ── Insights ────────────────────────────────────────────────────────────── */

export type IkigaiInsightKind = 'empty_circle' | 'missing_one' | 'center' | 'no_overlap';

export interface IkigaiInsight {
  kind: IkigaiInsightKind;
  /** empty_circle: the empty circle · missing_one: the circle that is missing */
  circle?: IkigaiCircle;
  /** how many items back this insight */
  count?: number;
  textEn: string;
  textHe: string;
}

/** The classic "three of four" readings of the IKIGAI diagram, keyed by the missing circle. */
const MISSING_ONE: Record<IkigaiCircle, { en: string; he: string }> = {
  paid: {
    en: 'Delight and fullness — but no wealth yet. Look for a way this could sustain you.',
    he: 'עונג ומלאות — אבל עוד בלי פרנסה. חפש איך זה יכול גם לקיים אותך.',
  },
  needs: {
    en: 'Satisfaction — but a feeling of uselessness. Ask who this could truly serve.',
    he: 'סיפוק — אבל תחושת חוסר תועלת. שאל את מי זה יכול באמת לשרת.',
  },
  love: {
    en: 'Comfortable — but a feeling of emptiness. What part of it could you come to love?',
    he: 'נוחות — אבל תחושת ריקנות. איזה חלק בזה תוכל לאהוב?',
  },
  good: {
    en: 'Excitement and complacency — but uncertainty. Which skill would make you confident here?',
    he: 'התלהבות ושאננות — אבל חוסר ודאות. איזו מיומנות תיתן לך כאן ביטחון?',
  },
};

export function insightsFor(items: readonly IkigaiItem[]): IkigaiInsight[] {
  const out: IkigaiInsight[] = [];

  for (const c of IKIGAI_CIRCLES) {
    if (!items.some((it) => it.circles.includes(c.id))) {
      out.push({
        kind: 'empty_circle',
        circle: c.id,
        textEn: `Nothing in “${c.labelEn}” yet — this circle needs attention.`,
        textHe: `עדיין אין כלום ב“${c.labelHe}” — המעגל הזה מחכה לך.`,
      });
    }
  }

  const center = items.filter((it) => membershipKey(it.circles) === 'love+good+needs+paid').length;
  if (center) {
    out.push({
      kind: 'center',
      count: center,
      textEn: `${center} item(s) sit in all four circles — strong candidates for your IKIGAI.`,
      textHe: `${center} פריטים נמצאים בכל ארבעת המעגלים — מועמדים חזקים לאיקיגאי שלך.`,
    });
  }

  for (const missing of IKIGAI_CIRCLE_IDS) {
    const others = IKIGAI_CIRCLE_IDS.filter((c) => c !== missing);
    const count = items.filter((it) => membershipKey(it.circles) === membershipKey(others)).length;
    if (count) {
      out.push({ kind: 'missing_one', circle: missing, count, textEn: MISSING_ONE[missing].en, textHe: MISSING_ONE[missing].he });
    }
  }

  if (items.length && items.every((it) => membershipKey(it.circles).split('+').length < 2)) {
    out.push({
      kind: 'no_overlap',
      textEn: 'No overlaps yet. In the mapping step, mark every circle each item belongs to.',
      textHe: 'עדיין אין חפיפות. בשלב המיפוי סמן לכל פריט את כל המעגלים שהוא שייך אליהם.',
    });
  }
  return out;
}

/* ── Completion ──────────────────────────────────────────────────────────── */

export type IkigaiCompletionIssue = { kind: 'empty_circle'; circle: IkigaiCircle } | { kind: 'no_statement' };

/** A profile can be completed once every circle has an item and a statement exists. */
export function ikigaiCompletionIssues(p: { items: readonly IkigaiItem[]; statement: string | null }): IkigaiCompletionIssue[] {
  const issues: IkigaiCompletionIssue[] = [];
  for (const c of IKIGAI_CIRCLE_IDS) {
    if (!p.items.some((it) => it.circles.includes(c))) issues.push({ kind: 'empty_circle', circle: c });
  }
  if (!p.statement?.trim()) issues.push({ kind: 'no_statement' });
  return issues;
}
