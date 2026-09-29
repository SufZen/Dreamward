/* ============================================================================
 * apps/api — llm/codex/adapter.ts
 * Maps Dreamward's chat-completions-shaped agent loop onto ChatGPT's Codex
 * backend (Responses API, SSE). Emits the same StreamEvent union as
 * llm/client.ts so the loop/briefing/test code never knows the difference.
 * ========================================================================= */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../db/client';
import { encryptSecret } from '../../lib/crypto';
import { logUsage } from '../usage';
import { LlmError } from '../types';
import type { ChatMessage, ChatToolCall, ProviderConfig, StreamEvent, ToolDef } from '../types';
import {
  refreshTokens,
  CODEX_RESPONSES_URL,
  CODEX_ORIGINATOR,
  CODEX_BASE_INSTRUCTIONS,
  CODEX_KNOWN_MODELS,
  type CodexTokens,
} from './oauth';

interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

function parseTokens(provider: ProviderConfig): CodexTokens {
  if (!provider.oauthJson) throw new LlmError('codex provider has no OAuth tokens — reconnect ChatGPT', 401);
  return JSON.parse(provider.oauthJson) as CodexTokens;
}

function persistTokens(providerId: string, tokens: CodexTokens): void {
  getDb()
    .update(schema.llmProviders)
    .set({ oauthJson: encryptSecret(JSON.stringify(tokens)), updatedAt: Date.now() })
    .where(eq(schema.llmProviders.id, providerId))
    .run();
}

/**
 * chat-completions message list → Responses API input items. The Codex
 * backend validates `instructions` against its own base prompt, so system
 * messages travel INSIDE the input as a tagged first message instead.
 */
function toResponsesInput(messages: ChatMessage[]): { input: unknown[] } {
  let system: string | undefined;
  const input: unknown[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      system = system ? `${system}\n\n${m.content}` : m.content;
    } else if (m.role === 'user') {
      input.push({ type: 'message', role: 'user', content: [{ type: 'input_text', text: m.content }] });
    } else if (m.role === 'assistant') {
      if (m.content) {
        input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: m.content }] });
      }
      for (const tc of m.tool_calls ?? []) {
        input.push({ type: 'function_call', call_id: tc.id, name: tc.name, arguments: tc.arguments });
      }
    } else if (m.role === 'tool') {
      input.push({ type: 'function_call_output', call_id: m.tool_call_id, output: m.content });
    }
  }
  if (system) {
    input.unshift({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: `<system>\n${system}\n</system>` }],
    });
  }
  return { input };
}

function toResponsesTools(tools?: ToolDef[]): unknown[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: 'function',
    name: t.function.name,
    description: t.function.description,
    strict: false,
    parameters: t.function.parameters,
  }));
}

async function openStream(provider: ProviderConfig, tokens: CodexTokens, opts: ChatOptions): Promise<Response> {
  const { input } = toResponsesInput(opts.messages);
  const body: Record<string, unknown> = {
    model: provider.model,
    instructions: CODEX_BASE_INSTRUCTIONS,
    input,
    tools: toResponsesTools(opts.tools) ?? [],
    tool_choice: 'auto',
    parallel_tool_calls: false,
    store: false,
    stream: true,
  };

  const doFetch = () =>
    fetch(CODEX_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${tokens.accessToken}`,
        'chatgpt-account-id': tokens.accountId ?? '',
        'OpenAI-Beta': 'responses=experimental',
        originator: CODEX_ORIGINATOR,
        session_id: randomUUID(),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

  let res = await doFetch();
  if (res.status >= 400 && res.status < 500 && res.status !== 401) {
    const text = await res.text().catch(() => '');
    const lower = text.toLowerCase();
    // Backend revisions differ on `instructions` validation — retry once without it.
    if (lower.includes('instruction')) {
      delete body.instructions;
      res = await doFetch();
      if (res.ok) return res;
      const retryText = await res.text().catch(() => '');
      throw new LlmError(`codex backend returned ${res.status}`, res.status, retryText.slice(0, 500));
    }
    if (lower.includes('model')) {
      throw new LlmError(
        `Codex rejected model "${provider.model}" — set the provider model to one of: ${CODEX_KNOWN_MODELS.join(', ')}`,
        res.status,
        text.slice(0, 500),
      );
    }
    throw new LlmError(`codex backend returned ${res.status}`, res.status, text.slice(0, 500));
  }
  return res;
}

/**
 * Streaming chat against the Codex backend with one transparent token
 * refresh on 401 (refresh tokens rotate — the new bundle is persisted).
 */
export async function* codexChatStream(provider: ProviderConfig, opts: ChatOptions): AsyncGenerator<StreamEvent> {
  let tokens = parseTokens(provider);

  // Proactive refresh when the access token is (nearly) expired.
  if (tokens.expiresAt < Date.now() + 60_000) {
    tokens = await refreshTokens(tokens);
    persistTokens(provider.id, tokens);
  }

  let res = await openStream(provider, tokens, opts);
  if (res.status === 401) {
    tokens = await refreshTokens(tokens);
    persistTokens(provider.id, tokens);
    res = await openStream(provider, tokens, opts);
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new LlmError(`codex backend returned ${res.status}`, res.status, text.slice(0, 500));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finishReason: string | null = null;
  let outputChars = 0;
  const usageBox: { value: { input_tokens?: number; output_tokens?: number } | null } = { value: null };
  const toolCalls: ChatToolCall[] = [];

  const processData = function* (data: string): Generator<StreamEvent> {
    if (!data || data === '[DONE]') return;
    let ev: {
      type?: string;
      delta?: string;
      item?: { type?: string; call_id?: string; name?: string; arguments?: string };
      response?: { usage?: { input_tokens?: number; output_tokens?: number }; status?: string };
    };
    try {
      ev = JSON.parse(data);
    } catch {
      return;
    }
    switch (ev.type) {
      case 'response.output_text.delta':
        if (ev.delta) {
          outputChars += ev.delta.length;
          yield { type: 'text', delta: ev.delta };
        }
        break;
      case 'response.output_item.done':
        if (ev.item?.type === 'function_call' && ev.item.name) {
          toolCalls.push({
            id: ev.item.call_id ?? `call_${toolCalls.length + 1}`,
            name: ev.item.name,
            arguments: ev.item.arguments ?? '{}',
          });
        }
        break;
      case 'response.completed':
        usageBox.value = ev.response?.usage ?? null;
        finishReason = toolCalls.length ? 'tool_calls' : 'stop';
        break;
      case 'response.failed':
        finishReason = 'error';
        break;
    }
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
          if (trimmed.startsWith('data:')) yield* processData(trimmed.slice(5).trim());
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  for (const call of toolCalls) {
    outputChars += call.arguments.length;
    yield { type: 'tool_call', call };
  }

  const usage = usageBox.value;
  const promptTokens =
    usage?.input_tokens ?? Math.ceil(opts.messages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0) / 4);
  const completionTokens = usage?.output_tokens ?? Math.ceil(outputChars / 4);
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

/** Non-streaming variant (briefings + provider tests) built on the stream. */
export async function codexChatOnce(
  provider: ProviderConfig,
  opts: ChatOptions,
): Promise<{ content: string; toolCalls: ChatToolCall[]; finishReason: string | null }> {
  let content = '';
  const toolCalls: ChatToolCall[] = [];
  let finishReason: string | null = null;
  for await (const ev of codexChatStream(provider, opts)) {
    if (ev.type === 'text') content += ev.delta;
    else if (ev.type === 'tool_call') toolCalls.push(ev.call);
    else if (ev.type === 'done') finishReason = ev.finishReason;
  }
  return { content, toolCalls, finishReason };
}
