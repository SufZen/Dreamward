import { useRef, useState } from 'react';
import { Upload, Trash2, CheckCircle2, Circle, X } from 'lucide-react';
import { Button, Card, Badge, Skeleton, EmptyState } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { ApiError } from '@/lib/api';
import { useAssets, useUploadAsset, useDeleteAsset, type Asset, type AssetInUse } from '@/features/moodboard/hooks';

function fmtBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function GalleryPage() {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: assets, isLoading } = useAssets();
  const upload = useUploadAsset();
  const del = useDeleteAsset();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; boards: { title: string }[] } | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const onUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) await upload.mutateAsync(f).catch(() => {});
    if (fileRef.current) fileRef.current.value = '';
  };

  // Delete one or many; collect 409 board info into a single confirm dialog.
  const runDelete = async (ids: string[], force = false) => {
    const blocking: { title: string }[] = [];
    for (const id of ids) {
      try {
        await del.mutateAsync({ id, force });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          const body = e.body as AssetInUse | undefined;
          for (const b of body?.boards ?? []) blocking.push(b);
        }
      }
    }
    if (blocking.length && !force) {
      setConfirm({ ids, boards: blocking });
    } else {
      setConfirm(null);
      setSelected(new Set());
    }
  };

  const total = assets?.reduce((n, a) => n + a.bytes, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="fx-gradient-text text-3xl font-bold">{he ? 'גלריה' : 'Gallery'}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {assets?.length
              ? he
                ? `${assets.length} תמונות · ${fmtBytes(total)} בשימוש`
                : `${assets.length} images · ${fmtBytes(total)} used`
              : he
                ? 'התמונות שלך, במקום אחד'
                : 'Your images, in one place'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="danger" size="sm" loading={del.isPending} onClick={() => runDelete([...selected])}>
              <Trash2 size={14} /> {he ? `מחק (${selected.size})` : `Delete (${selected.size})`}
            </Button>
          )}
          <Button size="sm" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> {he ? 'העלאה' : 'Upload'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => onUpload(e.target.files)}
          />
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : !assets?.length ? (
        <Card className="p-2">
          <EmptyState
            title={he ? 'הגלריה ריקה' : 'Your gallery is empty'}
            hint={he ? 'העלה תמונות כדי להשתמש בהן בלוחות החזון ובתוכן שלך.' : 'Upload images to use them in moodboards and your content.'}
            action={
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> {he ? 'העלאת תמונה' : 'Upload an image'}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <GalleryTile key={a.id} asset={a} selected={selected.has(a.id)} onToggle={() => toggle(a.id)} onDelete={() => runDelete([a.id])} he={he} />
          ))}
        </div>
      )}

      {confirm && (
        <ForceDeleteDialog
          boards={confirm.boards}
          he={he}
          pending={del.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => runDelete(confirm.ids, true)}
        />
      )}
    </div>
  );
}

function GalleryTile({
  asset,
  selected,
  onToggle,
  onDelete,
  he,
}: {
  asset: Asset;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  he: boolean;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-lg border ${selected ? 'border-primary' : 'border-border'}`}>
      <img
        src={`/media/${asset.thumbPath}`}
        alt={asset.alt ?? ''}
        loading="lazy"
        decoding="async"
        className="aspect-square w-full bg-surface object-cover"
      />
      {/* select toggle */}
      <button
        onClick={onToggle}
        className="absolute start-1.5 top-1.5 rounded-full bg-bg-sunken/80 p-0.5 text-foreground backdrop-blur"
        title={he ? 'בחר' : 'Select'}
      >
        {selected ? <CheckCircle2 size={18} className="text-primary" /> : <Circle size={18} className="text-fg-muted" />}
      </button>
      {/* delete */}
      <button
        onClick={onDelete}
        className="absolute end-1.5 top-1.5 rounded-full bg-bg-sunken/80 p-1 text-danger opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
        title={he ? 'מחק' : 'Delete'}
      >
        <Trash2 size={15} />
      </button>
      <div className="flex items-center justify-between gap-1 px-2 py-1 text-2xs text-fg-muted">
        <span>{fmtBytes(asset.bytes)}</span>
        {!!asset.usedIn && (
          <Badge variant="accent">{he ? `ב-${asset.usedIn} לוחות` : `${asset.usedIn} board${asset.usedIn > 1 ? 's' : ''}`}</Badge>
        )}
      </div>
    </div>
  );
}

function ForceDeleteDialog({
  boards,
  he,
  pending,
  onCancel,
  onConfirm,
}: {
  boards: { title: string }[];
  he: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titles = [...new Set(boards.map((b) => b.title))];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--rz-overlay)] p-4" onClick={onCancel}>
      <Card featured className="relative w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onCancel} className="absolute end-3 top-3 text-fg-muted hover:text-foreground">
          <X size={18} />
        </button>
        <h2 className="mb-2 text-lg font-semibold">{he ? 'התמונה בשימוש' : 'Image is in use'}</h2>
        <p className="text-sm text-fg-muted">
          {he ? 'תמונה זו מופיעה בלוחות הבאים:' : 'This image appears on these boards:'}
        </p>
        <ul className="my-3 list-inside list-disc text-sm">
          {titles.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="text-sm text-fg-muted">
          {he ? 'מחיקה תסיר אותה גם מהלוחות. להמשיך?' : 'Deleting will also remove it from those boards. Continue?'}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {he ? 'ביטול' : 'Cancel'}
          </Button>
          <Button variant="danger" size="sm" loading={pending} onClick={onConfirm}>
            {he ? 'הסר ומחק' : 'Remove & delete'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
