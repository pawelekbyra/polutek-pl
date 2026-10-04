#!/usr/bin/env bash
# Removes everything the load test left behind:
#  - VideoPlaybackSession rows created by /api/media-source during the test. They are identified exactly:
#    userAgentHash = sha256('pp-loadtest/1') (the k6 User-Agent) and no user (guest). Their events (none are
#    sent by the test) would be kept with session = NULL by the FK (onDelete: SetNull).
#  - the k6 container (if still running), the k6 image and the working directory.
# usage: cleanup.sh [--keep-image]      env: OUT_DIR (default /tmp/pp-loadtest/out), K6_IMAGE
set -u
OUT="${OUT_DIR:-/tmp/pp-loadtest/out}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:1.3.0}"
UA_HASH="$(printf '%s' 'pp-loadtest/1' | sha256sum | cut -d' ' -f1)"

touch "$OUT/STOP" 2>/dev/null || true
docker kill pp-loadtest-k6 >/dev/null 2>&1 || true

docker exec -i polutek-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v h="$1"' -- "$UA_HASH" <<'SQL'
\set QUIET on
select count(*) as test_sessions_before from "VideoPlaybackSession" where "userAgentHash" = :'h' and "userId" is null;
delete from "VideoPlaybackSession" where "userAgentHash" = :'h' and "userId" is null;
select count(*) as test_sessions_after from "VideoPlaybackSession" where "userAgentHash" = :'h';
SQL

if [ "${1:-}" != "--keep-image" ]; then docker rmi "$K6_IMAGE" >/dev/null 2>&1 && echo "removed image $K6_IMAGE"; fi
