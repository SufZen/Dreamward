# First-run onboarding — design

Roadmap item 1 ([docs/roadmap.md](../../roadmap.md)): *from an empty book to a
first move in 10 minutes.*

## Intent

Every new user starts from an empty book. The dashboard's welcome card points
at pages but does not guide. Success: a new user, in about ten minutes, has an
active chapter, a rated wheel, 1–5 focus areas with their biggest gap, and one
concrete first action — or has skipped any of that without friction.

Decisions taken with the maintainer (2026-10-01):

| Question | Decision |
|---|---|
| Where does state live? | Progress is **derived** from existing data; only `pending / dismissed / completed` is stored, in a new additive `user_flags` table behind a **web-only** route. |
| Form | A dedicated **`/start`** route with a stepper shared with the IKIGAI wizard. |
| Wheel depth | Scores for all 12 areas; a "biggest gap" line only for chosen focus areas. |
| Entry | **Offered, not forced**: the welcome card's main CTA, plus a Settings link. No redirects. |
| Clarity | Suggests the **first move only**, when an AI provider is active. |

## Non-goals

- No new `/api/v1` endpoint, MCP tool or CLI command (see *Agent surface*).
- No embedding of the IKIGAI wizard; the IKIGAI step links to it.
- No nudges for existing books with data.

## Data and contract

**`packages/shared/src/onboarding.ts`** (exported from the index):

- `ONBOARDING_STATUSES = ['pending', 'dismissed', 'completed']`,
  `onboardingStatusSchema`, `updateOnboardingSchema = { status }`.
- `onboardingProgressSchema = { hasChapter, focusCount, ratedCount, hasIkigai, hasAction }`.
- `onboardingSchema = { status, fresh, progress }`.
- Pure functions, unit-tested:
  - `isFreshBook({ hasChapter, goalCount })` — no active chapter and no goals
    (today's welcome-card rule, now shared).
  - `firstOpenStep(progress)` — the resume position: `chapter` → `wheel` →
    `focus` → `ikigai` → `move` → `done`. A step counts as open when its data
    is missing; IKIGAI is optional and is skipped by resume once the user
    passes it in the session.
- `onboardingSuggestSchema = { lang?: 'en' | 'he' }`.

**User-DB migration (additive):** table `user_flags (key TEXT PK, value TEXT
JSON NOT NULL, updated_at INTEGER NOT NULL)`. Generated with
`pnpm --filter @dreamward/api db:generate`. Only known keys are written
(today: `onboarding`). Missing row ⇒ `pending`. Export/import copies the whole
DB, so the table travels with the book.

## API (web-only)

`apps/api/src/routes/onboarding.ts`, registered **only** in
`registerFeatureRoutes` (cookie auth, `/api`):

- `GET /api/onboarding` → `onboardingSchema`. Progress comes from the active
  chapter, `latestRatings()`, the current IKIGAI and the action count.
- `PUT /api/onboarding { status }` → the same shape.

`POST /api/agent/onboarding/suggest { lang }` in `routes/agent.ts`, next to the
IKIGAI suggester: `agent/onboardingSuggest.ts` asks Clarity for 3 small,
high-impact, easy first actions grounded in the chapter, focus areas + gaps
and IKIGAI (via `buildDigest('compact')`). It reuses `parseSuggestions`,
writes nothing, answers 409 `no_active_provider` without a provider and 503 on
other errors — the same contract as `/agent/ikigai/suggest`.

All real writes use existing endpoints: `POST/PUT /chapters`, `POST /ratings`,
`POST /actions`. Tenant safety: data only via `getDb()` in the request; no
module-scope handles; no `control.ts`.

### Agent surface

AGENTS.md rule 7 applies to new `/api/v1` endpoints. This feature adds none:
the onboarding flag is a UI preference, and everything onboarding *creates*
(chapter, ratings, action) is already readable and writable through existing
MCP tools, OpenAPI and the CLI. A test asserts `/api/v1/onboarding` is 404 so
the route cannot leak there unnoticed. `docs/agent-access.md` is unchanged.

## Web

- `components/Stepper.tsx` — extracted from `IkigaiWizard.tsx`: the
  "Step n of N · title" label and the progress dots with `aria-current="step"`
  and an optional per-step colour. IKIGAI uses it with unchanged behaviour.
- `features/onboarding/hooks.ts` — `useOnboarding`, `useSetOnboardingStatus`,
  `useOnboardingSuggest`.
- `features/onboarding/StartPage.tsx` at `/start`:
  1. **Name this chapter** — title (required to continue) + intention →
     `POST /chapters`, or `PUT` when an active chapter exists.
  2. **Rate your wheel** — one `ScoreSlider` per area. Touched areas only.
     Scores are kept in page state (and `sessionStorage`, as a per-browser
     convenience) and **flushed when step 3 is left**, so the focus gaps land
     on the same append-only rating instead of a duplicate one.
  3. **Pick your focus** — choose 1–5 areas (lowest scores hinted) and an
     optional one-line gap per chosen area. Leaving the step (Next or Skip)
     posts the ratings (with gaps for focus areas) and, on Next, `PUT`s
     `focusCategoryIds`.
  4. **IKIGAI (optional)** — *Do it now* opens `/ikigai?from=start`; completing
     the wizard returns to `/start`. *Later* moves on.
  5. **Your first move** — one action title; with AI, 3 Clarity chips fill the
     field. Linked to the first focus area's *strategy* section
     (`linkedType: 'section'`) when there is one. Then
     `PUT /api/onboarding { completed }` and a short done screen → dashboard.
- Header: *Not now* → `dismissed` and back to the dashboard. Each step but the
  first has *Skip*.
- Resume: opening `/start` goes to `firstOpenStep(progress)`.
- Dashboard: the welcome card shows when `fresh && status === 'pending'`; its
  main CTA becomes **Start · ~10 min** → `/start`; the chapter link stays as a
  secondary link.
- Settings: a *Guided start* row with **Open guided start**, which sets
  `pending` and navigates to `/start`.
- EN + HE for every string (`he ? … : …`, as in the dashboard/IKIGAI);
  directional arrows use `rtl:rotate-180`; inputs inherit `dir`. Step headings
  receive focus on step change; motion loops stay `aria-hidden`.

## Errors

A failed save keeps the user on the step with an inline EN/HE error; previous
steps are already saved. If an active chapter appears mid-flow, step 1 updates
it. Suggestion failures hide the chips and leave the text field.

## Testing

- `packages/shared`: `isFreshBook`, `firstOpenStep` (via the API vitest suite,
  as `ikigaiLogic.test.ts` does for `ikigai.ts`).
- API (`onboarding.test.ts`, vitest + `app.inject`): empty book is fresh and
  `pending`; progress follows chapter/rating/IKIGAI/action writes; `PUT`
  validates and persists; `/api/v1/onboarding` is 404; suggest is 409 without
  a provider. `isolation.test.ts`: one user's flag is invisible to another.
  `upgrade.test.ts` stays green with the new migration.
- `pnpm typecheck` and `pnpm --filter @dreamward/api test`.
- Manual, **sandbox only** (`node scripts/dev-sandbox.mjs`, launch config
  `dreamward-sandbox`): EN and HE, desktop and 375 px; resume after leaving at
  step 3; dismiss + reopen from Settings; with and without an AI provider; the
  IKIGAI detour.

## Docs

User-guide section *Guided start*; roadmap item 1 marked shipped when merged.
