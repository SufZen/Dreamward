import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface EmptyStateProps {
  title: string;
  hint?: string;
  /** optional custom icon/illustration; defaults to a book + sparkle motif */
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Friendly empty state with a soft inline-SVG illustration (token-colored). */
export function EmptyState({ title, hint, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <div className="text-primary opacity-90">{icon ?? <BookSparkle />}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs text-fg-muted">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

function BookSparkle() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="14" y="12" width="36" height="40" rx="3" stroke="currentColor" strokeWidth="2.5" opacity="0.55" />
      <path d="M32 14v38" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
      <path d="M20 24h7M20 31h7M37 24h7M37 31h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <path d="M46 8l1.6 4.4L52 14l-4.4 1.6L46 20l-1.6-4.4L40 14l4.4-1.6L46 8z" fill="currentColor" />
    </svg>
  );
}
