/* ============================================================================
 * Pure IKIGAI logic from @dreamward/shared: Venn regions (the anchors really
 * sit inside exactly their member circles), insights and completion rules —
 * plus the suggestion-reply parser.
 * ========================================================================= */
import { describe, it, expect } from 'vitest';
import {
  IKIGAI_CIRCLES,
  IKIGAI_CIRCLE_IDS,
  IKIGAI_RADIUS,
  ikigaiCompletionIssues,
  insightsFor,
  membershipKey,
  regionFor,
  type IkigaiCircle,
  type IkigaiItem,
} from '@dreamward/shared';
import { parseSuggestions } from '../agent/ikigaiSuggest';

/** Every non-empty subset of the four circles. */
const subsets: IkigaiCircle[][] = [];
for (let mask = 1; mask < 16; mask++) subsets.push(IKIGAI_CIRCLE_IDS.filter((_, i) => mask & (1 << i)));

const inside = (c: IkigaiCircle, x: number, y: number) => {
  const def = IKIGAI_CIRCLES.find((d) => d.id === c)!;
  return Math.hypot(x - def.cx, y - def.cy) < IKIGAI_RADIUS;
};

describe('regionFor', () => {
  it('has a region for every membership and none for the empty set', () => {
    for (const s of subsets) expect(regionFor(s)).not.toBeNull();
    expect(regionFor([])).toBeNull();
  });

  it('anchors exact regions inside exactly their member circles', () => {
    for (const s of subsets) {
      const r = regionFor(s)!;
      if (!r.exact) continue;
      for (const c of IKIGAI_CIRCLE_IDS) expect(inside(c, r.x, r.y), `${r.key} vs ${c}`).toBe(s.includes(c));
    }
  });

  it('marks only the opposite pairs as inexact', () => {
    const inexact = subsets.map((s) => regionFor(s)!).filter((r) => !r.exact).map((r) => r.key);
    expect(inexact.sort()).toEqual(['good+needs', 'love+paid']);
  });

  it('names the classic zones', () => {
    expect(regionFor(['good', 'love'])!.zone).toBe('passion');
    expect(regionFor(['love', 'needs'])!.zone).toBe('mission');
    expect(regionFor(['paid', 'needs'])!.zone).toBe('vocation');
    expect(regionFor(['good', 'paid'])!.zone).toBe('profession');
    expect(regionFor(['paid', 'needs', 'good', 'love'])!.zone).toBe('ikigai');
    expect(regionFor(['love'])!.zone).toBeNull();
  });

  it('canonicalizes keys', () => {
    expect(membershipKey(['paid', 'love', 'love'])).toBe('love+paid');
  });
});

describe('insightsFor', () => {
  const it_ = (circles: IkigaiCircle[]): IkigaiItem => ({ id: circles.join(), text: circles.join(), circles });

  it('flags empty circles and missing overlaps', () => {
    const kinds = insightsFor([it_(['love']), it_(['good'])]).map((i) => `${i.kind}:${i.circle ?? ''}`);
    expect(kinds).toEqual(['empty_circle:needs', 'empty_circle:paid', 'no_overlap:']);
  });

  it('reads the three-of-four combinations by the missing circle', () => {
    const insights = insightsFor([it_(['love', 'good', 'needs']), it_(['good', 'needs', 'paid'])]);
    expect(insights.filter((i) => i.kind === 'missing_one').map((i) => i.circle)).toEqual(['love', 'paid']);
    expect(insights.find((i) => i.circle === 'paid')!.textEn).toMatch(/no wealth/);
  });

  it('celebrates items in the centre', () => {
    const insights = insightsFor([it_(['love', 'good', 'needs', 'paid'])]);
    expect(insights).toEqual([expect.objectContaining({ kind: 'center', count: 1 })]);
  });
});

describe('ikigaiCompletionIssues', () => {
  it('requires every circle and a statement', () => {
    expect(ikigaiCompletionIssues({ items: [], statement: '  ' })).toHaveLength(5);
    expect(
      ikigaiCompletionIssues({
        items: [{ id: '1', text: 'x', circles: ['love', 'good', 'needs', 'paid'] }],
        statement: 'My ikigai',
      }),
    ).toEqual([]);
  });
});

describe('parseSuggestions', () => {
  it('extracts a JSON array from noisy replies and caps the count', () => {
    expect(parseSuggestions('Sure!\n```json\n["a", " b ", "", 3, "c"]\n```', 2)).toEqual(['a', 'b']);
    expect(parseSuggestions('no json here', 5)).toEqual([]);
    expect(parseSuggestions('[not json]', 5)).toEqual([]);
  });
});
