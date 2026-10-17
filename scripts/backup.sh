#!/usr/bin/env bash
# Daily backup (spec 9.6): dump the schema and the data, encrypt each with
# `gpg --symmetric`, upload both under <YYYY-MM-DD>/ in the private Storage
# bucket, then delete backups older than the retention period.
#
# Dumps hold every share token, so plaintext never touches disk or logs: each
# dump is piped straight into gpg. Nothing is uploaded unless both dumps
# succeed, and nothing is pruned unless the upload succeeds.
#
# Env:
#   SUPABASE_DB_URL        postgresql://... (session pooler for production)
#   BACKUP_PASSPHRASE      gpg symmetric passphrase
#   BACKUP_S3_ENDPOINT     Supabase Storage S3 endpoint
#   BACKUP_BUCKET          bucket name (default: backups)
#   BACKUP_RETENTION_DAYS  default: 30
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
set -euo pipefail

: "${SUPABASE_DB_URL:?}" "${BACKUP_PASSPHRASE:?}" "${BACKUP_S3_ENDPOINT:?}"
: "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}" "${AWS_DEFAULT_REGION:?}"
bucket=${BACKUP_BUCKET:-backups}
retention=${BACKUP_RETENTION_DAYS:-30}

# Recent AWS CLI versions add CRC checksums by default; S3-compatible stores
# don't all accept them.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

s3() { aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 "$@"; }
days_ago() { date -u -d "$1 days ago" +%F 2>/dev/null || date -u -v-"$1"d +%F; }

encrypt_to() {
  gpg --batch --yes --quiet --pinentry-mode loopback \
    --symmetric --cipher-algo AES256 \
    --passphrase-fd 3 --output "$1" 3<<<"$BACKUP_PASSPHRASE"
}

today=$(date -u +%F)
cutoff=$(days_ago "$retention")

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "Dumping schema"
supabase db dump --db-url "$SUPABASE_DB_URL" | encrypt_to "$work/schema.sql.gpg"
echo "Dumping data"
# App data lives only in `private`; leaving out auth/storage keeps the dump
# restorable on its own (see docs/runbook.md).
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --schema private \
  | encrypt_to "$work/data.sql.gpg"

for f in schema data; do
  s3 cp --only-show-errors "$work/$f.sql.gpg" "s3://$bucket/$today/$f.sql.gpg"
done
echo "Uploaded s3://$bucket/$today/"

# Prefixes are dates, so string comparison orders them.
s3 ls "s3://$bucket/" | awk '$1 == "PRE" { sub("/$", "", $2); print $2 }' |
  while read -r prefix; do
    if [[ "$prefix" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ && "$prefix" < "$cutoff" ]]; then
      s3 rm --only-show-errors --recursive "s3://$bucket/$prefix/"
      echo "Deleted backup $prefix"
    fi
  done
