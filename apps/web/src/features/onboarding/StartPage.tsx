import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import {
  MAX_FOCUS_AREAS,
  ONBOARDING_STEPS,
  firstOpenStep,
  type Chapter,
  type OnboardingStep,
} from '@dreamward/shared';
import { Button, Card, Input, Textarea, buttonVariants, cn } from '@dreamward/design-system';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';
import { Stepper, type StepperStep } from '@/components/Stepper';
import { ScoreSlider } from '@/components/ScoreSlider';
import { OnboardingMotion, type MotionName } from '@/components/OnboardingMotion';
import { useAreaLabel, useCategories } from '@/features/book/hooks';
import { useCurrentChapter, useLatestRatings } from '@/features/chapter/hooks';
import { useAiAvailable } from '@/features/ikigai/hooks';
import { strategySectionId, useOnboarding, useOnboardingSuggest, useSetOnboardingStatus } from './hooks';

const STEPS: (StepperStep & { key: OnboardingStep; motion: MotionName })[] = [
  { key: 'chapter', en: 'Your chapter', he: 'הפרק שלך', motion: 'chapter' },
  { key: 'wheel', en: 'Your wheel', he: 'גלגל החיים', motion: 'wheel' },
  { key: 'focus', en: 'Your focus', he: 'המיקוד שלך', motion: 'wheel' },
  { key: 'ikigai', en: 'IKIGAI', he: 'איקיגאי', motion: 'ikigai' },
  { key: 'move', en: 'First move', he: 'הצעד הראשון', motion: 'steps' },
];

/* Per-browser conveniences only — the book itself is the source of truth. */
const SCORES_KEY = 'dw.start.scores';
const IKIGAI_SEEN_KEY = 'dw.start.ikigaiSeen';
const readSession = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeSession = (key: string, value: unknown) => {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — fine */
  }
};

/** Guided start: from an empty book to a first move in about ten minutes. */
export function StartPage() {
  const { t } = useLang();
  const { data: onboarding } = useOnboarding();
  const { data: chapter } = useCurrentChapter();
  const { data: latest } = useLatestRatings();
  const { data: categories } = useCategories();
  const ready = onboarding !== undefined && chapter !== undefined && latest !== undefined && categories !== undefined;

  if (!ready) return <p className="text-fg-muted">{t('loading')}</p>;
  return <Flow chapter={chapter} />;
}

function Flow({ chapter }: { chapter: Chapter | null }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const areaLabel = useAreaLabel();
  const { data: onboarding } = useOnboarding();
  const { data: latest } = useLatestRatings();
  const { data: categories } = useCategories();
  const { data: aiAvailable } = useAiAvailable();
  const setStatus = useSetOnboardingStatus();
  const suggest = useOnboardingSuggest();

  const [ikigaiSeen, setIkigaiSeen] = useState(() => params.get('from') === 'ikigai' || readSession(IKIGAI_SEEN_KEY, false));
  const [step, setStep] = useState<number>(() => {
    const open = firstOpenStep(onboarding!.progress, { ikigaiSeen });
    return open === 'done' ? -1 : ONBOARDING_STEPS.indexOf(open);
  });
  const [done, setDone] = useState(step === -1);
  const [title, setTitle] = useState(chapter?.title ?? '');
  const [intention, setIntention] = useState(chapter?.intention ?? '');
  const [scores, setScores] = useState<Record<string, number>>(() => readSession(SCORES_KEY, {}));
  const [focus, setFocus] = useState<string[]>(chapter?.focusCategoryIds ?? []);
  const [gaps, setGaps] = useState<Record<string, string>>({});
  const [move, setMove] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  // Gaps already written, so going Back and forward never appends a duplicate rating.
  const postedGaps = useRef<Record<string, string>>({});

  useEffect(() => writeSession(SCORES_KEY, Object.keys(scores).length ? scores : null), [scores]);
  useEffect(() => heading.current?.focus(), [step, done]);

  const latestScore = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of latest ?? []) if (r.latest) m[r.categoryId] = r.latest.score;
    return m;
  }, [latest]);
  const scoreOf = (id: string): number | undefined => scores[id] ?? latestScore[id];
  // The three lowest-rated areas are hinted as focus candidates.
  const lowest = useMemo(
    () =>
      (categories ?? [])
        .filter((c) => scoreOf(c.id) !== undefined)
        .sort((a, b) => scoreOf(a.id)! - scoreOf(b.id)!)
        .slice(0, 3)
        .map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, scores, latestScore],
  );

  const refresh = () =>
    Promise.all(
      [['onboarding'], ['chapter'], ['chapters'], ['ratings'], ['actions']].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    );

  /** Runs one save; on failure the user stays on the step with an error. */
  const run = async (fn: () => Promise<unknown>, after: () => void) => {
    setSaving(true);
    setError(false);
    try {
      await fn();
      await refresh();
      after();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const go = (n: number) => {
    setError(false);
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const next = () => go(step + 1);
  const back = () => go(Math.max(0, step - 1));

  /* ── step actions ─────────────────────────────────────────────────────── */
  const saveChapter = () =>
    run(async () => {
      // Re-read: an agent or another tab may have started a chapter meanwhile.
      const { chapter: active } = await api.get<{ chapter: Chapter | null }>('/chapters/current');
      const body = { title: title.trim(), intention: intention.trim() || null };
      if (active) await api.put(`/chapters/${active.id}`, body);
      else await api.post('/chapters', body);
    }, next);

  /** Ratings are append-only, so the wheel is written once, with the focus gaps. */
  const flushRatings = async () => {
    const newGap = (id: string) => {
      const g = gaps[id]?.trim();
      return focus.includes(id) && g && postedGaps.current[id] !== g ? g : null;
    };
    const ids = new Set([...Object.keys(scores), ...focus.filter((id) => newGap(id))]);
    for (const categoryId of ids) {
      const score = scoreOf(categoryId);
      if (score === undefined) continue;
      const gap = newGap(categoryId);
      await api.post('/ratings', { categoryId, score, gap });
      if (gap) postedGaps.current[categoryId] = gap;
    }
    setScores({});
  };

  const saveFocus = (withFocus: boolean) =>
    run(async () => {
      await flushRatings();
      if (withFocus) {
        const { chapter: active } = await api.get<{ chapter: Chapter | null }>('/chapters/current');
        if (active) await api.put(`/chapters/${active.id}`, { focusCategoryIds: focus });
      }
    }, next);

  const passIkigai = (detour: boolean) => {
    setIkigaiSeen(true);
    writeSession(IKIGAI_SEEN_KEY, true);
    if (detour) navigate('/ikigai?from=start');
    else next();
  };

  const finish = (withMove: boolean) =>
    run(async () => {
      if (withMove) {
        const area = focus[0];
        const linkedId = area ? await strategySectionId(area) : null;
        await api.post('/actions', {
          title: move.trim(),
          linkedType: linkedId ? 'section' : null,
          linkedId,
        });
      }
      await setStatus.mutateAsync('completed');
      writeSession(IKIGAI_SEEN_KEY, null);
    }, () => setDone(true));

  const notNow = () => setStatus.mutate('dismissed', { onSuccess: () => navigate('/') });

  /* ── render ───────────────────────────────────────────────────────────── */
  if (done) {
    return (
      <Card featured className="mx-auto flex max-w-2xl flex-col items-center gap-4 p-8 text-center">
        <OnboardingMotion name="steps" className="max-w-sm" />
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {he ? 'הספר שלך התחיל' : 'Your book has begun'}
        </h1>
        <p className="text-fg-muted">
          {he
            ? 'יש לך פרק, גלגל, מיקוד וצעד ראשון. מכאן — צעד אחד בכל פעם.'
            : 'You have a chapter, a wheel, a focus and a first move. From here, one step at a time.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/" className={buttonVariants()}>
            {he ? 'ללוח הבקרה' : 'Go to the dashboard'} <ArrowRight size={15} className="rtl:rotate-180" />
          </Link>
          <Link to="/actions" className={buttonVariants({ variant: 'secondary' })}>
            {he ? 'לצעדים שלי' : 'See my actions'}
          </Link>
        </div>
      </Card>
    );
  }

  const current = STEPS[step]!;
  const stepTitle = (en: string, heText: string) => (
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
      {he ? heText : en}
    </h1>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-fg-faint">{he ? 'התחלה מודרכת' : 'Guided start'}</span>
          <span className="text-sm text-fg-muted">{he ? 'כ-10 דקות. אפשר לעצור ולחזור.' : 'About 10 minutes. Stop and come back anytime.'}</span>
        </div>
        <Button variant="ghost" onClick={notNow} loading={setStatus.isPending && !saving}>
          {he ? 'לא עכשיו' : 'Not now'}
        </Button>
      </header>

      <Stepper steps={STEPS} step={step} />

      <Card className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <OnboardingMotion name={current.motion} className="self-start" />

        <div className="flex flex-col gap-4">
          {current.key === 'chapter' && (
            <>
              {stepTitle("Name the chapter you’re living now", "תן שם לפרק שאתה חי עכשיו")}
              <p className="text-sm text-fg-muted">
                {he
                  ? 'עונה בחיים, עם נושא. למשל: "שנת השורשים", "בונה מחדש", "מעבר לעצמאות".'
                  : 'A season of life, with a theme. For example: "The year of roots", "Rebuilding", "Going independent".'}
              </p>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{he ? 'שם הפרק' : 'Chapter name'}</span>
                <Input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">
                  {he ? 'מה הפרק הזה נועד ליצור? (לא חובה)' : 'What is this chapter meant to create? (optional)'}
                </span>
                <Textarea dir="auto" value={intention} onChange={(e) => setIntention(e.target.value)} rows={3} />
              </label>
            </>
          )}

          {current.key === 'wheel' && (
            <>
              {stepTitle("How close is today to your vision?", "כמה קרוב היום לחזון שלך?")}
              <p className="text-sm text-fg-muted">
                {he
                  ? 'דירוג מהיר ומהבטן, 1–10 לכל תחום. אפשר לדלג על תחומים.'
                  : 'A quick gut rating, 1–10 for each area. Skip any area you like.'}
              </p>
              <div className="flex flex-col gap-4">
                {(categories ?? []).map((c) => (
                  <div key={c.id} className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{areaLabel(c.id)}</span>
                    <ScoreSlider
                      label={areaLabel(c.id)}
                      value={scoreOf(c.id) ?? 0}
                      onChange={(v) => setScores((s) => ({ ...s, [c.id]: v }))}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {current.key === 'focus' && (
            <>
              {stepTitle("Where will your energy go?", "לאן תלך האנרגיה שלך?")}
              <p className="text-sm text-fg-muted">
                {he
                  ? `בחר 1–${MAX_FOCUS_AREAS} תחומי מיקוד לפרק הזה. לכל אחד — מה הפער הגדול ביותר היום?`
                  : `Choose 1–${MAX_FOCUS_AREAS} focus areas for this chapter. For each: what is the biggest gap today?`}
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={he ? 'תחומי מיקוד' : 'Focus areas'}>
                {(categories ?? []).map((c) => {
                  const on = focus.includes(c.id);
                  const full = !on && focus.length >= MAX_FOCUS_AREAS;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      disabled={full}
                      onClick={() => setFocus((f) => (on ? f.filter((x) => x !== c.id) : [...f, c.id]))}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-40',
                        on
                          ? 'border-transparent bg-primary text-[color:var(--rz-accent-fg)]'
                          : 'border-border bg-surface hover:bg-surface-hover',
                      )}
                    >
                      {areaLabel(c.id)}
                      {scoreOf(c.id) !== undefined && <span className="ms-1.5 font-mono text-xs opacity-70">{scoreOf(c.id)}</span>}
                      {!on && lowest.includes(c.id) && (
                        <span className="ms-1.5 text-xs text-warning">{he ? '· פער' : '· gap'}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {focus.map((id) => (
                <label key={id} className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">
                    {he ? `הפער הגדול ביותר ב${areaLabel(id)}` : `Biggest gap in ${areaLabel(id)}`}
                  </span>
                  <Input
                    dir="auto"
                    value={gaps[id] ?? ''}
                    onChange={(e) => setGaps((g) => ({ ...g, [id]: e.target.value }))}
                    maxLength={300}
                    disabled={scoreOf(id) === undefined}
                    placeholder={scoreOf(id) === undefined ? (he ? 'דרג את התחום כדי לרשום פער' : 'Rate this area to note a gap') : undefined}
                  />
                </label>
              ))}
            </>
          )}

          {current.key === 'ikigai' && (
            <>
              {stepTitle("Want to find your IKIGAI?", "רוצה למצוא את האיקיגאי שלך?")}
              <p className="text-sm text-fg-muted">
                {he
                  ? 'מה אתה אוהב, במה אתה טוב, מה העולם צריך וממה אפשר להתפרנס — ואיפה הם נפגשים. לוקח כ-20 דקות; אפשר גם אחר כך.'
                  : 'What you love, what you are good at, what the world needs and what you can be paid for — and where they meet. About 20 minutes; you can also do it later.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => passIkigai(true)}>
                  {he ? 'כן, עכשיו' : 'Yes, now'} <ArrowRight size={15} className="rtl:rotate-180" />
                </Button>
                <Button variant="secondary" onClick={() => passIkigai(false)}>
                  {he ? 'אחר כך' : 'Later'}
                </Button>
              </div>
            </>
          )}

          {current.key === 'move' && (
            <>
              {stepTitle("Your first move", "הצעד הראשון שלך")}
              <p className="text-sm text-fg-muted">
                {he
                  ? 'הצעד הקטן ביותר עם ההשפעה הגדולה ביותר — משהו שתעשה השבוע.'
                  : 'The smallest move with the biggest effect — something you will do this week.'}
              </p>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{he ? 'הצעד' : 'The move'}</span>
                <Input dir="auto" value={move} onChange={(e) => setMove(e.target.value)} maxLength={200} />
              </label>
              {aiAvailable && (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    className="self-start"
                    onClick={() => suggest.mutate(lang)}
                    loading={suggest.isPending}
                  >
                    <Sparkles size={15} /> {he ? 'Clarity, תציעי צעד' : 'Ask Clarity for ideas'}
                  </Button>
                  {suggest.isSuccess && (
                    <div className="flex flex-wrap gap-2">
                      {suggest.data.map((s) => (
                        <button
                          key={s}
                          type="button"
                          dir="auto"
                          onClick={() => setMove(s)}
                          className="rounded-full border border-border bg-surface px-3 py-1.5 text-start text-sm hover:bg-surface-hover"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {suggest.isError && (
                    <p className="text-xs text-fg-muted">
                      {he ? 'Clarity לא זמינה כרגע — כתוב צעד משלך.' : 'Clarity is not available right now — write your own move.'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
              {he ? 'השמירה נכשלה. מה שכבר נשמר נשאר — נסה שוב.' : 'Saving failed. What is already saved stays — please try again.'}
            </p>
          )}

          {/* navigation */}
          {current.key !== 'ikigai' && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" onClick={back} disabled={step === 0 || saving}>
                <ArrowLeft size={15} className="rtl:rotate-180" /> {he ? 'הקודם' : 'Back'}
              </Button>
              <div className="flex flex-wrap gap-2">
                {current.key !== 'chapter' && (
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={() => (current.key === 'focus' ? saveFocus(false) : current.key === 'move' ? finish(false) : next())}
                  >
                    {he ? 'דלג' : 'Skip'}
                  </Button>
                )}
                {current.key === 'chapter' && (
                  <Button onClick={saveChapter} loading={saving} disabled={!title.trim()}>
                    {he ? 'הבא' : 'Next'} <ArrowRight size={15} className="rtl:rotate-180" />
                  </Button>
                )}
                {current.key === 'wheel' && (
                  <Button onClick={next}>
                    {he ? 'הבא' : 'Next'} <ArrowRight size={15} className="rtl:rotate-180" />
                  </Button>
                )}
                {current.key === 'focus' && (
                  <Button onClick={() => saveFocus(true)} loading={saving} disabled={focus.length === 0}>
                    {he ? 'הבא' : 'Next'} <ArrowRight size={15} className="rtl:rotate-180" />
                  </Button>
                )}
                {current.key === 'move' && (
                  <Button onClick={() => finish(true)} loading={saving} disabled={!move.trim()}>
                    <Check size={15} /> {he ? 'שמור וסיים' : 'Save and finish'}
                  </Button>
                )}
              </div>
            </div>
          )}
          {current.key === 'ikigai' && (
            <div className="mt-2">
              <Button variant="ghost" onClick={back}>
                <ArrowLeft size={15} className="rtl:rotate-180" /> {he ? 'הקודם' : 'Back'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
