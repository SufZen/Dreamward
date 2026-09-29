import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Debounced autosave: whenever `value` changes (after the first render),
 * waits `delay` ms of inactivity then calls `save`. Reports status for the UI.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<unknown>, delay = 800): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStatus('saving');
      saveRef.current(value)
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'));
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return status;
}
