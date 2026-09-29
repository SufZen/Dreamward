/* ============================================================================
 * apps/api — llm/types.ts
 * Minimal OpenAI-compatible chat types shared by the client + agent loop.
 * ========================================================================= */

export interface ChatToolCall {
  id: string;
  name: string;
  /** raw JSON string as accumulated from the stream */
  arguments: string;
}

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; call: ChatToolCall }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; finishReason: string | null };

export interface ProviderConfig {
  id: string;
  name: string;
  kind: 'openai-compat' | 'openai-codex';
  baseUrl: string;
  apiKey: string | null;
  model: string;
  toolsMode: 'auto' | 'on' | 'off';
  toolsDetected: number | null;
  contextLength: number | null;
  /** decrypted OAuth bundle JSON (kind=openai-codex only) */
  oauthJson?: string | null;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: string,
  ) {
    super(message);
  }
  /** heuristics: does this error indicate the provider rejects the tools param? */
  get looksLikeToolsUnsupported(): boolean {
    const text = `${this.message} ${this.body ?? ''}`.toLowerCase();
    return (
      this.status !== undefined &&
      this.status >= 400 &&
      this.status < 500 &&
      (text.includes('tool') || text.includes('function'))
    );
  }
}
