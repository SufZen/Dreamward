import { useState } from 'react';
import { Compass, Flag, Archive, Sparkles } from 'lucide-react';
import { CATEGORIES, MAX_FOCUS_AREAS, type Chapter, type ListItem } from '@dreamward/shared';
import { Badge, Button, Card, Input, Textarea, cn } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { useAreaLabel } from '@/features/book/hooks';
import { useAutosave } from '@/lib/useAutosave';
import { SaveIndicator } from '@/components/SaveIndicator';
import { EditableList } from '@/components/editor/EditableList';
import { Icon } from '@/components/Icon';
import { OnboardingMotion } from '@/components/OnboardingMotion';
import { useChapters, useCloseChapter, useCreateChapter, useCurrentChapter, useUpdateChapter } from './hooks';

const toDateInput = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');
const fromDateInput = (v: string) => (v ? Date.parse(v) : null);
const fmt = (ms: number | null, he: boolean) =>
  ms ? new Date(ms).toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function ChapterPage() {
  const { lang, t } = useLang();
  const he = lang === 'he';
  const { data: chapter, isLoading } = useCurrentChapter();
  const { data: all } = useChapters();
  const past = (all ?? []).filter((c) => c.status === 'closed');

  if (isLoading) return <p className="text-fg-muted">{t('loading')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[color:var(--rz-accent-soft)] text-primary">
          <Compass size={28} />
        </div>
        <div>
          <h1 className="text-4xl font-bold">{he ? 'הפרק הנוכחי' : 'Current Chapter'}</h1>
          <p className="mt-1 text-fg-muted">
            {he
              ? 'לא כל התחומים חשובים באותה מידה בכל תקופה. מה התקופה הזו נועדה ליצור?'
              : 'Not every area matters equally in every season. What is this season meant to create?'}
          </p>
        </div>
      </header>

      {chapter ? <ChapterEditor key={chapter.id} chapter={chapter} /> : <StartChapter />}

      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-fg-faint">
            <Archive size={14} /> {he ? 'פרקים קודמים' : 'Past chapters'}
          </h2>
          {past.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span dir="auto" className="font-medium">
                  {c.title}
                </span>
                <span className="text-xs text-fg-muted">
                  {fmt(c.startDate, he)} – {fmt(c.closedAt, he)}
                </span>
              </div>
              {c.closingReflection && (
                <p dir="auto" className="mt-2 text-sm text-fg-muted">
                  {c.closingReflection}
                </p>
              )}
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

function StartChapter({ onDone }: { onDone?: () => void }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const create = useCreateChapter();
  const [title, setTitle] = useState('');

  return (
    <Card featured className="grid items-center gap-6 p-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles size={18} />
          <h2 className="text-xl font-semibold">{he ? 'תן שם לתקופה הזו' : 'Name this season of your life'}</h2>
        </div>
        <p className="text-sm text-fg-muted">
          {he
            ? 'למשל: "בונה בסיס חדש", "שנת הבריאות", "פרק ההתחלה מחדש". אחרי זה תבחר 1-5 תחומי מיקוד.'
            : 'For example: "Building a new base", "The health year", "Starting over". Next you’ll pick 1–5 focus areas.'}
        </p>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate({ title: title.trim() }, { onSuccess: () => onDone?.() });
          }}
        >
          <Input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={he ? 'שם הפרק' : 'Chapter name'} />
          <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
            <Flag size={15} /> {he ? 'התחל פרק' : 'Start chapter'}
          </Button>
        </form>
      </div>
      <OnboardingMotion name="chapter" className="order-first md:order-none" />
    </Card>
  );
}

type Role = 'focus' | 'maintenance' | null;

function ChapterEditor({ chapter }: { chapter: Chapter }) {
  const { lang } = useLang();
  const areaLabel = useAreaLabel();
  const he = lang === 'he';
  const update = useUpdateChapter(chapter.id);
  const close = useCloseChapter();

  const [title, setTitle] = useState(chapter.title);
  const [intention, setIntention] = useState(chapter.intention ?? '');
  const [focus, setFocus] = useState<string[]>(chapter.focusCategoryIds);
  const [maintenance, setMaintenance] = useState<string[]>(chapter.maintenanceCategoryIds);
  const [notNow, setNotNow] = useState<ListItem[]>(chapter.notNow);
  const [noLonger, setNoLonger] = useState<ListItem[]>(chapter.noLongerAcceptable);
  const [reviewDate, setReviewDate] = useState(toDateInput(chapter.reviewDate));
  const [closing, setClosing] = useState(false);
  const [reflection, setReflection] = useState('');

  const draft = { title, intention, focus, maintenance, notNow, noLonger, reviewDate };
  const status = useAutosave(JSON.stringify(draft), () =>
    update.mutateAsync({
      title: title.trim() || chapter.title,
      intention: intention || null,
      focusCategoryIds: focus,
      maintenanceCategoryIds: maintenance,
      notNow: notNow.filter((i) => i.text.trim()),
      noLongerAcceptable: noLonger.filter((i) => i.text.trim()),
      reviewDate: fromDateInput(reviewDate),
    }),
  );

  const roleOf = (id: string): Role => (focus.includes(id) ? 'focus' : maintenance.includes(id) ? 'maintenance' : null);
  /** Click cycles: none → focus (if room) → maintenance → none. */
  const cycle = (id: string) => {
    const role = roleOf(id);
    if (role === null) {
      if (focus.length < MAX_FOCUS_AREAS) setFocus([...focus, id]);
      else setMaintenance([...maintenance, id]);
    } else if (role === 'focus') {
      setFocus(focus.filter((x) => x !== id));
      setMaintenance([...maintenance, id]);
    } else {
      setMaintenance(maintenance.filter((x) => x !== id));
    }
  };

  return (
    <>
      <Card featured className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="accent">{he ? 'פעיל' : 'Active'}</Badge>
          <SaveIndicator status={status} />
        </div>
        <Input
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12 text-2xl font-semibold"
          aria-label={he ? 'שם הפרק' : 'Chapter name'}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg-muted">
            {he ? 'מה הפרק הזה נועד ליצור?' : 'What is this chapter meant to create?'}
          </span>
          <Textarea dir="auto" value={intention} onChange={(e) => setIntention(e.target.value)} rows={3} />
        </label>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg-muted">
          <span>
            {he ? 'התחיל ב-' : 'Started '}
            {fmt(chapter.startDate, he)}
          </span>
          <label className="flex items-center gap-2">
            {he ? 'תאריך סקירה:' : 'Review on:'}
            <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="h-8 w-auto" />
          </label>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="text-xl font-semibold text-primary">{he ? 'לאן הולכת האנרגיה' : 'Where the energy goes'}</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {he
              ? `לחיצה מחליפה: מיקוד (עד ${MAX_FOCUS_AREAS}) → תחזוקה בלבד → רגיל.`
              : `Tap to cycle: focus (up to ${MAX_FOCUS_AREAS}) → maintenance only → normal.`}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const role = roleOf(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => cycle(c.id)}
                aria-pressed={role !== null}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-start transition-colors',
                  role === 'focus' && 'border-[color:var(--rz-border-accent)] bg-[color:var(--rz-accent-soft)]',
                  role === 'maintenance' && 'border-border bg-surface opacity-70',
                  role === null && 'border-border hover:bg-surface-hover',
                )}
              >
                <Icon name={c.icon} size={18} className={role === 'focus' ? 'text-primary' : 'text-fg-muted'} />
                <span className="flex-1 truncate text-sm">{areaLabel(c.id)}</span>
                {role === 'focus' && <Badge variant="accent">{he ? 'מיקוד' : 'Focus'}</Badge>}
                {role === 'maintenance' && <Badge>{he ? 'תחזוקה' : 'Maintain'}</Badge>}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-fg-faint">
          {he ? `${focus.length}/${MAX_FOCUS_AREAS} תחומי מיקוד` : `${focus.length}/${MAX_FOCUS_AREAS} focus areas`}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-6">
          <div>
            <h2 className="text-xl font-semibold text-primary">{he ? 'לא עכשיו' : 'Not now'}</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {he ? 'דברים טובים שבכוונה לא נכנסים לפרק הזה.' : 'Good things that deliberately don’t get priority this chapter.'}
            </p>
          </div>
          <EditableList items={notNow} onChange={setNotNow} />
        </Card>
        <Card className="flex flex-col gap-3 p-6">
          <div>
            <h2 className="text-xl font-semibold text-primary">{he ? 'כבר לא מקובל עליי' : 'No longer acceptable'}</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {he
                ? 'מצבים, פשרות והתנהגויות שאני מפסיק לנרמל — מסנן להחלטות.'
                : 'Situations, compromises and behaviours I stop normalising — my decision filter.'}
            </p>
          </div>
          <EditableList items={noLonger} onChange={setNoLonger} />
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-6">
        {!closing ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">
              {he
                ? 'התקופה הסתיימה או השתנתה? סגור את הפרק עם רפלקציה קצרה ופתח חדש.'
                : 'Has this season ended or shifted? Close the chapter with a short reflection and open a new one.'}
            </p>
            <Button variant="secondary" onClick={() => setClosing(true)}>
              {he ? 'סגירת הפרק' : 'Close chapter'}
            </Button>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {he ? 'מה הפרק הזה לימד אותך? מה אתה לוקח איתך?' : 'What did this chapter teach you? What do you take with you?'}
              </span>
              <Textarea dir="auto" value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} />
            </label>
            <div className="flex gap-2">
              <Button
                loading={close.isPending}
                onClick={() => close.mutate({ id: chapter.id, closingReflection: reflection.trim() || null })}
              >
                {he ? 'סגור את הפרק' : 'Close the chapter'}
              </Button>
              <Button variant="ghost" onClick={() => setClosing(false)}>
                {he ? 'ביטול' : 'Cancel'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
