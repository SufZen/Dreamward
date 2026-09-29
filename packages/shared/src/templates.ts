/* ============================================================================
 * @dreamward/shared — templates.ts
 * Pure layout functions: given N items and a canvas size, return placements.
 * Used both for "apply template" in the editor and "reflow" during export.
 * ========================================================================= */

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MoodboardTemplate {
  id: string;
  labelEn: string;
  labelHe: string;
  /** Suggested item count (layout still works for any count). */
  slots: number;
  layout: (count: number, w: number, h: number, gap?: number) => Placement[];
}

/** Even grid of `cols`×`rows` cells filling the canvas. */
function grid(cols: number, rows: number) {
  return (count: number, w: number, h: number, gap = 16): Placement[] => {
    const cellW = (w - gap * (cols + 1)) / cols;
    const cellH = (h - gap * (rows + 1)) / rows;
    const out: Placement[] = [];
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols) % rows;
      out.push({
        x: gap + c * (cellW + gap),
        y: gap + r * (cellH + gap),
        width: cellW,
        height: cellH,
      });
    }
    return out;
  };
}

export const TEMPLATES: MoodboardTemplate[] = [
  {
    id: 'single',
    labelEn: 'Single',
    labelHe: 'בודד',
    slots: 1,
    layout: (count, w, h, gap = 16) =>
      Array.from({ length: count }, () => ({ x: gap, y: gap, width: w - gap * 2, height: h - gap * 2 })),
  },
  { id: 'grid-2x2', labelEn: 'Grid 2×2', labelHe: 'גריד 2×2', slots: 4, layout: grid(2, 2) },
  { id: 'grid-3x2', labelEn: 'Grid 3×2', labelHe: 'גריד 3×2', slots: 6, layout: grid(3, 2) },
  { id: 'grid-3x3', labelEn: 'Grid 3×3', labelHe: 'גריד 3×3', slots: 9, layout: grid(3, 3) },
  { id: 'grid-4x3', labelEn: 'Grid 4×3', labelHe: 'גריד 4×3', slots: 12, layout: grid(4, 3) },
  {
    id: 'hero-left',
    labelEn: 'Hero + Side',
    labelHe: 'ראשי + צד',
    slots: 5,
    layout: (count, w, h, gap = 16) => {
      const out: Placement[] = [];
      const heroW = (w - gap * 3) * 0.6;
      out.push({ x: gap, y: gap, width: heroW, height: h - gap * 2 });
      const sideX = gap * 2 + heroW;
      const sideW = w - sideX - gap;
      const rest = Math.max(0, count - 1);
      const rows = Math.max(1, rest);
      const cellH = (h - gap * (rows + 1)) / rows;
      for (let i = 0; i < rest; i++) {
        out.push({ x: sideX, y: gap + i * (cellH + gap), width: sideW, height: cellH });
      }
      return out;
    },
  },
  {
    id: 'mosaic-5',
    labelEn: 'Mosaic 5',
    labelHe: 'פסיפס 5',
    slots: 5,
    layout: (count, w, h, gap = 16) => {
      // big top-left, two stacked right, two across bottom
      const colW = (w - gap * 3) / 3;
      const topH = (h - gap * 3) * 0.6;
      const botH = h - gap * 3 - topH;
      const cells: Placement[] = [
        { x: gap, y: gap, width: colW * 2 + gap, height: topH },
        { x: gap * 2 + colW * 2, y: gap, width: colW, height: (topH - gap) / 2 },
        { x: gap * 2 + colW * 2, y: gap + (topH - gap) / 2 + gap, width: colW, height: (topH - gap) / 2 },
        { x: gap, y: gap * 2 + topH, width: (w - gap * 3) / 2, height: botH },
        { x: gap * 2 + (w - gap * 3) / 2, y: gap * 2 + topH, width: (w - gap * 3) / 2, height: botH },
      ];
      return cells.slice(0, Math.max(count, 0)).concat(
        // overflow → fall back to a grid row below (rare)
        count > 5 ? grid(Math.min(count - 5, 4), 1)(count - 5, w, h * 0.2, gap) : [],
      );
    },
  },
];

export function getTemplate(id: string): MoodboardTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
