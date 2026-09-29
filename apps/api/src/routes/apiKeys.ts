/* ============================================================================
 * apps/api — routes/apiKeys.ts
 * Key management (cookie-auth, normal /api scope): create / list / revoke
 * personal API keys, plus the agent-activity feed the Settings page shows.
 * The raw token appears in exactly one response — the POST that creates it.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, getUid, schema } from '../db/client';
import { getControlDb, controlSchema, audit } from '../db/control';
import { generateApiKey, hashApiKey, displayPrefix } from '../lib/apiKeys';

const createKeySchema = z.object({
  name: z.string().min(1).max(80),
  scope: z.enum(['read', 'write']).default('read'),
});

function toPublic(row: typeof controlSchema.apiKeys.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    tokenPrefix: row.tokenPrefix,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  };
}

export default async function apiKeyRoutes(app: FastifyInstance) {
  app.get('/api-keys', async () => {
    const db = getControlDb();
    const rows = db
      .select()
      .from(controlSchema.apiKeys)
      .where(eq(controlSchema.apiKeys.userId, getUid()))
      .orderBy(desc(controlSchema.apiKeys.createdAt))
      .all();
    return rows.map(toPublic);
  });

  app.post('/api-keys', async (req, reply) => {
    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const uid = getUid();
    const token = generateApiKey();
    const db = getControlDb();
    const row = db
      .insert(controlSchema.apiKeys)
      .values({
        userId: uid,
        name: parsed.data.name,
        scope: parsed.data.scope,
        tokenHash: hashApiKey(token),
        tokenPrefix: displayPrefix(token),
      })
      .returning()
      .get();
    audit('apikey.created', { userId: uid, detail: { keyId: row.id, name: row.name, scope: row.scope }, ip: req.ip });
    // The raw token exists in this response only.
    return { token, key: toPublic(row) };
  });

  app.delete('/api-keys/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const uid = getUid();
    const db = getControlDb();
    const res = db
      .update(controlSchema.apiKeys)
      .set({ revokedAt: Date.now() })
      .where(and(eq(controlSchema.apiKeys.id, id), eq(controlSchema.apiKeys.userId, uid)))
      .run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    audit('apikey.revoked', { userId: uid, detail: { keyId: id }, ip: req.ip });
    return { ok: true };
  });

  /** Recent agent activity (per-user audit of /api/v1 mutations). */
  app.get('/agent-activity', async (req) => {
    const { limit, before } = req.query as { limit?: string; before?: string };
    const db = getDb();
    const max = Math.min(Number(limit) || 50, 200);
    const beforeTs = Number(before) || null;
    const rows = db
      .select()
      .from(schema.apiActivity)
      .where(beforeTs ? lt(schema.apiActivity.ts, beforeTs) : undefined)
      .orderBy(desc(schema.apiActivity.ts))
      .limit(max)
      .all();
    return rows;
  });
}
