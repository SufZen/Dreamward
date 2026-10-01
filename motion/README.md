# Dreamward onboarding motion

Short, silent, looping illustrations for the first-run moments in the app, made with
[Remotion](https://www.remotion.dev). They have no text, so they work in English and Hebrew
without mirroring. They use the brand's night ink, one gold north star and growing
step-dots (see [docs/brand.md](../docs/brand.md)).

This is a standalone project, outside the pnpm workspace, so Remotion never enters the app's
install or CI. Only the rendered files in `apps/web/public/motion/` ship.

| Loop | Where it plays | Story |
|---|---|---|
| `welcome` | Dashboard, welcome card (until the first chapter or goal) | Dream → Ward → Step: a star, a path toward it, steps lighting up |
| `chapter` | Current Chapter, "Name this season" | Life areas settle into focus around the star; some step aside ("not now") |
| `wheel` | Dashboard life wheel, nothing rated yet | Scores grow against the vision ring; the biggest gap glows and moves a step closer |
| `ikigai` | IKIGAI landing | Four circles meet; the star appears where they overlap |
| `steps` | Goals and Actions, empty | Actions are checked off, step-dots light up, the star brightens |
| `clarity` | Clarity panel, before an AI model is connected | Scattered thoughts settle into four steps around the focused star |

Every loop is 720×450, 30 fps and 8 s long, and ends exactly where it begins. The app shows
them with `OnboardingMotion` (`apps/web/src/components/OnboardingMotion.tsx`). That component
plays WebM, falls back to MP4, shows a still `.webp` poster with `prefers-reduced-motion`, and
pauses a loop while it's off screen. All six together weigh about 0.55 MB.

## Work on them

```bash
cd motion
npm i
npm run dev          # Remotion Studio
npm run render       # all loops → apps/web/public/motion (or: node render.mjs wheel steps)
```

Rendering needs `ffmpeg` on your PATH (or set `$FFMPEG`). The script uses the system ffmpeg
rather than Remotion's bundled one, because Windows Smart App Control blocks the unsigned
binary.

## License

The scene code is AGPL-3.0-only, like the rest of Dreamward. Remotion itself has its own
[license](https://www.remotion.dev/license): it's free for individuals and companies of up to
3 people, and larger teams need a company license to *use* it. The rendered loops carry no
Remotion dependency.
