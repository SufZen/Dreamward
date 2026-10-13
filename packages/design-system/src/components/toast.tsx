import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/* ============================================================================
 * Toasts: quiet confirmation that something happened, with an optional
 * action (usually Undo). Call toast() from anywhere; render <Toaster /> once.
 * They stack at the bottom, rise in on the spring, and leave on their own
 * after a few seconds (longer when there is an action to take).
 * ========================================================================= */

export interface ToastOptions {
  /** e.g. { label: 'Undo', onClick: restore } */
  action?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'success' | 'danger';
  /** ms; default 4000, or 7000 with an action */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: ReactNode;
  leaving?: boolean;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismissToast(id: number) {
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 200);
}

/** Show a toast. Returns its id (for dismissToast). At most 3 are visible. */
export function toast(message: ReactNode, opts: ToastOptions = {}): number {
  const id = nextId++;
  items = [...items, { id, message, ...opts }].slice(-3);
  emit();
  return id;
}

function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
}

function ToastView({ item }: { item: ToastItem }) {
  useEffect(() => {
    const ms = item.duration ?? (item.action ? 7000 : 4000);
    const timer = setTimeout(() => dismissToast(item.id), ms);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, item.action]);
  return (
    <div
      className={cn('dw-toast', item.leaving && 'dw-toast--leaving')}
      data-tone={item.tone ?? 'neutral'}
      role="status"
    >
      <span className="dw-toast__msg">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="dw-toast__action"
          onClick={() => {
            item.action!.onClick();
            dismissToast(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}

/** Render once near the app root. */
export function Toaster() {
  const list = useToasts();
  return (
    <div className="dw-toaster" aria-live="polite">
      {list.map((t) => (
        <ToastView key={t.id} item={t} />
      ))}
    </div>
  );
}
