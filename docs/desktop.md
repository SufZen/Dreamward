# Dreamward desktop app (Windows · macOS · Linux)

The desktop app is Dreamward for one person on their own computer. There is no
server to run and nothing to configure. It is the **same app** as the
self-hosted edition, with the same data format, upgrade safety, backups and AI
agents. Your book can move between desktop and a server at any time.

| | Desktop | Self-hosted |
|---|---|---|
| Who | you | you + family/friends (invites) |
| Install | download & run | Docker (see [self-hosting.md](self-hosting.md)) |
| Sign-in | none — it's your computer | email + password |
| Reach it from your phone | ✗ | ✓ |
| Calendar feed, routines, remote agents | while the app runs | always on |

## Install

Download from the [latest release](https://github.com/SufZen/Dreamward/releases/latest):

- **Windows**: `Dreamward-Setup-x.y.z.exe`
- **macOS**: `Dreamward-x.y.z-mac-arm64.dmg` for Apple silicon, `…-mac-x64.dmg` for Intel
- **Linux**: `Dreamward-x.y.z-linux-x86_64.AppImage` (any distro) or `….deb` (Debian/Ubuntu)

> **Early builds are not code-signed yet**, so your system will warn you once:
> - **Windows** (SmartScreen): *More info → Run anyway*.
> - **macOS** (Gatekeeper): right-click the app → *Open* → *Open*. If macOS
>   says the app "is damaged", run `xattr -cr /Applications/Dreamward.app` once.
>   Automatic updates on macOS need a signed build; until then, download new
>   versions by hand.
> - **Linux AppImage**: `chmod +x Dreamward-*.AppImage`, then run it.

## Where your data lives

| OS | Folder |
|---|---|
| Windows | `%APPDATA%\Dreamward` |
| macOS | `~/Library/Application Support/Dreamward` |
| Linux | `~/.config/Dreamward` |

The folder contains:

- `data/` — the book: databases and images.
- `backups/` — daily snapshots, plus snapshots taken before any upgrade.
- `logs/` — engine logs, for support.
- `secrets.bin` — encryption keys, locked with your OS keychain.

Use **File → Open data folder** to get there. **Uninstalling never deletes
this folder.**

To keep the data somewhere else (a synced folder or an external drive), start
the app with `DREAMWARD_DESKTOP_DIR=/path/to/folder`.

## Backups, updates, moving your book

- **Backups** run daily while the app is open, and on demand with **File → Back up now**.
- **Updates.** The app checks GitHub Releases, downloads the update in the background, and asks before restarting. Before installing it:
  1. It takes a backup.
  2. It stops the engine cleanly.
  3. The new version snapshots and integrity-checks the book before changing its format.
- **Opening an older version is refused.** An older version will not open a book written by a newer one, so it cannot damage it. Install the newer version again, or restore a backup from `backups/pre-upgrade/`.
- **Moving between desktop and server.** In the source app, use **Settings → Your data → Download my data**. In the target app, use **Import**. This works in both directions.
- **Automatic updates** can be switched off with **File → Update automatically**, or by setting `DREAMWARD_DISABLE_UPDATES=1` on managed machines.

## AI and agents

- **AI providers.** Add them in **Settings → AI** exactly as on a server. Local models work out of the box: Ollama at `http://localhost:11434/v1` and LM Studio at `http://localhost:1234/v1`.
- **Agents** such as Claude Code, Claude Desktop, Codex, Gemini CLI or Cursor can connect to the desktop app:
  1. In the app, open **Settings → AI agent access → Create key**.
  2. Run:

     ```bash
     npx -y dreamward login --url desktop --key lbk_…
     npx -y dreamward setup claude-desktop --write
     ```

  `desktop` means "the running Dreamward app, wherever it is listening". The app writes its address to `desktop.json` in the data folder while it runs. If the app is closed, agents are told to open it.
- **Routines and the calendar feed** run while the app is running. Enable **File → Keep running in the background when closed** and **Start at login** for an always-available companion.

## How it works (for contributors)

`apps/desktop` is a thin Electron shell around the regular Dreamward engine:

- **The engine.** `apps/api/src/start.ts` is bundled into `dist/api/start.mjs`. It runs in an Electron *utility process* with `DESKTOP_MODE=true`, bound to `127.0.0.1` on port 47113, or a free port if that one is taken.
- **Serving.** The engine serves the built web app itself (`WEB_DIST_DIR`) and applies the migrations shipped in `dist/api/drizzle`.
- **Desktop mode.** There is one local account, created on first launch, with no password and no invites. `MAX_USERS` is 1, and private AI URLs are allowed.
- **Signing in.** The shell generates a random token on every launch and exchanges it at `POST /api/desktop/session` for the normal session cookie. Other programs or web pages on the machine cannot open the book without that token.
- **Secrets.** `JWT_SECRET` and `KEY_ENCRYPTION_SECRET` are generated on first run and stored with Electron `safeStorage`: DPAPI on Windows, Keychain on macOS, libsecret or kwallet on Linux.
- **The web app** detects the shell through `window.dreamwardDesktop` (see `preload.ts`) and hides login, logout, invites and password settings.
- **Native modules.** better-sqlite3 13, sharp and argon2 are Node-API modules with prebuilt binaries, so they load in Electron unchanged and nothing is rebuilt.

```bash
pnpm install                                        # downloads Electron for local runs
pnpm build                                          # includes the desktop bundle
pnpm --filter @dreamward/desktop dev                 # run it (data in <appData>/Dreamward-dev)
node apps/desktop/scripts/package.mjs --win --dir   # unpacked build to try locally
node apps/desktop/scripts/package.mjs               # installers for this OS → apps/desktop/release/
```

The packaging script assembles an isolated `.stage/` folder with a plain npm
install of the runtime modules, then runs electron-builder there.

### Release builds and signing (maintainers)

The `desktop` job in `release.yml` builds all three platforms on GitHub-hosted
runners and attaches the installers and `latest*.yml` update manifests to the
Release. Builds are unsigned unless these secrets exist:

| Secret | For |
|---|---|
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Windows code-signing certificate (.p12 as base64 or URL) |
| `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD` | Apple *Developer ID Application* certificate |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization |

Set the repository variable `DESKTOP_RELEASE=false` to skip desktop builds.
