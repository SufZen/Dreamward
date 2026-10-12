import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, RATING_MAX, type LatestRating } from '@dreamward/shared';
import { useAreaLabel } from '@/features/book/hooks';

const SIZE = 420;
const C = SIZE / 2;
const R = 130;

const point = (i: number, value: number) => {
  // start at 12 o'clock, clockwise
  const a = (Math.PI * 2 * i) / CATEGORIES.length - Math.PI / 2;
  const r = (R * value) / RATING_MAX;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a), a };
};

const poly = (values: number[]) => values.map((v, i) => point(i, v)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
/** Same shape as a path: CSS can transition `d`, so a new rating springs into place. */
const path = (values: number[]) => `M${poly(values).replace(/ /g, ' L')} Z`;

/**
 * Dependency-free radar of the 12 categories: current "how close to my
 * vision" scores (filled) vs. the previous rating (dashed). Focus categories
 * of the current chapter are highlighted. Click a label to open the category.
 */
export function LifeWheel({ ratings, focus = [] }: { ratings: LatestRating[]; focus?: string[] }) {
  const areaLabel = useAreaLabel();
  const navigate = useNavigate();
  const lightId = useId();
  const byId = new Map(ratings.map((r) => [r.categoryId, r]));
  const current = CATEGORIES.map((c) => byId.get(c.id)?.latest?.score ?? 0);
  const previous = CATEGORIES.map((c) => byId.get(c.id)?.previousScore ?? byId.get(c.id)?.latest?.score ?? 0);
  const hasPrevious = ratings.some((r) => r.previousScore !== null);

  return (
    <div dir="ltr" className="w-full">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[420px]" role="img" aria-label="life wheel">
        <defs>
          {/* the shape is lit from the centre, like light from the star */}
          <radialGradient id={lightId} gradientUnits="userSpaceOnUse" cx={C} cy={C} r={R}>
            <stop offset="0%" stopColor="var(--rz-accent)" stopOpacity={0.42} />
            <stop offset="100%" stopColor="var(--rz-accent)" stopOpacity={0.08} />
          </radialGradient>
        </defs>
        {/* rings */}
        {[2, 4, 6, 8, 10].map((v) => (
          <circle key={v} cx={C} cy={C} r={(R * v) / RATING_MAX} fill="none" stroke="var(--rz-border)" strokeWidth={v === 10 ? 1.2 : 0.7} />
        ))}
        {/* spokes + labels */}
        {CATEGORIES.map((c, i) => {
          const end = point(i, RATING_MAX);
          const lbl = point(i, RATING_MAX * 1.18);
          const cos = Math.cos(end.a);
          const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
          const isFocus = focus.includes(c.id);
          const score = byId.get(c.id)?.latest?.score;
          return (
            <g key={c.id} className="cursor-pointer" onClick={() => navigate(`/book/category/${c.id}`)}>
              <line x1={C} y1={C} x2={end.x} y2={end.y} stroke="var(--rz-border)" strokeWidth={0.7} />
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={isFocus ? 700 : 400}
                className={isFocus ? 'fill-[color:var(--rz-accent)]' : score ? 'fill-[color:var(--rz-fg-muted)]' : 'fill-[color:var(--rz-fg-faint)]'}
              >
                {areaLabel(c.id)}
                {score ? ` · ${score}` : ''}
              </text>
            </g>
          );
        })}
        {hasPrevious && (
          <polygon points={poly(previous)} fill="none" stroke="var(--rz-fg-faint)" strokeWidth={1.2} strokeDasharray="4 3" />
        )}
        {/* the d attribute is the fallback; CSS d (where supported) is what transitions */}
        <path
          className="dw-wheel-shape"
          d={path(current)}
          style={{ d: `path('${path(current)}')` }}
          fill={`url(#${lightId})`}
          stroke="var(--rz-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {CATEGORIES.map((c, i) => {
          const v = current[i]!;
          if (!v) return null;
          const p = point(i, v);
          return (
            <circle
              key={c.id}
              className="dw-wheel-dot"
              cx={p.x}
              cy={p.y}
              style={{ cx: p.x, cy: p.y }}
              r={focus.includes(c.id) ? 4.5 : 3}
              fill="var(--rz-accent)"
            />
          );
        })}
      </svg>
    </div>
  );
}
