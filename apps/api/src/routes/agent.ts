import type { FastifyInstance, FastifyReply } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { ikigaiSuggestSchema, pageContextSchema, type AgentSseEvent, type ProposalRow, type ProposalType } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import { getActiveProvider } from '../llm/providers';
import { runAgentTurn } from '../agent/loop';
import { WEEKLY_REVIEW_KICKOFF } from '../agent/prompts';
import { getOrCreateBriefing } from '../agent/briefing';
import { suggestIkigai } from '../agent/ikigaiSuggest';

/** Local 'YYYY-MM-DD' of the most recent Saturday (today if Saturday). */
function currentSaturday(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function writeSse(reply: FastifyReply, event: AgentSseEvent): void {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

export default async function agentRoutes(app: FastifyInstance) {
  /* ── Chat (SSE) ──────────────────────────────────────────────────────── */
  app.post('/agent/chat', async (req, reply) => {
    const body = req.body as { conversationId?: string; message?: string; pageContext?: unknown };
    const message = (body.message ?? '').trim();
    if (!message) return reply.code(400).send({ error: 'empty_message' });

    const provider = getActiveProvider();
    if (!provider) return reply.code(409).send({ error: 'no_active_provider' });

    const db = getDb();
    let conversationId = body.conversationId;
    let kickoff: string | undefined;
    if (conversationId) {
      const conv = db.select().from(schema.agentConversations).where(eq(schema.agentConversations.id, conversationId)).get();
      if (!conv) return reply.code(404).send({ error: 'conversation_not_found' });
      if (conv.kind === 'weekly_review') kickoff = WEEKLY_REVIEW_KICKOFF;
    } else {
      conversationId = uuid();
      db.insert(schema.agentConversations).values({ id: conversationId, kind: 'chat', createdAt: nowMs(), updatedAt: nowMs() }).run();
    }

    const pc = pageContextSchema.safeParse(body.pageContext);
    const pageContext = pc.success ? pc.data : undefined;

    // ── start SSE ──
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);
    const ac = new AbortController();
    // Detect a real client disconnect via the RESPONSE socket. (Listening on
    // req.raw 'close' fires as soon as the buffered POST body is read — which
    // would abort the stream before it even starts.)
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded) ac.abort();
    });

    try {
      await runAgentTurn({
        provider,
        conversationId: conversationId!,
        userMessage: message,
        pageContext,
        kickoff,
        emit: (e) => writeSse(reply, e),
        signal: ac.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      req.log.warn({ err }, 'agent chat failed');
      if (!ac.signal.aborted) writeSse(reply, { type: 'error', message: msg });
    } finally {
      clearInterval(ping);
      reply.raw.end();
    }
  });

  /* ── Conversations ───────────────────────────────────────────────────── */
  app.get('/agent/conversations', async () => {
    const db = getDb();
    return db.select().from(schema.agentConversations).orderBy(desc(schema.agentConversations.updatedAt)).all();
  });

  app.get('/agent/conversations/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const conv = db.select().from(schema.agentConversations).where(eq(schema.agentConversations.id, id)).get();
    if (!conv) return reply.code(404).send({ error: 'not_found' });
    const messages = db
      .select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.conversationId, id))
      .orderBy(schema.agentMessages.createdAt)
      .all()
      .filter((m) => m.role !== 'tool'); // tool rows are internal; UI shows chips live
    const props = db.select().from(schema.proposals).where(eq(schema.proposals.conversationId, id)).all();
    const proposalsByMsg: ProposalRow[] = props.map((r) => ({
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
    }));
    return { ...conv, messages, proposals: proposalsByMsg };
  });

  app.delete('/agent/conversations/:id', async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    db.delete(schema.agentConversations).where(eq(schema.agentConversations.id, id)).run();
    return { ok: true };
  });

  /* ── Briefing ────────────────────────────────────────────────────────── */
  app.get('/agent/briefing', async (_req, reply) => {
    const result = await getOrCreateBriefing(false);
    if ('error' in result) return reply.code(503).send(result);
    return result;
  });
  app.post('/agent/briefing/regenerate', async (_req, reply) => {
    const result = await getOrCreateBriefing(true);
    if ('error' in result) return reply.code(503).send(result);
    return result;
  });

  /* ── IKIGAI wizard suggestions (one-shot, nothing written) ───────────── */
  app.get('/agent/available', async () => ({ available: Boolean(getActiveProvider()) }));

  app.post('/agent/ikigai/suggest', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = ikigaiSuggestSchema.safeParse(body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const lang = body.lang === 'en' ? 'en' : 'he';
    const result = await suggestIkigai({ ...parsed.data, lang });
    if ('error' in result) return reply.code(result.error === 'no_active_provider' ? 409 : 503).send(result);
    return result;
  });

  /* ── Weekly review ───────────────────────────────────────────────────── */
  app.post('/agent/weekly-review/start', async () => {
    const db = getDb();
    const weekStart = currentSaturday();
    let review = db.select().from(schema.weeklyReviews).where(eq(schema.weeklyReviews.weekStart, weekStart)).get();
    if (review && review.status === 'in_progress' && review.conversationId) {
      return { reviewId: review.id, conversationId: review.conversationId, resumed: true };
    }
    const conversationId = uuid();
    db.insert(schema.agentConversations)
      .values({ id: conversationId, kind: 'weekly_review', title: `סקירה שבועית · ${weekStart}`, createdAt: nowMs(), updatedAt: nowMs() })
      .run();
    if (!review) {
      const id = uuid();
      db.insert(schema.weeklyReviews)
        .values({ id, weekStart, conversationId, status: 'in_progress', createdAt: nowMs() })
        .run();
      review = db.select().from(schema.weeklyReviews).where(eq(schema.weeklyReviews.id, id)).get()!;
    } else {
      db.update(schema.weeklyReviews).set({ conversationId, status: 'in_progress' }).where(eq(schema.weeklyReviews.id, review.id)).run();
    }
    return { reviewId: review.id, conversationId, resumed: false };
  });

  app.get('/agent/weekly-review/current', async () => {
    const db = getDb();
    const weekStart = currentSaturday();
    const review = db.select().from(schema.weeklyReviews).where(eq(schema.weeklyReviews.weekStart, weekStart)).get();
    const recent = db.select().from(schema.weeklyReviews).orderBy(desc(schema.weeklyReviews.createdAt)).limit(8).all();
    return { weekStart, current: review ?? null, history: recent };
  });
}
