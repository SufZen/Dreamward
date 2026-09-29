import { cn } from '../lib/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** convenience for square/rect blocks; otherwise pass className sizing */
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const ROUND = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', full: 'rounded-full' } as const;

/** A pulsing placeholder block. Size it with className (e.g. "h-4 w-32"). */
export function Skeleton({ className, rounded = 'md', ...props }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-surface', ROUND[rounded], className)} aria-hidden="true" {...props} />;
}
