/* ============================================================================
 * @dreamward/design-system — clarity-avatar.tsx
 * Clarity, the personal assistant. The north star from the Dreamward mark sits
 * inside a thin focus ring (a lens snapping into focus: clarity), with the
 * four steps of the mark orbiting it. Always drawn on night ink, in gold.
 *
 *   idle      a slow, gentle glow
 *   thinking  the ring tightens into focus and the steps light up in turn
 *   speaking  a steady, brighter glow
 *
 * Animation lives in components.css (.dw-clarity) and stops under
 * prefers-reduced-motion. Static copy: assets/clarity-avatar.svg.
 * ========================================================================= */
import { useId, type SVGProps } from 'react';
import { cn } from '../lib/cn';

export type ClarityState = 'idle' | 'thinking' | 'speaking';

type Props = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'width' | 'height'> & {
  /** Pixel size (square). */
  size?: number;
  state?: ClarityState;
  title?: string;
};

/** The mark's star, centred on the avatar (scaled from the logo geometry). */
const STAR = 'M24 15.2 L25.2 22.8 L29.5 24 L25.2 25.2 L24 32.8 L22.8 25.2 L18.5 24 L22.8 22.8 Z';
/** The mark's four growing steps, orbiting the ring from lower-left to lower-right. */
const STEPS: ReadonlyArray<readonly [number, number, number]> = [
  [11.6, 36.4, 1.1],
  [11.6, 11.6, 1.35],
  [36.4, 11.6, 1.6],
  [36.4, 36.4, 1.85],
];

export function ClarityAvatar({ size = 32, state = 'idle', title = 'Clarity', className, ...rest }: Props) {
  const halo = `dw-clarity-halo-${useId().replace(/:/g, '')}`;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn('dw-clarity', `dw-clarity--${state}`, className)}
      {...rest}
    >
      <defs>
        <radialGradient id={halo} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffcc00" stopOpacity="0.38" />
          <stop offset="55%" stopColor="#ffcc00" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffcc00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="#0a0a0f" />
      <circle className="dw-clarity__halo" cx="24" cy="24" r="20" fill={`url(#${halo})`} />
      <circle
        className="dw-clarity__ring"
        cx="24"
        cy="24"
        r="13"
        fill="none"
        stroke="#ffcc00"
        strokeOpacity="0.85"
        strokeWidth="1.2"
      />
      {STEPS.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} className="dw-clarity__step" cx={cx} cy={cy} r={r} fill="#ffcc00" />
      ))}
      <path className="dw-clarity__star" d={STAR} fill="#ffcc00" />
    </svg>
  );
}
