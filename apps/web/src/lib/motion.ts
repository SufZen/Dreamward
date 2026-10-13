import { useCallback, useSyncExternalStore } from 'react';
import { setMotionPreference, type MotionPreference } from '@dreamward/design-system';

const STORAGE_KEY = 'dw-motion';

function readStored(): MotionPreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'reduced' || v === 'full' ? v : 'system';
  } catch {
    return 'system';
  }
}

let current: MotionPreference = readStored();
const listeners = new Set<() => void>();

/** Call once at bootstrap, before React renders. */
export function initMotion() {
  setMotionPreference(current);
}

/** "system" follows the OS reduced-motion setting; the others override it. */
export function useMotionPreference(): [MotionPreference, (p: MotionPreference) => void] {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  const set = useCallback((p: MotionPreference) => {
    current = p;
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* private mode: the choice lasts for this session */
    }
    setMotionPreference(p);
    listeners.forEach((l) => l());
  }, []);
  return [pref, set];
}
