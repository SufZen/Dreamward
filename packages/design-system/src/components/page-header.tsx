import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface PageHeaderProps {
  title: ReactNode;
  /** one plain sentence: what this page is for */
  description?: ReactNode;
  /** an icon tile shown before the title (areas, chapter, ikigai) */
  icon?: ReactNode;
  /** the page's primary action(s), placed at the inline end */
  actions?: ReactNode;
  /** small line above the title, e.g. the breadcrumb back to the hub */
  eyebrow?: ReactNode;
  className?: string;
}

/** The one header every page uses: title, a sentence of purpose, the primary action. */
export function PageHeader({ title, description, icon, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end gap-x-6 gap-y-3', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {icon && (
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[color:var(--rz-accent-soft)] text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-sm text-fg-subtle">{eyebrow}</div>}
          <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-fg-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
