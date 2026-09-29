/* ============================================================================
 * apps/api — routes/ratings.ts
 * Life wheel: append-only "how close is today to my vision" ratings (1-10)
 * per category, with the honest current reality and the biggest gap.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { createRatingSchema } from '@dreamward/shared';
import { createRating, latestRatings, ratingHistory } from '../services/meaning';
import { sendMeaningError } from './chapters';

export default async function ratingRoutes(app: FastifyInstance) {
  app.get('/ratings/latest', async () => latestRatings());

  app.get('/ratings', async (req, reply) => {
    const { categoryId } = req.query as { categoryId?: string };
    if (!categoryId) return reply.code(400).send({ error: 'categoryId_required' });
    return ratingHistory(categoryId);
  });

  app.post('/ratings', async (req, reply) => {
    const parsed = createRatingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      return reply.code(201).send(createRating(parsed.data));
    } catch (err) {
      return sendMeaningError(reply, err);
    }
  });
}
