# AI Providers — bring your own AI

**The server never pays for AI.** Every user connects *their own* AI in
*Settings → AI*: an API key, a local model, or — for subscriptions — their own
AI agent. Keys are stored per user, AES-256-GCM encrypted, shown only masked,
and excluded from data exports. Each user sees their own usage (*Settings → AI
→ My AI usage*); the bill comes from their provider.

## Three ways to connect

| You have… | Do this |
|---|---|
| **An API key** (OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, Together…) | *Add provider* → pick the preset → paste the key → **⇣ load models** → pick one → **Test** → activate |
| **A local model** (Ollama, LM Studio, Lemonade, LiteLLM) | pick the *local* preset (in Docker use `host.docker.internal` instead of `localhost`); no key |
| **A subscription** (Claude Pro/Max, ChatGPT Plus/Pro, Gemini) | **bring your agent** — see below |

The model picker (⇣) lists the provider's models and fills in the context
length when the provider reports it (OpenRouter does). Lify adapts to smaller
context windows and to models without native tool-calling automatically.

### Subscriptions: bring your agent

Anthropic and Google don't allow third-party apps to reuse a consumer
subscription login, so Dreamward doesn't try. Instead, **your subscribed agent
comes to your Dreamward**: connect Claude Code / Claude Desktop, Codex, Gemini
CLI or any MCP client with a personal API key (see
[agent-access.md](agent-access.md)). The MCP server exposes your book *and*
Lify's rituals as ready-made prompts — daily plan, weekly review, IKIGAI
coaching, chapter reset — so they run on **your** subscription, in the agent
you already pay for. Everything the agent writes is audited.

(ChatGPT subscribers can alternatively use the experimental *Sign in with
ChatGPT* connector below.)

### Presets at a glance

| Preset | Base URL | Notes |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | |
| Anthropic (Claude) | `https://api.anthropic.com/v1` | Anthropic's OpenAI-compatible endpoint |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | free tier in AI Studio |
| OpenRouter | `https://openrouter.ai/api/v1` | hundreds of models, incl. free |
| Groq · Mistral · DeepSeek · Together | their `/v1` endpoints | |
| Ollama | `http://localhost:11434/v1` | Docker: `http://host.docker.internal:11434/v1` |
| LM Studio | `http://localhost:1234/v1` | start the local server first |
| Lemonade | `http://localhost:8000/api/v1` | |
| LiteLLM | your gateway URL | route to anything |
| Custom | any OpenAI-compatible URL | |

**Shared servers:** provider URLs that resolve to private/local addresses are
refused unless the operator sets `ALLOW_PRIVATE_AI_URLS=true` (default: allowed
on single-user, desktop and LAN installs; refused on multi-user internet
servers). This stops users from reaching the server's internal network.

## OpenRouter (recommended)

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. *Settings → AI models → Add provider* → preset **OpenRouter** →
   base URL `https://openrouter.ai/api/v1`, paste the key.
3. Pick a model. Free options exist — as of June 2026 the most capable free
   model is **`nvidia/nemotron-3-ultra-550b-a55b:free`** (550B MoE, 1M
   context); `qwen/qwen3-coder:free` and `openai/gpt-oss-120b:free` are solid
   alternates. Check [openrouter.ai/models?q=free](https://openrouter.ai/models)
   for the current list — it changes monthly.
4. **Test** (probes connectivity + native tool support) → **Activate**.

The admin's instance is pre-seeded server-side via the
`seed-admin-provider` script — see [admin-guide.md](admin-guide.md).

## Local models

- **Ollama** — base URL `http://host.docker.internal:11434/v1` (or the host's
  LAN address from the container), no key.
- **Lemonade Server** — `http://localhost:8000/api/v1`, no key.

Local models often lack native tool-calling; Dreamward probes this and falls
back to JSON-block proposals automatically (`toolsMode: auto`).

## Sign in with ChatGPT — Codex (experimental)

> **Read this first.** This connector borrows the Codex CLI's OAuth client and
> ChatGPT's private Codex backend. It is a **gray area under OpenAI's Terms of
> Use** for non-official clients, may stop working without notice (client-id
> rotation, backend changes), and could theoretically draw attention to the
> ChatGPT account used. It ships **disabled**; the server operator must set
> `CODEX_ENABLED=true`. Use at your own risk, with your own account.

What it gives you: the assistant runs on your **ChatGPT subscription**
(Plus/Pro Codex quota) — no API key. Valid models (June 2026): **`gpt-5.5`**
(default), `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`. Older slugs
(`gpt-5.1-codex*`, `gpt-5.2-codex`) are deprecated and rejected by the
backend; reconnecting auto-upgrades a stale model.

How to connect (Settings → AI models → *Sign in with ChatGPT*):

1. **Connect ChatGPT** — a tab opens at `auth.openai.com`; approve access.
2. Your browser is then redirected to `http://localhost:1455/auth/callback?...`
   which **fails to load — that's expected** (it's the CLI's local listener,
   which isn't running). Copy the **entire URL** from the address bar.
3. Paste it back into Dreamward and click **Finish**. The server exchanges the
   code (PKCE) and stores the rotating refresh/access tokens encrypted.

A provider named **"ChatGPT (Codex)"** appears; activate it like any other.
Tokens refresh automatically; if the provider starts failing with auth errors,
just reconnect.

Technical notes (for maintainers): the adapter speaks the **Responses API**
(`chatgpt.com/backend-api/codex/responses`, SSE) and maps
`response.output_text.delta` / `function_call` items / `response.completed`
onto Dreamward's standard stream events; system prompts fall back from
`instructions` into the first input item when the backend rejects overrides.
All constants live in `apps/api/src/llm/codex/oauth.ts`.

## Usage accounting

Every call logs prompt/completion tokens per user into the control plane —
provider-reported when available, chars/4 estimate (flagged) otherwise. Users
see their own usage by model (*Settings → AI*); admins see totals per user.
Content and keys stay private.

## For developers: adding a provider family

Providers are adapters keyed by `kind` (`apps/api/src/llm/adapters.ts`):
`chatStream`, `chatOnce`, `listModels`, plus capability flags (native tools,
user-supplied base URL, editable fields). Native Anthropic Messages and Gemini
adapters (prompt caching, extended thinking) are on the roadmap — one adapter
+ one registry line each.
