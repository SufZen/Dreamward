/* ============================================================================
 * apps/api — scripts/seed-admin-provider.ts
 * Deploy-time helper: upserts an OpenRouter provider into the ADMIN user's
 * dreamward, reading the key from ADMIN_OPENROUTER_KEY (never from argv — keys
 * in argv leak into shell history and process listings).
 *   docker compose exec api node dist/scripts/seed-admin-provider.js
 * Model default: the most capable free OpenRouter model (override with
 * ADMIN_OPENROUTER_MODEL).
 * ========================================================================= */
import { eq } from 'drizzle-orm';
import { loadEnv } from '../env';
import { resolveDataDir } from '../lib/paths';
import { openControlDb, controlSchema } from '../db/control';
import { runAsUser } from '../db/registry';
import { getDb, schema } from '../db/client';
import { encryptSecret } from '../lib/crypto';
import { uuid, nowMs } from '../lib/id';

const PROVIDER_NAME = 'OpenRouter (admin)';
const DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

async function main() {
  const env = loadEnv();
  const key = env.ADMIN_OPENROUTER_KEY;
  if (!key) {
    console.error('ADMIN_OPENROUTER_KEY is not set — nothing to seed.');
    process.exit(1);
  }
  const model = process.env.ADMIN_OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const dataRoot = resolveDataDir(env.DATA_DIR);
  const control = openControlDb(dataRoot);
  const admin = control
    .select()
    .from(controlSchema.controlUsers)
    .where(eq(controlSchema.controlUsers.role, 'admin'))
    .get();
  if (!admin) {
    console.error('No admin account exists yet — start the server once first.');
    process.exit(1);
  }

  runAsUser(admin.id, 'admin', () => {
    const db = getDb();
    const existing = db
      .select()
      .from(schema.llmProviders)
      .where(eq(schema.llmProviders.name, PROVIDER_NAME))
      .get();
    const ts = nowMs();
    if (existing) {
      db.update(schema.llmProviders)
        .set({ apiKey: encryptSecret(key), model, updatedAt: ts, toolsDetected: null })
        .where(eq(schema.llmProviders.id, existing.id))
        .run();
      console.log(`[seed-provider] updated "${PROVIDER_NAME}" (model ${model}) for ${admin.email}`);
    } else {
      const id = uuid();
      db.transaction(() => {
        db.update(schema.llmProviders).set({ isActive: 0 }).run();
        db.insert(schema.llmProviders)
          .values({
            id,
            name: PROVIDER_NAME,
            kind: 'openai-compat',
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: encryptSecret(key),
            model,
            toolsMode: 'auto',
            isActive: 1,
            createdAt: ts,
            updatedAt: ts,
          })
          .run();
      });
      console.log(`[seed-provider] created "${PROVIDER_NAME}" (model ${model}) for ${admin.email} — active`);
    }
  });
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-provider] failed:', err);
  process.exit(1);
});
