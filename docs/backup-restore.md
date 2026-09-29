# Backups, upgrades & restore

Your data lives in **one SQLite file per account** plus that account's images,
and a small **control database** (accounts, invites, API keys, audit). The
server protects all of it in three layers:

| Layer | When | Where |
|---|---|---|
| **Pre-upgrade snapshot** | automatically, before *any* database schema change | `BACKUP_DIR/pre-upgrade/<time>-to-v<version>/` |
| **Daily backup** | every day after `BACKUP_HOUR` (and on demand) | `BACKUP_DIR/snapshots/<time>/` |
| **Per-account export** | whenever a user clicks *Settings → Download my data* | the user's own computer (`.zip`) |

`BACKUP_DIR` defaults to `${DATA_DIR}/backups`. **Put it on a separate volume
or disk** (the self-host compose file does this for you) so a lost data volume
doesn't take the backups with it — and copy it off the machine (see below).

## What the server guarantees on upgrade

When a new version starts:

1. The control DB and **every** account's DB are checked (`PRAGMA quick_check`).
   A damaged file is never migrated.
2. If a database needs schema changes, a consistent copy is written to
   `pre-upgrade/` **first** (`VACUUM INTO`, safe while running), with a
   `manifest.json` noting the from-version.
3. Migrations run inside a transaction — they either fully apply or not at all.
4. Each database is stamped with the version that last wrote it (`app_meta`).
5. If the data was written by a **newer** version than the one starting (you
   rolled back the image), the server **refuses to start** and tells you which
   version to install or which pre-upgrade backup to restore. This prevents an
   old binary from silently misreading new data. (Override:
   `ALLOW_DOWNGRADE=true` — only if you know the change was compatible.)
6. One broken account never blocks the others: it is marked unavailable (its
   users get a clear "workspace unavailable" message) while everyone else works.

`GET /api/health` reports `version`, `schema` levels and `unavailableAccounts`.

## Daily backups

A backup folder contains:

```
snapshots/2026-09-29T03-00-00/
  manifest.json              version, reason, integrity result per database
  control.db
  users/<id>/lifebook.db
  users/<id>/assets/…        images (hard-linked when possible — cheap)
```

Every copied database is re-opened and integrity-checked; the admin page
(**Admin → Backups**) shows the last result and has a **Back up now** button.
Retention: `BACKUP_RETENTION_DAYS` (default 14), but the newest 3 snapshots are
always kept. Pre-upgrade copies are kept 90 days (newest 5 always).

Settings (environment):

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | `${DATA_DIR}/backups` | where backups go — use its own volume |
| `BACKUP_ENABLED` | `true` | daily backups on/off |
| `BACKUP_HOUR` | `3` | local hour after which the daily backup runs |
| `BACKUP_RETENTION_DAYS` | `14` | how long daily snapshots are kept |

### Off-site copies

Backups on the same machine protect against mistakes, not against losing the
machine. Sync `BACKUP_DIR` elsewhere, e.g. with rclone from the host's cron:

```bash
# /etc/cron.d/dreamward-offsite — 04:30 daily, after the 03:00 backup
30 4 * * * root rclone sync /var/lib/docker/volumes/dreamward_backups/_data remote:dreamward-backups
```

or with restic (encrypted, deduplicated):

```bash
restic -r s3:s3.amazonaws.com/my-bucket/dreamward backup /path/to/backups
```

Also keep a copy of your `.env` somewhere safe (a password manager): without
`KEY_ENCRYPTION_SECRET`, stored AI provider keys can't be decrypted (the data
itself is unaffected — users would just re-enter their keys).

## The admin CLI

Shipped in the server image:

```bash
docker compose exec api node dist/scripts/admin.js <command>
```

| Command | What it does |
|---|---|
| `status` | version, schema levels, accounts, unavailable accounts, last backup |
| `backup` | full verified backup now |
| `backups` | list snapshots and pre-upgrade copies |
| `verify` | integrity-check every database (read-only) |
| `migrate` | upgrade every database now (snapshot first) |
| `restore <folder> [--user N] --yes` | restore a backup folder — **stop the server first** |
| `export-user <id> <file.zip>` | write an account's export archive |
| `import-user <id> <file.zip> --yes` | replace an account's book with an export |

## Restoring

### A whole installation (e.g. roll back an upgrade)

```bash
docker compose stop api
# pick the folder: a daily snapshot, or the pre-upgrade copy of the upgrade you're undoing
docker compose run --rm api node dist/scripts/admin.js backups
docker compose run --rm api node dist/scripts/admin.js restore /backups/pre-upgrade/<folder> --yes
# if you are undoing an upgrade, also pin the previous image version in .env
docker compose up -d
```

`restore` first copies whatever it overwrites to `BACKUP_DIR/pre-restore/`, so
a restore itself can be undone.

### One account only

```bash
docker compose stop api
docker compose run --rm api node dist/scripts/admin.js restore /backups/snapshots/<folder> --user 3 --yes
docker compose up -d
```

### A user restoring their own book

In the app: **Settings → Your data → Import a book** with a previously
downloaded export. The current book is moved to `BACKUP_DIR/pre-import/` (never
deleted). An export from an older version is upgraded on import; an export
from a *newer* version is refused until the server is upgraded.

## Disaster recovery (new machine)

1. Install as usual (see the self-hosting guide).
2. Restore your saved `.env` (same `JWT_SECRET` / `KEY_ENCRYPTION_SECRET`).
3. Copy your off-site `BACKUP_DIR` to the new backup volume.
4. `admin.js restore <latest snapshot> --yes`, then start the stack.
