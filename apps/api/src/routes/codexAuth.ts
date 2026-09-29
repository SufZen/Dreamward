/* ============================================================================
 * apps/api — routes/codexAuth.ts
 * "Sign in with ChatGPT" flow for the experimental Codex provider.
 * Mounted under /api (authenticated, per-user DB context). Disabled unless
 * CODEX_ENABLED=true.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { loadEnv } from '../env';
import { getDb, schema } from '../db/client';
import { encryptSecret } from '../lib/crypto';
import { uuid, nowMs } from '../lib/id';
import { startAuthFlow, completeAuthFlow, CODEX_DEFAULT_MODEL } from '../llm/codex/oauth';

export default async function codexAuthRoutes(app: FastifyInstance) {
  const env = loadEnv();

  app.get('/llm/codex/status', async () => ({ enabled: env.CODEX_ENABLED }));

  if (!env.CODEX_ENABLED) return;

  // Step 1 — mint a PKCE flow; the UI opens authUrl in a new tab.
  app.post('/llm/codex/start', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async () => {
    return startAuthFlow();
  });

  // Step 2 — the user pastes the localhost:1455 callback URL they landed on.
  app.post('/llm/codex/complete', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { flowId, callbackUrl } = (req.body ?? {}) as { flowId?: string; callbackUrl?: string };
    if (!flowId || !callbackUrl) return reply.code(400).send({ error: 'bad_request' });

    let tokens;
    try {
      tokens = await completeAuthFlow(flowId, callbackUrl);
    } catch (err) {
      req.log.warn({ err }, 'codex auth completion failed');
      return reply.code(400).send({ error: 'auth_failed', detail: (err as Error).message });
    }

    // One Codex provider per user — upsert by kind.
    const db = getDb();
    const existing = db.select().from(schema.llmProviders).where(eq(schema.llmProviders.kind, 'openai-codex')).get();
    const ts = nowMs();
    const oauthJson = encryptSecret(JSON.stringify(tokens));
    if (existing) {
      // Reconnect also heals deprecated model slugs (gpt-5.1/5.2 era).
      const staleModel = /^gpt-5\.[12]/.test(existing.model);
      db.update(schema.llmProviders)
        .set({ oauthJson, updatedAt: ts, ...(staleModel ? { model: CODEX_DEFAULT_MODEL } : {}) })
        .where(eq(schema.llmProviders.id, existing.id))
        .run();
      return { ok: true, providerId: existing.id, created: false };
    }
    const id = uuid();
    db.insert(schema.llmProviders)
      .values({
        id,
        name: 'ChatGPT (Codex)',
        kind: 'openai-codex',
        baseUrl: 'https://chatgpt.com/backend-api/codex',
        apiKey: null,
        oauthJson,
        model: CODEX_DEFAULT_MODEL,
        toolsMode: 'auto',
        toolsDetected: 1, // Responses API supports tools natively
        isActive: 0,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
    return { ok: true, providerId: id, created: true };
  });
}
