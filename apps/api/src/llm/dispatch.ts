/* ============================================================================
 * apps/api — llm/dispatch.ts
 * Entry point for every LLM call (agent loop, briefing, routines, IKIGAI
 * suggestions, provider test). Routes to the provider's adapter and re-checks
 * user-supplied base URLs at call time (defends against DNS rebinding after
 * the URL was validated on save).
 * ========================================================================= */
import type { ProviderConfig, StreamEvent } from './types';
import { adapterFor, type ChatOnceResult, type ChatOptions } from './adapters';
import { assertProviderUrlAllowed } from '../lib/urlGuard';

async function guard(provider: ProviderConfig): Promise<void> {
  if (adapterFor(provider.kind).userBaseUrl) await assertProviderUrlAllowed(provider.baseUrl);
}

export async function* chatStream(provider: ProviderConfig, opts: ChatOptions): AsyncGenerator<StreamEvent> {
  await guard(provider);
  yield* adapterFor(provider.kind).chatStream(provider, opts);
}

export async function chatOnce(provider: ProviderConfig, opts: ChatOptions): Promise<ChatOnceResult> {
  await guard(provider);
  return adapterFor(provider.kind).chatOnce(provider, opts);
}
