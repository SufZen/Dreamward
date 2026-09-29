#!/usr/bin/env node
/* ============================================================================
 * MCP end-to-end check against a running Dreamward API.
 *   DREAMWARD_URL=http://127.0.0.1:4000 DREAMWARD_EMAIL=… DREAMWARD_PASSWORD=… \
 *     node packages/mcp/scripts/e2e.mjs
 * Logs in, creates a write key + a read key, spawns dist/index.js over stdio
 * with each, and checks tools / annotations / resources / prompts / calls.
 * ========================================================================= */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.DREAMWARD_URL ?? 'http://127.0.0.1:4000';
const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.DREAMWARD_EMAIL, password: process.env.DREAMWARD_PASSWORD }),
  });
  assert.equal(res.status, 200, 'login');
  return res.headers.get('set-cookie').split(';')[0];
}

async function createKey(cookie, scope) {
  const res = await fetch(`${base}/api/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ name: `e2e-${scope}`, scope }),
  });
  return (await res.json()).token;
}

async function connect(apiKey) {
  const client = new Client({ name: 'dreamward-e2e', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [bin], env: { ...process.env, DREAMWARD_URL: base, DREAMWARD_API_KEY: apiKey }, stderr: 'ignore' }),
  );
  return client;
}

const text = (r) => r.content?.map((c) => c.text).join('') ?? '';

const cookie = await login();
const writeKey = await createKey(cookie, 'write');
const readKey = await createKey(cookie, 'read');

// ── write key ──
const w = await connect(writeKey);
const { tools } = await w.listTools();
const names = tools.map((t) => t.name);
console.log(`write key: ${tools.length} tools`);
for (const n of ['get_overview', 'start_chapter', 'update_ikigai_draft', 'rate_category', 'delete_goal']) assert.ok(names.includes(n), `tool ${n}`);
const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
assert.equal(byName.get_overview.annotations.readOnlyHint, true);
assert.equal(byName.delete_goal.annotations.destructiveHint, true);
assert.equal(byName.create_goal.annotations.readOnlyHint, false);

const chapter = await w.callTool({
  name: 'start_chapter',
  arguments: { title: 'E2E season', focusCategoryIds: ['career'], notNow: ['moving abroad'] },
});
assert.ok(!chapter.isError, text(chapter));
const rate = await w.callTool({ name: 'rate_category', arguments: { categoryId: 'career', score: 6, gap: 'first client' } });
assert.ok(!rate.isError, text(rate));
await w.callTool({ name: 'start_ikigai_draft', arguments: {} });
const ik = await w.callTool({
  name: 'update_ikigai_draft',
  arguments: { items: [{ text: 'Teaching', circles: ['love', 'good', 'needs', 'paid'] }], everyday: ['coffee'], statement: 'Teach well' },
});
assert.ok(!ik.isError, text(ik));

const overview = text(await w.callTool({ name: 'get_overview', arguments: {} }));
assert.ok(overview.includes('E2E season'), 'overview shows the chapter');

const { resources } = await w.listResources();
console.log(`resources: ${resources.map((r) => r.uri).join(', ')}`);
assert.ok(resources.some((r) => r.uri === 'dreamward://overview'));
const res = await w.readResource({ uri: 'dreamward://overview' });
assert.ok(res.contents[0].text.includes('E2E season'));
const cat = await w.readResource({ uri: 'dreamward://category/career' });
assert.ok(cat.contents[0].text.includes('"sections"'));

const { prompts } = await w.listPrompts();
console.log(`prompts: ${prompts.map((p) => p.name).join(', ')}`);
assert.deepEqual(prompts.map((p) => p.name).sort(), ['chapter-reset', 'daily-plan', 'ikigai-coach', 'rate-my-wheel', 'weekly-review']);
const he = await w.getPrompt({ name: 'weekly-review', arguments: { language: 'he' } });
assert.ok(he.messages[0].content.text.includes('חיימי'));
await w.close();

// ── read key: only read tools ──
const r = await connect(readKey);
const readTools = (await r.listTools()).tools;
console.log(`read key: ${readTools.length} tools`);
assert.ok(readTools.every((t) => t.annotations.readOnlyHint), 'read key exposes only read-only tools');
assert.ok(!readTools.some((t) => t.name === 'create_goal'));
await r.close();

console.log('MCP e2e OK');
