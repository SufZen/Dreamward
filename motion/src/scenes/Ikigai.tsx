/* IKIGAI — four circles (love, good at, the world needs, paid for) drift together;
 * where all four meet, the star appears. Colours match packages/shared/src/ikigai.ts. */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, Canvas, FPS, Sky, Star, inOut, loopOut, tw } from '../brand';

const CX = 360;
const CY = 225;
const CIRCLES = [
  { color: '#f472b6', dx: 0, dy: -1 }, // love
  { color: '#60a5fa', dx: -1, dy: 0 }, // good at
  { color: '#34d399', dx: 1, dy: 0 }, // the world needs
  { color: '#fbbf24', dx: 0, dy: 1 }, // paid for
];

export const Ikigai: React.FC = () => {
  const f = useCurrentFrame();
  const out = loopOut(f);
  const star = tw(f, [4.4 * FPS, 5.4 * FPS], [0, 1]);

  return (
    <Sky glowX="50%" glowY="50%">
      <Canvas>
        <g opacity={out}>
          {CIRCLES.map((c, i) => {
            const s = 0.2 * FPS + i * 0.35 * FPS;
            const show = tw(f, [s, s + 0.8 * FPS], [0, 1]);
            const meet = tw(f, [1.8 * FPS + i * 0.2 * FPS, 4.2 * FPS], [0, 1], inOut);
            const dist = 118 - 66 * meet;
            return (
              <circle
                key={i}
                cx={CX + c.dx * dist}
                cy={CY + c.dy * dist}
                r={82}
                fill={c.color}
                fillOpacity={0.22 * show}
                stroke={c.color}
                strokeOpacity={0.7 * show}
                strokeWidth={1.5}
                style={{ mixBlendMode: 'screen' }}
              />
            );
          })}
          <Star x={CX} y={CY} size={40} opacity={star} glow={star} color={C.gold} />
        </g>
      </Canvas>
    </Sky>
  );
};
