import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/db/migrate.ts', 'src/db/seed.ts', 'src/scripts/reset-password.ts', 'src/scripts/seed-admin-provider.ts', 'src/scripts/gc-assets.ts', 'src/scripts/admin.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Native + heavy deps stay external (resolved from node_modules at runtime).
  external: ['better-sqlite3', 'sharp', 'argon2'],
  // Bundle the workspace package so dist is self-contained for that contract.
  noExternal: ['@dreamward/shared'],
});
