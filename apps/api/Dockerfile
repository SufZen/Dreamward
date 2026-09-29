# ── Dreamward API ─────────────────────────────────────────────────────────────
# Multi-arch (amd64/arm64). Native deps are Node-API modules with prebuilt
# binaries: better-sqlite3 ships them inside the package (its install script is
# skipped); sharp and argon2 fetch/verify theirs in the build stage (approved in
# root package.json `pnpm.onlyBuiltDependencies`). The toolchain below is only a
# fallback for platforms without a prebuild.

FROM node:26-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# Manifests first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @dreamward/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @dreamward/api build
# Pruned, self-contained production copy: package.json + dist + drizzle + prod node_modules.
RUN pnpm --filter @dreamward/api deploy --legacy --prod /out \
    && rm -rf /out/src /out/data /out/Dockerfile

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:26-bookworm-slim AS run
ENV NODE_ENV=production \
    DATA_DIR=/data \
    BACKUP_DIR=/backups \
    PORT=4000
WORKDIR /app
COPY --from=build /out /app
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data /backups && chown -R node:node /data /backups

# The server runs as the unprivileged `node` user; the entrypoint starts as
# root only to fix ownership of volumes created by older (root) versions.
VOLUME ["/data", "/backups"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
# Boot: control DB + every account are integrity-checked, snapshotted and migrated.
CMD ["node", "dist/server.js"]
