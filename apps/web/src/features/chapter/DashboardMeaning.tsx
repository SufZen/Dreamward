import { Link } from 'react-router-dom';
import { Compass, Gauge } from 'lucide-react';
import { Badge, Card } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useAreaLabel } from '@/features/book/hooks';
import { IkigaiCard } from '@/features/ikigai/IkigaiPage';
import { LifeWheel } from './LifeWheel';
import { useCurrentChapter, useLatestRatings } from './hooks';

/** Dashboard block: current chapter + IKIGAI, then the life wheel. */
export function DashboardMeaning() {
  const { lang } = useLang();
  const areaLabel = useAreaLabel();
  const he = lang === 'he';
  const { data: chapter, isLoading } = useCurrentChapter();
  const { data: ratings } = useLatestRatings();
  const rated = (ratings ?? []).filter((r) => r.latest);
  const focus = chapter?.focusCategoryIds ?? [];

  // Biggest gaps: focus categories first, lowest score first.
  const gaps = rated
    .slice()
    .sort((a, b) => Number(focus.includes(b.categoryId)) - Number(focus.includes(a.categoryId)) || a.latest!.score - b.latest!.score)
    .slice(0, 4);

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Link to="/chapter" className="lg:col-span-2">
          <Card interactive featured={Boolean(chapter)} className="flex h-full flex-col gap-2 p-4">
            <div className="flex items-center gap-2 text-fg-muted">
              <Compass size={18} className="text-primary" />
              <span className="text-sm font-medium text-foreground">{he ? 'הפרק הנוכחי' : 'Current chapter'}</span>
            </div>
            {isLoading ? null : chapter ? (
              <>
                <p dir="auto" className="text-lg font-semibold">
                  {chapter.title}
                </p>
                {chapter.intention && (
                  <p dir="auto" className="line-clamp-2 text-sm text-fg-muted">
                    {chapter.intention}
                  </p>
                )}
                {focus.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {focus.map((id) => (
                      <Badge key={id} variant="accent">
                        {areaLabel(id)}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-fg-muted">
                {he
                  ? 'איזו תקופה אתה חי עכשיו? תן לה שם ובחר 1-5 תחומי מיקוד ←'
                  : 'What season are you living now? Name it and pick 1–5 focus areas →'}
              </p>
            )}
          </Card>
        </Link>
        <Link to="/ikigai">
          <IkigaiCard />
        </Link>
      </div>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-fg-muted">
          <Gauge size={18} className="text-primary" />
          <span className="text-sm font-medium text-foreground">{he ? 'גלגל החיים' : 'Life wheel'}</span>
          <span className="text-xs text-fg-faint">{he ? '· כמה קרוב היום לחזון (1-10)' : '· how close today is to the vision (1–10)'}</span>
        </div>
        {rated.length === 0 ? (
          <p className="py-4 text-sm text-fg-muted">
            {he
              ? 'עוד לא דירגת אף תחום. פתח קטגוריה ודרג "איפה אני עכשיו" — זה לוקח 30 שניות ומראה לך איפה הפער הכי גדול.'
              : 'You haven’t rated any area yet. Open a category and rate “where I am now” — it takes 30 seconds and shows where the biggest gap is.'}
          </p>
        ) : (
          <div className="grid items-center gap-4 md:grid-cols-[1fr_240px]">
            <LifeWheel ratings={ratings ?? []} focus={focus} />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-fg-faint">{he ? 'הפערים הבולטים' : 'Biggest gaps'}</span>
              {gaps.map((r) => (
                <Link key={r.categoryId} to={`/book/category/${r.categoryId}`} className="rounded-md p-2 hover:bg-surface-hover">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {areaLabel(r.categoryId)}
                      {focus.includes(r.categoryId) && <span className="ms-1 text-primary">★</span>}
                    </span>
                    <span className="font-mono text-xs">
                      {r.latest!.score}/10
                      {r.delta ? (
                        <span className={r.delta > 0 ? 'text-success' : 'text-danger'}>
                          {' '}
                          {r.delta > 0 ? '▲' : '▼'}
                          {Math.abs(r.delta)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {r.latest!.gap && (
                    <p dir="auto" className="mt-0.5 line-clamp-1 text-xs text-fg-muted">
                      {r.latest!.gap}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
