/* ============================================================================
 * apps/api — routes/onboarding.ts
 * The guided start's status (pending / dismissed / completed) plus progress
 * derived from the book. A web-only UI preference: registered for the cookie
 * /api surface only, never for /api/v1 — everything onboarding creates goes
 * through the chapter, rating and action routes agents already have.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { updateOnboardingSchema } from '@dreamward/shared';
import { getOnboarding, setOnboardingStatus } from '../services/onboarding';

export default async function onboardingRoutes(app: FastifyInstance) {
  app.get('/onboarding', async () => getOnboarding());

  app.put('/onboarding', async (req, reply) => {
    const parsed = updateOnboardingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    return setOnboardingStatus(parsed.data.status);
  });
}
