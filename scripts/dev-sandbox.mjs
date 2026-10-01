#!/usr/bin/env node
/* ============================================================================
 * Dev server against a throwaway sandbox — never against real data.
 *
 *   node scripts/dev-sandbox.mjs          (or the "dreamward-sandbox" launch config)
 *
 * Runs the API (:4000) and web app (:5173) in dev mode with DATA_DIR and BACKUP_DIR in
 * a sandbox folder under the OS temp dir (SANDBOX_DIR overrides it). A test
 * account and fresh secrets are generated on first run and kept in
 * <sandbox>/sandbox.json, so the sandbox survives restarts. Delete the folder
 * to start over. Any local .env is ignored.
 * ========================================================================= */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.env.SANDBOX_DIR || join(tmpdir(), 'dreamward-sandbox'));
const stateFile = join(dir, 'sandbox.json');
mkdirSync(join(dir, 'data'), { recursive: true });
mkdirSync(join(dir, 'backups'), { recursive: true });

const secret = () => randomBytes(24).toString('hex');
try {
  // 'wx': create only if it doesn't exist yet (no check-then-write race).
  writeFileSync(
    stateFile,
    JSON.stringify({ email: 'sandbox@example.test', password: `sandbox-${secret().slice(0, 16)}`, jwtSecret: secret(), keySecret: secret() }, null, 2),
    { mode: 0o600, flag: 'wx' },
  );
} catch (err) {
  if (err.code !== 'EEXIST') throw err; // existing sandbox: keep its account
}
const state = JSON.parse(readFileSync(stateFile, 'utf8'));

console.log(`[sandbox] data in ${dir} — sign in with the account in ${stateFile}`);
// Only the API and the web app (the root `pnpm dev` also starts the CLI and the
// desktop shell). Run through pnpm, not turbo: turbo's strict env mode drops
// DATA_DIR & co., and the API would then fall back to a local .env.
const child = spawn('pnpm --parallel --filter @dreamward/api --filter @dreamward/web run dev', {
  cwd: repo,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    // The web dev server proxies /api to :4000; a PORT inherited from a launcher would hijack it.
    PORT: '4000',
    DATA_DIR: join(dir, 'data'),
    BACKUP_DIR: join(dir, 'backups'),
    // Setting the secrets here also keeps the API from loading a local .env.
    JWT_SECRET: state.jwtSecret,
    KEY_ENCRYPTION_SECRET: state.keySecret,
    DREAMWARD_EMAIL: state.email,
    DREAMWARD_PASSWORD: state.password,
    PUBLIC_ORIGIN: 'http://localhost:5173',
  },
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
