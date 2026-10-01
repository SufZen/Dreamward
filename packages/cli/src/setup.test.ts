import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCodexToml, applyJson, maskLaunch, maskSecret, previewEntry, runSetup, type Launch } from './setup';

const KEY = 'lbk_0123456789abcdefWXYZ';
const OTHER_SECRET = 'sk-other-server-secret-1234567890';
const launch: Launch = { command: 'node', args: ['/cli.js', 'mcp'], env: { DREAMWARD_URL: 'http://localhost:3000', DREAMWARD_API_KEY: KEY } };
const opts = { url: 'http://localhost:3000', apiKey: KEY, write: false, yes: false, npx: false };

describe('maskSecret', () => {
  it('keeps a known prefix and the last 4', () => {
    expect(maskSecret(KEY)).toBe('lbk_…WXYZ');
    expect(maskSecret('Bearer abcdefghijklmnop1234')).toBe('Bearer …1234');
    expect(maskSecret('some-long-opaque-token-9876')).toBe('…9876');
  });
  it('hides short values entirely', () => {
    expect(maskSecret('abc123')).toBe('••••');
  });
});

describe('maskLaunch', () => {
  it('masks env values but keeps the URL readable and the original intact', () => {
    const m = maskLaunch(launch);
    expect(m.env).toEqual({ DREAMWARD_URL: 'http://localhost:3000', DREAMWARD_API_KEY: 'lbk_…WXYZ' });
    expect(launch.env.DREAMWARD_API_KEY).toBe(KEY);
  });
});

describe('previewEntry', () => {
  it.each(['json-mcpServers', 'json-vscode', 'json-opencode', 'toml-codex'] as const)('%s: only the dreamward entry, no key', (format) => {
    const out = previewEntry(format, maskLaunch(launch));
    expect(out).toContain('dreamward');
    expect(out).toContain('lbk_…WXYZ');
    expect(out).not.toContain(KEY);
  });
  it('matches what is actually written', () => {
    for (const format of ['json-mcpServers', 'json-vscode', 'json-opencode'] as const) {
      const written = JSON.parse(applyJson(format, '', 'f.json', launch));
      const preview = JSON.parse(previewEntry(format, launch));
      const [container] = Object.keys(preview);
      expect(written[container!].dreamward).toEqual(preview[container!].dreamward);
    }
    expect(applyCodexToml('', launch)).toBe(previewEntry('toml-codex', launch));
  });
});

describe('runSetup dry run', () => {
  let dir: string;
  let out: string;
  const env = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dw-setup-'));
    out = '';
    vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void (out += a.join(' ') + '\n'));
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void (out += a.join(' ') + '\n'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...env };
    rmSync(dir, { recursive: true, force: true });
  });

  it('opencode (JSON): never prints other servers or the key, writes nothing', async () => {
    process.env.XDG_CONFIG_HOME = dir;
    const file = join(dir, 'opencode', 'opencode.json');
    mkdirSync(join(dir, 'opencode'));
    const original = JSON.stringify({ theme: 'dark', mcp: { other: { type: 'local', command: ['x'], environment: { OTHER_API_KEY: OTHER_SECRET } } } });
    writeFileSync(file, original);

    await runSetup('opencode', opts);

    expect(out).not.toContain(OTHER_SECRET);
    expect(out).not.toContain('OTHER_API_KEY');
    expect(out).not.toContain('theme');
    expect(out).not.toContain(KEY);
    expect(out).toContain('lbk_…WXYZ');
    expect(readFileSync(file, 'utf8')).toBe(original);
  });

  it('codex (TOML): never prints other servers or the key', async () => {
    process.env.CODEX_HOME = dir;
    writeFileSync(join(dir, 'config.toml'), `model = "o4"\n\n[mcp_servers.other.env]\nTOKEN = "${OTHER_SECRET}"\n`);

    await runSetup('codex', opts);

    expect(out).not.toContain(OTHER_SECRET);
    expect(out).not.toContain('mcp_servers.other');
    expect(out).not.toContain(KEY);
    expect(out).toContain('[mcp_servers.dreamward]');
  });

  it('claude-code and other: key masked unless --show-key', async () => {
    await runSetup('claude-code', opts);
    await runSetup('other', opts);
    expect(out).not.toContain(KEY);
    expect(out).toContain('DREAMWARD_API_KEY=lbk_…WXYZ');
    expect(out).toContain('--show-key');

    out = '';
    await runSetup('other', { ...opts, showKey: true });
    expect(out).toContain(KEY);
  });
});
