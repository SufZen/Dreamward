# Dreamward brand

**Dreamward**: *move toward the life you envision.*

The brand has one idea: a north star (the life you envision) and the small
steps that lead to it. Everything visual comes from that picture, set in a
calm night sky. Dreamward uses the REALIZEOS design language (night ink and
gold, Poppins and Rubik); these guidelines add the Dreamward layer.

Files: `packages/design-system/assets/`. Code: `DreamwardLogo` and
`DreamwardMark` from `@dreamward/design-system`, tokens in
`packages/design-system/src/tokens.css` and `themes/dreamward.css`.

## Name

- Write **Dreamward**: one word, capital D. The wordmark is set in lowercase
  (`dreamward`); running text is not.
- In Hebrew text the name stays in Latin letters: Dreamward.
- The personal assistant is **Clarity**, in every language (in Hebrew too,
  in Latin letters; never translated). Clarity is a character inside Dreamward,
  not a second brand. Its job is in its name: it brings clarity, helps people
  find their true direction, and turns it into steps.
- In Hebrew UI text, avoid gendered verbs for Clarity: "שיחה עם Clarity",
  "הצעות מ-Clarity", not "Clarity מציע".
- Say "your book" for the user's content ("Suggest from my book"), and
  "Dreamward" for the product.

## Logo

| File | Use |
|---|---|
| `lockup-on-dark.svg` | Default: headers, README, social cards on ink |
| `lockup-on-light.svg` | Light backgrounds (deep-gold star, ink wordmark) |
| `lockup-current.svg` | Wordmark follows `currentColor`, the star is gold |
| `mark.svg` / `mark-gold.svg` / `mark-gold-deep.svg` | Square spaces, avatars, loading states |
| `favicon.svg` | Browser tabs. The star alone, because the steps vanish at 16 px |
| `app-icon.svg` (+ `app-icon-512.png`) | Desktop and PWA icon: the mark on a night-sky tile with the star's glow |
| `social-preview.svg` / `.png` | Link previews and the GitHub social preview (1280×640) |

- **The mark:** four steps (dots that grow as they rise) toward a north star.
  The star's vertical ray is longer than the horizontal one. It is a compass
  star, not the four-point ✨ "AI sparkle"; don't swap them.
- **Clear space:** keep at least the star's height free around the lockup.
- **Minimum size:** lockup 96 px wide, mark 20 px. Below that, use the
  favicon star.
- **Colour:** the star is gold `#ffcc00` on dark and deep gold `#cc9900` on
  light. The wordmark is mist `#e8e8ed` on dark and ink `#0a0a0f` on light.
  Never place a gold star on white.
- **Don't** stretch the logo, recolour the star, add effects to the wordmark,
  rearrange the steps, or put the logo on busy photos without an ink panel.

### Clarity's avatar

The north star from the mark inside a thin gold focus ring (a lens snapping
into focus), with the mark's four steps orbiting it, always on night ink.
`ClarityAvatar` (`size`, `state`) in the design system; static copy in
`assets/clarity-avatar.svg`.

| State | Motion |
|---|---|
| `idle` | a slow, gentle glow |
| `thinking` | the ring tightens into focus; the steps light up in turn |
| `speaking` | a steady, brighter glow |

Reduced motion shows the static avatar.

## Colour

| Token | Dark | Light | Role |
|---|---|---|---|
| `--rz-bg` (Ink) | `#0a0a0f` | `#ffffff` | Page |
| `--rz-bg-sunken` / `--rz-bg-raised` | `#12121a` / `#1a1a24` | `#f5f5f7` / `#ffffff` | Sidebar / cards |
| `--rz-fg` (Mist) | `#e8e8ed` | `#0a0a0f` | Text |
| `--rz-fg-muted` | `#9a9ab0` | `#6b6b80` | Secondary text |
| `--rz-accent` (Gold) | `#ffcc00` | `#cc9900` | The star: actions, focus, highlights |
| `--rz-success` / `warning` / `danger` / `info` | green / amber / red / blue | darker versions | Status only |

- **Gold is scarce.** Use it for the one thing that matters on a screen: the
  primary action, the focus area, the current step. Two gold elements
  competing on one screen is too many.
- **Dark is home.** Dreamward opens in dark mode. Light mode is a full
  equal, not an afterthought.
- Status colours are for state, never for decoration.

## Type

- **Poppins** for Latin text (headings 600, body 400/500), and **Rubik**
  whenever the direction is RTL. `JetBrains Mono` for data and code.
- Headings use `line-height: 1.25` and `letter-spacing: -0.015em`. The type
  scale is in `tokens.css` (`--rz-text-*`).
- Long-form writing (`.dw-prose`) is capped at 72 characters wide with
  line-height 1.75. Every paragraph finds its own direction, so Hebrew and
  English can share a page.

## Visual elements

1. **The north star:** the vision. It appears in the mark, on focus areas and
   on completed chapters. One star per screen.
2. **The steps:** small actions. Growing dots mark progress (`.dw-steps`,
   with `[data-done]` for completed steps), streaks and loading.
3. **The night sky:** the background of dreaming. A quiet starfield
   (`.dw-starfield`) and the star's glow on the horizon (`.dw-horizon`), used
   on hero surfaces such as sign-in, the dashboard header and empty states.
   Never behind long text.
4. **Icons:** lucide line icons with rounded caps, 1.5–2 px strokes, 16–20 px
   in UI. No emoji as section markers.
5. **Motion:** calm. Use `--rz-ease-out` at 180–320 ms. The only celebration
   is the star brightening when something is completed. Everything respects
   `prefers-reduced-motion`.

## Voice

Warm, clear and honest, like a wise friend, not a hype coach.

- Write short, plain sentences. Address the person as "you" and speak
  gently about gaps ("the biggest gap", not "your failure").
- Use the person's own words back to them. Don't invent their content.
- Hebrew is a first-class voice, not a translation. Write it natively.
