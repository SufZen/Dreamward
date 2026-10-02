# Dreamward roadmap

Dreamward started as a vision book. The "Dreamward 2.0" spec (from the
*Meaning* (משמעות) project) moved the question from **"what do I want to
achieve?"** to **"who do I want to be, how does that person think and act, and
what is missing right now to live like that?"** Much of that is built. This
roadmap now asks a narrower question: **what do the first users need?**

Status legend: ✅ shipped · 🟢 now · 🔜 next · 🧭 later · ✂️ deliberately not doing

---

## 1. What has shipped

| Area | What you get |
|---|---|
| **The book** | 12 life areas with typed sections (beliefs, vision, identity, why, how), front-matter and implementation pages, vision prompts. The identity section holds an *I am…* statement, desired inner states, standards & boundaries and belief shifts. |
| **Meaning & focus** | The Current Life Chapter (1–5 focus areas, maintenance-only areas, a *not now* list, an anti-vision, a review date). An append-only life wheel (1–10 per area, with trend and biggest gaps). A versioned IKIGAI wizard (4 circles → mapping → Venn + insights → everyday ikigai → statement). |
| **Execution** | Goals with status history and progress/risk rollups; actions with priority, due dates and links; journal; vision boards with multi-format export; snapshots with comparison; an ICS calendar feed. |
| **Clarity** (the assistant) | Streaming chat with tools; every write is a proposal you approve. Routines: daily plan, weekly review prep, goal drift. ✨ suggestions inside the IKIGAI wizard. |
| **Bring your own AI** | 13 provider presets (API keys, local models, ChatGPT via Codex). See [ai-providers.md](ai-providers.md). |
| **Agents** | A REST `/api/v1` with OpenAPI 3.1; an MCP server (37 tools, resources, ritual prompts); the `dreamward` CLI with `dreamward setup <agent>` (its dry run shows only the Dreamward entry, with keys masked); read or write API keys, every call audited. See [agent-access.md](agent-access.md). |
| **Running it** | A desktop app (one local account) and self-hosting with an installer, invites, an admin dashboard and backups. A sandbox dev server (`node scripts/dev-sandbox.mjs`) keeps development away from real data. |
| **Guided start** (roadmap item 1) | A new book is offered a skippable, resumable path at `/start`: name the chapter → rate the wheel → pick 1–5 focus areas and their biggest gap → optional IKIGAI → a first action, with Clarity ideas when an AI provider is set. EN/HE with full RTL. Reached from the dashboard welcome card and Settings; short animated loops mark the other first-run moments. |

## 2. Now, Next, Later

The order is the priority. Each item says why it is where it is.

Item 1, first-run onboarding, has shipped (see *Guided start* above). The
numbers stay as they were, so links to "item 2" keep working.

### 🟢 Now

**2. Connect from claude.ai and ChatGPT: a remote MCP endpoint.**
Streamable HTTP + OAuth 2.1 on the self-hosted server and the desktop app,
with **read**, **read-write** and **propose-only** scopes. Propose-only lands
outside insights in Clarity's approval inbox instead of writing directly (the
"AI inbox for outside conversations", spec §14). The same work fixes rough
edges in the local setup found in practice:
- on Windows, `npx` must be launched through `cmd /c`;
- inside a checkout of this repo, `npx dreamward` resolves the local workspace
  and fails with "could not determine executable to run";
- ✅ `dreamward setup <client>` dry-run no longer prints the whole target
  config: it shows only the Dreamward entry, with keys masked.

*Why:* most users live in claude.ai or ChatGPT, not in a terminal.

### 🔜 Next

**3. The review rhythm: weekly → monthly → quarterly.**
Generalise weekly reviews into cadenced reviews. **Monthly** re-rates the wheel
(and closes experiments once item 5 lands). **Quarterly** renews the chapter,
triggered by the chapter's review date. Two smaller pieces ride along:
- a short *release reflection* when a goal is dropped — closing without guilt
  (spec §16);
- Clarity "then vs. now" progress narratives from rating history and snapshots.

*Why:* the chapter already has a review date, and nothing drives it.

**4. A daily loop: habits as recurring actions with streaks.**
Surfaced in Clarity's daily plan and on the dashboard, weighted toward focus
areas, and respecting the chapter's *not now* list.
*Why:* retention lives in the daily loop, and habits are still plain text in
the strategy section.

**5. Experiments and evidence.**
A 1–4 week **experiment** (hypothesis, belief challenged, behaviour, success
signal, learning) that actions can link to. An `evidence` journal kind with
quick capture on the dashboard — not a new subsystem.
*Why:* this is the identity-first core of the 2.0 spec ("who am I
becoming"), and it feeds the monthly review.

### 🧭 Later

- **Core values** + a Clarity *decision check* against values, IKIGAI,
  standards and the chapter.
- **"Also affects" categories** on goals/experiments, and Clarity-detected
  keystone changes.
- **Native Anthropic and Gemini adapters** (prompt caching, extended thinking).
- **Outgoing webhooks.**
- **API key expiry.**

## 3. Deliberately not doing

These come from the 2.0 spec and were cut because they add upkeep without
adding much:

- ✂️ **The full `ideal_identity` model** (8 lists × 12 categories ≈ 96 lists) — it violates the spec's own rule "don't create maintenance load" (§16). Collapsed into the 4-field identity section.
- ✂️ **Belief-engineering table per category** (belief, cost, evidence for/against, alternative, validating behaviour). Kept as *belief shifts*; evidence and validating behaviour arrive through experiments + evidence entries.
- ✂️ **Cross-domain dependency map UI** (§10). Replaced later by an optional "also affects" category list on goals/experiments and Clarity-detected keystone changes.
- ✂️ **Five-factor leverage scoring** (§9) — friction on every action; the factors live in Clarity's prompt instead.
- ✂️ **Daily emotional-state tracking** (§6) — desired states live in identity; journal already has mood.
- ✂️ **Separate annual revision flow** — closing a chapter + snapshots + revisiting IKIGAI cover it.
- ✂️ **Dashboard rewrite** (§13) — widgets were added to the existing dashboard instead.

## 4. Guardrails (from the spec's "what not to do", §16)

- Not everything becomes a KPI — scores are optional and coarse (1–10).
- Maintenance must stay tiny — every new surface autosaves and is optional.
- Identity is a direction, not a costume — IKIGAI and chapters are versioned and meant to be revised.
- Letting go of goals is allowed — chapters have a *not now* list; releasing goals gets a reflection, not a failure mark.

---

## Appendix: IKIGAI design notes

- The four circles (love / good at / world needs / paid for) and the four
  classic overlaps (passion, mission, vocation, profession) are the *Western*
  career-oriented IKIGAI diagram. The wizard adds an **everyday ikigai** step —
  small joys and reasons to get up in the morning — closer to the original
  Japanese meaning, and linked to the "What makes me happy" page.
- The Venn geometry and all rules (region mapping, the "three of four"
  insights, completion checks) are pure functions in `packages/shared/src/ikigai.ts`
  and unit-tested, so the api, web and agents agree.
- Clarity suggestions are one-shot and write nothing — accepting a suggestion
  chip is the approval. Without an AI provider the buttons simply don't appear.
- A completed IKIGAI is a version: *Revisit* starts a draft copy; completing it
  archives the previous one; discarding keeps the current one.
