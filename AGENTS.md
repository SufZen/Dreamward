# AGENTS.md — guide for AI coding agents working on this repo

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the full developer guide. This
file lists what an agent must know before changing code.

> *Using* Dreamward from an agent (MCP/CLI/API) is a different topic — see
> [docs/agent-access.md](docs/agent-access.md) and
> [skills/dreamward/SKILL.md](skills/dreamward/SKILL.md).

## Stack

pnpm 10 + turbo monorepo, Node ≥ 22, TypeScript everywhere.

| Path | What |
|---|---|
| `apps/api` | Fastify 5 API; per-user SQLite (better-sqlite3 + drizzle) + a control DB |
| `apps/web` | React 19 + Vite + TanStack Query + Tailwind; EN/HE with full RTL |
| `packages/shared` | zod schemas = the API contract; constants; IKIGAI math; rituals |
| `packages/client` | typed HTTP client for `/api/v1` |
| `packages/mcp` | MCP server (tools, resources, prompts) — single-file build |
| `packages/cli` | `dreamward` CLI; embeds the MCP server (`dreamward mcp`, `dreamward setup`) |
| `apps/desktop` | Electron shell running the API in `DESKTOP_MODE` (one local account, localhost) |

## Commands

```bash
pnpm install
pnpm typecheck                         # all packages
pnpm --filter @dreamward/api test       # vitest, app.inject — no sockets
pnpm build
node scripts/release/sync-versions.mjs --check   # versions must match root
```

Run typecheck and the API tests before you say a change is done.

## Hard rules

1. **User data is sacred.**
   - User-DB migrations are **additive only**; never edit a shipped migration.
   - Generate migrations with `pnpm --filter @dreamward/api db:generate`.
   - Control-DB changes are appended to `CONTROL_MIGRATIONS`.
   - `upgrade.test.ts` must stay green.
2. **Tenant isolation.**
   - Feature code reaches data only through `getDb()` / `getUserDataRoot()` inside a request.
   - Never cache DB handles at module scope.
   - Never import `control.ts` from feature routes.
3. **Contract first.** Change the zod schemas in `packages/shared` first, then the server, the client, the MCP tools and the OpenAPI list in `apps/api/src/openapi.ts`.
4. **Secrets.**
   - Encrypt at rest via `lib/crypto.ts`, and redact them in logs.
   - Exports strip AI keys.
   - Never commit `.env`, `data/` or DB files.
5. **Bilingual.** Every user-facing string has EN and HE variants. Keep `dir` handling intact.
6. **Never run the dev server against the maintainer's real data.** Point `DATA_DIR` and `BACKUP_DIR` at a scratch folder when you boot the API for verification.
7. **Agent surface parity.** A new `/api/v1` endpoint needs:
   - an MCP tool with correct annotations, and read or write access in `toolAccess`
   - an OpenAPI entry
   - a CLI command where useful
   - a line in `docs/agent-access.md`

## Commits

- Conventional Commits (`feat:`, `fix:`, `docs:` …).
- Sign off with `git commit -s` (DCO).
- License is AGPL-3.0-only.
- release-please owns versions and the CHANGELOG release headers.
