/* One step at a time — a goal breaks into small actions. Each action is checked off,
 * its step-dot lights up, and when the last one lands the star brightens (the only celebration). */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, Canvas, FPS, Sky, Star, loopOut, tw } from '../brand';

const ROWS = [
  { y: 150, w: 190 },
  { y: 215, w: 150 },
  { y: 280, w: 175 },
  { y: 345, w: 130 },
];
// the step-dots climb like the Dreamward mark, toward the star
const DOTS: [number, number, number][] = [
  [440, 350, 7],
  [478, 296, 9],
  [520, 248, 11],
  [566, 206, 13],
];
const STAR: [number, number] = [624, 120];

export const Steps: React.FC = () => {
  const f = useCurrentFrame();
  const out = loopOut(f);
  const done = (i: number) => tw(f, [1.6 * FPS + i * 0.9 * FPS, 1.6 * FPS + i * 0.9 * FPS + 12], [0, 1]);
  const finale = tw(f, [1.6 * FPS + 3 * 0.9 * FPS + 14, 1.6 * FPS + 3 * 0.9 * FPS + 40], [0, 1]);

  return (
    <Sky glowX="85%" glowY="20%">
      <Canvas>
        <g opacity={out}>
          {ROWS.map((r, i) => {
            const show = tw(f, [0.2 * FPS + i * 0.18 * FPS, 0.9 * FPS + i * 0.18 * FPS], [0, 1]);
            const d = done(i);
            return (
              <g key={i} opacity={show}>
                <rect x={96} y={r.y - 24} width={280} height={48} rx={12} fill={C.raised} stroke={d > 0.5 ? 'rgba(255,204,0,0.35)' : C.line} />
                <rect x={114} y={r.y - 10} width={20} height={20} rx={6} fill={d > 0.2 ? C.gold : 'none'} stroke={d > 0.2 ? C.gold : C.muted} strokeWidth={1.5} />
                <path
                  d={`M${118} ${r.y} l5 5 l9 -10`}
                  fill="none"
                  stroke={C.ink}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={22}
                  strokeDashoffset={22 * (1 - d)}
                />
                {/* the action's text, as a quiet line */}
                <rect x={148} y={r.y - 4} width={r.w} height={8} rx={4} fill={d > 0.5 ? C.faint : C.muted} opacity={0.8} />
              </g>
            );
          })}
          {DOTS.map(([x, y, r], i) => {
            const d = done(i);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={r} fill="none" stroke={C.muted} strokeOpacity={0.5 * tw(f, [0.6 * FPS, 1.2 * FPS], [0, 1])} strokeWidth={1.5} />
                <circle cx={x} cy={y} r={r * d} fill={C.gold} />
                <circle cx={x} cy={y} r={r + 18 * d} fill="none" stroke={C.gold} strokeOpacity={0.45 * (1 - d) * (d > 0 ? 1 : 0)} />
              </g>
            );
          })}
          <Star x={STAR[0]} y={STAR[1]} size={50 + 8 * finale} opacity={0.35 + 0.65 * finale} glow={0.15 + 0.85 * finale} />
        </g>
      </Canvas>
    </Sky>
  );
};
