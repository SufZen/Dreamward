# Releasing

One version for the whole monorepo (root `package.json` is the source of
truth; `node scripts/release/sync-versions.mjs --check` enforces it in CI).
Versions follow [SemVer](https://semver.org):

| Bump | When |
|---|---|
| **patch** `0.4.1` | fixes only |
| **minor** `0.5.0` | features; *additive* schema changes (new tables/columns) |
| **major** `1.0.0` → `2.0.0` | anything that could break an upgrade: destructive schema changes, removed API/MCP tools, changed export format |

Until 1.0, minor versions may include small breaking changes to the agent API,
always called out in the release notes. **Data upgrades are never allowed to
break** — see "Data safety" below.

## Flow

```
feature branch ──PR (conventional title)──► main ──► release-please PR ──merge──► vX.Y.Z tag + GitHub Release
                                              │                                        │
                                              └─► CI + :edge images                    └─► release pipeline
```

1. Work lands on `main` through PRs (squash-merge; the PR title is the commit).
2. **release-please** keeps a PR titled `chore(main): release X.Y.Z` open,
   bumping every `package.json` and prepending the CHANGELOG. Edit its notes
   freely (add upgrade notes, screenshots) before merging.
3. Merging it tags `vX.Y.Z`, creates the GitHub Release and runs
   `.github/workflows/release.yml`:
   - verify (versions ↔ tag, typecheck, all tests incl. the upgrade test, build)
   - multi-arch images `ghcr.io/<owner>/dreamward-{api,web}` tagged `X.Y.Z`,
     `X.Y`, `X` (≥1.0) and `latest` — with SBOM + provenance attestations
   - self-host files attached to the Release (`install.sh`, `docker-compose.yml`,
     `.env.example`, `dreamward-ctl`)
   - npm packages for agents (when the repo variable `NPM_PUBLISH=true`)
   - desktop installers for Windows / macOS (arm64 + x64) / Linux plus the
     `latest*.yml` manifests the apps auto-update from — unsigned unless the
     signing secrets exist (see [desktop.md](desktop.md); opt out with the repo
     variable `DESKTOP_RELEASE=false`)
4. The maintainer's own instance deploys via `deploy-own.yml` when the repo
   variables `DEPLOY_ENABLED=true` and `DEPLOY_URL` are set (secrets
   `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`).

## Release candidates

Run release-please with a prerelease, or tag by hand:

```bash
node scripts/release/sync-versions.mjs 0.5.0-rc.1
git commit -am "chore: release 0.5.0-rc.1" && git tag v0.5.0-rc.1 && git push --follow-tags
gh release create v0.5.0-rc.1 --prerelease --generate-notes
```

Prereleases publish images tagged `X.Y.Z-rc.N` and `next` (never `latest`) and
npm packages under the `next` dist-tag. Run an rc on the maintainer's own
instance for a few days before promoting.

## Hotfixes

Branch `release/X.Y` from the tag, fix, and release `X.Y.(Z+1)` from that
branch (tag + `gh release create`); cherry-pick the fix to `main`.

## Rollback

- **Application only** (no schema change in between): redeploy the previous
  tag (self-hosters: `dreamward-ctl rollback`; maintainer: run *Deploy (own
  instance)* with the previous tag).
- **After a schema change**: the old version will refuse to start on the newer
  data (downgrade guard). Restore the automatic pre-upgrade snapshot with
  `admin.js restore <BACKUP_DIR>/pre-upgrade/<run> --yes`, then start the old
  version. `dreamward-ctl rollback` does both.

## Data safety rules (non-negotiable)

- Migrations are generated, never hand-edited after shipping; additive within
  a major version.
- Every release adds a fixture to the upgrade test for its schema
  (`apps/api/src/__tests__/upgrade.test.ts`).
- The export format (`lifebook-export`, `formatVersion`) only changes in a
  backward-compatible way; imports of older exports must keep working.

## Checklist before merging a release PR

- [ ] CI green on `main` (including `docker-smoke`)
- [ ] Release notes: highlights, **upgrade notes**, breaking changes
- [ ] Docs updated (user guide, self-hosting, agent access)
- [ ] For minors/majors: an rc ran on a real instance with real (backed-up) data

## Repository settings (maintainers)

- `main` is protected: changes land through pull requests with green CI.
- **GHCR packages**: after the first release, make `dreamward-api` and
  `dreamward-web` public (Package settings → Change visibility) so anyone can
  pull the images.
- **Variables** (Settings → Secrets and variables → Actions):
  - `NPM_PUBLISH=true` to publish the `dreamward`, `@dreamward/client` and `@dreamward/mcp` packages (see npm below)
  - `DESKTOP_RELEASE=false` to skip the desktop installers
  - `DEPLOY_ENABLED=true`, `DEPLOY_URL` and `DEPLOY_PATH`, to deploy your own instance (see [deployment.md](deployment.md))
- **Desktop signing secrets**: see [desktop.md](desktop.md).
- **`release` environment**: the images, assets, npm, desktop and checksums
  jobs run in it. Only `main` and `v*` tags may deploy to it.
- **npm: trusted publishing (no token).** For each of the three packages on
  npmjs.com: *Settings → Trusted publishing → GitHub Actions*, with
  organization `SufZen`, repository `Dreamward`, workflow filename
  `release-please.yml` (npm checks the *calling* workflow; the publish step
  lives in `release.yml`), and environment `release`. Then, under *Publishing
  access*, choose "Require two-factor authentication and disallow tokens". No
  npm token is stored anywhere (configured for all three packages since v0.6.1).
- **Actions are pinned by commit SHA.** Dependabot proposes the updates; never
  replace a SHA with a tag.
