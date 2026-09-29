/* ============================================================================
 * apps/api — routes/setup.ts   (public, prefix /api/setup)
 *   GET  /status → { needsSetup }
 *   POST /       → { token, email, password } creates the admin + signs in
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../db/control';
import { SetupError, completeSetup, needsSetup } from '../services/setup';

const setupSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export default async function setupRoutes(app: FastifyInstance) {
  app.get('/status', async () => ({ needsSetup: needsSetup() }));

  app.post('/', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      const uid = await completeSetup(parsed.data.token, parsed.data.email, parsed.data.password);
      audit('setup.completed', { userId: uid, ip: req.ip });
      app.issueSession(reply, { uid, role: 'admin' });
      return { user: { id: uid, email: parsed.data.email.toLowerCase(), role: 'admin' } };
    } catch (err) {
      if (err instanceof SetupError) return reply.code(err.status).send({ error: err.code });
      throw err;
    }
  });
}
