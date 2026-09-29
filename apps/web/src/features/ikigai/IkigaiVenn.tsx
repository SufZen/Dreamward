import {
  IKIGAI_CIRCLES,
  IKIGAI_RADIUS,
  IKIGAI_ZONES,
  regionFor,
  type IkigaiItem,
  type IkigaiRegion,
  type IkigaiZone,
} from '@dreamward/shared';
import { cn } from '@dreamward/design-system';
import { useLang, pickLabel, type Lang } from '@/lib/lang';

/** Circle-label positions, outside the circles (viewBox has a 40px margin). */
const CIRCLE_LABEL: Record<string, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }> = {
  love: { x: 300, y: 4, anchor: 'middle' },
  good: { x: -20, y: 52, anchor: 'start' },
  needs: { x: 620, y: 52, anchor: 'end' },
  paid: { x: 300, y: 606, anchor: 'middle' },
};

/** Zone labels sit a little outward from the item anchors. */
const ZONE_LABEL: Record<IkigaiZone, { x: number; y: number }> = {
  passion: { x: 160, y: 162 },
  mission: { x: 440, y: 162 },
  profession: { x: 160, y: 446 },
  vocation: { x: 440, y: 446 },
  ikigai: { x: 300, y: 300 },
};

const MAX_DOTS = 9;

/** Human name of a region: its classic zone, or its circles joined. */
export function regionName(region: IkigaiRegion, lang: Lang): string {
  if (region.zone) return pickLabel(lang, IKIGAI_ZONES[region.zone].labelEn, IKIGAI_ZONES[region.zone].labelHe);
  return region.key
    .split('+')
    .map((id) => {
      const c = IKIGAI_CIRCLES.find((x) => x.id === id)!;
      return pickLabel(lang, c.labelEn, c.labelHe);
    })
    .join(' + ');
}

/** Groups items by Venn region (membership key). */
export function groupByRegion(items: IkigaiItem[]) {
  const groups = new Map<string, { region: IkigaiRegion; items: IkigaiItem[] }>();
  for (const it of items) {
    const region = regionFor(it.circles);
    if (!region) continue;
    const g = groups.get(region.key) ?? { region, items: [] };
    g.items.push(it);
    groups.set(region.key, g);
  }
  return groups;
}

interface Props {
  items: IkigaiItem[];
  selected?: string | null;
  onSelect?: (regionKey: string | null) => void;
  /** compact variant: no circle labels (used beside the mapping step) */
  mini?: boolean;
  className?: string;
}

/**
 * The four-circle IKIGAI Venn. Items are drawn as dots clustered at the
 * anchor of their region (golden-angle spiral); click a cluster or zone
 * label to select that region.
 */
export function IkigaiVenn({ items, selected, onSelect, mini, className }: Props) {
  const { lang } = useLang();
  const groups = groupByRegion(items);
  const vb = mini ? '10 10 580 580' : '-40 -40 680 680';

  return (
    <div dir="ltr" className={cn('w-full', className)}>
      <svg viewBox={vb} className="mx-auto w-full" role="img" aria-label="IKIGAI diagram">
        {IKIGAI_CIRCLES.map((c) => (
          <circle
            key={c.id}
            cx={c.cx}
            cy={c.cy}
            r={IKIGAI_RADIUS}
            fill={c.color}
            fillOpacity={0.13}
            stroke={c.color}
            strokeOpacity={0.75}
            strokeWidth={2}
          />
        ))}

        {!mini &&
          IKIGAI_CIRCLES.map((c) => {
            const l = CIRCLE_LABEL[c.id]!;
            return (
              <text key={c.id} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={17} fontWeight={600} fill={c.color}>
                {pickLabel(lang, c.labelEn, c.labelHe)}
              </text>
            );
          })}

        {(Object.keys(IKIGAI_ZONES) as IkigaiZone[]).map((z) => {
          const l = ZONE_LABEL[z];
          const isCenter = z === 'ikigai';
          const key = IKIGAI_ZONES[z].circles.join('+');
          return (
            <text
              key={z}
              x={l.x}
              y={isCenter ? l.y - 34 : l.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isCenter ? 18 : mini ? 16 : 14}
              fontWeight={isCenter ? 800 : 600}
              className={cn(
                'fill-[color:var(--rz-fg-muted)]',
                isCenter && 'fill-[color:var(--rz-accent)]',
                onSelect && 'cursor-pointer',
              )}
              onClick={() => onSelect?.(selected === key ? null : key)}
            >
              {pickLabel(lang, IKIGAI_ZONES[z].labelEn, IKIGAI_ZONES[z].labelHe)}
            </text>
          );
        })}

        {[...groups.values()].map(({ region, items: its }) => {
          const isSel = selected === region.key;
          const shown = its.slice(0, MAX_DOTS);
          return (
            <g
              key={region.key}
              className={onSelect ? 'cursor-pointer' : undefined}
              onClick={() => onSelect?.(isSel ? null : region.key)}
            >
              <circle
                cx={region.x}
                cy={region.y}
                r={30}
                fill={isSel ? 'var(--rz-accent)' : 'transparent'}
                fillOpacity={isSel ? 0.18 : 0}
                stroke={isSel ? 'var(--rz-accent)' : 'none'}
                strokeWidth={1.5}
                strokeDasharray={region.exact ? undefined : '3 3'}
              />
              {shown.map((it, k) => {
                const a = k * 2.39996; // golden angle
                const r = 9 * Math.sqrt(k);
                const isCore = region.key === 'love+good+needs+paid';
                return (
                  <circle
                    key={it.id}
                    cx={region.x + r * Math.cos(a)}
                    cy={region.y + r * Math.sin(a)}
                    r={isCore ? 6.5 : 5}
                    fill={isCore ? 'var(--rz-accent)' : 'var(--rz-fg)'}
                    fillOpacity={isCore ? 1 : 0.75}
                    stroke="var(--rz-bg)"
                    strokeWidth={1.2}
                  >
                    <title>{it.text}</title>
                  </circle>
                );
              })}
              {its.length > MAX_DOTS && (
                <text x={region.x} y={region.y + 42} textAnchor="middle" fontSize={12} className="fill-[color:var(--rz-fg-muted)]">
                  +{its.length - MAX_DOTS}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
