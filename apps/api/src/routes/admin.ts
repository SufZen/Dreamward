/* ============================================================================
 * apps/api — routes/admin.ts
 * Admin control plane (mounted under /api/admin, requireAdmin):
 * user lifecycle, invite links, per-user usage/storage and the audit trail.
 * Control-DB only — never opens another user's content DB.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { and, desc, eq, gte, count, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInviteSchema, adminResetPasswordSchema } from '@dreamward/shared';
import { loadEnv } from '../env';
import { resolveDataDir, userDataRoot, usersRoot } from '../lib/paths';
import { lastBackup, listBackups, runBackup } from '../services/backup';
import { unavailableUsers } from '../db/registry';
import { getControlDb, controlSchema, audit, controlDbPath } from '../db/control';
import { deleteUserData } from '../db/registry';
import { APP_VERSION } from '../version';

/** Recursive directory size — user trees are small (images + one DB). */
function dirSize(path: string): number {
  let total = 0;
  let entries: string[];
  try {
    entries = readdirSync(path);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(path, entry);
    try {
      const info = statSync(full);
      total += info.isDirectory() ? dirSize(full) : info.size;
    } catch {
      /* file vanished mid-walk — ignore */
    }
  }
  return total;
}

// dirSize() walks the filesystem; cache results 5 min so GET /users doesn't
// re-walk every request. Bust an entry when a user is deleted.
const SIZE_TTL_MS = 5 * 60 * 1000;
const sizeCache = new Map<number, { bytes: number; at: number }>();
function cachedDirSize(dataRoot: string, uid: number): number {
  const hit = sizeCache.get(uid);
  if (hit && Date.now() - hit.at < SIZE_TTL_MS) return hit.bytes;
  const bytes = dirSize(userDataRoot(dataRoot, uid));
  sizeCache.set(uid, { bytes, at: Date.now() });
  return bytes;
}

export default async function adminRoutes(app: FastifyInstance) {
  const env = loadEnv();
  const dataRoot = resolveDataDir(env.DATA_DIR);

  // ── Users ─────────────────────────────────────────────────────────────────
  app.get('/users', async () => {
    const db = getControlDb();
    const users = db.select().from(controlSchema.controlUsers).all();
    const usage = db
      .select({
        userId: controlSchema.aiUsage.userId,
        promptTokens: sql<number>`COALESCE(SUM(${controlSchema.aiUsage.promptTokens}), 0)`,
        completionTokens: sql<number>`COALESCE(SUM(${controlSchema.aiUsage.completionTokens}), 0)`,
      })
      .from(controlSchema.aiUsage)
      .groupBy(controlSchema.aiUsage.userId)
      .all();
    const usageBy = new Map(usage.map((u) => [u.userId, u]));
    return {
      maxUsers: env.MAX_USERS,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        storageBytes: cachedDirSize(dataRoot, u.id),
        promptTokens: usageBy.get(u.id)?.promptTokens ?? 0,
        completionTokens: usageBy.get(u.id)?.completionTokens ?? 0,
      })),
    };
  });

  app.post('/users/:id/disable', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (id === req.uid) return reply.code(400).send({ error: 'cannot_disable_self' });
    const db = getControlDb();
    const user = db.select().from(controlSchema.controlUsers).where(eq(controlSchema.controlUsers.id, id)).get();
    if (!user) return reply.code(404).send({ error: 'not_found' });
    db.update(controlSchema.controlUsers)
      .set({ status: 'disabled', updatedAt: Date.now() })
      .where(eq(controlSchema.controlUsers.id, id))
      .run();
    audit('user.disabled', { userId: req.uid, detail: { targetId: id }, ip: req.ip });
    return { ok: true };
  });

  app.post('/users/:id/enable', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getControlDb();
    const user = db.select().from(controlSchema.controlUsers).where(eq(controlSchema.controlUsers.id, id)).get();
    if (!user) return reply.code(404).send({ error: 'not_found' });
    db.update(controlSchema.controlUsers)
      .set({ status: 'active', updatedAt: Date.now() })
      .where(eq(controlSchema.controlUsers.id, id))
      .run();
    audit('user.enabled', { userId: req.uid, detail: { targetId: id }, ip: req.ip });
    return { ok: true };
  });

  app.post('/users/:id/reset-password', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = adminResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getControlDb();
    const user = db.select().from(controlSchema.controlUsers).where(eq(controlSchema.controlUsers.id, id)).get();
    if (!user) return reply.code(404).send({ error: 'not_found' });
    const hash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
    db.update(controlSchema.controlUsers)
      .set({ passwordHash: hash, updatedAt: Date.now() })
      .where(eq(controlSchema.controlUsers.id, id))
      .run();
    audit('user.password_reset', { userId: req.uid, detail: { targetId: id }, ip: req.ip });
    return { ok: true };
  });

  // Destructive: removes the account AND the whole users/<id>/ data tree.
  app.delete('/users/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (id === req.uid) return reply.code(400).send({ error: 'cannot_delete_self' });
    const db = getControlDb();
    const user = db.select().from(controlSchema.controlUsers).where(eq(controlSchema.controlUsers.id, id)).get();
    if (!user) return reply.code(404).send({ error: 'not_found' });
    if (user.role === 'admin') return reply.code(400).send({ error: 'cannot_delete_admin' });
    deleteUserData(id);
    sizeCache.delete(id);
    db.delete(controlSchema.controlUsers).where(eq(controlSchema.controlUsers.id, id)).run();
    audit('user.deleted', { userId: req.uid, detail: { targetId: id, email: user.email }, ip: req.ip });
    return { ok: true };
  });

  // ── Invites ───────────────────────────────────────────────────────────────
  app.post('/invites', async (req, reply) => {
    const parsed = createInviteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getControlDb();
    const total = db.select({ n: count() }).from(controlSchema.controlUsers).get()?.n ?? 0;
    if (total >= env.MAX_USERS) return reply.code(409).send({ error: 'max_users_reached' });

    const token = randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + (parsed.data.expiresInDays ?? 7) * 24 * 60 * 60 * 1000;
    const invite = db
      .insert(controlSchema.invites)
      .values({ token, note: parsed.data.note ?? null, createdBy: req.uid!, expiresAt })
      .returning()
      .get();
    audit('invite.created', { userId: req.uid, detail: { inviteId: invite.id, note: invite.note }, ip: req.ip });
    return { invite, url: `${env.PUBLIC_ORIGIN}/invite/${token}` };
  });

  app.get('/invites', async () => {
    const invites = getControlDb()
      .select()
      .from(controlSchema.invites)
      .orderBy(desc(controlSchema.invites.createdAt))
      .all();
    return { invites, publicOrigin: env.PUBLIC_ORIGIN };
  });

  app.delete('/invites/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getControlDb();
    const invite = db.select().from(controlSchema.invites).where(eq(controlSchema.invites.id, id)).get();
    if (!invite) return reply.code(404).send({ error: 'not_found' });
    if (invite.usedAt) return reply.code(409).send({ error: 'already_used' });
    db.delete(controlSchema.invites).where(eq(controlSchema.invites.id, id)).run();
    audit('invite.revoked', { userId: req.uid, detail: { inviteId: id }, ip: req.ip });
    return { ok: true };
  });

  // ── Audit trail (filterable by event + user) ────────────────────────────────
  app.get('/audit', async (req) => {
    const q = req.query as { limit?: string; event?: string; userId?: string };
    const limit = Math.min(Number(q.limit ?? 100), 500);
    const filters = [];
    if (q.event) filters.push(eq(controlSchema.auditLog.event, q.event));
    if (q.userId) filters.push(eq(controlSchema.auditLog.userId, Number(q.userId)));
    const rows = getControlDb()
      .select()
      .from(controlSchema.auditLog)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(controlSchema.auditLog.ts))
      .limit(limit)
      .all();
    return { events: rows };
  });

  // ── AI usage: per-day per-user series + per-model rollup ────────────────────
  app.get('/usage', async (req) => {
    const q = req.query as { days?: string; userId?: string };
    const days = Math.min(Math.max(Number(q.days ?? 30), 1), 365);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const db = getControlDb();

    const where = [gte(controlSchema.aiUsage.ts, since)];
    if (q.userId) where.push(eq(controlSchema.aiUsage.userId, Number(q.userId)));

    // ai_usage.ts is epoch-ms → date(ts/1000,'unixepoch') gives YYYY-MM-DD (UTC)
    const dayExpr = sql<string>`date(${controlSchema.aiUsage.ts} / 1000, 'unixepoch')`;
    const daily = db
      .select({
        day: dayExpr,
        userId: controlSchema.aiUsage.userId,
        promptTokens: sql<number>`COALESCE(SUM(${controlSchema.aiUsage.promptTokens}), 0)`,
        completionTokens: sql<number>`COALESCE(SUM(${controlSchema.aiUsage.completionTokens}), 0)`,
      })
      .from(controlSchema.aiUsage)
      .where(and(...where))
      .groupBy(dayExpr, controlSchema.aiUsage.userId)
      .orderBy(dayExpr)
      .all();

    const byModel = db
      .select({
        model: controlSchema.aiUsage.model,
        promptTokens: sql<number>`COALESCE(SUM(${controlSchema.aiUsage.promptTokens}), 0)`,
        completionTokens: sql<number>`COALESCE(SUM(${controlSchema.aiUsage.completionTokens}), 0)`,
        estimated: sql<number>`MAX(${controlSchema.aiUsage.estimated})`,
      })
      .from(controlSchema.aiUsage)
      .where(and(...where))
      .groupBy(controlSchema.aiUsage.model)
      .all();

    return {
      days,
      daily,
      byModel: byModel.map((m) => ({ ...m, estimated: m.estimated === 1 })),
    };
  });

  // ── System info ─────────────────────────────────────────────────────────────
  app.get('/system', async () => {
    let controlDbBytes = 0;
    try {
      controlDbBytes = statSync(controlDbPath(dataRoot)).size;
    } catch {
      /* ignore */
    }
    let userDataBytes = 0;
    const root = usersRoot(dataRoot);
    if (existsSync(root)) {
      for (const d of readdirSync(root)) if (/^\d+$/.test(d)) userDataBytes += dirSize(join(root, d));
    }
    const last = lastBackup();
    const lastBackupAt = last ? last.createdAt : null;
    return {
      version: APP_VERSION,
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      controlDbBytes,
      userDataBytes,
      lastBackupAt,
      lastBackupOk: last ? last.ok : null,
      unavailableAccounts: unavailableUsers(),
    };
  });

  // ── Backups ─────────────────────────────────────────────────────────────────
  app.get('/backups', async () => ({ last: lastBackup(), items: listBackups() }));

  app.post('/backups', async (req) => {
    const result = await runBackup('manual');
    audit('backup.run', { userId: req.uid ?? null, detail: { id: result.id, ok: result.ok } });
    return result;
  });
}
