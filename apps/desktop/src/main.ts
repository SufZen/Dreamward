/* ============================================================================
 * apps/desktop — main process
 * Dreamward as a desktop app. The shell runs the SAME API and web build as the
 * server edition, for one person, on 127.0.0.1:
 *   - data in the OS app-data folder (Phase 2 upgrade safety applies as-is:
 *     integrity check + pre-upgrade snapshot + downgrade guard at every start)
 *   - secrets generated on first run, kept in the OS keychain (safeStorage)
 *   - no login screen: a per-launch token is exchanged for the session cookie
 *   - the API runs in an Electron utility process (dev: plain `node`)
 * ========================================================================= */
import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, session, shell, utilityProcess, type MenuItemConstructorOptions } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { loadSecrets, SecretsUnreadableError, resetSecrets } from './secrets';
import { t } from './i18n';
import { setupUpdates, checkForUpdatesNow } from './updates';

const PRODUCT = 'Dreamward';
const PREFERRED_PORT = 47113;
const HOMEPAGE = 'https://github.com/SufZen/Dreamward';

// DREAMWARD_DESKTOP_DIR relocates everything (portable use, testing). A
// development run never touches a real installation's book.
const dataDirOverride = process.env.DREAMWARD_DESKTOP_DIR;
if (dataDirOverride) app.setPath('userData', dataDirOverride);
else if (!app.isPackaged) app.setPath('userData', join(app.getPath('appData'), `${PRODUCT}-dev`));

const userData = app.getPath('userData');
const paths = {
  data: join(userData, 'data'),
  backups: join(userData, 'backups'),
  logs: join(userData, 'logs'),
  settings: join(userData, 'settings.json'),
  discovery: join(userData, 'desktop.json'),
};

interface Settings {
  closeToTray?: boolean;
  autoUpdate?: boolean;
  bounds?: { x?: number; y?: number; width: number; height: number };
}

function readSettings(): Settings {
  try {
    return JSON.parse(readFileSync(paths.settings, 'utf8')) as Settings;
  } catch {
    return {};
  }
}
function writeSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch };
  writeFileSync(paths.settings, JSON.stringify(next, null, 2));
  return next;
}

/* ── state ──────────────────────────────────────────────────────────────── */

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let origin = '';
let desktopToken = '';
let sessionCookie = '';
let quitting = false;
let engine: { kill: () => void; stop: () => Promise<void> } | null = null;

/* ── the engine (Dreamward API) ──────────────────────────────────────────── */

function freePort(preferred: number): Promise<number> {
  const attempt = (port: number) =>
    new Promise<number>((resolve, reject) => {
      const srv = createServer();
      srv.once('error', reject);
      srv.listen(port, '127.0.0.1', () => {
        const got = (srv.address() as { port: number }).port;
        srv.close(() => resolve(got));
      });
    });
  return attempt(preferred).catch(() => attempt(0));
}

function openLog() {
  mkdirSync(paths.logs, { recursive: true });
  const file = join(paths.logs, 'engine.log');
  try {
    if (statSync(file).size > 5 * 1024 * 1024) renameSync(file, `${file}.1`);
  } catch {
    /* no log yet */
  }
  return { file, stream: createWriteStream(file, { flags: 'a' }) };
}

function lastLogLines(file: string, n = 30): string {
  try {
    return readFileSync(file, 'utf8').trim().split('\n').slice(-n).join('\n');
  } catch {
    return '';
  }
}

async function startEngine(port: number, secrets: { JWT_SECRET: string; KEY_ENCRYPTION_SECRET: string }): Promise<void> {
  const entry = join(__dirname, 'api', 'start.mjs');
  desktopToken = randomBytes(32).toString('hex');
  origin = `http://127.0.0.1:${port}`;
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'production',
    DESKTOP_MODE: 'true',
    DESKTOP_TOKEN: desktopToken,
    HOST: '127.0.0.1',
    PORT: String(port),
    PUBLIC_ORIGIN: origin,
    DATA_DIR: paths.data,
    BACKUP_DIR: paths.backups,
    WEB_DIST_DIR: join(__dirname, 'web'),
    MIGRATIONS_DIR: join(__dirname, 'api', 'drizzle'),
    COOKIE_SECURE: 'false',
    JWT_SECRET: secrets.JWT_SECRET,
    KEY_ENCRYPTION_SECRET: secrets.KEY_ENCRYPTION_SECRET,
  };
  // Server-edition bootstrap settings have no meaning here.
  for (const k of ['DREAMWARD_EMAIL', 'DREAMWARD_PASSWORD', 'ADMIN_OPENROUTER_KEY', 'ELECTRON_RUN_AS_NODE']) delete env[k];

  const log = openLog();
  log.stream.write(`\n=== ${new Date().toISOString()} ${PRODUCT} ${app.getVersion()} starting on ${origin}\n`);
  let exited: number | null = null;
  const onExit = (code: number | null) => {
    exited = code ?? 0;
    log.stream.write(`=== engine exited (${exited})\n`);
    if (!quitting) void engineCrashed(log.file);
  };

  if (app.isPackaged) {
    const child = utilityProcess.fork(entry, [], { env, stdio: 'pipe', serviceName: `${PRODUCT} engine` });
    child.stdout?.pipe(log.stream, { end: false });
    child.stderr?.pipe(log.stream, { end: false });
    child.on('exit', onExit);
    engine = {
      kill: () => child.kill(),
      stop: () =>
        new Promise<void>((resolve) => {
          if (exited !== null) return resolve();
          child.once('exit', () => resolve());
          child.postMessage({ type: 'shutdown' });
          setTimeout(() => {
            child.kill();
            resolve();
          }, 8000);
        }),
    };
  } else {
    // Development: plain Node, so the workspace's native modules (built for Node) load.
    const child: ChildProcess = spawn(process.env.DREAMWARD_NODE ?? 'node', [entry], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    child.stdout?.pipe(log.stream, { end: false });
    child.stderr?.pipe(log.stream, { end: false });
    child.on('exit', onExit);
    engine = {
      kill: () => child.kill(),
      stop: () =>
        new Promise<void>((resolve) => {
          if (exited !== null) return resolve();
          child.once('exit', () => resolve());
          child.send({ type: 'shutdown' });
          setTimeout(() => {
            child.kill();
            resolve();
          }, 8000);
        }),
    };
  }

  // Wait until it answers (first start after an update may run migrations).
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (exited !== null) throw new EngineStartError(log.file);
    try {
      const res = await fetch(`${origin}/api/health`);
      const body = (await res.json()) as { ok?: boolean; desktop?: boolean };
      if (res.ok && body.ok && body.desktop) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new EngineStartError(log.file);
}

class EngineStartError extends Error {
  constructor(public readonly logFile: string) {
    super('engine did not start');
  }
}

/** Exchanges the launch token for the session cookie and puts it in the window's cookie jar. */
async function openSession(): Promise<boolean> {
  const res = await fetch(`${origin}/api/desktop/session`, { method: 'POST', headers: { 'x-desktop-token': desktopToken } });
  if (!res.ok) return false;
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('lb_session='));
  if (!raw) return false;
  sessionCookie = raw.split(';')[0]!.slice('lb_session='.length);
  await session.defaultSession.cookies.set({
    url: origin,
    name: 'lb_session',
    value: sessionCookie,
    httpOnly: true,
    sameSite: 'strict',
    expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  });
  return true;
}

async function backupNow(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${origin}/api/admin/backups`, { method: 'POST', headers: { cookie: `lb_session=${sessionCookie}` } });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    return { ok: res.ok && body.ok !== false, error: body.error };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function engineCrashed(logFile: string) {
  const choice = await dialog.showMessageBox({
    type: 'error',
    title: PRODUCT,
    message: t('engineStopped'),
    detail: lastLogLines(logFile, 12),
    buttons: [t('restart'), t('openLogs'), t('quit')],
    defaultId: 0,
  });
  if (choice.response === 0) {
    app.relaunch();
    quit();
  } else if (choice.response === 1) {
    await shell.openPath(paths.logs);
    quit();
  } else quit();
}

/* ── window ─────────────────────────────────────────────────────────────── */

function iconPath() {
  return join(__dirname, 'icon.png');
}

function createWindow() {
  const settings = readSettings();
  win = new BrowserWindow({
    width: settings.bounds?.width ?? 1280,
    height: settings.bounds?.height ?? 860,
    x: settings.bounds?.x,
    y: settings.bounds?.y,
    minWidth: 420,
    minHeight: 500,
    show: false,
    title: PRODUCT,
    icon: iconPath(),
    backgroundColor: '#0b0b12',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  win.once('ready-to-show', () => win?.show());

  // Only our own origin renders inside the app; every other link opens in the browser.
  const external = (url: string) => {
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(origin + '/')) external(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== origin && !url.startsWith(origin + '/')) {
      e.preventDefault();
      external(url);
    }
  });

  win.on('close', (e) => {
    if (win) writeSettings({ bounds: win.getNormalBounds() });
    if (!quitting && readSettings().closeToTray) {
      e.preventDefault();
      win?.hide();
    }
  });
  win.on('closed', () => {
    win = null;
  });

  void win.loadURL(origin + '/');
}

function showWindow() {
  if (!win) createWindow();
  else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

function updateTray() {
  if (readSettings().closeToTray && !tray) {
    tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 18, height: 18 }));
    tray.setToolTip(PRODUCT);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: t('open', PRODUCT), click: showWindow },
        { type: 'separator' },
        { label: t('quit'), click: quit },
      ]),
    );
    tray.on('click', showWindow);
  } else if (!readSettings().closeToTray && tray) {
    tray.destroy();
    tray = null;
  }
}

/* ── menu ───────────────────────────────────────────────────────────────── */

function buildMenu() {
  const settings = readSettings();
  const isMac = process.platform === 'darwin';
  const fileItems: MenuItemConstructorOptions[] = [
    {
      label: t('backupNow'),
      click: async () => {
        const r = await backupNow();
        void dialog.showMessageBox({
          type: r.ok ? 'info' : 'error',
          title: PRODUCT,
          message: r.ok ? t('backupDone') : t('backupFailed'),
          detail: r.ok ? paths.backups : r.error,
        });
      },
    },
    { label: t('openDataFolder'), click: () => void shell.openPath(userData) },
    { label: t('openBackupsFolder'), click: () => void shell.openPath(paths.backups) },
    { type: 'separator' },
    ...(process.platform !== 'linux'
      ? [
          {
            label: t('startAtLogin'),
            type: 'checkbox' as const,
            checked: app.getLoginItemSettings().openAtLogin,
            click: (item: { checked: boolean }) => app.setLoginItemSettings({ openAtLogin: item.checked }),
          },
        ]
      : []),
    {
      label: t('keepRunning'),
      type: 'checkbox',
      checked: !!settings.closeToTray,
      click: (item) => {
        writeSettings({ closeToTray: item.checked });
        updateTray();
      },
    },
    {
      label: t('autoUpdate'),
      type: 'checkbox',
      checked: settings.autoUpdate !== false,
      enabled: app.isPackaged,
      click: (item) => writeSettings({ autoUpdate: item.checked }),
    },
    { label: t('checkUpdates'), enabled: app.isPackaged, click: () => void checkForUpdatesNow(true) },
    { type: 'separator' },
    isMac ? { role: 'close' } : { label: t('quit'), accelerator: 'CmdOrCtrl+Q', click: quit },
  ];
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { label: t('file'), submenu: fileItems },
    { role: 'editMenu' },
    {
      label: t('view'),
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    {
      role: 'help',
      submenu: [
        { label: t('connectAgents'), click: () => void shell.openExternal(`${HOMEPAGE}/blob/main/docs/agent-access.md`) },
        { label: t('reportIssue'), click: () => void shell.openExternal(`${HOMEPAGE}/issues/new/choose`) },
        { label: t('openLogs'), click: () => void shell.openPath(paths.logs) },
        { type: 'separator' },
        { label: `${PRODUCT} ${app.getVersion()}`, enabled: false },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ── bridge for the web app (preload.ts) ────────────────────────────────── */

function fromOurPage(e: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  const url = e.senderFrame?.url ?? '';
  return url === origin || url.startsWith(origin + '/');
}

ipcMain.on('desktop:info', (e) => {
  e.returnValue = fromOurPage(e) ? { version: app.getVersion(), platform: process.platform } : null;
});
ipcMain.handle('desktop:signIn', async (e) => (fromOurPage(e) ? openSession() : false));
ipcMain.handle('desktop:openDataFolder', async (e) => {
  if (fromOurPage(e)) await shell.openPath(userData);
});
ipcMain.handle('desktop:backupNow', async (e) => (fromOurPage(e) ? backupNow() : { ok: false, error: 'forbidden' }));

/* ── lifecycle ──────────────────────────────────────────────────────────── */

async function stopEngine() {
  await engine?.stop();
  rmSync(paths.discovery, { force: true });
}

function quit() {
  quitting = true;
  app.quit();
}

app.on('before-quit', (e) => {
  quitting = true;
  if (engine) {
    // Let the engine close its databases first, then really quit.
    e.preventDefault();
    const stopping = stopEngine();
    engine = null;
    void stopping.finally(() => app.quit());
  }
});

async function boot() {
  mkdirSync(paths.data, { recursive: true });

  let secrets;
  try {
    secrets = loadSecrets(userData);
  } catch (err) {
    if (!(err instanceof SecretsUnreadableError)) throw err;
    const choice = await dialog.showMessageBox({
      type: 'warning',
      title: PRODUCT,
      message: t('secretsUnreadable'),
      detail: t('secretsUnreadableDetail'),
      buttons: [t('quit'), t('resetKeys')],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice.response !== 1) return quit();
    secrets = resetSecrets(userData);
  }

  const port = await freePort(PREFERRED_PORT);
  try {
    await startEngine(port, secrets);
  } catch (err) {
    const logFile = err instanceof EngineStartError ? err.logFile : join(paths.logs, 'engine.log');
    const tail = lastLogLines(logFile, 40);
    const newer = /written by a newer version/.test(tail);
    await dialog.showMessageBox({
      type: 'error',
      title: PRODUCT,
      message: newer ? t('newerData') : t('engineFailed'),
      detail: newer ? t('newerDataDetail') : tail.split('\n').slice(-12).join('\n'),
      buttons: [t('quit')],
    });
    if (!newer) await shell.openPath(paths.logs);
    return quit();
  }

  if (!(await openSession())) {
    await dialog.showMessageBox({ type: 'error', title: PRODUCT, message: t('engineFailed'), buttons: [t('quit')] });
    return quit();
  }
  // Agents configured with DREAMWARD_URL=desktop find the running app here.
  writeFileSync(paths.discovery, JSON.stringify({ url: origin, pid: process.pid, version: app.getVersion() }, null, 2));

  // Deny browser permission prompts we don't need (camera, geolocation, …).
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(['clipboard-sanitized-write', 'fullscreen'].includes(permission)));

  buildMenu();
  updateTray();
  createWindow();
  if (app.isPackaged && readSettings().autoUpdate !== false && !process.env.DREAMWARD_DISABLE_UPDATES) {
    setupUpdates({
      beforeInstall: async () => void (await backupNow()),
      stopEngine: async () => {
        quitting = true;
        await stopEngine();
        engine = null;
      },
    });
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('window-all-closed', () => {
    // macOS keeps apps alive without windows; elsewhere quit unless the tray keeps us.
    if (process.platform !== 'darwin' && !readSettings().closeToTray) quit();
  });
  app.on('activate', () => {
    if (origin && !win) createWindow();
  });
  app.whenReady().then(boot).catch(async (err) => {
    await dialog.showMessageBox({ type: 'error', title: PRODUCT, message: String((err as Error)?.stack ?? err) });
    quit();
  });
}
