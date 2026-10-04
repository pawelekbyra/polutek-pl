#!/bin/bash
# One-off: turns on pg_stat_statements in the production Postgres (decision 9 in docs/architecture/admin-panel.md).
# Needs shared_preload_libraries, i.e. a restart of the db container (a few seconds; the app reconnects by itself).
# Meant to run once in a quiet night window, e.g.:
#   systemd-run --on-calendar='2026-10-05 03:05:00' --unit=pp-pgss-once /opt/serwerek/scripts/pg-stat-statements-enable.sh
# Steps: skip if already loaded or if anyone is watching / a video is encoding; fresh dump; add the setting to
# /opt/serwerek/apps/polutek/docker-compose.yml (backup kept; the repo file has the same line); recreate db; wait healthy;
# CREATE EXTENSION; check the app; ai-log. Idempotent.
set -uo pipefail
here="$(dirname "$(readlink -f "$0")")"
# shellcheck source=common.sh
. "$here/common.sh"
APP=/opt/serwerek/apps/polutek
LOG=/var/log/serwerek/pg-stat-statements.log
START=$(date +%s)
exec >>"$LOG" 2>&1
echo "== $(date -Is) start"
cd "$APP" || exit 1
note() { AI_AGENT=claude-opus ai-log "pg_stat_statements: $*" 2>/dev/null || true; echo "$*"; }
psql_db() { docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt -v ON_ERROR_STOP=1 -c "$1"' sh "$1"; }

if [ "$(psql_db 'show shared_preload_libraries')" = "pg_stat_statements" ]; then
  psql_db 'create extension if not exists pg_stat_statements' >/dev/null && note "already loaded, extension ensured"
  job_run pg-stat-statements ok "$START" "already enabled"; exit 0
fi

watching=$(psql_db "select count(*) from \"VideoPlaybackSession\" where \"createdAt\" > now() - interval '15 minutes'")
encoding=$(psql_db "select count(*) from \"VideoEncodeJob\" where status = 'RUNNING'" 2>/dev/null || echo 0)
if [ "${watching:-1}" != "0" ] || [ "${encoding:-1}" != "0" ]; then
  note "skipped: traffic in the window (playback sessions 15 min: ${watching:-?}, encoding: ${encoding:-?}); run again another night"
  job_run pg-stat-statements fail "$START" "skipped: traffic"; exit 1
fi

dump="/opt/serwerek/backups/pre-pgss-$(date -u +%Y%m%dT%H%M%S).sql.gz"
( umask 077; docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$dump" ) && [ -s "$dump" ] \
  || { note "aborted: dump failed"; job_run pg-stat-statements fail "$START" "dump failed"; exit 1; }

if ! grep -q 'shared_preload_libraries=pg_stat_statements' docker-compose.yml; then
  cp -p docker-compose.yml "docker-compose.yml.bak-pgss-$(date -u +%Y%m%dT%H%M%S)"
  sed -i 's|"-c", "max_connections=60"\]|"-c", "max_connections=60", "-c", "shared_preload_libraries=pg_stat_statements", "-c", "pg_stat_statements.track=top"]|' docker-compose.yml
  grep -q 'shared_preload_libraries=pg_stat_statements' docker-compose.yml || { note "aborted: compose line not found"; exit 1; }
fi

t0=$(date +%s)
docker compose up -d db
for _ in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q db)" 2>/dev/null)" = healthy ] && break; sleep 2
done
psql_db 'create extension if not exists pg_stat_statements' >/dev/null
loaded=$(psql_db 'show shared_preload_libraries')
sleep 5
code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:3000/api/health || echo 000)
if [ "$loaded" = pg_stat_statements ] && [ "$code" = 200 ]; then
  note "enabled (db restart $(( $(date +%s) - t0 )) s, app health 200, dump $dump)"
  job_run pg-stat-statements ok "$START" "enabled, restart $(( $(date +%s) - t0 )) s"
  exit 0
fi
note "PROBLEM after restart: preload='$loaded', app health $code (compose backup next to docker-compose.yml)"
job_run pg-stat-statements fail "$START" "preload=$loaded app=$code"
send_alert pg-stat-statements "[serwerek] pg_stat_statements: check db" "preload='$loaded', app health $code. Log: $LOG"
exit 1
