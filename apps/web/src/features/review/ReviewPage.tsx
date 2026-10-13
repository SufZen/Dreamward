import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarCheck, Check as CheckIcon, Plus, Trophy } from 'lucide-react';
import { CATEGORIES } from '@dreamward/shared';
import {
  BreathingOrb,
  Button,
  Card,
  PageLoader,
  ProgressRing,
  StarBurst,
  cn,
  toast,
  type StarBurstHandle,
} from '@dreamward/design-system';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';
import { Stepper, type StepperStep } from '@/components/Stepper';
import { ScoreSlider } from '@/components/ScoreSlider';
import { useAreaLabel } from '@/features/book/hooks';
import { useActions, useCreateAction, useUpdateAction, type Action } from '@/features/actions/hooks';
import { useGoals, useGoalsProgress, useSetGoalStatus, type Goal } from '@/features/goals/hooks';
import { useCreateRating, useCurrentChapter, useLatestRatings } from '@/features/chapter/hooks';
import type { JournalEntry } from '@/features/journal/hooks';
import { markReviewed } from './lastReview';

const DAY = 86_400_000;

const STEPS: StepperStep[] = [
  { key: 'arrive', en: 'Arrive', he: 'להגיע' },
  { key: 'wins', en: 'Look back', he: 'מבט לאחור' },
  { key: 'wheel', en: 'The wheel', he: 'הגלגל' },
  { key: 'goals', en: 'Goals', he: 'מטרות' },
  { key: 'week', en: 'Next week', he: 'השבוע הבא' },
  { key: 'reflect', en: 'Reflect', he: 'הרהור' },
];

/** End of the coming week (next Saturday, 23:59) — the Israeli week ends on Saturday. */
function endOfNextWeek() {
  const d = new Date();
  const toSaturday = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + toSaturday);
  d.setHours(23, 59, 59, 0);
  return d.getTime();
}

/**
 * The weekly review, without needing AI: arrive (a breath) → look back at
 * the week's wins → re-rate the focus areas → sweep the goals → choose up to
 * three steps for next week → one honest paragraph in the journal → done.
 * About ten minutes; every step can be skipped.
 */
export function ReviewPage() {
  const { lang } = useLang();
  const he = lang === 'he';
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const { data: actions, isLoading } = useActions();
  const heading = useRef<HTMLHeadingElement>(null);

  const go = (i: number) => {
    setStep(i);
    requestAnimationFrame(() => heading.current?.focus());
  };

  if (isLoading) return <PageLoader label={he ? 'טוען…' : 'Loading…'} />;
  if (finished) return <Finished onDone={() => navigate('/')} />;

  const key = STEPS[step]!.key;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Stepper steps={STEPS} step={step} onGo={go} />
      <div key={key} className="rz-animate-fade-up flex flex-col gap-5">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none">
          {
            {
              arrive: he ? 'הסקירה השבועית' : 'Your weekly review',
              wins: he ? 'מה הלך טוב השבוע?' : 'What went well this week?',
              wheel: he ? 'איפה אתה עומד עכשיו?' : 'Where do you stand now?',
              goals: he ? 'מעבר על המטרות' : 'A pass over your goals',
              week: he ? 'מה חשוב בשבוע הבא?' : 'What matters next week?',
              reflect: he ? 'מה השבוע הזה לימד אותך?' : 'What did this week teach you?',
            }[key]
          }
        </h1>
        {key === 'arrive' && <Arrive />}
        {key === 'wins' && <Wins actions={actions ?? []} />}
        {key === 'wheel' && <RateFocus />}
        {key === 'goals' && <GoalSweep />}
        {key === 'week' && <PlanWeek actions={actions ?? []} />}
        {key === 'reflect' && (
          <Reflect
            onSaved={() => {
              markReviewed();
              setFinished(true);
            }}
          />
        )}
      </div>

      {key !== 'reflect' && (
        <div className="flex items-center gap-3 border-t border-border pt-4">
          {step > 0 && (
            <Button variant="ghost" onClick={() => go(step - 1)}>
              <ArrowRight size={15} className="ltr:rotate-180" /> {he ? 'הקודם' : 'Back'}
            </Button>
          )}
          <Button className="ms-auto" onClick={() => go(step + 1)}>
            {step === 0 ? (he ? 'להתחיל' : 'Begin') : he ? 'הבא' : 'Next'}{' '}
            <ArrowLeft size={15} className="ltr:rotate-180" />
          </Button>
        </div>
      )}
      {last && (
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => go(step - 1)}>
            <ArrowRight size={15} className="ltr:rotate-180" /> {he ? 'הקודם' : 'Back'}
          </Button>
          <Button
            variant="ghost"
            className="ms-auto"
            onClick={() => {
              markReviewed();
              setFinished(true);
            }}
          >
            {he ? 'לסיים בלי לכתוב' : 'Finish without writing'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Arrive() {
  const { lang } = useLang();
  const he = lang === 'he';
  return (
    <Card className="dw-sky relative flex flex-col items-center gap-8 overflow-hidden px-6 pb-14 pt-10 text-center">
      <BreathingOrb size={150}>{he ? 'נשימה פנימה… והחוצה' : 'Breathe in… and out'}</BreathingOrb>
      <p className="mt-6 max-w-md text-fg-muted">
        {he
          ? 'כעשר דקות. נסתכל על מה שקרה, נבדוק את הגלגל, נעבור על המטרות ונבחר מה חשוב בשבוע הבא. אפשר לדלג על כל שלב.'
          : 'About ten minutes. We’ll look at what happened, check the wheel, go through your goals and choose what matters next week. Skip any step.'}
      </p>
    </Card>
  );
}

function Wins({ actions }: { actions: Action[] }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const since = Date.now() - 7 * DAY;
  const done = actions.filter((a) => a.status === 'done' && (a.completedAt ?? 0) >= since);
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[color:var(--rz-accent-soft)] text-primary">
          <Trophy size={20} />
        </div>
        <p className="text-lg">
          {done.length === 0
            ? he
              ? 'השבוע לא סומנו צעדים. זה בסדר — שבוע הוא גם מה שלמדת ממנו.'
              : 'No steps checked off this week. That’s fine — a week is also what you learned from it.'
            : he
              ? `סימנת ${done.length} צעדים השבוע.`
              : `You checked off ${done.length} step${done.length === 1 ? '' : 's'} this week.`}
        </p>
      </Card>
      {done.length > 0 && (
        <ul className="rz-stagger flex flex-col gap-2">
          {done.slice(0, 10).map((a, i) => (
            <li key={a.id} style={{ '--i': i } as CSSProperties} className="flex items-center gap-3 text-fg-muted">
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary text-[color:var(--rz-accent-fg)]">
                <CheckIcon size={12} />
              </span>
              <bdi>{a.title}</bdi>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RateFocus() {
  const { lang } = useLang();
  const he = lang === 'he';
  const areaLabel = useAreaLabel();
  const { data: chapter } = useCurrentChapter();
  const { data: ratings } = useLatestRatings();
  const create = useCreateRating();
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState<Record<string, number>>({});
  const focus = chapter?.focusCategoryIds ?? [];
  const current = new Map((ratings ?? []).map((r) => [r.categoryId, r.latest?.score ?? 0]));
  const ids = showAll || focus.length === 0 ? CATEGORIES.map((c) => c.id) : focus;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fg-muted">
        {focus.length && !showAll
          ? he
            ? 'דירוג מהיר של תחומי המיקוד שלך: כמה קרוב היום לחזון? כל לחיצה נשמרת.'
            : 'A quick rating of your focus areas: how close is today to the vision? Each tap saves.'
          : he
            ? 'כמה קרוב היום לחזון, בכל תחום? כל לחיצה נשמרת.'
            : 'How close is today to the vision, in each area? Each tap saves.'}
      </p>
      <div className="flex flex-col gap-3">
        {ids.map((id) => {
          const v = saved[id] ?? current.get(id) ?? 0;
          return (
            <div key={id} className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-sm font-medium">
                {areaLabel(id)}
                <span className="tabular text-xs font-normal text-fg-subtle">
                  {v ? `${v}/10` : he ? 'לא דורג' : 'Not rated'}
                  {saved[id] && <span className="ms-2 text-success">{he ? 'נשמר' : 'Saved'}</span>}
                </span>
              </span>
              <ScoreSlider
                compact
                label={areaLabel(id)}
                value={v}
                onChange={(score) => {
                  setSaved((s) => ({ ...s, [id]: score }));
                  create.mutate({ categoryId: id, score });
                }}
              />
            </div>
          );
        })}
      </div>
      {focus.length > 0 && !showAll && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll(true)}>
          {he ? 'לדרג את כל 12 התחומים' : 'Rate all 12 areas'}
        </Button>
      )}
    </div>
  );
}

function GoalSweep() {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: goals } = useGoals();
  const open = (goals ?? []).filter((g) => g.status !== 'achieved');
  if (open.length === 0)
    return (
      <p className="text-fg-muted">
        {he ? 'אין מטרות פתוחות. אולי זה הזמן לחלום את הבאה — ' : 'No open goals. Maybe it’s time to dream the next one — '}
        <Link to="/goals" className="text-primary underline underline-offset-2">
          {he ? 'למטרות' : 'go to Goals'}
        </Link>
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-fg-muted">
        {he
          ? 'לכל מטרה: האם יש לה צעד הבא? האם היא כבר הושגה?'
          : 'For each goal: does it have a next step? Is it already achieved?'}
      </p>
      {open.map((g) => (
        <GoalSweepRow key={g.id} goal={g} />
      ))}
    </div>
  );
}

function GoalSweepRow({ goal }: { goal: Goal }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: progress } = useGoalsProgress();
  const { data: steps } = useActions({ goalId: goal.id, status: 'todo' });
  const setStatus = useSetGoalStatus();
  const create = useCreateAction();
  const [title, setTitle] = useState('');
  const [achieved, setAchieved] = useState(false);
  const burst = useRef<StarBurstHandle>(null);
  const p = progress?.[goal.id];
  const next = steps?.[0];

  return (
    <Card className={cn('flex flex-col gap-3 p-4 transition-opacity duration-moderate', achieved && 'opacity-60')}>
      <div className="flex items-center gap-3">
        <ProgressRing value={(p?.pct ?? 0) / 100} size={36} stroke={3.5} ariaLabel={p?.pct != null ? `${p.pct}%` : he ? 'אין צעדים' : 'No steps'} />
        <p className="min-w-0 flex-1 truncate font-medium">
          <bdi>{goal.title}</bdi>
        </p>
        <div className="relative">
          <Button
            variant={achieved ? 'primary' : 'secondary'}
            size="sm"
            disabled={achieved}
            onClick={() => {
              setAchieved(true);
              burst.current?.fire();
              setStatus.mutate({ id: goal.id, status: 'achieved' });
            }}
          >
            <Trophy size={14} /> {achieved ? (he ? 'הושגה!' : 'Achieved!') : he ? 'הושגה' : 'Achieved'}
          </Button>
          <StarBurst ref={burst} scale="goal" />
        </div>
      </div>
      {!achieved &&
        (next ? (
          <p className="text-sm text-fg-muted">
            {he ? 'הצעד הבא: ' : 'Next step: '}
            <bdi className="text-foreground">{next.title}</bdi>
          </p>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = title.trim();
              if (!t) return;
              create.mutate(
                { title: t, goalId: goal.id },
                { onSuccess: () => toast(he ? 'הצעד נוסף' : 'Step added', { tone: 'success' }) },
              );
              setTitle('');
            }}
          >
            <span className="text-sm text-warning">{he ? 'אין צעד הבא.' : 'No next step.'}</span>
            <input
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={he ? 'מה הצעד הבא?' : 'What’s the next step?'}
              aria-label={he ? `צעד הבא עבור ${goal.title}` : `Next step for ${goal.title}`}
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 text-sm placeholder:text-fg-faint focus:border-primary focus:outline-none"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!title.trim()}>
              <Plus size={14} />
            </Button>
          </form>
        ))}
    </Card>
  );
}

function PlanWeek({ actions }: { actions: Action[] }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const update = useUpdateAction();
  const { data: goals } = useGoals();
  const deadline = useMemo(endOfNextWeek, []);
  const open = actions.filter((a) => a.status === 'todo');
  // Already dated within the week: shown, not chosen again.
  const [onWeek] = useState(() => open.filter((a) => a.dueDate != null && a.dueDate <= deadline).map((a) => a.id));
  const already = open.filter((a) => onWeek.includes(a.id));
  const candidates = open.filter((a) => !onWeek.includes(a.id));
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const goalTitle = new Map((goals ?? []).map((g) => [g.id, g.title]));

  const toggle = (a: Action) => {
    const on = !chosen.has(a.id);
    if (on && chosen.size >= 3) {
      toast(he ? 'שלושה צעדים נוספים לשבוע זה מספיק. אפשר להחליף אחד.' : 'Three more steps is plenty for a week. Swap one out.');
      return;
    }
    setChosen((prev) => {
      const n = new Set(prev);
      if (on) n.add(a.id);
      else n.delete(a.id);
      return n;
    });
    update.mutate({ id: a.id, dueDate: on ? deadline : a.dueDate });
  };

  if (open.length === 0)
    return (
      <p className="text-fg-muted">
        {he ? 'אין צעדים פתוחים. הוסף צעד במטרות או ב-Today.' : 'No open steps. Add one in Goals or on Today.'}
      </p>
    );

  const Row = ({ a, on, selectable }: { a: Action; on: boolean; selectable: boolean }) => (
    <button
      type="button"
      role={selectable ? 'checkbox' : undefined}
      aria-checked={selectable ? on : undefined}
      disabled={!selectable}
      onClick={() => selectable && toggle(a)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-start transition-colors duration-fast',
        selectable && 'rz-press',
        on ? 'border-[color:var(--rz-border-accent)] bg-[color:var(--rz-accent-soft)]' : 'border-border',
        selectable && !on && 'hover:bg-surface-hover',
        !selectable && 'cursor-default py-2',
      )}
    >
      <CalendarCheck size={17} className={on || !selectable ? 'text-primary' : 'text-fg-subtle'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          <bdi>{a.title}</bdi>
        </span>
        {a.goalId && goalTitle.get(a.goalId) && (
          <span className="block truncate text-xs text-fg-subtle">
            <bdi>{goalTitle.get(a.goalId)}</bdi>
          </span>
        )}
      </span>
      {on && selectable && <span className="text-xs text-primary">{he ? 'נוסף לשבוע' : 'Added'}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {already.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-fg-muted">
            {he ? `כבר בשבוע הבא (${already.length})` : `Already on next week (${already.length})`}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {already.map((a) => (
              <li key={a.id}>
                <Row a={a} on={false} selectable={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {candidates.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-fg-muted">
            {already.length >= 5
              ? he
                ? 'השבוע כבר מלא. אם משהו מכאן חשוב יותר — הוסף, והזז משהו אחר.'
                : 'The week is already full. If something here matters more, add it — and move something else.'
              : he
                ? 'הוסף עד שלושה צעדים — הם יקבלו תאריך עד סוף השבוע.'
                : 'Add up to three more — they’ll be due by the end of the week.'}
          </h2>
          <ul className="flex flex-col gap-2">
            {candidates.slice(0, 12).map((a) => (
              <li key={a.id}>
                <Row a={a} on={chosen.has(a.id)} selectable />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Reflect({ onSaved }: { onSaved: () => void }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const save = useMutation({
    mutationFn: () =>
      api.post<JournalEntry>('/journal', {
        title: he ? 'סקירה שבועית' : 'Weekly review',
        bodyRichtext: text
          .trim()
          .split(/\n+/)
          .map((p) => `<p>${p.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)}</p>`)
          .join(''),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal'] });
      onSaved();
    },
    onError: () => toast(he ? 'לא נשמר — נסה שוב' : 'Not saved — try again', { tone: 'danger' }),
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-fg-muted">
        {he
          ? 'פסקה אחת כנה: מה עבד, מה לא, ומה תעשה אחרת. זה נשמר ביומן.'
          : 'One honest paragraph: what worked, what didn’t, what you’ll do differently. It’s saved to your journal.'}
      </p>
      <textarea
        dir="auto"
        rows={6}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={he ? 'הרהור שבועי' : 'Weekly reflection'}
        className="w-full resize-y rounded-lg border border-border bg-surface px-4 py-3 leading-relaxed placeholder:text-fg-faint transition-[border-color,box-shadow] duration-fast focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[color:var(--rz-accent-ring)]"
        placeholder={he ? 'השבוע למדתי ש…' : 'This week I learned that…'}
      />
      <Button className="self-end" disabled={!text.trim()} loading={save.isPending} onClick={() => save.mutate()}>
        {he ? 'לשמור ולסיים' : 'Save and finish'}
      </Button>
    </div>
  );
}

function Finished({ onDone }: { onDone: () => void }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const burst = useRef<StarBurstHandle>(null);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-10 text-center">
      <div className="relative" ref={(el) => {
        if (el) setTimeout(() => burst.current?.fire(), 150);
      }}>
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--rz-accent-soft)] text-primary">
          <CalendarCheck size={34} />
        </div>
        <StarBurst ref={burst} scale="chapter" />
      </div>
      <h1 className="text-3xl font-semibold">{he ? 'השבוע סגור.' : 'The week is closed.'}</h1>
      <p className="text-fg-muted">
        {he
          ? 'הצעדים שבחרת מחכים ב-Today. נתראה בשבוע הבא.'
          : 'The steps you chose are waiting on Today. See you next week.'}
      </p>
      <Button size="lg" onClick={onDone}>
        {he ? 'ל-Today' : 'Go to Today'}
      </Button>
    </div>
  );
}
