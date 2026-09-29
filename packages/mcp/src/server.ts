/* ============================================================================
 * @dreamward/mcp — server.ts
 * Builds the Dreamward MCP server (transport-agnostic):
 *   • tools     — every /api/v1 capability, with safety annotations; write
 *                 tools are only offered when the API key can write
 *   • resources — dreamward://overview · chapter · ikigai · wheel · category/{id}
 *   • prompts   — Lify's rituals (daily plan, weekly review, IKIGAI coach,
 *                 chapter reset, life-wheel check-in) for ANY agent, so users
 *                 can run them on their own AI subscription
 * ========================================================================= */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DreamwardApiError, type DreamwardClient } from '@dreamward/client';
import { RITUALS } from '@dreamward/shared';
import { TOOLS, toolAccess, toolAnnotations } from './tools';

export interface WhoAmI {
  user: { id: number; email: string } | null;
  key: { name: string | null; scope: 'read' | 'write' };
  server: { version: string; schema: number };
}

export interface CreateServerOptions {
  client: DreamwardClient;
  version: string;
  /** from GET /api/v1/whoami — read keys only get read tools */
  scope: 'read' | 'write';
}

function errorText(err: unknown): string {
  if (err instanceof DreamwardApiError) {
    if (err.status === 403) return 'Forbidden: this API key is read-only. Create a read & write key in Dreamward → Settings → AI agent access.';
    if (err.status === 401) return 'Unauthorized: the API key is invalid or was revoked.';
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export function createDreamwardServer({ client, version, scope }: CreateServerOptions): McpServer {
  const server = new McpServer(
    { name: 'dreamward', version },
    {
      instructions:
        "Dreamward is the user's private life-vision system: a Current Chapter (what matters now), IKIGAI, a life wheel (1-10 per life area), 12 life categories with vision/identity/purpose/strategy, goals, actions and a journal. Start with get_overview. Ground everything in their real content. Before any write, show the user what you will change and get a clear yes — every write is audited. Prompts offer guided rituals (daily-plan, weekly-review, ikigai-coach, chapter-reset, rate-my-wheel).",
    },
  );

  /* ── tools ── */
  for (const tool of TOOLS) {
    if (scope === 'read' && toolAccess(tool.name) !== 'read') continue;
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema, annotations: toolAnnotations(tool.name) },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.run(client, args ?? {});
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${errorText(err)}` }], isError: true };
        }
      },
    );
  }

  /* ── resources ── */
  const json = (uri: URL, data: unknown) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
  });
  server.registerResource(
    'overview',
    'dreamward://overview',
    { title: 'My Dreamward (overview)', description: 'The whole book as compact markdown — the best context to load first.', mimeType: 'text/markdown' },
    async (uri) => {
      const res = await client.get<{ markdown: string }>('/overview');
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: res.markdown }] };
    },
  );
  server.registerResource(
    'chapter',
    'dreamward://chapter',
    { title: 'Current Life Chapter', description: 'What matters now: focus / maintenance areas, not-now list, anti-vision.', mimeType: 'application/json' },
    async (uri) => json(uri, await client.get('/chapters/current')),
  );
  server.registerResource(
    'ikigai',
    'dreamward://ikigai',
    { title: 'IKIGAI', description: 'Current IKIGAI statement, items per circle, everyday joys, draft and history.', mimeType: 'application/json' },
    async (uri) => json(uri, await client.get('/ikigai')),
  );
  server.registerResource(
    'wheel',
    'dreamward://wheel',
    { title: 'Life wheel', description: 'Latest 1-10 rating, reality and gap for each life category.', mimeType: 'application/json' },
    async (uri) => json(uri, await client.get('/ratings/latest')),
  );
  server.registerResource(
    'category',
    new ResourceTemplate('dreamward://category/{categoryId}', {
      list: async () => {
        const cats = await client.get<{ id: string; labelEn: string }[]>('/categories');
        return { resources: cats.map((c) => ({ uri: `dreamward://category/${c.id}`, name: c.labelEn, mimeType: 'application/json' })) };
      },
    }),
    { title: 'Life category', description: 'One life category with all its sections (premises, vision, identity, purpose, strategy).', mimeType: 'application/json' },
    async (uri, { categoryId }) => json(uri, await client.get(`/categories/${encodeURIComponent(String(categoryId))}`)),
  );

  /* ── prompts (rituals) ── */
  for (const ritual of RITUALS) {
    server.registerPrompt(
      ritual.id,
      {
        title: ritual.titleEn,
        description: ritual.descriptionEn,
        argsSchema: { language: z.enum(['en', 'he']).optional().describe('Conversation language (default: en)') },
      },
      ({ language }) => ({
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text: ritual.build(language ?? 'en') } }],
      }),
    );
  }

  return server;
}
