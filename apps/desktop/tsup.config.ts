import { defineConfig } from 'tsup';
import pkg from './package.json' with { type: 'json' };

export default defineConfig([
  // Electron main + preload (CommonJS — what Electron loads fastest and most reliably).
  {
    entry: { main: 'src/main.ts', preload: 'src/preload.ts' },
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    platform: 'node',
    target: 'node22',
    outDir: 'dist',
    clean: true,
    external: ['electron', 'electron-updater'],
  },
  // The Dreamward API as one ESM file. Only the three native modules stay
  // external: they are installed next to the app and rebuilt for Electron.
  {
    entry: { 'api/start': '../api/src/start.ts' },
    format: ['esm'],
    outExtension: () => ({ js: '.mjs' }),
    platform: 'node',
    target: 'node22',
    outDir: 'dist',
    clean: false,
    splitting: false,
    external: ['better-sqlite3', 'sharp', 'argon2'],
    noExternal: [/^(?!better-sqlite3$|sharp$|argon2$)/],
    define: { __DREAMWARD_VERSION__: JSON.stringify(pkg.version) },
    // Bundled CommonJS deps may require() Node builtins from inside ESM.
    banner: {
      js: ["import { createRequire as __lbCreateRequire } from 'node:module';", 'const require = __lbCreateRequire(import.meta.url);'].join('\n'),
    },
  },
]);
