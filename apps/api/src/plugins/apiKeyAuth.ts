/* ============================================================================
 * apps/api — plugins/apiKeyAuth.ts
 * Bearer-token auth for the /api/v1 agent surface. Parallel to the cookie
 * session in plugins/auth.ts: resolves `Authorization: Bearer lbk_…` to a
 * uid + scope. API keys NEVER grant admin — req.role is hard-coded 'user'
 * (the tenant context only uses it for per-user paths, not privileges).
 * ========================================================================= */
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveApiKey, type ApiKeyScope } from '../lib/apiKeys';

export interface RequestApiKey {
  id: number;
  scope: ApiKeyScope;
  name: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    requireApiKey: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    apiKey?: RequestApiKey;
  }
}

export default fp(async (app) => {
  app.decorate('requireApiKey', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const resolved = token ? resolveApiKey(token) : null;
    if (!resolved) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    req.uid = resolved.uid;
    req.role = 'user'; // keys never grant admin
    req.apiKey = { id: resolved.keyId, scope: resolved.scope, name: resolved.name };
  });
});
