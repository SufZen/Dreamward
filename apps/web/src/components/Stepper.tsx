import { cn } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';

export interface StepperStep {
  key: string;
  en: string;
  he: string;
  /** optional dot colour once reached (IKIGAI circles) */
  color?: string;
}

interface Props {
  steps: StepperStep[];
  step: number;
  /** when given, dots are buttons that jump to a step */
  onGo?: (i: number) => void;
  /** shown at the end of the label row (e.g. a save indicator) */
  aside?: React.ReactNode;
}

/** "Step n of N · title" plus a row of progress dots. Used by guided flows. */
export function Stepper({ steps, step, onGo, aside }: Props) {
  const { lang } = useLang();
  const he = lang === 'he';
  const current = steps[step]!;
  return (
    <nav aria-label={he ? 'שלבים' : 'Steps'} className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-fg-muted">
        <span>
          {he ? `שלב ${step + 1} מתוך ${steps.length}` : `Step ${step + 1} of ${steps.length}`} ·{' '}
          {pickLabel(lang, current.en, current.he)}
        </span>
        {aside}
      </div>
      <ol className="flex gap-1">
        {steps.map((s, i) => {
          const className = cn(
            'block h-1.5 w-full rounded-full transition-colors',
            i > step && 'bg-surface-hover',
            i <= step && !s.color && 'bg-primary',
          );
          const style = i <= step && s.color ? { background: s.color } : undefined;
          const title = pickLabel(lang, s.en, s.he);
          return (
            <li key={s.key} className="flex-1">
              {onGo ? (
                <button
                  type="button"
                  onClick={() => onGo(i)}
                  title={title}
                  aria-label={title}
                  aria-current={i === step ? 'step' : undefined}
                  className={className}
                  style={style}
                />
              ) : (
                <span title={title} aria-current={i === step ? 'step' : undefined} className={className} style={style} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
