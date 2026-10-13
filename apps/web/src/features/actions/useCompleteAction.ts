import { useEffect, useRef, useState } from 'react';
import { useUpdateAction, type Action } from './hooks';

/**
 * Completing lands before the row leaves: the check (and its spark) show at
 * once and the update is sent a beat later, so a filtered list doesn't yank
 * the row away mid-animation. If the row unmounts first, it's sent now.
 */
export function useCompleteAction(action: Action) {
  const update = useUpdateAction();
  const [landing, setLanding] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
      flush.current?.();
    },
    [],
  );

  const setDone = (v: boolean) => {
    if (!v) {
      if (pending.current) clearTimeout(pending.current);
      const wasPending = flush.current !== null;
      flush.current = null;
      setLanding(false);
      // never sent? then there is nothing to undo on the server
      if (!wasPending) update.mutate({ id: action.id, status: 'todo' });
      return;
    }
    setLanding(true);
    flush.current = () => {
      flush.current = null;
      update.mutate({ id: action.id, status: 'done' });
    };
    pending.current = setTimeout(() => flush.current?.(), 550);
  };

  return { done: landing || action.status === 'done', setDone };
}
