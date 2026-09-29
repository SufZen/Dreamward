/* ============================================================================
 * apps/api — routes/agentApi.ts
 * Agent-friendly endpoints for the /api/v1 surface. The regular section /
 * content-block routes expect TipTap HTML, which is hostile to LLM agents —
 * these accept markdown and reuse the same mutation services the proposal
 * executor uses (markdown → HTML conversion happens inside the services).
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '../db/client';
import {
  updateSectionContent,
  updateLifeVisionAnswer,
  updateContentBlock,
  createJournalEntry,
} from '../services/mutations';
import { searchContent } from '../agent/searchIndex';
import { buildDigest } from '../agent/digest';
import { controlSchema, getControlDb } from '../db/control';
import { APP_VERSION } from '../version';
import { bundledMigrations } from '../db/migrate';

const listItems = z.array(z.object({ text: z.string().min(1) }));

const sectionContentSchema = z.object({
  items: listItems.optional(),
  habits: listItems.optional(),
  leverages: listItems.optional(),
  bodyMarkdown: z.string().optional(),
  quote: z.string().optional(),
  quoteAuthor: z.string().optional(),
  // identity sections
  statement: z.string().optional(),
  states: listItems.optional(),
  standards: listItems.optional(),
  beliefShifts: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })).optional(),
});

const lifeVisionAnswerSchema = z.object({ answerMarkdown: z.string().min(1) });
const contentBlockSchema = z.object({ items: listItems.optional(), bodyMarkdown: z.string().optional() });
const journalMarkdownSchema = z.object({ title: z.string().nullable().optional(), bodyMarkdown: z.string().min(1) });

export default async function agentApiRoutes(app: FastifyInstance) {
  /** Who am I? — lets agents adapt (e.g. the MCP server hides write tools for read keys). */
  app.get('/whoami', async (req) => {
    const user = getControlDb()
      .select({ id: controlSchema.controlUsers.id, email: controlSchema.controlUsers.email })
      .from(controlSchema.controlUsers)
      .where(eq(controlSchema.controlUsers.id, req.uid!))
      .get();
    return {
      user: user ?? null,
      key: { name: req.apiKey?.name ?? null, scope: req.apiKey?.scope ?? 'read' },
      server: { version: APP_VERSION, schema: bundledMigrations().length },
    };
  });

  /**
   * The whole book as compact markdown — the same digest Lify reads. Ideal
   * context for an external agent (MCP resource dreamward://overview).
   */
  app.get('/overview', async (req) => {
    const { detail } = req.query as { detail?: string };
    const tier = detail === 'full' ? 'full' : detail === 'minimal' ? 'minimal' : 'compact';
    const digest = buildDigest(tier);
    return { markdown: digest.markdown, version: digest.version, detail: tier };
  });

  /** Full-text search across the whole dreamward (FTS5, same index Lify uses). */
  app.get('/search', async (req) => {
    const { q, limit } = req.query as { q?: string; limit?: string };
    if (!q?.trim()) return { hits: [] };
    return { hits: searchContent(q.trim(), Math.min(Number(limit) || 8, 25)) };
  });

  /** Latest cached morning briefing (read-only). */
  app.get('/briefings/latest', async (req, reply) => {
    const db = getDb();
    const row = db.select().from(schema.briefings).orderBy(desc(schema.briefings.briefingDate)).limit(1).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return row;
  });

  app.put('/sections/:id/content', async (req, reply) => {
    const parsed = sectionContentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      updateSectionContent({ sectionId: (req.params as { id: string }).id, ...parsed.data });
      return { ok: true };
    } catch (err) {
      return reply.code(404).send({ error: err instanceof Error ? err.message : 'not_found' });
    }
  });

  app.put('/life-vision/:id/answer', async (req, reply) => {
    const parsed = lifeVisionAnswerSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      updateLifeVisionAnswer({ promptId: (req.params as { id: string }).id, ...parsed.data });
      return { ok: true };
    } catch (err) {
      return reply.code(404).send({ error: err instanceof Error ? err.message : 'not_found' });
    }
  });

  app.put('/content-blocks/:id/content', async (req, reply) => {
    const parsed = contentBlockSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      updateContentBlock({ blockId: (req.params as { id: string }).id, ...parsed.data });
      return { ok: true };
    } catch (err) {
      return reply.code(404).send({ error: err instanceof Error ? err.message : 'not_found' });
    }
  });

  /** Create a journal entry from markdown (the JSON route expects TipTap HTML). */
  app.post('/journal/markdown', async (req, reply) => {
    const parsed = journalMarkdownSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = createJournalEntry(parsed.data);
    return reply.code(201).send({ id });
  });
}
