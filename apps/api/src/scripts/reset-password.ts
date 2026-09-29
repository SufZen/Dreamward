/* ============================================================================
 * apps/api — scripts/reset-password.ts
 * CLI recovery: reset any account's password by email (control DB).
 *   pnpm --filter @dreamward/api reset-password user@example.com "new-password"
 * ========================================================================= */
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { loadEnv } from '../env';
import { resolveDataDir } from '../lib/paths';
import { openControlDb, controlSchema, audit } from '../db/control';

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  if (!email || !newPassword || newPassword.length < 8) {
    console.error('Usage: reset-password <email> "<new-password>" (min 8 chars)');
    process.exit(1);
  }
  const dataRoot = resolveDataDir(loadEnv().DATA_DIR);
  const db = openControlDb(dataRoot);
  const user = db
    .select()
    .from(controlSchema.controlUsers)
    .where(eq(controlSchema.controlUsers.email, email.toLowerCase()))
    .get();
  if (!user) {
    console.error(`No account with email ${email}.`);
    process.exit(1);
  }
  const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
  db.update(controlSchema.controlUsers)
    .set({ passwordHash: hash, updatedAt: Date.now() })
    .where(eq(controlSchema.controlUsers.id, user.id))
    .run();
  audit('password.reset_cli', { userId: user.id });
  console.log(`Password reset for ${user.email}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
