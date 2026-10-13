import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface EmptyStateProps {
  title: string;
  hint?: string;
  /** optional custom icon/illustration; defaults to the steps rising to the star */
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** An empty page is an invitation: the steps toward the star, drawn as it appears. */
export function EmptyState({ title, hint, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('rz-stagger flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <div style={{ '--i': 0 } as React.CSSProperties}>{icon ?? <StepsToStar />}</div>
      <p className="text-md font-medium text-foreground" style={{ '--i': 1 } as React.CSSProperties}>
        {title}
      </p>
      {hint && (
        <p className="max-w-xs text-sm text-fg-muted" style={{ '--i': 2 } as React.CSSProperties}>
          {hint}
        </p>
      )}
      {action && (
        <div className="mt-2" style={{ '--i': 3 } as React.CSSProperties}>
          {action}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { cx: 14, cy: 54, r: 2.5 },
  { cx: 24, cy: 46, r: 3 },
  { cx: 34, cy: 38, r: 3.5 },
  { cx: 44, cy: 30, r: 4 },
];

/** The brand motif: four steps growing as they rise toward the north star. */
function StepsToStar() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true" className="dw-empty-mark">
      <circle cx="56" cy="16" r="14" fill="var(--rz-accent-soft)" className="dw-empty-mark__halo" />
      {STEPS.map((s, i) => (
        <circle
          key={i}
          {...s}
          fill="var(--rz-fg-faint)"
          className="dw-empty-mark__step"
          style={{ '--i': i } as React.CSSProperties}
        />
      ))}
      {/* compass star: the vertical ray is longer than the horizontal one */}
      <path
        d="M56 4 L58.2 13.8 L66 16 L58.2 18.2 L56 28 L53.8 18.2 L46 16 L53.8 13.8 Z"
        fill="var(--rz-accent)"
        className="dw-empty-mark__star"
      />
    </svg>
  );
}
