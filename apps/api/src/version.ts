/* Resolves the app version from the API package.json at runtime.
 * Works under tsx (src/), the tsup bundle (dist/), and the Docker image
 * (WORKDIR /repo/apps/api). Falls back to '0.0.0' if not found. */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/** Set at build time by bundles that don't ship package.json (the desktop app). */
declare const __DREAMWARD_VERSION__: string | undefined;

function readVersion(): string {
  if (typeof __DREAMWARD_VERSION__ === 'string') return __DREAMWARD_VERSION__;
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    resolve(here, '../package.json'), // dist/version.js -> apps/api/package.json
    resolve(here, '../../package.json'), // src/version.ts -> apps/api/package.json
    resolve(process.cwd(), 'package.json'),
  ]) {
    try {
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string; version?: string };
        if (pkg.name === '@dreamward/api' && pkg.version) return pkg.version;
      }
    } catch {
      /* keep trying */
    }
  }
  return '0.0.0';
}

export const APP_VERSION = readVersion();
