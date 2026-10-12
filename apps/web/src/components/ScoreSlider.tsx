import { useEffect, useRef, type CSSProperties } from 'react';
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

/**
 * 1-10 scale as a row of tappable segments — works the same LTR and RTL.
 * Intensity encodes the score: low segments are a deep amber, high ones the
 * bright star gold. A change sweeps as a wave outward from the previous value.
 */
export function ScoreSlider({ value, onChange, min = 1, max = 10, label, lowHint, highHint, className }: Props) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const prev = useRef(value);
  const from = prev.current; // the value before this change: the wave starts there
  useEffect(() => {
    prev.current = value;
  }, [value]);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {steps.map((n) => {
          const active = n <= value;
          const strength = Math.round(((n - min) / Math.max(1, max - min)) * 100);
          const style = {
            // deep amber → bright star; both golds, so the hue never drifts
            '--seg': `color-mix(in oklch, var(--dw-gold-10) ${strength}%, var(--dw-gold-7))`,
            transitionDelay: `${Math.abs(n - from) * 22}ms`,
          } as CSSProperties;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === value}
              aria-label={`${n}`}
              onClick={() => onChange(n)}
              style={style}
              className={cn(
                'rz-press flex h-9 flex-1 items-center justify-center rounded-md border text-xs font-medium tabular transition-[background-color,color,border-color,box-shadow,transform] duration-moderate',
                active
                  ? 'border-transparent bg-[color:var(--seg)] text-[color:var(--rz-accent-fg)]'
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
