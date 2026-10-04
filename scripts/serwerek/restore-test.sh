#!/bin/bash
# Weekly restore test (systemd serwerek-restore-test.timer, Sunday 03:30 local). Installed as /opt/serwerek/scripts/restore-test.sh.
# Restores the newest nightly dump of the production database into a throwaway Postgres container (tmpfs, 256 MB,
# no network, no port), checks that the data is there and the schema is complete, checks that the encrypted copy of
# the same dump is in R2, then removes the container. A backup nobody restored is only a hope.
# Result: /var/lib/serwerek/restore-test-last, telemetry.job_run (job "restore-test"), exit code (OnFailure alert).
set -uo pipefail
here="$(dirname "$(readlink -f "$0")")"
# shellcheck source=common.sh
. "$here/common.sh"

LOG=/var/log/serwerek/restore-test.log
START=$(date +%s)
NAME="restore-test-$$"
DB_CONTAINER="${RESTORE_SOURCE_CONTAINER:-polutek-db-1}"
exec >>"$LOG" 2>&1
echo "== $(date -Is) start"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

finish() { # $1 = ok|fail, $2 = detail
  echo "$1: $2"
  write_status restore-test "$1" "$2"
  job_run restore-test "$1" "$START" "$2"
  echo "== done $1"
  [ "$1" = ok ] && exit 0 || exit 1
}

dump=$(ls -1t /opt/serwerek/backups/pg-"$DB_CONTAINER"-*.sql.gz 2>/dev/null | head -1)
[ -n "$dump" ] || finish fail "no dump of $DB_CONTAINER in /opt/serwerek/backups"
age_h=$(( ($(date +%s) - $(stat -c %Y "$dump")) / 3600 ))
db_name=$(docker exec "$DB_CONTAINER" printenv POSTGRES_DB 2>/dev/null || echo polutek)
image=$(docker inspect -f '{{.Config.Image}}' "$DB_CONTAINER" 2>/dev/null || echo postgres:17-alpine)

docker run -d --name "$NAME" --network none --memory 256m --cpus 1 \
  --tmpfs /var/lib/postgresql/data:rw,size=1g -e POSTGRES_USER=restore -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
  "$image" >/dev/null || finish fail "cannot start $image"
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U restore -q 2>/dev/null && break; sleep 1; done

# pg_dumpall output: roles (the source superuser already exists here, so that one statement fails harmlessly), databases, data.
if ! gunzip -c "$dump" | docker exec -i "$NAME" psql -U restore -d postgres -q -v ON_ERROR_STOP=0 >/dev/null 2>"/tmp/$NAME.err"; then
  finish fail "psql failed restoring $(basename "$dump")"
fi
errors=$(grep -c 'ERROR' "/tmp/$NAME.err" || true); rm -f "/tmp/$NAME.err"

q() { docker exec "$NAME" psql -U restore -d "$db_name" -qAt -c "$1" 2>/dev/null; }
users=$(q 'select count(*) from "User"'); videos=$(q 'select count(*) from "Video"')
migrations=$(q 'select count(*) from _prisma_migrations where finished_at is not null')
live_migrations=$(docker exec "$DB_CONTAINER" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt -c "select count(*) from _prisma_migrations where finished_at is not null"' 2>/dev/null)
detail="dump $(basename "$dump") (${age_h} h old), users ${users:-?}, videos ${videos:-?}, migrations ${migrations:-?}/${live_migrations:-?}, restore errors $errors"

[[ "${users:-0}" =~ ^[0-9]+$ && "$users" -gt 0 ]] || finish fail "no users after restore; $detail"
[[ "${videos:-0}" =~ ^[0-9]+$ && "$videos" -gt 0 ]] || finish fail "no videos after restore; $detail"
[ "$errors" -le 1 ] || finish fail "unexpected restore errors; $detail"
[ "$age_h" -le 30 ] || finish fail "newest dump too old; $detail"
# A deploy between the dump and now may add migrations; fewer restored migrations than live minus a few means a broken dump.
[[ "${migrations:-0}" =~ ^[0-9]+$ && "${live_migrations:-0}" =~ ^[0-9]+$ ]] && [ $((live_migrations - migrations)) -le 3 ] \
  || finish fail "schema incomplete; $detail"

# The offsite copy of the same dump must exist (encrypted; decrypting needs the owner's key, checked by hand).
if [ -r /etc/serwerek/backup.env ]; then
  # shellcheck disable=SC1091
  . /etc/serwerek/backup.env
  export RCLONE_CONFIG=/dev/null RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_REGION=auto \
    RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT" RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
  remote=$(rclone lsf R2:serwerek-backups --include "$(basename "$dump").age" 2>/dev/null)
  [ -n "$remote" ] || finish fail "encrypted copy missing in R2; $detail"
  detail="$detail, R2 copy present"
fi
finish ok "$detail, $(( $(date +%s) - START )) s"
