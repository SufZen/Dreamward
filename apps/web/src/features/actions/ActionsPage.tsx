import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Bot, Check, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { ACTION_PRIORITIES, type ActionPriority } from '@dreamward/shared';
import { Badge, Button, Card, Check as DoneCheck, Input, PageHeader, PageLoader, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api } from '@/lib/api';
import { useUndoableDelete } from '@/lib/useUndoableDelete';
import { OnboardingMotion } from '@/components/OnboardingMotion';
import { useGoals } from '@/features/goals/hooks';
import { useCompleteAction } from './useCompleteAction';
import { useActions, useCreateAction, useUpdateAction, useReorderActions, type Action } from './hooks';

const PRIORITY_META: Record<ActionPriority, { he: string; en: string; variant: 'danger' | 'warning' | 'neutral' }> = {
  high: { he: 'גבוהה', en: 'High', variant: 'danger' },
  medium: { he: 'בינונית', en: 'Medium', variant: 'warning' },
  low: { he: 'נמוכה', en: 'Low', variant: 'neutral' },
};

const fmtDate = (ms: number, lang: 'he' | 'en') =>
  new Date(ms).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });

function ActionRow({
  action,
  goalTitle,
  onMove,
}: {
  action: Action;
  goalTitle?: string;
  onMove?: (dir: -1 | 1) => void;
}) {
  const { lang } = useLang();
  const update = useUpdateAction();
  const del = useUndoableDelete<Action>({
    queryKey: ['actions'],
    remove: (id) => api.del(`/actions/${id}`),
    alsoInvalidate: [['goals-progress']],
  });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(action.title);

  const { done, setDone } = useCompleteAction(action);
  const overdue = !done && action.dueDate !== null && action.dueDate < Date.now();

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== action.title) update.mutate({ id: action.id, title: trimmed });
    setEditing(false);
  };

  return (
    <div className="group flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <DoneCheck
        checked={done}
        onChange={setDone}
        label={
          done ? (lang === 'he' ? 'סימון כפתוחה' : 'Mark as open') : lang === 'he' ? 'סימון כבוצעה' : 'Mark as done'
        }
      />

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              dir="auto"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="h-8 flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={saveTitle}
              aria-label={lang === 'he' ? 'שמירת הכותרת' : 'Save title'}
            >
              <Check size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(false)}
              aria-label={lang === 'he' ? 'ביטול העריכה' : 'Cancel editing'}
            >
              <X size={15} />
            </Button>
          </div>
        ) : (
          <>
            <p dir="auto" className={cn('truncate font-medium', done && 'text-fg-faint line-through')}>
              {action.title}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
              <DueDateChip
                value={action.dueDate}
                overdue={overdue}
                onChange={(dueDate) => update.mutate({ id: action.id, dueDate })}
              />
              {goalTitle && (
                <Link
                  to={`/goals#goal-${action.goalId}`}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Target size={11} /> <span className="max-w-40 truncate">{goalTitle}</span>
                </Link>
              )}
              {action.createdBy !== 'user' && (
                <span className="inline-flex items-center gap-1" title={action.createdBy}>
                  <Bot size={11} /> {lang === 'he' ? 'נוצר ע״י סוכן' : 'Agent-created'}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <select
        value={action.priority}
        onChange={(e) =>
          update.mutate({
            id: action.id,
            priority: e.target.value as ActionPriority,
          })
        }
        className="rz-select h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
        aria-label={lang === 'he' ? 'עדיפות' : 'Priority'}
      >
        {ACTION_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {lang === 'he' ? PRIORITY_META[p].he : PRIORITY_META[p].en}
          </option>
        ))}
      </select>
      <Badge variant={PRIORITY_META[action.priority].variant} dot>
        {lang === 'he' ? PRIORITY_META[action.priority].he : PRIORITY_META[action.priority].en}
      </Badge>

      {onMove && (
        <div className="flex flex-col">
          <button
            onClick={() => onMove(-1)}
            className="text-fg-faint hover:text-foreground"
            aria-label={lang === 'he' ? 'הזזה למעלה' : 'Move up'}
          >
            <ArrowUp size={13} />
          </button>
          <button
            onClick={() => onMove(1)}
            className="text-fg-faint hover:text-foreground"
            aria-label={lang === 'he' ? 'הזזה למטה' : 'Move down'}
          >
            <ArrowDown size={13} />
          </button>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditing(true)}
        aria-label={lang === 'he' ? 'עריכת הצעד' : 'Edit step'}
      >
        <Pencil size={15} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => del(action, action.title)}
        aria-label={lang === 'he' ? 'מחיקת הצעד' : 'Delete step'}
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}

export function ActionsPage() {
  const { t, lang } = useLang();
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('todo');
  const [priorityFilter, setPriorityFilter] = useState<'' | ActionPriority>('');
  const [goalFilter, setGoalFilter] = useState('');

  const { data: actions, isLoading } = useActions({
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter || undefined,
    goalId: goalFilter || undefined,
  });
  const { data: goals } = useGoals();
  const create = useCreateAction();
  const reorder = useReorderActions();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<ActionPriority>('medium');
  const [goalId, setGoalId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const goalTitleById = useMemo(() => new Map((goals ?? []).map((g) => [g.id, g.title])), [goals]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({
      title: title.trim(),
      priority,
      goalId: goalId || null,
      dueDate: fromDateInput(dueDate),
    });
    setTitle('');
    setDueDate('');
  };

  const move = (idx: number, dir: -1 | 1) => {
    if (!actions) return;
    const target = idx + dir;
    if (target < 0 || target >= actions.length) return;
    const order = actions.map((a) => a.id);
    [order[idx], order[target]] = [order[target]!, order[idx]!];
    reorder.mutate(order);
  };

  const openCount = actions?.filter((a) => a.status === 'todo').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('actions')}
        description={
          lang === 'he'
            ? `כל הצעדים הקטנים, במקום אחד. ${openCount} פתוחים.`
            : `Every small step, in one place. ${openCount} open.`
        }
      />

      <Card className="p-5">
        <form onSubmit={add} className="flex flex-col gap-3 lg:flex-row">
          <Input
            dir="auto"
            placeholder={lang === 'he' ? 'פעולה חדשה…' : 'New action…'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as ActionPriority)}
            className="rz-select h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
            aria-label={lang === 'he' ? 'עדיפות לצעד החדש' : 'Priority for the new step'}
          >
            {ACTION_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {lang === 'he' ? PRIORITY_META[p].he : PRIORITY_META[p].en}
              </option>
            ))}
          </select>
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="rz-select h-9 max-w-52 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
            aria-label={lang === 'he' ? 'שיוך למטרה' : 'Link to a goal'}
          >
            <option value="">{lang === 'he' ? 'ללא מטרה' : 'No goal'}</option>
            {goals?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[color:var(--rz-accent-ring)] transition-[border-color,box-shadow]"
            aria-label={lang === 'he' ? 'תאריך יעד' : 'Due date'}
          />
          <Button type="submit" disabled={!title.trim() || create.isPending}>
            <Plus size={15} /> {lang === 'he' ? 'הוסף' : 'Add'}
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {(['todo', 'done', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              statusFilter === s
                ? 'border-primary bg-primary text-[color:var(--rz-accent-fg)]'
                : 'border-border text-fg-muted hover:text-foreground',
            )}
          >
            {s === 'todo'
              ? lang === 'he'
                ? 'פתוחות'
                : 'Open'
              : s === 'done'
                ? lang === 'he'
                  ? 'הושלמו'
                  : 'Done'
                : lang === 'he'
                  ? 'הכל'
                  : 'All'}
          </button>
        ))}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as '' | ActionPriority)}
          className="rz-select h-7 rounded-full border border-border bg-surface px-2 text-xs text-fg-muted"
          aria-label={lang === 'he' ? 'סינון לפי עדיפות' : 'Filter by priority'}
        >
          <option value="">{lang === 'he' ? 'כל העדיפויות' : 'All priorities'}</option>
          {ACTION_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {lang === 'he' ? PRIORITY_META[p].he : PRIORITY_META[p].en}
            </option>
          ))}
        </select>
        <select
          value={goalFilter}
          onChange={(e) => setGoalFilter(e.target.value)}
          className="rz-select h-7 max-w-48 rounded-full border border-border bg-surface px-2 text-xs text-fg-muted"
          aria-label={lang === 'he' ? 'סינון לפי מטרה' : 'Filter by goal'}
        >
          <option value="">{lang === 'he' ? 'כל המטרות' : 'All goals'}</option>
          {goals?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>

      <Card className="px-5 py-2">
        {isLoading ? (
          <PageLoader label={t('loading')} />
        ) : actions?.length ? (
          actions.map((a, i) => (
            <ActionRow
              key={a.id}
              action={a}
              goalTitle={a.goalId ? goalTitleById.get(a.goalId) : undefined}
              onMove={(dir) => move(i, dir)}
            />
          ))
        ) : statusFilter !== 'todo' || priorityFilter || goalFilter ? (
          <p className="py-4 text-sm text-fg-faint">{t('empty')}</p>
        ) : (
          <div className="grid items-center gap-5 py-4 sm:grid-cols-[minmax(0,260px)_1fr]">
            <OnboardingMotion name="steps" />
            <p className="text-sm text-fg-muted">
              {lang === 'he'
                ? 'צעד אחד בכל פעם. הוסף פעולה קטנה מספיק כדי לעשות אותה השבוע, ותן לה תאריך.'
                : 'One step at a time. Add an action small enough to do this week, and give it a date.'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

const toDateInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** End of the chosen local day, so "due today" stays due all day. */
const fromDateInput = (v: string) => (v ? new Date(`${v}T23:59:59`).getTime() : null);

/** The due date, editable in place: click to pick a date, × to clear it. */
function DueDateChip({ value, overdue, onChange }: { value: number | null; overdue: boolean; onChange: (v: number | null) => void }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="date"
          autoFocus
          defaultValue={value ? toDateInput(value) : ''}
          aria-label={he ? 'תאריך יעד' : 'Due date'}
          onChange={(e) => {
            if (e.target.value) {
              onChange(fromDateInput(e.target.value));
              setEditing(false);
            }
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          className="h-7 rounded-sm border border-border bg-surface px-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
        />
        {value !== null && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(null);
              setEditing(false);
            }}
            className="rounded-xs px-1 text-fg-subtle hover:text-foreground"
            aria-label={he ? 'הסרת התאריך' : 'Remove the date'}
          >
            ×
          </button>
        )}
      </span>
    );
  }
  return value !== null ? (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn('rounded-xs hover:text-foreground hover:underline', overdue && 'font-medium text-danger')}
      title={he ? 'שינוי התאריך' : 'Change the date'}
    >
      {he ? 'עד' : 'Due'} {fmtDate(value, lang)}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="rounded-xs text-fg-faint opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
    >
      {he ? '+ תאריך' : '+ Add a date'}
    </button>
  );
}
