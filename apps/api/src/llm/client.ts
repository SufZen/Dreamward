/* ============================================================================
 * apps/api — llm/client.ts
 * Provider-agnostic OpenAI-compatible chat client: plain fetch + SSE parser.
 * Deliberately NOT the `openai` npm package — Lemonade/Ollama/OpenRouter free
 * models each deviate from OpenAI exactness; raw fetch owns the tolerance.
 * ========================================================================= */
import type { ChatMessage, ChatToolCall, ProviderConfig, StreamEvent, ToolDef } from './types';
import { LlmError } from './types';
import { logUsage, estimateTokens } from './usage';

/** Total characters across a message list — basis for token estimation. */
function messageChars(messages: ChatMessage[]): number {
  return messages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0);
}

interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function buildHeaders(provider: ProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;
  // OpenRouter app attribution — only sent to OpenRouter itself.
  if (/(^|\.)openrouter\.ai$/i.test(safeHost(provider.baseUrl))) {
    headers['HTTP-Referer'] = 'https://github.com/SufZen/Dreamward';
    headers['X-Title'] = 'Dreamward';
  }
  return headers;
}

function buildBody(provider: ProviderConfig, opts: ChatOptions, stream: boolean, withUsage = true) {
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: opts.messages.map((m) =>
      m.role === 'assistant' && m.tool_calls?.length
        ? {
            role: 'assistant',
            content: m.content || null,
            tool_calls: m.tool_calls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            })),
          }
        : m,
    ),
    stream,
  };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  // Ask streaming providers to attach a usage block to the final chunk.
  // Quirky providers that reject the param get one retry without it.
  if (stream && withUsage) body.stream_options = { include_usage: true };
  return body;
}

const url = (provider: ProviderConfig) =>
  `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;

/** Non-streaming completion (used by the connection test + briefing). */
export async function chatOnce(
  provider: ProviderConfig,
  opts: ChatOptions,
): Promise<{ content: string; toolCalls: ChatToolCall[]; finishReason: string | null }> {
  const res = await fetch(url(provider), {
    method: 'POST',
    headers: buildHeaders(provider),
    body: JSON.stringify(buildBody(provider, opts, false)),
    signal: opts.signal ?? AbortSignal.timeout(120_000),
    redirect: 'manual', // SSRF: the URL was checked, a redirect target would not be
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LlmError(`provider returned ${res.status}`, res.status, body.slice(0, 500));
  }
  const json = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
      };
      finish_reason?: string | null;
    }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = json.choices?.[0];
  const toolCalls: ChatToolCall[] = (choice?.message?.tool_calls ?? []).map((tc, i) => ({
    id: tc.id ?? `call_${i}`,
    name: tc.function?.name ?? '',
    arguments: tc.function?.arguments ?? '{}',
  }));
  const content = choice?.message?.content ?? '';
  if (json.usage?.prompt_tokens != null || json.usage?.completion_tokens != null) {
    logUsage({
      providerName: provider.name,
      model: provider.model,
      promptTokens: json.usage.prompt_tokens ?? 0,
      completionTokens: json.usage.completion_tokens ?? 0,
      estimated: false,
    });
  } else {
    logUsage({
      providerName: provider.name,
      model: provider.model,
      promptTokens: Math.ceil(messageChars(opts.messages) / 4),
      completionTokens: estimateTokens(content),
      estimated: true,
    });
  }
  return {
    content,
    toolCalls,
    finishReason: choice?.finish_reason ?? null,
  };
}

/**
 * Streaming chat. Yields text deltas as they arrive; tool-call argument
 * fragments are accumulated per index and complete calls are yielded at the
 * end of the stream (weak providers interleave fragments unpredictably —
 * end-of-stream assembly is the only robust point).
 */
export async function* chatStream(
  provider: ProviderConfig,
  opts: ChatOptions,
): AsyncGenerator<StreamEvent> {
  let res = await fetch(url(provider), {
    method: 'POST',
    headers: buildHeaders(provider),
    body: JSON.stringify(buildBody(provider, opts, true)),
    signal: opts.signal,
    redirect: 'manual',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Quirky providers reject stream_options entirely — retry once without it.
    if (res.status >= 400 && res.status < 500 && body.toLowerCase().includes('stream_options')) {
      res = await fetch(url(provider), {
        method: 'POST',
        headers: buildHeaders(provider),
        body: JSON.stringify(buildBody(provider, opts, true, false)),
        signal: opts.signal,
        redirect: 'manual',
      });
    }
    if (!res.ok) {
      throw new LlmError(`provider returned ${res.status}`, res.status, body.slice(0, 500));
    }
  }
  if (!res.body) {
    throw new LlmError(`provider returned ${res.status} with empty body`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8'); // stateful — multibyte may split across chunks
  let buffer = '';
  let finishReason: string | null = null;
  // box, not a plain let — TS keeps closure-assigned lets narrowed to their initial null
  const usageBox: { value: { prompt_tokens?: number; completion_tokens?: number } | null } = { value: null };
  let outputChars = 0;

  // accumulate tool-call deltas by index
  const pending = new Map<number, { id: string; name: string; arguments: string }>();

  const processData = function* (data: string): Generator<StreamEvent> {
    if (data === '[DONE]') return;
    let chunk: {
      choices?: {
        delta?: {
          content?: string | null;
          tool_calls?: {
            index?: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }[];
        };
        finish_reason?: string | null;
      }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
    };
    try {
      chunk = JSON.parse(data);
    } catch {
      return; // tolerate malformed keep-alives from quirky providers
    }
    if (chunk.usage) usageBox.value = chunk.usage; // final chunk when include_usage is honored
    const choice = chunk.choices?.[0];
    if (!choice) return;
    const delta = choice.delta;
    if (delta?.content) {
      outputChars += delta.content.length;
      yield { type: 'text', delta: delta.content };
    }
    for (const tc of delta?.tool_calls ?? []) {
      const idx = tc.index ?? 0;
      const acc = pending.get(idx) ?? { id: '', name: '', arguments: '' };
      if (tc.id) acc.id = tc.id;
      if (tc.function?.name) acc.name += tc.function.name;
      if (tc.function?.arguments) acc.arguments += tc.function.arguments;
      pending.set(idx, acc);
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of frame.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue; // skip comments / event: lines
          yield* processData(trimmed.slice(5).trim());
        }
      }
    }
    // flush any trailing frame without final \n\n (some providers)
    for (const line of buffer.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) yield* processData(trimmed.slice(5).trim());
    }
  } finally {
    reader.releaseLock();
  }

  // emit assembled tool calls in index order
  const calls = [...pending.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  let callIdx = 0;
  for (const c of calls) {
    callIdx++;
    if (!c.name) continue;
    outputChars += c.arguments.length;
    yield {
      type: 'tool_call',
      call: { id: c.id || `call_${callIdx}`, name: c.name, arguments: c.arguments || '{}' },
    };
  }

  // Account the round-trip: provider-reported usage when available, chars/4 otherwise.
  const usage = usageBox.value;
  const promptTokens = usage?.prompt_tokens ?? Math.ceil(messageChars(opts.messages) / 4);
  const completionTokens = usage?.completion_tokens ?? Math.ceil(outputChars / 4);
  logUsage({
    providerName: provider.name,
    model: provider.model,
    promptTokens,
    completionTokens,
    estimated: !usage,
  });
  yield { type: 'usage', usage: { promptTokens, completionTokens } };
  yield { type: 'done', finishReason };
}
