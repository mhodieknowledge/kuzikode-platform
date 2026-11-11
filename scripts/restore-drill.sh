#!/usr/bin/env bash
# Backup/restore drill (docs/09 §7, roadmap P8.4). Restores one encrypted backup into a scratch D1 database, checks it
# against the backup's manifest, then deletes the scratch database. Never touches the source database.
#   BACKUP_ENCRYPTION_PASSPHRASE=… bash scripts/restore-drill.sh production|staging <object key without extension>
#   e.g. bash scripts/restore-drill.sh production d1/daily/2026-11-12
# The scratch database is always named kuzikode-restore-test.
set -euo pipefail

env_name="${1:-}"
key="${2:-}"
case "$env_name" in
  production) bucket=kuzikode-prod-backups ;;
  staging) bucket=kuzikode-staging-backups ;;
  *) echo "Usage: $0 production|staging <key>" >&2; exit 2 ;;
esac
[[ "$key" =~ ^d1/(daily|monthly|pre-deploy)/[0-9TZ-]+$ ]] || { echo "Key must look like d1/daily/YYYY-MM-DD" >&2; exit 2; }
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE is required}"
scratch=kuzikode-restore-test

work="$(mktemp -d)"
cleanup() {
  rm -rf "$work"
  if npx wrangler d1 list --json 2>/dev/null | grep -q "\"name\": \"$scratch\""; then
    npx wrangler d1 delete "$scratch" --skip-confirmation > /dev/null 2>&1 && echo "Scratch database $scratch deleted"
  fi
}
trap cleanup EXIT
umask 077

get() { npx wrangler r2 object get "$bucket/$1" --file "$2" --remote > "$work/get.log" 2>&1 || { cat "$work/get.log" >&2; exit 1; }; }
dec() { openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in "$1"; }

start=$(date +%s)
get "$key.sql.gz.enc" "$work/backup.sql.gz.enc"
get "$key.manifest.json.enc" "$work/manifest.json.enc"
dec "$work/backup.sql.gz.enc" | gunzip > "$work/backup.sql"
dec "$work/manifest.json.enc" > "$work/manifest.json"
echo "Downloaded and decrypted $bucket/$key ($(stat -c %s "$work/backup.sql") bytes of SQL)"

if npx wrangler d1 list --json 2>/dev/null | grep -q "\"name\": \"$scratch\""; then
  echo "$scratch already exists (an earlier drill did not clean up); deleting it first"
  npx wrangler d1 delete "$scratch" --skip-confirmation > /dev/null
fi
npx wrangler d1 create "$scratch" > "$work/create.log" 2>&1 || { cat "$work/create.log" >&2; exit 1; }
npx wrangler d1 execute "$scratch" --remote --file "$work/backup.sql" --yes > "$work/exec.log" 2>&1 || {
  grep -iE 'error|✘' "$work/exec.log" >&2 || true
  exit 1
}
node scripts/d1-manifest.mjs verify "$scratch" "$work/manifest.json"
echo "Drill took $(($(date +%s) - start)) s"
