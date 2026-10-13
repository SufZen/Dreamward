import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Compass, Gauge, NotebookPen, Plus, Target } from 'lucide-react';
import type { ProposalRow } from '@dreamward/shared';
import { Badge, Button, Card, ProgressRing, Skeleton, buttonVariants, cn, toast } from '@dreamward/design-system';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';
import { OnboardingMotion } from '@/components/OnboardingMotion';
import { useAreaLabel } from '@/features/book/hooks';
import { useGoals, useGoalsProgress } from '@/features/goals/hooks';
import { useActions, useCreateAction, type Action } from '@/features/actions/hooks';
import { StepItem } from '@/features/actions/StepItem';
import { useJournal, type JournalEntry } from '@/features/journal/hooks';
import { BriefingCard } from '@/features/assistant/BriefingCard';
import { ProposalCard } from '@/features/assistant/ProposalCard';
import { useCurrentChapter, useLatestRatings } from '@/features/chapter/hooks';
import { useOnboarding } from '@/features/onboarding/hooks';

const DAY = 86_400_000;
const startOfToday = () => new Date().setHours(0, 0, 0, 0);

function journalStreak(dates: number[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => Math.floor(d / DAY)));
  const today = Math.floor(Date.now() / DAY);
  if (!days.has(today) && !days.has(today - 1)) return 0;
  let streak = 0;
  let cursor = days.has(today) ? today : today - 1;
  while (days.has(cursor)) {
    streak++;
    cursor--;
  }
  return streak;
}

function greeting(he: boolean) {
  const h = new Date().getHours();
  if (h < 5) return he ? 'לילה טוב' : 'Good night';
  if (h < 12) return he ? 'בוקר טוב' : 'Good morning';
  if (h < 17) return he ? 'צהריים טובים' : 'Good afternoon';
  if (h < 21) return he ? 'ערב טוב' : 'Good evening';
  return he ? 'לילה טוב' : 'Good night';
}

/**
 * Today: the home screen answers "what do I do now?" before anything else.
 * Order: who/when (greeting + chapter) → today's steps, checkable in place,
 * with quick add → one line in the journal → where the book stands (the
 * goals in motion and the biggest gap) → Clarity, when it's set up.
 */
export function TodayPage() {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: chapter } = useCurrentChapter();
  const { data: onboarding } = useOnboarding();
  const fresh = onboarding?.fresh === true && onboarding.status === 'pending';
  const areaLabel = useAreaLabel();
  const pending = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.get<{ items: ProposalRow[]; pendingCount: number }>('/proposals?status=pending'),
    refetchInterval: 30_000,
  });
  const proposals = pending.data?.items ?? [];

  const dateLine = new Date().toLocaleDateString(he ? 'he-IL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const focus = chapter?.focusCategoryIds ?? [];

  return (
    <div className="flex flex-col gap-8">
      <header className="rz-stagger flex flex-col gap-2">
        <p className="text-sm text-fg-subtle" style={{ '--i': 0 } as CSSProperties}>
          {dateLine}
        </p>
        <h1 className="text-4xl font-semibold" style={{ '--i': 1 } as CSSProperties}>
          {greeting(he)}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-fg-muted" style={{ '--i': 2 } as CSSProperties}>
          {chapter ? (
            <>
              <Link to="/chapter" className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Compass size={16} className="text-primary" />
                <bdi className="font-medium text-foreground">{chapter.title}</bdi>
              </Link>
              {focus.map((id) => (
                <Badge key={id} dot className="[&>span:first-child]:bg-primary">
                  {areaLabel(id)}
                </Badge>
              ))}
            </>
          ) : (
            !fresh && (
              <Link to="/chapter" className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Compass size={16} className="text-primary" />
                {he ? 'איזו תקופה אתה חי עכשיו? תן לה שם' : 'What season are you living now? Name it'}
                <ArrowRight size={14} className="rtl:rotate-180" />
              </Link>
            )
          )}
        </div>
      </header>

      {fresh && <WelcomeCard />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <TodaySteps />
          {proposals.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium text-fg-muted">
                {he ? 'הצעות מ-Clarity' : 'Suggestions from Clarity'}
                <Badge variant="accent">{proposals.length}</Badge>
              </h2>
              {proposals.slice(0, 3).map((p) => (
                <ProposalCard key={p.id} proposal={p} />
              ))}
            </section>
          )}
          <BriefingCard />
        </div>
        <div className="flex flex-col gap-6">
          <JournalLine />
          <GoalsInMotion />
          <WhereYouStand />
        </div>
      </div>
    </div>
  );
}

/* ── Today's steps ───────────────────────────────────────────────────── */

function rank(a: Action, focusGoalIds: Set<string>) {
  const today = startOfToday();
  if (a.dueDate != null && a.dueDate < today) return 0; // overdue
  if (a.dueDate != null && a.dueDate < today + DAY) return 1; // today
  if (a.dueDate != null && a.dueDate < today + 3 * DAY) return 2; // the next couple of days
  if (a.goalId && focusGoalIds.has(a.goalId)) return 3; // toward a focus area
  if (a.priority === 'high') return 4;
  if (a.dueDate != null && a.dueDate < today + 7 * DAY) return 5; // this week
  return 6;
}

function TodaySteps() {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: actions, isLoading } = useActions({ status: 'todo' });
  const { data: goals } = useGoals();
  const { data: chapter } = useCurrentChapter();
  const create = useCreateAction();
  const [title, setTitle] = useState('');

  const goalById = useMemo(() => new Map((goals ?? []).map((g) => [g.id, g])), [goals]);
  const focusGoalIds = useMemo(
    () =>
      new Set(
        (goals ?? []).filter((g) => g.categoryId && chapter?.focusCategoryIds.includes(g.categoryId)).map((g) => g.id),
      ),
    [goals, chapter],
  );
  const list = useMemo(
    () =>
      (actions ?? [])
        .slice()
        .sort((a, b) => rank(a, focusGoalIds) - rank(b, focusGoalIds) || a.sortOrder - b.sortOrder),
    [actions, focusGoalIds],
  );
  const shown = list.slice(0, 6);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    create.mutate(
      { title: t, dueDate: startOfToday() + DAY - 1 },
      {
        onSuccess: () => toast(he ? 'נוסף להיום' : 'Added for today', { tone: 'success' }),
        onError: () =>
          toast(he ? 'לא נשמר — נסה שוב' : 'Not saved — try again', {
            tone: 'danger',
          }),
      },
    );
    setTitle('');
  };

  return (
    <Card className="flex flex-col gap-1 p-5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{he ? 'הצעדים של היום' : 'Today’s steps'}</h2>
        {list.length > 0 && (
          <Link to="/actions" className="text-sm text-fg-subtle hover:text-foreground">
            {list.length > shown.length
              ? he
                ? `כל ${list.length} הצעדים`
                : `All ${list.length} steps`
              : he
                ? 'לכל הצעדים'
                : 'All steps'}
          </Link>
        )}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-3 py-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : shown.length === 0 ? (
        <p className="py-3 text-fg-muted">
          {he
            ? 'אין צעדים פתוחים. מה צעד אחד קטן שיקרב אותך היום?'
            : 'No open steps. What’s one small step that would move you forward today?'}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((a) => {
            const g = a.goalId ? goalById.get(a.goalId) : undefined;
            return <StepItem key={a.id} action={a} goalTitle={g?.title} goalId={g?.id} />;
          })}
        </ul>
      )}
      <form
        className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-border px-3 transition-colors focus-within:border-solid focus-within:border-primary"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Plus size={16} className="flex-none text-fg-subtle" />
        <input
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={he ? 'הוספת צעד להיום…' : 'Add a step for today…'}
          aria-label={he ? 'צעד חדש להיום' : 'New step for today'}
          className="h-10 flex-1 bg-transparent text-sm placeholder:text-fg-faint focus:outline-none"
        />
        {title.trim() && (
          <Button type="submit" size="sm" loading={create.isPending}>
            {he ? 'הוספה' : 'Add'}
          </Button>
        )}
      </form>
    </Card>
  );
}

/* ── One line in the journal ─────────────────────────────────────────── */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function JournalLine() {
  const { lang } = useLang();
  const he = lang === 'he';
  const qc = useQueryClient();
  const { data: journal } = useJournal();
  const [text, setText] = useState('');
  const today = startOfToday();
  const todays = (journal ?? []).find((j) => j.entryDate >= today);
  const streak = journalStreak((journal ?? []).map((j) => j.entryDate));

  const save = useMutation({
    mutationFn: (body: string) =>
      api.post<JournalEntry>('/journal', {
        bodyRichtext: body
          .split(/\n+/)
          .map((p) => `<p>${escapeHtml(p)}</p>`)
          .join(''),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal'] });
      setText('');
      toast(he ? 'נשמר ביומן' : 'Saved to your journal', { tone: 'success' });
    },
    onError: () =>
      toast(he ? 'לא נשמר — נסה שוב' : 'Not saved — try again', {
        tone: 'danger',
      }),
  });

  const snippet = todays
    ? todays.bodyRichtext
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <NotebookPen size={17} className="text-primary" />
        <h2 className="flex-1 font-semibold">{he ? 'שורה ביומן' : 'A line in the journal'}</h2>
        {streak > 1 && (
          <span className="text-xs text-fg-subtle">{he ? `${streak} ימים ברצף` : `${streak}-day streak`}</span>
        )}
      </div>
      {todays ? (
        <Link to={`/journal/${todays.id}`} className="group flex flex-col gap-1">
          <p dir="auto" className="line-clamp-3 text-sm text-fg-muted group-hover:text-foreground">
            {snippet || (he ? '(רשומה ריקה)' : '(empty entry)')}
          </p>
          <span className="text-xs text-primary">
            {he ? 'כתבת היום · להמשיך לכתוב' : 'You wrote today · keep writing'}
          </span>
        </Link>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) save.mutate(text.trim());
          }}
        >
          <textarea
            dir="auto"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) save.mutate(text.trim());
            }}
            placeholder={he ? 'מה היה חשוב היום? מה למדת?' : 'What mattered today? What did you learn?'}
            aria-label={he ? 'שורה ביומן' : 'A line in the journal'}
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed placeholder:text-fg-faint transition-[border-color,box-shadow] duration-fast focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[color:var(--rz-accent-ring)]"
          />
          <div className="flex items-center justify-between gap-2">
            <Link to="/journal?new=1" className="text-xs text-fg-subtle hover:text-foreground">
              {he ? 'לכתוב רשומה מלאה' : 'Write a full entry'}
            </Link>
            <Button type="submit" size="sm" variant="secondary" disabled={!text.trim()} loading={save.isPending}>
              {he ? 'שמירה' : 'Save'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/* ── Goals in motion ─────────────────────────────────────────────────── */

function GoalsInMotion() {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: goals } = useGoals();
  const { data: progress } = useGoalsProgress();
  const open = (goals ?? []).filter((g) => g.status !== 'achieved');
  if (!goals) return null;
  const riskOrder = { at_risk: 0, stalled: 1, on_track: 2 } as const;
  const list = open
    .slice()
    .sort((a, b) => riskOrder[progress?.[a.id]?.risk ?? 'on_track'] - riskOrder[progress?.[b.id]?.risk ?? 'on_track'])
    .slice(0, 4);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Target size={17} className="text-primary" />
        <h2 className="flex-1 font-semibold">{he ? 'מטרות בתנועה' : 'Goals in motion'}</h2>
        <Link to="/goals" className="text-xs text-fg-subtle hover:text-foreground">
          {he ? 'לכל המטרות' : 'All goals'}
        </Link>
      </div>
      {list.length === 0 ? (
        <Link to="/goals" className="text-sm text-fg-muted hover:text-foreground">
          {he
            ? 'מטרה היא כוכב שהולכים אליו. להוסיף את הראשונה ←'
            : 'A goal is a star you walk toward. Add your first →'}
        </Link>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((g) => {
            const p = progress?.[g.id];
            const pct = p?.pct ?? null;
            return (
              <li key={g.id}>
                <Link to={`/goals#goal-${g.id}`} className="group flex items-center gap-3">
                  <ProgressRing
                    value={(pct ?? 0) / 100}
                    size={36}
                    stroke={3.5}
                    label={pct == null ? '–' : undefined}
                    ariaLabel={pct == null ? (he ? 'אין צעדים' : 'No steps yet') : `${pct}%`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium group-hover:text-primary">
                      <bdi>{g.title}</bdi>
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {pct == null
                        ? he
                          ? 'עוד אין צעדים — לפרק לצעד ראשון'
                          : 'No steps yet — break it into a first step'
                        : he
                          ? `${p!.doneActions} מתוך ${p!.totalActions} צעדים`
                          : `${p!.doneActions} of ${p!.totalActions} steps`}
                      {p?.risk === 'stalled' && <span className="text-warning">{he ? ' · תקועה' : ' · stalled'}</span>}
                      {p?.risk === 'at_risk' && <span className="text-danger">{he ? ' · בסיכון' : ' · at risk'}</span>}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── Where you stand ─────────────────────────────────────────────────── */

function WhereYouStand() {
  const { lang } = useLang();
  const he = lang === 'he';
  const areaLabel = useAreaLabel();
  const { data: ratings } = useLatestRatings();
  const { data: chapter } = useCurrentChapter();
  const rated = (ratings ?? []).filter((r) => r.latest);
  const focus = chapter?.focusCategoryIds ?? [];
  const lastRated = rated.reduce((m, r) => Math.max(m, r.latest!.ratedAt), 0);
  const stale = lastRated > 0 && Date.now() - lastRated > 30 * DAY;

  const rows = rated
    .slice()
    .sort(
      (a, b) =>
        Number(focus.includes(b.categoryId)) - Number(focus.includes(a.categoryId)) ||
        a.latest!.score - b.latest!.score,
    )
    .slice(0, 4);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Gauge size={17} className="text-primary" />
        <h2 className="flex-1 font-semibold">{he ? 'איפה אתה עומד' : 'Where you stand'}</h2>
        <Link to="/chapter" className="text-xs text-fg-subtle hover:text-foreground">
          {he ? 'לגלגל' : 'The wheel'}
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-fg-muted">
            {he
              ? 'דרג כל תחום 1-10: כמה קרוב היום לחזון. זה לוקח דקה, ומראה איפה הפער הגדול.'
              : 'Rate each area 1–10: how close today is to your vision. It takes a minute and shows the biggest gap.'}
          </p>
          <Link to="/chapter" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'self-start')}>
            {he ? 'לדרג את הגלגל' : 'Rate the wheel'}
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <li key={r.categoryId}>
                <Link to={`/book/category/${r.categoryId}`} className="group flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate group-hover:text-foreground">
                      {areaLabel(r.categoryId)}
                      {focus.includes(r.categoryId) && (
                        <span className="ms-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                      )}
                    </span>
                    <span className="tabular text-fg-subtle">{r.latest!.score}/10</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-[color:var(--rz-accent)] transition-[width] duration-spring ease-spring-dream"
                      style={{
                        width: `${r.latest!.score * 10}%`,
                        opacity: 0.45 + r.latest!.score * 0.055,
                      }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {stale && (
            <p className="text-xs text-warning">
              {he
                ? 'עבר יותר מחודש מהדירוג האחרון — שווה לבדוק שוב.'
                : 'Over a month since you last rated — worth a fresh look.'}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/* ── First run ───────────────────────────────────────────────────────── */

function WelcomeCard() {
  const { lang } = useLang();
  const he = lang === 'he';
  const steps = he
    ? ['תן שם לפרק שאתה חי עכשיו', 'דרג כמה קרוב היום לחזון', 'בחר צעד קטן אחד לשבוע הזה']
    : [
        'Name the chapter you’re living now',
        'Rate how close today is to your vision',
        'Choose one small step for this week',
      ];
  return (
    <Card featured className="grid items-center gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <OnboardingMotion name="welcome" />
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">{he ? 'ברוך הבא ל-Dreamward' : 'Welcome to Dreamward'}</h2>
        <p className="text-fg-muted">
          {he
            ? 'חלום, כיוון, וצעד אחד בכל פעם. שלושה צעדים ראשונים, כ-10 דקות:'
            : 'A dream, a direction, and one step at a time. Three first steps, about 10 minutes:'}
        </p>
        <ol className="flex flex-col gap-2 text-sm">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[color:var(--rz-accent)] text-xs font-semibold text-primary">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <Link to="/start" className={cn(buttonVariants({ size: 'lg' }), 'mt-1 self-start')}>
          {he ? 'בוא נתחיל · כ-10 דקות' : 'Start · about 10 min'} <ArrowRight size={16} className="rtl:rotate-180" />
        </Link>
      </div>
    </Card>
  );
}
