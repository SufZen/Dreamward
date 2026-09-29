# Security & Privacy

## Data ownership and isolation

- Every account owns an isolated world: `users/<uid>/lifebook.db` +
  `users/<uid>/assets/`. There are **no shared content tables** — cross-user
  reads are impossible by construction, and a dedicated test suite
  (`apps/api/src/__tests__/isolation.test.ts`) guards this property in CI.
- The control plane (`control.db`) stores only account metadata: email,
  password hash, role/status, invite tokens, audit events, and AI token
  counts. Never content.
- The admin dashboard exposes usage numbers (storage bytes, token totals,
  last login) — not entries, images or conversations.
- Deleting a user removes their entire directory tree (modulo backup
  retention, below).

## Authentication & sessions

- Passwords: **argon2id**, never logged, minimum 8 chars.
- Sessions: JWT in an **httpOnly, Secure, SameSite=strict** cookie (30 days).
  No tokens in localStorage; XSS cannot exfiltrate a session.
- Account status is re-checked on **every request** — disabling a user kills
  their live sessions immediately.
- Login is rate-limited (5/min) on top of a global 300/min/IP backstop.
- Invite links are single-use, expiring, unguessable (192-bit tokens) and
  seat-capped.

## Secrets

| Secret | Protection |
| --- | --- |
| User passwords | argon2id hash (control.db) |
| AI provider API keys | AES-256-GCM at rest (`enc:v1:`), masked in API/UI |
| ChatGPT OAuth tokens | AES-256-GCM at rest, rotating refresh persisted |
| Personal agent API keys (`lbk_…`) | SHA-256 hash at rest; raw token shown once at creation, never stored or logged |
| `JWT_SECRET`, `KEY_ENCRYPTION_SECRET` | generated on the VPS, 0600 `.env`, never in git |
| Logs | pino redaction for cookies/authorization/apiKey/password |

Agent keys are high-entropy random (256-bit), so a fast deterministic hash is
appropriate (offline brute force infeasible, O(1) indexed lookup); unlike
passwords they never need argon2.

Production fail-fast: the API refuses to boot with `COOKIE_SECURE!=true`, a
short JWT secret, a missing `KEY_ENCRYPTION_SECRET`, or the default admin
password.

## Transport & headers

- TLS terminated by Traefik (Let's Encrypt), HTTP 301→HTTPS, HSTS (1y).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: same-origin` from both the API and the web tier.
- `/media/*` requires authentication, streams only from the requesting user's
  own asset directory, and guards against path traversal.

## Agent access (API keys)

- Keys are **per user, named, and scoped**: `read` keys cannot perform any
  non-GET request (enforced by a scope guard before routing); `write` keys
  get content CRUD only — the `/api/v1` surface never mounts auth, admin,
  invites, LLM-provider config or the chat endpoint, and `req.role` is
  hard-coded to `user` regardless of the key owner's real role.
- Revocation and account status are re-checked on **every request** —
  revoking a key or disabling a user kills agent access immediately.
- Every agent **mutation** is recorded in the user's own `api_activity`
  table: timestamp, key name, action, truncated payload summary, HTTP
  status, and the row's **prior state** on updates/deletes — giving
  hand-recoverability for anything an agent changed. Reads are not logged.
- Per-key rate limit (120/min) on top of the global per-IP backstop.
- The **calendar feed** is the one place a key travels in a URL (calendar
  apps can't send headers); it accepts read-scope keys only, so a leaked
  feed URL can never write. Use a dedicated key for the feed and revoke it
  independently.

## Audit

Append-only `audit_log`: login success/failure (with IP), invite lifecycle,
password changes/resets, user disable/enable/delete, API-key
creation/revocation. Reviewable in the admin dashboard; no secrets are ever
written to it. Per-user agent activity is additionally audited in the user's
own DB (see above).

## Known trade-offs (v0.3.0)

- **Backups are unencrypted inside the data volume** — anyone with root on the
  VPS can read them (true of the live DBs too). Off-site sync should use an
  encrypted remote (e.g. rclone crypt).
- **Deleted user data persists in backups** for up to 14 days (retention
  window) before aging out.
- **No 2FA** — accounts are invite-only and few; revisit if exposure grows.
- **Codex connector** — see the explicit ToS warning in
  [ai-providers.md](ai-providers.md); disabled by default.
- **Admin OpenRouter key** was shared in a chat session during setup —
  rotating it at openrouter.ai and re-running `seed-admin-provider` is cheap
  insurance.
- **Agent keys grant broad content access** — a write-scope key can modify
  any content the owning user can. Give each agent its own key (attribution +
  independent revocation), prefer read-only where writing isn't needed, and
  review the agent activity log periodically. Keys created or pasted through
  chat/terminal sessions should be treated like any secret that transited a
  log — rotate when in doubt (revoke + recreate takes seconds).
- **Autonomous routines spend your LLM tokens** — capped at one run per
  routine per day and skipped without an active provider, but keep an eye on
  Admin → usage after enabling them.
