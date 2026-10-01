# Architecture

## System overview

```
                        ┌────────────────────────── VPS (Ubuntu 24.04, Coolify) ───────────────────────────┐
Browser ── HTTPS ──────►│ coolify-proxy (Traefik, :80/:443, Let's Encrypt)                                  │
                        │   └─ Host(life.example.com)                                            │
                        │        └──► web (nginx)  ── /api/*, /media/* ──► api (Fastify :4000, internal)   │
                        │              static SPA                            │                              │
                        │                                                    ▼                              │
                        │                                       dreamward_data volume                       │
                        │                                         control.db                               │
                        │                                         users/1/{lifebook.db, assets/}           │
                        │                                         users/2/{lifebook.db, assets/}  …        │
                        │                                         backups/                                  │
                        └────────────────────────────────────────────────────────────────────────────────┘
```

The VPS already runs Coolify, whose Traefik instance owns ports 80/443.
Dreamward publishes **no host ports**: the `web` container joins the external
`coolify` docker network and is routed by Traefik labels (HTTPS entrypoint,
`letsencrypt` certresolver, HSTS, http→https redirect). nginx inside `web`
serves the SPA and proxies `/api` + `/media` to the API container with SSE-safe
settings (`proxy_buffering off`, 1h read timeout, Docker-DNS re-resolution).

## Multi-user model: DB-per-user

Dreamward deliberately does **not** use a shared database with `user_id`
columns. Each account owns a complete, independent world:

```
$DATA_DIR/
├─ control.db              # control plane (see below)
├─ users/
│  ├─ 1/lifebook.db        # full 22-table content schema, admin's world
│  │   assets/{originals,derived}/
│  └─ 2/lifebook.db        # tester's world — same schema, zero shared rows
│      assets/…
└─ backups/
```

Why this design:

- **Isolation by construction** — a query physically cannot read another
  user's rows; there is no shared table to forget a `WHERE user_id`.
- **Zero churn** — the content schema and all feature routes are tenant-blind.
- **Trivial lifecycle** — deleting a user = deleting a directory; per-user
  backup/restore/export = copying one directory.
- **SQLite economics** — a connection costs a few MB; 10 users ≈ <50 MB.

### Request flow (tenant context)

1. `requireAuth` verifies the JWT cookie and re-checks the account's status in
   `control.db` (a disabled user's live sessions die on the next request).
2. An `onRequest` hook opens (or reuses) the user's DB handle from the
   registry (`apps/api/src/db/registry.ts`) — migrated once per boot — and
   enters an **AsyncLocalStorage** context `{uid, role, db, userDataRoot}`.
3. Feature code calls `getDb()` / `getUserDataRoot()` exactly as it did in the
   single-user era (`apps/api/src/db/client.ts`). There is **no global DB
   fallback**: touching the DB outside a context throws.

### Control plane (`control.db`)

| Table | Purpose |
| --- | --- |
| `users` | email, argon2id hash, role (`admin`/`user`), status (`active`/`disabled`), last login |
| `invites` | one-time tokens, note, expiry, used-by |
| `audit_log` | append-only events: logins, invites, admin actions, key lifecycle (no secrets) |
| `ai_usage` | per-user prompt/completion tokens per provider+model, `estimated` flag |
| `api_keys` | personal agent keys: SHA-256 token hash, display prefix, scope (`read`/`write`), last-used, revoked-at |

API keys live in the control plane (not per-user DBs) because a bearer token
must resolve to a `uid` *before* any tenant context exists.

Bootstrap: first boot creates the admin from `DREAMWARD_EMAIL`/`DREAMWARD_PASSWORD`;
a legacy single-user data dir is migrated automatically (DB + assets move to
`users/1/`, the account carries over as admin).

## AI fulfillment engine

```
agent loop / briefing / provider test
        │
        ▼
llm/dispatch.ts ──── kind=openai-compat ───► llm/client.ts (fetch + SSE, chat/completions)
        │
        └────────── kind=openai-codex ─────► llm/codex/adapter.ts (ChatGPT Responses API)
```

- Providers are **per user** (rows in the user's own `llm_providers` table);
  keys and OAuth bundles are AES-256-GCM encrypted (`lib/crypto.ts`,
  `KEY_ENCRYPTION_SECRET`).
- Tool support is probed per provider (`auto`/`on`/`off` + runtime downgrade);
  providers without tools fall back to JSON-block proposals.
- Usage is logged centrally from the client layer into `control.db.ai_usage` —
  provider-reported tokens when available (`stream_options.include_usage`),
  chars/4 estimation flagged `estimated` otherwise.
- The **Codex provider** (experimental, `CODEX_ENABLED`) signs in with a
  ChatGPT subscription via PKCE paste-back and adapts the Responses API onto
  the same `StreamEvent` union. See [ai-providers.md](ai-providers.md).

### Clarity's tool loop and the proposal gate

The built-in agent has five deliberately-small tools (`search_content`,
`get_item`, `list_goals`, `list_actions`, `propose`) — weak models degrade
past ~5 tools. **All writes flow through `propose`**: a proposal row the user
approves or rejects in the UI; approval executes the shared mutation services
(`services/mutations.ts`), the same code path the REST routes use.

### Autonomous routines (scheduler)

`services/scheduler.ts` ticks every 5 minutes, walks active users, enters
each tenant context (`runAsUser`) and runs any enabled routine that is due —
at most once per routine per day, only when the user has an active provider.
Routines (`agent/routines.ts`) are ordinary agent turns in a `kind='routine'`
conversation: **daily_plan** (daily), **weekly_review_prep** (Fri),
**goal_drift** (Sun+Wed). With `autoApprove`, action-scoped proposals
(`create/update/complete_action` — never deletes, never goal/section edits)
are applied immediately; everything else stays pending. Failures land in the
routine's `lastStatus`, never crash the tick.

## Agent access surface (`/api/v1`)

External agents (MCP server, CLI, scripts) authenticate with **personal API
keys** (`Authorization: Bearer lbk_…`):

1. `requireApiKey` resolves the token hash in `control.db.api_keys`
   (revocation + account status re-checked per request), sets
   `req.uid`, hard-codes `req.role='user'` — **keys never grant admin**.
2. The same `enterUserContext` hook used by cookie auth opens the tenant DB.
3. A scope guard rejects non-GET methods for `read`-scope keys (403).
4. Per-key rate limit (120/min) on top of the global per-IP backstop.
5. An audit plugin records every mutation into the per-user `api_activity`
   table — method, path, action label, truncated payload summary, HTTP
   status, and the row's **prior state** on update/delete (recoverability).

The v1 route set is a deliberate **subset**: content CRUD + markdown-friendly
write endpoints (`agentApi.ts`). Auth, admin, invites, LLM-provider config,
agent chat (SSE) and proposals are not mounted there.

Consumers (see [agent-access.md](agent-access.md)):

- **`packages/mcp`** — stdio MCP server (37 tools with annotations, resources, ritual prompts; tools filtered by key scope via `/api/v1/whoami`), single-file bundle, also embedded in the CLI as `dreamward mcp`;
  transport-independent tool table ready for a future Streamable-HTTP mount.
- **`packages/cli`** — `dreamward` command (goals/actions/journal/search,
  `--json`), config in `~/.dreamward/config.json`.
- **Calendar feed** — `GET /api/feeds/calendar.ics?key=…` (read-scope keys
  only; calendar apps cannot send headers).

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| API | Fastify 5 | fast, typed, first-class hooks/plugins |
| DB | better-sqlite3 + Drizzle | synchronous, WAL, perfect for per-tenant files |
| Auth | @fastify/jwt + httpOnly cookie | no token storage in JS, SameSite=strict |
| Web | React 19 + Vite 7 | modern SPA, code-split moodboard editor |
| State | TanStack Query + Zustand | server cache + tiny client state |
| Design | REALIZEOS design system | dark+gold, RTL-ready components |
| Images | sharp | original + web(1600px) + thumb(320px) webp |
| Contract | Zod schemas in `packages/shared` | single source of truth for api/web |

## API surface

- `/api/health` — public liveness probe.
- `/api/auth/*` — login/logout/me/password (control DB only).
- `/api/invites/:token` — public invite probe + accept (rate-limited).
- `/api/admin/*` — admin-only control plane (users, invites, audit).
- `/api/*` — authenticated feature routes (categories, content blocks, life
  vision, goals + progress, journal, moodboards, assets, snapshots, llm,
  agent, proposals, actions, api-keys, routines) — all tenant-scoped via ALS.
- `/api/v1/*` — bearer-key agent surface (content subset, scope-guarded,
  rate-limited, audited).
- `/api/feeds/calendar.ics` — ICS feed, read-scope key via query param.
- `/media/*` — authenticated per-user asset streaming with path-traversal
  guard.

## Operational properties

- **Logging** — pino (info in prod) with secret redaction; docker json-file
  rotation (10 MB × 3 per container).
- **Rate limits** — global 300/min/IP; login 5/min; invite endpoints 10–30/min.
- **Backups** — nightly online SQLite backups (control + each user DB) +
  assets tar, 14-day retention in the data volume. See
  [backup-restore.md](backup-restore.md).
- **Monitoring** — `/api/health` wired into the host's uptime-kuma.
- **Deploy** — GitHub release → GHCR images → SSH deploy → health check. See
  [deployment.md](deployment.md).

## Desktop edition

`apps/desktop` (Electron) runs the same API and web build for one person on
their own computer. For the full description, see [desktop.md](desktop.md).

- **Engine.** The shell starts the bundled API (`apps/api/src/start.ts` →
  `dist/api/start.mjs`) in a utility process with `DESKTOP_MODE=true`.
- **Scope.** `DESKTOP_MODE` binds to `127.0.0.1`, provisions a single local
  account, and caps accounts at one.
- **Serving.** The API serves the SPA from `WEB_DIST_DIR`, so there is no
  nginx.
- **Session.** The shell exchanges a per-launch `DESKTOP_TOKEN` for the normal
  session cookie at `POST /api/desktop/session`.
- **Storage.** Data lives in the OS app-data folder. Secrets are kept by
  Electron `safeStorage`.
- **Upgrades.** The upgrade machinery (integrity check, pre-upgrade snapshot,
  downgrade guard) works exactly as on a server.
