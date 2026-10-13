# Dreamward design system — "Night sky"

The design system lives in `packages/design-system` (tokens, CSS, React
components, motion) and is used by `apps/web` and the desktop app. Brand
rules (name, logo, Clarity) are in [brand.md](brand.md); this document covers
how the interface looks and moves.

In dev builds, open **`/design`** in the app for the living reference: every
swatch, curve and component there is the real token or component, in both
themes and both directions.

## The idea

Dreamward is a private book about the life you want. It should feel like a
calm night with one star in it, not like a dashboard. Three rules follow:

1. **One star per screen.** Gold marks the one thing that matters on a screen:
   the primary action, the current step, the focus area. The chrome stays
   quiet ink.
2. **Depth is light, not lines.** Surfaces rise by getting lighter, with a 1 px
   highlight on the top edge, the way things catch moonlight. Borders are thin
   and faint; shadows only start at the popover level.
3. **Motion answers you.** Nothing moves on its own except the sky itself
   (a few twinkling stars, the ritual's breathing orb). Everything else moves
   because you did something, and shows what changed. Celebration is scaled to
   the achievement: an action gets a spark, a goal a burst, a chapter a sky.

## How it compares

We studied products whose craft is relevant to a reflective planning app.

| Product | What it does best | What we took | What we left |
|---|---|---|---|
| **Linear** | Perceptual (LCH) colour generated from a few inputs; quiet, warm-leaning neutrals; motion only for state | OKLCH ramps and semantic tokens; tinted neutrals instead of grey | Developer-tool density; faint text below AA |
| **Things 3** | Physical, delightful completion and drag interactions | A completion check that draws itself and lands before the row leaves | — |
| **Headspace** | Warm, functional illustration; a breathing animation that teaches | The breathing orb that opens a ritual | Mascot cuteness, which undercuts the weight of life-vision work |
| **How We Feel** | Colour intensity encodes emotional intensity | The 1–10 score scale runs from deep amber to bright star gold | Four competing hues |
| **Day One** | Content first; per-journal colour and memory resurfacing | Prose comes first; reader column of 72ch | Features hidden behind a "More" tab |
| **Finch** | Immediate, visible reward for small steps | Celebration scaled to the size of the achievement | Overloaded onboarding |
| **Apple HIG** | Springs set by duration and bounce; Reduce Motion means cross-fade, not nothing | Reduced motion becomes a short fade, never a frozen UI | — |
| **Material 3 Expressive** | Separate spring schemes for spatial motion and for colour/opacity | Springs move transforms only; opacity and colour never overshoot | Bouncing everything |
| **IBM Carbon / Atlassian** | A small, named duration scale; exits faster than entrances | Six durations; exits ≈ 0.7× entrances; hover/press under 150 ms | — |
| **Radix Colors** | A fixed role per step of a 12-step scale | Ramps with fixed roles (page, sunken, card, input, hover, border) | — |

What Dreamward does that these don't: bilingual EN/HE with full RTL as a
first-class case (logical properties, mirrored motion, Hebrew line-height),
and a brand motif — steps rising to a north star — that the motion system
reuses for every celebration and progress element.

## Tokens

Three tiers, in `src/tokens.css`:

| Tier | Prefix | Example | Who uses it |
|---|---|---|---|
| 1 · primitives | `--dw-ink-*`, `--dw-gold-*`, `--dw-day-*`, `--dw-mist-*` | `--dw-ink-3: #1a1a24` | Only tier 2 and the brand layer |
| 2 · semantic | `--rz-*` | `--rz-bg-raised`, `--rz-fg-muted`, `--rz-accent` | Feature code, via Tailwind classes (`bg-card`, `text-fg-muted`, `bg-primary`) |
| 3 · component | `.rz-*`, `.dw-*` classes | `.rz-btn--primary`, `.dw-check` | Components |

Feature code never uses tier 1 or raw colours. The `--rz-*` names are kept
from v1, so screens upgrade without changes.

### Colour

| Role | Dark | Light |
|---|---|---|
| Page | ink-1 `#0a0a0f` | white |
| Sidebar · sunken | ink-2 `#12121a` | day-2 `#f5f5f7` |
| Card | ink-3 `#1a1a24` | white |
| Input · popover | ink-4 `#22222e` | day-2 |
| Text | mist-1 `#e8e8ed` | dusk-1 `#0a0a0f` |
| Primary (fill) | gold-9 `#ffcc00` | gold-8 `#eeb300` |
| Gold as text | gold-9 | gold-11 `#976b03` |
| Horizon (ambient only) | soft gold glow `rgba(255,204,0,.14)` | `rgba(204,153,0,.12)` |

The ink is the original neutral near-black: depth comes from lighter steps
and a 1 px top highlight, not from tint. (A blue-violet ink was tried and
rolled back; the neutral night reads calmer.) The horizon glow appears only
in ambient light (`.dw-sky`, featured cards), never on a control.

### Contrast (WCAG 2.2, measured)

| Pair | Ratio |
|---|---|
| Body text on page (dark) | 16.6 : 1 |
| Muted text on card (dark) | 7.0 : 1 |
| Subtle text on card (dark) | 5.4 : 1 |
| Faint text on card / input (dark) | 4.9 / 4.6 : 1 |
| Gold text on card (dark) | 11.9 : 1 |
| Ink on gold button (dark) | 13.0 : 1 |
| Body text on page (light) | 16.9 : 1 |
| Gold text on white (light) | 4.7 : 1 |
| Ink on gold button (light) | 9.6 : 1 |

v1's faint text was 2.3 : 1 and was used for real text 70 times; v2 lifts
every text step above AA. Gold text in light mode uses the deep step
automatically (`text-primary` maps to `--rz-accent-text`).

### Type

- **One stack for both scripts:** `Poppins, Rubik`. Poppins has no Hebrew
  glyphs, so Hebrew falls through to Rubik glyph by glyph and mixed EN/HE lines
  keep one rhythm. In RTL, Rubik leads.
- **Scale (ratio ≈ 1.2):** 11 · 12 · 14 · **15 (product body)** · 16 (reading) ·
  19 · 23 · 24→28 · 28→33 · 32→40 · 38→48 · 44→60 (display sizes are fluid).
- **Line height:** 1.55 body, 1.65 Hebrew body, 1.2–1.25 headings.
- **Hebrew is never letter-spaced and never faux-italic.** Latin headings are
  tracked −0.018em. Direction rules use `:dir()`, so an English block inside the
  Hebrew app (and the reverse) gets the right font and tracking.
- Sentence case everywhere. No all-caps labels (they mean nothing in Hebrew).
- Changing numbers use tabular figures (`.tabular`).

### Space, radius, elevation

- 4 px grid (`--rz-space-1` … `--rz-space-24`).
- Radius grows with the surface: 4 tags · 8 inputs · 10 buttons · 14 cards ·
  20 panels · 28 sheets. Nested: inner radius = outer − padding.
- Elevation: level 0 page, 1 card (lighter + top highlight), 2 hover/raised
  (+ soft shadow), 3 popover/dialog (+ deep shadow, optional glass).
  `--rz-shadow-glow` is a signal (focus, achieved), not decoration.

## Motion

Defined in `src/keyframes.css`; React helpers in `src/motion`.

| Token | Value | Use |
|---|---|---|
| `--rz-dur-instant` | 80 ms | press |
| `--rz-dur-fast` | 120 ms | hover, focus |
| `--rz-dur` | 200 ms | small UI, exits |
| `--rz-dur-moderate` | 280 ms | menus, dialogs entering |
| `--rz-dur-slow` | 450 ms | page entrance (opacity) |
| `--rz-dur-ritual` | 900 ms | ritual moments; never blocks input |

| Curve | Kind | Use |
|---|---|---|
| `--rz-ease-standard` | cubic-bezier(0.2, 0, 0, 1) | colour, opacity, routine UI |
| `--rz-ease-enter` / `--rz-ease-exit` | (0,0,.3,1) / (.4,.14,1,1) | arriving / leaving |
| `--rz-spring-snappy` (320 ms) | linear() spring, no overshoot | press, toggles |
| `--rz-spring` (430 ms) | linear() spring, 1.5% overshoot | cards, panels, layout |
| `--rz-spring-dream` (610 ms) | linear() spring, 2.8% overshoot | celebrations, the wheel, progress |
| `--rz-spring-gentle` (650 ms) | critically damped | large surfaces |

Rules:

- **Springs move transforms only.** Opacity and colour use the béziers and
  never overshoot.
- **Exits ≈ 0.7× entrances.** Lists stagger 35 ms per item, capped at 8.
- **Navigation:** pages change inside a view transition. Only the page moves
  (old fades out in 120 ms, new rises in on the spring); the sidebar and header
  stay still. `withViewTransition()` applies the update directly if the
  browser can't animate within 200 ms, so navigation never waits on motion.
- **Directional motion is logical.** Slides use `--rz-inline-dir`, which flips
  in RTL; progress rings fill counter-clockwise in Hebrew.

### Reduced motion

Respecting `prefers-reduced-motion` does not mean freezing the UI. Under
reduced motion every animation becomes a 120 ms cross-fade, so changes stay
visible; ambient loops (`.rz-ambient`: twinkles, the breathing orb) stop;
hover lifts and press scales are removed; celebrations are silent.

Settings → **Motion** offers *Match my device / Reduced / Full*, stored per
device and applied as `data-motion` on `<html>` before first paint. *Full*
keeps motion even when the OS asks to reduce it.

## Components

From `@dreamward/design-system`:

| Component | Notes |
|---|---|
| `Button` | primary · secondary · outline · ghost · danger; sm · md · lg · icon; `loading`. Presses sink 3% and spring back. Disabled primary goes neutral (gold at half opacity turns muddy on ink). |
| `Card` | `interactive` lifts 2 px on a spring and catches the pointer's light (pair with `useSpotlight`); `featured` is the screen's one focal surface: horizon light and a gold hairline. |
| `Input`, `Textarea` | Gold focus ring (3 px, 45% gold). `aria-invalid` turns it red. |
| `.rz-select` | Class for native `<select>`: our chevron at the inline end (flips in RTL), same focus ring. |
| `Badge` | Rounded pill, sentence case. |
| `PageHeader` | Title, one sentence of purpose, optional breadcrumb (`eyebrow`) and icon, and the primary action at the inline end. Every page uses it. |
| `Dialog` | Native `<dialog>`: focus trap, Esc, inert page behind; centre or top placement. |
| `toast()` / `Toaster` | Confirmation with an optional action (Undo, View). At most three; they leave on their own. |
| `Skeleton`, `PageLoader` | A slow band of light, not a pulse. `PageLoader` is page-shaped and waits 250 ms before appearing, so fast loads never flash. |
| `EmptyState` | The steps appear one by one, then the star. An empty page is an invitation. |
| `Check` | Completion: the ring fills gold, the stroke draws in 220 ms, a step-sized spark flies. Accessible `role="checkbox"`. |
| `StarBurst` | `scale="step" | "goal" | "chapter"`: 6 / 12 / 20 particles, plus a flash for goals and chapters. |
| `ProgressRing` | Fills on the dream spring; mirrors in RTL; label scales with size. |
| `CountUp` | Numbers ease to their new value (tabular figures). |
| `BreathingOrb` | 4 s in, 4 s out. Opens the daily plan and weekly review. |
| `Twinkles` | A few stars on their own clocks. Decorative, ambient. |
| `Stagger` | One orchestrated entrance per screen, not on every section. |
| `ClarityAvatar` | idle · thinking · speaking (see brand.md). |
| Hooks | `useReducedMotion`, `setMotionPreference`, `withViewTransition`, `useSpotlight`. |

Brand-layer classes (`themes/dreamward.css`): `.dw-sky` (horizon + starfield),
`.dw-steps` (progress dots; the last one is the star), `.dw-prose` (reading
rhythm, per-paragraph direction), `.dw-nav-item` (the gold "current step"
marker), `.dw-wheel-shape` (the life wheel springs between ratings).

## Navigation and flows

The interface is organised around one question per screen.

| Place | Answers | What's there |
|---|---|---|
| **Today** (home) | What do I do now? | Today's steps, ranked overdue → today → next 3 days → toward a focus area, checkable in place, with quick-add; one line in the journal; goals in motion; where you stand (focus areas and biggest gaps, with a nudge when the wheel is over a month old); Clarity's briefing and suggestions when it's set up. |
| **Current chapter** | What is this season for? | The chapter, its focus and maintenance areas, and the life wheel with **Rate all areas**: twelve scales in one place, the wheel pinned beside them. |
| **My book** | What have I written? | Foundations (cover, dream life, IKIGAI, opening and closing pages) and the twelve areas with score, focus and goal count. Every book page is reachable from here. |
| **Goals** | Where am I going? | Each goal holds its steps: add, check, progress ring, target date, edit in place. *Achieved* celebrates; the review outcome is secondary. |
| **Actions** | Everything I committed to | The full list with filters, priorities and ordering; due dates edit in place. |
| **Journal** | What's on my mind? | Opens on today's page; prompts when it's blank; empty drafts clean themselves up. |
| **Vision boards** | What does it look like? | Boards (rename in place, delete with Undo), with the image library one link away. |

The sidebar shows these seven, then the chapter's **focus areas** with their
scores; the other areas are one click away. Everything else (gallery,
snapshots, any page or area) is in the command palette, and Snapshots is
also in Settings.

**Command palette (⌘K / Ctrl K, or the search field in the sidebar).** Jump
to any page or area, find a goal or journal entry by its words (matches are
listed first, so Enter opens what you already have), switch theme or
language, or type a title and press Enter to add it as a step or a goal.
New items confirm with a toast.

**Weekly review (`/review`).** A ten-minute ritual that needs no AI: arrive
(a breathing orb) → look back at the week's checked-off steps → re-rate the
focus areas (each tap saves) → a pass over every open goal (mark it achieved,
or give it a next step) → next week (what's already due, plus up to three
more) → one honest paragraph saved to the journal → done. Today invites you
to it from Friday to Sunday when the last review is six or more days old; it's
also in ⌘K and on `G R`.

**Product tour.** A spotlight walks the real interface (navigation, today's
steps, quick add, the journal line, ⌘K, the chapter, the book, Clarity). Two
steps are interactive: they wait for you to check off a step or press ⌘K, and
the spotlight's hole lets that click through while the rest of the page is
shielded. It starts once on Today after the guided start, and can be replayed
from Settings or ⌘K. Arrow keys follow the reading direction; Esc leaves.
Targets are `data-tour` attributes; steps live in `features/tour/steps.ts`.

**Keyboard.** ⌘K / Ctrl K or `/` for the palette; `G` then `T` Today,
`C` Chapter, `B` Book, `G` Goals, `A` Actions, `J` Journal, `M` Vision
boards, `R` Review; `?` lists them. Single-key shortcuts are off while
typing.

**Trust rules.**
- Writing never waits on a button: editors autosave, flush when you leave,
  and warn before the tab closes mid-save.
- Deletes don't ask "are you sure?": they happen at once and offer **Undo**
  for six seconds; the server delete lands only when the toast runs out.
- Every create, complete and delete confirms with a toast.

**Area pages connect the vision to doing:** the score and its trend, the
area's goals and next steps ("In motion"), and each section; empty ones show
the question that gets you writing.

**Bilingual lists.** Titles in lists are wrapped in `<bdi>`: a Hebrew title in
the English UI (or the reverse) keeps its own word order but aligns with the
row, so metadata and titles line up.


## Patterns in the app

- **The current step:** the active nav item gets a 3 px gold marker that
  springs in. It's the only gold in the chrome.
- **A step counts:** checking an action shows the check and spark at once and
  sends the update ~550 ms later, so the row doesn't vanish before you see it
  land. If the row unmounts first, the update is sent immediately.
- **Rate an area:** the score scale runs deep amber → star gold; a change sweeps
  as a wave from the old value; the wheel's shape springs to the new score,
  lit from its centre.

## Rules for contributors

- Use semantic classes (`bg-card`, `text-fg-muted`, `border-border`,
  `bg-primary`), never hex values or `--dw-*` primitives in feature code.
- Gold text is `text-primary` (it picks the accessible step per theme). Text
  on gold is `text-[color:var(--rz-accent-fg)]`, never white.
- Labels are sentence case. No `uppercase`, no mono for labels.
- Use logical properties (`ms-`, `pe-`, `start-`, `border-s`), never
  left/right.
- New motion: pick a duration and curve from the tables above, make it
  answer an action, and check it under `data-motion="reduced"`.
- Check every new screen at `/design`-level quality in dark, light, RTL and
  375 px wide.
