/* ============================================================================
 * apps/api — routes/invites.ts
 * Public invite-acceptance flow: an admin-generated one-time link lets the
 * invitee create their own account (email + password). No SMTP involved —
 * the admin copies the link out of the dashboard and sends it themselves.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { eq, count } from 'drizzle-orm';
import { acceptInviteSchema } from '@dreamward/shared';
import { loadEnv } from '../env';
import { getControlDb, controlSchema, audit, type Role } from '../db/control';
import { provisionUser } from '../db/registry';

function findInvite(token: string) {
  return getControlDb().select().from(controlSchema.invites).where(eq(controlSchema.invites.token, token)).get();
}

export default async function inviteRoutes(app: FastifyInstance) {
  // Probe validity (the invite page calls this before showing the form).
  app.get('/:token', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { token } = req.params as { token: string };
    const invite = findInvite(token);
    if (!invite) return reply.code(404).send({ error: 'not_found' });
    if (invite.usedAt) return reply.code(410).send({ error: 'already_used' });
    if (invite.expiresAt < Date.now()) return reply.code(410).send({ error: 'expired' });
    return { valid: true, note: invite.note };
  });

  app.post('/:token/accept', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { token } = req.params as { token: string };
    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });

    const db = getControlDb();
    const invite = findInvite(token);
    if (!invite) return reply.code(404).send({ error: 'not_found' });
    if (invite.usedAt) return reply.code(410).send({ error: 'already_used' });
    if (invite.expiresAt < Date.now()) return reply.code(410).send({ error: 'expired' });

    const env = loadEnv();
    const total = db.select({ n: count() }).from(controlSchema.controlUsers).get()?.n ?? 0;
    if (total >= env.MAX_USERS) return reply.code(409).send({ error: 'max_users_reached' });

    const email = parsed.data.email.toLowerCase();
    const exists = db.select().from(controlSchema.controlUsers).where(eq(controlSchema.controlUsers.email, email)).get();
    if (exists) return reply.code(409).send({ error: 'email_taken' });

    const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
    const user = db
      .insert(controlSchema.controlUsers)
      .values({ email, passwordHash, role: 'user', status: 'active' })
      .returning()
      .get();

    db.update(controlSchema.invites)
      .set({ usedAt: Date.now(), usedBy: user.id })
      .where(eq(controlSchema.invites.id, invite.id))
      .run();

    // Build the user's isolated workspace (own DB + assets + structural seed).
    provisionUser(user.id);

    audit('invite.accepted', { userId: user.id, detail: { inviteId: invite.id }, ip: req.ip });
    app.issueSession(reply, { uid: user.id, role: user.role as Role });
    return { user: { id: user.id, email: user.email, role: user.role } };
  });
}
