#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# One-time Dreamward VPS bootstrap (Coolify host — Traefik already owns 80/443).
# Run as root on the VPS. Idempotent: safe to re-run.
#
#   DREAMWARD_DOMAIN=dreamward.example.com \
#   DREAMWARD_EMAIL=you@example.com \
#   DREAMWARD_PASSWORD='strong-password' \
#   ADMIN_OPENROUTER_KEY='sk-or-...' \
#   bash setup-vps.sh
#
# After this, deploys are driven by GitHub Actions (release.yml). The first
# deploy is triggered with:  gh workflow run release.yml -f tag=v0.1.0
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="${DREAMWARD_DOMAIN:?set DREAMWARD_DOMAIN}"
EMAIL="${DREAMWARD_EMAIL:?set DREAMWARD_EMAIL}"
PASSWORD="${DREAMWARD_PASSWORD:?set DREAMWARD_PASSWORD}"
OPENROUTER_KEY="${ADMIN_OPENROUTER_KEY:-}"

mkdir -p /opt/dreamward
cd /opt/dreamward

if [ ! -f .env ]; then
  cat > .env <<EOF
DREAMWARD_DOMAIN=${DOMAIN}
PUBLIC_ORIGIN=https://${DOMAIN}
JWT_SECRET=$(openssl rand -hex 32)
KEY_ENCRYPTION_SECRET=$(openssl rand -hex 32)
DREAMWARD_EMAIL=${EMAIL}
DREAMWARD_PASSWORD=${PASSWORD}
MAX_USERS=10
ADMIN_OPENROUTER_KEY=${OPENROUTER_KEY}
CODEX_ENABLED=true
TAG=latest
EOF
  chmod 600 .env
  echo "[setup] wrote /opt/dreamward/.env (secrets generated)"
else
  echo "[setup] /opt/dreamward/.env exists — leaving it untouched"
fi

# The compose file is shipped by the deploy workflow; nothing else to do here.
echo "[setup] done. Next: add repo secrets VPS_HOST/VPS_USER/VPS_SSH_KEY and run the Release workflow."
