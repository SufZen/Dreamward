// Copies what the bundled API needs at runtime next to it: the database
// migrations, the built web app and the app icon.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const repo = join(app, '..', '..');
const dist = join(app, 'dist');

const webDist = join(repo, 'apps', 'web', 'dist');
if (!existsSync(join(webDist, 'index.html'))) {
  console.error('apps/web/dist is missing — build the web app first (pnpm build, or pnpm --filter @dreamward/web build).');
  process.exit(1);
}

rmSync(join(dist, 'api', 'drizzle'), { recursive: true, force: true });
cpSync(join(repo, 'apps', 'api', 'drizzle'), join(dist, 'api', 'drizzle'), { recursive: true });
rmSync(join(dist, 'web'), { recursive: true, force: true });
cpSync(webDist, join(dist, 'web'), { recursive: true });
cpSync(join(app, 'build', 'icon.png'), join(dist, 'icon.png'));
console.log('assembled dist/ (api + migrations + web + icon)');
