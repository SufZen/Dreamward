/* ============================================================================
 * apps/api — agent/fallback.ts
 * No-tools mode: extract ```json {"proposals":[...]} blocks from the
 * assistant's completed text, validate with the SAME shared schemas, and
 * insert proposal rows — identical downstream UX to the propose tool.
 * ========================================================================= */
import { proposalEnvelopeSchema, type ProposalRow } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';

const FENCE_RE = /```(?:json)?\s*\n?([\s\S]*?)```/g;

export interface FallbackExtraction {
  proposals: ProposalRow[];
  /** assistant text with the consumed proposal blocks removed */
  cleanedText: string;
}

export function extractFallbackProposals(text: string, conversationId: string): FallbackExtraction {
  const proposals: ProposalRow[] = [];
  const db = getDb();

  const cleanedText = text
    .replace(FENCE_RE, (full, inner: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(inner.trim());
      } catch {
        return full; // not JSON — keep the block (could be a code sample)
      }
      const list = (parsed as { proposals?: unknown[] })?.proposals;
      if (!Array.isArray(list)) return full; // some other JSON — keep it

      for (const item of list) {
        const env = proposalEnvelopeSchema.safeParse(item);
        if (!env.success) continue; // skip invalid entries silently — model gets no retry loop here
        const id = uuid();
        const ts = nowMs();
        db.insert(schema.proposals)
          .values({
            id,
            conversationId,
            type: env.data.type,
            payload: env.data.payload,
            summary: env.data.summary,
            status: 'pending',
            createdAt: ts,
          })
          .run();
        proposals.push({
          id,
          conversationId,
          type: env.data.type,
          payload: env.data.payload,
          summary: env.data.summary,
          status: 'pending',
          error: null,
          resultRef: null,
          createdAt: ts,
          resolvedAt: null,
        });
      }
      return ''; // consume the block from the rendered text
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { proposals, cleanedText };
}
