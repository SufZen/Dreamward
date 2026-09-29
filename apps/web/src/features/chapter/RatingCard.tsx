import { useState } from 'react';
import { Gauge, Pencil } from 'lucide-react';
import { RATING_MAX, type Rating } from '@dreamward/shared';
import { Button, Card, Textarea } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { ScoreSlider } from '@/components/ScoreSlider';
import { useCreateRating, useRatingHistory } from './hooks';

/** Tiny dependency-free trend line of past scores. */
function Sparkline({ history }: { history: Rating[] }) {
  if (history.length < 2) return null;
  const W = 120;
  const H = 32;
  const pts = history.slice(-12).map((r, i, arr) => {
    const x = (W * i) / (arr.length - 1);
    const y = H - 3 - ((H - 6) * (r.score - 1)) / (RATING_MAX - 1);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-28" style={{ direction: 'ltr' }} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--rz-accent)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

/** "Where I am now": honest current reality vs. the vision, as a 1-10 score + the biggest gap. */
export function RatingCard({ categoryId }: { categoryId: string }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: history } = useRatingHistory(categoryId);
  const create = useCreateRating();
  const latest = history?.[history.length - 1] ?? null;
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(latest?.score ?? 5);
  const [reality, setReality] = useState('');
  const [gap, setGap] = useState('');

  const open = () => {
    setScore(latest?.score ?? 5);
    setReality(latest?.reality ?? '');
    setGap(latest?.gap ?? '');
    setEditing(true);
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Gauge size={18} /> {he ? 'איפה אני עכשיו' : 'Where I am now'}
        </h2>
        {!editing && (
          <Button variant={latest ? 'ghost' : 'primary'} size="sm" onClick={open}>
            <Pencil size={14} /> {latest ? (he ? 'דירוג מחדש' : 'Re-rate') : he ? 'דרג עכשיו' : 'Rate now'}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {he ? 'כמה קרובים החיים שלי היום לחזון בתחום הזה?' : 'How close is my life today to my vision in this area?'}
            </span>
            <ScoreSlider
              value={score}
              onChange={setScore}
              label={he ? 'ציון' : 'Score'}
              lowHint={he ? 'רחוק מאוד' : 'Far away'}
              highHint={he ? 'חי את החזון' : 'Living it'}
            />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{he ? 'מה באמת קורה היום? (בכנות, לא באידיאל)' : 'What is honestly true today?'}</span>
            <Textarea dir="auto" rows={2} value={reality} onChange={(e) => setReality(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {he ? 'מה הפער הכי משמעותי — ומה השינוי הקטן שהכי יזיז אותו?' : 'What’s the biggest gap — and the smallest change that would move it most?'}
            </span>
            <Textarea dir="auto" rows={2} value={gap} onChange={(e) => setGap(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button
              loading={create.isPending}
              onClick={() =>
                create.mutate(
                  { categoryId, score, reality: reality.trim() || null, gap: gap.trim() || null },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              {he ? 'שמירת דירוג' : 'Save rating'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {he ? 'ביטול' : 'Cancel'}
            </Button>
          </div>
        </div>
      ) : latest ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold text-primary">
              {latest.score}
              <span className="text-lg text-fg-faint">/10</span>
            </span>
            <Sparkline history={history ?? []} />
            <span className="ms-auto text-xs text-fg-faint">
              {new Date(latest.ratedAt).toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {latest.reality && (
            <p dir="auto" className="text-sm">
              <span className="text-fg-muted">{he ? 'היום: ' : 'Today: '}</span>
              {latest.reality}
            </p>
          )}
          {latest.gap && (
            <p dir="auto" className="text-sm">
              <span className="text-fg-muted">{he ? 'הפער: ' : 'The gap: '}</span>
              {latest.gap}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          {he
            ? 'דירוג כן של המצב היום מול החזון מראה איפה הפער — ולפעמים הוא קטן ממה שנדמה.'
            : 'An honest rating of today vs. the vision shows where the gap is — and sometimes it’s smaller than it seems.'}
        </p>
      )}
    </Card>
  );
}
