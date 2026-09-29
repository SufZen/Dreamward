import { useCallback, useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'dw-theme';

function readStored(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' ? 'light' : 'dark';
}

let current: ThemeMode = readStored();
const listeners = new Set<() => void>();

function apply(mode: ThemeMode) {
  document.documentElement.dataset.mode = mode;
  document.documentElement.style.colorScheme = mode;
}

/** Call once at bootstrap, before React renders (avoids a theme flash). */
export function initTheme() {
  apply(current);
}

export function setTheme(mode: ThemeMode) {
  current = mode;
  localStorage.setItem(STORAGE_KEY, mode);
  apply(mode);
  listeners.forEach((l) => l());
}

export function useTheme(): { mode: ThemeMode; toggle: () => void; setMode: (m: ThemeMode) => void } {
  const mode = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  const toggle = useCallback(() => setTheme(current === 'dark' ? 'light' : 'dark'), []);
  return { mode, toggle, setMode: setTheme };
}
