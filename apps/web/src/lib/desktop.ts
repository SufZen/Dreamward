/* ============================================================================
 * The desktop app's bridge (apps/desktop/src/preload.ts). Present only inside
 * the Electron shell: one local account, no login screen, no invites.
 * ========================================================================= */
export interface DesktopBridge {
  version: string;
  platform: string;
  /** Re-open the local session (e.g. after the 30-day cookie expired). */
  signIn: () => Promise<boolean>;
  openDataFolder: () => Promise<void>;
  backupNow: () => Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    dreamwardDesktop?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | undefined = typeof window === 'undefined' ? undefined : window.dreamwardDesktop;
export const isDesktop = desktop !== undefined;
