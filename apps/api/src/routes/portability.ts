/* ============================================================================
 * apps/api — routes/portability.ts
 * Self-service data portability for the signed-in account:
 *   GET  /me/export                    → download the whole book (.zip)
 *   POST /me/import?confirm=replace    → replace the book with an export
 * The previous book is always moved to BACKUP_DIR/pre-import/, never deleted.
 * ========================================================================= */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { controlSchema, getControlDb, audit } from '../db/control';
import { ImportError, exportAccount, importAccount } from '../services/portability';

const MAX_IMPORT_BYTES = 1024 * 1024 * 1024; // 1 GB — books with many images

export default async function portabilityRoutes(app: FastifyInstance) {
  app.get('/me/export', async (req, reply) => {
    const uid = req.uid!;
    const user = getControlDb()
      .select({ email: controlSchema.controlUsers.email })
      .from(controlSchema.controlUsers)
      .where(eq(controlSchema.controlUsers.id, uid))
      .get();
    const { zip, manifest } = exportAccount(uid, user?.email ?? null);
    audit('account.exported', { userId: uid, detail: { bytes: zip.byteLength, version: manifest.appVersion }, ip: req.ip });
    const date = manifest.exportedAt.slice(0, 10);
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="lifebook-export-${date}.zip"`)
      .header('Cache-Control', 'no-store')
      .send(Buffer.from(zip));
  });

  app.post('/me/import', async (req, reply) => {
    const { confirm } = req.query as { confirm?: string };
    if (confirm !== 'replace') {
      return reply.code(400).send({
        error: 'confirmation_required',
        message: 'Importing replaces your current book. Repeat with ?confirm=replace.',
      });
    }
    const file = await req.file({ limits: { fileSize: MAX_IMPORT_BYTES } });
    if (!file) return reply.code(400).send({ error: 'file_required' });
    const archive = new Uint8Array(await file.toBuffer());
    try {
      const { manifest, previous } = importAccount(req.uid!, archive);
      audit('account.imported', { userId: req.uid!, detail: { fromVersion: manifest.appVersion, previous }, ip: req.ip });
      return { ok: true, importedFrom: manifest.appVersion, exportedAt: manifest.exportedAt };
    } catch (err) {
      if (err instanceof ImportError) return reply.code(err.status).send({ error: err.code, message: err.message });
      throw err;
    }
  });
}
