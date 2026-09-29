/* ============================================================================
 * Updates from GitHub Releases (electron-updater). Prerelease builds follow
 * the prerelease channel. Before installing: a backup, then a clean engine
 * stop. The new version's engine snapshots the data again before migrating.
 * ========================================================================= */
import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { t } from './i18n';

interface Hooks {
  beforeInstall: () => Promise<void>;
  stopEngine: () => Promise<void>;
}

let hooks: Hooks | null = null;
let manualCheck = false;

export function setupUpdates(h: Hooks) {
  hooks = h;
  autoUpdater.allowPrerelease = app.getVersion().includes('-');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // install only after a backup + a clean engine stop

  autoUpdater.on('update-downloaded', async (info) => {
    manualCheck = false;
    const choice = await dialog.showMessageBox({
      type: 'info',
      title: 'Dreamward',
      message: t('updateReady', info.version),
      detail: t('updateReadyDetail'),
      buttons: [t('restartNow'), t('later')],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice.response === 0) await install();
  });
  autoUpdater.on('update-not-available', () => {
    if (manualCheck) void dialog.showMessageBox({ type: 'info', title: 'Dreamward', message: t('upToDate') });
    manualCheck = false;
  });
  autoUpdater.on('update-available', () => {
    if (manualCheck) void dialog.showMessageBox({ type: 'info', title: 'Dreamward', message: t('updateDownloading') });
    manualCheck = false;
  });
  autoUpdater.on('error', (err) => {
    if (manualCheck) void dialog.showMessageBox({ type: 'error', title: 'Dreamward', message: t('updateError'), detail: String(err?.message ?? err) });
    manualCheck = false;
  });

  void checkForUpdatesNow(false);
  setInterval(() => void checkForUpdatesNow(false), 6 * 60 * 60 * 1000).unref();
}

export async function checkForUpdatesNow(manual: boolean) {
  if (!hooks) {
    // Automatic updates are switched off (setting or DREAMWARD_DISABLE_UPDATES).
    if (manual) void dialog.showMessageBox({ type: 'info', title: 'Dreamward', message: t('updateError') });
    return;
  }
  manualCheck = manual;
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    /* reported through the 'error' event */
  }
}

async function install() {
  await hooks?.beforeInstall();
  await hooks?.stopEngine();
  autoUpdater.quitAndInstall();
}
