import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/lib.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  // Bundle EVERYTHING (workspace packages + MCP SDK + zod) — dist/index.js is a
  // single self-contained file that runs anywhere with just `node`, including
  // dropped into an agent container with no node_modules.
  noExternal: [/.*/],
  // No shared chunks: dist/index.js must stay ONE self-contained file.
  splitting: false,
});
