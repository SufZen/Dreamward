/* ============================================================================
 * apps/api — services/portability.ts
 * "Your book is yours": a single-file export of everything an account owns,
 * and a safe import that replaces an account's book with an export — the
 * path for moving between the desktop app and a self-hosted server, between
 * servers, or restoring one person without touching anyone else.
 *
 * Export (.zip):
 *   manifest.json   format, app version, schema level, exported-at
 *   lifebook.db     consistent copy (VACUUM INTO) — the lossless source
 *   data.json       every table as JSON rows — human/tool readable
 *   assets/…        uploaded images (originals + derived)
 *
 * Import: validates the archive (format, integrity, not from a NEWER schema),
 * moves the current book + assets aside under BACKUP_DIR/pre-import/, swaps
 * the files in, and re-opens the account (which migrates an older export up).
 * ========================================================================= */
import Database from 'better-sqlite3';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import { APP_VERSION } from '../version';
import { backupsRoot, dbPath } from '../lib/paths';
import { bundledMigrations } from '../db/migrate';
import { integrityCheck } from '../db/upgrade';
import { closeUserDb, openUserDb } from '../db/registry';

export const EXPORT_FORMAT = 'lifebook-export';
export const EXPORT_FORMAT_VERSION = 1;

export interface ExportManifest {
  format: typeof EXPORT_FORMAT;
  formatVersion: number;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  account: { email: string | null };
}

export class ImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

/** Tables worth exporting as JSON (skip FTS shadow tables + internals). */
function dataTables(sqlite: Database.Database): string[] {
  const rows = sqlite
    .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string; sql: string | null }[];
  return rows
    .filter((r) => !/VIRTUAL TABLE/i.test(r.sql ?? '') && !/_fts(_|$)/.test(r.name) && r.name !== '__drizzle_migrations')
    .map((r) => r.name)
    .sort();
}

function addTree(zip: Zippable, dir: string, prefix: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) n += addTree(zip, abs, rel);
    else if (entry.isFile()) {
      // images are already compressed — store them
      zip[rel] = [readFileSync(abs), { level: 0 }];
      n++;
    }
  }
  return n;
}

/** Builds the export archive for one account. */
export function exportAccount(uid: number, email: string | null): { zip: Uint8Array; manifest: ExportManifest } {
  const { sqlite, userDataRoot } = openUserDb(uid);
  const tmp = mkdtempSync(join(tmpdir(), 'lb-export-'));
  try {
    const dbCopy = join(tmp, 'lifebook.db');
    sqlite.exec(`VACUUM INTO '${dbCopy.replace(/'/g, "''")}'`);

    // Work on the copy: strip secrets (provider keys are encrypted with THIS
    // server's KEY_ENCRYPTION_SECRET — useless elsewhere, and they don't
    // belong in a downloadable file). Provider rows stay; re-enter the key.
    const copy = new Database(dbCopy);
    const data: Record<string, unknown[]> = {};
    try {
      copy.exec('UPDATE llm_providers SET api_key = NULL, oauth_json = NULL');
      for (const t of dataTables(copy)) data[t] = copy.prepare(`SELECT * FROM "${t}"`).all();
    } finally {
      copy.close();
    }

    const manifest: ExportManifest = {
      format: EXPORT_FORMAT,
      formatVersion: EXPORT_FORMAT_VERSION,
      appVersion: APP_VERSION,
      schemaVersion: bundledMigrations().length,
      exportedAt: new Date().toISOString(),
      account: { email },
    };
    const zip: Zippable = {
      'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      'lifebook.db': readFileSync(dbCopy),
      'data.json': strToU8(JSON.stringify(data)),
    };
    addTree(zip, join(userDataRoot, 'assets'), 'assets');
    return { zip: zipSync(zip, { level: 6 }), manifest };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Validates an export archive without touching any account. */
export function inspectExport(archive: Uint8Array): { manifest: ExportManifest; files: Record<string, Uint8Array> } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(archive);
  } catch {
    throw new ImportError('not_a_zip', 'The file is not a valid export archive (.zip).');
  }
  if (!files['manifest.json'] || !files['lifebook.db']) {
    throw new ImportError('not_an_export', 'This archive is not a Dreamward export (manifest.json / lifebook.db missing).');
  }
  const manifest = JSON.parse(strFromU8(files['manifest.json'])) as ExportManifest;
  if (manifest.format !== EXPORT_FORMAT || manifest.formatVersion > EXPORT_FORMAT_VERSION) {
    throw new ImportError('unsupported_format', 'This export format is not supported by this version.');
  }
  // Reject zip-slip / absolute paths BEFORE anything live is touched.
  for (const name of Object.keys(files)) {
    if (!name.startsWith('assets/') || name.endsWith('/')) continue;
    safeAssetPath('/probe-root', name.slice('assets/'.length));
  }
  if (manifest.schemaVersion > bundledMigrations().length) {
    throw new ImportError(
      'export_from_newer_version',
      `This export was made with a newer version (v${manifest.appVersion}). Upgrade this installation first.`,
      409,
    );
  }
  return { manifest, files };
}

/** Rejects zip-slip paths ("../", absolute, drive letters). */
function safeAssetPath(root: string, rel: string): string {
  if (isAbsolute(rel) || /^[a-zA-Z]:/.test(rel) || rel.split(/[\\/]/).includes('..')) {
    throw new ImportError('unsafe_path', `Unsafe path in archive: ${rel}`);
  }
  const target = normalize(join(root, rel));
  if (!target.startsWith(normalize(root) + sep)) throw new ImportError('unsafe_path', `Unsafe path in archive: ${rel}`);
  return target;
}

/**
 * Replaces an account's book with an export. The previous book and assets are
 * moved (not deleted) to BACKUP_DIR/pre-import/<ts>-user-<uid>/.
 */
export function importAccount(uid: number, archive: Uint8Array): { manifest: ExportManifest; previous: string } {
  const { manifest, files } = inspectExport(archive);

  // Stage + verify the incoming database before touching anything live.
  const stage = mkdtempSync(join(tmpdir(), 'lb-import-'));
  try {
    const incoming = join(stage, 'lifebook.db');
    writeFileSync(incoming, files['lifebook.db']!);
    const check = new Database(incoming, { readonly: true });
    try {
      const result = integrityCheck(check);
      if (result !== 'ok') throw new ImportError('corrupt_export', `The exported database is damaged (${result}).`);
    } finally {
      check.close();
    }

    // Move the current book aside (never delete user data on import).
    const handle = openUserDb(uid);
    const root = handle.userDataRoot;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const previous = join(backupsRoot(), 'pre-import', `${ts}-user-${uid}`);
    mkdirSync(previous, { recursive: true });
    const previousDb = join(previous, 'lifebook.db');
    handle.sqlite.exec(`VACUUM INTO '${previousDb.replace(/'/g, "''")}'`);
    closeUserDb(uid);

    const live = dbPath(root);
    const assets = join(root, 'assets');
    const assetsAside = join(root, `assets.pre-import-${ts}`);
    let assetsMoved = false;
    try {
      for (const suffix of ['', '-wal', '-shm']) rmSync(live + suffix, { force: true });
      if (existsSync(assets)) {
        renameSync(assets, assetsAside); // same volume → atomic, cheap
        assetsMoved = true;
      }
      writeFileSync(live, files['lifebook.db']!);
      for (const [name, bytes] of Object.entries(files)) {
        if (!name.startsWith('assets/') || name.endsWith('/')) continue;
        const target = safeAssetPath(assets, name.slice('assets/'.length));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, bytes);
      }
      openUserDb(uid); // migrates an older export up to this version (with snapshot)
    } catch (err) {
      // Roll back to exactly what was there before.
      closeUserDb(uid);
      for (const suffix of ['', '-wal', '-shm']) rmSync(live + suffix, { force: true });
      writeFileSync(live, readFileSync(previousDb));
      if (assetsMoved) {
        rmSync(assets, { recursive: true, force: true });
        renameSync(assetsAside, assets);
      }
      openUserDb(uid);
      throw err;
    }

    // Success: keep the replaced assets with the replaced DB for recovery.
    if (assetsMoved) {
      try {
        renameSync(assetsAside, join(previous, 'assets'));
      } catch {
        // BACKUP_DIR is on another volume: copy, then drop the local aside copy.
        cpSync(assetsAside, join(previous, 'assets'), { recursive: true });
        rmSync(assetsAside, { recursive: true, force: true });
      }
    }
    return { manifest, previous };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
