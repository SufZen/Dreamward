/* ============================================================================
 * apps/api — routes/chapters.ts
 * The Current Life Chapter: at most one active season, with focus and
 * maintenance categories, a "not now" list and the anti-vision.
 * ========================================================================= */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { closeChapterSchema, createChapterSchema, updateChapterSchema } from '@dreamward/shared';
import {
  MeaningError,
  closeChapter,
  createChapter,
  getActiveChapter,
  getChapter,
  listChapters,
  updateChapter,
} from '../services/meaning';

export function sendMeaningError(reply: FastifyReply, err: unknown) {
  if (err instanceof MeaningError) return reply.code(err.status).send({ error: err.code, details: err.details });
  throw err;
}

export default async function chapterRoutes(app: FastifyInstance) {
  app.get('/chapters', async () => listChapters());

  // Declared before /chapters/:id so 'current' isn't captured as an id.
  app.get('/chapters/current', async () => ({ chapter: getActiveChapter() }));

  app.get('/chapters/:id', async (req, reply) => {
    const chapter = getChapter((req.params as { id: string }).id);
    if (!chapter) return reply.code(404).send({ error: 'not_found' });
    return chapter;
  });

  app.post('/chapters', async (req, reply) => {
    const parsed = createChapterSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    return reply.code(201).send(createChapter(parsed.data));
  });

  app.put('/chapters/:id', async (req, reply) => {
    const parsed = updateChapterSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      return updateChapter((req.params as { id: string }).id, parsed.data);
    } catch (err) {
      return sendMeaningError(reply, err);
    }
  });

  app.post('/chapters/:id/close', async (req, reply) => {
    const parsed = closeChapterSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      return closeChapter((req.params as { id: string }).id, parsed.data.closingReflection);
    } catch (err) {
      return sendMeaningError(reply, err);
    }
  });
}
