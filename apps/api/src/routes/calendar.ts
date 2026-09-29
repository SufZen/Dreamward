/* ============================================================================
 * apps/api — routes/calendar.ts
 * ICS calendar feed: actions with due dates + goals with target dates.
 * Calendar apps cannot send headers, so this ONE route authenticates with a
 * ?key= query param. Only READ-scope keys are accepted — a leaked feed URL
 * must never grant write access. Registered outside the /api scopes with its
 * own context entry.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { isNull } from 'drizzle-orm';
import { runWithDbContext, schema, type DB } from '../db/client';
import { openUserDb } from '../db/registry';
import { resolveApiKey } from '../lib/apiKeys';
import { buildIcs, type IcsEvent } from '../lib/ics';

export default async function calendarRoutes(app: FastifyInstance) {
  app.get('/feeds/calendar.ics', async (req, reply) => {
    const { key } = req.query as { key?: string };
    const resolved = key ? resolveApiKey(key) : null;
    if (!resolved) return reply.code(401).send({ error: 'unauthorized' });
    // Write keys are refused here: feed URLs get pasted into calendar apps
    // and sync services — keep the blast radius of a leak read-only… and
    // actually not even read-everything, just this feed.
    if (resolved.scope !== 'read') {
      return reply.code(403).send({ error: 'read_scope_key_required' });
    }

    const handle = openUserDb(resolved.uid);
    const ics = runWithDbContext({ uid: resolved.uid, role: 'user', ...handle }, () => buildFeed(handle.db));

    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', 'inline; filename="dreamward.ics"');
    reply.header('Cache-Control', 'private, max-age=300');
    return reply.send(ics);
  });
}

function buildFeed(db: DB): string {
  const events: IcsEvent[] = [];

  const actions = db.select().from(schema.actions).where(isNull(schema.actions.deletedAt)).all();
  for (const a of actions) {
    if (a.dueDate === null) continue;
    events.push({
      uid: `action-${a.id}`,
      date: a.dueDate,
      summary: a.title,
      description: a.description ?? undefined,
      done: a.status === 'done',
    });
  }

  const goals = db.select().from(schema.goals).all();
  for (const g of goals) {
    if (g.targetDate === null) continue;
    events.push({
      uid: `goal-${g.id}`,
      date: g.targetDate,
      summary: `🎯 ${g.title}`,
      description: g.description ?? undefined,
      done: g.status === 'achieved',
    });
  }

  return buildIcs('Dreamward', events);
}
