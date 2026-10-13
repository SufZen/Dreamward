import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Debounced autosave: whenever `value` changes (after the first render),
 * waits `delay` ms of inactivity then calls `save`. Reports status for the UI.
 *
 * Nothing typed is ever dropped: a change still waiting on the debounce is
 * saved immediately when the editor unmounts (Done, navigating away,
 * switching entries), and closing the tab while a save is pending asks the
 * browser to confirm. A failed save is retried once after 3 s.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<unknown>, delay = 800): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  /** the latest value not yet handed to save() */
  const pending = useRef<{ value: T } | null>(null);
  const mounted = useRef(true);

  const run = (v: T, retry = true) => {
    pending.current = null;
    if (mounted.current) setStatus('saving');
    saveRef
      .current(v)
      .then(() => mounted.current && setStatus('saved'))
      .catch(() => {
        if (mounted.current) setStatus('error');
        if (retry) setTimeout(() => run(v, false), 3000);
      });
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = { value };
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (pending.current) run(pending.current.value);
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  // Flush on unmount; warn before closing the tab with unsaved typing.
  useEffect(() => {
    mounted.current = true;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!pending.current) return;
      run(pending.current.value, false);
      e.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      if (timer.current) clearTimeout(timer.current);
      mounted.current = false;
      if (pending.current) run(pending.current.value);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}
