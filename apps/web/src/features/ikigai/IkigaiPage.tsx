import { useState } from 'react';
import { History, RefreshCw, Sparkles, Sun } from 'lucide-react';
import { IKIGAI_CIRCLES, type IkigaiProfile } from '@dreamward/shared';
import { Badge, Button, Card } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { IkigaiWizard } from './IkigaiWizard';
import { VennInsights } from './steps';
import { useIkigai, useStartIkigaiDraft, type IkigaiState } from './hooks';

const fmt = (ms: number | null, he: boolean) =>
  ms ? new Date(ms).toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function IkigaiPage() {
  const { lang, t } = useLang();
  const he = lang === 'he';
  const { data, isLoading, isError } = useIkigai();

  if (isLoading) return <p className="text-fg-muted">{t('loading')}</p>;
  if (isError || !data) return <p className="text-danger">{he ? 'שגיאה בטעינה' : 'Failed to load'}</p>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[color:var(--rz-accent-soft)] text-2xl text-primary">
          生
        </div>
        <div>
          <h1 className="text-4xl font-bold">{he ? 'איקיגאי' : 'IKIGAI'}</h1>
          <p className="mt-1 text-fg-muted">
            {he ? 'איפה מה שאתה אוהב, טוב בו, העולם צריך ומשלמים עליו — נפגשים.' : 'Where what you love, are good at, the world needs and can be paid for meet.'}
          </p>
        </div>
      </header>

      {data.draft ? (
        <IkigaiWizard key={data.draft.id} draft={data.draft} isRevisit={Boolean(data.current)} />
      ) : data.current ? (
        <CurrentIkigai profile={data.current} history={data.history} />
      ) : (
        <Landing />
      )}
    </div>
  );
}

function Landing() {
  const { lang } = useLang();
  const he = lang === 'he';
  const start = useStartIkigaiDraft();
  return (
    <Card featured className="flex flex-col items-center gap-5 p-8 text-center">
      <div className="relative h-28 w-28" aria-hidden>
        {IKIGAI_CIRCLES.map((c, i) => (
          <span
            key={c.id}
            className="absolute h-16 w-16 rounded-full opacity-60 mix-blend-screen"
            style={{
              background: c.color,
              top: ['0%', '22%', '22%', '44%'][i],
              left: ['21%', '0%', '42%', '21%'][i],
            }}
          />
        ))}
      </div>
      <h2 className="text-2xl font-semibold">{he ? 'גלה את האיקיגאי שלך' : 'Discover your IKIGAI'}</h2>
      <p className="max-w-xl text-fg-muted">
        {he
          ? 'תהליך מודרך של כ-15 דקות: ארבעה מעגלים, מפה של החפיפות, והמשפט שמתאר את הסיבה שלך לקום בבוקר — כרגע. ואפשר לקבל מ-Clarity רעיונות מתוך ספר החיים שלך.'
          : 'A guided ~15-minute process: four circles, a map of their overlaps, and the sentence that captures your reason to get up in the morning — for now. Clarity can help with ideas drawn from your book.'}
      </p>
      <Button size="lg" onClick={() => start.mutate(false)} loading={start.isPending}>
        <Sparkles size={16} /> {he ? 'בוא נתחיל' : 'Let’s begin'}
      </Button>
    </Card>
  );
}

function CurrentIkigai({ profile, history }: { profile: IkigaiProfile; history: IkigaiState['history'] }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const start = useStartIkigaiDraft();
  const [showHistory, setShowHistory] = useState(false);
  const archived = history.filter((h) => h.status === 'archived');

  return (
    <>
      <Card featured className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-fg-faint">
            {he ? 'האיקיגאי שלי · מאז ' : 'My IKIGAI · since '}
            {fmt(profile.completedAt, he)}
          </span>
          {profile.confidence && (
            <Badge variant="accent">
              {he ? 'ביטחון' : 'Confidence'} {profile.confidence}/10
            </Badge>
          )}
        </div>
        <blockquote dir="auto" className="fx-gradient-text text-2xl font-semibold leading-snug sm:text-3xl">
          {profile.statement}
        </blockquote>
        {profile.reflections.why && (
          <p dir="auto" className="text-sm text-fg-muted">
            {profile.reflections.why}
          </p>
        )}
        <div>
          <Button variant="secondary" size="sm" onClick={() => start.mutate(true)} loading={start.isPending}>
            <RefreshCw size={14} /> {he ? 'לחזור ולעדכן' : 'Revisit my IKIGAI'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <VennInsights items={profile.items} />
      </Card>

      {profile.everyday.length > 0 && (
        <Card className="flex flex-col gap-3 p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
            <Sun size={18} /> {he ? 'האיקיגאי היומיומי' : 'Everyday ikigai'}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.everyday.map((e) => (
              <li key={e.id} dir="auto" className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
                {e.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="flex items-center gap-2 self-start text-sm font-mono uppercase tracking-wider text-fg-faint hover:text-fg-muted"
          >
            <History size={14} /> {he ? `גרסאות קודמות (${archived.length})` : `Earlier versions (${archived.length})`}
          </button>
          {showHistory &&
            archived.map((h) => (
              <Card key={h.id} className="p-4">
                <div className="text-xs text-fg-faint">{fmt(h.completedAt, he)}</div>
                <p dir="auto" className="mt-1 text-sm">
                  {h.statement}
                </p>
              </Card>
            ))}
        </section>
      )}
    </>
  );
}

/** Dashboard card: the current statement, or an invitation to discover it. */
export function IkigaiCard() {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data } = useIkigai();
  if (!data) return null;
  const cur = data.current;
  return (
    <Card interactive className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-fg-muted">
        <span className="text-primary">生</span>
        <span className="text-sm font-medium text-foreground">{he ? 'איקיגאי' : 'IKIGAI'}</span>
        {data.draft && <Badge>{he ? 'בתהליך' : 'In progress'}</Badge>}
      </div>
      {cur?.statement ? (
        <p dir="auto" className="line-clamp-3 text-sm">
          {cur.statement}
        </p>
      ) : (
        <p className="text-sm text-fg-muted">
          {data.draft
            ? he
              ? 'המשך מאיפה שעצרת ←'
              : 'Pick up where you left off →'
            : he
              ? 'גלה את הסיבה שלך לקום בבוקר ←'
              : 'Discover your reason to get up in the morning →'}
        </p>
      )}
      {cur && (
        <div className="mt-auto flex flex-wrap gap-1">
          {IKIGAI_CIRCLES.map((c) => (
            <span key={c.id} className="h-1.5 flex-1 rounded-full" style={{ background: c.color, opacity: 0.7 }} title={pickLabel(lang, c.labelEn, c.labelHe)} />
          ))}
        </div>
      )}
    </Card>
  );
}
