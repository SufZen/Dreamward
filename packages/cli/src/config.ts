/* ============================================================================
 * dreamward — config.ts
 * Credentials: env vars (DREAMWARD_URL / DREAMWARD_API_KEY) override the file
 * written by `dreamward login` (~/.dreamward/config.json, 0600 on POSIX).
 * ========================================================================= */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliConfig {
  url: string;
  apiKey: string;
}

const dir = join(homedir(), '.dreamward');
const file = join(dir, 'config.json');
const envVar = (name: string) => process.env[`DREAMWARD_${name}`] || undefined;

export function saveConfig(cfg: CliConfig): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  try {
    chmodSync(file, 0o600);
  } catch {
    /* windows — ACLs apply instead */
  }
  return file;
}

export function loadConfig(): CliConfig | null {
  const url = envVar('URL');
  const apiKey = envVar('API_KEY');
  if (url && apiKey) return { url, apiKey };

  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<CliConfig>;
    if (parsed.url && parsed.apiKey) {
      return { url: url ?? parsed.url, apiKey: apiKey ?? parsed.apiKey };
    }
  } catch {
    /* malformed file → treat as not logged in */
  }
  return null;
}

export function requireConfig(): CliConfig {
  const cfg = loadConfig();
  if (!cfg) {
    console.error('Not configured. Run: dreamward login --url <server> --key <lbk_…>');
    console.error('(or set DREAMWARD_URL and DREAMWARD_API_KEY)');
    process.exit(1);
  }
  return cfg;
}
