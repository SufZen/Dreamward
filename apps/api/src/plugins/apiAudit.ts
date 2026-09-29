/* ============================================================================
 * apps/api — plugins/apiAudit.ts
 * Audit trail for the /api/v1 agent surface: every mutation is recorded in
 * the per-user api_activity table, including the row's prior state on
 * update/delete (cheap recoverability without schema churn). Read requests
 * are not logged. Secrets never appear here — the payload summary is a
 * truncated JSON body and v1 exposes no secret-bearing routes.
 * ========================================================================= */
import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { getDb, schema, type DB } from '../db/client';
import { uuid, nowMs } from '../lib/id';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SUMMARY_MAX = 500;

/** v1 path segment → { entityType, table used for prior-state capture }. */
const RESOURCES: Record<string, { entity: string; table?: { id: { name: string } } & object }> = {
  actions: { entity: 'action', table: schema.actions },
  goals: { entity: 'goal', table: schema.goals },
  journal: { entity: 'journal_entry', table: schema.journalEntries },
  sections: { entity: 'section', table: schema.categorySections },
  'content-blocks': { entity: 'content_block', table: schema.contentBlocks },
  'life-vision': { entity: 'life_vision', table: schema.lifeVisionPrompts },
  moodboards: { entity: 'moodboard', table: schema.moodboards },
  chapters: { entity: 'chapter', table: schema.lifeChapters },
  ratings: { entity: 'rating', table: schema.categoryRatings },
  ikigai: { entity: 'ikigai', table: schema.ikigaiProfiles },
};

const VERB: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

interface AuditCapture {
  db: DB;
  action: string | null;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  priorState: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auditCapture?: AuditCapture;
  }
}

function parseV1Path(url: string): { resource: string; id: string | null } | null {
  const path = url.split('?')[0]!;
  const m = path.match(/^\/api\/v1\/([a-z-]+)(?:\/([^/]+))?/);
  if (!m) return null;
  const id = m[2] && m[2] !== 'reorder' && m[2] !== 'markdown' ? m[2] : null;
  return { resource: m[1]!, id };
}

/** Registered ONLY inside the /api/v1 scope (after auth + tenant context). */
export default fp(
  async (app) => {
    app.addHook('preHandler', async (req: FastifyRequest) => {
      if (!MUTATING.has(req.method) || !req.apiKey) return;
      const db = getDb(); // capture while the ALS context is guaranteed alive
      const parsed = parseV1Path(req.url);
      const res = parsed ? RESOURCES[parsed.resource] : undefined;

      let priorState: string | null = null;
      if (parsed?.id && res?.table && req.method !== 'POST') {
        try {
          const table = res.table as typeof schema.actions;
          const row = db.select().from(table).where(eq(table.id, parsed.id)).get();
          if (row) priorState = JSON.stringify(row);
        } catch {
          /* prior-state capture is best-effort */
        }
      }

      let summary: string | null = null;
      if (req.body !== undefined && req.body !== null) {
        try {
          summary = JSON.stringify(req.body).slice(0, SUMMARY_MAX);
        } catch {
          summary = null;
        }
      }

      req.auditCapture = {
        db,
        action: res && parsed ? `${res.entity}.${VERB[req.method]}` : null,
        entityType: res?.entity ?? null,
        entityId: parsed?.id ?? null,
        summary,
        priorState,
      };
    });

    app.addHook('onResponse', async (req, reply) => {
      const cap = req.auditCapture;
      if (!cap || !req.apiKey) return;
      try {
        cap.db
          .insert(schema.apiActivity)
          .values({
            id: uuid(),
            ts: nowMs(),
            keyId: req.apiKey.id,
            keyName: req.apiKey.name,
            method: req.method,
            path: req.url.split('?')[0]!.slice(0, 300),
            action: cap.action,
            entityType: cap.entityType,
            entityId: cap.entityId,
            summary: cap.summary,
            priorState: cap.priorState,
            status: reply.statusCode,
          })
          .run();
      } catch (err) {
        // Auditing must never take down a request.
        req.log.error({ err }, 'api_activity write failed');
      }
    });
  },
  { name: 'api-audit' },
);
