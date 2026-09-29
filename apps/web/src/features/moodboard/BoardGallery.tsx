import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Images } from 'lucide-react';
import { Button, Card, Input } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useBoards, useCreateBoard } from './hooks';

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
      <h1 className="text-4xl font-bold">{t('moodboard')}</h1>

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
        <p className="text-fg-muted">{t('loading')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards?.map((b) => (
            <Link key={b.id} to={`/moodboard/${b.id}`}>
              <Card interactive className="overflow-hidden p-0">
                <div className="flex aspect-video items-center justify-center bg-bg-elevated">
                  {b.cover ? (
                    <img src={`/media/${b.cover}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <Images size={32} className="text-fg-faint" />
                  )}
                </div>
                <div className="p-4">
                  <p dir="auto" className="truncate font-medium">
                    {b.title}
                  </p>
                  {b.visionStatement && (
                    <p dir="auto" className="mt-1 line-clamp-2 text-xs text-fg-muted">
                      {b.visionStatement}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
