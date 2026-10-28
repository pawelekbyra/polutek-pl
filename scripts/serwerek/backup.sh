#!/bin/bash
# Nightly backup of serwerek (systemd serwerek-backup.timer, 02:30 local). Installed as /opt/serwerek/scripts/backup.sh.
#   Local copy:  /opt/serwerek/backups, 7 days, plain (root, 600): fast restore and the weekly restore test.
#   Offsite:     Cloudflare R2 bucket serwerek-backups, ONLY age-encrypted (*.age) to the owner's public key
#                (AGE_RECIPIENT); the private key never touches the server. Bucket lock 14 days + lifecycle
#                delete after 15 days (set in Cloudflare, not here): the server token cannot shorten either.
#   Secrets (app/worker/db/collector env, /etc/serwerek/*.env, tokens) go ONLY offsite, encrypted.
# Credentials: /etc/serwerek/backup.env (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, AGE_RECIPIENT).
# Required databases: BACKUP_REQUIRED_DBS (space-separated container names, default "polutek-db-1 pp-support-db-1"; may be set
#   in backup.env). A required container that is not running, or whose dump is missing/empty/not valid gzip, fails the whole
#   run (exit 1, status "fail"). Other running postgres/pgvector containers are still dumped opportunistically.
# Manifest: manifest-<ts>.txt next to the copy (name, bytes, sha256 of every file of the run, "complete=yes|no"); it is
#   encrypted and uploaded together with the rest.
# Test hooks (env): BACKUP_DIR, BACKUP_LOG, BACKUP_ENV_FILE, BACKUP_MIN_DUMP_BYTES.
# Restore: /opt/serwerek/backups/RESTORE.md and docs/operations/SERWEREK.md (section 23).
set -uo pipefail
here="$(dirname "$(readlink -f "$0")")"
# shellcheck source=common.sh
. "$here/common.sh"

D="${BACKUP_DIR:-/opt/serwerek/backups}"; TS=$(date +%Y%m%d-%H%M%S); LOG="${BACKUP_LOG:-/var/log/serwerek/backup.log}"; START=$(date +%s)
BACKUP_ENV="${BACKUP_ENV_FILE:-/etc/serwerek/backup.env}"
MIN_DUMP_BYTES="${BACKUP_MIN_DUMP_BYTES:-200}"   # gzip of an empty stream is ~20 bytes
umask 077
mkdir -p "$D" "$(dirname "$LOG")"; chmod 700 "$D"
exec >>"$LOG" 2>&1
echo "== $TS start"
fail=0
# shellcheck disable=SC1090
[ -r "$BACKUP_ENV" ] && . "$BACKUP_ENV"
REQUIRED_DBS="${BACKUP_REQUIRED_DBS:-polutek-db-1 pp-support-db-1}"

# 1. Postgres dumps: every REQUIRED container (BACKUP_REQUIRED_DBS) plus every other running postgres/pgvector container.
#    A missing/stopped required container, an unreachable Docker, an empty or corrupt dump all fail the run.
running=""
if ps_out=$(docker ps --format '{{.Names}} {{.Image}}'); then
  running=$(printf '%s
' "$ps_out" | awk '{print $1}')
  discovered=$(printf '%s
' "$ps_out" | awk '$2 ~ /postgres|pgvector/ {print $1}')
else
  echo "pg dump FAILED: docker ps failed (Docker not reachable)"; fail=1; discovered=""
fi
# shellcheck disable=SC2086
targets=$(printf '%s
' $REQUIRED_DBS $discovered | awk 'NF && !seen[$0]++')
for c in $REQUIRED_DBS; do
  printf '%s
' "$running" | grep -qxF -- "$c" || { echo "pg dump FAILED: required db container not running: $c"; fail=1; }
done
for c in $targets; do
  printf '%s
' "$running" | grep -qxF -- "$c" || continue
  f="$D/pg-$c-$TS.sql.gz"
  u=$(docker exec "$c" printenv POSTGRES_USER 2>/dev/null || echo postgres)
  if docker exec "$c" pg_dumpall -U "$u" | gzip > "$f" && [ "$(stat -c %s "$f" 2>/dev/null || echo 0)" -ge "$MIN_DUMP_BYTES" ] && gzip -t "$f" 2>/dev/null; then
    echo "pg dump ok: $c ($(stat -c %s "$f") bytes)"
  else
    echo "pg dump FAILED: $c (error, too small or not valid gzip)"; rm -f "$f"; fail=1
  fi
done

# 2. Configuration without secrets: apps (compose files, scripts), docs, host scripts, our cron and systemd units.
units=$(ls /etc/systemd/system/{polutek-cron,serwerek-}*.{service,timer} /etc/systemd/system/cloudflared-serwerek.service 2>/dev/null | sed 's|^/||')
# shellcheck disable=SC2086
tar czf "$D/configs-$TS.tar.gz" --exclude='*/node_modules' --exclude='*.env' --exclude='.env' --exclude='*.env.*' --exclude='.env.*' \
  --exclude='*.bak' --exclude='*.bak-*' --exclude='*.log' --exclude='*/.next' --exclude='opt/serwerek/apps/*/src' \
  -C / opt/serwerek/apps opt/serwerek/docs opt/serwerek/scripts etc/cron.d $units 2>/dev/null \
  && [ -s "$D/configs-$TS.tar.gz" ] && echo "configs ok" || { echo "configs FAILED"; rm -f "$D/configs-$TS.tar.gz"; fail=1; }

# 2b. PP Support attachments (local ActiveStorage).
if [ -d /opt/serwerek/data/pp-support/storage ]; then
  tar czf "$D/pp-support-storage-$TS.tar.gz" -C /opt/serwerek/data/pp-support storage \
    && [ -s "$D/pp-support-storage-$TS.tar.gz" ] && echo "pp-support-storage ok" || { echo "pp-support-storage FAILED"; fail=1; }
fi

# 2c. Completeness check + manifest (written even on failure, then with complete=no).
for c in $REQUIRED_DBS; do
  [ -s "$D/pg-$c-$TS.sql.gz" ] || { echo "required dump MISSING: pg-$c-$TS.sql.gz"; fail=1; }
done
[ -s "$D/configs-$TS.tar.gz" ] || { echo "required file MISSING: configs-$TS.tar.gz"; fail=1; }
manifest="$D/manifest-$TS.txt"
{
  echo "# serwerek backup manifest ts=$TS host=$(hostname) required_dbs=$REQUIRED_DBS"
  echo "complete=$([ "$fail" = 0 ] && echo yes || echo no) (before offsite)"
  echo "# name bytes sha256"
  for f in "$D"/*"$TS"*; do
    [ -f "$f" ] && [ "$f" != "$manifest" ] && printf '%s %s %s
' "$(basename "$f")" "$(stat -c %s "$f")" "$(sha256sum "$f" | awk '{print $1}')"
  done
} > "$manifest" && echo "manifest ok" || { echo "manifest FAILED"; fail=1; }
chmod 600 "$D"/*"$TS"* 2>/dev/null

# 4. Offsite: encrypt into a staging dir, upload, verify (size + MD5 of every object), clean up.
if [ -r "$BACKUP_ENV" ]; then
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

# 5. Local rotation: 7 days (pre-deploy dumps are rotated by deploy.sh). A failed run does not shorten the history of last
#    good copies: it only drops what is older than 14 days.
if [ "$fail" = 0 ]; then keep_days=6; else keep_days=13; echo "run failed: rotation limited to files older than 14 days"; fi
find "$D" -maxdepth 1 -type f \( -name 'pg-*.sql.gz' -o -name 'configs-*.tar.gz' -o -name 'pp-support-storage-*.tar.gz' -o -name 'manifest-*.txt' \) -mtime +"$keep_days" -delete

status=ok; [ "$fail" = 0 ] || status=fail
write_status backup "$status" "$TS"
job_run backup "$status" "$START" "ts $TS"
echo "== done fail=$fail"
exit $fail
