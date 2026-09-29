/* ============================================================================
 * apps/api — llm/adapters.ts
 * Provider adapters, keyed by provider `kind`. Adding a provider family
 * (e.g. native Anthropic Messages, Gemini) = one adapter + one registry line;
 * the agent loop, briefing, routines and provider test stay kind-agnostic.
 * ========================================================================= */
import type { ChatMessage, ChatToolCall, ProviderConfig, StreamEvent, ToolDef } from './types';
import { LlmError } from './types';
import { chatOnce as openaiChatOnce, chatStream as openaiChatStream } from './client';
import { codexChatOnce, codexChatStream } from './codex/adapter';
import { CODEX_KNOWN_MODELS } from './codex/oauth';

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatOnceResult {
  content: string;
  toolCalls: ChatToolCall[];
  finishReason: string | null;
}

export interface ModelInfo {
  id: string;
  contextLength: number | null;
}

export type ProviderKind = ProviderConfig['kind'];

export interface LlmAdapter {
  kind: ProviderKind;
  chatStream(provider: ProviderConfig, opts: ChatOptions): AsyncGenerator<StreamEvent>;
  chatOnce(provider: ProviderConfig, opts: ChatOptions): Promise<ChatOnceResult>;
  listModels(provider: Pick<ProviderConfig, 'baseUrl' | 'apiKey'>): Promise<ModelInfo[]>;
  /** the base URL comes from the user (→ SSRF guard applies) */
  userBaseUrl: boolean;
  /** the generic OpenAI tools probe is meaningful for this kind */
  probeTools: boolean;
  /** tool-calling is known to work (no probe needed) */
  nativeTools: boolean;
  /** fields a user may edit on an existing provider of this kind */
  editableFields: readonly string[];
}

/** GET {baseUrl}/models (OpenAI-compatible; OpenRouter adds context_length). */
async function listOpenAiModels(provider: Pick<ProviderConfig, 'baseUrl' | 'apiKey'>): Promise<ModelInfo[]> {
  const res = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/models`, {
    headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
    signal: AbortSignal.timeout(15_000),
    redirect: 'manual', // SSRF: never follow a redirect to an unchecked (e.g. internal) host
  });
  if (!res.ok) throw new LlmError(`models request failed`, res.status, (await res.text()).slice(0, 300));
  const json = (await res.json()) as {
    data?: { id?: string; context_length?: number; top_provider?: { context_length?: number } }[];
    models?: { name?: string; model?: string }[]; // some local servers
  };
  const rows = json.data ?? json.models?.map((m) => ({ id: m.model ?? m.name })) ?? [];
  return rows
    .filter((m): m is { id: string; context_length?: number; top_provider?: { context_length?: number } } => typeof m.id === 'string')
    .map((m) => ({ id: m.id, contextLength: m.context_length ?? m.top_provider?.context_length ?? null }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

const openaiCompat: LlmAdapter = {
  kind: 'openai-compat',
  chatStream: openaiChatStream,
  chatOnce: openaiChatOnce,
  listModels: listOpenAiModels,
  userBaseUrl: true,
  probeTools: true,
  nativeTools: false,
  editableFields: ['name', 'baseUrl', 'apiKey', 'model', 'toolsMode', 'contextLength'],
};

const openaiCodex: LlmAdapter = {
  kind: 'openai-codex',
  chatStream: codexChatStream,
  chatOnce: codexChatOnce,
  listModels: async () => CODEX_KNOWN_MODELS.map((id) => ({ id, contextLength: null })),
  userBaseUrl: false,
  probeTools: false,
  nativeTools: true,
  // The endpoint and OAuth tokens are managed by the sign-in flow.
  editableFields: ['name', 'model', 'toolsMode', 'contextLength'],
};

const REGISTRY: Record<ProviderKind, LlmAdapter> = {
  'openai-compat': openaiCompat,
  'openai-codex': openaiCodex,
};

export function adapterFor(kind: ProviderKind | string | null | undefined): LlmAdapter {
  return REGISTRY[(kind ?? 'openai-compat') as ProviderKind] ?? openaiCompat;
}
