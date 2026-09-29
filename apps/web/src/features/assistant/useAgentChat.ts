import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PageContext, ProposalRow } from '@dreamward/shared';
import { api } from '@/lib/api';
import { streamAgentChat } from '@/lib/agentStream';

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposals: ProposalRow[];
  tools: string[];
  streaming?: boolean;
}

interface ConversationDetail {
  id: string;
  kind: string;
  messages: { id: string; role: string; content: string }[];
  proposals: ProposalRow[];
}

let localId = 0;
const nextId = () => `ui_${++localId}`;

export function useAgentChat(initialConversationId: string | null) {
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // load an existing conversation's history
  useEffect(() => {
    let cancelled = false;
    setConversationId(initialConversationId);
    if (!initialConversationId) {
      setMessages([]);
      return;
    }
    api
      .get<ConversationDetail>(`/agent/conversations/${initialConversationId}`)
      .then((conv) => {
        if (cancelled) return;
        const msgs: UiMessage[] = conv.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, proposals: [], tools: [] }));
        // attach all proposals to the last assistant message
        const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) lastAssistant.proposals = conv.proposals;
        setMessages(msgs);
      })
      .catch(() => setMessages([]));
    return () => {
      cancelled = true;
    };
  }, [initialConversationId]);

  const patchLastAssistant = useCallback((fn: (m: UiMessage) => void) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i]!.role === 'assistant') {
          const copy = { ...next[i]!, proposals: [...next[i]!.proposals], tools: [...next[i]!.tools] };
          fn(copy);
          next[i] = copy;
          break;
        }
      }
      return next;
    });
  }, []);

  const send = useCallback(
    async (text: string, pageContext?: PageContext) => {
      if (streaming || !text.trim()) return;
      const ac = new AbortController();
      abortRef.current = ac;
      setStreaming(true);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', content: text, proposals: [], tools: [] },
        { id: nextId(), role: 'assistant', content: '', proposals: [], tools: [], streaming: true },
      ]);

      let invalidated = false;
      try {
        for await (const ev of streamAgentChat({ conversationId, message: text, pageContext }, ac.signal)) {
          switch (ev.type) {
            case 'meta':
              setConversationId(ev.conversationId);
              break;
            case 'text_delta':
              patchLastAssistant((m) => {
                m.content += ev.delta;
              });
              break;
            case 'tool_start':
              patchLastAssistant((m) => {
                m.tools.push(ev.name);
              });
              break;
            case 'proposal':
              patchLastAssistant((m) => {
                m.proposals.push(ev.proposal);
              });
              if (!invalidated) {
                qc.invalidateQueries({ queryKey: ['proposals'] });
                invalidated = true;
              }
              break;
            case 'error':
              patchLastAssistant((m) => {
                m.content += `\n\n⚠️ ${ev.message}`;
              });
              break;
            case 'done':
              break;
          }
        }
      } catch {
        /* aborted or network error — leave partial content */
      } finally {
        patchLastAssistant((m) => {
          m.streaming = false;
        });
        setStreaming(false);
        abortRef.current = null;
        qc.invalidateQueries({ queryKey: ['agent-conversations'] });
      }
    },
    [conversationId, streaming, patchLastAssistant, qc],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Optimistically reflect a proposal resolution in the thread. */
  const markProposal = useCallback((id: string, status: ProposalRow['status']) => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        proposals: m.proposals.map((p) => (p.id === id ? { ...p, status } : p)),
      })),
    );
  }, []);

  return { conversationId, messages, streaming, send, stop, markProposal };
}
