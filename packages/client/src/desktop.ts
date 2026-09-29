/* ============================================================================
 * `desktop` as a server URL: the Dreamward desktop app writes its local address
 * to <app data>/Dreamward/desktop.json while it runs. Agents configured with
 * DREAMWARD_URL=desktop always reach the running app, whatever port it got.
 * ========================================================================= */
import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export const DESKTOP_URL = 'desktop';

/** The desktop app's data folder (same place Electron's userData points at). */
export function desktopAppDir(): string {
  const override = process.env.DREAMWARD_DESKTOP_DIR;
  if (override) return override;
  const home = homedir();
  if (platform() === 'win32') return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Dreamward');
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', 'Dreamward');
  return join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), 'Dreamward');
}

/** Resolves `desktop` to the running app's URL; other values pass through. */
export function resolveBaseUrl(url: string): string {
  if (url.trim().toLowerCase() !== DESKTOP_URL) return url;
  const file = join(desktopAppDir(), 'desktop.json');
  if (existsSync(file)) {
    try {
      const info = JSON.parse(readFileSync(file, 'utf8')) as { url?: string };
      if (info.url && /^http:\/\/127\.0\.0\.1:\d+$/.test(info.url)) return info.url;
    } catch {
      /* fall through */
    }
  }
  throw new Error('The Dreamward desktop app is not running — open it, then try again.');
}
