import { cn } from '../lib/cn';
import { Skeleton } from './skeleton';

/**
 * Shown while a page streams in. Shaped like a page (title, lede, two
 * cards) so nothing jumps when the real content lands. It only appears after
 * a short delay, so fast loads never flash it.
 */
export function PageLoader({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('dw-page-loader space-y-6', className)} role="status" aria-live="polite">
      {label && <span className="sr-only">{label}</span>}
      <Skeleton className="h-9 w-2/5" rounded="lg" />
      <Skeleton className="h-4 w-3/5" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32" rounded="lg" />
        <Skeleton className="h-32" rounded="lg" />
      </div>
    </div>
  );
}
