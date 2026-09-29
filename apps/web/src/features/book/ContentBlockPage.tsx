import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Check } from 'lucide-react';
import type { ListItem } from '@dreamward/shared';
import { Button, Card } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { sanitizeHtml } from '@/lib/sanitize';
import { useAutosave } from '@/lib/useAutosave';
import { SaveIndicator } from '@/components/SaveIndicator';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { EditableList } from '@/components/editor/EditableList';
import { useContentBlock, useUpdateContentBlock, type ContentBlock } from './hooks';

function BlockEditor({ block }: { block: ContentBlock }) {
  const update = useUpdateContentBlock(block.id);
  const [items, setItems] = useState<ListItem[]>(() => (block.content as { items?: ListItem[] })?.items ?? []);
  const [html, setHtml] = useState<string>(block.bodyRichtext ?? '');

  const status = useAutosave(JSON.stringify({ items, html }), async () =>
    block.kind === 'list' ? update.mutateAsync({ content: { items } }) : update.mutateAsync({ bodyRichtext: html }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 justify-end">
        <SaveIndicator status={status} />
      </div>
      {block.kind === 'list' ? (
        <EditableList items={items} onChange={setItems} />
      ) : (
        <RichTextEditor value={html} onChange={setHtml} />
      )}
    </div>
  );
}

function BlockReader({ block }: { block: ContentBlock }) {
  const { t } = useLang();
  const items = (block.content as { items?: ListItem[] })?.items ?? [];

  if (block.kind === 'list') {
    if (items.length === 0) return <p className="text-sm text-fg-faint">{t('empty')}</p>;
    return (
      <ul className="flex flex-col gap-2">
        {items
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((it) => (
            <li key={it.id} className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span dir="auto" className="leading-relaxed">
                {it.text}
              </span>
            </li>
          ))}
      </ul>
    );
  }
  if (!block.bodyRichtext) return <p className="text-sm text-fg-faint">{t('empty')}</p>;
  return <div dir="auto" className="dw-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.bodyRichtext) }} />;
}

export function ContentBlockPage() {
  const { blockId = 'cover' } = useParams();
  const { lang, t } = useLang();
  const { data, isLoading, isError } = useContentBlock(blockId);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <p className="text-fg-muted">{t('loading')}</p>;
  if (isError || !data) return <p className="text-danger">{t('empty')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 dir="auto" className="text-4xl font-bold">
          {pickLabel(lang, data.labelEn, data.labelHe)}
        </h1>
        <Button variant={editing ? 'primary' : 'ghost'} size="sm" onClick={() => setEditing(!editing)}>
          {editing ? <Check size={14} /> : <Pencil size={14} />}
          {editing ? (lang === 'he' ? 'סיום' : 'Done') : lang === 'he' ? 'עריכה' : 'Edit'}
        </Button>
      </div>
      <Card className="p-6">{editing ? <BlockEditor block={data} /> : <BlockReader block={data} />}</Card>
    </div>
  );
}
