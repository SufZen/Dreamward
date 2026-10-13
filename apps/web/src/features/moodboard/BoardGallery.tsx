import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Images, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, Card, Input, PageHeader, EmptyState, PageLoader, toast } from '@dreamward/design-system';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUndoableDelete } from '@/lib/useUndoableDelete';
import { useLang } from '@/lib/lang';
import { useBoards, useCreateBoard, type Board } from './hooks';

export function BoardGallery() {
  const { t, lang } = useLang();
  const { data: boards, isLoading } = useBoards();
  const create = useCreateBoard();
  const [title, setTitle] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync(title.trim());
    setTitle('');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('moodboard')}
        description={lang === 'he' ? 'תמונות ומילים שמזכירות לך לאן אתה הולך.' : 'Images and words that remind you where you’re going.'}
        actions={
          <Link to="/gallery" className="text-sm text-fg-muted hover:text-foreground">
            {lang === 'he' ? 'ספריית התמונות' : 'Image library'}
          </Link>
        }
      />

      <Card className="p-5">
        <form onSubmit={add} className="flex gap-3">
          <Input
            dir="auto"
            placeholder={lang === 'he' ? 'שם ללוח חדש…' : 'New board name…'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!title.trim() || create.isPending}>
            <Plus size={15} /> {lang === 'he' ? 'צור לוח' : 'Create board'}
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <PageLoader label={t('loading')} />
      ) : !boards?.length ? (
        <Card className="p-0">
          <EmptyState
            title={lang === 'he' ? 'עוד אין לוחות חזון' : 'No vision boards yet'}
            hint={
              lang === 'he'
                ? 'תן ללוח שם למעלה — למשל "הבית שלנו" או "השנה הזו" — ומלא אותו בתמונות ובמילים.'
                : 'Name a board above — say "Our home" or "This year" — then fill it with images and words.'
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards?.map((b) => (
            <BoardCard key={b.id} board={b} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A board in the gallery: open it, rename it in place, or delete it (with Undo). */
function BoardCard({ board: b }: { board: Board }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const qc = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(b.title);
  const rename = useMutation({
    mutationFn: (t: string) => api.put(`/moodboards/${b.id}`, { title: t }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] });
      toast(he ? 'שם הלוח עודכן' : 'Board renamed', { tone: 'success' });
    },
  });
  const del = useUndoableDelete<Board>({ queryKey: ['boards'], remove: (id) => api.del(`/moodboards/${id}`) });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (t && t !== b.title) rename.mutate(t);
    setRenaming(false);
  };

  return (
    <Card interactive className="group relative overflow-hidden p-0">
      <Link to={`/moodboard/${b.id}`} className="block" aria-label={b.title}>
        <div className="flex aspect-video items-center justify-center bg-bg-elevated">
          {b.cover ? (
            <img src={`/media/${b.cover}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <Images size={32} className="text-fg-faint" />
          )}
        </div>
      </Link>
      <div className="flex items-start gap-2 p-4">
        {renaming ? (
          <form onSubmit={save} className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
              aria-label={he ? 'שם הלוח' : 'Board name'}
              className="h-8 flex-1"
            />
            <Button type="submit" variant="ghost" size="icon" aria-label={he ? 'שמירה' : 'Save'}>
              <Check size={15} />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setRenaming(false)} aria-label={he ? 'ביטול' : 'Cancel'}>
              <X size={15} />
            </Button>
          </form>
        ) : (
          <>
            <Link to={`/moodboard/${b.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">
                <bdi>{b.title}</bdi>
              </p>
              {b.visionStatement && (
                <p dir="auto" className="mt-1 line-clamp-2 text-xs text-fg-muted">
                  {b.visionStatement}
                </p>
              )}
            </Link>
            <div className="flex flex-none gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <Button variant="ghost" size="icon" onClick={() => { setTitle(b.title); setRenaming(true); }} aria-label={he ? 'שינוי שם' : 'Rename'}>
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => del(b, b.title)} aria-label={he ? 'מחיקת הלוח' : 'Delete board'}>
                <Trash2 size={14} />
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
