import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button, Card, Input, PageHeader, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useAutosave } from '@/lib/useAutosave';
import { api } from '@/lib/api';
import { useUndoableDelete } from '@/lib/useUndoableDelete';
import { SaveIndicator } from '@/components/SaveIndicator';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { useJournal, useJournalEntry, useCreateJournal, useUpdateJournal, type JournalEntry } from './hooks';

function fmtDate(ms: number, lang: string) {
  return new Date(ms).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function EntryEditor({ entry }: { entry: JournalEntry }) {
  const { lang } = useLang();
  const update = useUpdateJournal();
  const [title, setTitle] = useState(entry.title ?? '');
  const [html, setHtml] = useState(entry.bodyRichtext);

  const status = useAutosave(JSON.stringify({ title, html }), async () =>
    update.mutateAsync({
      id: entry.id,
      title: title || null,
      bodyRichtext: html,
    }),
  );

  // An entry left completely empty is removed when you move on, so abandoned
  // drafts don't pile up as "(untitled)".
  const qc = useQueryClient();
  const latest = useRef({ title, html });
  latest.current = { title, html };
  // Deferred, so a remount (React StrictMode in dev) cancels it.
  const pendingDelete = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (pendingDelete.current) clearTimeout(pendingDelete.current);
    return () => {
      const { title: t, html: h } = latest.current;
      if (t.trim() || h.replace(/<[^>]*>/g, '').trim()) return;
      pendingDelete.current = setTimeout(() => {
        void api.del(`/journal/${entry.id}`).then(() => qc.invalidateQueries({ queryKey: ['journal'] }));
      }, 300);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-fg-subtle">{fmtDate(entry.entryDate, lang)}</span>
        <SaveIndicator status={status} />
      </div>
      <Input
        dir="auto"
        placeholder={lang === 'he' ? 'כותרת…' : 'Title…'}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-lg font-semibold"
      />
      <RichTextEditor value={html} onChange={setHtml} />
    </div>
  );
}

export function JournalPage() {
  const { t, lang } = useLang();
  const { entryId } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data: entries, isLoading } = useJournal(q);
  const { data: entry } = useJournalEntry(entryId);
  const create = useCreateJournal();
  const del = useUndoableDelete<JournalEntry>({
    queryKey: ['journal'],
    remove: (id) => api.del(`/journal/${id}`),
  });

  const newEntry = async () => {
    const created = await create.mutateAsync();
    navigate(`/journal/${created.id}`, { replace: true });
  };

  // ?new=1 (from ⌘K or Today) starts a fresh entry; plain /journal opens today's page if you wrote one.
  const [params] = useSearchParams();
  const started = useRef(false);
  useEffect(() => {
    if (entryId || started.current) return;
    if (params.get('new') === '1') {
      started.current = true;
      void newEntry();
      return;
    }
    const today = new Date().setHours(0, 0, 0, 0);
    const todays = !q && entries?.find((e) => e.entryDate >= today);
    if (todays) {
      started.current = true;
      navigate(`/journal/${todays.id}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, params, entries]);

  const remove = (e: JournalEntry) => {
    del(e, e.title || (lang === 'he' ? '(ללא כותרת)' : '(untitled)'));
    if (entryId === e.id) navigate('/journal');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('journal')}
        description={
          lang === 'he'
            ? 'מקום לחשוב בקול. שורה אחת ביום מספיקה.'
            : 'A place to think out loud. One line a day is enough.'
        }
        actions={
          <Button onClick={newEntry} loading={create.isPending}>
            <Plus size={15} /> {lang === 'he' ? 'רשומה חדשה' : 'New entry'}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={15} className="absolute top-1/2 ms-3 -translate-y-1/2 text-fg-faint ltr:left-0 rtl:right-0" />
            <Input
              dir="auto"
              placeholder={lang === 'he' ? 'חיפוש…' : 'Search…'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="ps-9"
            />
          </div>
          <Card className="max-h-[60vh] overflow-y-auto p-2">
            {isLoading ? (
              <p className="p-3 text-sm text-fg-muted">{t('loading')}</p>
            ) : entries?.length ? (
              entries.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors',
                    entryId === e.id ? 'bg-surface' : 'hover:bg-surface',
                  )}
                  onClick={() => navigate(`/journal/${e.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-sm font-medium">
                      {e.title || (lang === 'he' ? '(ללא כותרת)' : '(untitled)')}
                    </p>
                    <p className="text-xs text-fg-subtle">{fmtDate(e.entryDate, lang)}</p>
                  </div>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      remove(e);
                    }}
                    className="rounded-xs p-1 text-fg-faint opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={lang === 'he' ? 'מחיקת הרשומה' : 'Delete entry'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            ) : (
              <p className="p-3 text-sm text-fg-faint">{t('empty')}</p>
            )}
          </Card>
        </div>

        <Card className="p-6">
          {entry ? (
            <EntryEditor key={entry.id} entry={entry} />
          ) : (
            <TodayPrompt onStart={newEntry} starting={create.isPending} />
          )}
        </Card>
      </div>
    </div>
  );
}

const PROMPTS = {
  he: [
    'מה היה הרגע הטוב של היום?',
    'מה למדתי על עצמי השבוע?',
    'על מה אני מכיר תודה עכשיו?',
    'איזה צעד קטן קירב אותי לחזון?',
  ],
  en: [
    'What was the best moment of today?',
    'What did I learn about myself this week?',
    'What am I grateful for right now?',
    'Which small step moved me toward the vision?',
  ],
};

/** No entry open: today's blank page, with a few questions to start from. */
function TodayPrompt({ onStart, starting }: { onStart: () => void; starting: boolean }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const date = new Date().toLocaleDateString(he ? 'he-IL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <div className="flex flex-col gap-4 py-4">
      <p className="text-sm text-fg-subtle">{date}</p>
      <h2 className="text-2xl font-semibold">{he ? 'העמוד של היום עוד ריק' : 'Today’s page is still blank'}</h2>
      <p className="text-fg-muted">{he ? 'אפשר להתחיל משאלה:' : 'You could start from a question:'}</p>
      <ul className="flex flex-col gap-2">
        {PROMPTS[lang].map((p) => (
          <li key={p} className="flex items-center gap-2 text-fg-muted">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden="true" />
            {p}
          </li>
        ))}
      </ul>
      <Button className="mt-2 self-start" onClick={onStart} loading={starting}>
        <Plus size={15} /> {he ? 'להתחיל לכתוב' : 'Start writing'}
      </Button>
    </div>
  );
}
