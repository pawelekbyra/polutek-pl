#!/usr/bin/env bash
# Database work per request: runs N sequential requests of one target (1 VU) and reads the delta of
# pg_stat_database (committed transactions = statements outside explicit transactions, rows fetched/returned)
# for the app database, minus the background rate measured over the same time while idle.
# usage: count-queries.sh <target> [iterations=50]  (env FLUSH_WAIT_SECONDS=12)      env: VIDEO_ID, OUT_DIR, K6_IMAGE
set -u
TARGET="$1"; N="${2:-50}"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT_DIR:-/tmp/pp-loadtest/out}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:1.3.0}"
: "${VIDEO_ID:?VIDEO_ID is required}"
BASE="${BASE:-http://127.0.0.1:3000}"
LOCALE="${LOCALE:-pl}"
HOST_HEADER="${HOST_HEADER:-www.pawelperfect.com}"
mkdir -p "$OUT"; chmod 777 "$OUT"
LOCK="$OUT/.run-lock"
if ! mkdir "$LOCK" 2>/dev/null; then echo "load test already active for OUT_DIR; refusing concurrent runner" >&2; exit 7; fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
UA_FILE="$OUT/client-user-agent"
if [ ! -s "$UA_FILE" ]; then
  printf 'pp-loadtest/%s\n' "$(cat /proc/sys/kernel/random/uuid)" > "$UA_FILE"
  chmod 600 "$UA_FILE"
fi
LOADTEST_USER_AGENT="$(cat "$UA_FILE")"
[[ "$LOADTEST_USER_AGENT" =~ ^pp-loadtest/[0-9a-f-]{36}$ ]] || { echo "invalid load-test identity file" >&2; exit 8; }
PROFILE_FILE="$OUT/count-$TARGET-n$N-profile.json"
BASE="$BASE" HOST_HEADER="$HOST_HEADER" LOCALE="$LOCALE" VIDEO_ID="$VIDEO_ID" python3 "$DIR/profile-metadata.py" "$PROFILE_FILE" "$TARGET" 1 1 0 0 2000 "count-$TARGET-n$N" "$K6_IMAGE" "$DIR" per-vu-iterations "$N" || exit 14
PROFILE_SHA256="$(sha256sum "$PROFILE_FILE" | awk '{print $1}')"
PROBE_FILE="$OUT/count-$TARGET-n$N-response-probe.jsonl"
probe_response() {
  local result code
  result="$(python3 "$DIR/response-probe.py" "$1" "$2" "$HOST_HEADER" "$LOADTEST_USER_AGENT" 65536)" || {
    code=$?
    printf '%s\n' "$result" | tee -a "$PROBE_FILE" >&2
    return "$code"
  }
  printf '%s\n' "$result" | tee -a "$PROBE_FILE"
}
case "$TARGET" in
  journey) probe_response home "$BASE/$LOCALE" || exit 15; probe_response thumb "$BASE/api/videos/$VIDEO_ID/thumbnail" || exit 15 ;;
  home) probe_response home "$BASE/$LOCALE" || exit 15 ;;
  thumb) probe_response thumb "$BASE/api/videos/$VIDEO_ID/thumbnail" || exit 15 ;;
esac

snap() {
  docker exec polutek-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select xact_commit+xact_rollback, tup_returned, tup_fetched, tup_inserted from pg_stat_database where datname=current_database()"'
}
delta() { awk -F'|' -v a="$1" -v b="$2" 'BEGIN{split(a,x,"|"); split(b,y,"|"); printf "%d %d %d %d", y[1]-x[1], y[2]-x[2], y[3]-x[3], y[4]-x[4]}'; }

"$DIR/preflight.sh" >/dev/null || exit 3
s0="$(snap)"; t0=$(date +%s.%N)
docker run --rm --name pp-loadtest-k6 --network host --cpus 0.5 --memory 256m \
  -v "$DIR:/scripts:ro" -v "$OUT:/out" -e TARGET="$TARGET" -e ITERATIONS="$N" -e VIDEO_ID="$VIDEO_ID" -e LOADTEST_USER_AGENT="$LOADTEST_USER_AGENT" \
  -e BASE="$BASE" -e HOST_HEADER="$HOST_HEADER" -e LOCALE="$LOCALE" \
  -e OUT="/out/count-$TARGET.json" "$K6_IMAGE" run -q --no-usage-report /scripts/k6-guest.js >/dev/null 2>&1
# Postgres 15+ backends flush their statistics at most once a second while busy and up to ~10 s after going
# idle, so wait before reading or part of this run is attributed to the next one.
sleep "${FLUSH_WAIT_SECONDS:-12}"
s1="$(snap)"; t1=$(date +%s.%N)
elapsed=$(awk -v a="$t0" -v b="$t1" 'BEGIN{print b-a}')
# Idle background over the same length of time (encoder queue polling, cron, health checks).
b0="$(snap)"; sleep "${elapsed%.*}"; b1="$(snap)"
read -r dx dr df di < <(delta "$s0" "$s1")
read -r bx br bf bi < <(delta "$b0" "$b1")
awk -v t="$TARGET" -v n="$N" -v dx="$dx" -v bx="$bx" -v dr="$dr" -v br="$br" -v df="$df" -v bf="$bf" -v di="$di" -v bi="$bi" -v e="$elapsed" -v ph="$PROFILE_SHA256" \
  'BEGIN{printf "%s\tN=%d\t%.1fs\txacts/iter=%.1f\ttup_returned/iter=%.0f\ttup_fetched/iter=%.0f\ttup_inserted/iter=%.1f\t(idle bg xacts=%d)\tprofile_id=polutek-guest-read-only-v1\tprofile_sha256=%s\n", t, n, e, (dx-bx)/n, (dr-br)/n, (df-bf)/n, (di-bi)/n, bx, ph}' \
  | tee -a "$OUT/queries.tsv"
