# Dreamward 2.0 — from vision book to personal operating system

This document analyses the "Dreamward 2.0" improvement spec that came out of the
*Meaning* (משמעות) project and turns it into a phased roadmap. The spec's core
shift is from **"what do I want to achieve?"** to **"who do I want to be, how does
that person think and act, and what is missing right now to live like that?"**

Status legend: ✅ shipped in v0.4 · 🔜 next (v0.5) · 🧭 later (v0.6) · ✂️ deliberately not doing

---

## 1. What already existed (v0.3)

Much of the 2.0 spec had a foothold before this work:

| Spec idea | Existing building block |
|---|---|
| Leverage points | `strategy` section → `leverages` list, plus Actions |
| Execution layer | Goals → Actions, progress/momentum/risk signals |
| AI suggests, human approves | Lify proposals (the single write gate) |
| AI inbox | Pending proposals on the dashboard |
| Weekly review | Lify weekly-review ritual + Friday prep routine |
| Snapshots / annual comparison | Snapshots with diff |

## 2. Verdict per idea

### Valuable — build

| Idea (spec §) | Verdict | Notes |
|---|---|---|
| **Current Life Chapter** (§8) | ✅ | The cheapest control on the whole system: 1–5 focus areas, maintenance-only areas, a *not now* list and an anti-vision. Feeds Lify's digest, daily plan and the dashboard. |
| **Distance from the ideal self** (§1–2) | ✅ lightweight | Per-category 1–10 "how close is today to my vision" + honest reality + biggest gap. Append-only, so it becomes a life wheel with a trend. |
| **Identity layer** (§1, §3) | ✅ reduced | One `identity` section per category: *I am…* statement, desired inner states, standards & boundaries, belief shifts (limiting → empowering). |
| **Leverage move** (§2, §9) | ✅ via prompt | No new scoring UI. Lify now prefers the smallest high-impact, easy, enjoyable move in focus areas. |
| **Experiments instead of only goals** (§4) | 🔜 | New entity: hypothesis, belief challenged, behaviour, 1–4 week window, success signal, learning. Actions can link to an experiment. |
| **Evidence log** (§11) | 🔜 light | A journal entry kind (`evidence`) with a category, quick capture on the dashboard, Lify suggestions — not a new subsystem. |
| **Monthly / quarterly review** (§12) | 🔜 | Generalise `weekly_reviews` into cadenced reviews. Monthly: re-rate the wheel, close experiments. Quarterly: renew the chapter. |
| **Standards / anti-vision / decision filter** (§7) | ✅ partly | Standards live in identity; "no longer acceptable" lives on the chapter. 🧭 A Lify *decision check* mode comes later. |
| **AI inbox for outside conversations** (§14) | 🧭 | Today external MCP agents write directly (audited). Add a *propose-only* key scope + MCP `propose` tool so insights from other AI conversations land in the approval inbox. |

### Too much for now

- ✂️ **The full `ideal_identity` model** (8 lists × 12 categories ≈ 96 lists) — it violates the spec's own rule "don't create maintenance load" (§16). Collapsed into the 4-field identity section.
- ✂️ **Belief-engineering table per category** (belief, cost, evidence for/against, alternative, validating behaviour). Kept as *belief shifts*; evidence and validating behaviour arrive through experiments + evidence entries.
- ✂️ **Cross-domain dependency map UI** (§10). Replaced later by an optional "also affects" category list on goals/experiments and Lify-detected keystone changes.
- ✂️ **Five-factor leverage scoring** (§9) — friction on every action; the factors live in Lify's prompt instead.
- ✂️ **Daily emotional-state tracking** (§6) — desired states live in identity; journal already has mood.
- ✂️ **Separate annual revision flow** — closing a chapter + snapshots + revisiting IKIGAI cover it.
- ✂️ **Dashboard rewrite** (§13) — widgets were added to the existing dashboard instead.

### Missing from the spec — needed for a real personal OS

1. **A meaning layer above the categories.** Categories have a *purpose*, but nothing said what the whole life is for. ✅ **IKIGAI** fills this; 🔜 core values join it as the input to the decision filter.
2. **Onboarding.** Invited users start from an empty book. 🔜 A first-run path: chapter → rate the wheel → pick focus → IKIGAI → first leverage move (reusing the IKIGAI stepper).
3. **A daily loop / habit execution.** Habits are text inside *strategy*. 🧭 Recurring actions with streaks, surfaced in the daily plan.
4. **An inbox for external agents** (see above). 🧭
5. **Closing without guilt** (§16). 🔜 A short *release* reflection when a goal or experiment is dropped.
6. **Measurement over time as a narrative.** 🔜 Rating history + snapshots let Lify write "then vs. now" progress narratives.

## 3. What v0.4 ships ("meaning & focus")

| Feature | Where |
|---|---|
| Current Life Chapter | `/chapter`, dashboard card, focus/maintenance badges on categories |
| Life wheel ratings | "Where I am now" card on every category; radar + biggest gaps on the dashboard |
| Identity section | New section in every category (after Vision), backfilled into existing books |
| IKIGAI | `/ikigai` guided wizard: 4 circles → mapping → Venn + insights → everyday ikigai → statement, with version history |
| Lify | Digest now leads with chapter, IKIGAI and life wheel; focus-aware daily plan and weekly prep; `get_item` supports `chapter` and `ikigai`; ✨ suggestions inside the IKIGAI wizard |
| Agents | `/api/v1/chapters`, `/ratings`, `/ikigai`; MCP tools `get_current_chapter`, `get_life_wheel`, `get_ikigai`, `rate_category`; `update_section` accepts identity fields; CLI `dreamward chapter | wheel | ikigai` |

### IKIGAI design notes

- The four circles (love / good at / world needs / paid for) and the four
  classic overlaps (passion, mission, vocation, profession) are the *Western*
  career-oriented IKIGAI diagram. The wizard adds an **everyday ikigai** step —
  small joys and reasons to get up in the morning — closer to the original
  Japanese meaning, and linked to the "What makes me happy" page.
- The Venn geometry and all rules (region mapping, the "three of four"
  insights, completion checks) are pure functions in `packages/shared/src/ikigai.ts`
  and unit-tested, so the api, web and agents agree.
- Lify suggestions are one-shot and write nothing — accepting a suggestion chip
  is the approval. Without an AI provider the buttons simply don't appear.
- A completed IKIGAI is a version: *Revisit* starts a draft copy; completing it
  archives the previous one; discarding keeps the current one.

## 4. Roadmap

**v0.5 (P1)** — Experiments · Evidence entries · Monthly & quarterly reviews
(`reviews` with a cadence, `monthly_review_prep` / `chapter_review` routines) ·
Core values · First-run onboarding · Release reflection · Lify progress narratives.

**v0.6 (P2)** — Propose-only API keys + MCP `propose` (external-agent inbox) ·
Lify decision check (against IKIGAI, standards, chapter) · Habits as recurring
actions with streaks · "Also affects" categories + keystone detection.

## 5. Guardrails (from the spec's "what not to do", §16)

- Not everything becomes a KPI — scores are optional and coarse (1–10).
- Maintenance must stay tiny — every new surface autosaves and is optional.
- Identity is a direction, not a costume — IKIGAI and chapters are versioned and meant to be revised.
- Letting go of goals is allowed — chapters have a *not now* list; releasing goals gets a reflection, not a failure mark.
