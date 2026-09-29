/* ============================================================================
 * apps/api — lib/apiKeys.ts
 * Personal API keys for programmatic agent access. Tokens are high-entropy
 * random (256 bits), so a fast deterministic SHA-256 (not argon2) is the right
 * at-rest hash: offline brute force is infeasible and lookup stays O(1) via
 * the unique index on token_hash. The raw token is shown exactly once.
 * ========================================================================= */
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getControlDb, controlSchema } from '../db/control';

export const TOKEN_PREFIX = 'lbk_';
const PREFIX_DISPLAY_LEN = 12;
/** last_used_at writes are throttled to once a minute per key. */
const LAST_USED_BUMP_MS = 60_000;

export type ApiKeyScope = 'read' | 'write';

export interface ResolvedApiKey {
  keyId: number;
  uid: number;
  scope: ApiKeyScope;
  name: string;
}

export function generateApiKey(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function displayPrefix(token: string): string {
  return token.slice(0, PREFIX_DISPLAY_LEN);
}

/**
 * Resolves a bearer token to its owner. Returns null for unknown, revoked,
 * or disabled-user keys — the caller answers 401 without detail.
 */
export function resolveApiKey(token: string): ResolvedApiKey | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const db = getControlDb();
  const row = db
    .select({
      id: controlSchema.apiKeys.id,
      userId: controlSchema.apiKeys.userId,
      scope: controlSchema.apiKeys.scope,
      name: controlSchema.apiKeys.name,
      revokedAt: controlSchema.apiKeys.revokedAt,
      lastUsedAt: controlSchema.apiKeys.lastUsedAt,
    })
    .from(controlSchema.apiKeys)
    .where(eq(controlSchema.apiKeys.tokenHash, hashApiKey(token)))
    .get();
  if (!row || row.revokedAt !== null) return null;

  const user = db
    .select({ status: controlSchema.controlUsers.status })
    .from(controlSchema.controlUsers)
    .where(eq(controlSchema.controlUsers.id, row.userId))
    .get();
  if (!user || user.status !== 'active') return null;

  const now = Date.now();
  if (row.lastUsedAt === null || now - row.lastUsedAt > LAST_USED_BUMP_MS) {
    db.update(controlSchema.apiKeys)
      .set({ lastUsedAt: now })
      .where(eq(controlSchema.apiKeys.id, row.id))
      .run();
  }

  return { keyId: row.id, uid: row.userId, scope: row.scope as ApiKeyScope, name: row.name };
}
