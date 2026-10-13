import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { GOAL_STATUSES, type GoalProgress, type GoalStatus } from '@dreamward/shared';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  PageLoader,
  ProgressRing,
  StarBurst,
  Textarea,
  cn,
  toast,
  type StarBurstHandle,
} from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { api } from '@/lib/api';
import { useUndoableDelete } from '@/lib/useUndoableDelete';
import { useCategories } from '@/features/book/hooks';
import { OnboardingMotion } from '@/components/OnboardingMotion';
import { useActions, useCreateAction } from '@/features/actions/hooks';
import { StepItem, dueLabel } from '@/features/actions/StepItem';
import { useGoals, useGoalsProgress, useCreateGoal, useSetGoalStatus, useUpdateGoal, type Goal } from './hooks';

/** Review outcomes (set at a review), not progress — a goal is "in progress" until achieved. */
const OUTCOME: Record<GoalStatus, { he: string; en: string }> = {
  achieved: { he: 'הושגה', en: 'Achieved' },
  partial: { he: 'הושגה חלקית', en: 'Partly achieved' },
  not_achieved: { he: 'לא הושגה', en: 'Not achieved' },
  not_relevant: { he: 'פתוחה', en: 'Open' },
};

/** Local calendar date (toISOString would shift it a day east of UTC). */
const toDateInput = (ms: number | null) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fromDateInput = (v: string) => (v ? new Date(`${v}T12:00:00`).getTime() : null);

type Filter = 'open' | 'achieved' | 'all';

export function GoalsPage() {
  const { t, lang } = useLang();
  const he = lang === 'he';
  const { data: goals, isLoading } = useGoals();
  const { data: progressMap } = useGoalsProgress();
  const { data: categories } = useCategories();
  const create = useCreateGoal();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [filter, setFilter] = useState<Filter>('open');
  const { hash } = useLocation();
  const navigate = useNavigate();
  const target = hash.startsWith('#goal-') ? hash.slice(6) : null;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t2 = title.trim();
    if (!t2) return;
    create.mutate(
      { title: t2, categoryId: categoryId || null },
      {
        onSuccess: (g) => {
          toast(he ? 'המטרה נוספה — מה הצעד הראשון?' : 'Goal added — what’s the first step?', { tone: 'success' });
          setFilter('open');
          navigate(`#goal-${g.id}`, { replace: true });
        },
      },
    );
    setTitle('');
  };

  if (isLoading) return <PageLoader label={t('loading')} />;

  const open = (goals ?? []).filter((g) => g.status !== 'achieved');
  const achieved = (goals ?? []).filter((g) => g.status === 'achieved');
  const list = filter === 'open' ? open : filter === 'achieved' ? achieved : (goals ?? []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('goals')}
        description={
          he
            ? 'כל מטרה היא כוכב; הצעדים הם הדרך אליו. פרק כל מטרה לצעד הבא שלה — כאן, בתוך המטרה.'
            : 'Each goal is a star; the steps are the way there. Break every goal into its next step — right here, inside it.'
        }
      />

      <Card className="p-4">
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <Input
            dir="auto"
            placeholder={
              he ? 'מטרה חדשה — למשל: לרוץ חצי מרתון באביב' : 'A new goal — e.g. run a half-marathon in spring'
            }
            aria-label={he ? 'מטרה חדשה' : 'New goal'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label={he ? 'תחום חיים' : 'Life area'}
            className="rz-select h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            <option value="">{he ? 'בלי תחום' : 'No area'}</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {pickLabel(lang, c.labelEn, c.labelHe)}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!title.trim()} loading={create.isPending}>
            <Plus size={15} /> {he ? 'הוספה' : 'Add'}
          </Button>
        </form>
      </Card>

      {(goals ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={he ? 'סינון מטרות' : 'Filter goals'}>
          {(
            [
              ['open', he ? 'בדרך' : 'In progress', open.length],
              ['achieved', he ? 'הושגו' : 'Achieved', achieved.length],
              ['all', he ? 'הכול' : 'All', (goals ?? []).length],
            ] as const
          ).map(([f, label, n]) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'rz-press rounded-full border px-3 py-1 text-sm transition-colors',
                filter === f
                  ? 'border-transparent bg-foreground text-background'
                  : 'border-border text-fg-muted hover:text-foreground',
              )}
            >
              {label} <span className="tabular opacity-70">{n}</span>
            </button>
          ))}
        </div>
      )}

      {(goals ?? []).length === 0 ? (
        <Card className="grid items-center gap-5 p-6 sm:grid-cols-[minmax(0,260px)_1fr]">
          <OnboardingMotion name="steps" />
          <div className="flex flex-col gap-2">
            <p className="font-medium">{he ? 'עוד אין מטרות' : 'No goals yet'}</p>
            <p className="text-sm text-fg-muted">
              {he
                ? 'כתוב מטרה אחת למעלה. מיד אחרי זה נפרק אותה לצעד ראשון, קטן מספיק לעשות השבוע.'
                : 'Write one goal above. Right after, you’ll break it into a first step small enough to do this week.'}
            </p>
          </div>
        </Card>
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-fg-muted">
          {filter === 'achieved'
            ? he
              ? 'עוד לא סימנת מטרה כמושגת. זה יגיע.'
              : 'No achieved goals yet. It’s coming.'
            : he
              ? 'כל המטרות הושגו. זמן לחלום את הבאה.'
              : 'Every goal achieved. Time to dream the next one.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((g) => (
            <GoalCard key={g.id} goal={g} progress={progressMap?.[g.id]} highlight={target === g.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, progress, highlight }: { goal: Goal; progress?: GoalProgress; highlight: boolean }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: categories } = useCategories();
  const setStatus = useSetGoalStatus();
  const update = useUpdateGoal();
  const del = useUndoableDelete<Goal>({
    queryKey: ['goals'],
    remove: (id) => api.del(`/goals/${id}`),
    alsoInvalidate: [['goals-summary'], ['goals-progress'], ['actions']],
  });
  const [open, setOpen] = useState(highlight);
  const [editing, setEditing] = useState(false);
  const burst = useRef<StarBurstHandle>(null);
  const ref = useRef<HTMLDivElement>(null);
  const achieved = goal.status === 'achieved';
  const category = categories?.find((c) => c.id === goal.categoryId);
  const due = !achieved ? dueLabel(goal.targetDate, lang) : null;
  const pct = progress?.pct ?? null;

  useEffect(() => {
    if (!highlight) return;
    setOpen(true);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  const markAchieved = () => {
    setStatus.mutate(
      { id: goal.id, status: 'achieved' },
      {
        onSuccess: () =>
          toast(he ? `הושגה: ${goal.title}` : `Achieved: ${goal.title}`, {
            tone: 'success',
          }),
      },
    );
    burst.current?.fire();
  };

  return (
    <Card
      ref={ref}
      id={`goal-${goal.id}`}
      className={cn(
        'scroll-mt-24 p-0 transition-[box-shadow,border-color] duration-moderate',
        highlight && 'border-[color:var(--rz-border-accent)] shadow-glow',
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
        >
          {achieved ? (
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[color:var(--rz-accent-soft)] text-primary">
              <Trophy size={19} />
            </span>
          ) : (
            <ProgressRing
              value={(pct ?? 0) / 100}
              size={44}
              stroke={4}
              label={pct == null ? '–' : `${pct}%`}
              ariaLabel={pct == null ? (he ? 'אין צעדים' : 'No steps yet') : `${pct}%`}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn('truncate font-medium', achieved && 'text-fg-muted')}>
              <bdi>{goal.title}</bdi>
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
              {category && <span>{pickLabel(lang, category.labelEn, category.labelHe)}</span>}
              {due && (
                <span className={cn(due.tone === 'danger' && 'text-danger', due.tone === 'accent' && 'text-primary')}>
                  {he ? 'יעד: ' : 'Target: '}
                  {due.text}
                </span>
              )}
              {progress && progress.totalActions > 0 && (
                <span>
                  {he
                    ? `${progress.doneActions}/${progress.totalActions} צעדים`
                    : `${progress.doneActions}/${progress.totalActions} steps`}
                </span>
              )}
              {progress?.risk === 'stalled' && <Badge variant="warning">{he ? 'תקועה' : 'Stalled'}</Badge>}
              {progress?.risk === 'at_risk' && <Badge variant="danger">{he ? 'בסיכון' : 'At risk'}</Badge>}
              {goal.status !== 'not_relevant' && !achieved && (
                <Badge>{he ? OUTCOME[goal.status].he : OUTCOME[goal.status].en}</Badge>
              )}
            </p>
          </div>
          <ChevronDown
            size={18}
            className={cn(
              'flex-none text-fg-subtle transition-transform duration-spring ease-spring',
              open && 'rotate-180',
            )}
          />
        </button>
        <div className="relative hidden flex-none sm:block">
          {achieved ? (
            <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ id: goal.id, status: 'not_relevant' })}>
              {he ? 'פתיחה מחדש' : 'Reopen'}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={markAchieved}>
              <Trophy size={14} /> {he ? 'הושגה' : 'Achieved'}
            </Button>
          )}
          <StarBurst ref={burst} scale="goal" />
        </div>
      </div>

      {open && (
        <div className="rz-animate-fade-in border-t border-border px-4 pb-4 pt-2">
          {editing ? (
            <GoalEditor goal={goal} onDone={() => setEditing(false)} update={update} />
          ) : (
            <>
              {goal.description && (
                <p dir="auto" className="py-2 text-sm text-fg-muted">
                  {goal.description}
                </p>
              )}
              <GoalSteps goal={goal} />
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> {he ? 'עריכה' : 'Edit'}
                </Button>
                {!achieved && (
                  <Button variant="ghost" size="sm" className="sm:hidden" onClick={markAchieved}>
                    <Trophy size={14} /> {he ? 'הושגה' : 'Achieved'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ms-auto text-fg-subtle hover:text-danger"
                  onClick={() => del(goal, goal.title)}
                >
                  <Trash2 size={14} /> {he ? 'מחיקה' : 'Delete'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function GoalSteps({ goal }: { goal: Goal }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: actions, isLoading } = useActions({ goalId: goal.id });
  const create = useCreateAction();
  const [title, setTitle] = useState('');
  const openSteps = (actions ?? []).filter((a) => a.status !== 'done');
  const doneCount = (actions ?? []).length - openSteps.length;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    create.mutate({ title: t, goalId: goal.id });
    setTitle('');
  };

  return (
    <div className="flex flex-col">
      {isLoading ? null : openSteps.length > 0 ? (
        <ul className="divide-y divide-border">
          {openSteps.map((a) => (
            <StepItem key={a.id} action={a} />
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-fg-muted">
          {doneCount > 0
            ? he
              ? 'כל הצעדים בוצעו. מה הצעד הבא — או שהמטרה הושגה?'
              : 'All steps done. What’s next — or is the goal achieved?'
            : he
              ? 'מה הצעד הראשון? קטן מספיק כדי לעשות אותו השבוע.'
              : 'What’s the first step? Small enough to do this week.'}
        </p>
      )}
      {doneCount > 0 && openSteps.length > 0 && (
        <p className="pt-1 text-xs text-fg-subtle">
          {he ? `${doneCount} צעדים כבר בוצעו` : `${doneCount} step${doneCount === 1 ? '' : 's'} already done`}
        </p>
      )}
      <form
        onSubmit={add}
        className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-border px-3 transition-colors focus-within:border-solid focus-within:border-primary"
      >
        <Plus size={16} className="flex-none text-fg-subtle" />
        <input
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={he ? 'הוספת צעד…' : 'Add a step…'}
          aria-label={he ? `צעד חדש עבור ${goal.title}` : `New step for ${goal.title}`}
          className="h-10 flex-1 bg-transparent text-sm placeholder:text-fg-faint focus:outline-none"
        />
        {title.trim() && (
          <Button type="submit" size="sm" loading={create.isPending}>
            {he ? 'הוספה' : 'Add'}
          </Button>
        )}
      </form>
    </div>
  );
}

function GoalEditor({
  goal,
  onDone,
  update,
}: {
  goal: Goal;
  onDone: () => void;
  update: ReturnType<typeof useUpdateGoal>;
}) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: categories } = useCategories();
  const setStatus = useSetGoalStatus();
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? '');
  const [categoryId, setCategoryId] = useState(goal.categoryId ?? '');
  const [date, setDate] = useState(toDateInput(goal.targetDate));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    update.mutate(
      {
        id: goal.id,
        title: title.trim(),
        description: description.trim() || null,
        categoryId: categoryId || null,
        targetDate: fromDateInput(date),
      },
      {
        onSuccess: () => {
          toast(he ? 'המטרה עודכנה' : 'Goal updated', { tone: 'success' });
          onDone();
        },
      },
    );
  };

  const label = 'flex flex-col gap-1.5 text-sm text-fg-muted';
  return (
    <form onSubmit={save} className="flex flex-col gap-3 pt-2">
      <label className={label}>
        {he ? 'שם המטרה' : 'Goal'}
        <Input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className={label}>
        {he ? 'למה זה חשוב לי' : 'Why it matters'}
        <Textarea dir="auto" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          {he ? 'תחום חיים' : 'Life area'}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rz-select h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            <option value="">{he ? 'בלי תחום' : 'No area'}</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {pickLabel(lang, c.labelEn, c.labelHe)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {he ? 'תאריך יעד' : 'Target date'}
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={label}>
          {he ? 'תוצאה בסקירה' : 'Review outcome'}
          <select
            value={goal.status}
            onChange={(e) =>
              setStatus.mutate({
                id: goal.id,
                status: e.target.value as GoalStatus,
              })
            }
            className="rz-select h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            {GOAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {he ? OUTCOME[s].he : OUTCOME[s].en}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={update.isPending}>
          {he ? 'שמירה' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {he ? 'ביטול' : 'Cancel'}
        </Button>
      </div>
    </form>
  );
}
