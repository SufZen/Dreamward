# Project Context — Dreamward

project_name: "Dreamward"
type: software

## Tech Stack

- language: TypeScript (Node 22+, ESM)
- framework: Fastify 5 (API) · React 19 + Vite 7 (web)
- database: SQLite via better-sqlite3 + Drizzle ORM (WAL mode; schema kept Postgres-portable)
- frontend: Tailwind CSS 3.4 + REALIZEOS design system · TanStack Query v5 · React Router v7 · TipTap · react-konva · @dnd-kit
- hosting: self-hosted (Docker Compose: api + nginx web; optional Caddy for HTTPS) or the Electron desktop app (apps/desktop)
- ci_cd: GitHub Actions — CI, release-please, multi-arch images, desktop installers (see docs/releasing.md)

## Conventions

- naming: files `kebab-case` for modules, `PascalCase.tsx` for React components; DB tables/columns `snake_case`; TS identifiers `camelCase`
- testing: Vitest; API integration tests for auth + critical endpoints; component tests where logic is non-trivial
- git_branching: trunk-based; short-lived feature branches `feat/<epic>-<story>`; merge to `main`
- commit_style: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- code_style: ESLint + Prettier; 2-space indent; single source of truth for the API contract lives in `packages/shared` (Zod schemas + types)

## Architecture Decisions

- Monorepo (pnpm workspaces + Turborepo): `apps/api`, `apps/web`, `packages/design-system`, `packages/shared`, `packages/client`, `packages/mcp`, `packages/cli`, `apps/desktop`.
- Multi-user with per-user SQLite databases (invites, admin); the desktop app runs the same engine for one local account. Auth = argon2id passwords → JWT in an httpOnly/SameSite=Strict cookie.
- The repeating per-area book structure is **data-driven** (its wording comes from a framework pack — docs/framework-packs.md): a `category` has many typed `category_sections`; section shape is described by `section_types`. New section types are data, not migrations.
- User-authored content is stored in a **single field per item** rendered with `dir="auto"` (Hebrew → RTL, English → LTR). No dual-language duplication of content. Only fixed UI labels carry `label_en`/`label_he`.
- Images live on the filesystem under `DATA_DIR/assets`; `sharp` generates `thumb`/`web` derivatives. The DB stores paths + metadata only.
- The moodboard canvas state (items: x/y/w/h/rotation/z/crop) is small and saved as a whole array on debounce.
- Snapshots store a full serialized Dreamward+goals payload as JSON for "then vs now" comparison.

## Implementation Rules

- All `/api/*` routes except `/api/auth/login`, `/api/auth/password-reset`, and `/api/health` require a valid session cookie (`requireAuth` hook).
- Never store the password in plaintext; only argon2id hashes. Rate-limit the login route.
- Autosave is last-write-wins per user; every editable record carries `updated_at` returned to the client.
- Personal content (DB + assets) is never committed to git and is backed up off-site from day one.
- The API contract (request/response shapes) is defined once in `packages/shared` and imported by both api and web.
- RTL correctness: use Tailwind logical properties (`ms/me/ps/pe`, `text-start/end`) and `dir="auto"` on content; never hardcode `left/right` for content layout.

## Anti-Patterns (never do these)

- Do not hardcode per-category components — render everything through the data-driven `SectionRenderer`.
- Do not duplicate user content into `*_he`/`*_en` columns.
- Do not store images as DB blobs.
- Do not `cp` a live WAL SQLite file for backup — use the online `.backup` API.
- Do not put the JWT in localStorage (XSS exposure) — httpOnly cookie only.
- Do not block import on perfection — flag low-confidence parses in `seed.report.json` for in-app cleanup.

## Notes

- Design identity: REALIZEOS dark+gold — accent `#ffcc00` (dark) / `#cc9900` (light), bg `#0a0a0f`, raised `#1a1a24`. Default mode is dark.
- Content is deeply personal — privacy and reliable backups are first-class requirements.
- Workflow: this doc + PRD + architecture + AGENTS.md; one story per branch/PR.
