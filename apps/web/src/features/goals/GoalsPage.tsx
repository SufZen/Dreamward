import { useState } from 'react';
import { Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { GOAL_STATUSES, type GoalProgress, type GoalStatus } from '@dreamward/shared';
import { Badge, Button, Card, Input, cn } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { useCategories } from '@/features/book/hooks';
import {
  useGoals,
  useGoalsSummary,
  useGoalsProgress,
  useCreateGoal,
  useSetGoalStatus,
  useDeleteGoal,
  type Goal,
} from './hooks';

const STATUS_META: Record<GoalStatus, { he: string; en: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  achieved: { he: 'הושגה', en: 'Achieved', variant: 'success' },
  partial: { he: 'הושגה חלקית', en: 'Partial', variant: 'warning' },
  not_achieved: { he: 'לא הושגה', en: 'Not achieved', variant: 'danger' },
  not_relevant: { he: 'לא רלוונטית', en: 'Not relevant', variant: 'neutral' },
};

const RISK_META = {
  stalled: { he: 'תקועה', en: 'Stalled', variant: 'warning' as const },
  at_risk: { he: 'בסיכון', en: 'At risk', variant: 'danger' as const },
};

function GoalRow({ goal, progress }: { goal: Goal; progress?: GoalProgress }) {
  const { lang } = useLang();
  const { data: categories } = useCategories();
  const setStatus = useSetGoalStatus();
  const del = useDeleteGoal();
  const category = categories?.find((c) => c.id === goal.categoryId);

  const momentum = progress ? progress.doneThisWeek - progress.donePrevWeek : 0;

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate font-medium">
          {goal.title}
        </p>
        <div className="flex items-center gap-2">
          {category && (
            <p className="text-xs text-fg-subtle">{pickLabel(lang, category.labelEn, category.labelHe)}</p>
          )}
          {progress && progress.pct !== null && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface">
                <div
                  className={cn('h-full rounded-full transition-all', progress.pct === 100 ? 'bg-success' : 'bg-primary')}
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <span className="text-xs text-fg-subtle">
                {progress.doneActions}/{progress.totalActions} · {progress.pct}%
              </span>
              {momentum !== 0 && (
                <span
                  className={cn('inline-flex items-center', momentum > 0 ? 'text-success' : 'text-fg-faint')}
                  title={lang === 'he' ? 'מומנטום שבועי' : 'Weekly momentum'}
                >
                  {momentum > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                </span>
              )}
            </div>
          )}
          {progress && progress.risk !== 'on_track' && (
            <Badge variant={RISK_META[progress.risk].variant}>
              {lang === 'he' ? RISK_META[progress.risk].he : RISK_META[progress.risk].en}
            </Badge>
          )}
        </div>
      </div>
      <select
        value={goal.status}
        onChange={(e) => setStatus.mutate({ id: goal.id, status: e.target.value as GoalStatus })}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none"
      >
        {GOAL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {lang === 'he' ? STATUS_META[s].he : STATUS_META[s].en}
          </option>
        ))}
      </select>
      <Badge variant={STATUS_META[goal.status].variant} dot>
        {lang === 'he' ? STATUS_META[goal.status].he : STATUS_META[goal.status].en}
      </Badge>
      <Button variant="ghost" size="icon" onClick={() => del.mutate(goal.id)} aria-label="delete goal">
        <Trash2 size={15} />
      </Button>
    </div>
  );
}

export function GoalsPage() {
  const { t, lang } = useLang();
  const { data: goals, isLoading } = useGoals();
  const { data: summary } = useGoalsSummary();
  const { data: progressMap } = useGoalsProgress();
  const { data: categories } = useCategories();
  const create = useCreateGoal();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({ title: title.trim(), categoryId: categoryId || null });
    setTitle('');
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">{t('goals')}</h1>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GOAL_STATUSES.map((s) => (
            <Card key={s} className={cn('p-4 text-center', summary.byStatus[s] ? '' : 'opacity-60')}>
              <div className="text-3xl font-bold text-primary">{summary.byStatus[s] ?? 0}</div>
              <div className="mt-1 text-xs text-fg-muted">{lang === 'he' ? STATUS_META[s].he : STATUS_META[s].en}</div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5">
        <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row">
          <Input
            dir="auto"
            placeholder={lang === 'he' ? 'מטרה חדשה…' : 'New goal…'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">{lang === 'he' ? 'ללא קטגוריה' : 'No category'}</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {pickLabel(lang, c.labelEn, c.labelHe)}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!title.trim() || create.isPending}>
            <Plus size={15} /> {lang === 'he' ? 'הוסף' : 'Add'}
          </Button>
        </form>
      </Card>

      <Card className="px-5 py-2">
        {isLoading ? (
          <p className="py-4 text-fg-muted">{t('loading')}</p>
        ) : goals?.length ? (
          goals.map((g) => <GoalRow key={g.id} goal={g} progress={progressMap?.[g.id]} />)
        ) : (
          <p className="py-4 text-sm text-fg-faint">{t('empty')}</p>
        )}
      </Card>
    </div>
  );
}
