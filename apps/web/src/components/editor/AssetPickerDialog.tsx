import { useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button, Card, Skeleton, EmptyState } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useAssets, useUploadAsset, type Asset } from '@/features/moodboard/hooks';

interface Props {
  onPick: (asset: Asset) => void;
  onClose: () => void;
}

/** Modal image picker reusing the gallery list; pick inserts into the editor. */
export function AssetPickerDialog({ onPick, onClose }: Props) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: assets, isLoading } = useAssets();
  const upload = useUploadAsset();
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const created = await upload.mutateAsync(file).catch(() => null);
    if (created) onPick(created);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--rz-overlay)] p-4" onClick={onClose}>
      <Card featured className="relative flex max-h-[80vh] w-full max-w-2xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute end-3 top-3 text-fg-muted hover:text-foreground">
          <X size={18} />
        </button>
        <div className="mb-3 flex items-center justify-between gap-2 pe-8">
          <h2 className="text-lg font-semibold">{he ? 'בחר תמונה' : 'Pick an image'}</h2>
          <Button size="sm" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> {he ? 'העלאה' : 'Upload'}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onUpload(e.target.files)} />
        </div>

        <div className="overflow-y-auto">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : !assets?.length ? (
            <EmptyState title={he ? 'אין תמונות עדיין' : 'No images yet'} hint={he ? 'העלה תמונה כדי להתחיל.' : 'Upload one to get started.'} />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick(a)}
                  className="overflow-hidden rounded-md border border-border transition-transform hover:scale-[1.04] hover:border-primary"
                >
                  <img src={`/media/${a.thumbPath}`} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
