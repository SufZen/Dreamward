/* ============================================================================
 * apps/api — agent/onboardingSuggest.ts
 * One-shot Clarity suggestions for the guided start's last step: three small
 * first moves grounded in the new chapter, its focus areas and their gaps.
 * Nothing is written here — the user picking a suggestion and saving the
 * action IS the approval.
 * ========================================================================= */
import { chatOnce } from '../llm/dispatch';
import { getActiveProvider } from '../llm/providers';
import { buildDigest } from './digest';
import { parseSuggestions, type SuggestResult } from './ikigaiSuggest';

export async function suggestFirstMove(lang: 'en' | 'he'): Promise<SuggestResult> {
  const provider = getActiveProvider();
  if (!provider) return { error: 'no_active_provider' };
  const language = lang === 'en' ? 'English' : 'Hebrew';

  const system = `You are Clarity, the personal assistant inside Dreamward, the user's life-vision book, who helps them see clearly what matters.
The user has just named their current life chapter, rated their life wheel and chosen their focus areas.
Suggest 3 first moves: concrete actions they can do within the next week (max 10 words each).
Prefer the smallest move with the highest leverage — easy, enjoyable, in a focus area, and aimed at the biggest gap they named.
Write the suggestions in ${language}. Never invent facts that are not supported by the content.
Reply with ONLY a JSON array of strings, nothing else.

--- Their book ---
${buildDigest('compact').markdown}`;

  try {
    const { content } = await chatOnce(provider, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Suggestions please (JSON array only).' },
      ],
      maxTokens: 400,
      signal: AbortSignal.timeout(60_000),
    });
    const suggestions = parseSuggestions(content, 3);
    if (!suggestions.length) return { error: 'empty_response' };
    return { suggestions };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
