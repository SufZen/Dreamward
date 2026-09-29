import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 h-[22px] px-2 rounded-sm font-mono text-2xs uppercase tracking-[0.04em] border',
  {
    variants: {
      variant: {
        neutral: 'text-fg-muted bg-surface border-border',
        accent: 'text-primary bg-[color:var(--rz-accent-soft)] border-transparent',
        success: 'text-success bg-success-soft border-transparent',
        warning: 'text-warning bg-warning-soft border-transparent',
        danger: 'text-danger bg-danger-soft border-transparent',
        info: 'text-info bg-info-soft border-transparent',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  ),
);
Badge.displayName = 'Badge';
