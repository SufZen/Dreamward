import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { createJournalSchema, updateJournalSchema } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { uuid, nowMs } from '../lib/id';

export default async function journalRoutes(app: FastifyInstance) {
  app.get('/journal', async (req) => {
    const { q, from, to } = req.query as { q?: string; from?: string; to?: string };
    const db = getDb();

    if (q && q.trim()) {
      // FTS5 search → rowids → entries
      const term = q.trim().replace(/["']/g, ' ');
      const hits = db.all<{ rowid: number }>(
        sql`SELECT rowid FROM journal_fts WHERE journal_fts MATCH ${term + '*'} ORDER BY rank`,
      );
      if (hits.length === 0) return [];
      const ids = hits.map((h) => h.rowid);
      const rows = db.all(
        sql`SELECT * FROM journal_entries WHERE rowid IN (${sql.join(ids, sql`, `)}) ORDER BY entry_date DESC`,
      );
      return rows;
    }

    let rows = db.select().from(schema.journalEntries).orderBy(desc(schema.journalEntries.entryDate)).all();
    if (from) rows = rows.filter((r) => r.entryDate >= Number(from));
    if (to) rows = rows.filter((r) => r.entryDate <= Number(to));
    return rows;
  });

  app.post('/journal', async (req, reply) => {
    const parsed = createJournalSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const id = uuid();
    const ts = nowMs();
    db.insert(schema.journalEntries)
      .values({
        id,
        entryDate: parsed.data.entryDate ?? ts,
        title: parsed.data.title ?? null,
        bodyRichtext: parsed.data.bodyRichtext ?? '',
        mood: parsed.data.mood ?? null,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
    return db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id)).get();
  });

  app.get('/journal/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id)).get();
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return row;
  });

  app.put('/journal/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateJournalSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const db = getDb();
    const updatedAt = nowMs();
    const res = db
      .update(schema.journalEntries)
      .set({ ...parsed.data, updatedAt })
      .where(eq(schema.journalEntries.id, id))
      .run();
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    return { ok: true, updatedAt };
  });

  app.delete('/journal/:id', async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, id)).run();
    return { ok: true };
  });
}
