#!/usr/bin/env bash
# Encrypted D1 backup to R2 (docs/09 §6–7).
#   BACKUP_ENCRYPTION_PASSPHRASE=… bash scripts/backup-d1.sh production|staging nightly|pre-deploy
# Objects (in kuzikode-<env>-backups):
#   d1/daily/YYYY-MM-DD.sql.gz.enc            nightly (also d1/monthly/YYYY-MM.sql.gz.enc on the 1st)
#   d1/pre-deploy/YYYYMMDDTHHMMSSZ.sql.gz.enc before each production deploy
#   … each with a matching .manifest.json.enc (row counts + money checksums, for the restore check)
# Encryption: openssl AES-256-CBC, PBKDF2 (200 000 iterations), random salt. Decrypt with the same passphrase:
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in X.enc | gunzip > X.sql
# Wrangler's export output (which includes a short-lived download link) is never printed.
set -euo pipefail

env_name="${1:-}"
kind="${2:-}"
case "$env_name" in
  production) db=kuzikode-prod-db; bucket=kuzikode-prod-backups ;;
  staging) db=kuzikode-staging-db; bucket=kuzikode-staging-backups ;;
  *) echo "Usage: $0 production|staging nightly|pre-deploy" >&2; exit 2 ;;
esac
case "$kind" in nightly | pre-deploy) ;; *) echo "Usage: $0 production|staging nightly|pre-deploy" >&2; exit 2 ;; esac
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE is required}"
if [ "${#BACKUP_ENCRYPTION_PASSPHRASE}" -lt 20 ]; then
  echo "BACKUP_ENCRYPTION_PASSPHRASE must be at least 20 characters" >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077

npx wrangler d1 export "$db" --remote --output "$work/backup.sql" > "$work/export.log" 2>&1 || {
  grep -E 'ERROR|✘' "$work/export.log" | grep -v 'https://' >&2 || true
  echo "D1 export failed" >&2
  exit 1
}
node scripts/d1-manifest.mjs create "$db" "$work/manifest.json"

enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in "$1" -out "$2"; }
gzip -9 -c "$work/backup.sql" > "$work/backup.sql.gz"
enc "$work/backup.sql.gz" "$work/backup.sql.gz.enc"
enc "$work/manifest.json" "$work/manifest.json.enc"

# Round-trip check before upload: the encrypted file must decrypt to the same SQL.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in "$work/backup.sql.gz.enc" \
  | gunzip | cmp -s - "$work/backup.sql" || { echo "Encrypted backup did not round-trip" >&2; exit 1; }

now_day="$(date -u +%Y-%m-%d)"
if [ "$kind" = nightly ]; then
  keys=("d1/daily/$now_day")
  [ "$(date -u +%d)" = 01 ] && keys+=("d1/monthly/$(date -u +%Y-%m)")
else
  keys=("d1/pre-deploy/$(date -u +%Y%m%dT%H%M%SZ)")
fi

put() { npx wrangler r2 object put "$bucket/$1" --file "$2" --remote > "$work/put.log" 2>&1 || { cat "$work/put.log" >&2; exit 1; }; }
for key in "${keys[@]}"; do
  put "$key.sql.gz.enc" "$work/backup.sql.gz.enc"
  put "$key.manifest.json.enc" "$work/manifest.json.enc"
  echo "Uploaded $bucket/$key.sql.gz.enc ($(stat -c %s "$work/backup.sql.gz.enc") bytes) + manifest"
done
