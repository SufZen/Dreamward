/* ============================================================================
 * apps/api — scripts/gc-assets.ts
 * Garbage-collects orphaned asset files: any file under users/<uid>/assets
 * that no asset row references. Created because pre-v0.2 deletes removed DB
 * rows but left files on disk.
 *
 *   node dist/gc-assets.js            # dry run — lists what WOULD be deleted
 *   node dist/gc-assets.js --delete   # actually unlink orphans
 * ========================================================================= */
import Database from 'better-sqlite3';
import { readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadEnv } from '../env';
import { resolveDataDir, usersRoot, dbPath, assetsDir, userDataRoot } from '../lib/paths';

const toPosix = (p: string) => p.split(sep).join('/');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function main() {
  const doDelete = process.argv.includes('--delete');
  const dataRoot = resolveDataDir(loadEnv().DATA_DIR);
  const root = usersRoot(dataRoot);
  const uids = existsSync(root) ? readdirSync(root).filter((d) => /^\d+$/.test(d)) : [];

  let totalOrphans = 0;
  let totalBytes = 0;

  for (const uid of uids) {
    const userRoot = userDataRoot(dataRoot, Number(uid));
    const file = dbPath(userRoot);
    if (!existsSync(file)) continue;
    const db = new Database(file, { readonly: true });
    const referenced = new Set<string>();
    try {
      const rows = db.prepare('SELECT original_path, web_path, thumb_path FROM assets').all() as {
        original_path: string;
        web_path: string;
        thumb_path: string;
      }[];
      for (const r of rows) {
        referenced.add(r.original_path);
        referenced.add(r.web_path);
        referenced.add(r.thumb_path);
      }
    } finally {
      db.close();
    }

    const root2 = assetsDir(userRoot);
    const onDisk = walk(root2);
    for (const abs of onDisk) {
      const rel = toPosix(relative(root2, abs));
      if (referenced.has(rel)) continue;
      const bytes = statSync(abs).size;
      totalOrphans++;
      totalBytes += bytes;
      console.log(`${doDelete ? 'DELETE' : 'ORPHAN'} user ${uid}: ${rel} (${bytes} bytes)`);
      if (doDelete) rmSync(abs, { force: true });
    }
  }

  const mb = (totalBytes / 1024 / 1024).toFixed(1);
  console.log(
    `\n[gc-assets] ${doDelete ? 'deleted' : 'found'} ${totalOrphans} orphan file(s), ${mb} MB across ${uids.length} user(s).` +
      (doDelete ? '' : ' Re-run with --delete to remove them.'),
  );
  process.exit(0);
}

main();
