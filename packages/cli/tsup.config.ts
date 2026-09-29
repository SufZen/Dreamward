import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  // createRequire shim: bundled CommonJS deps (commander) can require Node builtins from ESM.
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import { createRequire as __lbCreateRequire } from 'node:module';",
      'const require = __lbCreateRequire(import.meta.url);',
    ].join('\n'),
  },
  // Self-contained: bundles the client, the MCP server (for `dreamward mcp`) and commander.
  noExternal: [/.*/],
  splitting: false,
});
