#!/bin/bash
# Nightly backup of serwerek (systemd serwerek-backup.timer, 02:30 local). Installed as /opt/serwerek/scripts/backup.sh.
#   Local copy:  /opt/serwerek/backups, 7 days, plain (root, 600): fast restore and the weekly restore test.
#   Offsite:     Cloudflare R2 bucket serwerek-backups, ONLY age-encrypted (*.age) to the owner's public key
#                (AGE_RECIPIENT); the private key never touches the server. Bucket lock 14 days + lifecycle
#                delete after 15 days (set in Cloudflare, not here): the server token cannot shorten either.
#   Secrets (app/worker/db/collector env, /etc/serwerek/*.env, tokens) go ONLY offsite, encrypted.
# Credentials: /etc/serwerek/backup.env (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, AGE_RECIPIENT).
# Restore: /opt/serwerek/backups/RESTORE.md and docs/operations/SERWEREK.md (section 23).
set -uo pipefail
here="$(dirname "$(readlink -f "$0")")"
# shellcheck source=common.sh
. "$here/common.sh"

D=/opt/serwerek/backups; TS=$(date +%Y%m%d-%H%M%S); LOG=/var/log/serwerek/backup.log; START=$(date +%s)
umask 077
mkdir -p "$D" /var/log/serwerek; chmod 700 "$D"
exec >>"$LOG" 2>&1
echo "== $TS start"
fail=0

# 1. Postgres dumps: every running container whose image is postgres/pgvector.
for c in $(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /postgres|pgvector/ {print $1}'); do
  u=$(docker exec "$c" printenv POSTGRES_USER 2>/dev/null || echo postgres)
  if docker exec "$c" pg_dumpall -U "$u" | gzip > "$D/pg-$c-$TS.sql.gz" && [ -s "$D/pg-$c-$TS.sql.gz" ]; then
    echo "pg dump ok: $c"
  else
    echo "pg dump FAILED: $c"; rm -f "$D/pg-$c-$TS.sql.gz"; fail=1
  fi
done

# 2. Configuration without secrets: apps (compose files, scripts), docs, host scripts, our cron and systemd units.
units=$(ls /etc/systemd/system/{polutek-cron,serwerek-}*.{service,timer} /etc/systemd/system/cloudflared-serwerek.service 2>/dev/null | sed 's|^/||')
# shellcheck disable=SC2086
tar czf "$D/configs-$TS.tar.gz" --exclude='*/node_modules' --exclude='*.env' --exclude='.env' --exclude='*.env.*' --exclude='.env.*' \
  --exclude='*.bak' --exclude='*.bak-*' --exclude='*.log' --exclude='*/.next' --exclude='opt/serwerek/apps/*/src' \
  -C / opt/serwerek/apps opt/serwerek/docs opt/serwerek/scripts etc/cron.d $units 2>/dev/null \
  && echo "configs ok" || { echo "configs FAILED"; fail=1; }

# 2b. PP Support attachments (local ActiveStorage).
if [ -d /opt/serwerek/data/pp-support/storage ]; then
  tar czf "$D/pp-support-storage-$TS.tar.gz" -C /opt/serwerek/data/pp-support storage \
    && echo "pp-support-storage ok" || { echo "pp-support-storage FAILED"; fail=1; }
fi
chmod 600 "$D"/*"$TS"* 2>/dev/null

# 3. Local rotation: 7 days (pre-deploy dumps are rotated by deploy.sh).
find "$D" -maxdepth 1 -type f \( -name 'pg-*.sql.gz' -o -name 'configs-*.tar.gz' -o -name 'pp-support-storage-*.tar.gz' \) -mtime +6 -delete

# 4. Offsite: encrypt into a staging dir, upload, verify (size + MD5 of every object), clean up.
if [ -r /etc/serwerek/backup.env ]; then
  # shellcheck disable=SC1091
  . /etc/serwerek/backup.env
  if [ -z "${AGE_RECIPIENT:-}" ] || ! command -v age >/dev/null; then
    echo "offsite FAILED: age or AGE_RECIPIENT missing (nothing unencrypted is ever uploaded)"; fail=1
  else
    out=$(mktemp -d "$D/.offsite-XXXXXX")
    for f in "$D"/*"$TS"*; do
      age -r "$AGE_RECIPIENT" -o "$out/$(basename "$f").age" "$f" || { echo "encrypt FAILED: $f"; fail=1; }
    done
    secrets=$(find /opt/serwerek/apps -maxdepth 2 -type f \( -name '*.env' -o -name '.env' -o -name '*.env.*' \) -not -path '*/src/*' 2>/dev/null
              ls /etc/serwerek/*.env 2>/dev/null; [ -d /opt/serwerek/secrets ] && echo /opt/serwerek/secrets)
    # shellcheck disable=SC2086
    if tar -C / -czf - $(printf '%s\n' $secrets | sed 's|^/||') 2>/dev/null | age -r "$AGE_RECIPIENT" -o "$out/secrets-$TS.tar.gz.age"; then
      echo "secrets ok (encrypted, offsite only)"
    else
      echo "secrets FAILED"; fail=1
    fi
    export RCLONE_CONFIG=/dev/null RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_REGION=auto \
      RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
      RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT" RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
    if rclone copy "$out" R2:serwerek-backups --retries 2 --low-level-retries 3 -q \
      && rclone check "$out" R2:serwerek-backups --one-way -q; then
      echo "r2 upload ok ($(ls "$out" | wc -l) files, verified)"
    else
      echo "r2 upload FAILED"; fail=1
    fi
    rm -rf "$out"
  fi
else
  echo "no backup.env: offsite skipped"; fail=1
fi

status=ok; [ "$fail" = 0 ] || status=fail
write_status backup "$status" "$TS"
job_run backup "$status" "$START" "ts $TS"
echo "== done fail=$fail"
exit $fail
