import { defineConfig } from 'drizzle-kit';

// DB path is resolved at runtime; drizzle-kit only needs it for push/studio.
const dataDir = process.env.DATA_DIR ?? './data';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: `${dataDir}/lifebook.db`,
  },
});
