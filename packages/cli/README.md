# dreamward — `dreamward` from the terminal

A command-line client for the Dreamward agent API (`/api/v1`) — and the
one-command way to connect AI agents (it embeds the MCP server).
Human-readable output by default, `--json` everywhere for scripting.

## Install

```bash
pnpm --filter dreamward build     # → packages/cli/dist/index.js
```

Expose it as `dreamward` however you prefer:

- **Windows**: drop a `dreamward.cmd` into a directory on `PATH`
  (e.g. `%APPDATA%\npm`):
  ```bat
  @echo off
  node "<repo>\packages\cli\dist\index.js" %*
  ```
- **macOS/Linux**: `ln -s <repo>/packages/cli/dist/index.js ~/.local/bin/dreamward`
  (the bundle carries a `#!/usr/bin/env node` shebang), or `pnpm link --global`.

## Login

Create a key in **Dreamward → Settings → AI agent access**, then:

```bash
dreamward login --url https://your-dreamward --key lbk_…
dreamward whoami
```

Credentials are saved to `~/.dreamward/config.json` (0600 on POSIX);
`DREAMWARD_URL` / `DREAMWARD_API_KEY` environment variables override the file.

## Commands

```bash
dreamward goals list [--status not_achieved]
dreamward goals add "Run a marathon" --category health_fitness --due 2026-12-31

dreamward actions list [--status todo|done] [--priority high] [--goal <id>] [--all]
dreamward actions add "Buy running shoes" --goal <id> --due 2026-08-01 --priority high
dreamward actions done <id>          # accepts the 8-char short id from `list`

dreamward journal list
dreamward journal add "**Markdown** body here" --title "Evening note"
echo "piped markdown" | dreamward journal add

dreamward chapter                    # current life chapter
dreamward wheel                      # latest 1-10 rating per category
dreamward ikigai                     # current IKIGAI

dreamward search "marathon"
dreamward --json actions list        # raw JSON for scripts
```

## Connect an AI agent

```bash
dreamward setup                      # list supported agents
dreamward setup claude-desktop       # dry run: shows the file + the change
dreamward setup claude-desktop --write   # apply (keeps a .bak)
dreamward setup codex --write --npx  # launch via `npx -y dreamward mcp`
dreamward mcp                        # the MCP server itself (stdio)
```

Agents: `claude-code`, `claude-desktop`, `cursor`, `windsurf`, `vscode`,
`gemini`, `codex`, `opencode`, `other`. The generated config contains your
API key — keep it private; revoke keys any time in Settings.

Write commands need a **read & write** key; with a read-only key they exit
with a clear "Forbidden" message. Every write is recorded in the audit trail
visible in Dreamward Settings.
