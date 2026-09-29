import type { AgentSseEvent, PageContext } from '@dreamward/shared';

/**
 * POST /api/agent/chat and yield parsed SSE events. EventSource can't POST, so
 * we read the fetch body stream manually. A stateful TextDecoder is essential —
 * a UTF-8 (Hebrew) multibyte char can split across network chunks.
 */
export async function* streamAgentChat(
  body: { conversationId?: string | null; message: string; pageContext?: PageContext },
  signal: AbortSignal,
): AsyncGenerator<AgentSseEvent> {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let code = 'request_failed';
    try {
      code = (await res.json()).error ?? code;
    } catch {
      /* ignore */
    }
    yield { type: 'error', message: code };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

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
        if (!trimmed.startsWith('data:')) continue; // skip ': ping' comments
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        try {
          yield JSON.parse(data) as AgentSseEvent;
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }
}
