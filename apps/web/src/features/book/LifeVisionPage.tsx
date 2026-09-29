import { useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { Button, Card } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { sanitizeHtml } from '@/lib/sanitize';
import { useAutosave } from '@/lib/useAutosave';
import { SaveIndicator } from '@/components/SaveIndicator';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { useLifeVision, useUpdateLifeVision, type LifeVisionPrompt } from './hooks';

function AnswerEditor({ prompt }: { prompt: LifeVisionPrompt }) {
  const update = useUpdateLifeVision();
  const [html, setHtml] = useState<string>(prompt.answerRichtext ?? '');
  const status = useAutosave(html, async (value) =>
    update.mutateAsync({ id: prompt.id, answerRichtext: value || null }),
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 justify-end">
        <SaveIndicator status={status} />
      </div>
      <RichTextEditor value={html} onChange={setHtml} />
    </div>
  );
}

export function LifeVisionPage() {
  const { t, lang } = useLang();
  const { data, isLoading, isError } = useLifeVision();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <p className="text-fg-muted">{t('loading')}</p>;
  if (isError || !data) return <p className="text-danger">{t('empty')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">{t('lifeVision')}</h1>
      {data
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => {
          const editing = editingId === p.id;
          return (
            <Card key={p.id} className="p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 dir="auto" className="text-lg font-semibold text-primary">
                  {pickLabel(lang, p.labelEn ?? p.question, p.labelHe ?? p.question)}
                </h2>
                <Button
                  variant={editing ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditingId(editing ? null : p.id)}
                >
                  {editing ? <Check size={14} /> : <Pencil size={14} />}
                  {editing ? (lang === 'he' ? 'סיום' : 'Done') : lang === 'he' ? 'עריכה' : 'Edit'}
                </Button>
              </div>
              {editing ? (
                <AnswerEditor prompt={p} />
              ) : p.answerRichtext ? (
                <div
                  dir="auto"
                  className="dw-prose"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.answerRichtext) }}
                />
              ) : (
                <p className="text-sm text-fg-faint">{t('empty')}</p>
              )}
            </Card>
          );
        })}
    </div>
  );
}
