/* ============================================================================
 * @dreamward/design-system — motion
 * Small, dependency-free motion primitives. CSS does the animating; these
 * components only set it up, and every one respects reduced motion
 * (OS setting, or data-motion on <html>).
 * ========================================================================= */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { cn } from '../lib/cn';

/* ── Reduced motion ──────────────────────────────────────────────────── */

export type MotionPreference = 'system' | 'reduced' | 'full';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => {
    mq.removeEventListener('change', cb);
    mo.disconnect();
  };
}

/** True when motion should be reduced: data-motion="reduced", or the OS asks and data-motion isn't "full". */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  const pref = document.documentElement.dataset.motion as MotionPreference | undefined;
  if (pref === 'reduced') return true;
  if (pref === 'full') return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

/** Apply the in-app motion setting ("system" defers to the OS). */
export function setMotionPreference(pref: MotionPreference) {
  if (pref === 'system') delete document.documentElement.dataset.motion;
  else document.documentElement.dataset.motion = pref;
}

/* ── View transitions ────────────────────────────────────────────────── */

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void>; skipTransition: () => void };
};

/**
 * Run a DOM update inside a same-document view transition when the browser
 * supports it and motion is allowed; otherwise just run it. Give a shared
 * element the same `view-transition-name` on both sides to morph it.
 *
 * The update never waits on the animation: the browser only calls back after
 * it has painted a snapshot, which a throttled or background window may not
 * do for a long time. If that takes over 200 ms we skip the animation and
 * apply the update directly.
 */
export function withViewTransition(update: () => void) {
  const doc = document as DocWithVT;
  if (!doc.startViewTransition || prefersReducedMotion() || document.visibilityState !== 'visible') {
    update();
    return;
  }
  let applied = false;
  const apply = () => {
    if (applied) return;
    applied = true;
    flushSync(update);
  };
  const vt = doc.startViewTransition(apply);
  setTimeout(() => {
    if (applied) return;
    vt.skipTransition();
    apply();
  }, 200);
}

/* ── Spotlight ───────────────────────────────────────────────────────── */

/** Feeds the pointer position to `.fx-spotlight` (sets --mx / --my). */
export function useSpotlight<T extends HTMLElement>() {
  return useCallback((el: T | null) => {
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    el.addEventListener('pointermove', move);
    return () => el.removeEventListener('pointermove', move);
  }, []);
}

/* ── Stagger ─────────────────────────────────────────────────────────── */

/** Children enter one after another (35 ms apart, capped at 8). Use once per screen. */
export function Stagger({ children, className, as: Tag = 'div' }: { children: ReactNode[]; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  return (
    <Tag className={cn('rz-stagger', className)}>
      {children.map((child, i) =>
        Tag === 'div' ? (
          <div key={i} style={{ '--i': i } as CSSProperties}>
            {child}
          </div>
        ) : (
          <li key={i} style={{ '--i': i } as CSSProperties}>
            {child}
          </li>
        ),
      )}
    </Tag>
  );
}

/* ── Star burst ──────────────────────────────────────────────────────── */

export type BurstScale = 'step' | 'goal' | 'chapter';

const BURST: Record<BurstScale, { count: number; dist: number; size: number; ring: number }> = {
  step: { count: 6, dist: 24, size: 6, ring: 44 },
  goal: { count: 12, dist: 56, size: 10, ring: 110 },
  chapter: { count: 20, dist: 110, size: 13, ring: 240 },
};

export interface StarBurstHandle {
  fire: () => void;
}

/**
 * Gold particles that fly out from the centre of the parent: the moment a
 * step counts. Celebration scales with the achievement — an action gets a
 * spark, a goal a burst, a chapter a sky. Place inside a `position:relative`
 * parent and call ref.fire(). Silent under reduced motion.
 */
export const StarBurst = forwardRef<StarBurstHandle, { scale?: BurstScale }>(({ scale = 'step' }, ref) => {
  const [shots, setShots] = useState<number[]>([]);
  useImperativeHandle(ref, () => ({
    fire: () => {
      if (prefersReducedMotion()) return;
      const id = Date.now() + Math.random();
      setShots((s) => [...s, id]);
    },
  }));
  const cfg = BURST[scale];
  return (
    <span aria-hidden="true" className="dw-burst">
      {shots.map((id) => (
        // removed when its last particle lands (the particles outlast the ring)
        <span
          key={id}
          onAnimationEnd={(e) => {
            if (e.animationName === 'rz-burst') setShots((s) => s.filter((x) => x !== id));
          }}
        >
          {scale !== 'step' && <i className="dw-burst__flash" style={{ width: cfg.ring * 1.4, height: cfg.ring * 1.4 } as CSSProperties} />}
          <i className="dw-burst__ring" style={{ width: cfg.ring, height: cfg.ring } as CSSProperties} />
          {Array.from({ length: cfg.count }, (_, i) => {
            const a = (i / cfg.count) * Math.PI * 2 + (id % 1);
            const d = cfg.dist * (0.75 + ((i * 37) % 10) / 20);
            return (
              <i
                key={i}
                className="dw-burst__p"
                style={
                  {
                    '--dx': `${Math.cos(a) * d}px`,
                    '--dy': `${Math.sin(a) * d}px`,
                    '--rot': `${(i % 2 ? 1 : -1) * 120}deg`,
                    width: cfg.size,
                    height: cfg.size,
                  } as CSSProperties
                }
              />
            );
          })}
        </span>
      ))}
    </span>
  );
});
StarBurst.displayName = 'StarBurst';

/* ── Check ───────────────────────────────────────────────────────────── */

export interface CheckProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** How big the celebration is when this gets checked. */
  burst?: BurstScale | false;
  className?: string;
  disabled?: boolean;
}

/** A completion check: the stroke draws itself and a step-sized spark flies. */
export function Check({ checked, onChange, label, burst = 'step', className, disabled }: CheckProps) {
  const burstRef = useRef<StarBurstHandle>(null);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        const next = !checked;
        onChange(next);
        if (next && burst) burstRef.current?.fire();
      }}
      className={cn('dw-check rz-press', className)}
      data-checked={checked || undefined}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 10.5 L8.5 14 L15 6.5" pathLength={1} />
      </svg>
      {burst && <StarBurst ref={burstRef} scale={burst} />}
    </button>
  );
}

/* ── Progress ring ───────────────────────────────────────────────────── */

export interface ProgressRingProps {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  className?: string;
  /** a visually hidden description for screen readers */
  ariaLabel?: string;
}

/** A ring that springs to its value — goals, chapters, wheel areas. */
export function ProgressRing({ value, size = 56, stroke = 5, label, className, ariaLabel }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn('dw-ring', className)}
      style={{ width: size, height: size, '--ring-size': `${size}px` } as CSSProperties}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="dw-ring__track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          pathLength={1}
          className="dw-ring__fill"
          style={{ strokeDashoffset: 1 - v } as CSSProperties}
        />
      </svg>
      {label != null && <span className="dw-ring__label">{label}</span>}
    </div>
  );
}

/* ── Count up ────────────────────────────────────────────────────────── */

/** A number that eases to its new value instead of snapping (tabular figures). */
export function CountUp({ value, duration = 700, format = (n: number) => String(Math.round(n)) }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 4);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular">{format(shown)}</span>;
}

/* ── Breathing orb ───────────────────────────────────────────────────── */

/**
 * The ritual's opening breath: 4 s in, 4 s out. Shown at the start of the
 * daily plan and weekly review. Never blocks input. Under reduced motion it
 * holds still and the prompt still reads "breathe in… breathe out".
 */
export function BreathingOrb({ size = 160, children, className }: { size?: number; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('dw-orb rz-ambient', className)} style={{ width: size, height: size } as CSSProperties}>
      <span className="dw-orb__glow" />
      <span className="dw-orb__core" />
      {children && <span className="dw-orb__label">{children}</span>}
    </div>
  );
}

/* ── Sky ─────────────────────────────────────────────────────────────── */

const STARS = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 61) % 100,
  y: (i * 37) % 100,
  s: 1 + ((i * 13) % 3) * 0.5,
  d: ((i * 7) % 40) / 10,
}));

/** A few stars that twinkle, each on its own clock. Decorative; ambient. */
export function Twinkles({ className, density = 1 }: { className?: string; density?: number }) {
  const stars = STARS.slice(0, Math.round(STARS.length * density));
  return (
    <div aria-hidden="true" className={cn('dw-twinkles rz-ambient', className)}>
      {stars.map((s, i) => (
        <i
          key={i}
          style={
            {
              insetInlineStart: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              animationDelay: `${s.d}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
