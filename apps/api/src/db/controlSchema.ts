/* ============================================================================
 * apps/api — db/controlSchema.ts
 * Control-plane schema (control.db): accounts, invites, audit trail and AI
 * usage accounting. Content lives in per-user DBs (users/<uid>/lifebook.db)
 * defined by ./schema.ts — this DB only knows WHO exists and what they did.
 * ========================================================================= */
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const now = sql`(unixepoch() * 1000)`;

export const controlUsers = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // admin | user
  status: text('status').notNull().default('active'), // active | disabled
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
  lastLoginAt: integer('last_login_at'),
});

export const invites = sqliteTable('invites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token: text('token').notNull().unique(), // url-safe random, single use
  note: text('note'), // admin label, e.g. invitee name/email
  createdBy: integer('created_by').notNull(),
  createdAt: integer('created_at').notNull().default(now),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  usedBy: integer('used_by'), // user id created from this invite
});

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ts: integer('ts').notNull().default(now),
    userId: integer('user_id'), // null for anonymous events (failed logins)
    event: text('event').notNull(), // login.success, login.failed, invite.created, user.disabled, ...
    detail: text('detail'), // JSON string, secrets must never be written here
    ip: text('ip'),
  },
  (t) => [index('audit_ts_idx').on(t.ts)],
);

/** Personal API keys for programmatic agent access (MCP / CLI / REST v1). */
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    name: text('name').notNull(), // "Claude Code on desktop"
    scope: text('scope').notNull().default('read'), // read | write
    tokenHash: text('token_hash').notNull().unique(), // SHA-256 hex of the full token
    tokenPrefix: text('token_prefix').notNull(), // first 12 chars, for display
    createdAt: integer('created_at').notNull().default(now),
    lastUsedAt: integer('last_used_at'),
    revokedAt: integer('revoked_at'), // never hard-deleted — preserves audit joins
  },
  (t) => [index('api_keys_user_idx').on(t.userId)],
);

export const aiUsage = sqliteTable(
  'ai_usage',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ts: integer('ts').notNull().default(now),
    userId: integer('user_id').notNull(),
    providerName: text('provider_name').notNull(),
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    estimated: integer('estimated').notNull().default(0), // 1 = chars/4 fallback, no usage from provider
  },
  (t) => [index('ai_usage_user_ts_idx').on(t.userId, t.ts)],
);
