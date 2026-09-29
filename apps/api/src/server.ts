import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, resolve, sep, extname } from 'node:path';
import { loadEnv } from './env';
import { resolveDataDir } from './lib/paths';
import { openControlDb, ensureAdminUser, closeControlDb } from './db/control';
import { runWithDbContext, getUserDataRoot } from './db/client';
import { openUserDb, provisionUser, migrateAllUsers, isUserUnavailable, unavailableUsers, closeAllUserDbs } from './db/registry';
import { bundledMigrations } from './db/migrate';
import { CONTROL_MIGRATIONS } from './db/control';
import { APP_VERSION } from './version';
import { activeFramework } from './lib/framework';
import { migrateLegacyLayout } from './scripts/migrate-to-multiuser';
import authPlugin, { SESSION_COOKIE } from './plugins/auth';
import apiKeyAuthPlugin from './plugins/apiKeyAuth';
import apiAuditPlugin from './plugins/apiAudit';
import authRoutes from './routes/auth';
import inviteRoutes from './routes/invites';
import adminRoutes from './routes/admin';
import calendarRoutes from './routes/calendar';
import setupRoutes from './routes/setup';
import desktopRoutes, { ensureDesktopUser } from './routes/desktop';
import { prepareSetup } from './services/setup';
import { openApiDocument, OPENAPI_DOCS_HTML } from './openapi';
import { registerFeatureRoutes, registerAgentApiRoutes } from './routes/index';

const MEDIA_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

export async function buildServer() {
  const env = loadEnv();
  activeFramework(); // validate a custom framework pack before touching any data
  const dataRoot = resolveDataDir(env.DATA_DIR);

  // Boot order matters: legacy layout move → control DB → admin account.
  const legacy = migrateLegacyLayout(dataRoot);
  openControlDb(dataRoot);
  const adminId = env.DESKTOP_MODE
    ? await ensureDesktopUser() // one local account, no login screen
    : await ensureAdminUser({ email: env.DREAMWARD_EMAIL, password: env.DREAMWARD_PASSWORD, legacy });
  if (adminId !== null) provisionUser(adminId, 'admin'); // idempotent — migrates + structural seed
  if (!env.DESKTOP_MODE) prepareSetup(dataRoot, env.PUBLIC_ORIGIN); // no accounts yet -> one-time setup link
  // Upgrade every workspace now (snapshot → migrate → stamp). A downgrade throws.
  const upgrade = migrateAllUsers();
  if (upgrade.failed.length) console.error(`[upgrade] ${upgrade.failed.length} account(s) unavailable — see logs`);

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      // Secrets must never reach the logs.
      redact: ['req.headers.authorization', 'req.headers.cookie', '*.apiKey', '*.password', '*.token'],
    },
    bodyLimit: 25 * 1024 * 1024, // 25MB — accommodates image uploads
    trustProxy: true, // behind Traefik/nginx in production — req.ip = client ip
  });

  // Global backstop: 300 req/min per client IP (trustProxy gives the real ip
  // behind Traefik/nginx). Login keeps its own much stricter 5/min override.
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
  await app.register(authPlugin, { jwtSecret: env.JWT_SECRET, cookieSecure: env.COOKIE_SECURE });
  await app.register(apiKeyAuthPlugin);

  // Minimal security headers (the reverse proxy adds HSTS in production).
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'DENY');
  });

  // ── Public routes ────────────────────────────────────────────────────────
  // Liveness + version info for healthchecks, the updater and support requests.
  app.get('/api/health', async () => ({
    ok: true,
    version: APP_VERSION,
    desktop: env.DESKTOP_MODE,
    schema: { user: bundledMigrations().length, control: CONTROL_MIGRATIONS.length },
    unavailableAccounts: unavailableUsers().length,
  }));

  // ── Auth routes (control-DB only — no user-DB context needed) ────────────
  await app.register(authRoutes, { prefix: '/api/auth' });

  // ── Desktop shell → local session (token-gated; desktop mode only) ───────
  if (env.DESKTOP_MODE && adminId !== null) {
    await app.register(desktopRoutes, { prefix: '/api/desktop', token: env.DESKTOP_TOKEN!, userId: adminId });
  }

  // ── First-run setup (public; only works while no account exists) ────────
  await app.register(setupRoutes, { prefix: '/api/setup' });

  // ── Public invite acceptance (rate-limited inside the routes) ────────────
  await app.register(inviteRoutes, { prefix: '/api/invites' });

  // ── Admin control plane (control-DB only, admin role enforced) ───────────
  await app.register(
    async (scoped) => {
      scoped.addHook('onRequest', scoped.requireAdmin);
      await scoped.register(adminRoutes);
    },
    { prefix: '/api/admin' },
  );

  /**
   * Enters the per-user DB context for everything downstream. Must run AFTER
   * requireAuth. The done-callback form keeps the ALS store alive for the
   * whole request lifecycle (handlers + async iterators inherit it).
   */
  const enterUserContext = (
    req: { uid?: number; role?: 'admin' | 'user'; log: { error: (o: unknown, m?: string) => void } },
    reply: { code: (c: number) => { send: (b: unknown) => void } },
    done: () => void,
  ) => {
    const uid = req.uid!;
    if (isUserUnavailable(uid)) {
      reply.code(503).send({ error: 'account_unavailable', message: 'Your workspace could not be upgraded. Your data is safe; please contact the administrator.' });
      return;
    }
    let handle;
    try {
      handle = openUserDb(uid);
    } catch (err) {
      req.log.error(err, `[upgrade] opening workspace ${uid} failed`);
      reply.code(503).send({ error: 'account_unavailable' });
      return;
    }
    runWithDbContext({ uid, role: req.role ?? 'user', ...handle }, done);
  };

  // ── Protected per-user media ──────────────────────────────────────────────
  await app.register(async (scoped) => {
    scoped.addHook('onRequest', scoped.requireAuth);
    scoped.addHook('onRequest', enterUserContext);
    scoped.get('/media/*', async (req, reply) => {
      const assetsRoot = join(getUserDataRoot(), 'assets');
      const rel = (req.params as Record<string, string>)['*'] ?? '';
      const abs = resolve(assetsRoot, rel);
      if (abs !== assetsRoot && !abs.startsWith(assetsRoot + sep)) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      try {
        const info = await stat(abs);
        if (!info.isFile()) return reply.code(404).send({ error: 'not_found' });
        reply.header('Content-Type', MEDIA_TYPES[extname(abs).toLowerCase()] ?? 'application/octet-stream');
        reply.header('Content-Length', info.size);
        reply.header('Cache-Control', 'private, max-age=86400');
        return reply.send(createReadStream(abs));
      } catch {
        return reply.code(404).send({ error: 'not_found' });
      }
    });
  });

  // ── Protected API feature routes ──────────────────────────────────────────
  await app.register(
    async (scoped) => {
      scoped.addHook('onRequest', scoped.requireAuth);
      scoped.addHook('onRequest', enterUserContext);
      await registerFeatureRoutes(scoped);
    },
    { prefix: '/api' },
  );

  // ── Calendar feed (query-param key auth — calendar apps can't send headers)
  // Mounted under /api so the Vite dev proxy and Caddy forward it unchanged.
  await app.register(calendarRoutes, { prefix: '/api' });

  // ── Agent API description (public — describes the API, contains no data) ──
  app.get('/api/v1/openapi.json', async () => openApiDocument());
  app.get('/api/v1/docs', async (_req, reply) => reply.type('text/html').send(OPENAPI_DOCS_HTML));

  // ── Agent API (/api/v1) — bearer API-key auth for MCP / CLI / agents ──────
  await app.register(
    async (scoped) => {
      scoped.addHook('onRequest', scoped.requireApiKey);
      scoped.addHook('onRequest', enterUserContext);
      // read-scope keys are read-only: any non-GET/HEAD method is refused
      scoped.addHook('onRequest', async (req, reply) => {
        if (req.apiKey?.scope === 'read' && req.method !== 'GET' && req.method !== 'HEAD') {
          reply.code(403).send({ error: 'insufficient_scope' });
        }
      });
      // per-key rate limit, stricter than the global per-IP backstop
      await scoped.register(rateLimit, {
        max: 120,
        timeWindow: '1 minute',
        keyGenerator: (req) => `key:${req.apiKey?.id ?? req.ip}`,
      });
      await scoped.register(apiAuditPlugin);
      await registerAgentApiRoutes(scoped);
    },
    { prefix: '/api/v1' },
  );

  // ── The web app itself (desktop; the Docker image serves it with nginx) ──
  if (env.WEB_DIST_DIR) {
    const webRoot = resolve(env.WEB_DIST_DIR);
    const fastifyStatic = (await import('@fastify/static')).default;
    await app.register(fastifyStatic, { root: webRoot, prefix: '/', wildcard: false });
    // Client-side routes (/chapter, /ikigai…) get the SPA shell; unknown API paths stay 404.
    app.setNotFoundHandler((req, reply) => {
      const path = req.url.split('?')[0]!;
      if (req.method === 'GET' && !path.startsWith('/api/') && !path.startsWith('/media/')) {
        return reply.header('Cache-Control', 'no-cache').sendFile('index.html', webRoot);
      }
      return reply.code(404).send({ error: 'not_found' });
    });
  }

  app.setErrorHandler((err: { statusCode?: number; message?: string }, req, reply) => {
    req.log.error(err);
    const status = err.statusCode ?? 500;
    reply.code(status).send({ error: status === 500 ? 'internal_error' : (err.message ?? 'error') });
  });

  return { app, env, dataRoot };
}

/** Builds the server, listens on HOST:PORT, starts the scheduler and shuts down cleanly. */
export async function startServer() {
  const built = await buildServer();
  const { app, env } = built;
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Dreamward API listening on ${env.HOST}:${env.PORT}`);
  const scheduler = env.NODE_ENV !== 'test' ? await import('./services/scheduler') : null;
  scheduler?.startScheduler();

  // Graceful stop (docker stop, desktop quit/update): finish in-flight
  // requests, then close every database so nothing is left mid-write.
  let stopping = false;
  const shutdown = async (reason: string) => {
    if (stopping) return;
    stopping = true;
    app.log.info(`Shutting down (${reason})`);
    const force = setTimeout(() => process.exit(0), 10_000);
    force.unref();
    try {
      scheduler?.stopScheduler();
      await app.close();
    } finally {
      closeAllUserDbs();
      closeControlDb();
      process.exit(0);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  // Electron utility process (desktop app): the shell asks politely over the parent port.
  const parentPort = (process as unknown as { parentPort?: { on: (e: 'message', cb: (m: { data?: unknown }) => void) => void } }).parentPort;
  parentPort?.on('message', (m) => {
    if ((m.data as { type?: string } | undefined)?.type === 'shutdown') void shutdown('desktop');
  });
  // Same over a Node IPC channel (desktop dev mode; Windows has no real SIGTERM).
  if (process.send) {
    process.on('message', (m: { type?: string } | undefined) => {
      if (m?.type === 'shutdown') void shutdown('parent');
    });
  }
  return built;
}

// Bootstrap when run directly.
const isMain = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isMain) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { SESSION_COOKIE, join };
