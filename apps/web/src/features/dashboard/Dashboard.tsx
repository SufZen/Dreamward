import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Target, NotebookPen, Flame, CalendarClock, Sparkles, AlertTriangle, ListTodo, ArrowRight } from 'lucide-react';
import type { ProposalRow } from '@dreamward/shared';
import { Card, Badge, Skeleton, DreamwardLogo, buttonVariants } from '@dreamward/design-system';
import { api } from '@/lib/api';
import { useLang, pickLabel } from '@/lib/lang';
import { Icon } from '@/components/Icon';
import { OnboardingMotion } from '@/components/OnboardingMotion';
import { useCategories } from '@/features/book/hooks';
import { useGoals, useGoalsSummary, useGoalsProgress } from '@/features/goals/hooks';
import { useActions } from '@/features/actions/hooks';
import { useJournal } from '@/features/journal/hooks';
import { useBoards } from '@/features/moodboard/hooks';
import { BriefingCard } from '@/features/assistant/BriefingCard';
import { ProposalCard } from '@/features/assistant/ProposalCard';
import { DashboardMeaning } from '@/features/chapter/DashboardMeaning';
import { useCurrentChapter } from '@/features/chapter/hooks';
import { useOnboarding } from '@/features/onboarding/hooks';

const DAY = 86_400_000;

/** Consecutive-day streak ending today/yesterday, from journal entry dates. */
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

export function Dashboard() {
  const { t, lang } = useLang();
  const he = lang === 'he';
  const { data: categories } = useCategories();
  const { data: summary } = useGoalsSummary();
  const { data: goals } = useGoals();
  const { data: progressMap } = useGoalsProgress();
  const { data: openActions } = useActions({ status: 'todo' });
  const { data: journal } = useJournal();
  const { data: boards } = useBoards();
  const { data: chapter } = useCurrentChapter();
  const pending = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.get<{ items: ProposalRow[]; pendingCount: number }>('/proposals?status=pending'),
    refetchInterval: 30_000,
  });

  const pendingItems = pending.data?.items ?? [];
  // A new book (no chapter, no goals yet) that hasn't dismissed or finished the guided start.
  const { data: onboarding } = useOnboarding();
  const fresh = onboarding?.fresh === true && onboarding.status === 'pending';
  const recentJournal = (journal ?? []).slice(0, 3);
  const streak = journalStreak((journal ?? []).map((j) => j.entryDate));

  // Goals with a target date that aren't achieved yet, soonest first.
  const dueGoals = (goals ?? [])
    .filter((g) => g.targetDate && g.status !== 'achieved')
    .sort((a, b) => (a.targetDate ?? 0) - (b.targetDate ?? 0))
    .slice(0, 4);

  // Progress signals: goals flagged stalled / at-risk, actions due in 7 days.
  const flaggedGoals = (goals ?? [])
    .map((g) => ({ goal: g, progress: progressMap?.[g.id] }))
    .filter((x) => x.progress && x.progress.risk !== 'on_track')
    .slice(0, 4);
  const dueSoonActions = (openActions ?? [])
    .filter((a) => a.dueDate !== null && a.dueDate < Date.now() + 7 * DAY)
    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
    .slice(0, 5);

  const STATUS_LABEL: Record<string, { he: string; en: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
    achieved: { he: 'הושגו', en: 'Achieved', variant: 'success' },
    partial: { he: 'חלקי', en: 'Partial', variant: 'warning' },
    not_achieved: { he: 'לא הושגו', en: 'Not achieved', variant: 'danger' },
    not_relevant: { he: 'לא רלוונטי', en: 'N/A', variant: 'neutral' },
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-foreground">
          <span className="sr-only">{t('appName')}</span>
          <DreamwardLogo height={52} aria-hidden="true" />
        </h1>
        <p className="mt-2 text-fg-muted">
          {he ? 'כל חלום מתחיל בעמוד אחד. זה שלך — בוא נכתוב אותו יחד.' : 'Every dream starts on one page. This one’s yours — let’s write it.'}
        </p>
      </header>

      {fresh && <WelcomeCard />}

      <BriefingCard />

      <DashboardMeaning />

      {/* Pending proposals from Clarity — inline approve/reject */}
      {pendingItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-fg-faint">
            <Sparkles size={14} className="text-primary" /> {he ? 'הצעות מ-Clarity' : 'Suggestions from Clarity'}
            <Badge variant="accent">{pendingItems.length}</Badge>
          </h2>
          {pendingItems.slice(0, 3).map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </section>
      )}

      {/* Momentum: flagged goals + actions due soon */}
      {(flaggedGoals.length > 0 || dueSoonActions.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {flaggedGoals.length > 0 && (
            <StatCard
              to="/goals"
              icon={<AlertTriangle size={18} className="text-warning" />}
              title={he ? 'מטרות שדורשות תשומת לב' : 'Goals needing attention'}
              body={
                <ul className="flex flex-col gap-1.5">
                  {flaggedGoals.map(({ goal, progress }) => (
                    <li key={goal.id} className="flex items-center justify-between gap-2 text-sm">
                      <span dir="auto" className="truncate">{goal.title}</span>
                      <Badge variant={progress!.risk === 'at_risk' ? 'danger' : 'warning'}>
                        {progress!.risk === 'at_risk' ? (he ? 'בסיכון' : 'At risk') : he ? 'תקועה' : 'Stalled'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              }
            />
          )}
          {dueSoonActions.length > 0 && (
            <StatCard
              to="/actions"
              icon={<ListTodo size={18} className="text-primary" />}
              title={he ? 'פעולות לשבוע הקרוב' : 'Actions due this week'}
              body={
                <ul className="flex flex-col gap-1.5">
                  {dueSoonActions.map((a) => {
                    const overdue = (a.dueDate ?? 0) < Date.now();
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                        <span dir="auto" className="truncate">{a.title}</span>
                        <span className={`whitespace-nowrap text-xs ${overdue ? 'text-danger' : 'text-fg-muted'}`}>
                          {new Date(a.dueDate!).toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              }
            />
          )}
        </section>
      )}

      {/* Quick stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          to="/goals"
          icon={<Target size={18} />}
          title={t('goals')}
          loading={!summary}
          body={
            summary ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(summary.byStatus).length === 0 ? (
                  <span className="text-sm text-fg-muted">{he ? 'אין מטרות עדיין' : 'No goals yet'}</span>
                ) : (
                  Object.entries(summary.byStatus).map(([status, n]) => (
                    <Badge key={status} variant={STATUS_LABEL[status]?.variant ?? 'neutral'}>
                      {STATUS_LABEL[status]?.[lang] ?? status}: {n}
                    </Badge>
                  ))
                )}
              </div>
            ) : null
          }
        />
        <StatCard
          to="/journal"
          icon={<Flame size={18} className={streak > 0 ? 'text-primary' : ''} />}
          title={t('journal')}
          loading={!journal}
          body={
            <p className="text-sm text-fg-muted">
              {streak > 0
                ? he
                  ? `רצף של ${streak} ימים 🔥`
                  : `${streak}-day streak 🔥`
                : he
                  ? 'כתוב היום כדי להתחיל רצף'
                  : 'Write today to start a streak'}
            </p>
          }
        />
        <StatCard
          to="/goals"
          icon={<CalendarClock size={18} />}
          title={he ? 'יעדים קרובים' : 'Upcoming'}
          loading={!goals}
          body={
            dueGoals.length === 0 ? (
              <p className="text-sm text-fg-muted">{he ? 'אין יעדים עם תאריך' : 'No dated targets'}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {dueGoals.map((g) => {
                  const overdue = (g.targetDate ?? 0) < Date.now();
                  return (
                    <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                      <span dir="auto" className="truncate">{g.title}</span>
                      <span className={`whitespace-nowrap text-xs ${overdue ? 'text-danger' : 'text-fg-muted'}`}>
                        {new Date(g.targetDate!).toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )
          }
        />
      </section>

      {/* Recent journal + moodboards */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-fg-faint">
            <NotebookPen size={14} /> {he ? 'רשומות אחרונות' : 'Recent journal'}
          </h2>
          {!journal ? (
            <Skeleton className="h-24 w-full" />
          ) : recentJournal.length === 0 ? (
            <p className="text-sm text-fg-faint">{he ? 'אין רשומות עדיין' : 'No entries yet'}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentJournal.map((e) => (
                <Link key={e.id} to={`/journal/${e.id}`}>
                  <Card interactive className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span dir="auto" className="truncate font-medium">{e.title || (he ? 'ללא כותרת' : 'Untitled')}</span>
                      <span className="whitespace-nowrap text-xs text-fg-muted">
                        {new Date(e.entryDate).toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {!!boards?.length && (
          <div>
            <h2 className="mb-3 text-sm font-mono uppercase tracking-wider text-fg-faint">{t('moodboard')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {boards.slice(0, 6).map((b) => (
                <Link key={b.id} to={`/moodboard/${b.id}`} title={b.title}>
                  <div className="aspect-video overflow-hidden rounded-md border border-border bg-surface">
                    {b.cover ? (
                      <img src={`/media/${b.cover}`} alt={b.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-fg-faint">
                        <Sparkles size={18} />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-mono uppercase tracking-wider text-fg-faint">{t('categories')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories?.map((c) => (
            <Link key={c.id} to={`/book/category/${c.id}`}>
              <Card interactive className="flex h-full items-center gap-3 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[color:var(--rz-accent-soft)] text-primary">
                  <Icon name={c.icon} size={22} />
                </div>
                <span dir="auto" className="flex-1 font-medium">
                  {pickLabel(lang, c.labelEn, c.labelHe)}
                </span>
                {chapter?.focusCategoryIds.includes(c.id) && <Badge variant="accent">{he ? 'מיקוד' : 'Focus'}</Badge>}
                {chapter?.maintenanceCategoryIds.includes(c.id) && <Badge>{he ? 'תחזוקה' : 'Maintain'}</Badge>}
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  to,
  icon,
  title,
  body,
  loading,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <Link to={to}>
      <Card interactive className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-fg-muted">
          {icon}
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {loading ? <Skeleton className="h-6 w-3/4" /> : body}
      </Card>
    </Link>
  );
}

/** First-run welcome: the Dream → Ward → Step method, and where to begin. */
function WelcomeCard() {
  const { lang } = useLang();
  const he = lang === 'he';
  const steps = he
    ? ['תן שם לפרק שאתה חי עכשיו', 'דרג כמה קרוב היום לחזון', 'בחר צעד קטן אחד לשבוע הזה']
    : ['Name the chapter you’re living now', 'Rate how close today is to your vision', 'Choose one small step for this week'];
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
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[color:var(--rz-accent)] font-mono text-xs text-primary">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Link to="/start" className={buttonVariants()}>
            {he ? 'בוא נתחיל · כ-10 דקות' : 'Start · about 10 min'} <ArrowRight size={15} className="rtl:rotate-180" />
          </Link>
          <Link to="/chapter" className="text-sm text-fg-muted underline-offset-4 hover:underline">
            {he ? 'או התחל ישר מהפרק' : 'Or start with your chapter'}
          </Link>
        </div>
      </div>
    </Card>
  );
}
