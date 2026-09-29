/* The bridge the web app sees as window.dreamwardDesktop (apps/web/src/lib/desktop.ts). */
import { contextBridge, ipcRenderer } from 'electron';

const info = ipcRenderer.sendSync('desktop:info') as { version: string; platform: string } | null;

if (info) {
  contextBridge.exposeInMainWorld('dreamwardDesktop', {
    version: info.version,
    platform: info.platform,
    signIn: (): Promise<boolean> => ipcRenderer.invoke('desktop:signIn'),
    openDataFolder: (): Promise<void> => ipcRenderer.invoke('desktop:openDataFolder'),
    backupNow: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('desktop:backupNow'),
  });
}
