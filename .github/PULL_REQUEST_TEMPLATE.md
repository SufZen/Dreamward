<!-- PR title must follow Conventional Commits: feat: …, fix: …, docs: … (it becomes the changelog line). -->

## What & why

## How it was tested

## Checklist

- [ ] Tests added/updated; `pnpm -r typecheck` and `pnpm --filter @dreamward/api test` pass
- [ ] UI strings in **both English and Hebrew**; layout checked in RTL
- [ ] **Data safety** — if this touches the schema:
  - [ ] a new drizzle migration (`pnpm --filter @dreamward/api db:generate`), never an edited one
  - [ ] additive only (new tables/columns with defaults) — destructive changes need a major version + an RFC
  - [ ] the upgrade test still passes (old data survives)
- [ ] No personal data, secrets or real journal content in code, fixtures or screenshots
- [ ] Docs updated (user guide / agent access / self-hosting) if behaviour changed
- [ ] I agree to license my contribution under AGPL-3.0 and signed off my commits (`git commit -s`, DCO)
