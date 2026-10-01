/* Life wheel — twelve areas rated 1–10 against the vision (the outer ring). The scores grow in,
 * the biggest gap lights up gold, and it moves one step closer. */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, Canvas, FPS, Sky, inOut, loopOut, tw } from '../brand';

const CX = 360;
const CY = 225;
const R = 170;
const SCORES = [7, 5, 8, 6, 3, 7, 9, 6, 5, 8, 6, 7];
const GAP = 4; // the lowest score

export const Wheel: React.FC = () => {
  const f = useCurrentFrame();
  const out = loopOut(f);
  const frame = tw(f, [0.1 * FPS, 1 * FPS], [0, 1]);
  const gap = tw(f, [4.2 * FPS, 4.9 * FPS], [0, 1]);
  const lift = tw(f, [5.2 * FPS, 6.2 * FPS], [0, 1], inOut);

  const pts = SCORES.map((s, i) => {
    const start = 1 * FPS + i * 0.22 * FPS;
    const grow = tw(f, [start, start + 0.8 * FPS], [0, 1]);
    const score = (i === GAP ? s + 2 * lift : s) * grow;
    const a = (i / SCORES.length) * Math.PI * 2 - Math.PI / 2;
    return { a, r: (score / 10) * R, grow };
  });
  const poly = pts.map((p) => `${CX + Math.cos(p.a) * p.r},${CY + Math.sin(p.a) * p.r}`).join(' ');

  return (
    <Sky glowX="50%" glowY="50%">
      <Canvas>
        <g opacity={out}>
          {[0.25, 0.5, 0.75].map((k) => (
            <circle key={k} cx={CX} cy={CY} r={R * k} fill="none" stroke={C.line} opacity={frame} />
          ))}
          {/* the vision: 10 */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.gold} strokeOpacity={0.4 * frame} strokeWidth={1.5} strokeDasharray="2 8" strokeLinecap="round" />
          {pts.map((p, i) => (
            <line key={i} x1={CX} y1={CY} x2={CX + Math.cos(p.a) * R} y2={CY + Math.sin(p.a) * R} stroke={C.line} opacity={frame} />
          ))}
          <polygon points={poly} fill={C.mist} fillOpacity={0.07} stroke={C.mist} strokeOpacity={0.35} strokeWidth={1.5} />
          {pts.map((p, i) => {
            const isGap = i === GAP;
            const x = CX + Math.cos(p.a) * p.r;
            const y = CY + Math.sin(p.a) * p.r;
            return (
              <g key={i} opacity={p.grow}>
                {isGap && (
                  <line
                    x1={x}
                    y1={y}
                    x2={CX + Math.cos(p.a) * R}
                    y2={CY + Math.sin(p.a) * R}
                    stroke={C.gold}
                    strokeOpacity={0.6 * gap}
                    strokeWidth={2}
                    strokeDasharray="3 6"
                  />
                )}
                <circle cx={x} cy={y} r={isGap ? 6 + 2 * gap : 5} fill={isGap && gap > 0.3 ? C.gold : C.mist} />
                {isGap && <circle cx={x} cy={y} r={16} fill="none" stroke={C.gold} strokeOpacity={0.5 * gap * (1 - lift)} />}
              </g>
            );
          })}
        </g>
      </Canvas>
    </Sky>
  );
};
