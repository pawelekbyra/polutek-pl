#!/usr/bin/env bash
# Delete only guest playback sessions created by this load-test run.
# The app computes the HMAC with its own secret; the secret is never printed or passed to the host.
# usage: cleanup.sh [--keep-image]      env: OUT_DIR (default /tmp/pp-loadtest/out), K6_IMAGE
set -u
OUT="${OUT_DIR:-/tmp/pp-loadtest/out}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:1.3.0}"
DIR="$(cd "$(dirname "$0")" && pwd)"
UA_FILE="$OUT/client-user-agent"
LOCK="$OUT/.run-lock"

if [ -d "$LOCK" ]; then echo "load test runner is active for OUT_DIR; refusing cleanup" >&2; exit 7; fi
if [ ! -s "$UA_FILE" ]; then echo "missing run identity; refusing to delete playback sessions" >&2; exit 8; fi
LOADTEST_USER_AGENT="$(cat "$UA_FILE")"
[[ "$LOADTEST_USER_AGENT" =~ ^pp-loadtest/[0-9a-f-]{36}$ ]] || { echo "invalid run identity; refusing cleanup" >&2; exit 8; }

touch "$OUT/STOP" 2>/dev/null || true
docker kill pp-loadtest-k6 >/dev/null 2>&1 || true

UA_HASH="$(docker exec -e "LOADTEST_USER_AGENT=$LOADTEST_USER_AGENT" -i polutek-app-1 node - < "$DIR/session-hash.mjs")" || {
  echo "could not calculate the app-compatible session HMAC; refusing cleanup" >&2
  exit 9
}
[[ "$UA_HASH" =~ ^[0-9a-f]{64}$ ]] || { echo "app returned an invalid session HMAC; refusing cleanup" >&2; exit 9; }

if ! docker exec -i polutek-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v h="$1"' -- "$UA_HASH" <<'SQL'
\set QUIET on
select count(*) as test_sessions_before from "VideoPlaybackSession" where "userAgentHash" = :'h' and "userId" is null;
delete from "VideoPlaybackSession" where "userAgentHash" = :'h' and "userId" is null;
select count(*) as test_sessions_after from "VideoPlaybackSession" where "userAgentHash" = :'h';
SQL
then
  echo "database cleanup failed; keeping the run identity for a safe retry" >&2
  exit 10
fi
rm -f "$UA_FILE"

if [ "${1:-}" != "--keep-image" ]; then docker rmi "$K6_IMAGE" >/dev/null 2>&1 && echo "removed image $K6_IMAGE"; fi
