import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Plus, Lightbulb, AlertTriangle, CheckCircle2, Target } from 'lucide-react';
import {
  IKIGAI_CIRCLES,
  IKIGAI_CIRCLE_IDS,
  insightsFor,
  type IkigaiCircle,
  type IkigaiItem,
  type ListItem,
} from '@dreamward/shared';
import { Button, Card, Textarea, cn } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { ApiError } from '@/lib/api';
import { sanitizeHtml } from '@/lib/sanitize';
import { ChipInput } from '@/components/ChipInput';
import { ScoreSlider } from '@/components/ScoreSlider';
import { useContentBlock } from '@/features/book/hooks';
import { useCreateAction } from '@/features/actions/hooks';
import { IkigaiVenn, groupByRegion, regionName } from './IkigaiVenn';
import { useAiAvailable, useIkigaiSuggest } from './hooks';

const newId = () => crypto.randomUUID().slice(0, 12);
const circleDef = (id: IkigaiCircle) => IKIGAI_CIRCLES.find((c) => c.id === id)!;

/* ── Clarity suggestions (ghost chips) ──────────────────────────────────────── */

function SuggestBox({
  request,
  onAccept,
  label,
}: {
  request: () => Promise<string[]>;
  onAccept: (text: string) => void;
  label: string;
}) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: available } = useAiAvailable();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!available) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setSuggestions(await request());
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? he
            ? 'אין ספק AI פעיל'
            : 'No active AI provider'
          : he
            ? 'לא התקבלו הצעות מ-Clarity כרגע — נסה שוב'
            : 'Clarity couldn’t suggest anything right now — try again',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[color:var(--rz-border-accent)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">
          {he ? 'רעיונות מ-Clarity, מתוך ספר החיים שלך' : 'Clarity can suggest ideas from your own book'}
        </span>
        <Button variant="ghost" size="sm" onClick={run} loading={loading}>
          <Sparkles size={14} className="text-primary" /> {label}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  onAccept(s);
                  setSuggestions((xs) => xs.filter((x) => x !== s));
                }}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-fg-muted hover:border-primary hover:text-foreground"
              >
                <Plus size={13} />
                <span dir="auto">{s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Step: one circle ────────────────────────────────────────────────────── */

export function CircleStep({
  circle,
  items,
  onItems,
  profileId,
}: {
  circle: IkigaiCircle;
  items: IkigaiItem[];
  onItems: (items: IkigaiItem[]) => void;
  profileId: string;
}) {
  const { lang } = useLang();
  const he = lang === 'he';
  const def = circleDef(circle);
  const suggest = useIkigaiSuggest();
  const mine = items.filter((it) => it.circles.includes(circle));

  // 'lify' is the stored value for assistant suggestions (data format, never renamed).
  const add = (text: string, source: 'user' | 'lify' = 'user') => {
    const existing = items.find((it) => it.text.trim().toLowerCase() === text.trim().toLowerCase());
    if (existing) {
      if (!existing.circles.includes(circle))
        onItems(items.map((it) => (it.id === existing.id ? { ...it, circles: [...it.circles, circle] } : it)));
      return;
    }
    onItems([...items, { id: newId(), text: text.trim(), circles: [circle], source }]);
  };
  const remove = (id: string) =>
    onItems(
      items
        .map((it) => (it.id === id ? { ...it, circles: it.circles.filter((c) => c !== circle) } : it))
        .filter((it) => it.circles.length > 0),
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ background: def.color }} />
        <h2 className="text-3xl font-bold">{pickLabel(lang, def.questionEn, def.questionHe)}</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(he ? def.promptsHe : def.promptsEn).map((p) => (
          <div key={p} className="flex items-start gap-2 rounded-lg bg-surface p-3 text-sm text-fg-muted">
            <Lightbulb size={15} className="mt-0.5 shrink-0" style={{ color: def.color }} />
            <span>{p}</span>
          </div>
        ))}
      </div>

      <ChipInput
        chips={mine}
        onAdd={(t) => add(t)}
        onRemove={remove}
        color={def.color}
        placeholder={he ? 'כתוב תשובה ולחץ Enter…' : 'Type an answer and press Enter…'}
        addLabel={he ? 'הוסף' : 'Add'}
      />

      <SuggestBox
        label={he ? 'הצע מתוך הספר שלי' : 'Suggest from my book'}
        onAccept={(t) => add(t, 'lify')}
        request={() => suggest.mutateAsync({ mode: 'circle', circle, profileId, lang })}
      />

      <p className="text-xs text-fg-faint">
        {he
          ? 'אין תשובות נכונות. כתוב מהר, בלי לסנן — נמיין בהמשך. 3-7 פריטים זה מצוין.'
          : 'There are no right answers. Write fast, don’t filter — we’ll sort later. 3–7 items is great.'}
      </p>
    </div>
  );
}

/* ── Step: map items to all the circles they belong to ───────────────────── */

export function MapStep({ items, onItems }: { items: IkigaiItem[]; onItems: (items: IkigaiItem[]) => void }) {
  const { lang } = useLang();
  const he = lang === 'he';

  const toggle = (id: string, circle: IkigaiCircle) =>
    onItems(
      items.map((it) => {
        if (it.id !== id) return it;
        const has = it.circles.includes(circle);
        if (has && it.circles.length === 1) return it; // every item keeps at least one circle
        return { ...it, circles: has ? it.circles.filter((c) => c !== circle) : [...it.circles, circle] };
      }),
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-3xl font-bold">{he ? 'איפה עוד זה נכון?' : 'Where else is it true?'}</h2>
        <p className="mt-1 text-fg-muted">
          {he
            ? 'לכל פריט, סמן את כל המעגלים שהוא שייך אליהם. כאן נולדות החפיפות.'
            : 'For each item, mark every circle it belongs to. This is where the overlaps are born.'}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 xl:flex-row xl:items-center">
              <span dir="auto" className="flex-1 text-sm">
                {it.text}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {IKIGAI_CIRCLE_IDS.map((c) => {
                  const d = circleDef(c);
                  const on = it.circles.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(it.id, c)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition-colors',
                        on ? 'text-foreground' : 'border-border text-fg-faint hover:text-fg-muted',
                      )}
                      style={on ? { borderColor: d.color, background: `${d.color}26` } : undefined}
                    >
                      {pickLabel(lang, d.labelEn, d.labelHe)}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-fg-faint">{he ? 'עוד אין פריטים — חזור לשלבים הקודמים.' : 'No items yet — go back to the earlier steps.'}</p>
          )}
        </ul>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <IkigaiVenn items={items} mini />
        </div>
      </div>
    </div>
  );
}

/* ── Step: the picture + insights ────────────────────────────────────────── */

export function VennInsights({ items }: { items: IkigaiItem[] }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const [selected, setSelected] = useState<string | null>('love+good+needs+paid');
  const groups = groupByRegion(items);
  const sel = selected ? groups.get(selected) : undefined;
  const insights = insightsFor(items);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <IkigaiVenn items={items} selected={selected} onSelect={setSelected} />
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          {sel ? (
            <>
              <h3 className="mb-2 font-semibold">{regionName(sel.region, lang)}</h3>
              {!sel.region.exact && (
                <p className="mb-2 text-xs text-fg-faint">
                  {he ? 'צירוף של מעגלים מנוגדים — מוצג ליד המרכז.' : 'Opposite circles — shown near the centre.'}
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {sel.items.map((it) => (
                  <li key={it.id} dir="auto" className="text-sm">
                    • {it.text}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-fg-muted">
              {selected
                ? he
                  ? 'אין עדיין פריטים באזור הזה.'
                  : 'Nothing in this area yet.'
                : he
                  ? 'לחץ על אזור בתרשים כדי לראות מה נמצא בו.'
                  : 'Tap an area of the diagram to see what’s in it.'}
            </p>
          )}
        </Card>
        {insights.length > 0 && (
          <ul className="flex flex-col gap-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-surface p-3 text-sm">
                {ins.kind === 'center' ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                ) : ins.kind === 'missing_one' ? (
                  <Lightbulb size={16} className="mt-0.5 shrink-0 text-primary" />
                ) : (
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
                )}
                <span>{he ? ins.textHe : ins.textEn}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function VennStep({ items }: { items: IkigaiItem[] }) {
  const { lang } = useLang();
  const he = lang === 'he';
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-3xl font-bold">{he ? 'התמונה שלך' : 'Your picture'}</h2>
        <p className="mt-1 text-fg-muted">
          {he
            ? 'הנקודות במרכז הן המועמדות החזקות לאיקיגאי. האזורים הריקים מראים איפה כדאי לחקור.'
            : 'Dots in the centre are the strongest IKIGAI candidates. Empty areas show where to explore.'}
        </p>
      </div>
      <VennInsights items={items} />
    </div>
  );
}

/* ── Step: everyday ikigai ───────────────────────────────────────────────── */

export function EverydayStep({
  everyday,
  onEveryday,
  profileId,
}: {
  everyday: ListItem[];
  onEveryday: (items: ListItem[]) => void;
  profileId: string;
}) {
  const { lang } = useLang();
  const he = lang === 'he';
  const suggest = useIkigaiSuggest();
  const { data: happy } = useContentBlock('what_makes_me_happy');
  const add = (text: string) => {
    if (everyday.some((e) => e.text.trim().toLowerCase() === text.trim().toLowerCase())) return;
    onEveryday([...everyday, { id: newId(), text: text.trim(), order: everyday.length }]);
  };
  const remove = (id: string) => onEveryday(everyday.filter((e) => e.id !== id).map((e, i) => ({ ...e, order: i })));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-3xl font-bold">{he ? 'האיקיגאי היומיומי' : 'Everyday ikigai'}</h2>
        <p className="mt-1 text-fg-muted">
          {he
            ? 'ביפן, איקיגאי הוא לא רק ייעוד גדול — הוא גם הדברים הקטנים שבגללם שווה לקום בבוקר. מה הם אצלך?'
            : 'In Japan, ikigai isn’t only a grand calling — it’s also the small things that make getting up worth it. What are yours?'}
        </p>
      </div>

      {happy?.bodyRichtext && (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm text-fg-muted">
            {he ? 'מתוך "מה מדליק אותי" בספר שלך' : 'From “What lights me up” in your book'}
          </summary>
          <div dir="auto" className="dw-prose mt-3 text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(happy.bodyRichtext) }} />
        </details>
      )}

      <ChipInput
        chips={everyday}
        onAdd={add}
        onRemove={remove}
        placeholder={he ? 'למשל: הקפה הראשון של הבוקר' : 'e.g. the first coffee of the morning'}
        addLabel={he ? 'הוסף' : 'Add'}
      />
      <SuggestBox
        label={he ? 'הצע שמחות קטנות' : 'Suggest small joys'}
        onAccept={add}
        request={() => suggest.mutateAsync({ mode: 'everyday', profileId, lang })}
      />
    </div>
  );
}

/* ── Step: synthesis ─────────────────────────────────────────────────────── */

export function SynthesisStep({
  profileId,
  items,
  statement,
  onStatement,
  confidence,
  onConfidence,
  why,
  onWhy,
}: {
  profileId: string;
  items: IkigaiItem[];
  statement: string;
  onStatement: (s: string) => void;
  confidence: number | null;
  onConfidence: (n: number) => void;
  why: string;
  onWhy: (s: string) => void;
}) {
  const { lang } = useLang();
  const he = lang === 'he';
  const suggest = useIkigaiSuggest();
  const createAction = useCreateAction();
  const [step, setStep] = useState('');
  const [stepDone, setStepDone] = useState(false);
  const groups = groupByRegion(items);
  const strongest = [...groups.values()]
    .filter((g) => g.region.key.split('+').length >= 2)
    .sort((a, b) => b.region.key.split('+').length - a.region.key.split('+').length);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-3xl font-bold">{he ? 'האיקיגאי שלי — עכשיו' : 'My IKIGAI — right now'}</h2>
        <p className="mt-1 text-fg-muted">
          {he
            ? 'זה לא נצחי. זו ההבנה הכי טובה שלך כרגע — מספיק טובה כדי לפעול לפיה, ולעדכן בהמשך.'
            : 'It isn’t forever. It’s your best understanding right now — good enough to act on, and to revise later.'}
        </p>
      </div>

      {strongest.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-fg-faint">{he ? 'החפיפות שלך' : 'Your overlaps'}</span>
          <ul className="flex flex-col gap-1.5">
            {strongest.slice(0, 6).map((g) => (
              <li key={g.region.key} className="text-sm">
                <span className="font-medium text-primary">{regionName(g.region, lang)}:</span>{' '}
                <span dir="auto">{g.items.map((i) => i.text).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{he ? 'האיקיגאי שלי כרגע הוא…' : 'My ikigai right now is…'}</span>
        <Textarea dir="auto" rows={3} value={statement} onChange={(e) => onStatement(e.target.value)} className="text-base" />
      </label>

      <SuggestBox
        label={he ? 'נסח לי 3 אפשרויות' : 'Draft 3 options'}
        onAccept={onStatement}
        request={() => suggest.mutateAsync({ mode: 'statement', profileId, lang })}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{he ? 'למה זה חשוב לי? (אופציונלי)' : 'Why does this matter to me? (optional)'}</span>
        <Textarea dir="auto" rows={2} value={why} onChange={(e) => onWhy(e.target.value)} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{he ? 'כמה זה מרגיש נכון?' : 'How true does this feel?'}</span>
        <ScoreSlider
          value={confidence ?? 0}
          onChange={onConfidence}
          label={he ? 'ביטחון' : 'Confidence'}
          lowHint={he ? 'ניחוש ראשון' : 'First guess'}
          highHint={he ? 'זה אני' : 'This is me'}
        />
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-primary" />
          <span className="text-sm font-medium">
            {he ? 'צעד ראשון קטן כדי לבדוק את זה בחיים' : 'One small first step to test this in real life'}
          </span>
        </div>
        {stepDone ? (
          <p className="text-sm text-success">
            {he ? 'נוסף לפעולות ✓ ' : 'Added to your actions ✓ '}
            <Link to="/actions" className="underline">
              {he ? 'לפעולות' : 'View actions'}
            </Link>
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              dir="auto"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              placeholder={he ? 'למשל: לשוחח עם מישהו שכבר עושה את זה' : 'e.g. talk with someone who already does this'}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
            />
            <Button
              variant="secondary"
              disabled={!step.trim()}
              loading={createAction.isPending}
              onClick={() =>
                createAction.mutate(
                  { title: step.trim(), priority: 'high', linkedType: 'ikigai', linkedId: profileId },
                  { onSuccess: () => setStepDone(true) },
                )
              }
            >
              <Plus size={14} /> {he ? 'לפעולות' : 'Add action'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
