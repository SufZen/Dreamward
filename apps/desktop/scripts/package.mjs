// ============================================================================
// Packages the desktop app with electron-builder.
//
//   node scripts/package.mjs [--win|--mac|--linux] [--dir] [other electron-builder args]
//
// The app is assembled in an isolated staging folder (.stage/) with its own
// npm-installed runtime modules. The three native ones (better-sqlite3 ≥ 13,
// sharp, argon2) are Node-API modules with bundled prebuilt binaries, so they
// load in Electron as-is — nothing is compiled or rebuilt.
//
// Env: GITHUB_REPOSITORY (owner/repo for update checks), CSC_LINK / CSC_KEY_PASSWORD
// (+ APPLE_ID… for notarization) to sign; unsigned builds otherwise.
// ============================================================================
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ELECTRON_BUILDER = '26.15.3';
const NATIVE = ['better-sqlite3', 'sharp', 'argon2', 'electron-updater'];

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const stage = join(app, '.stage');
const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const isWin = process.platform === 'win32';

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}`);
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: isWin, ...opts });
  if (res.status !== 0) {
    console.error(`\n${cmd} failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
}

const installedVersion = (name) => JSON.parse(readFileSync(join(app, 'node_modules', name, 'package.json'), 'utf8')).version;

// 1. Build (tsup + assemble) unless already built.
if (!existsSync(join(app, 'dist', 'main.cjs')) || !existsSync(join(app, 'dist', 'api', 'start.mjs'))) {
  run('pnpm', ['run', 'build'], { cwd: app });
}

// 2. Staging folder: the built app + a plain npm install of the runtime dependencies.
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(app, 'dist'), join(stage, 'dist'), { recursive: true });
cpSync(join(app, 'build'), join(stage, 'build'), { recursive: true });

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? 'SufZen/Dreamward').split('/');
const homepage = `https://github.com/${owner}/${repo}`;
writeFileSync(
  join(stage, 'package.json'),
  JSON.stringify(
    {
      name: 'dreamward-desktop',
      productName: pkg.productName,
      version: pkg.version,
      description: pkg.description,
      license: pkg.license,
      homepage,
      author: { name: 'Dreamward contributors', url: homepage },
      main: 'dist/main.cjs',
      dependencies: Object.fromEntries(NATIVE.map((n) => [n, installedVersion(n)])),
    },
    null,
    2,
  ),
);
// --ignore-scripts: the prebuilt binaries ship inside the packages; install
// scripts would only try to compile (and need a C++ toolchain).
run('npm', ['install', '--no-audit', '--no-fund', '--omit=dev', '--ignore-scripts'], { cwd: stage });

// macOS builds both architectures: fetch sharp's binaries for the other one too.
if (args.includes('--mac') || (process.platform === 'darwin' && !args.some((a) => ['--win', '--linux'].includes(a)))) {
  for (const cpu of ['x64', 'arm64']) {
    run('npm', ['install', '--no-audit', '--no-fund', '--no-save', '--ignore-scripts', '--os=darwin', `--cpu=${cpu}`, `sharp@${installedVersion('sharp')}`], { cwd: stage });
  }
}

// 3. electron-builder configuration.
const signing = Boolean(process.env.CSC_LINK);
const config = {
  appId: 'app.dreamward.desktop',
  productName: pkg.productName,
  copyright: `Copyright © ${new Date().getFullYear()} Dreamward contributors — AGPL-3.0`,
  electronVersion: installedVersion('electron'),
  // Plain files instead of an asar archive: native modules, the ESM engine
  // bundle and the static web app all load without asar special cases.
  asar: false,
  directories: { output: join(app, 'release'), buildResources: 'build' },
  files: ['dist/**/*', 'package.json'],
  npmRebuild: false, // Node-API prebuilds — no Electron rebuild needed
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'build/icon.png' },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    // The book lives in the user's app-data folder and is NEVER removed on uninstall.
    deleteAppDataOnUninstall: false,
    artifactName: '${productName}-Setup-${version}.${ext}',
  },
  mac: {
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] }, // the zip is what auto-update uses
    ],
    category: 'public.app-category.lifestyle',
    icon: 'build/icon.png',
    artifactName: '${productName}-${version}-mac-${arch}.${ext}',
    hardenedRuntime: signing,
    ...(signing ? {} : { identity: null }),
  },
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
    ],
    category: 'Office',
    icon: 'build/icon.png',
    maintainer: `Dreamward contributors <${homepage}>`,
    synopsis: 'Your life, the version you are proud of.',
    artifactName: '${productName}-${version}-linux-${arch}.${ext}',
  },
  publish: [{ provider: 'github', owner, repo }],
};
writeFileSync(join(stage, 'electron-builder.json'), JSON.stringify(config, null, 2));

// 4. Build the installers (publishing is done by the release workflow).
run('npx', ['--yes', `electron-builder@${ELECTRON_BUILDER}`, '--projectDir', '.', '--config', 'electron-builder.json', '--publish', 'never', ...args], {
  cwd: stage,
  env: { ...process.env, ...(signing ? {} : { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }) },
});
console.log(`\nDone → ${join(app, 'release')}`);
