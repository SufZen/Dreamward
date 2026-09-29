import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import type { ProposalRow, ProposalType } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { nowMs } from '../lib/id';
import { executeProposal } from '../services/proposalExecutor';

function toRow(r: typeof schema.proposals.$inferSelect): ProposalRow {
  return {
    id: r.id,
    conversationId: r.conversationId,
    type: r.type as ProposalType,
    payload: r.payload,
    summary: r.summary,
    status: r.status as ProposalRow['status'],
    error: r.error,
    resultRef: r.resultRef,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  };
}

export default async function proposalRoutes(app: FastifyInstance) {
  app.get('/proposals', async (req) => {
    const { status } = req.query as { status?: string };
    const db = getDb();
    let rows = db.select().from(schema.proposals).orderBy(desc(schema.proposals.createdAt)).all();
    const pendingCount = rows.filter((r) => r.status === 'pending').length;
    if (status) rows = rows.filter((r) => r.status === status);
    return { items: rows.map(toRow), pendingCount };
  });

  app.post('/proposals/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.select().from(schema.proposals).where(eq(schema.proposals.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    if (row.status !== 'pending') return reply.code(409).send({ error: 'already_resolved', status: row.status });

    try {
      const resultRef = executeProposal(row.type as ProposalType, row.payload, row.conversationId, row.id);
      db.update(schema.proposals)
        .set({ status: 'approved', resultRef, resolvedAt: nowMs() })
        .where(eq(schema.proposals.id, id))
        .run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      db.update(schema.proposals)
        .set({ status: 'failed', error: message, resolvedAt: nowMs() })
        .where(eq(schema.proposals.id, id))
        .run();
    }
    const updated = db.select().from(schema.proposals).where(eq(schema.proposals.id, id)).get()!;
    return toRow(updated);
  });

  app.post('/proposals/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const res = db
      .update(schema.proposals)
      .set({ status: 'rejected', resolvedAt: nowMs() })
      .where(eq(schema.proposals.id, id))
      .run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    const updated = db.select().from(schema.proposals).where(eq(schema.proposals.id, id)).get()!;
    return toRow(updated);
  });
}
