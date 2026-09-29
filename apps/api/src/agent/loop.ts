/* ============================================================================
 * apps/api — agent/loop.ts
 * One agent turn: assemble context, stream the model, run tools (tools mode)
 * or extract ```json proposals (fallback mode). Emits AgentSseEvent objects
 * via the provided `emit` callback. Persists all messages.
 * ========================================================================= */
import { and, asc, eq } from 'drizzle-orm';
import type { AgentSseEvent, PageContext } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import { chatStream } from '../llm/dispatch';
import { persistToolsDetected, resolveToolSupport } from '../llm/providers';
import { LlmError, type ChatMessage, type ChatToolCall, type ProviderConfig } from '../llm/types';
import { buildDigest, tierForContext } from './digest';
import { buildSystemPrompt } from './prompts';
import { AGENT_TOOLS, executeTool } from './tools';
import { extractFallbackProposals } from './fallback';

const MAX_ITERATIONS = 6;
const HISTORY_CHAR_CAP = 12_000;

interface RunArgs {
  provider: ProviderConfig;
  conversationId: string;
  userMessage: string;
  pageContext?: PageContext;
  kickoff?: string;
  emit: (event: AgentSseEvent) => void;
  signal?: AbortSignal;
}

/** Load prior messages and map them to OpenAI chat format, capped by chars. */
function loadHistory(conversationId: string): ChatMessage[] {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.agentMessages)
    .where(eq(schema.agentMessages.conversationId, conversationId))
    .orderBy(asc(schema.agentMessages.createdAt))
    .all();

  const mapped: ChatMessage[] = rows.map((r) => {
    if (r.role === 'assistant') {
      const tc = (r.toolCalls as ChatToolCall[] | null) ?? undefined;
      return { role: 'assistant', content: r.content, ...(tc?.length ? { tool_calls: tc } : {}) };
    }
    if (r.role === 'tool') {
      return { role: 'tool', content: r.content, tool_call_id: r.toolCallId ?? '' };
    }
    return { role: 'user', content: r.content };
  });

  // trim oldest first to fit the cap (but keep whole messages)
  let total = mapped.reduce((n, m) => n + m.content.length, 0);
  while (total > HISTORY_CHAR_CAP && mapped.length > 1) {
    const dropped = mapped.shift()!;
    total -= dropped.content.length;
  }
  // a tool message must not be the first surviving message (orphaned tool_call_id)
  while (mapped.length && mapped[0]!.role === 'tool') mapped.shift();
  return mapped;
}

function persistMessage(
  conversationId: string,
  msg: {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCalls?: ChatToolCall[];
    toolCallId?: string;
    meta?: unknown;
  },
): void {
  const db = getDb();
  db.insert(schema.agentMessages)
    .values({
      id: uuid(),
      conversationId,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls ?? null,
      toolCallId: msg.toolCallId ?? null,
      meta: msg.meta ?? null,
      createdAt: nowMs(),
    })
    .run();
  db.update(schema.agentConversations)
    .set({ updatedAt: nowMs() })
    .where(eq(schema.agentConversations.id, conversationId))
    .run();
}

export async function runAgentTurn(args: RunArgs): Promise<void> {
  const { provider, conversationId, userMessage, pageContext, kickoff, emit, signal } = args;
  let useTools = resolveToolSupport(provider);
  const mode: 'tools' | 'fallback' = useTools ? 'tools' : 'fallback';

  emit({ type: 'meta', conversationId, mode, model: provider.model });

  // persist + record the user's message
  persistMessage(conversationId, { role: 'user', content: userMessage, meta: { pageContext } });
  // auto-title from first user message
  autoTitle(conversationId, userMessage);

  const tier = tierForContext(provider.contextLength);
  // tools mode → compact digest (tools fetch depth); fallback → tier-appropriate (more in prompt)
  const digestTier = useTools && tier === 'full' ? 'compact' : tier;

  const buildMessages = (toolsMode: boolean): ChatMessage[] => {
    const digest = buildDigest(toolsMode && tier === 'full' ? 'compact' : tier);
    const system = buildSystemPrompt({ mode: toolsMode ? 'tools' : 'fallback', digest, pageContext, kickoff });
    return [{ role: 'system', content: system }, ...loadHistory(conversationId)];
  };
  void digestTier;

  /* ── Fallback mode: single completion, extract proposals post-stream ───── */
  if (!useTools) {
    await runFallback(args, buildMessages(false));
    emit({ type: 'done' });
    return;
  }

  /* ── Tools mode: iterate until no tool calls (or downgrade on failure) ──── */
  let malformedStreak = 0;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let text = '';
    const toolCalls: ChatToolCall[] = [];
    try {
      for await (const ev of chatStream(provider, {
        messages: buildMessages(true),
        tools: AGENT_TOOLS,
        signal,
      })) {
        if (ev.type === 'text') {
          text += ev.delta;
          emit({ type: 'text_delta', delta: ev.delta });
        } else if (ev.type === 'tool_call') {
          toolCalls.push(ev.call);
        }
      }
    } catch (err) {
      if (err instanceof LlmError && err.looksLikeToolsUnsupported) {
        // provider rejects the tools param → downgrade for the rest of this turn
        persistToolsDetected(provider.id, false);
        useTools = false;
        emit({ type: 'tool_result', name: 'system', summary: 'מעבר למצב ללא כלים' });
        await runFallback(args, buildMessages(false));
        break;
      }
      throw err;
    }

    if (!toolCalls.length) {
      // plain assistant answer → done
      persistMessage(conversationId, { role: 'assistant', content: text, meta: { model: provider.model, mode } });
      break;
    }

    // persist the assistant turn (with its tool calls) before results
    persistMessage(conversationId, { role: 'assistant', content: text, toolCalls });

    // detect a model that emits malformed/empty tool calls repeatedly → downgrade
    const allBad = toolCalls.every((c) => !c.name);
    if (allBad && ++malformedStreak >= 2) {
      persistToolsDetected(provider.id, false);
      await runFallback(args, buildMessages(false));
      break;
    }

    for (const call of toolCalls) {
      emit({ type: 'tool_start', name: call.name, args: safeParse(call.arguments) });
      const outcome = executeTool(call.name, call.arguments, conversationId);
      persistMessage(conversationId, { role: 'tool', content: outcome.result, toolCallId: call.id });
      emit({ type: 'tool_result', name: call.name, summary: outcome.uiSummary });
      if (outcome.proposal) emit({ type: 'proposal', proposal: outcome.proposal });
    }
    // loop continues — model sees tool results next iteration
  }

  emit({ type: 'done' });
}

async function runFallback(args: RunArgs, messages: ChatMessage[]): Promise<void> {
  const { provider, conversationId, emit, signal } = args;
  let text = '';
  for await (const ev of chatStream(provider, { messages, signal })) {
    if (ev.type === 'text') {
      text += ev.delta;
      emit({ type: 'text_delta', delta: ev.delta });
    }
  }
  const { proposals } = extractFallbackProposals(text, conversationId);
  persistMessage(conversationId, { role: 'assistant', content: text, meta: { model: provider.model, mode: 'fallback' } });
  for (const proposal of proposals) emit({ type: 'proposal', proposal });
}

function autoTitle(conversationId: string, firstMessage: string): void {
  const db = getDb();
  const conv = db
    .select()
    .from(schema.agentConversations)
    .where(and(eq(schema.agentConversations.id, conversationId)))
    .get();
  if (conv && !conv.title) {
    db.update(schema.agentConversations)
      .set({ title: firstMessage.slice(0, 60) })
      .where(eq(schema.agentConversations.id, conversationId))
      .run();
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
