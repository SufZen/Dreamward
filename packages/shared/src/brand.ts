/* ============================================================================
 * The product's identity in one place. Code that shows or embeds the name
 * (UI, MCP server, CLI, desktop app, user agents, calendar feed) reads it
 * from here. Data-format names are not brand and never change: the per-user
 * database file, the session cookie, API-key and export-archive formats.
 * ========================================================================= */
export const BRAND = {
  name: 'Dreamward',
  slug: 'dreamward',
  tagline: { en: 'Move toward the life you envision', he: 'להתקדם אל החיים שאתם מדמיינים' },
  /** The personal assistant's name: the same in every language (never translated). */
  companion: { en: 'Clarity', he: 'Clarity' },
  site: 'https://dreamward.life',
  repo: 'SufZen/Dreamward',
  repoUrl: 'https://github.com/SufZen/Dreamward',
  docsUrl: 'https://github.com/SufZen/Dreamward/tree/main/docs',
  /** npm package that is both the CLI and the MCP server (`npx -y dreamward mcp`). */
  cliPackage: 'dreamward',
  cliBin: 'dreamward',
  mcpServerName: 'dreamward',
  resourceScheme: 'dreamward',
  envPrefix: 'DREAMWARD_',
} as const;

/** Reads DREAMWARD_<name> from `env` (Node: process.env). */
export function brandEnv(name: string, env: Record<string, string | undefined>): string | undefined {
  const v = env[`${BRAND.envPrefix}${name}`];
  return v !== undefined && v !== '' ? v : undefined;
}
