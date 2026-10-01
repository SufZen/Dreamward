/* Shared Dreamward brand pieces for the onboarding loops (docs/brand.md):
 * night ink + one gold north star, growing step-dots, a quiet starfield, calm motion. */
import React from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';

export const C = {
  ink: '#0a0a0f',
  sunken: '#12121a',
  raised: '#1a1a24',
  line: 'rgba(255,255,255,0.10)',
  mist: '#e8e8ed',
  muted: '#9a9ab0',
  faint: '#5c5c70',
  gold: '#ffcc00',
  goldSoft: 'rgba(255,204,0,0.18)',
};

export const W = 720;
export const H = 450;
export const FPS = 30;
export const LOOP = 8 * FPS; // every loop is 8 s and ends where it starts

export const calm = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** interpolate, clamped, calm by default. */
export const tw = (frame: number, input: number[], output: number[], easing = calm) =>
  interpolate(frame, input, output, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

/** 1 while the loop plays, easing to 0 over its last second so frame LOOP-1 matches frame 0. */
export const loopOut = (frame: number) => tw(frame, [LOOP - 1.1 * FPS, LOOP - 0.15 * FPS], [1, 0], inOut);

/** The night sky: ink, a faint dot starfield and the star's glow on the horizon. */
export const Sky: React.FC<{ glowX?: string; glowY?: string; children?: React.ReactNode }> = ({ glowX = '78%', glowY = '18%', children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: C.ink,
      backgroundImage: `radial-gradient(55% 60% at ${glowX} ${glowY}, rgba(255,204,0,0.10), transparent 70%), radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1.3px)`,
      backgroundSize: '100% 100%, 26px 26px',
    }}
  >
    {children}
  </AbsoluteFill>
);

/** The compass north star (vertical ray longer than the horizontal), centred on (x, y). */
export const Star: React.FC<{ x: number; y: number; size: number; glow?: number; opacity?: number; color?: string }> = ({
  x,
  y,
  size,
  glow = 0,
  opacity = 1,
  color = C.gold,
}) => {
  const s = size / 30; // path is drawn in a 20 × 30 box
  return (
    <g opacity={opacity}>
      {glow > 0 && <circle cx={x} cy={y} r={size * 1.6} fill="url(#starGlow)" opacity={glow} />}
      <path
        transform={`translate(${x - 10 * s} ${y - 15 * s}) scale(${s})`}
        d="M10 0 L12.2 12.8 L20 15 L12.2 17.2 L10 30 L7.8 17.2 L0 15 L7.8 12.8 Z"
        fill={color}
      />
    </g>
  );
};

/** SVG canvas with the shared star-glow gradient. */
export const Canvas: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
    <defs>
      <radialGradient id="starGlow">
        <stop offset="0" stopColor={C.gold} stopOpacity="0.55" />
        <stop offset="0.45" stopColor={C.gold} stopOpacity="0.16" />
        <stop offset="1" stopColor={C.gold} stopOpacity="0" />
      </radialGradient>
    </defs>
    {children}
  </svg>
);

/** Point on a quadratic Bézier. */
export const qpt = (p0: [number, number], c: [number, number], p1: [number, number], t: number): [number, number] => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1],
];
