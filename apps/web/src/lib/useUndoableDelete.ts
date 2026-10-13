import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';

const GRACE_MS = 6000;

/**
 * Delete with Undo instead of "are you sure?". The item disappears from every
 * cached list under `queryKey` at once and a toast offers Undo; the server
 * delete only happens when the toast runs out. Undo puts the lists back as
 * they were. Closing the tab during the grace period completes the delete.
 */
export function useUndoableDelete<T extends { id: string }>(opts: {
  queryKey: QueryKey;
  remove: (id: string) => Promise<unknown>;
  /** extra query prefixes to refresh after the delete lands */
  alsoInvalidate?: QueryKey[];
}) {
  const qc = useQueryClient();
  const { lang } = useLang();

  return (item: T, label: string) => {
    const snapshot = qc.getQueriesData<unknown>({ queryKey: opts.queryKey });
    qc.setQueriesData<unknown>({ queryKey: opts.queryKey }, (old: unknown) =>
      Array.isArray(old) ? old.filter((x: { id?: string }) => x?.id !== item.id) : old,
    );

    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      window.removeEventListener('beforeunload', commit);
      opts
        .remove(item.id)
        .catch(() => {
          // put it back and say so — never lose data silently
          snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
          toast(lang === 'he' ? 'המחיקה נכשלה' : 'Couldn’t delete', { tone: 'danger' });
        })
        .finally(() => {
          qc.invalidateQueries({ queryKey: opts.queryKey });
          opts.alsoInvalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
        });
    };
    const timer = setTimeout(commit, GRACE_MS);
    window.addEventListener('beforeunload', commit);

    toast(lang === 'he' ? `נמחק: ${label}` : `Deleted: ${label}`, {
      duration: GRACE_MS - 200,
      action: {
        label: lang === 'he' ? 'ביטול' : 'Undo',
        onClick: () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          window.removeEventListener('beforeunload', commit);
          snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
        },
      },
    });
  };
}
