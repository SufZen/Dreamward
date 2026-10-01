/* Welcome — the Dreamward method in one loop: Dream (a star appears), Ward (a path toward it),
 * Step (small steps light up along the path; the last one makes the star brighten). */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, Canvas, FPS, Sky, Star, inOut, loopOut, qpt, tw } from '../brand';

const P0: [number, number] = [150, 372];
const CTRL: [number, number] = [250, 150];
const P1: [number, number] = [540, 118];
const PATH = `M${P0[0]} ${P0[1]} Q${CTRL[0]} ${CTRL[1]} ${P1[0]} ${P1[1]}`;
const LEN = 560; // ≥ path length, for the draw-on dash
const STEPS = [0.12, 0.34, 0.56, 0.78];

export const Welcome: React.FC = () => {
  const f = useCurrentFrame();
  const out = loopOut(f);
  const dream = tw(f, [0.3 * FPS, 1.6 * FPS], [0, 1]);
  const ward = tw(f, [1.6 * FPS, 3.4 * FPS], [0, 1], inOut);
  const lastStep = 3.6 * FPS + (STEPS.length - 1) * 0.55 * FPS;
  const arrive = tw(f, [lastStep + 6, lastStep + 26], [0, 1]);

  return (
    <Sky>
      <Canvas>
        <g opacity={out}>
          <path
            d={PATH}
            fill="none"
            stroke={C.gold}
            strokeOpacity={0.5}
            strokeWidth={2}
            strokeDasharray={`2 9`}
            strokeLinecap="round"
            mask="url(#draw)"
          />
          <mask id="draw">
            <path d={PATH} fill="none" stroke="#fff" strokeWidth={8} strokeDasharray={LEN} strokeDashoffset={LEN * (1 - ward)} />
          </mask>
          {STEPS.map((t, i) => {
            const start = 3.6 * FPS + i * 0.55 * FPS;
            const p = tw(f, [start, start + 14], [0, 1]);
            const [x, y] = qpt(P0, CTRL, P1, t);
            const r = 8 + i * 3;
            return (
              <g key={i} opacity={p}>
                <circle cx={x} cy={y} r={r * 2.6 * (1 - p) + r} fill="none" stroke={C.gold} strokeOpacity={0.4 * (1 - p)} />
                <circle cx={x} cy={y} r={r * (0.4 + 0.6 * p)} fill={C.gold} />
              </g>
            );
          })}
          <Star x={P1[0]} y={P1[1]} size={46 + 10 * arrive} opacity={dream} glow={0.45 * dream + 0.55 * arrive} />
        </g>
      </Canvas>
    </Sky>
  );
};
