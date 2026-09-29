import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Bot, Check, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { ACTION_PRIORITIES, type ActionPriority } from '@dreamward/shared';
import { Badge, Button, Card, Input, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useGoals } from '@/features/goals/hooks';
import { useActions, useCreateAction, useUpdateAction, useDeleteAction, useReorderActions, type Action } from './hooks';

const PRIORITY_META: Record<ActionPriority, { he: string; en: string; variant: 'danger' | 'warning' | 'neutral' }> = {
  high: { he: 'גבוהה', en: 'High', variant: 'danger' },
  medium: { he: 'בינונית', en: 'Medium', variant: 'warning' },
  low: { he: 'נמוכה', en: 'Low', variant: 'neutral' },
};

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString();

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
  const del = useDeleteAction();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(action.title);

  const done = action.status === 'done';
  const overdue = !done && action.dueDate !== null && action.dueDate < Date.now();

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== action.title) update.mutate({ id: action.id, title: trimmed });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <button
        onClick={() => update.mutate({ id: action.id, status: done ? 'todo' : 'done' })}
        aria-label={done ? 'mark todo' : 'mark done'}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
          done ? 'border-primary bg-primary text-white' : 'border-border hover:border-primary',
        )}
      >
        {done && <Check size={13} />}
      </button>

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
            <Button variant="ghost" size="icon" onClick={saveTitle} aria-label="save title">
              <Check size={15} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditing(false)} aria-label="cancel edit">
              <X size={15} />
            </Button>
          </div>
        ) : (
          <>
            <p dir="auto" className={cn('truncate font-medium', done && 'text-fg-faint line-through')}>
              {action.title}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
              {action.dueDate !== null && (
                <span className={cn(overdue && 'font-medium text-danger')}>
                  {lang === 'he' ? 'עד' : 'Due'} {fmtDate(action.dueDate)}
                </span>
              )}
              {goalTitle && (
                <Link to="/goals" className="inline-flex items-center gap-1 hover:text-foreground">
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
        onChange={(e) => update.mutate({ id: action.id, priority: e.target.value as ActionPriority })}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none"
        aria-label="priority"
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
          <button onClick={() => onMove(-1)} className="text-fg-faint hover:text-foreground" aria-label="move up">
            <ArrowUp size={13} />
          </button>
          <button onClick={() => onMove(1)} className="text-fg-faint hover:text-foreground" aria-label="move down">
            <ArrowDown size={13} />
          </button>
        </div>
      )}
      <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="edit action">
        <Pencil size={15} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => del.mutate(action.id)} aria-label="delete action">
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
      dueDate: dueDate ? Date.parse(dueDate) : null,
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
      <div className="flex items-baseline justify-between">
        <h1 className="text-4xl font-bold">{t('actions')}</h1>
        {statusFilter !== 'done' && (
          <span className="text-sm text-fg-muted">
            {lang === 'he' ? `${openCount} פעולות פתוחות` : `${openCount} open`}
          </span>
        )}
      </div>

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
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none"
            aria-label="new action priority"
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
            className="h-9 max-w-52 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none"
            aria-label="link to goal"
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
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none"
            aria-label="due date"
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
                ? 'border-primary bg-primary text-white'
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
          className="h-7 rounded-full border border-border bg-surface px-2 text-xs text-fg-muted focus:border-primary focus:outline-none"
          aria-label="filter by priority"
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
          className="h-7 max-w-48 rounded-full border border-border bg-surface px-2 text-xs text-fg-muted focus:border-primary focus:outline-none"
          aria-label="filter by goal"
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
          <p className="py-4 text-fg-muted">{t('loading')}</p>
        ) : actions?.length ? (
          actions.map((a, i) => (
            <ActionRow
              key={a.id}
              action={a}
              goalTitle={a.goalId ? goalTitleById.get(a.goalId) : undefined}
              onMove={(dir) => move(i, dir)}
            />
          ))
        ) : (
          <p className="py-4 text-sm text-fg-faint">{t('empty')}</p>
        )}
      </Card>
    </div>
  );
}
