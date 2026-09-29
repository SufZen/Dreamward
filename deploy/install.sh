#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Dreamward installer — self-hosted, private, yours.
#
#   curl -fsSL https://raw.githubusercontent.com/SufZen/Dreamward/main/deploy/install.sh | bash
#
# Options (all optional — you'll be asked interactively otherwise):
#   --domain life.example.com   public HTTPS address (automatic certificate)
#   --local                     no domain: http on this machine / your LAN
#   --lan                       with --local: reachable from other devices
#   --port 8080                 web port for --local (default 8080)
#   --version 0.4.0             pin a version (default: latest stable; "edge" = main)
#   --dir /opt/dreamward         install folder (default /opt/dreamward, or ~/dreamward)
#   --yes                       non-interactive
#
# Re-running is safe: an existing .env (your secrets!) is never overwritten.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="${DREAMWARD_REPO:-SufZen/Dreamward}"
DOMAIN=""
LOCAL=0
LAN=0
PORT=8080
VERSION="latest"
DIR=""
YES=0

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  \033[36m›\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
die() { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --local) LOCAL=1; shift ;;
    --lan) LAN=1; LOCAL=1; shift ;;
    --port) PORT="${2:-8080}"; shift 2 ;;
    --version) VERSION="${2:-latest}"; shift 2 ;;
    --dir) DIR="${2:-}"; shift 2 ;;
    --repo) REPO="${2:-$REPO}"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) sed -n '2,20p' "$0" 2>/dev/null || true; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done

interactive() { [ "$YES" -eq 0 ] && [ -t 0 -o -r /dev/tty ]; }
ask() { # ask "question" default → echoes answer
  local q="$1" def="${2:-}" ans=""
  if interactive; then
    printf '  ? %s%s: ' "$q" "${def:+ [$def]}" > /dev/tty
    read -r ans < /dev/tty || true
  fi
  printf '%s' "${ans:-$def}"
}

bold "Dreamward installer"

# ── Requirements ──────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "Docker is required: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (the 'docker compose' command)."
docker info >/dev/null 2>&1 || die "Cannot talk to Docker. Is it running? (Linux: try with sudo, or add yourself to the docker group.)"
command -v curl >/dev/null 2>&1 || die "curl is required."
rand() { if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32; else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi; }

# ── Version ───────────────────────────────────────────────────────────────
if [ "$VERSION" = "latest" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p' | head -1)
  [ -n "$VERSION" ] || die "Could not determine the latest release of $REPO (use --version)."
fi
VERSION="${VERSION#v}"
if [ "$VERSION" = "edge" ]; then REF="main"; else REF="v$VERSION"; fi
info "version $VERSION"

# ── Folder ────────────────────────────────────────────────────────────────
if [ -z "$DIR" ]; then
  if [ "$(id -u)" -eq 0 ]; then DIR=/opt/dreamward; else DIR="$HOME/dreamward"; fi
fi
mkdir -p "$DIR" "$DIR/packs"
cd "$DIR"
info "folder $DIR"

# ── Files (compose, Caddyfile, lifecycle tool) ────────────────────────────
RAW="https://raw.githubusercontent.com/$REPO/$REF/deploy"
for f in docker-compose.yml Caddyfile dreamward-ctl .env.example; do
  curl -fsSL "$RAW/$f" -o "$f.new" || die "Download failed: $RAW/$f"
  mv "$f.new" "$f"
done
chmod +x dreamward-ctl

# ── Settings (.env) — created once, never overwritten ─────────────────────
if [ -f .env ]; then
  info ".env exists — keeping your settings and secrets"
  if grep -q '^DREAMWARD_VERSION=' .env; then
    sed "s/^DREAMWARD_VERSION=.*/DREAMWARD_VERSION=$VERSION/" .env > .env.tmp && cat .env.tmp > .env && rm -f .env.tmp
  else
    echo "DREAMWARD_VERSION=$VERSION" >> .env
  fi
else
  if [ -z "$DOMAIN" ] && [ "$LOCAL" -eq 0 ]; then
    DOMAIN=$(ask "Domain for HTTPS (leave empty to run locally without a domain)" "")
    [ -z "$DOMAIN" ] && LOCAL=1
  fi
  if [ "$LOCAL" -eq 1 ] && [ "$LAN" -eq 0 ] && interactive; then
    case "$(ask "Reachable from other devices on your network? (y/N)" "n")" in y|Y|yes) LAN=1 ;; esac
  fi

  if [ "$LOCAL" -eq 1 ]; then
    if [ "$LAN" -eq 1 ]; then
      HOST_IP=$( (hostname -I 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || echo localhost) | awk '{print $1}')
      ORIGIN="http://$HOST_IP:$PORT"; BIND="0.0.0.0"
    else
      ORIGIN="http://localhost:$PORT"; BIND="127.0.0.1"
    fi
    PROFILES=""; SECURE=false; PRIVATE_AI=true
  else
    ORIGIN="https://$DOMAIN"; BIND="127.0.0.1"; PROFILES="https"; SECURE=true; PRIVATE_AI=false
  fi

  umask 077
  cat > .env <<EOF
# Dreamward settings — generated by install.sh on $(date -u +%Y-%m-%d).
# KEEP A COPY OF THIS FILE SOMEWHERE SAFE (password manager).
DREAMWARD_VERSION=$VERSION
COMPOSE_PROFILES=$PROFILES
DOMAIN=$DOMAIN
PUBLIC_ORIGIN=$ORIGIN
COOKIE_SECURE=$SECURE
WEB_BIND=$BIND
WEB_PORT=$PORT
JWT_SECRET=$(rand)
KEY_ENCRYPTION_SECRET=$(rand)
MAX_USERS=10
BACKUP_HOUR=3
BACKUP_RETENTION_DAYS=14
TZ=$( (cat /etc/timezone 2>/dev/null || echo UTC) | head -1)
ALLOW_PRIVATE_AI_URLS=$PRIVATE_AI
CODEX_ENABLED=false
EOF
  chmod 600 .env
  info "created .env with fresh secrets"
fi

# ── Start ─────────────────────────────────────────────────────────────────
bold "Pulling images and starting…"
docker compose pull
docker compose up -d

PORT_NOW=$(sed -n 's/^WEB_PORT=//p' .env | head -1); PORT_NOW="${PORT_NOW:-8080}"
printf '  waiting for the server'
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:$PORT_NOW/api/health" >/dev/null 2>&1; then printf ' ✓\n'; break; fi
  printf '.'; sleep 2
done
curl -fsS "http://127.0.0.1:$PORT_NOW/api/health" >/dev/null 2>&1 || { echo; warn "Not healthy yet — check: ./dreamward-ctl logs api"; exit 1; }

# ── Lifecycle tool on PATH (root only) ────────────────────────────────────
if [ "$(id -u)" -eq 0 ] && [ -d /usr/local/bin ]; then
  ln -sf "$DIR/dreamward-ctl" /usr/local/bin/dreamward-ctl
fi

ORIGIN_NOW=$(sed -n 's/^PUBLIC_ORIGIN=//p' .env | head -1)
echo
bold "Dreamward is running: $ORIGIN_NOW"
TOKEN=$(docker compose exec -T api cat /data/setup-token 2>/dev/null | tr -d '\r\n' || true)
if [ -n "$TOKEN" ]; then
  bold "Create your admin account (one-time link):"
  echo "    $ORIGIN_NOW/setup?token=$TOKEN"
fi
echo
info "Manage it with: $( [ "$(id -u)" -eq 0 ] && echo dreamward-ctl || echo "$DIR/dreamward-ctl") status | update | backup | logs | doctor"
info "Your data: volume dreamward_data · backups: volume dreamward_backups (copy them off this machine!)"
[ -z "$(sed -n 's/^DOMAIN=//p' .env)" ] && info "Running without a domain. For internet access use a domain (re-install with --domain) or a tunnel (Cloudflare/Tailscale)."
