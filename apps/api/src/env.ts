import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Dev convenience: load a .env file (repo root or package dir) via Node's
// native loader when required vars are absent. Production sets real env.
let envFileTried = false;
function tryLoadEnvFile(): void {
  if (envFileTried) return;
  envFileTried = true;
  for (const p of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {
        /* malformed .env — fall through to validation errors */
      }
      return;
    }
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  /** Bind address. The desktop app always binds 127.0.0.1. */
  HOST: z.string().default('0.0.0.0'),
  DATA_DIR: z.string().default('./data'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  /** Encrypts LLM API keys / OAuth tokens at rest (AES-256-GCM). */
  KEY_ENCRYPTION_SECRET: z.string().min(16).optional(),
  /**
   * Optional first admin account (automation). Used only when the control DB
   * is empty. When unset, the server prints a one-time setup link instead and
   * the admin is created in the browser (/setup).
   */
  DREAMWARD_EMAIL: z.string().email().optional(),
  DREAMWARD_PASSWORD: z.string().optional(),
  /** Hard cap on accounts (invites refuse beyond this). */
  MAX_USERS: z.coerce.number().int().positive().default(10),
  /** Optional: seed-admin-provider script reads the OpenRouter key from here. */
  ADMIN_OPENROUTER_KEY: z.string().optional(),
  /** Feature flag for the experimental "Sign in with ChatGPT" (Codex) provider. */
  CODEX_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  PUBLIC_ORIGIN: z.string().default('http://localhost:5173'),

  /* ── Backups & upgrade safety ─────────────────────────────────────────── */
  /** Where scheduled + pre-upgrade backups go. Default: ${DATA_DIR}/backups. Use its own volume. */
  BACKUP_DIR: z.string().optional(),
  BACKUP_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** Local hour (0-23) for the daily backup. */
  BACKUP_HOUR: z.coerce.number().int().min(0).max(23).default(3),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).default(14),
  /** Escape hatch: start even if the data was written by a NEWER version (not recommended). */
  ALLOW_DOWNGRADE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /**
   * Allow AI provider base URLs that resolve to private / loopback addresses
   * (local Ollama, LM Studio…). Unset → allowed for single-user installs and
   * in development, refused on multi-user servers (SSRF protection).
   */
  ALLOW_PRIVATE_AI_URLS: z.enum(['true', 'false']).optional(),

  /** Optional custom framework pack (JSON) — the wording of the book's structure. */
  FRAMEWORK_PACK_FILE: z.string().optional(),

  /* ── Desktop app ──────────────────────────────────────────────────────── */
  /**
   * Single-person desktop mode (set by the Electron shell): one local account,
   * no login screen (the shell obtains the session with DESKTOP_TOKEN), no
   * invites, localhost only.
   */
  DESKTOP_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Per-launch secret the desktop shell uses to open the local session. */
  DESKTOP_TOKEN: z.string().min(32).optional(),
  /** Serve the built web app from this folder (desktop; Docker uses nginx instead). */
  WEB_DIST_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Docker/K8s secrets: FOO_FILE=/run/secrets/foo populates FOO when FOO is unset. */
function applyFileSecrets(): void {
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.endsWith('_FILE') || !value) continue;
    const target = key.slice(0, -'_FILE'.length);
    if (process.env[target]) continue;
    try {
      process.env[target] = readFileSync(value, 'utf8').trim();
    } catch {
      throw new Error(`${key} points to an unreadable file: ${value}`);
    }
  }
}

let warnedInsecure = false;

export function loadEnv(): Env {
  applyFileSecrets();
  if (!process.env.JWT_SECRET) tryLoadEnvFile();
  // Compose files pass unset variables as empty strings (FOO=${FOO:-}) — treat those as unset.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.DESKTOP_MODE) {
    if (!env.DESKTOP_TOKEN) throw new Error('DESKTOP_TOKEN is required in desktop mode');
    env.HOST = '127.0.0.1'; // never reachable from the network
    env.MAX_USERS = 1;
    env.ALLOW_PRIVATE_AI_URLS ??= 'true'; // local models (Ollama, LM Studio) just work
  }
  if (env.NODE_ENV === 'production') {
    // Fail fast on configurations that silently weaken production security.
    // HTTPS deployments must use Secure cookies. A plain-HTTP origin (home
    // server on the LAN, localhost) is allowed without them, with a warning.
    const httpsOrigin = env.PUBLIC_ORIGIN.startsWith('https://');
    if (httpsOrigin && !env.COOKIE_SECURE) throw new Error('COOKIE_SECURE must be "true" when PUBLIC_ORIGIN is https://');
    if (!httpsOrigin && !warnedInsecure) {
      warnedInsecure = true;
      console.warn(`[env] PUBLIC_ORIGIN is ${env.PUBLIC_ORIGIN} (plain HTTP) — fine on a trusted LAN or localhost; use HTTPS for anything reachable from the internet.`);
    }
    if (env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 chars in production');
    if (!env.KEY_ENCRYPTION_SECRET) throw new Error('KEY_ENCRYPTION_SECRET is required in production');
    if (env.DREAMWARD_PASSWORD !== undefined && (env.DREAMWARD_PASSWORD.length < 8 || env.DREAMWARD_PASSWORD === 'change-me')) {
      throw new Error('DREAMWARD_PASSWORD must be at least 8 characters (or leave it unset and use the setup link)');
    }
  }
  return env;
}
