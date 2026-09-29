# Framework packs

A book has a fixed **structure**:

- 12 life areas
- the sections inside each area (beliefs, vision, identity, why, how)
- the front-matter and implementation pages
- the vision prompts

The structure's ids are stored in every book and never change. The **words**
people see for that structure come from a *framework pack*.

Packs keep a coaching method's vocabulary separate from the code. A coach, a
community or a translator can give the book their own language without touching
data, migrations or the app.

- **The default pack** (`packages/shared/src/frameworks/default.ts`) is written
  for this project and licensed CC BY-SA 4.0.
- **A custom pack** is a JSON file with *any subset* of labels. Anything missing
  falls back to the default pack.

```json
{
  "id": "my-coaching-pack",
  "name": { "en": "Coach Dana's twelve areas" },
  "categories": {
    "health_fitness": { "en": "Vitality", "he": "חיוניות" },
    "career": { "en": "Craft" }
  },
  "sectionTypes": {
    "premises": { "en": "Core beliefs", "he": "אמונות יסוד" },
    "strategy": { "en": "Game plan" }
  },
  "contentBlocks": { "impl_funnel": { "en": "One thing at a time" } },
  "visionPrompts": { "ideal_day": { "en": "My best Tuesday" } }
}
```

Point the server at it:

```bash
FRAMEWORK_PACK_FILE=/path/to/pack.json
```

- **Self-hosted (installer):** put the file in the install folder's `packs/`
  directory and set `FRAMEWORK_PACK_FILE=/packs/pack.json` in `.env`.
- **Development:** keep it in `private/`, which is never committed.

The labels are applied to every book at the next start. People's own writing
is never changed. An invalid pack stops the server at boot with a list of the
problems, rather than half-applying. For example, an unknown id or key is an
error.

## Ids you can relabel

| Group | Ids |
|---|---|
| `categories` | `health_fitness`, `intellectual`, `emotional`, `character`, `spiritual`, `love`, `parenting`, `social`, `financial`, `career`, `sex`, `quality_of_life` |
| `sectionTypes` | `premises`, `vision`, `identity`, `purpose`, `strategy`, `qol_experiences`, `qol_environment`, `qol_materialistic` |
| `contentBlocks` | `cover`, `gratitude_intro`, `current_assessments`, `what_i_want`, `what_makes_me_happy`, `impl_effective`, `impl_funnel`, `impl_lifestyle`, `impl_stepping_in` |
| `visionPrompts` | `dream_home`, `ideal_day`, `health_fitness`, `intellectual`, `emotions`, `character`, `spiritual`, `ideal_relationship`, `family`, `friendships`, `financial`, `career`, `lifestyle`, `sex` |

## Respect other people's methods

Only publish packs whose wording you wrote or may share. Commercial programs'
names and texts belong to their owners. Keep a pack based on a program you
bought for your own instance: it is a private file, and nothing is uploaded.
