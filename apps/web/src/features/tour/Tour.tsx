import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MousePointerClick, X } from 'lucide-react';
import { Button, StarBurst, Twinkles, cn, type StarBurstHandle } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { TOUR_STEPS, type TourStep } from './steps';

/* ── State: one tour at a time, startable from anywhere ──────────────── */

const SEEN_KEY = 'dw-tour';
let active = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Start (or replay) the product tour. */
export function startTour() {
  active = true;
  emit();
}
function endTour(outcome: 'done' | 'skipped') {
  active = false;
  try {
    localStorage.setItem(SEEN_KEY, outcome);
  } catch {
    /* per-session only */
  }
  emit();
}
/** Has this device already finished or skipped the tour? */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true;
  }
}
const useTourActive = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => active,
  );

/* ── Geometry ────────────────────────────────────────────────────────── */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const PAD = 8;

/** The target's box, or null when it isn't on screen (e.g. the sidebar on a phone). */
function measure(selector: string | undefined): Box | null {
  if (!selector) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${selector}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) return null;
  return {
    x: Math.max(4, r.left - PAD),
    y: Math.max(4, r.top - PAD),
    w: Math.min(innerWidth - 8, r.width + PAD * 2),
    h: Math.min(innerHeight - 8, r.height + PAD * 2),
  };
}

/** Put the coach card beside the spotlight: below, above, or to the side — always on screen. */
function cardPosition(box: Box | null, cardW: number, cardH: number): CSSProperties {
  const M = 16;
  if (!box) return { left: `calc(50% - ${cardW / 2}px)`, top: `calc(50% - ${cardH / 2}px)` };
  const clampX = (x: number) => Math.min(Math.max(M, x), innerWidth - cardW - M);
  const clampY = (y: number) => Math.min(Math.max(M, y), innerHeight - cardH - M);
  if (box.y + box.h + M + cardH < innerHeight) return { left: clampX(box.x + box.w / 2 - cardW / 2), top: box.y + box.h + M };
  if (box.y - M - cardH > 0) return { left: clampX(box.x + box.w / 2 - cardW / 2), top: box.y - M - cardH };
  // tall targets (the sidebar): beside it, on whichever side has room
  const right = box.x + box.w + M;
  if (right + cardW < innerWidth) return { left: right, top: clampY(box.y + 40) };
  return { left: clampX(box.x - M - cardW), top: clampY(box.y + 40) };
}

/* ── The overlay ─────────────────────────────────────────────────────── */

/**
 * A guided tour over the real interface: a spotlight springs from element to
 * element while a coach card explains it. Some steps ask you to try the thing
 * ("check off a step", "press Ctrl+K") and move on when you do. Keyboard:
 * → / ← (or Enter) to move, Esc to leave. Mount once in the app shell.
 */
export function TourOverlay() {
  const isActive = useTourActive();
  if (!isActive) return null;
  return <TourRun />;
}

function TourRun() {
  const { lang, dir } = useLang();
  const he = lang === 'he';
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [tried, setTried] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ w: 360, h: 220 });
  const burst = useRef<StarBurstHandle>(null);
  const step: TourStep = TOUR_STEPS[i]!;
  const last = i === TOUR_STEPS.length - 1;

  const next = useCallback(() => (last ? endTour('done') : setI((n) => n + 1)), [last]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // Go to the step's page, then bring its target into view.
  useEffect(() => {
    setTried(false);
    if (step.route && pathname !== step.route) navigate(step.route);
    const t = setTimeout(() => {
      document.querySelector(`[data-tour="${step.target}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Follow the target as the page settles, scrolls or resizes.
  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      const b = measure(step.target);
      const sig = b ? `${b.x|0},${b.y|0},${b.w|0},${b.h|0}` : 'none';
      if (sig !== last) {
        last = sig;
        setBox(b);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Background tabs don't run rAF; measure on a timer too.
    const iv = setInterval(() => setBox(measure(step.target)), 400);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
    };
  }, [step.target]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el) setCardSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [i, box === null, lang]);

  // Interactive steps advance when the person does the thing.
  useEffect(() => {
    if (!step.waitFor) return;
    const onDone = () => {
      setTried(true);
      setTimeout(() => setI((n) => (TOUR_STEPS[n] === step ? n + 1 : n)), step.waitFor === 'dw:palette-open' ? 300 : 900);
    };
    window.addEventListener(step.waitFor, onDone);
    return () => window.removeEventListener(step.waitFor!, onDone);
  }, [step]);

  // Keyboard: arrows follow reading direction; Esc leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return; // the palette is open: let it have the keys
      const el = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable) return;
      const fwd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const bwd = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === 'Escape') endTour('skipped');
      else if (e.key === fwd) next();
      else if (e.key === bwd) back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dir, next, back]);

  useEffect(() => {
    cardRef.current?.focus();
    if (last) setTimeout(() => burst.current?.fire(), 250);
  }, [i, last]);

  const centered = !box;
  const pos = cardPosition(box, cardSize.w, cardSize.h);
  const mod = navigator.platform.startsWith('Mac') ? '⌘K' : 'Ctrl+K';
  // Keys are wrapped in a left-to-right isolate so they never reorder inside Hebrew text.
  const t = (s: { he: string; en: string }) => (he ? s.he : s.en).replace('{mod}', he ? `⁦${mod}⁩` : mod);

  return (
    <div className="dw-tour" role="presentation">
      {/* The dimmed page with a spotlight cut out of it. The cut-out only blocks
          clicks outside it, so interactive steps can be tried for real. */}
      <div
        className={cn('dw-tour__spot', centered && 'dw-tour__spot--none', step.waitFor && 'dw-tour__spot--live')}
        style={box ? { left: box.x, top: box.y, width: box.w, height: box.h } : undefined}
        aria-hidden="true"
      />
      <Blockers box={step.waitFor ? box : null} />
      {centered && step.kind !== 'plain' && (
        <div className="dw-tour__sky" aria-hidden="true">
          <Twinkles density={0.8} />
        </div>
      )}

      <div
        key={i}
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="dw-tour-title"
        aria-describedby="dw-tour-body"
        className={cn('dw-tour__card', centered && 'dw-tour__card--center')}
        style={pos}
      >
        {step.art && <TourArt name={step.art} />}
        <div className="relative">
          <h2 id="dw-tour-title" className="text-lg font-semibold">
            {t(step.title)}
          </h2>
          {last && <StarBurst ref={burst} scale="chapter" />}
        </div>
        <p id="dw-tour-body" className="text-sm leading-relaxed text-fg-muted">
          {t(step.body)}
        </p>
        {step.waitFor && step.tryIt && (
          <p className={cn('flex items-center gap-2 text-sm font-medium', tried ? 'text-success' : 'text-primary')}>
            <MousePointerClick size={15} className={tried ? '' : 'dw-tour__nudge'} />
            {tried ? (he ? 'מעולה!' : 'Nice!') : t(step.tryIt)}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <ol className="flex flex-1 gap-1" aria-label={he ? `שלב ${i + 1} מתוך ${TOUR_STEPS.length}` : `Step ${i + 1} of ${TOUR_STEPS.length}`}>
            {TOUR_STEPS.map((_, n) => (
              <li
                key={n}
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] duration-spring ease-spring',
                  n === i ? 'w-5 bg-primary' : n < i ? 'w-1.5 bg-primary opacity-50' : 'w-1.5 bg-surface-hover',
                )}
              />
            ))}
          </ol>
          {i > 0 && !last && (
            <Button variant="ghost" size="sm" onClick={back}>
              <ArrowRight size={14} className="ltr:rotate-180" /> {he ? 'הקודם' : 'Back'}
            </Button>
          )}
          <Button size="sm" onClick={next}>
            {last ? (he ? 'יוצאים לדרך' : 'Let’s go') : i === 0 ? (he ? 'בוא נראה' : 'Show me') : he ? 'הבא' : 'Next'}
            {!last && <ArrowLeft size={14} className="ltr:rotate-180" />}
          </Button>
        </div>
        {!last && (
          <button
            type="button"
            onClick={() => endTour('skipped')}
            className="absolute end-3 top-3 rounded-xs p-1 text-fg-subtle transition-colors hover:text-foreground"
            aria-label={he ? 'סגירת הסיור' : 'Close the tour'}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Small animated illustrations for the opening and closing cards. */
function TourArt({ name }: { name: 'welcome' | 'finish' }) {
  return (
    <svg viewBox="0 0 240 90" className="dw-tour__art" aria-hidden="true">
      <defs>
        <radialGradient id="dw-tour-glow">
          <stop offset="0%" stopColor="var(--rz-accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--rz-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the path of steps rising to the star */}
      <path d="M24 78 Q 90 70 120 50 T 196 22" className="dw-tour__path" pathLength={1} />
      {[
        [24, 78, 3],
        [62, 72, 3.5],
        [100, 60, 4],
        [140, 42, 4.5],
      ].map(([cx, cy, r], n) => (
        <circle key={n} cx={cx} cy={cy} r={r} className="dw-tour__dot" style={{ '--i': n } as CSSProperties} />
      ))}
      <circle cx="196" cy="22" r="26" fill="url(#dw-tour-glow)" className="dw-tour__halo" />
      <path
        d="M196 6 L199 19 L210 22 L199 25 L196 38 L193 25 L182 22 L193 19 Z"
        className={cn('dw-tour__star', name === 'finish' && 'dw-tour__star--bright')}
      />
    </svg>
  );
}

/**
 * Click shields around the spotlight. With a box (interactive steps), the
 * hole stays clickable so the person can try the real thing; otherwise the
 * whole page is shielded while the tour talks.
 */
function Blockers({ box }: { box: Box | null }) {
  const base: CSSProperties = { position: 'fixed', pointerEvents: 'auto' };
  if (!box) return <div style={{ ...base, inset: 0 }} aria-hidden="true" />;
  return (
    <>
      <div style={{ ...base, left: 0, top: 0, right: 0, height: box.y }} aria-hidden="true" />
      <div style={{ ...base, left: 0, top: box.y + box.h, right: 0, bottom: 0 }} aria-hidden="true" />
      <div style={{ ...base, left: 0, top: box.y, width: box.x, height: box.h }} aria-hidden="true" />
      <div style={{ ...base, left: box.x + box.w, top: box.y, right: 0, height: box.h }} aria-hidden="true" />
    </>
  );
}
