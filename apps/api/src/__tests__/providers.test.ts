/* ============================================================================
 * Bring-your-own AI: model discovery, provider DTO kind, kind-managed fields,
 * outbound headers, and per-user usage — against a local fake
 * OpenAI-compatible server.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'dreamward-providers-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = root;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.KEY_ENCRYPTION_SECRET = 'test-key-encryption-secret-123456';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { closeControlDb, getControlDb, controlSchema } = await import('../db/control');
const { closeAllUserDbs, runAsUser } = await import('../db/registry');
const { getDb, schema } = await import('../db/client');
const { adapterFor } = await import('../llm/adapters');
const { chatOnce } = await import('../llm/dispatch');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let cookie: string;
let fake: Server;
let fakeUrl: string;
const seenHeaders: IncomingHttpHeaders[] = [];
const seenUrls: string[] = [];

beforeAll(async () => {
  fake = createServer((req, res) => {
    seenHeaders.push(req.headers);
    seenUrls.push(req.url ?? '');
    res.setHeader('Content-Type', 'application/json');
    // A provider URL that bounces elsewhere (e.g. to an internal service).
    if (req.url?.startsWith('/bounce/')) {
      res.statusCode = 302;
      res.setHeader('Location', `/v1/${req.url.slice('/bounce/'.length)}`);
      return res.end();
    }
    if (req.url === '/v1/models') {
      if (req.headers.authorization !== 'Bearer sk-good') {
        res.statusCode = 401;
        return res.end('{"error":"bad key"}');
      }
      return res.end(JSON.stringify({ data: [{ id: 'zeta-model' }, { id: 'alpha-model', context_length: 128000 }] }));
    }
    if (req.url === '/v1/chat/completions') {
      return res.end(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1 } }));
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise<void>((r) => fake.listen(0, '127.0.0.1', () => r()));
  fakeUrl = `http://127.0.0.1:${(fake.address() as { port: number }).port}/v1`;

  ({ app } = await buildServer());
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.local', password: 'admin-pass-123' },
  });
  cookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((r) => fake.close(() => r()));
  closeAllUserDbs();
  closeControlDb();
  rmSync(root, { recursive: true, force: true });
});

const api = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api${url}`, headers: { cookie }, payload: payload as object | undefined });

describe('model discovery', () => {
  it('lists models of an endpoint before saving (sorted, with context length)', async () => {
    const res = await api('POST', '/llm/models', { baseUrl: fakeUrl, apiKey: 'sk-good' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      models: [
        { id: 'alpha-model', contextLength: 128000 },
        { id: 'zeta-model', contextLength: null },
      ],
    });
  });

  it('reports provider errors clearly', async () => {
    const res = await api('POST', '/llm/models', { baseUrl: fakeUrl, apiKey: 'sk-bad' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'provider_error', message: expect.stringContaining('401') });
  });

  it('never follows a redirect from the provider URL (SSRF)', async () => {
    const bounce = fakeUrl.replace(/\/v1$/, '/bounce');
    seenUrls.length = 0;
    const res = await api('POST', '/llm/models', { baseUrl: bounce, apiKey: 'sk-good' });
    expect(res.statusCode).toBe(502);
    await expect(
      runAsUser(1, 'admin', () =>
        chatOnce(
          { id: 'x', name: 'x', kind: 'openai-compat', baseUrl: bounce, apiKey: 'sk-good', model: 'alpha-model', toolsMode: 'off', toolsDetected: null, contextLength: null },
          { messages: [{ role: 'user', content: 'hi' }], maxTokens: 5 },
        ),
      ),
    ).rejects.toThrow();
    expect(seenUrls.some((u) => u.startsWith('/v1/'))).toBe(false);
  });

  it('lists models of a saved provider and exposes its kind', async () => {
    const created = (await api('POST', '/llm/providers', { name: 'Fake', baseUrl: fakeUrl, apiKey: 'sk-good', model: 'alpha-model' })).json() as {
      id: string;
      kind: string;
    };
    expect(created.kind).toBe('openai-compat');
    const res = await api('GET', `/llm/providers/${created.id}/models`);
    expect((res.json() as { models: unknown[] }).models).toHaveLength(2);
  });
});

describe('kind-managed providers', () => {
  it('refuses edits to fields the sign-in flow owns (Codex)', async () => {
    const id = 'codex-row';
    runAsUser(1, 'admin', () =>
      getDb()
        .insert(schema.llmProviders)
        .values({ id, name: 'ChatGPT (Codex)', kind: 'openai-codex', baseUrl: 'https://chatgpt.com/backend-api/codex', model: 'gpt-5.5', toolsMode: 'auto', isActive: 0, createdAt: Date.now(), updatedAt: Date.now() })
        .run(),
    );
    const bad = await api('PATCH', `/llm/providers/${id}`, { baseUrl: 'https://evil.example.com/v1' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: 'not_editable', fields: ['baseUrl'] });
    const ok = await api('PATCH', `/llm/providers/${id}`, { model: 'gpt-5.4', name: 'My ChatGPT' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ kind: 'openai-codex', model: 'gpt-5.4' });
    const models = (await api('GET', `/llm/providers/${id}/models`)).json() as { models: { id: string }[] };
    expect(models.models.map((m) => m.id)).toContain('gpt-5.5');
  });

  it('knows Codex has native tools (no generic probe)', () => {
    expect(adapterFor('openai-codex')).toMatchObject({ nativeTools: true, probeTools: false, userBaseUrl: false });
    expect(adapterFor('openai-compat')).toMatchObject({ probeTools: true, userBaseUrl: true });
  });
});

describe('outbound calls', () => {
  it('sends OpenRouter attribution headers only to OpenRouter', async () => {
    seenHeaders.length = 0;
    await runAsUser(1, 'admin', () =>
      chatOnce(
        { id: 'x', name: 'x', kind: 'openai-compat', baseUrl: fakeUrl, apiKey: 'sk-good', model: 'alpha-model', toolsMode: 'off', toolsDetected: null, contextLength: null },
        { messages: [{ role: 'user', content: 'hi' }], maxTokens: 5 },
      ),
    );
    expect(seenHeaders.length).toBeGreaterThan(0);
    expect(seenHeaders[0]!['http-referer']).toBeUndefined();
    expect(seenHeaders[0]!['x-title']).toBeUndefined();
  });
});

describe('my AI usage', () => {
  it('returns only the signed-in user’s usage, grouped by model', async () => {
    const now = Date.now();
    getControlDb()
      .insert(controlSchema.aiUsage)
      .values([
        { userId: 1, providerName: 'Fake', model: 'alpha-model', promptTokens: 100, completionTokens: 20, ts: now },
        { userId: 1, providerName: 'Fake', model: 'alpha-model', promptTokens: 50, completionTokens: 5, ts: now },
        { userId: 999, providerName: 'Other', model: 'secret-model', promptTokens: 1000, completionTokens: 1000, ts: now },
      ])
      .run();
    const usage = (await api('GET', '/llm/usage?days=7')).json() as {
      byModel: { model: string; promptTokens: number; completionTokens: number; calls: number }[];
      daily: unknown[];
    };
    const models = usage.byModel.map((m) => m.model);
    expect(models).not.toContain('secret-model');
    const alpha = usage.byModel.find((m) => m.model === 'alpha-model')!;
    expect(alpha.promptTokens).toBeGreaterThanOrEqual(150);
    expect(alpha.calls).toBeGreaterThanOrEqual(2);
    expect(usage.daily.length).toBeGreaterThan(0);
  });
});
