import { cn } from '@dreamward/design-system';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  /** words shown under the two ends of the scale */
  lowHint?: string;
  highHint?: string;
  className?: string;
}

/** 1-10 scale as a row of tappable segments — works the same LTR and RTL. */
export function ScoreSlider({ value, onChange, min = 1, max = 10, label, lowHint, highHint, className }: Props) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {steps.map((n) => {
          const active = n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === value}
              aria-label={`${n}`}
              onClick={() => onChange(n)}
              className={cn(
                'flex h-9 flex-1 items-center justify-center rounded-md border text-xs font-mono transition-colors',
                active
                  ? 'border-transparent bg-primary text-[color:var(--rz-accent-fg)]'
                  : 'border-border bg-surface text-fg-faint hover:bg-surface-hover hover:text-foreground',
                n === value && 'ring-[3px] ring-[color:var(--rz-accent-ring)]',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(lowHint || highHint) && (
        <div className="flex justify-between text-2xs text-fg-faint">
          <span>{lowHint}</span>
          <span>{highHint}</span>
        </div>
      )}
    </div>
  );
}
