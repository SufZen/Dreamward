#!/usr/bin/env node
/* ============================================================================
 * scripts/release/sync-versions.mjs
 * One version for the whole monorepo: the root package.json is the source of
 * truth; every workspace package.json is kept identical.
 *
 *   node scripts/release/sync-versions.mjs          # write root version everywhere
 *   node scripts/release/sync-versions.mjs --check  # CI: fail on drift
 *   node scripts/release/sync-versions.mjs 0.5.0    # set a new version everywhere
 * ========================================================================= */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const explicit = args.find((a) => /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(a));

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const rootPkgPath = join(root, 'package.json');
const rootPkg = read(rootPkgPath);
const version = explicit ?? rootPkg.version;

const manifests = [rootPkgPath];
for (const dir of ['apps', 'packages', 'scripts']) {
  const base = join(root, dir);
  if (!existsSync(base)) continue;
  for (const name of readdirSync(base)) {
    const p = join(base, name, 'package.json');
    if (existsSync(p)) manifests.push(p);
  }
}

const drift = [];
for (const p of manifests) {
  const pkg = read(p);
  if (pkg.version === version) continue;
  drift.push(`${p.slice(root.length + 1)}: ${pkg.version} → ${version}`);
  if (!check) {
    // Preserve formatting: replace only the version field.
    const raw = readFileSync(p, 'utf8').replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
    writeFileSync(p, raw);
  }
}

if (check) {
  if (drift.length) {
    console.error(`Version drift (root is ${version}):\n  ${drift.join('\n  ')}`);
    console.error('Run: node scripts/release/sync-versions.mjs');
    process.exit(1);
  }
  console.log(`All ${manifests.length} manifests at ${version}`);
} else {
  console.log(drift.length ? `Set ${version}:\n  ${drift.join('\n  ')}` : `All manifests already at ${version}`);
}
