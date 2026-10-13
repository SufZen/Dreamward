import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Eye, FileText, Gauge } from 'lucide-react';
import { Card, PageHeader, PageLoader, ProgressRing, cn } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { Icon } from '@/components/Icon';
import { useCategories, useContentBlocks } from './hooks';
import { useCurrentChapter, useLatestRatings } from '@/features/chapter/hooks';
import { useGoalsSummary } from '@/features/goals/hooks';
import { useIkigai } from '@/features/ikigai/hooks';

/** True when a content block has something written in it. */
function isWritten(b: { content: unknown; bodyRichtext: string | null }) {
  const text = (b.bodyRichtext ?? '').replace(/<[^>]*>/g, '').trim();
  if (text) return true;
  if (Array.isArray(b.content)) return b.content.length > 0;
  return false;
}

/**
 * The book's table of contents: every page in one place. Foundations first
 * (the cover, the dream life, IKIGAI and the opening and closing pages), then
 * the twelve life areas with where each one stands.
 */
export function BookHubPage() {
  const { lang, t } = useLang();
  const he = lang === 'he';
  const { data: categories, isLoading } = useCategories();
  const { data: blocks } = useContentBlocks();
  const { data: chapter } = useCurrentChapter();
  const { data: ratings } = useLatestRatings();
  const { data: summary } = useGoalsSummary();
  const { data: ikigai } = useIkigai();

  if (isLoading) return <PageLoader label={t('loading')} />;

  const focus = chapter?.focusCategoryIds ?? [];
  const score = new Map((ratings ?? []).map((r) => [r.categoryId, r.latest?.score ?? null]));
  const front = (blocks ?? []).filter((b) => b.group === 'front_matter' && b.id !== 'cover');
  const impl = (blocks ?? []).filter((b) => b.group === 'implementation');
  const written = (blocks ?? []).filter(isWritten).length;

  const foundation = [
    {
      to: '/book/cover',
      icon: <BookOpen size={18} />,
      title: he ? 'שער' : 'Cover',
      hint: he ? 'מי אתה ומה הספר הזה בשבילך' : 'Who you are and what this book is for',
    },
    {
      to: '/book/life-vision',
      icon: <Eye size={18} />,
      title: t('lifeVision'),
      hint: he ? 'יום רגיל בחיים שאתה רוצה' : 'An ordinary day in the life you want',
    },
    {
      to: '/ikigai',
      icon: <span className="text-base leading-none">生</span>,
      title: t('ikigai'),
      hint: ikigai?.current?.statement ?? (he ? 'הסיבה שלך לקום בבוקר' : 'Your reason to get up in the morning'),
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={t('myBook')}
        description={
          he
            ? 'כל עמודי הספר במקום אחד: היסודות, ושנים-עשר תחומי החיים — איפה כל אחד עומד היום.'
            : 'Every page of your book in one place: the foundations, and the twelve life areas — where each one stands today.'
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{he ? 'יסודות' : 'Foundations'}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {foundation.map((f) => (
            <Link key={f.to} to={f.to} className="block">
              <Card interactive className="flex h-full flex-col gap-2">
                <div className="flex items-center gap-2 text-primary">
                  {f.icon}
                  <span className="font-medium text-foreground">{f.title}</span>
                </div>
                <p dir="auto" className="line-clamp-2 text-sm text-fg-muted">
                  {f.hint}
                </p>
              </Card>
            </Link>
          ))}
        </div>
        {(front.length > 0 || impl.length > 0) && (
          <div className="grid gap-x-6 gap-y-1 rounded-lg border border-border p-3 sm:grid-cols-2">
            {[
              [he ? 'פתיחה' : 'Opening pages', front],
              [he ? 'יישום' : 'Putting it to work', impl],
            ].map(([label, list]) => (
              <div key={label as string} className="flex flex-col">
                <div className="px-2 pb-1 pt-1 text-xs font-medium text-fg-subtle">{label as string}</div>
                {(list as typeof front).map((b) => (
                  <Link
                    key={b.id}
                    to={`/book/${b.group === 'implementation' ? 'implementation' : 'front'}/${b.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    <FileText size={15} className="flex-none text-fg-subtle" />
                    <span className="flex-1 truncate">{pickLabel(lang, b.labelEn, b.labelHe)}</span>
                    {isWritten(b) && (
                      <span
                        className="h-1.5 w-1.5 flex-none rounded-full bg-success"
                        aria-label={he ? 'נכתב' : 'Written'}
                      />
                    )}
                  </Link>
                ))}
              </div>
            ))}
            <p className="px-2 pt-2 text-xs text-fg-subtle sm:col-span-2">
              {he
                ? `${written} מתוך ${(blocks ?? []).length} עמודים נכתבו`
                : `${written} of ${(blocks ?? []).length} pages written`}
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{he ? 'תחומי החיים' : 'Life areas'}</h2>
          <Link to="/chapter" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-foreground">
            <Gauge size={15} /> {he ? 'דירוג מחדש בגלגל' : 'Re-rate the wheel'}
          </Link>
        </div>
        <div className="rz-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(categories ?? [])
            .slice()
            .sort((a, b) => Number(focus.includes(b.id)) - Number(focus.includes(a.id)) || a.sortOrder - b.sortOrder)
            .map((c, i) => {
              const s = score.get(c.id);
              const goals = summary?.byCategory?.[c.id] ?? 0;
              const isFocus = focus.includes(c.id);
              return (
                <Link key={c.id} to={`/book/category/${c.id}`} className="block" style={{ '--i': i } as CSSProperties}>
                  <Card interactive featured={isFocus} className="flex h-full items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 flex-none items-center justify-center rounded-lg',
                        isFocus ? 'bg-[color:var(--rz-accent-soft)] text-primary' : 'bg-surface text-fg-muted',
                      )}
                    >
                      <Icon name={c.icon} size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{pickLabel(lang, c.labelEn, c.labelHe)}</div>
                      <div className="text-xs text-fg-subtle">
                        {isFocus && <span className="text-primary">{he ? 'במיקוד · ' : 'Focus · '}</span>}
                        {goals > 0
                          ? he
                            ? `${goals} מטרות`
                            : `${goals} goal${goals === 1 ? '' : 's'}`
                          : he
                            ? 'אין מטרות עדיין'
                            : 'No goals yet'}
                      </div>
                    </div>
                    {s != null ? (
                      <ProgressRing
                        value={s / 10}
                        size={40}
                        stroke={3.5}
                        label={s}
                        ariaLabel={he ? `${s} מתוך 10` : `${s} of 10`}
                      />
                    ) : (
                      <span className="text-xs text-fg-faint">{he ? 'לא דורג' : 'Not rated'}</span>
                    )}
                  </Card>
                </Link>
              );
            })}
        </div>
      </section>
    </div>
  );
}
