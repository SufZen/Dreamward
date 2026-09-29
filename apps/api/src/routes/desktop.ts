/* ============================================================================
 * apps/api — routes/desktop.ts
 * Desktop mode (DESKTOP_MODE=true, set by the Electron shell). The app is one
 * person's book on their own computer: there is exactly one local account and
 * no login screen. The shell generates a random DESKTOP_TOKEN per launch,
 * passes it to this server through the environment, and exchanges it here for
 * the normal session cookie — so another program or a web page on the same
 * machine cannot open the book without that token.
 * ========================================================================= */
import argon2 from 'argon2';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { controlSchema, createAdmin, getControlDb, type Role } from '../db/control';

export const DESKTOP_EMAIL = 'me@desktop.local';

/** The single local account — created on first launch with an unusable random password. */
export async function ensureDesktopUser(): Promise<number> {
  const existing = getControlDb()
    .select({ id: controlSchema.controlUsers.id })
    .from(controlSchema.controlUsers)
    .orderBy(controlSchema.controlUsers.id)
    .limit(1)
    .all();
  if (existing.length) return existing[0]!.id;
  const hash = await argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
  return createAdmin(DESKTOP_EMAIL, hash);
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function desktopRoutes(app: FastifyInstance, opts: { token: string; userId: number }) {
  app.post('/session', async (req, reply) => {
    const presented = req.headers['x-desktop-token'];
    if (typeof presented !== 'string' || !sameSecret(presented, opts.token)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const user = getControlDb()
      .select({ role: controlSchema.controlUsers.role, status: controlSchema.controlUsers.status })
      .from(controlSchema.controlUsers)
      .where(eq(controlSchema.controlUsers.id, opts.userId))
      .get();
    if (!user || user.status !== 'active') return reply.code(409).send({ error: 'account_unavailable' });
    app.issueSession(reply, { uid: opts.userId, role: user.role as Role });
    return { ok: true };
  });
}
