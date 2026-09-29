#!/bin/sh
# Drop root before starting the server. Volumes created by older versions
# (which ran as root) are handed over to the `node` user once.
set -e
if [ "$(id -u)" = "0" ]; then
  for dir in "${DATA_DIR:-/data}" "${BACKUP_DIR:-/backups}"; do
    mkdir -p "$dir"
    if [ "$(stat -c %u "$dir")" != "$(id -u node)" ]; then
      echo "[entrypoint] fixing ownership of $dir (one-time, from an older root-run version)"
      chown -R node:node "$dir"
    fi
  done
  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi
exec "$@"
