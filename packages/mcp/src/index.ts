/* ============================================================================
 * @dreamward/mcp — executable entry (bin `dreamward-mcp`, dist/index.js).
 * Starts the stdio MCP server; configuration via DREAMWARD_URL + DREAMWARD_API_KEY.
 * The library API lives in lib.ts (used by the `dreamward mcp` CLI command).
 * ========================================================================= */
import { startStdio } from './lib';

startStdio().catch((err) => {
  console.error('[dreamward-mcp] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
