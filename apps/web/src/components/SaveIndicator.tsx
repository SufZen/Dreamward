import { Check, CloudUpload, AlertTriangle } from 'lucide-react';
import type { SaveStatus } from '@/lib/useAutosave';
import { useLang } from '@/lib/lang';

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const { t } = useLang();
  if (status === 'idle') return null;
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-danger">
        <AlertTriangle size={13} /> {t('saveError')}
      </span>
    );
  if (status === 'saved')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check size={13} /> {t('saved')}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
      <CloudUpload size={13} className="animate-pulse" /> {t('saving')}
    </span>
  );
}
