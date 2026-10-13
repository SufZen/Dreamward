import { Link } from 'react-router-dom';
import { Check, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useCompleteAction } from './useCompleteAction';
import type { Action } from './hooks';

const DAY = 86_400_000;

/** "Today", "Tomorrow", "Overdue · 3 Oct" or a short date, in the UI language. */
export function dueLabel(
  due: number | null,
  lang: 'he' | 'en',
): { text: string; tone: 'danger' | 'accent' | 'muted' } | null {
  if (due == null) return null;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const day = new Date(due).setHours(0, 0, 0, 0);
  const fmt = new Date(due).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' });
  if (day < startOfToday)
    return {
      text: lang === 'he' ? `באיחור · ${fmt}` : `Overdue · ${fmt}`,
      tone: 'danger',
    };
  if (day === startOfToday) return { text: lang === 'he' ? 'היום' : 'Today', tone: 'accent' };
  if (day === startOfToday + DAY) return { text: lang === 'he' ? 'מחר' : 'Tomorrow', tone: 'muted' };
  return { text: fmt, tone: 'muted' };
}

/**
 * One step, checkable in place: the compact row used on Today, inside goals
 * and on area pages. The full editor lives on the Actions page.
 */
export function StepItem({
  action,
  goalTitle,
  goalId,
}: {
  action: Action;
  goalTitle?: string;
  goalId?: string | null;
}) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { done, setDone } = useCompleteAction(action);
  const due = dueLabel(action.dueDate, lang);
  return (
    <li className="flex items-center gap-3 py-2">
      <Check
        checked={done}
        onChange={setDone}
        label={done ? (he ? 'סימון כפתוחה' : 'Mark as open') : he ? 'סימון כבוצעה' : 'Mark as done'}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate transition-colors duration-moderate',
            done && 'text-fg-subtle line-through decoration-[color:var(--rz-fg-faint)]',
          )}
        >
          <bdi>{action.title}</bdi>
        </p>
        {(goalTitle || due) && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
            {due && (
              <span className={cn(due.tone === 'danger' && 'text-danger', due.tone === 'accent' && 'text-primary')}>
                {due.text}
              </span>
            )}
            {goalTitle && goalId && (
              <Link to={`/goals#goal-${goalId}`} className="truncate hover:text-foreground">
                <bdi>{goalTitle}</bdi>
              </Link>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
