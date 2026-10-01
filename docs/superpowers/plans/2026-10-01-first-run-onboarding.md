# First-run onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A skippable, resumable `/start` path that takes a new user from an empty book to a chapter, a rated wheel, focus areas and a first action in about ten minutes.

**Architecture:** Progress is derived from existing data; a single stored flag (`pending / dismissed / completed`) lives in a new additive `user_flags` table behind web-only `/api/onboarding` routes. All content writes reuse the existing chapter, rating and action endpoints. The web gets a `/start` page built on a `Stepper` extracted from the IKIGAI wizard.

**Tech Stack:** zod (`packages/shared`), Fastify 5 + drizzle/better-sqlite3 (`apps/api`), vitest + `app.inject`, React 19 + TanStack Query + Tailwind (`apps/web`).

**Spec:** [docs/superpowers/specs/2026-10-01-first-run-onboarding-design.md](../specs/2026-10-01-first-run-onboarding-design.md)

## Global Constraints

- Contract first: zod schemas in `packages/shared` before server, then web.
- User-DB migrations additive only, generated with `pnpm --filter @dreamward/api db:generate`; never edit a shipped migration; `upgrade.test.ts` stays green.
- Tenant isolation: data only via `getDb()` inside a request; no module-scope DB handles; never import `control.ts` from feature routes.
- No new `/api/v1` endpoint (so no MCP/OpenAPI/CLI work); `/api/v1/onboarding` must 404.
- Every user-facing string in EN and HE; `rtl:rotate-180` on directional arrows; keep `dir` handling.
- Manual testing only against the sandbox (`node scripts/dev-sandbox.mjs`, launch config `dreamward-sandbox`).
- Conventional Commits, `git commit -s`.

## Review Focus

- A user who leaves at step 3 (focus) and comes back: wheel scores must not be lost silently → ratings are flushed on *Skip* as well as *Next*; resume lands on `focus` when a chapter exists but no ratings, and on `move` when chapter + ratings + focus exist. Pinned by `firstOpenStep` tests (Task 1).
- An agent or another tab creates the active chapter while `/start` is open → step 1 updates instead of failing with 409. Pinned by the web step logic using `PUT` when `chapter` exists (Task 5) and the API test that progress reflects a chapter created over `/api/v1` (Task 2).
- `PUT /api/onboarding` with an unknown status or extra keys → 400, nothing stored (Task 2 test).
- A second user on a self-hosted server must never see the first user's flag (Task 2 isolation test).
- No AI provider → suggest route returns 409 and the move step still works with a typed title (Task 3 test; Task 5 UI hides chips on error).

---

### Task 1: Shared onboarding contract

**Files:**
- Create: `packages/shared/src/onboarding.ts`
- Modify: `packages/shared/src/index.ts` (add `export * from './onboarding';`)
- Test: `apps/api/src/__tests__/onboarding.test.ts` (pure-function block)

**Interfaces — Produces:**
```ts
export const ONBOARDING_STATUSES = ['pending', 'dismissed', 'completed'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export const ONBOARDING_STEPS = ['chapter', 'wheel', 'focus', 'ikigai', 'move'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const onboardingProgressSchema: z.ZodObject<{ hasChapter; focusCount; ratedCount; hasIkigai; hasAction }>;
export type OnboardingProgress;
export const onboardingSchema: z.ZodObject<{ status; fresh; progress }>;
export type Onboarding;
export const updateOnboardingSchema: z.ZodObject<{ status }>; // .strict()
export const onboardingSuggestSchema: z.ZodObject<{ lang?: 'en' | 'he' }>;
export function isFreshBook(x: { hasChapter: boolean; goalCount: number }): boolean;
export function firstOpenStep(p: OnboardingProgress, opts?: { ikigaiSeen?: boolean }): OnboardingStep | 'done';
```

- [ ] **Step 1: Write the failing tests**

```ts
describe('onboarding logic', () => {
  const p = (o: Partial<OnboardingProgress> = {}): OnboardingProgress =>
    ({ hasChapter: false, focusCount: 0, ratedCount: 0, hasIkigai: false, hasAction: false, ...o });
  it('a book is fresh without chapter and goals', () => {
    expect(isFreshBook({ hasChapter: false, goalCount: 0 })).toBe(true);
    expect(isFreshBook({ hasChapter: true, goalCount: 0 })).toBe(false);
    expect(isFreshBook({ hasChapter: false, goalCount: 1 })).toBe(false);
  });
  it('resumes at the first step whose data is missing', () => {
    expect(firstOpenStep(p())).toBe('chapter');
    expect(firstOpenStep(p({ hasChapter: true }))).toBe('wheel');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3 }))).toBe('focus');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3, focusCount: 2 }))).toBe('ikigai');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3, focusCount: 2 }), { ikigaiSeen: true })).toBe('move');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3, focusCount: 2, hasIkigai: true }))).toBe('move');
    expect(firstOpenStep(p({ hasChapter: true, ratedCount: 3, focusCount: 2, hasIkigai: true, hasAction: true }))).toBe('done');
  });
  it('rejects unknown statuses and extra keys', () => {
    expect(updateOnboardingSchema.safeParse({ status: 'done' }).success).toBe(false);
    expect(updateOnboardingSchema.safeParse({ status: 'completed', x: 1 }).success).toBe(false);
  });
});
```

- [ ] **Step 2:** `pnpm --filter @dreamward/api test -- onboarding` → FAIL (module exports missing).
- [ ] **Step 3: Implement** `onboarding.ts`:

```ts
import { z } from 'zod';

export const ONBOARDING_STATUSES = ['pending', 'dismissed', 'completed'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export const ONBOARDING_STEPS = ['chapter', 'wheel', 'focus', 'ikigai', 'move'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const onboardingStatusSchema = z.enum(ONBOARDING_STATUSES);
export const onboardingProgressSchema = z.object({
  hasChapter: z.boolean(),
  focusCount: z.number().int(),
  ratedCount: z.number().int(),
  hasIkigai: z.boolean(),
  hasAction: z.boolean(),
});
export type OnboardingProgress = z.infer<typeof onboardingProgressSchema>;
export const onboardingSchema = z.object({ status: onboardingStatusSchema, fresh: z.boolean(), progress: onboardingProgressSchema });
export type Onboarding = z.infer<typeof onboardingSchema>;
export const updateOnboardingSchema = z.object({ status: onboardingStatusSchema }).strict();
export const onboardingSuggestSchema = z.object({ lang: z.enum(['en', 'he']).optional() });

export function isFreshBook(x: { hasChapter: boolean; goalCount: number }): boolean {
  return !x.hasChapter && x.goalCount === 0;
}

export function firstOpenStep(p: OnboardingProgress, opts: { ikigaiSeen?: boolean } = {}): OnboardingStep | 'done' {
  if (!p.hasChapter) return 'chapter';
  if (p.ratedCount === 0) return 'wheel';
  if (p.focusCount === 0) return 'focus';
  if (!p.hasIkigai && !opts.ikigaiSeen) return 'ikigai';
  if (!p.hasAction) return 'move';
  return 'done';
}
```

- [ ] **Step 4:** rerun → PASS. `pnpm typecheck`.
- [ ] **Step 5:** `git commit -s -m "feat(shared): onboarding contract and resume logic"`

### Task 2: `user_flags` table, service and web-only routes

**Files:**
- Modify: `apps/api/src/db/schema.ts` (append table)
- Create: `apps/api/drizzle/0007_*.sql` + meta (generated)
- Create: `apps/api/src/services/onboarding.ts`, `apps/api/src/routes/onboarding.ts`
- Modify: `apps/api/src/routes/index.ts` (register in `registerFeatureRoutes` **only**)
- Test: `apps/api/src/__tests__/onboarding.test.ts`, `apps/api/src/__tests__/isolation.test.ts`

**Interfaces — Consumes:** Task 1 types. **Produces:** `GET /api/onboarding → Onboarding`, `PUT /api/onboarding {status} → Onboarding`; `getOnboarding(): Onboarding`, `setOnboardingStatus(s): Onboarding`.

- [ ] **Step 1: Failing API tests** (same harness as `meaning.test.ts`: temp `DATA_DIR`, admin login cookie, `req()` helper):

```ts
it('an empty book is fresh and pending', async () => {
  const r = await req('GET', '/onboarding');
  expect(r.statusCode).toBe(200);
  expect(r.json()).toEqual({ status: 'pending', fresh: true,
    progress: { hasChapter: false, focusCount: 0, ratedCount: 0, hasIkigai: false, hasAction: false } });
});
it('progress follows the book', async () => {
  const ch = (await req('POST', '/chapters', { title: 'Season of roots' })).json() as { id: string };
  await req('POST', '/ratings', { categoryId: 'health_fitness', score: 4 });
  await req('PUT', `/chapters/${ch.id}`, { focusCategoryIds: ['health_fitness'] });
  await req('POST', '/actions', { title: 'Walk 20 minutes' });
  const o = (await req('GET', '/onboarding')).json();
  expect(o.fresh).toBe(false);
  expect(o.progress).toMatchObject({ hasChapter: true, focusCount: 1, ratedCount: 1, hasAction: true });
});
it('stores the status and validates it', async () => {
  expect((await req('PUT', '/onboarding', { status: 'nope' })).statusCode).toBe(400);
  expect((await req('PUT', '/onboarding', { status: 'dismissed' })).json().status).toBe('dismissed');
  expect((await req('GET', '/onboarding')).json().status).toBe('dismissed');
});
it('is not part of the /api/v1 agent surface', async () => {
  const r = await app.inject({ method: 'GET', url: '/api/v1/onboarding', headers: { authorization: 'Bearer lbk_invalid' } });
  expect([401, 404]).toContain(r.statusCode); // invalid key → 401 before routing is fine; with a valid key → 404
});
```
With a valid key (created via `POST /api/api-keys` in the test), assert 404 exactly.

Isolation (`isolation.test.ts`): admin `PUT /api/onboarding {dismissed}`; the second user's `GET /api/onboarding` returns `pending`.

- [ ] **Step 2:** run → FAIL (404 on `/api/onboarding`).
- [ ] **Step 3: Schema + migration**

```ts
/* ── Per-user UI flags (key → JSON), e.g. onboarding status ─────────────── */
export const userFlags = sqliteTable('user_flags', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at').notNull().default(now),
});
```
Run `pnpm --filter @dreamward/api db:generate`; inspect the SQL is a single `CREATE TABLE`.

- [ ] **Step 4: Service** `services/onboarding.ts`:

```ts
const KEY = 'onboarding';
export function getOnboardingStatus(): OnboardingStatus {
  const row = getDb().select().from(schema.userFlags).where(eq(schema.userFlags.key, KEY)).get();
  const parsed = onboardingStatusSchema.safeParse((row?.value as { status?: unknown } | undefined)?.status);
  return parsed.success ? parsed.data : 'pending';
}
export function setOnboardingStatus(status: OnboardingStatus): Onboarding {
  getDb().insert(schema.userFlags).values({ key: KEY, value: { status }, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: schema.userFlags.key, set: { value: { status }, updatedAt: Date.now() } }).run();
  return getOnboarding();
}
export function getOnboarding(): Onboarding {
  const db = getDb();
  const chapter = getActiveChapter();
  const goalCount = db.select({ n: count() }).from(schema.goals).get()?.n ?? 0;
  const ratedCount = latestRatings().filter((r) => r.latest).length;
  const progress = { hasChapter: !!chapter, focusCount: chapter?.focusCategoryIds.length ?? 0, ratedCount,
    hasIkigai: !!getCurrentIkigai(), hasAction: (db.select({ n: count() }).from(schema.actions).get()?.n ?? 0) > 0 };
  return { status: getOnboardingStatus(), fresh: isFreshBook({ hasChapter: !!chapter, goalCount }), progress };
}
```

- [ ] **Step 5: Routes** `routes/onboarding.ts`:

```ts
export default async function onboardingRoutes(app: FastifyInstance) {
  app.get('/onboarding', async () => getOnboarding());
  app.put('/onboarding', async (req, reply) => {
    const parsed = updateOnboardingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    return setOnboardingStatus(parsed.data.status);
  });
}
```
Register in `registerFeatureRoutes` with a comment: *web-only UI preference; deliberately not in `registerAgentApiRoutes`*.

- [ ] **Step 6:** full API suite incl. `upgrade.test.ts` → PASS. `pnpm typecheck`.
- [ ] **Step 7:** `git commit -s -m "feat(api): onboarding status and derived progress"`

### Task 3: Clarity first-move suggestions

**Files:** Create `apps/api/src/agent/onboardingSuggest.ts`; modify `apps/api/src/routes/agent.ts`; test in `onboarding.test.ts`.

**Produces:** `POST /api/agent/onboarding/suggest {lang} → { suggestions: string[] }` (409 `no_active_provider`, 503 other errors).

- [ ] **Step 1: Failing test**
```ts
it('suggest needs an AI provider', async () => {
  const r = await req('POST', '/agent/onboarding/suggest', { lang: 'en' });
  expect(r.statusCode).toBe(409);
  expect(r.json()).toEqual({ error: 'no_active_provider' });
});
```
- [ ] **Step 2:** run → FAIL (404).
- [ ] **Step 3: Implement** — mirror `ikigaiSuggest.ts`: `getActiveProvider()` guard; system prompt as Clarity asking for 3 first actions (max 10 words, doable within a week, small/high-impact/easy/enjoyable, in focus areas, using the gaps), language from `lang`, context = `buildDigest('compact').markdown`; `chatOnce` with `maxTokens: 400`, 60 s timeout; `parseSuggestions(content, 3)`. Route: `onboardingSuggestSchema.safeParse(req.body ?? {})`, default `lang` `'he'` like the IKIGAI route, same status mapping.
- [ ] **Step 4:** run → PASS; typecheck.
- [ ] **Step 5:** `git commit -s -m "feat(api): Clarity suggests a first move for onboarding"`

### Task 4: Extract the `Stepper`

**Files:** Create `apps/web/src/components/Stepper.tsx`; modify `apps/web/src/features/ikigai/IkigaiWizard.tsx`.

**Produces:**
```ts
export interface StepperStep { key: string; en: string; he: string; color?: string }
export function Stepper(props: { steps: StepperStep[]; step: number; onGo?: (i: number) => void; aside?: React.ReactNode }): JSX.Element;
```
Body = the `<nav>` block from `IkigaiWizard` (label "Step n of N · title", dots, `aria-current="step"`, colour per step); dots are buttons only when `onGo` is passed. IKIGAI passes `color` from `IKIGAI_CIRCLES` and `aside={<SaveIndicator …/>}`.

- [ ] Verify: typecheck; sandbox → IKIGAI wizard dots/colours/labels unchanged in EN and HE.
- [ ] `git commit -s -m "refactor(web): shared Stepper from the IKIGAI wizard"`

### Task 5: `/start` page

**Files:** Create `apps/web/src/features/onboarding/hooks.ts`, `apps/web/src/features/onboarding/StartPage.tsx`; modify `apps/web/src/App.tsx` (lazy route `start`).

**Consumes:** Tasks 1–4; existing hooks `useCurrentChapter`, `useCreateChapter`, `useUpdateChapter`, `useLatestRatings`, `useCategories`, `useAreaLabel`, `useAiAvailable`, `ScoreSlider`, `OnboardingMotion`.

**Produces (hooks):** `useOnboarding()`, `useSetOnboardingStatus()`, `useOnboardingSuggest()`.

Behaviour (each bullet is a review checkpoint):
- On load, `step = firstOpenStep(progress, { ikigaiSeen })` where `ikigaiSeen` comes from `sessionStorage['dw.start.ikigaiSeen']` or `?from=ikigai`; `done` shows the done screen.
- **Chapter:** title required for *Next*; `POST /chapters` or `PUT /chapters/:id` if one is active.
- **Wheel:** a `ScoreSlider` per category (label = area name), local map `scores`, mirrored to `sessionStorage['dw.start.scores']` (try/catch).
- **Focus:** toggles, max `MAX_FOCUS_AREAS`, the three lowest scores marked as hints, one `gap` input per selected area. *Next* (≥1 area) → post ratings (gap for focus areas) then `PUT` focus; *Skip* → post ratings only. Clear the stored scores after the flush.
- **IKIGAI:** *Do it now* → set `ikigaiSeen`, navigate `/ikigai?from=start`; *Later* → set `ikigaiSeen`, next.
- **Move:** title input; when `useAiAvailable()` is true, a *Suggest* button loads ≤3 chips (errors hide them); link to the first focus area's `strategy` section via `GET /categories/:id`; `POST /actions`; `PUT /onboarding {completed}`; done screen with a link to the dashboard.
- Header *Not now* → `PUT /onboarding {dismissed}` → navigate `/`.
- Step heading gets `tabIndex={-1}` and focus on step change. All strings EN/HE.

- [ ] Verify: typecheck; sandbox walk-through (see Task 7).
- [ ] `git commit -s -m "feat(web): guided start from an empty book to a first move"`

### Task 6: Entry points

**Files:** modify `apps/web/src/features/dashboard/Dashboard.tsx`, `apps/web/src/features/settings/SettingsPage.tsx`, `apps/web/src/features/ikigai/IkigaiWizard.tsx`.

- Dashboard: `fresh` comes from `useOnboarding()` (`data.fresh && data.status === 'pending'`); main CTA **Start · ~10 min** → `/start`; secondary link *Or start with your chapter* → `/chapter`.
- Settings: a *Guided start* card with **Open guided start** → `PUT {pending}` then navigate `/start`.
- IKIGAI: after `complete` succeeds, if `?from=start` navigate to `/start?from=ikigai`.
- Invalidate `['onboarding']` after chapter/rating/action mutations made from `/start`.

- [ ] Verify: typecheck; sandbox.
- [ ] `git commit -s -m "feat(web): offer the guided start from the dashboard and settings"`

### Task 7: Docs and verification

- [ ] `docs/user-guide.md`: a *Guided start* section (EN), describing the five steps, skip/resume and where to reopen it.
- [ ] `pnpm typecheck` and `pnpm --filter @dreamward/api test` — all green.
- [ ] Sandbox (`dreamward-sandbox` launch config only): EN + HE, desktop + 375 px; leave at step 3 and reopen; dismiss → welcome card gone → reopen from Settings; with no AI provider (no Suggest button); IKIGAI detour returns to `/start`. Screenshot the flow for the PR.
- [ ] `git commit -s -m "docs: guided start in the user guide"`; push; open the PR `feat: first-run onboarding — from an empty book to a first move`.
