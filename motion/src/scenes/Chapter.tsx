/* Current Chapter — twelve life areas; a few move into focus (gold, around the star),
 * a few step aside to "not now" (they dim), the rest keep their place. */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, Canvas, FPS, Sky, Star, inOut, loopOut, tw } from '../brand';

const CX = 360;
const CY = 225;
const N = 12;
const FOCUS = [1, 5, 8]; // move to the centre ring
const NOT_NOW = [3, 10]; // drift outwards and dim

export const Chapter: React.FC = () => {
  const f = useCurrentFrame();
  const out = loopOut(f);
  const appear = tw(f, [0.2 * FPS, 1.2 * FPS], [0, 1]);
  const ring = tw(f, [1.4 * FPS, 2.4 * FPS], [0, 1]);
  const star = tw(f, [4.6 * FPS, 5.6 * FPS], [0, 1]);

  return (
    <Sky glowX="50%" glowY="50%">
      <Canvas>
        <g opacity={out}>
          {/* the focus ring */}
          <circle cx={CX} cy={CY} r={70} fill="none" stroke={C.gold} strokeOpacity={0.45 * ring} strokeWidth={1.5} strokeDasharray="3 7" />
          <circle cx={CX} cy={CY} r={168} fill="none" stroke={C.line} strokeOpacity={appear} />
          {Array.from({ length: N }, (_, i) => {
            const a = (i / N) * Math.PI * 2 - Math.PI / 2;
            const hx = CX + Math.cos(a) * 168;
            const hy = CY + Math.sin(a) * 168;
            const fi = FOCUS.indexOf(i);
            const ni = NOT_NOW.indexOf(i);
            let x = hx;
            let y = hy;
            let fill = C.muted;
            let op = 0.75 * appear;
            let r = 9;
            if (fi >= 0) {
              const s = 2.4 * FPS + fi * 0.5 * FPS;
              const m = tw(f, [s, s + 0.9 * FPS], [0, 1], inOut);
              const fa = (fi / FOCUS.length) * Math.PI * 2 - Math.PI / 2;
              x = hx + (CX + Math.cos(fa) * 70 - hx) * m;
              y = hy + (CY + Math.sin(fa) * 70 - hy) * m;
              fill = m > 0.5 ? C.gold : C.muted;
              op = appear * (0.75 + 0.25 * m);
              r = 9 + 3 * m;
            } else if (ni >= 0) {
              const s = 3.8 * FPS + ni * 0.4 * FPS;
              const m = tw(f, [s, s + 0.9 * FPS], [0, 1], inOut);
              x = hx + (hx - CX) * 0.22 * m;
              y = hy + (hy - CY) * 0.22 * m;
              op = appear * (0.75 - 0.5 * m);
              r = 9 - 2 * m;
            }
            return <circle key={i} cx={x} cy={y} r={r} fill={fill} opacity={op} />;
          })}
          <Star x={CX} y={CY} size={34} opacity={star} glow={0.8 * star} />
        </g>
      </Canvas>
    </Sky>
  );
};
