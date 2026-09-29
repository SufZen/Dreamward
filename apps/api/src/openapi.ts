/* ============================================================================
 * apps/api — openapi.ts
 * OpenAPI 3.1 description of the agent API (/api/v1), generated from the same
 * zod schemas the server validates with (@dreamward/shared) — so it can't drift.
 * Served publicly (no data) at /api/v1/openapi.json, browsable at /api/v1/docs.
 * Consumers: n8n / Make / Zapier HTTP nodes, custom GPT Actions, SDK generators.
 * ========================================================================= */
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';
import * as S from '@dreamward/shared';
import { APP_VERSION } from './version';

extendZodWithOpenApi(z);

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Op {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  body?: ZodTypeAny;
  response?: ZodTypeAny;
  query?: Record<string, ZodTypeAny>;
  write?: boolean;
}

const id = z.string().describe('id');
const ok = z.object({ ok: z.literal(true) });
const listItems = z.array(z.object({ text: z.string() }));

const OPS: Op[] = [
  // agent helpers
  { method: 'get', path: '/whoami', tag: 'Agent', summary: 'Who am I: account, key scope, server version', response: z.object({ user: z.object({ id: z.number(), email: z.string() }).nullable(), key: z.object({ name: z.string().nullable(), scope: z.enum(['read', 'write']) }), server: z.object({ version: z.string(), schema: z.number() }) }) },
  { method: 'get', path: '/overview', tag: 'Agent', summary: 'The whole book as compact markdown (best context)', query: { detail: z.enum(['minimal', 'compact', 'full']).optional() }, response: z.object({ markdown: z.string(), version: z.number(), detail: z.string() }) },
  { method: 'get', path: '/search', tag: 'Agent', summary: 'Full-text search across the book', query: { q: z.string(), limit: z.number().int().optional() } },
  { method: 'get', path: '/briefings/latest', tag: 'Agent', summary: "Latest morning briefing Lify wrote" },
  // meaning & focus
  { method: 'get', path: '/chapters/current', tag: 'Chapter', summary: 'Current Life Chapter', response: z.object({ chapter: S.chapterSchema.nullable() }) },
  { method: 'get', path: '/chapters', tag: 'Chapter', summary: 'All chapters (newest first)', response: z.array(S.chapterSchema) },
  { method: 'post', path: '/chapters', tag: 'Chapter', summary: 'Start a chapter (closes the active one)', body: S.createChapterSchema, response: S.chapterSchema, write: true },
  { method: 'put', path: '/chapters/{id}', tag: 'Chapter', summary: 'Update a chapter', body: S.updateChapterSchema, response: S.chapterSchema, write: true },
  { method: 'post', path: '/chapters/{id}/close', tag: 'Chapter', summary: 'Close a chapter with a reflection', body: S.closeChapterSchema, response: S.chapterSchema, write: true },
  { method: 'get', path: '/ratings/latest', tag: 'Life wheel', summary: 'Latest 1-10 rating per category + trend', response: z.array(S.latestRatingSchema) },
  { method: 'get', path: '/ratings', tag: 'Life wheel', summary: 'Rating history of one category', query: { categoryId: z.string() }, response: z.array(S.ratingSchema) },
  { method: 'post', path: '/ratings', tag: 'Life wheel', summary: 'Record a rating (append-only)', body: S.createRatingSchema, response: S.ratingSchema, write: true },
  { method: 'get', path: '/ikigai', tag: 'IKIGAI', summary: 'Current IKIGAI, draft and history' },
  { method: 'post', path: '/ikigai/draft', tag: 'IKIGAI', summary: 'Start or resume a draft', body: S.createIkigaiDraftSchema, response: S.ikigaiProfileSchema, write: true },
  { method: 'put', path: '/ikigai/{id}', tag: 'IKIGAI', summary: 'Update a draft', body: S.updateIkigaiSchema, response: S.ikigaiProfileSchema, write: true },
  { method: 'post', path: '/ikigai/{id}/complete', tag: 'IKIGAI', summary: 'Complete a draft (becomes current)', response: S.ikigaiProfileSchema, write: true },
  // book
  { method: 'get', path: '/categories', tag: 'Book', summary: 'The 12 life categories', response: z.array(S.categorySchema) },
  { method: 'get', path: '/categories/{id}', tag: 'Book', summary: 'A category with all its sections', response: S.categoryWithSectionsSchema },
  {
    method: 'put',
    path: '/sections/{id}/content',
    tag: 'Book',
    summary: 'Replace section content (markdown body and/or lists; identity fields for identity sections)',
    body: z.object({ items: listItems.optional(), habits: listItems.optional(), leverages: listItems.optional(), bodyMarkdown: z.string().optional(), quote: z.string().optional(), quoteAuthor: z.string().optional(), statement: z.string().optional(), states: listItems.optional(), standards: listItems.optional(), beliefShifts: z.array(z.object({ from: z.string(), to: z.string() })).optional() }),
    response: ok,
    write: true,
  },
  { method: 'get', path: '/content-blocks', tag: 'Book', summary: 'Front-matter and implementation blocks', response: z.array(S.contentBlockSchema) },
  { method: 'get', path: '/content-blocks/{id}', tag: 'Book', summary: 'One content block', response: S.contentBlockSchema },
  { method: 'put', path: '/content-blocks/{id}/content', tag: 'Book', summary: 'Replace a content block (markdown / items)', body: z.object({ items: listItems.optional(), bodyMarkdown: z.string().optional() }), response: ok, write: true },
  { method: 'get', path: '/life-vision', tag: 'Book', summary: 'Dream-life prompts and answers', response: z.array(S.lifeVisionPromptSchema) },
  { method: 'put', path: '/life-vision/{id}/answer', tag: 'Book', summary: 'Answer a dream-life prompt (markdown)', body: z.object({ answerMarkdown: z.string() }), response: ok, write: true },
  // goals & actions
  { method: 'get', path: '/goals', tag: 'Goals', summary: 'All goals', response: z.array(S.goalSchema) },
  { method: 'get', path: '/goals/progress', tag: 'Goals', summary: 'Progress + risk per goal', response: z.array(S.goalProgressSchema) },
  { method: 'post', path: '/goals', tag: 'Goals', summary: 'Create a goal', body: S.createGoalSchema, response: S.goalSchema, write: true },
  { method: 'get', path: '/goals/{id}', tag: 'Goals', summary: 'One goal', response: S.goalSchema },
  { method: 'put', path: '/goals/{id}', tag: 'Goals', summary: 'Update a goal', body: S.updateGoalSchema, response: S.goalSchema, write: true },
  { method: 'patch', path: '/goals/{id}/status', tag: 'Goals', summary: 'Set status (kept in history)', body: S.updateGoalStatusSchema, write: true },
  { method: 'delete', path: '/goals/{id}', tag: 'Goals', summary: 'Delete a goal', write: true },
  { method: 'get', path: '/actions', tag: 'Actions', summary: 'Actions (filters: status, priority, goal_id, linked_type, linked_id)', query: { status: z.enum(['todo', 'done']).optional(), priority: z.enum(S.ACTION_PRIORITIES).optional(), goal_id: z.string().optional() }, response: z.array(S.actionSchema) },
  { method: 'post', path: '/actions', tag: 'Actions', summary: 'Create an action', body: S.createActionSchema, response: S.actionSchema, write: true },
  { method: 'patch', path: '/actions/{id}', tag: 'Actions', summary: 'Update / complete an action', body: S.updateActionSchema, response: S.actionSchema, write: true },
  { method: 'delete', path: '/actions/{id}', tag: 'Actions', summary: 'Delete an action (soft)', write: true },
  // journal
  { method: 'get', path: '/journal', tag: 'Journal', summary: 'Journal entries', response: z.array(S.journalEntrySchema) },
  { method: 'post', path: '/journal/markdown', tag: 'Journal', summary: 'Write an entry in markdown', body: z.object({ title: z.string().nullable().optional(), bodyMarkdown: z.string() }), response: z.object({ id }), write: true },
  { method: 'get', path: '/journal/{id}', tag: 'Journal', summary: 'One entry', response: S.journalEntrySchema },
  { method: 'delete', path: '/journal/{id}', tag: 'Journal', summary: 'Delete an entry', write: true },
  // moodboards (read)
  { method: 'get', path: '/moodboards', tag: 'Moodboards', summary: 'Vision moodboards', response: z.array(S.moodboardSchema) },
];

let cached: unknown = null;

export function openApiDocument(): unknown {
  if (cached) return cached;
  const registry = new OpenAPIRegistry();
  const bearer = registry.registerComponent('securitySchemes', 'apiKey', {
    type: 'http',
    scheme: 'bearer',
    description: 'Personal API key (lbk_…) from Settings → AI agent access. Read keys can only call GET.',
  });
  for (const op of OPS) {
    const params = [...op.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
    registry.registerPath({
      method: op.method,
      path: op.path,
      tags: [op.tag],
      summary: op.summary,
      description: op.write ? 'Requires a read & write key. Recorded in the account’s agent audit log.' : undefined,
      security: [{ [bearer.name]: [] }],
      request: {
        params: params.length ? z.object(Object.fromEntries(params.map((p) => [p, z.string()]))) : undefined,
        query: op.query ? z.object(op.query) : undefined,
        body: op.body ? { content: { 'application/json': { schema: op.body } } } : undefined,
      },
      responses: {
        200: { description: 'OK', content: op.response ? { 'application/json': { schema: op.response } } : undefined },
        401: { description: 'Missing or invalid API key' },
        403: { description: 'Read-only key used for a write' },
      },
    });
  }
  cached = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Dreamward agent API',
      version: APP_VERSION,
      description:
        "Your private Dreamward for AI agents and automations. Every write is audited. Prefer the MCP server for agents (tools, resources and guided prompts); use this API for n8n/Make/Zapier, custom GPT Actions and scripts.",
      license: { name: 'AGPL-3.0-only', identifier: 'AGPL-3.0-only' },
    },
    servers: [{ url: '/api/v1' }],
  });
  return cached;
}

/**
 * Minimal Swagger UI page. It is served on the app's own origin, so the CDN
 * assets are pinned to an exact version with Subresource Integrity — a
 * tampered CDN file is refused by the browser. Update version + hashes together.
 */
export const OPENAPI_DOCS_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dreamward agent API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.33.0/swagger-ui.css" integrity="sha384-Ov4/wv3j2bmct8cDc5X4ngJZohVPzEmc6uDPH8WeljUxO5vtoykvMEfbu9Vh6RaW" crossorigin="anonymous"></head>
<body><div id="ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.33.0/swagger-ui-bundle.js" integrity="sha384-YDALVcy8kj8yltLBVi1vBiBAUqdxvus673gM8XKwiy6aDUJFXivF/KCufekjYbVf" crossorigin="anonymous"></script>
<script>window.ui = SwaggerUIBundle({ url: 'openapi.json', dom_id: '#ui' });</script>
</body></html>`;
