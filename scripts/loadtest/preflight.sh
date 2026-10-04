#!/usr/bin/env bash
# Refuses to start (exit 1) while a deploy or a video encode is running, or while the host is already stressed.
# Exit 2 = host still busy from the previous step (memory/load), worth retrying.
# Read-only: pgrep, /proc, docker inspect and one SELECT on "VideoEncodeJob".
set -u
fail() { echo "PREFLIGHT FAIL: $1" >&2; exit 1; }
busy() { echo "PREFLIGHT BUSY: $1" >&2; exit 2; }  # transient: the caller may wait and retry

# Matches "bash ./deploy.sh <tag>", not a shell whose command line merely mentions the name.
pgrep -f "^(/usr/bin/|/bin/)?(ba)?sh [^ ]*deploy\.sh" >/dev/null && fail "deploy.sh is running"
[ "$(docker inspect -f '{{.State.Health.Status}}' polutek-app-1 2>/dev/null)" = "healthy" ] || fail "polutek-app-1 is not healthy"
jobs="$(docker exec polutek-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from \"VideoEncodeJob\" where status::text in ('"'"'RUNNING'"'"','"'"'QUEUED'"'"')"' 2>/dev/null)"
[ -n "$jobs" ] || fail "could not read VideoEncodeJob"
[ "$jobs" = "0" ] || fail "$jobs encode job(s) RUNNING/QUEUED"
avail="$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)"
[ "$avail" -ge 600 ] || busy "MemAvailable ${avail} MB < 600 before the step"
load1="$(cut -d' ' -f1 /proc/loadavg)"
awk -v l="$load1" 'BEGIN{exit !(l>3)}' && busy "load1 ${load1} > 3 before the step"
echo "preflight ok (mem_avail=${avail}MB load1=${load1})"
