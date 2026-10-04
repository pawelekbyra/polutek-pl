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
mkdir -p "$OUT"; chmod 777 "$OUT"

snap() {
  docker exec polutek-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select xact_commit+xact_rollback, tup_returned, tup_fetched, tup_inserted from pg_stat_database where datname=current_database()"'
}
delta() { awk -F'|' -v a="$1" -v b="$2" 'BEGIN{split(a,x,"|"); split(b,y,"|"); printf "%d %d %d %d", y[1]-x[1], y[2]-x[2], y[3]-x[3], y[4]-x[4]}'; }

"$DIR/preflight.sh" >/dev/null || exit 3
s0="$(snap)"; t0=$(date +%s.%N)
docker run --rm --name pp-loadtest-k6 --network host --cpus 0.5 --memory 256m \
  -v "$DIR:/scripts:ro" -v "$OUT:/out" -e TARGET="$TARGET" -e ITERATIONS="$N" -e VIDEO_ID="$VIDEO_ID" \
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
awk -v t="$TARGET" -v n="$N" -v dx="$dx" -v bx="$bx" -v dr="$dr" -v br="$br" -v df="$df" -v bf="$bf" -v di="$di" -v bi="$bi" -v e="$elapsed" \
  'BEGIN{printf "%s\tN=%d\t%.1fs\txacts/iter=%.1f\ttup_returned/iter=%.0f\ttup_fetched/iter=%.0f\ttup_inserted/iter=%.1f\t(idle bg xacts=%d)\n", t, n, e, (dx-bx)/n, (dr-br)/n, (df-bf)/n, (di-bi)/n, bx}' \
  | tee -a "$OUT/queries.tsv"
