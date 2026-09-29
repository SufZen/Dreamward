import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { loginSchema, changePasswordSchema } from '@dreamward/shared';
import { getControlDb, controlSchema, audit, type Role } from '../db/control';

export default async function authRoutes(app: FastifyInstance) {
  // Login — rate-limited to blunt brute force (argon2 already makes it costly).
  app.post('/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });

    const db = getControlDb();
    const user = db
      .select()
      .from(controlSchema.controlUsers)
      .where(eq(controlSchema.controlUsers.email, parsed.data.email.toLowerCase()))
      .get();
    if (!user || user.status !== 'active') {
      audit('login.failed', { detail: { email: parsed.data.email }, ip: req.ip });
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const ok = await argon2.verify(user.passwordHash, parsed.data.password).catch(() => false);
    if (!ok) {
      audit('login.failed', { userId: user.id, ip: req.ip });
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    db.update(controlSchema.controlUsers)
      .set({ lastLoginAt: Date.now() })
      .where(eq(controlSchema.controlUsers.id, user.id))
      .run();
    audit('login.success', { userId: user.id, ip: req.ip });
    app.issueSession(reply, { uid: user.id, role: user.role as Role });
    return { user: { id: user.id, email: user.email, role: user.role } };
  });

  app.post('/logout', async (_req, reply) => {
    app.clearSession(reply);
    return { ok: true };
  });

  app.get('/me', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const user = getControlDb()
      .select()
      .from(controlSchema.controlUsers)
      .where(eq(controlSchema.controlUsers.id, req.uid!))
      .get();
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { user: { id: user.id, email: user.email, role: user.role } };
  });

  app.post('/password', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });

    const db = getControlDb();
    const user = db
      .select()
      .from(controlSchema.controlUsers)
      .where(eq(controlSchema.controlUsers.id, req.uid!))
      .get();
    if (!user) return reply.code(401).send({ error: 'unauthorized' });

    const ok = await argon2.verify(user.passwordHash, parsed.data.currentPassword).catch(() => false);
    if (!ok) return reply.code(403).send({ error: 'wrong_password' });

    const hash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
    db.update(controlSchema.controlUsers)
      .set({ passwordHash: hash, updatedAt: Date.now() })
      .where(eq(controlSchema.controlUsers.id, user.id))
      .run();
    audit('password.changed', { userId: user.id, ip: req.ip });
    return { ok: true };
  });
}
