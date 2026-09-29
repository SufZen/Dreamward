import { mkdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { loadEnv } from '../env';

/** Resolves and ensures the runtime data directory layout exists. */
export function resolveDataDir(dataDir: string): string {
  const root = isAbsolute(dataDir) ? dataDir : resolve(process.cwd(), dataDir);
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, 'users'), { recursive: true });
  mkdirSync(join(root, 'backups'), { recursive: true });
  return root;
}

/** Base directory containing one subdirectory per user id. */
export function usersRoot(dataRoot: string): string {
  return join(dataRoot, 'users');
}

/** users/<uid> — the user's whole world (db + assets). Ensures layout. */
export function userDataRoot(dataRoot: string, uid: number): string {
  const root = join(usersRoot(dataRoot), String(uid));
  mkdirSync(join(root, 'assets', 'originals'), { recursive: true });
  mkdirSync(join(root, 'assets', 'derived'), { recursive: true });
  return root;
}

export function dbPath(userRoot: string): string {
  return join(userRoot, 'lifebook.db');
}

export function assetsDir(userRoot: string): string {
  return join(userRoot, 'assets');
}

/** Backup root: BACKUP_DIR (own volume recommended) or ${DATA_DIR}/backups. Ensured. */
export function backupsRoot(): string {
  const env = loadEnv();
  const dir = env.BACKUP_DIR
    ? isAbsolute(env.BACKUP_DIR)
      ? env.BACKUP_DIR
      : resolve(process.cwd(), env.BACKUP_DIR)
    : join(resolveDataDir(env.DATA_DIR), 'backups');
  mkdirSync(dir, { recursive: true });
  return dir;
}
