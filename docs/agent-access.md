# Agent Access — MCP, CLI & the Agent API

Your Dreamward is a system your own AI agents can work with: any MCP-capable
agent (Claude Code, Claude Desktop, Codex, Gemini CLI, Cursor, VS Code,
Windsurf, OpenCode, Hermes…) or automation (n8n, scripts) gets access to your
book — authenticated with personal API keys, scoped read or read & write, and
fully audited. It's also how **AI subscriptions** plug in: your Claude /
ChatGPT / Gemini agent runs Clarity's rituals on *your* subscription.

## Personal API keys

Created in **Settings → AI agent access**. Each key has:

- a **name** ("Claude Code on desktop") so audit entries are attributable,
- a **scope** — `read` (GET only) or `write` (full CRUD),
- a one-time token reveal (`lbk_…`) — only a SHA-256 hash is stored,
- revocation (key stays listed with its history; token dies instantly).

Keys never grant admin. A disabled account's keys stop working on the next
request. All `/api/v1` traffic is rate-limited per key (120/min).

## The audit trail

Every mutation an agent makes (create/update/delete) is recorded per user:
timestamp, key name, action (`action.create`, `goal.delete`…), a truncated
payload summary, the HTTP status — and for updates/deletes the **full prior
state of the row**, so anything an agent changed can be recovered by hand.
View it under **Settings → AI agent access → Recent agent activity**.
Action deletes are soft (restorable in the DB); other entities rely on the
prior-state capture.

## REST surface — `/api/v1`

`Authorization: Bearer lbk_…`. Content routes only — no auth/admin/LLM-config
surface is reachable with an API key.

| Area | Endpoints |
|---|---|
| Search | `GET /api/v1/search?q=` |
| Categories | `GET /categories`, `GET /categories/:id`, `PUT /sections/:id/content` (markdown) |
| Content blocks | `GET /content-blocks[/:id]`, `PUT /content-blocks/:id/content` (markdown) |
| Life vision | `GET /life-vision`, `PUT /life-vision/:id/answer` (markdown) |
| Goals | full CRUD + `GET /goals/progress`, `PATCH /goals/:id/status` |
| Actions | full CRUD + `PATCH /actions/reorder` |
| Journal | full CRUD + `POST /journal/markdown` |
| Moodboards | CRUD (content JSON) |
| Briefing | `GET /briefings/latest` |
| Current chapter | `GET /chapters/current`, `GET /chapters`, `POST /chapters`, `PUT /chapters/:id`, `POST /chapters/:id/close` |
| Life wheel | `GET /ratings/latest`, `GET /ratings?categoryId=`, `POST /ratings` |
| IKIGAI | `GET /ikigai`, `GET /ikigai/:id`, `POST /ikigai/draft`, `PUT /ikigai/:id`, `POST /ikigai/:id/complete`, `DELETE /ikigai/:id` (drafts only) |

Identity sections take `statement`, `states`, `standards` and `beliefShifts`
(`[{from, to}]`) on `PUT /sections/:id/content`.

## Connect your agent (2 minutes)

1. **Create a key** — *Settings → AI agent access → Create key*. Pick
   **Read & write** if the agent should be able to update your book, **Read**
   for a look-but-don't-touch assistant. One key per agent (clear audit trail,
   independent revocation).
2. **Log in the CLI once** (it stores the URL + key in `~/.dreamward/config.json`, 0600):

   ```bash
   npx -y dreamward login --url https://your-dreamward --key lbk_…
   ```
   *(from a checkout: `pnpm --filter dreamward build && node packages/cli/dist/index.js login …`)*

3. **Set up your agent** — dry run first, then `--write` to apply (a `.bak` is kept):

   ```bash
   dreamward setup claude-code          # prints the `claude mcp add …` command (--write runs it)
   dreamward setup claude-desktop --write
   dreamward setup cursor --write
   dreamward setup vscode --write       # .vscode/mcp.json in this workspace
   dreamward setup windsurf --write
   dreamward setup gemini --write       # ~/.gemini/settings.json
   dreamward setup codex --write        # ~/.codex/config.toml
   dreamward setup opencode --write
   dreamward setup other                # generic JSON for any MCP client
   ```

   The generated config launches `dreamward mcp` (the MCP server is built into
   the CLI). Add `--npx` to launch it via `npx -y dreamward mcp` instead.

   The dry run shows only the `dreamward` entry it will add, never the rest of
   the file (other servers' keys stay off your screen and out of agent
   transcripts). Your API key is masked (`lbk_…1a2b`). Add `--show-key` when you
   need it in full to copy-paste (`claude-code`, `other`).

   **Desktop app?** Log in with `--url desktop`: agents then always reach the
   running app, whatever local port it got (see [desktop.md](desktop.md)).

### What the agent gets

**Tools** (37 with a write key, 18 read-only with a read key — write tools are
hidden, not just refused). Every tool carries MCP safety annotations
(`readOnlyHint`, `destructiveHint`, `idempotentHint`) so agents can ask
before changing anything.

| Area | Tools |
|---|---|
| Context | `get_overview` (the whole book as compact markdown — start here), `search_content` |
| Meaning & focus | `get_current_chapter`, `start_chapter`, `update_chapter`, `get_life_wheel`, `rate_category`, `list_rating_history`, `get_ikigai`, `start_ikigai_draft`, `update_ikigai_draft` |
| Book | `list_categories`, `get_category`, `update_section` (incl. identity), `list_content_blocks`, `get_content_block`, `update_content_block`, `get_life_vision`, `update_life_vision_answer` |
| Goals & actions | `list_goals` (progress + risk), `get_goal`, `create_goal`, `update_goal`, `set_goal_status`, `delete_goal`, `list_actions`, `create_action`, `update_action`, `complete_action`, `delete_action` |
| Journal & more | `list_journal_entries`, `get_journal_entry`, `create_journal_entry`, `update_journal_entry`, `delete_journal_entry`, `list_moodboards`, `get_latest_briefing` |

**Resources** — `dreamward://overview` (markdown), `dreamward://chapter`,
`dreamward://ikigai`, `dreamward://wheel`, `dreamward://category/{id}`.

**Prompts (Clarity's rituals — run them on your own AI subscription)** —
`daily-plan`, `weekly-review`, `ikigai-coach`, `chapter-reset`,
`rate-my-wheel`, each with an optional `language` argument (`en` / `he`).
In Claude Code they appear as `/dreamward:weekly-review`; in Claude Desktop
under the **+** menu.

### Manual configuration (any MCP client)

```json
{
  "mcpServers": {
    "dreamward": {
      "command": "npx",
      "args": ["-y", "dreamward", "mcp"],
      "env": { "DREAMWARD_URL": "https://your-dreamward", "DREAMWARD_API_KEY": "lbk_…" }
    }
  }
}
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.dreamward]
command = "npx"
args = ["-y", "dreamward", "mcp"]

[mcp_servers.dreamward.env]
DREAMWARD_URL = "https://your-dreamward"
DREAMWARD_API_KEY = "lbk_…"
```

### Server-side agents (Hermes / OpenClaw)

The MCP build is a **single self-contained file** (`packages/mcp/dist/index.js`,
SDK and all dependencies bundled) — it runs anywhere with just `node`:

```bash
pnpm --filter @dreamward/mcp build
scp packages/mcp/dist/index.js <host>:/opt/mcp-custom/dreamward-mcp.js
```

```yaml
mcp_servers:
  dreamward:
    command: node
    args: [/opt/mcp-custom/dreamward-mcp.js]
    env:
      DREAMWARD_URL: https://your-dreamward
      DREAMWARD_API_KEY: lbk_…
    enabled: true
```

Re-copy the bundle after Dreamward releases that change MCP tools.

### Automations (n8n, Make, Zapier, scripts, custom GPT Actions)

- **OpenAPI 3.1**: `https://your-dreamward/api/v1/openapi.json` (public — it
  describes the API, no data), browsable at `/api/v1/docs`. Import it into n8n
  (HTTP Request node → *Import cURL/OpenAPI*), a custom GPT's *Actions*, or an
  SDK generator.
- Auth: header `Authorization: Bearer lbk_…`.
- n8n can also run the MCP server through its **MCP Client** node
  (command `npx -y dreamward mcp` with the two env vars).

### Coming next

**Next** on the [roadmap](roadmap.md#-next) (item 2): a remote MCP endpoint
(Streamable HTTP + OAuth 2.1, on the self-hosted server and the desktop app)
so web assistants (claude.ai, ChatGPT connectors) can connect without a local
process. It comes with read, read-write and propose-only scopes, where
propose-only sends changes to Clarity's approval inbox. The same work fixes
local-setup rough edges: `npx` on Windows, `npx dreamward` inside a checkout of
this repo, and `setup` dry-runs that print other servers' secrets.

**Later**: API key expiry and outgoing webhooks.

## CLI (`packages/cli`)

```bash
dreamward whoami
dreamward chapter                  # current life chapter
dreamward wheel                    # latest 1-10 rating per category
dreamward ikigai                   # your current IKIGAI
dreamward goals list
dreamward actions add "Run 5k" --goal <id> --due 2026-08-01 --priority high
dreamward actions done <id>
echo "Today I…" | dreamward journal add --title "Evening note"
dreamward search "marathon"        # --json anywhere for scripting
dreamward mcp                      # run the MCP server on stdio
dreamward setup <agent>            # connect an AI agent (see above)
```

Config lives in `~/.dreamward/config.json` (0600); `DREAMWARD_URL` /
`DREAMWARD_API_KEY` env vars override it.

## Autonomous routines ("the reality engine")

**Settings → Autonomous Clarity routines.** Scheduled Clarity runs (5-minute
scheduler tick, once per routine per day, only with an active AI provider):

- **Daily plan** — reviews goals (with progress/risk rollups) and open
  actions, proposes today's 3–5 priorities, refreshes the morning briefing.
- **Weekly review prep** (Fridays) — summarizes the week before the Saturday
  ritual.
- **Goal drift** (Sun + Wed) — finds stalled/at-risk goals and proposes
  corrective steps.

Writes go through the proposal system. With **auto-apply** on, action-scoped
proposals (`create/update/complete_action`) apply immediately (provenance
`agent`, visible on each action); goal/section changes and deletes always wait
for your approval. Each routine shows its last run + status, and "Run now"
triggers it manually.

## Calendar feed (ICS)

**Settings → AI agent access → Calendar feed** creates a read-only key and a
URL like `https://your-dreamward/api/feeds/calendar.ics?key=lbk_…` you can
subscribe to from Google/Apple/Outlook Calendar. Actions with due dates and
goals with target dates appear as all-day events (done ones marked ✓).
Only read-scope keys are accepted on this route — a leaked URL can never
write. Revoke the key to kill the feed.
