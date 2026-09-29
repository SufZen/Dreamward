/* ============================================================================
 * apps/api — llm/test.ts
 * Connection test: 1-token completion + (toolsMode=auto) a forced trivial
 * tool-call probe. Persists toolsDetected so the agent loop picks the right
 * mode without re-probing.
 * ========================================================================= */
import { chatOnce } from './dispatch';
import { adapterFor } from './adapters';
import { persistToolsDetected } from './providers';
import { LlmError, type ProviderConfig } from './types';

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  toolsDetected: boolean | null;
  error?: string;
}

export async function testProvider(provider: ProviderConfig): Promise<TestResult> {
  const started = Date.now();

  // 1) basic completion
  try {
    await chatOnce(provider, {
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      maxTokens: 5,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      toolsDetected: null,
      error: describe(err),
    };
  }
  const latencyMs = Date.now() - started;

  // 2) tools capability (only meaningful in auto mode). Kinds with native
  //    tool-calling (e.g. Codex / Responses API) are not probed — the generic
  //    OpenAI probe would hit the wrong endpoint and wrongly disable tools.
  let toolsDetected: boolean | null = null;
  if (provider.toolsMode === 'auto') {
    const adapter = adapterFor(provider.kind);
    toolsDetected = adapter.nativeTools ? true : adapter.probeTools ? await probeTools(provider) : null;
    if (toolsDetected !== null) persistToolsDetected(provider.id, toolsDetected);
  }

  return { ok: true, latencyMs, toolsDetected };
}

async function probeTools(provider: ProviderConfig): Promise<boolean> {
  try {
    const res = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: 'Call the ping tool now.' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'ping',
              description: 'Reply with pong',
              parameters: { type: 'object', properties: {}, additionalProperties: false },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'ping' } },
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(15_000),
      redirect: 'manual', // SSRF: no redirects to unchecked hosts
    });
    if (!res.ok) return false; // provider rejects the tools param
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { name?: string } }[] } }[];
    };
    const calls = json.choices?.[0]?.message?.tool_calls ?? [];
    return calls.some((c) => c.function?.name === 'ping');
  } catch {
    return false;
  }
}

function describe(err: unknown): string {
  if (err instanceof LlmError) {
    return `HTTP ${err.status ?? '?'}: ${err.body || err.message}`.slice(0, 300);
  }
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'timeout (10s) — השרת לא הגיב';
    if ('cause' in err && err.cause && typeof err.cause === 'object' && 'code' in err.cause) {
      return `connection failed: ${(err.cause as { code: string }).code}`;
    }
    return err.message.slice(0, 300);
  }
  return String(err).slice(0, 300);
}
