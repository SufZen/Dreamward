# Self-hosting

Run your own private Dreamward — for yourself, your family, or a small group
you coach. Everything stays on your machine; every user connects their own AI.

> Prefer an app on your computer with no server at all? See the **desktop app**
> (Windows / macOS / Linux) in the Releases page — same app, single user.

## Requirements

- A Linux server or home machine (x86-64 or ARM64 — a Raspberry Pi 4/5 works)
  with **1 vCPU, 1 GB RAM, a few GB of disk** for ~10 users
- **Docker** with the Compose plugin ([install](https://docs.docker.com/engine/install/))
- For internet access: a **domain name** pointing to the server (ports 80/443
  open) — *or* a tunnel (Cloudflare Tunnel / Tailscale) — *or* keep it on
  your home network only

## Install (2 minutes)

```bash
curl -fsSL https://dreamward.life/install.sh | sudo bash
```

(The same script is in the repository: `https://raw.githubusercontent.com/SufZen/Dreamward/main/deploy/install.sh`.)

The installer asks for a domain (or runs locally), generates secrets, pins the
latest version, starts everything and prints a **one-time setup link** — open
it to create your admin account. Non-interactive examples:

```bash
# public, automatic HTTPS
sudo bash install.sh --domain life.example.com --yes
# home network, http://<this-machine>:8080
sudo bash install.sh --local --lan --yes
# only this machine (use with a tunnel or reverse proxy)
bash install.sh --local --port 8080 --yes
```

It installs into `/opt/dreamward` (root) or `~/dreamward`:

```
docker-compose.yml   the stack (published images, pinned version)
Caddyfile            automatic HTTPS (domain mode)
.env                 your settings + secrets — back this file up!
dreamward-ctl         the management tool
```

Lost the setup link? `dreamward-ctl setup-link`.

## Day-to-day

```bash
dreamward-ctl status        # containers, version, accounts, last backup
dreamward-ctl doctor        # checks secrets, health, disk, backup age, updates
dreamward-ctl logs api      # follow server logs
dreamward-ctl backup        # full verified backup now
dreamward-ctl backups       # list backups
```

Invite people from **Admin → Invite links** (default cap `MAX_USERS=10`).

## Updating

```bash
dreamward-ctl update            # to the latest release
dreamward-ctl update 0.5.0      # to a specific version
```

What happens: a full backup → the new version is pinned in `.env` → images are
pulled → the server upgrades every account's data (after its own automatic
pre-upgrade snapshot) → `dreamward-ctl` waits until the new version reports
healthy. **If it doesn't, it rolls back automatically** — the previous version
and, if the schema changed, the pre-upgrade data snapshot.

Major versions (1.x → 2.x) ask for `--yes` after you've read the release notes.

Changed your mind after an update? `dreamward-ctl rollback`.

## Your data

| Volume | Contents |
|---|---|
| `dreamward_data` | one SQLite database per account + their images, and the accounts database |
| `dreamward_backups` | daily verified backups, pre-upgrade snapshots, pre-import copies |

Each user can download their whole book (**Settings → Your data**) and import
it into any other installation — another server or the desktop app.

**Off-site copies** are your job (a machine can die): sync the backups volume
with rclone/restic — see [backup-restore.md](backup-restore.md). Also keep your
`.env` in a password manager.

## AI

The server never pays for AI. Each user opens **Settings → AI** and connects
their own provider — an API key (OpenAI, Anthropic, Google, OpenRouter, Groq, …),
a local model server, or an AI subscription through their own agent (see
[ai-providers.md](ai-providers.md) and [agent-access.md](agent-access.md)).

**Local models (Ollama / LM Studio) on the same machine:** use
`http://host.docker.internal:11434/v1` as the base URL. Private addresses are
allowed when `ALLOW_PRIVATE_AI_URLS=true` (the installer sets it for local
installs); keep it `false` on servers shared with people you don't fully trust
(it prevents users from reaching your internal network through the server).

## Behind your own reverse proxy / tunnel

Install with `--local` (web listens on `127.0.0.1:8080`) and point your proxy
(Nginx Proxy Manager, Traefik, Caddy, Cloudflare Tunnel, Tailscale Serve) at
it. Then set in `.env`:

```bash
PUBLIC_ORIGIN=https://life.example.com
COOKIE_SECURE=true
```

and `docker compose up -d`. Keep streaming working: disable response buffering
for `/api/` (e.g. nginx `proxy_buffering off;`) and allow request bodies up to
1 GB for `/api/me/import`.

Coolify users: see `docker-compose.prod.yml` in the repository for a
Traefik-labelled example.

## Settings reference (`.env`)

| Variable | Default | |
|---|---|---|
| `DREAMWARD_VERSION` | — | pinned version (managed by `dreamward-ctl update`) |
| `COMPOSE_PROFILES` | `https` | `https` = Caddy with automatic certificates; empty = no Caddy |
| `DOMAIN` | — | your domain (https mode) |
| `PUBLIC_ORIGIN` | — | the URL people open |
| `COOKIE_SECURE` | `true` | must be `true` for https origins |
| `WEB_BIND` / `WEB_PORT` | `127.0.0.1` / `8080` | where the web container listens |
| `JWT_SECRET`, `KEY_ENCRYPTION_SECRET` | generated | never change after install (see backup doc) |
| `MAX_USERS` | `10` | account cap |
| `BACKUP_HOUR`, `BACKUP_RETENTION_DAYS` | `3`, `14` | daily backup schedule |
| `ALLOW_PRIVATE_AI_URLS` | per install mode | allow local model servers |
| `TZ` | `UTC` | timezone for backups and routines |

## Troubleshooting

- **"refusing to start … written by a newer version"** — you pinned an older
  version than your data. `dreamward-ctl rollback` or `dreamward-ctl update <the newer version>`.
- **An account shows "workspace unavailable"** — its database failed its
  integrity check at boot; everyone else is fine. `dreamward-ctl status` shows
  it; restore that one account: `dreamward-ctl restore <backup> --user <id>`.
- **Certificate errors** — the domain must point to the server and ports 80/443
  must be reachable; `dreamward-ctl logs caddy`.
- **Upgrading from a pre-0.4 root-run install** — the new images run as an
  unprivileged user and fix volume ownership automatically on first start.
