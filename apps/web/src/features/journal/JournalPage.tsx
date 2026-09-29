import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button, Card, Input, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useAutosave } from '@/lib/useAutosave';
import { SaveIndicator } from '@/components/SaveIndicator';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import {
  useJournal,
  useJournalEntry,
  useCreateJournal,
  useUpdateJournal,
  useDeleteJournal,
  type JournalEntry,
} from './hooks';

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
    update.mutateAsync({ id: entry.id, title: title || null, bodyRichtext: html }),
  );

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
  const del = useDeleteJournal();

  const newEntry = async () => {
    const created = await create.mutateAsync();
    navigate(`/journal/${created.id}`);
  };

  const remove = async (id: string) => {
    await del.mutateAsync(id);
    if (entryId === id) navigate('/journal');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-bold">{t('journal')}</h1>
        <Button onClick={newEntry} disabled={create.isPending}>
          <Plus size={15} /> {lang === 'he' ? 'רשומה חדשה' : 'New entry'}
        </Button>
      </div>

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
                      void remove(e.id);
                    }}
                    className="hidden text-fg-faint hover:text-danger group-hover:block"
                    aria-label="delete entry"
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
            <p className="text-sm text-fg-faint">
              {lang === 'he' ? 'בחר רשומה או צור חדשה' : 'Select an entry or create a new one'}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
