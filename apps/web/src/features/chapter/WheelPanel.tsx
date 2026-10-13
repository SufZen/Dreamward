import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import { CATEGORIES } from '@dreamward/shared';
import { Button, Card, toast } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { Icon } from '@/components/Icon';
import { ScoreSlider } from '@/components/ScoreSlider';
import { useAreaLabel } from '@/features/book/hooks';
import { LifeWheel } from './LifeWheel';
import { useCreateRating, useCurrentChapter, useLatestRatings } from './hooks';

/**
 * The life wheel and its review in one place. "Rate all areas" lays the
 * twelve scales out together, so a check-in takes a minute instead of
 * twelve page visits; only changed areas are saved, and the wheel springs to
 * its new shape.
 */
export function WheelPanel() {
  const { lang } = useLang();
  const he = lang === 'he';
  const areaLabel = useAreaLabel();
  const { data: ratings } = useLatestRatings();
  const { data: chapter } = useCurrentChapter();
  const create = useCreateRating();
  const [rating, setRating] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const focus = chapter?.focusCategoryIds ?? [];
  const current = new Map((ratings ?? []).map((r) => [r.categoryId, r.latest?.score ?? 0]));
  const rated = (ratings ?? []).filter((r) => r.latest);
  const changed = Object.entries(draft).filter(([id, v]) => v !== (current.get(id) ?? 0));

  const start = () => {
    setDraft(Object.fromEntries(CATEGORIES.map((c) => [c.id, current.get(c.id) ?? 0])));
    setRating(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const [categoryId, score] of changed) {
        if (score > 0) await create.mutateAsync({ categoryId, score });
      }
      toast(
        he ? `נשמרו ${changed.length} דירוגים` : `Saved ${changed.length} rating${changed.length === 1 ? '' : 's'}`,
        {
          tone: 'success',
        },
      );
      setRating(false);
    } catch {
      toast(he ? 'חלק מהדירוגים לא נשמרו — נסה שוב' : 'Some ratings didn’t save — try again', { tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Gauge size={18} className="text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{he ? 'גלגל החיים' : 'Life wheel'}</h2>
          <p className="text-sm text-fg-muted">
            {he ? 'כמה קרוב היום לחזון, בכל תחום (1-10).' : 'How close today is to your vision, in each area (1–10).'}
          </p>
        </div>
        {!rating && (
          <Button variant={rated.length ? 'secondary' : 'primary'} size="sm" onClick={start}>
            {rated.length ? (he ? 'דירוג כל התחומים' : 'Rate all areas') : he ? 'לדרג עכשיו' : 'Rate now'}
          </Button>
        )}
      </div>

      <div className={rating ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]' : ''}>
        {(rated.length > 0 || rating) && (
          <div className={rating ? 'lg:sticky lg:top-4' : ''}>
          <LifeWheel
            ratings={
              rating
                ? CATEGORIES.map((c) => {
                    const v = draft[c.id] ?? 0;
                    const prev = (ratings ?? []).find((r) => r.categoryId === c.id);
                    return {
                      categoryId: c.id,
                      latest: v
                        ? {
                            id: c.id,
                            categoryId: c.id,
                            score: v,
                            reality: null,
                            gap: null,
                            ratedAt: Date.now(),
                          }
                        : null,
                      previousScore: prev?.latest?.score ?? null,
                      delta: null,
                    };
                  })
                : (ratings ?? [])
            }
            focus={focus}
          />
          </div>
        )}

        {rating && (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {CATEGORIES.map((c) => (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name={c.icon} size={15} className="text-fg-subtle" />
                    <span className="flex-1">{areaLabel(c.id)}</span>
                    {focus.includes(c.id) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                    )}
                    <span className="tabular w-10 text-end text-fg-subtle">
                      {draft[c.id] ? `${draft[c.id]}/10` : '–'}
                    </span>
                  </div>
                  <ScoreSlider
                    compact
                    value={draft[c.id] ?? 0}
                    onChange={(v) => setDraft((d) => ({ ...d, [c.id]: v }))}
                    label={areaLabel(c.id)}
                  />
                </li>
              ))}
            </ul>
            <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card pt-3">
              <Button onClick={save} loading={saving} disabled={changed.length === 0}>
                {changed.length
                  ? he
                    ? `שמירת ${changed.length} דירוגים`
                    : `Save ${changed.length} rating${changed.length === 1 ? '' : 's'}`
                  : he
                    ? 'אין שינויים'
                    : 'No changes'}
              </Button>
              <Button variant="ghost" onClick={() => setRating(false)}>
                {he ? 'ביטול' : 'Cancel'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {!rating && rated.length === 0 && (
        <p className="text-sm text-fg-muted">
          {he
            ? 'עוד לא דירגת. דקה אחת, שנים-עשר תחומים — ותראה איפה הפער הגדול.'
            : 'Not rated yet. One minute, twelve areas — and you’ll see where the biggest gap is.'}
        </p>
      )}
      {!rating && rated.length > 0 && (
        <p className="text-xs text-fg-subtle">
          {he
            ? 'הקו המקווקו הוא הדירוג הקודם. לחיצה על תחום פותחת את העמוד שלו, או '
            : 'The dashed line is your previous rating. Click an area to open its page, or '}
          <Link to="/book" className="underline underline-offset-2 hover:text-foreground">
            {he ? 'לכל התחומים בספר' : 'see all areas in your book'}
          </Link>
          .
        </p>
      )}
    </Card>
  );
}
