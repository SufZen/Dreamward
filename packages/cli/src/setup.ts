/* ============================================================================
 * dreamward — setup.ts
 * `dreamward setup <agent>` — connects an AI agent/harness to your Dreamward by
 * writing (or printing) its MCP configuration. Dry-run by default: shows the
 * file and the exact change; `--write` applies it (backup: <file>.bak).
 *
 * The launch command defaults to THIS CLI (`node <cli> mcp`) so it works
 * before anything is published; `--npx` uses `npx -y dreamward mcp`.
 * ========================================================================= */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

export interface Launch {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface AgentTarget {
  id: string;
  label: string;
  /** config file path (absent → print-only / command-based) */
  file?: () => string;
  format?: 'json-mcpServers' | 'json-vscode' | 'json-opencode' | 'toml-codex';
  /** extra guidance printed after */
  notes?: string;
  /** command-based setup (e.g. `claude mcp add`) */
  command?: (l: Launch) => string[];
}

const home = homedir();
const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');

export const AGENTS: AgentTarget[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    command: (l) => ['claude', 'mcp', 'add', 'dreamward', '--scope', 'user', ...Object.entries(l.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), '--', l.command, ...l.args],
    notes: 'Then in Claude Code: /mcp to check it is connected; try the prompt /dreamward:weekly-review.',
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    format: 'json-mcpServers',
    file: () =>
      platform() === 'win32'
        ? join(appData, 'Claude', 'claude_desktop_config.json')
        : platform() === 'darwin'
          ? join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
          : join(home, '.config', 'Claude', 'claude_desktop_config.json'),
    notes: 'Restart Claude Desktop. Rituals appear under the "+" → Dreamward prompts.',
  },
  { id: 'cursor', label: 'Cursor', format: 'json-mcpServers', file: () => join(home, '.cursor', 'mcp.json') },
  {
    id: 'windsurf',
    label: 'Windsurf',
    format: 'json-mcpServers',
    file: () => join(home, '.codeium', 'windsurf', 'mcp_config.json'),
  },
  {
    id: 'vscode',
    label: 'VS Code (this workspace)',
    format: 'json-vscode',
    file: () => resolve('.vscode', 'mcp.json'),
    notes: 'Workspace-level config — do not commit it (it contains your key). For all workspaces use "MCP: Add Server" in VS Code.',
  },
  { id: 'gemini', label: 'Gemini CLI', format: 'json-mcpServers', file: () => join(home, '.gemini', 'settings.json') },
  { id: 'codex', label: 'Codex CLI', format: 'toml-codex', file: () => join(process.env.CODEX_HOME ?? join(home, '.codex'), 'config.toml') },
  {
    id: 'opencode',
    label: 'OpenCode',
    format: 'json-opencode',
    file: () => join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), 'opencode', 'opencode.json'),
  },
  {
    id: 'other',
    label: 'Any other MCP client (Hermes, n8n MCP Client, custom)',
    notes:
      'Use the JSON above. n8n: an "MCP Client" node with this command, or plain "HTTP Request" nodes against /api/v1 with header Authorization: Bearer <key> (OpenAPI: /api/v1/openapi.json).',
  },
];

/* ── format writers ─────────────────────────────────────────────────────── */

function readJson(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {};
  const raw = readFileSync(file, 'utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${file} is not plain JSON (comments?). Add this manually:\n`);
  }
}

export function applyJson(format: NonNullable<AgentTarget['format']>, file: string, l: Launch): string {
  const cfg = readJson(file);
  if (format === 'json-mcpServers') {
    const servers = (cfg.mcpServers as Record<string, unknown>) ?? {};
    servers.dreamward = { command: l.command, args: l.args, env: l.env };
    cfg.mcpServers = servers;
  } else if (format === 'json-vscode') {
    const servers = (cfg.servers as Record<string, unknown>) ?? {};
    servers.dreamward = { type: 'stdio', command: l.command, args: l.args, env: l.env };
    cfg.servers = servers;
  } else if (format === 'json-opencode') {
    const mcp = (cfg.mcp as Record<string, unknown>) ?? {};
    mcp.dreamward = { type: 'local', command: [l.command, ...l.args], environment: l.env, enabled: true };
    cfg.mcp = mcp;
    cfg.$schema ??= 'https://opencode.ai/config.json';
  }
  return JSON.stringify(cfg, null, 2) + '\n';
}

const tomlStr = (s: string) => JSON.stringify(s); // TOML basic strings share JSON escaping for our inputs

export function applyCodexToml(file: string, l: Launch): string {
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const block = [
    '[mcp_servers.dreamward]',
    `command = ${tomlStr(l.command)}`,
    `args = [${l.args.map(tomlStr).join(', ')}]`,
    '',
    '[mcp_servers.dreamward.env]',
    ...Object.entries(l.env).map(([k, v]) => `${k} = ${tomlStr(v)}`),
    '',
  ].join('\n');
  // Remove any previous dreamward block (the table and its sub-tables).
  const lines = existing.split(/\r?\n/);
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (header) skipping = header[1] === 'mcp_servers.dreamward' || header[1]!.startsWith('mcp_servers.dreamward.');
    if (!skipping) out.push(line);
  }
  const base = out.join('\n').replace(/\s*$/, '');
  return (base ? base + '\n\n' : '') + block;
}

/* ── command ────────────────────────────────────────────────────────────── */

export interface SetupOptions {
  url: string;
  apiKey: string;
  write: boolean;
  yes: boolean;
  npx: boolean;
}

export function launchFor(opts: SetupOptions): Launch {
  const env = { DREAMWARD_URL: opts.url, DREAMWARD_API_KEY: opts.apiKey };
  if (opts.npx) return { command: 'npx', args: ['-y', 'dreamward', 'mcp'], env };
  // This CLI's own bundle — absolute path, works without any global install.
  return { command: process.execPath, args: [resolve(process.argv[1] ?? 'dreamward'), 'mcp'], env };
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  return answer === 'y' || answer === 'yes';
}

export async function runSetup(agentId: string | undefined, opts: SetupOptions): Promise<void> {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) {
    console.log('Usage: dreamward setup <agent> [--write] [--npx]\n\nAgents:');
    for (const a of AGENTS) console.log(`  ${a.id.padEnd(15)} ${a.label}`);
    process.exit(agentId ? 1 : 0);
  }
  const launch = launchFor(opts);
  console.log(`Connecting ${agent.label} to ${opts.url}\n`);

  if (agent.command) {
    const cmd = agent.command(launch);
    console.log('Run:\n');
    console.log('  ' + cmd.map((p) => (/[\s"]/.test(p) ? JSON.stringify(p) : p)).join(' ') + '\n');
    if (opts.write && (opts.yes || (await confirm('Run it now?')))) {
      const res = spawnSync(cmd[0]!, cmd.slice(1), { stdio: 'inherit', shell: platform() === 'win32' });
      if (res.status !== 0) throw new Error(`${cmd[0]} exited with ${res.status}`);
    }
  } else if (agent.file && agent.format) {
    const file = agent.file();
    let next: string;
    try {
      next = agent.format === 'toml-codex' ? applyCodexToml(file, launch) : applyJson(agent.format, file, launch);
    } catch (err) {
      console.error((err as Error).message);
      console.log(JSON.stringify({ dreamward: { command: launch.command, args: launch.args, env: launch.env } }, null, 2));
      process.exit(1);
    }
    console.log(`File: ${file}${existsSync(file) ? '' : '  (will be created)'}\n`);
    console.log(next);
    if (!opts.write) {
      console.log('Dry run — nothing written. Re-run with --write to apply (a .bak copy is kept).');
    } else if (opts.yes || (await confirm(`Write ${file}?`))) {
      mkdirSync(dirname(file), { recursive: true });
      if (existsSync(file)) copyFileSync(file, `${file}.bak`);
      writeFileSync(file, next, { mode: 0o600 });
      console.log(`Written ✓${existsSync(`${file}.bak`) ? `  (previous version: ${file}.bak)` : ''}`);
    }
  } else {
    console.log(JSON.stringify({ mcpServers: { dreamward: { command: launch.command, args: launch.args, env: launch.env } } }, null, 2));
  }
  if (agent.notes) console.log(`\n${agent.notes}`);
  console.log('\nThe config contains your API key — keep it private. Revoke keys any time in Dreamward → Settings.');
}
