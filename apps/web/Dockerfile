# ── Dreamward Web (static) ────────────────────────────────────────────────────
FROM node:26-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/design-system/package.json packages/design-system/

RUN pnpm install --frozen-lockfile --filter @dreamward/web...

COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter @dreamward/web build

FROM nginx:1.27-alpine AS run
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
