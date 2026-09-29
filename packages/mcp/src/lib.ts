/* ============================================================================
 * @dreamward/mcp (library) — builds/starts the stdio MCP server exposing the user's Dreamward to any
 * MCP-capable agent (Claude Code/Desktop, Codex, Gemini CLI, Cursor, VS Code,
 * OpenCode…). All requests hit the Dreamward /api/v1 surface with a personal
 * API key, so auth, scope, rate limiting and the audit trail are enforced
 * server-side.
 *
 * Config (env):
 *   DREAMWARD_URL     e.g. http://localhost:4000 or https://life.example.com
 *   DREAMWARD_API_KEY personal key from Dreamward → Settings → AI agent access
 * ========================================================================= */
import pkg from '../package.json' with { type: 'json' };
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DreamwardClient } from '@dreamward/client';
import { createDreamwardServer, type WhoAmI } from './server';

export { createDreamwardServer } from './server';
export { TOOLS, toolAccess, toolAnnotations } from './tools';

/** Starts the MCP server on stdio (used by the `dreamward-mcp` bin and `dreamward mcp`). */
export async function startStdio(opts: { baseUrl?: string; apiKey?: string } = {}): Promise<void> {
  const baseUrl = opts.baseUrl ?? process.env.DREAMWARD_URL;
  const apiKey = opts.apiKey ?? process.env.DREAMWARD_API_KEY;
  if (!baseUrl || !apiKey) {
    console.error(
      '[dreamward-mcp] Missing configuration.\n' +
        '  DREAMWARD_URL     — your Dreamward server, e.g. http://localhost:4000\n' +
        '  DREAMWARD_API_KEY — personal key from Dreamward → Settings → AI agent access',
    );
    process.exit(1);
  }
  const client = new DreamwardClient({ baseUrl, apiKey });

  // Adapt to the key: read-only keys get read tools only. Older servers
  // without /whoami fall back to offering everything (the server enforces scope).
  let scope: 'read' | 'write' = 'write';
  try {
    const me = await client.get<WhoAmI>('/whoami');
    scope = me.key.scope;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401) {
      console.error('[dreamward-mcp] The API key was rejected (401). Create a new one in Dreamward → Settings → AI agent access.');
      process.exit(1);
    }
  }

  const server = createDreamwardServer({ client, version: pkg.version, scope });
  await server.connect(new StdioServerTransport());
  console.error(`[dreamward-mcp] connected to ${baseUrl} (${scope} key)`);
}
