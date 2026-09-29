# Contributing / Development Guide

Thank you for helping! This project is licensed **AGPL-3.0-only**. By
contributing you agree your work is released under the same license, and you
certify the [Developer Certificate of Origin](https://developercertificate.org/)
by signing off each commit: `git commit -s`.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues go to
[SECURITY.md](SECURITY.md), never to public issues.

## Prerequisites

- Node 22+ (matches CI, the runtime image and the desktop app's engine)
- pnpm 10 (`corepack enable`)
- Windows, macOS or Linux (better-sqlite3/sharp/argon2 ship prebuilds; a C++
  toolchain is only needed when a prebuild is missing)

## Setup & daily commands

```bash
cp .env.example .env       # set JWT_SECRET at minimum
pnpm install
pnpm dev                   # turbo: api (tsx watch, :4000) + web (vite, :5173)

pnpm -r typecheck          # all packages
pnpm build                 # turbo build (shared → api/web)
pnpm --filter @dreamward/api test    # vitest (isolation, invites/admin, crypto)
```

The Vite dev server proxies `/api` and `/media` to `:4000` — same-origin
cookies work out of the box.

## Repository map

```
apps/api/src/
├─ server.ts            boot order, hooks, media streaming
├─ env.ts               env contract + production fail-fast
├─ plugins/auth.ts      JWT cookie sessions, requireAuth/requireAdmin
├─ db/
│  ├─ controlSchema.ts / control.ts   control plane (accounts, invites, audit, usage)
│  ├─ client.ts         AsyncLocalStorage tenant context — getDb()/getUserDataRoot()
│  ├─ registry.ts       per-user DB lifecycle (open/provision/delete)
│  ├─ schema.ts         22-table per-user content schema (Drizzle)
│  └─ migrate.ts/seed.ts
├─ routes/              feature routes (tenant-blind) + auth/invites/admin/codexAuth
│                       + agentApi/apiKeys/routines/calendar (v0.3 agent surface)
├─ plugins/apiKeyAuth.ts / apiAudit.ts   bearer-key auth + agent audit trail
├─ services/            mutations, proposalExecutor, progress, scheduler
├─ llm/                 dispatch → client (openai-compat) | codex/ (Responses API)
└─ agent/               agent loop, tools, briefing, routines, proposals
apps/web/src/features/  feature-folder React code (admin/, auth/, settings/, …)
packages/shared/        Zod schemas = the API contract (change here FIRST)
packages/client/        typed HTTP client for /api/v1 (consumed by mcp + cli)
packages/mcp/           stdio MCP server for external agents (single-file build)
packages/cli/           `dreamward` command-line client (embeds the MCP server)
apps/desktop/           Electron shell: runs the API in desktop mode (docs/desktop.md)
```

## Conventions that matter

- **Tenant safety**: feature code must get data only via `getDb()` /
  `getUserDataRoot()` inside a request. Never cache DB handles in module
  scope; never import `control.ts` from feature routes (admin/auth/invites
  are the only control-plane consumers).
- **User-DB migrations are additive-only** within a major version. Every
  account is migrated at boot, after an automatic pre-upgrade snapshot, inside
  a transaction; a build refuses data written by a newer schema. Generate with
  `pnpm --filter @dreamward/api db:generate` — never edit a shipped migration.
  Destructive changes (drop/rename) need an RFC and a major version.
- **Control-DB migrations** are append-only entries in `CONTROL_MIGRATIONS`
  (`control.ts`), tracked with `PRAGMA user_version` — never edit a shipped entry.
- **Upgrade test**: `__tests__/upgrade.test.ts` boots the current server on a
  v0.3.1-shaped install. Schema changes must keep it green.
- **API contract**: add/modify Zod schemas in `packages/shared` first, then
  implement server + client against them.
- **Secrets**: anything secret at rest goes through `lib/crypto.ts`; anything
  secret in logs must be covered by the pino `redact` list in `server.ts`.
- **i18n/RTL**: user-facing strings need EN + HE variants; keep `dir`
  handling intact (inputs holding URLs/emails are `dir="ltr"`).

## Testing

`apps/api/src/__tests__/` uses vitest + `app.inject()` (no sockets). The
isolation suite is the contract of the multi-user architecture — if you touch
auth, context, registry or media serving, run it and extend it.

## Commits, PRs & releasing

- Branch from `main`; open a PR. **PR titles follow Conventional Commits**
  (`feat: …`, `fix: …`, `docs: …`) — they become the changelog.
- Releases are automated by release-please — see [docs/releasing.md](docs/releasing.md).
