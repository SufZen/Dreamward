/* ============================================================================
 * apps/api — llm/usage.ts
 * Central per-user AI usage accounting (control.db). Called from the LLM
 * client itself so every chat path (agent loop, briefing, provider test) is
 * captured without touching call sites. The user id comes from the ambient
 * request context; usage outside a context (shouldn't happen) is dropped.
 * ========================================================================= */
import { getControlDb, controlSchema } from '../db/control';
import { getDbContext } from '../db/client';

export interface UsageRecord {
  providerName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** true when the provider sent no usage block and we estimated chars/4 */
  estimated: boolean;
}

/** Rough fallback when a provider omits the usage block (≈4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function logUsage(rec: UsageRecord): void {
  try {
    const uid = getDbContext().uid;
    getControlDb()
      .insert(controlSchema.aiUsage)
      .values({
        userId: uid,
        providerName: rec.providerName,
        model: rec.model,
        promptTokens: Math.max(0, Math.round(rec.promptTokens)),
        completionTokens: Math.max(0, Math.round(rec.completionTokens)),
        estimated: rec.estimated ? 1 : 0,
      })
      .run();
  } catch {
    // No request context or control DB unavailable — never break a chat for accounting.
  }
}
