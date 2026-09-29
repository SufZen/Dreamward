# Security policy

This project stores some of the most personal data people have — life visions,
journals, relationships. We take security reports seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Report privately through
**GitHub → Security → "Report a vulnerability"** (private security advisory)
on this repository. Include:

- what an attacker can do, and the affected version(s)
- steps to reproduce (a proof of concept if you have one)
- whether it needs an account, an API key, or network access

You will get an acknowledgement within **5 days** and a first assessment within
**14 days**. We will agree a disclosure date with you (typically ≤ 90 days)
and credit you in the release notes unless you prefer otherwise.

## Supported versions

| Version | Supported |
|---|---|
| latest minor (e.g. 0.4.x) | ✅ security fixes |
| previous minor | ✅ critical fixes only |
| older | ❌ — please upgrade (upgrades are backup-protected) |

From 1.0 on, security fixes are backported to the previous minor for 3 months.

## Scope

In scope: the API server, web app, desktop app, MCP server, CLI, installer and
the official container images. Especially interesting: cross-account data
access, auth/session/API-key bypass, SSRF, stored XSS in rich text, path
traversal in uploads/imports, and secrets leaking into logs, exports or backups.

Out of scope: vulnerabilities in a self-hoster's own reverse proxy/OS setup,
denial of service by an authenticated account against its own instance, and
issues in third-party AI providers.

## Design notes for researchers

See [docs/security-privacy.md](docs/security-privacy.md) for the threat model:
per-account SQLite isolation, argon2id passwords, AES-256-GCM for stored
provider keys, hashed API keys with read/write scopes, audited agent writes,
and the SSRF guard for provider URLs.
