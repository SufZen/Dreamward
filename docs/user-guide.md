# User Guide

Welcome to Dreamward — your private space for life vision, goals and
reflection. Everything you create here is yours alone: your account has its
own database and image storage, invisible to every other user (including the
admin's dashboard, which only sees usage numbers, never content).

## Getting in

You join via an **invite link** from the admin. Open it, choose your email and
a password (8+ characters) — that's your login at the site root from then on.
Change your password any time in **Settings**. The interface runs in English
or Hebrew (full RTL) — toggle from the sidebar or login screen.

## Your book

- **Dashboard** — your current chapter, IKIGAI and life wheel, your categories
  at a glance, plus the latest AI briefing.
- **Cover & front matter** — the opening pages of your book.
- **Dream life** — guided questions (the home you love, a perfect ordinary day…) with rich-text answers.
- **Life areas** (health, love, work, …) — each holds *What I believe*,
  *Vision*, *Who I am becoming*, *Why it matters* and *How I will get there*, plus a **Where I am now**
  card. Edits save automatically (watch the save indicator).
- **Implementation pages** — habits, leverage, operating rhythm.

## Current Chapter

Not every area of life matters equally in every season. **Current Chapter**
(sidebar, top of *My book*) holds the season you're living now: a name, an
intention ("what is this chapter meant to create?"), a review date, and your
categories sorted into **focus** (up to 5), **maintenance only**, or normal —
tap a category to cycle. Two lists keep you honest: **Not now** (good things
that deliberately wait) and **No longer acceptable** (what you stop
normalising — your decision filter). When the season ends, close the chapter
with a short reflection and start the next one; past chapters stay listed.

Clarity reads the chapter first: it prioritises your focus areas and won't push
things from your *not now* list.

## Identity & the life wheel

Each category has an **Identity** section — *who am I when I live this
vision?* — with an "I am…" statement, the inner states you want to live in,
your standards and boundaries, and **belief shifts** (an old limiting belief →
a believable new one).

The **Where I am now** card rates how close your life is to the vision today
(1–10), with the honest reality and the biggest gap. Re-rate whenever things
change — history is kept, and the dashboard's **life wheel** shows every
category at once (current vs. previous), with the biggest gaps in your focus
areas first. Often the gap is one belief, one habit or one boundary away.

## IKIGAI

**IKIGAI** (sidebar) is a guided ~15-minute process to define your *reason to
get up in the morning*, right now:

1. **Four circles** — what you love, what you're good at, what the world needs
   (from you), what you can be paid for. Type answers and press Enter; if an AI
   provider is configured, *✨ Suggest from my book* offers ideas drawn from
   your own content — click one to add it.
2. **Map** — mark every circle each item belongs to. Overlaps are where the
   insight is.
3. **Your picture** — a live diagram: passion, mission, vocation, profession
   and IKIGAI in the centre, with plain-language insights (e.g. "delight and
   fullness — but no wealth yet").
4. **Everyday ikigai** — the small joys, in the spirit of the original Japanese
   meaning.
5. **My IKIGAI** — write the sentence (or let Clarity draft options), say how
   true it feels, and add one small first step as an action.

Everything autosaves, so you can stop and resume. Later, **Revisit** starts a
new draft from your current IKIGAI; completing it keeps the old one in the
history.

## Goals

Create goals per category, set measurements, and update status over time —
history is kept so progress is visible, not vibes. Each goal shows a
**progress bar** (% of its linked actions completed), a weekly momentum
arrow, and a badge when it's **stalled** (open actions but nothing completed
in two weeks) or **at risk** (target date near, under 50% done). The
dashboard collects goals needing attention in one place.

## Actions

**Actions** (sidebar, next to Goals) are the small steps that get big goals
done: a title, a priority, an optional due date, and an optional link to a
goal (or any other part of your book). Add with one line + Enter, check off
as you go, filter by status/priority/goal, and reorder. Actions created by
Clarity or an external agent are marked with a small robot icon, so you always
know where a task came from. Deleting an action is reversible-by-design
(soft delete).

Actions with due dates can appear in your real calendar — see
"Your calendar" below.

## Journal

Rich-text entries with titles, moods and dates. The search box is full-text
(it finds words inside entries, not just titles).

## Moodboards

Visual collages: upload images (stored privately, auto-resized), arrange them
on the canvas, add text, start from templates. **Snapshots** capture the state
of your boards/content so you can compare or restore later.

## Clarity — your personal assistant

Meet **Clarity** (the same name in Hebrew): a personal assistant that brings
clarity to your life. It knows your whole book and helps you see what you truly
want, find your real direction, and turn it into steps that happen. Clarity is
calm, warm and brief: it reflects back what it hears, checks that an idea
serves your vision and current chapter, asks one good question at a time, and
ends with one small next step.

Clarity chats over *your* content — searching it, reading items, reviewing
goals, and **proposing** changes. Proposals are never applied automatically:
you review and approve/reject each one. It is grounded in what you actually
wrote — never inventing content.

To enable it, add an AI provider in **Settings → AI models**:

1. **Add provider** → pick a preset (OpenRouter is the easiest; free models
   exist) → paste your API key → **Test** → make it active.
2. Your key is encrypted at rest and shown only masked. Other users never see
   it and their usage never touches it.

Details and the experimental ChatGPT option: [ai-providers.md](ai-providers.md).

### Autonomous routines

Once a provider is active you can let Clarity work for you on a schedule
(**Settings → Autonomous Clarity routines**): a **daily plan** that reviews your
goals and proposes today's 3–5 priorities (and refreshes the morning
briefing), a **weekly review prep** every Friday, and a **goal drift** check
that flags stalled goals with suggested next steps. Proposals wait for your
approval by default; flip **auto-apply** per routine if you want action
proposals executed immediately (bigger changes always wait for you). Each
routine shows when it last ran and what it did, and has a "Run now" button.

## External AI agents

Beyond the built-in Clarity, you can plug in outside agents — Claude Code,
Codex, Hermes, or anything MCP-capable — with a personal API key
(**Settings → AI agent access**). Keys are scoped (read-only or read &
write), shown once, revocable at any time, and **everything an agent changes
is logged** in the same Settings screen, including what the data looked like
before the change. Setup guide: [agent-access.md](agent-access.md).

## Your calendar

**Settings → AI agent access → Calendar feed** gives you a private URL to
subscribe to from Google/Apple/Outlook Calendar. Actions with due dates and
goals with target dates show up as all-day events (completed ones marked ✓).
Revoke the feed's key to kill the URL.

## Privacy in one paragraph

Your content lives in your own database file on the server, encrypted keys,
HTTPS-only cookies, nightly backups. The admin can disable or delete your
account (deleting removes all your data), reset your password, and see usage
totals (storage bytes, AI token counts, last login) — but cannot browse your
entries, goals, images or chats through the app. Full detail:
[security-privacy.md](security-privacy.md).
