/* ============================================================================
 * apps/api — agent/ikigaiSuggest.ts
 * One-shot Clarity suggestions for the IKIGAI wizard: candidate items for a
 * circle, everyday joys, or draft statements. Grounded in the user's own
 * Dreamward digest. Nothing is written here — the user accepting a suggestion
 * chip in the wizard IS the approval.
 * ========================================================================= */
import { IKIGAI_CIRCLES, type IkigaiSuggestRequest } from '@dreamward/shared';
import { chatOnce } from '../llm/dispatch';
import { getActiveProvider } from '../llm/providers';
import { getCurrentIkigai, getIkigaiProfile } from '../services/meaning';
import { buildDigest } from './digest';
import { ikigaiToText } from './meaningText';

export type SuggestResult = { suggestions: string[] } | { error: 'no_active_provider' | 'empty_response' | string };

/** Extracts the first JSON string array from a model reply (tolerates prose / code fences). */
export function parseSuggestions(content: string, max: number): string[] {
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, max);
  } catch {
    return [];
  }
}

export async function suggestIkigai(req: IkigaiSuggestRequest & { lang?: 'en' | 'he' }): Promise<SuggestResult> {
  const provider = getActiveProvider();
  if (!provider) return { error: 'no_active_provider' };

  const profile = (req.profileId ? getIkigaiProfile(req.profileId) : null) ?? getCurrentIkigai();
  const sofar = profile ? ikigaiToText(profile) : '';
  const existing = profile?.items.map((i) => i.text) ?? [];
  const language = req.lang === 'en' ? 'English' : 'Hebrew';

  let task: string;
  let max = 5;
  if (req.mode === 'circle') {
    const c = IKIGAI_CIRCLES.find((x) => x.id === req.circle)!;
    task = `Suggest 5 short candidate answers (max 8 words each) to the IKIGAI question "${c.questionEn}" for this person.
Ground every suggestion in something concrete from their book below — vision, categories, goals, journal. Do not repeat these existing items: ${JSON.stringify(existing)}.`;
  } else if (req.mode === 'everyday') {
    task = `Suggest 5 "everyday ikigai" items for this person: small, concrete daily joys or reasons to get up in the morning (max 8 words each), in the spirit of the original Japanese meaning of ikigai. Ground them in their book below (especially what makes them happy).`;
  } else {
    max = 3;
    task = `Draft 3 alternative IKIGAI statements for this person — each 1-2 sentences, first person, warm and specific, synthesizing where what they love, what they are good at, what the world needs and what they can be paid for overlap. Base them on their IKIGAI work so far and their Dreamward.`;
  }

  const system = `You are Clarity, the personal assistant inside Dreamward, the user's life-vision book, who helps them see clearly what matters.
${task}
Write the suggestions in ${language}. Never invent facts that are not supported by the content.
Reply with ONLY a JSON array of strings, nothing else.

--- IKIGAI so far ---
${sofar || '(empty)'}

--- Their book ---
${buildDigest('compact').markdown}`;

  try {
    const { content } = await chatOnce(provider, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Suggestions please (JSON array only).' },
      ],
      maxTokens: 600,
      signal: AbortSignal.timeout(60_000),
    });
    const suggestions = parseSuggestions(content, max);
    if (!suggestions.length) return { error: 'empty_response' };
    return { suggestions };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
