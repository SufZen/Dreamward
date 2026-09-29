import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getControlDb, controlSchema, type Role } from '../db/control';

export const SESSION_COOKIE = 'lb_session';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export interface SessionPayload {
  uid: number;
  role: Role;
}

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    issueSession: (reply: FastifyReply, payload: SessionPayload) => void;
    clearSession: (reply: FastifyReply) => void;
  }
  interface FastifyRequest {
    uid?: number;
    role?: Role;
  }
}

interface AuthOptions {
  jwtSecret: string;
  cookieSecure: boolean;
}

export default fp<AuthOptions>(async (app, opts) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: opts.jwtSecret,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
  });

  app.decorate('issueSession', (reply: FastifyReply, payload: SessionPayload) => {
    const token = app.jwt.sign(payload, { expiresIn: THIRTY_DAYS });
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: opts.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: THIRTY_DAYS,
    });
  });

  app.decorate('clearSession', (reply: FastifyReply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
  });

  app.decorate('requireAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await req.jwtVerify<SessionPayload>();
      // Re-check account status on every request so disabling a user kills
      // their live sessions immediately (cheap indexed lookup, sync driver).
      const user = getControlDb()
        .select({ role: controlSchema.controlUsers.role, status: controlSchema.controlUsers.status })
        .from(controlSchema.controlUsers)
        .where(eq(controlSchema.controlUsers.id, decoded.uid))
        .get();
      if (!user || user.status !== 'active') {
        reply.code(401).send({ error: 'unauthorized' });
        return;
      }
      req.uid = decoded.uid;
      req.role = user.role as Role; // role from DB, not token — demotions apply instantly
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireAuth(req, reply);
    if (reply.sent) return;
    if (req.role !== 'admin') {
      reply.code(403).send({ error: 'forbidden' });
    }
  });
});
