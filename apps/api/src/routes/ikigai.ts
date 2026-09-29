/* ============================================================================
 * apps/api — routes/ikigai.ts
 * IKIGAI profiles: one draft (the wizard autosaves into it), one current and
 * an archived history. Completing a draft promotes it to current.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { createIkigaiDraftSchema, updateIkigaiSchema } from '@dreamward/shared';
import {
  completeIkigai,
  createIkigaiDraft,
  deleteIkigaiDraft,
  getIkigaiProfile,
  getIkigaiState,
  updateIkigai,
} from '../services/meaning';
import { sendMeaningError } from './chapters';

export default async function ikigaiRoutes(app: FastifyInstance) {
  app.get('/ikigai', async () => getIkigaiState());

  app.get('/ikigai/:id', async (req, reply) => {
    const profile = getIkigaiProfile((req.params as { id: string }).id);
    if (!profile) return reply.code(404).send({ error: 'not_found' });
    return profile;
  });

  app.post('/ikigai/draft', async (req, reply) => {
    const parsed = createIkigaiDraftSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    return reply.code(201).send(createIkigaiDraft(parsed.data.fromCurrent));
  });

  app.put('/ikigai/:id', async (req, reply) => {
    const parsed = updateIkigaiSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      return updateIkigai((req.params as { id: string }).id, parsed.data);
    } catch (err) {
      return sendMeaningError(reply, err);
    }
  });

  app.post('/ikigai/:id/complete', async (req, reply) => {
    try {
      return completeIkigai((req.params as { id: string }).id);
    } catch (err) {
      return sendMeaningError(reply, err);
    }
  });

  app.delete('/ikigai/:id', async (req, reply) => {
    try {
      deleteIkigaiDraft((req.params as { id: string }).id);
      return { ok: true };
    } catch (err) {
      return sendMeaningError(reply, err);
    }
  });
}
