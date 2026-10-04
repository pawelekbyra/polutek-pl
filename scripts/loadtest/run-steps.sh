#!/usr/bin/env bash
# Step load: constant arrival rate, doubled every step, with a pause and a preflight between steps.
# usage: run-steps.sh <target> <start_rate> <max_rate>
#   target: journey | home | sidebar | comments | media | thumb      (see k6-guest.js)
# env: VIDEO_ID (required), STEP_SECONDS=60, REST_SECONDS=30, STOP_P95_MS=2000, OUT_DIR=/tmp/pp-loadtest/out,
#      K6_IMAGE=grafana/k6:<pinned>, LABEL (prefix for the summary files)
# Stops the series at the first step that is saturated, has >2% 5xx, or p95 > STOP_P95_MS,
# and immediately when guard.sh wrote $OUT_DIR/ABORT. guard.sh must be running (see README).
set -u
TARGET="$1"; START="$2"; MAX="$3"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT_DIR:-/tmp/pp-loadtest/out}"
STEP="${STEP_SECONDS:-60}"; REST="${REST_SECONDS:-30}"; STOP_P95="${STOP_P95_MS:-2000}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:1.3.0}"
LABEL="${LABEL:-$TARGET}"
: "${VIDEO_ID:?VIDEO_ID is required}"
mkdir -p "$OUT"; chmod 777 "$OUT"
RESULTS="$OUT/results.tsv"
[ -s "$RESULTS" ] || printf "target\trate\titer_per_s\treq_per_s\treqs\tdropped\tp50\tp95\tp99\tmax\terr5xx_pct\tnon200\tper_endpoint_p50/p95/p99_ms\tlabel\tstarted\n" > "$RESULTS"

rate="$START"
while awk -v r="$rate" -v m="$MAX" 'BEGIN{exit !(r<=m)}'; do
  [ -f "$OUT/ABORT" ] && { echo "ABORT file present: $(tail -1 "$OUT/ABORT")"; exit 4; }
  for try in 1 2 3 4 5 6 7 8; do "$DIR/preflight.sh"; pf=$?; [ "$pf" = 2 ] || break; sleep 15; done
  [ "$pf" = 0 ] || exit 3
  started="$(date -u +%FT%TZ)"
  name="${LABEL}-r${rate}"
  echo "== $name  ($started, ${STEP}s)"
  docker run --rm --name pp-loadtest-k6 --network host --cpus 0.5 --memory 256m \
    -v "$DIR:/scripts:ro" -v "$OUT:/out" \
    -e TARGET="$TARGET" -e RATE="$rate" -e DURATION="${STEP}s" -e VIDEO_ID="$VIDEO_ID" \
    -e OUT="/out/$name.json" "$K6_IMAGE" run -q --no-usage-report /scripts/k6-guest.js >/dev/null 2>"$OUT/$name.log"
  if [ ! -s "$OUT/$name.json" ]; then echo "no summary (k6 killed?)"; tail -3 "$OUT/$name.log"; exit 5; fi
  row="$(python3 "$DIR/summarize.py" "$OUT/$name.json" "$TARGET" "$rate" "$STOP_P95")"; code=$?
  printf "%s\t%s\t%s\n" "$row" "$LABEL" "$started" >> "$RESULTS"
  echo "$row"
  [ -f "$OUT/ABORT" ] && { echo "ABORT: $(tail -1 "$OUT/ABORT")"; exit 4; }
  case "$code" in
    10) echo "stop: p95 above ${STOP_P95} ms"; exit 0 ;;
    11) echo "stop: >2% server errors"; exit 0 ;;
    12) echo "stop: saturated (could not serve the target rate)"; exit 0 ;;
  esac
  sleep "$REST"
  rate=$(awk -v r="$rate" 'BEGIN{print r*2}')
done
echo "reached max rate $MAX"
