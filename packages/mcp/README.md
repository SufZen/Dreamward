# @dreamward/mcp — Dreamward MCP server

Connects your Dreamward to any MCP-capable AI agent — Claude Code, Claude
Desktop, Codex, Gemini CLI, Cursor, VS Code, Windsurf, OpenCode, Hermes and
others. Every request is authenticated with a personal API key and recorded
in the audit log (**Settings → AI agent access**).

> **Easiest path:** you don't need this package directly. The CLI embeds it —
> `dreamward setup <agent>` writes the right config and launches `dreamward mcp`.
> See [`docs/agent-access.md`](../../docs/agent-access.md).

## What it exposes

- **37 tools** with MCP safety annotations (`readOnlyHint`,
  `destructiveHint`, `idempotentHint`). A **read** key sees only the 18
  read tools — write tools are not registered at all.
  Start with `get_overview` (the whole book as compact markdown).
- **Resources**: `dreamward://overview`, `dreamward://chapter`,
  `dreamward://ikigai`, `dreamward://wheel`, `dreamward://category/{categoryId}`.
- **Prompts** (Lify's rituals, EN/HE via the `language` argument):
  `daily-plan`, `weekly-review`, `ikigai-coach`, `chapter-reset`,
  `rate-my-wheel` — so your own AI subscription runs the coaching.

## Standalone use

```bash
pnpm --filter @dreamward/mcp build   # → dist/index.js, a single self-contained file
DREAMWARD_URL=https://your-dreamward DREAMWARD_API_KEY=lbk_… node dist/index.js
```

`dist/index.js` bundles the MCP SDK and every dependency, so it runs on any
host with only `node` ≥ 20 — copy it to a server-side agent host as-is.

### As a library

```ts
import { createDreamwardServer, startStdio } from '@dreamward/mcp';
await startStdio({ baseUrl: 'https://your-dreamward', apiKey: 'lbk_…' });
```

`startStdio` calls `/api/v1/whoami` first (fails fast on a bad key) and
registers only the tools the key's scope allows.

## Development

`scripts/e2e.mjs` drives the built server end to end against a running API
(tools, annotations, resources, prompts, read-key filtering). CI runs it on
every push.
