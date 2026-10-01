/* Clarity — scattered thoughts drift in, the gold focus ring snaps into focus around the star,
 * and the thoughts settle into the four steps orbiting it (the ClarityAvatar, brought to life). */
import React from 'react';
import { random, useCurrentFrame } from 'remotion';
import { C, Canvas, FPS, Sky, Star, inOut, loopOut, tw } from '../brand';

const CX = 360;
const CY = 225;
const RING = 64;
const ORBIT = 112;
const THOUGHTS = Array.from({ length: 22 }, (_, i) => ({
  x: 60 + random(`x${i}`) * 600,
  y: 40 + random(`y${i}`) * 370,
  r: 2 + random(`r${i}`) * 3,
  step: i % 4,
}));

export const Clarity: React.FC = () => {
  const f = useCurrentFrame();
  const out = loopOut(f);
  const t = f / FPS;
  const show = tw(f, [0.1 * FPS, 1 * FPS], [0, 1]);
  const focus = tw(f, [1.6 * FPS, 3.2 * FPS], [0, 1], inOut); // the ring tightens into focus
  const gather = tw(f, [3 * FPS, 4.8 * FPS], [0, 1], inOut);
  const spin = t * 0.35; // slow orbit
  const breathe = 0.85 + 0.15 * Math.sin(t * Math.PI * 0.75);

  return (
    <Sky glowX="50%" glowY="50%">
      <Canvas>
        <g opacity={out}>
          <Star x={CX} y={CY} size={44} opacity={show} glow={(0.3 + 0.6 * focus) * breathe} />
          <circle
            cx={CX}
            cy={CY}
            r={RING * (1.7 - 0.7 * focus)}
            fill="none"
            stroke={C.gold}
            strokeWidth={1.5 + focus}
            strokeOpacity={show * (0.15 + 0.6 * focus)}
            style={{ filter: `blur(${(1 - focus) * 4}px)` }}
          />
          {THOUGHTS.map((p, i) => {
            const k = p.step;
            const a = spin + (k / 4) * Math.PI * 2 - Math.PI / 2;
            const tx = CX + Math.cos(a) * ORBIT;
            const ty = CY + Math.sin(a) * ORBIT;
            const drift = 6 * Math.sin(t * 1.3 + i);
            const x = p.x + drift + (tx - p.x - drift) * gather;
            const y = p.y + (ty - p.y) * gather;
            return <circle key={i} cx={x} cy={y} r={p.r + (4 + k * 1.6 - p.r) * gather} fill={gather > 0.6 ? C.gold : C.muted} opacity={show * (0.55 + 0.45 * gather) * (i < 4 ? 1 : 1 - 0.85 * gather)} />;
          })}
          {/* the steps light up in turn once they've settled */}
          {[0, 1, 2, 3].map((k) => {
            const a = spin + (k / 4) * Math.PI * 2 - Math.PI / 2;
            const pulse = tw(f, [5.1 * FPS + k * 0.35 * FPS, 5.5 * FPS + k * 0.35 * FPS], [0, 1]);
            return <circle key={k} cx={CX + Math.cos(a) * ORBIT} cy={CY + Math.sin(a) * ORBIT} r={(4 + k * 1.6) * 2.6} fill="url(#starGlow)" opacity={pulse * gather} />;
          })}
        </g>
      </Canvas>
    </Sky>
  );
};
