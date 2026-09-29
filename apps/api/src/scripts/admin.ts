/* ============================================================================
 * apps/api — scripts/admin.ts
 * Operator CLI shipped inside the server image:
 *   docker compose exec api node dist/scripts/admin.js <command>
 *   (dev: pnpm --filter @dreamward/api admin <command>)
 *
 *   status                         version, schema levels, accounts, last backup
 *   backup                         take a full verified backup now
 *   backups                        list snapshots + pre-upgrade copies
 *   verify                         integrity-check every database (read-only)
 *   migrate                        upgrade every database now (snapshot first)
 *   restore <dir> [--user N] --yes restore a backup folder (STOP THE SERVER FIRST)
 *   export-user <uid> <file.zip>   write an account's export archive
 *   import-user <uid> <file.zip> --yes   replace an account's book with an export
 * ========================================================================= */
import Database from 'better-sqlite3';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnv } from '../env';
import { APP_VERSION } from '../version';
import { backupsRoot, dbPath, resolveDataDir, userDataRoot, usersRoot } from '../lib/paths';
import { controlDbPath, controlSchema, getControlDb, openControlDb, CONTROL_MIGRATIONS } from '../db/control';
import { migrateAllUsers } from '../db/registry';
import { bundledMigrations } from '../db/migrate';
import { integrityCheck } from '../db/upgrade';
import { lastBackup, listBackups, runBackup } from '../services/backup';
import { exportAccount, importAccount } from '../services/portability';

const [, , command, ...rest] = process.argv;
const flag = (name: string) => rest.includes(`--${name}`);
const option = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--user'));

const env = loadEnv();
const dataRoot = resolveDataDir(env.DATA_DIR);

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function boot() {
  openControlDb(dataRoot); // migrates control (snapshot first) / refuses downgrade
  return migrateAllUsers();
}

function userIds(): number[] {
  const root = usersRoot(dataRoot);
  return existsSync(root) ? readdirSync(root).filter((d) => /^\d+$/.test(d)).map(Number).sort((a, b) => a - b) : [];
}

async function main() {
  switch (command) {
    case 'status': {
      const up = boot();
      const users = getControlDb().select().from(controlSchema.controlUsers).all();
      const last = lastBackup();
      console.log(`version          v${APP_VERSION}`);
      console.log(`schema           user ${bundledMigrations().length} · control ${CONTROL_MIGRATIONS.length}`);
      console.log(`data dir         ${dataRoot}`);
      console.log(`backup dir       ${backupsRoot()}`);
      console.log(`accounts         ${users.length} (${users.filter((u) => u.status === 'active').length} active)`);
      console.log(`unavailable      ${up.failed.length ? up.failed.map((f) => `#${f.uid}: ${f.error}`).join('; ') : 'none'}`);
      console.log(`last backup      ${last ? `${new Date(last.createdAt).toISOString()} ${last.ok ? 'ok' : 'WITH ERRORS'}` : 'never'}`);
      break;
    }
    case 'backup': {
      boot();
      const r = await runBackup('cli');
      for (const e of r.entries) console.log(`  ${e.ok ? '✓' : '✗'} ${e.name}${e.error ? ` — ${e.error}` : ''}`);
      console.log(`${r.ok ? 'Backup OK' : 'Backup finished WITH ERRORS'}: ${r.path}`);
      process.exit(r.ok ? 0 : 2);
      break;
    }
    case 'backups': {
      for (const b of listBackups()) {
        console.log(`${new Date(b.createdAt).toISOString()}  ${b.kind.padEnd(11)} ${b.ok === false ? 'ERR' : 'ok '}  v${b.version ?? '?'}  ${b.path}`);
      }
      break;
    }
    case 'verify': {
      // Read-only: does NOT migrate anything.
      let bad = 0;
      const check = (label: string, file: string) => {
        if (!existsSync(file)) return;
        try {
          const db = new Database(file, { readonly: true, fileMustExist: true });
          const res = integrityCheck(db);
          db.close();
          if (res !== 'ok') bad++;
          console.log(`  ${res === 'ok' ? '✓' : '✗'} ${label}${res === 'ok' ? '' : ` — ${res}`}`);
        } catch (err) {
          bad++;
          console.log(`  ✗ ${label} — ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      check('control', controlDbPath(dataRoot));
      for (const uid of userIds()) check(`user ${uid}`, dbPath(join(usersRoot(dataRoot), String(uid))));
      console.log(bad ? `${bad} database(s) FAILED` : 'All databases OK');
      process.exit(bad ? 2 : 0);
      break;
    }
    case 'migrate': {
      const up = boot();
      console.log(`Migrated ${up.migrated} account(s); ${up.failed.length} unavailable.`);
      process.exit(up.failed.length ? 2 : 0);
      break;
    }
    case 'restore': {
      const src = positional[0] ? resolve(positional[0]) : die('usage: restore <backup-folder> [--user N] --yes');
      if (!existsSync(src)) die(`Not found: ${src}`);
      if (!flag('yes')) die('Restoring overwrites live data. Stop the server first, then re-run with --yes.');
      const onlyUser = option('user') ? Number(option('user')) : null;

      const looksLikeBackup =
        existsSync(join(src, 'control.db')) ||
        existsSync(join(src, 'users')) ||
        readdirSync(src).some((f) => /^user-\d+\.db$/.test(f));
      if (!looksLikeBackup) {
        die(`${src} is not a backup folder (expected control.db, users/<id>/lifebook.db or user-<id>.db). Run "backups" to list them.`);
      }

      // Safety copy of what we're about to overwrite.
      const safety = join(backupsRoot(), 'pre-restore', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
      mkdirSync(safety, { recursive: true });
      const put = (from: string, to: string) => {
        if (existsSync(to)) copyFileSync(to, join(safety, to.replace(/[\\/:]/g, '_')));
        for (const s of ['-wal', '-shm']) rmSync(to + s, { force: true });
        copyFileSync(from, to);
        console.log(`  restored ${to}`);
      };

      if (onlyUser === null && existsSync(join(src, 'control.db'))) put(join(src, 'control.db'), controlDbPath(dataRoot));
      // Layouts: snapshots → users/<uid>/lifebook.db (+assets); pre-upgrade → user-<uid>.db
      const candidates = new Map<number, { db: string; assets: string | null }>();
      if (existsSync(join(src, 'users'))) {
        for (const d of readdirSync(join(src, 'users'))) {
          if (!/^\d+$/.test(d)) continue;
          const db = join(src, 'users', d, 'lifebook.db');
          if (existsSync(db)) candidates.set(Number(d), { db, assets: join(src, 'users', d, 'assets') });
        }
      }
      for (const f of readdirSync(src)) {
        const m = f.match(/^user-(\d+)\.db$/);
        if (m) candidates.set(Number(m[1]), { db: join(src, f), assets: null });
      }
      for (const [uid, c] of candidates) {
        if (onlyUser !== null && uid !== onlyUser) continue;
        const root = userDataRoot(dataRoot, uid);
        put(c.db, dbPath(root));
        if (c.assets && existsSync(c.assets)) {
          cpSync(join(root, 'assets'), join(safety, `user-${uid}-assets`), { recursive: true });
          rmSync(join(root, 'assets'), { recursive: true, force: true });
          cpSync(c.assets, join(root, 'assets'), { recursive: true });
          console.log(`  restored assets for user ${uid}`);
        }
      }
      console.log(`Done. The overwritten files were saved to ${safety}. Start the server again.`);
      break;
    }
    case 'export-user': {
      const [uidArg, file] = positional;
      if (!uidArg || !file) die('usage: export-user <uid> <file.zip>');
      boot();
      const uid = Number(uidArg);
      const user = getControlDb().select().from(controlSchema.controlUsers).all().find((u) => u.id === uid);
      if (!user) die(`No account #${uid}`);
      const { zip } = exportAccount(uid, user.email);
      writeFileSync(resolve(file), zip);
      console.log(`Exported account #${uid} → ${resolve(file)} (${zip.byteLength} bytes)`);
      break;
    }
    case 'import-user': {
      const [uidArg, file] = positional;
      if (!uidArg || !file) die('usage: import-user <uid> <file.zip> --yes');
      if (!flag('yes')) die(`This replaces account #${uidArg}'s book (the current one is kept under BACKUP_DIR/pre-import). Re-run with --yes.`);
      boot();
      const { manifest, previous } = importAccount(Number(uidArg), new Uint8Array(readFileSync(resolve(file))));
      console.log(`Imported (exported by v${manifest.appVersion} on ${manifest.exportedAt}). Previous book: ${previous}`);
      break;
    }
    default:
      console.log(`Usage: admin <command>

  status                               version, schema levels, accounts, last backup
  backup                               take a full verified backup now
  backups                              list snapshots + pre-upgrade copies
  verify                               integrity-check every database (read-only)
  migrate                              upgrade every database now (snapshot first)
  restore <dir> [--user N] --yes       restore a backup folder (STOP THE SERVER FIRST)
  export-user <uid> <file.zip>         write an account's export archive
  import-user <uid> <file.zip> --yes   replace an account's book with an export`);
      process.exit(command ? 1 : 0);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
