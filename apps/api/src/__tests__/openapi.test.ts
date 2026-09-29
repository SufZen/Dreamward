/* The OpenAPI document is valid, public, and covers the agent surface. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'dreamward-openapi-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = root;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');
let app: Awaited<ReturnType<typeof buildServer>>['app'];

beforeAll(async () => {
  ({ app } = await buildServer());
});
afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(root, { recursive: true, force: true });
});

describe('OpenAPI', () => {
  it('is served without an API key and describes the v1 surface', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json() as {
      openapi: string;
      paths: Record<string, Record<string, { security: unknown[]; requestBody?: unknown }>>;
      components: { securitySchemes: Record<string, { scheme: string }> };
    };
    expect(doc.openapi).toBe('3.1.0');
    for (const p of ['/whoami', '/overview', '/chapters', '/ratings', '/ikigai/{id}', '/goals', '/actions/{id}', '/sections/{id}/content']) {
      expect(doc.paths[p], p).toBeTruthy();
    }
    expect(doc.components.securitySchemes.apiKey!.scheme).toBe('bearer');
    expect(doc.paths['/chapters']!.post!.requestBody).toBeTruthy();
  });

  it('serves a docs page with integrity-pinned assets', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/docs' });
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('integrity="sha384-');
  });

  it('still protects the data routes', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/goals' })).statusCode).toBe(401);
  });
});
