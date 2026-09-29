import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { createProviderSchema, updateProviderSchema, type LlmProviderPublic } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import { testProvider } from '../llm/test';
import { toConfig } from '../llm/providers';
import { assertProviderUrlAllowed, UnsafeUrlError } from '../lib/urlGuard';
import { adapterFor } from '../llm/adapters';
import { LlmError } from '../llm/types';
import { and, gte, sql } from 'drizzle-orm';
import { controlSchema, getControlDb } from '../db/control';
import { z } from 'zod';

const listModelsSchema = z.object({ baseUrl: z.string().url(), apiKey: z.string().nullable().optional() });

function modelsError(err: unknown): { error: string; message: string } {
  if (err instanceof UnsafeUrlError) return { error: 'unsafe_url', message: err.message };
  if (err instanceof LlmError) return { error: 'provider_error', message: `HTTP ${err.status ?? '?'}: ${err.body || err.message}`.slice(0, 300) };
  return { error: 'provider_error', message: err instanceof Error ? err.message.slice(0, 300) : String(err) };
}

function mask(key: string | null): string | null {
  if (!key) return null;
  const plain = decryptSecret(key);
  return plain.length <= 6 ? '…' : `${plain.slice(0, 3)}…${plain.slice(-4)}`;
}

function toPublic(row: typeof schema.llmProviders.$inferSelect): LlmProviderPublic {
  return {
    id: row.id,
    name: row.name,
    kind: (row.kind ?? 'openai-compat') as LlmProviderPublic['kind'],
    baseUrl: row.baseUrl,
    apiKeyMasked: mask(row.apiKey),
    hasKey: !!row.apiKey,
    model: row.model,
    toolsMode: row.toolsMode as LlmProviderPublic['toolsMode'],
    toolsDetected: row.toolsDetected === null ? null : row.toolsDetected === 1,
    contextLength: row.contextLength,
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export default async function llmRoutes(app: FastifyInstance) {
  app.get('/llm/providers', async () => {
    const db = getDb();
    return db
      .select()
      .from(schema.llmProviders)
      .orderBy(desc(schema.llmProviders.createdAt))
      .all()
      .map(toPublic);
  });

  app.post('/llm/providers', async (req, reply) => {
    const parsed = createProviderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', detail: parsed.error.issues });
    try {
      await assertProviderUrlAllowed(parsed.data.baseUrl);
    } catch (err) {
      if (err instanceof UnsafeUrlError) return reply.code(400).send({ error: 'unsafe_url', message: err.message });
      throw err;
    }
    const db = getDb();
    const id = uuid();
    const ts = nowMs();
    const isFirst = db.select().from(schema.llmProviders).limit(1).all().length === 0;
    db.insert(schema.llmProviders)
      .values({
        id,
        name: parsed.data.name,
        baseUrl: parsed.data.baseUrl.replace(/\/+$/, ''),
        apiKey: parsed.data.apiKey ? encryptSecret(parsed.data.apiKey) : null,
        model: parsed.data.model,
        toolsMode: parsed.data.toolsMode ?? 'auto',
        contextLength: parsed.data.contextLength ?? null,
        isActive: isFirst ? 1 : 0, // first provider becomes active automatically
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
    const row = db.select().from(schema.llmProviders).where(eq(schema.llmProviders.id, id)).get()!;
    return toPublic(row);
  });

  app.patch('/llm/providers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateProviderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const existing = getDb().select().from(schema.llmProviders).where(eq(schema.llmProviders.id, id)).get();
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    // Kind-managed fields (e.g. Codex endpoint + OAuth tokens) can't be clobbered by the edit form.
    const editable = adapterFor(existing.kind).editableFields;
    const blocked = Object.keys(parsed.data).filter(
      (k) => !editable.includes(k) && (parsed.data as Record<string, unknown>)[k] !== undefined && (parsed.data as Record<string, unknown>)[k] !== '',
    );
    if (blocked.length) return reply.code(400).send({ error: 'not_editable', fields: blocked });
    if (parsed.data.baseUrl !== undefined) {
      try {
        await assertProviderUrlAllowed(parsed.data.baseUrl);
      } catch (err) {
        if (err instanceof UnsafeUrlError) return reply.code(400).send({ error: 'unsafe_url', message: err.message });
        throw err;
      }
    }
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: nowMs() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.baseUrl !== undefined) patch.baseUrl = parsed.data.baseUrl.replace(/\/+$/, '');
    if (parsed.data.model !== undefined) patch.model = parsed.data.model;
    if (parsed.data.toolsMode !== undefined) {
      patch.toolsMode = parsed.data.toolsMode;
      patch.toolsDetected = null; // re-probe on next test
    }
    if (parsed.data.contextLength !== undefined) patch.contextLength = parsed.data.contextLength;
    // empty string = keep existing key; null = clear; non-empty = replace
    if (parsed.data.apiKey !== undefined && parsed.data.apiKey !== '') {
      patch.apiKey = parsed.data.apiKey === null ? null : encryptSecret(parsed.data.apiKey);
      patch.toolsDetected = null;
    }
    const res = db.update(schema.llmProviders).set(patch).where(eq(schema.llmProviders.id, id)).run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    const row = db.select().from(schema.llmProviders).where(eq(schema.llmProviders.id, id)).get()!;
    return toPublic(row);
  });

  app.delete('/llm/providers/:id', async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    db.delete(schema.llmProviders).where(eq(schema.llmProviders.id, id)).run();
    return { ok: true };
  });

  app.post('/llm/providers/:id/activate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.select().from(schema.llmProviders).where(eq(schema.llmProviders.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    db.transaction((tx) => {
      tx.update(schema.llmProviders).set({ isActive: 0 }).run();
      tx.update(schema.llmProviders)
        .set({ isActive: 1, updatedAt: nowMs() })
        .where(eq(schema.llmProviders.id, id))
        .run();
    });
    return { ok: true };
  });

  /** Models offered by a saved provider (model picker). */
  app.get('/llm/providers/:id/models', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = getDb().select().from(schema.llmProviders).where(eq(schema.llmProviders.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    const config = toConfig(row);
    try {
      if (adapterFor(config.kind).userBaseUrl) await assertProviderUrlAllowed(config.baseUrl);
      return { models: await adapterFor(config.kind).listModels(config) };
    } catch (err) {
      return reply.code(502).send(modelsError(err));
    }
  });

  /** Models offered by an endpoint before it's saved (add-provider form). */
  app.post('/llm/models', async (req, reply) => {
    const parsed = listModelsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      await assertProviderUrlAllowed(parsed.data.baseUrl);
      return { models: await adapterFor('openai-compat').listModels({ baseUrl: parsed.data.baseUrl, apiKey: parsed.data.apiKey ?? null }) };
    } catch (err) {
      return reply.code(err instanceof UnsafeUrlError ? 400 : 502).send(modelsError(err));
    }
  });

  /** The signed-in user's own AI usage (tokens by day and model). */
  app.get('/llm/usage', async (req) => {
    const days = Math.min(Math.max(Number((req.query as { days?: string }).days) || 30, 1), 365);
    const since = Date.now() - days * 86_400_000;
    const u = controlSchema.aiUsage;
    const where = and(eq(u.userId, req.uid!), gte(u.ts, since));
    const control = getControlDb();
    const daily = control
      .select({
        day: sql<string>`strftime('%Y-%m-%d', ${u.ts} / 1000, 'unixepoch')`,
        promptTokens: sql<number>`sum(${u.promptTokens})`,
        completionTokens: sql<number>`sum(${u.completionTokens})`,
      })
      .from(u)
      .where(where)
      .groupBy(sql`1`)
      .orderBy(sql`1`)
      .all();
    const byModel = control
      .select({
        model: u.model,
        provider: u.providerName,
        promptTokens: sql<number>`sum(${u.promptTokens})`,
        completionTokens: sql<number>`sum(${u.completionTokens})`,
        calls: sql<number>`count(*)`,
      })
      .from(u)
      .where(where)
      .groupBy(u.model, u.providerName)
      .all();
    return { days, daily, byModel };
  });

  app.post('/llm/providers/:id/test', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.select().from(schema.llmProviders).where(eq(schema.llmProviders.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return testProvider(toConfig(row));
  });
}
