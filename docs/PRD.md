# PRD — Dreamward

## 1. Overview

**Who.** People who want a living, private plan for their whole life, not just
a to-do list. Some use it alone on their own computer. Others share a server
with family or a small community, sometimes with a coach.

**Problem.** Life-design work usually lives in slide decks, notebooks or long
documents. They are slow to update, so the plan goes stale, and it drifts
away from what the person does each week.

**What.** A private, bilingual (Hebrew RTL / English LTR) app that turns a life
vision into a practice:

- a structured book of 12 life areas
- a current life chapter with a few focus areas
- a 1–10 life wheel
- IKIGAI
- goals and actions with honest progress
- a journal and vision boards
- Lify, an AI companion that runs on the person's own AI provider

It runs as a desktop app or self-hosted. Data stays with the person, and their
own AI agents can work with it over MCP, the CLI or a REST API.

## 2. User stories

- I keep my book private: it runs on my computer or my own server, and nothing is sent anywhere I did not choose.
- I browse my 12 life areas and, in each, write what I believe, the life I envision, who I am becoming, why it matters and how I will get there.
- I name the chapter I am in, choose up to five focus areas, and keep a *not now* list so my energy goes where it matters.
- I rate each area 1–10 ("how close is today to my vision"), see my wheel change over time, and see the biggest gaps.
- I discover my IKIGAI with a guided wizard and revisit it as life changes.
- I turn vision into goals and small actions, and see which goals are stalling.
- I write in Hebrew or English freely, and each renders in the right direction.
- I keep a journal and search it; I build vision boards and export them for my phone and desktop wallpapers.
- I talk to Lify (in my language) about my book; Lify proposes changes and I approve them.
- I connect the AI I already pay for (an API key, a local model, or my Claude/ChatGPT/Gemini agent over MCP).
- I download my whole book at any time and can move it between desktop and server.

## 3. Functional requirements (current)

- **Book.** 12 areas with typed sections: beliefs, vision, identity, why, how, and quality-of-life extras. Also front-matter and implementation pages, and vision prompts. The wording comes from a framework pack.
- **Meaning and focus.** A life chapter (focus/maintenance areas, not-now and no-longer-acceptable lists), an append-only life wheel, and a versioned IKIGAI.
- **Execution.**
  - Goals with status history and progress/risk rollups.
  - Actions with priority, due date and links to any entity.
  - A calendar feed.
- **Journal, vision boards, snapshots.** Full-text search, a collage editor with multi-format export, and dated snapshots with comparison.
- **Lify.**
  - Streaming chat with tools and approval-gated proposals.
  - Scheduled routines: daily plan, weekly review prep, goal drift.
- **Agents.** Personal API keys (read or write), an audited `/api/v1`, an MCP server (tools, resources, ritual prompts), a CLI with one-command agent setup, and OpenAPI.
- **Accounts.**
  - Self-hosted: invites, an admin dashboard and a first-run setup link.
  - Desktop: one local account with no password.
- **Data safety.**
  - Per-user databases.
  - Integrity check and snapshot before any upgrade, and a downgrade guard.
  - Daily backups, and export/import.

## 4. Non-functional requirements

- **Privacy.** All content is behind auth, there is no telemetry, and AI runs only on providers the person configures.
- **Security.**
  - argon2id passwords and httpOnly/SameSite cookies.
  - Encrypted provider keys and hashed API keys.
  - An SSRF guard for AI URLs, and rate limits.
- **Reliability.** Upgrades are snapshot-protected and roll back automatically on self-host.
- **Accessibility.** Keyboard navigation, visible focus, sufficient contrast, and correct RTL mirroring.
- **Portability.** Docker on any VPS or home server (amd64/arm64), plus a Windows/macOS/Linux desktop app.

## 5. Success metrics

- A new person reaches a named chapter, a rated wheel and a first IKIGAI draft in their first session.
- Weekly active use of the review ritual, whether in the app or through their agent.
- Zero data-loss reports across upgrades. Every release passes the upgrade-compat tests.
