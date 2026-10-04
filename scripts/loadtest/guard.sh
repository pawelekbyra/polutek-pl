#!/usr/bin/env bash
# Safety monitor for the load test. Samples the host every ~5 s into $OUT_DIR/monitor.csv and kills the
# load generator (container pp-loadtest-k6) the moment any fuse trips, writing the reason to $OUT_DIR/ABORT.
# Fuses: MemAvailable < 400 MB, swap used grows > 1 GB over its value at guard start (SWAP_GROWTH_FUSE_MB),
# load1 > 6 for 20 s, polutek-app-1 restarted/not running, polutek-app-1 memory > APP_MEM_FUSE_MIB (900).
# Stops when $OUT_DIR/STOP exists or after GUARD_MAX_SECONDS. Read-only towards the app (docker stats/inspect, a pg_stat_activity count).
set -u
OUT="${OUT_DIR:-/tmp/pp-loadtest/out}"
mkdir -p "$OUT"
CSV="$OUT/monitor.csv"
APP=polutek-app-1
DB=polutek-db-1
base_start="$(docker inspect -f '{{.State.StartedAt}}' "$APP")"
base_restarts="$(docker inspect -f '{{.RestartCount}}' "$APP")"
high_load=0
# Relative swap fuse: the host already carries ~1.5-1.7 GB of idle swap, so an absolute 3 GB limit is too late.
swap_base="$(awk '/SwapTotal/{t=$2} /SwapFree/{f=$2} END{print int((t-f)/1024)}' /proc/meminfo)"
swap_limit=$((swap_base + ${SWAP_GROWTH_FUSE_MB:-1024}))

[ -s "$CSV" ] || echo "ts,mem_avail_mb,swap_used_mb,load1,app_cpu,app_mem,db_cpu,db_mem,redis_cpu,srh_cpu,encoder_cpu,k6_cpu,pg_active,pg_total" > "$CSV"

abort() {
  echo "$(date -u +%FT%TZ) $1" >> "$OUT/ABORT"
  docker kill pp-loadtest-k6 >/dev/null 2>&1 || true
  echo "GUARD ABORT: $1" >&2
}

# Never outlives the test: exits after GUARD_MAX_SECONDS (default 1 h) even if nobody writes STOP.
deadline=$(( $(date +%s) + ${GUARD_MAX_SECONDS:-3600} ))
while [ ! -f "$OUT/STOP" ] && [ "$(date +%s)" -lt "$deadline" ]; do
  ts="$(date -u +%FT%TZ)"
  read -r mem_avail swap_used < <(awk '/MemAvailable/{a=int($2/1024)} /SwapTotal/{t=$2} /SwapFree/{f=$2} END{print a, int((t-f)/1024)}' /proc/meminfo)
  load1="$(cut -d' ' -f1 /proc/loadavg)"
  declare -A cpu=() mem=()
  while IFS=, read -r n c m; do cpu[$n]="${c%\%}"; mem[$n]="${m%% *}"; done < <(
    docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' 2>/dev/null)
  pg="$(docker exec "$DB" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) filter (where state='"'"'active'"'"'), count(*) from pg_stat_activity where datname=current_database()"' 2>/dev/null | tr '|' ',')"
  echo "$ts,$mem_avail,$swap_used,$load1,${cpu[$APP]:-},${mem[$APP]:-},${cpu[$DB]:-},${mem[$DB]:-},${cpu[polutek-redis-1]:-},${cpu[polutek-srh-1]:-},${cpu[polutek-encoder-1]:-},${cpu[pp-loadtest-k6]:-},${pg:-,}" >> "$CSV"

  [ "$mem_avail" -lt 400 ] && abort "MemAvailable ${mem_avail} MB < 400"
  [ "$swap_used" -gt "$swap_limit" ] && abort "swap used ${swap_used} MB > ${swap_limit} (start ${swap_base} + growth fuse)"
  if awk -v l="$load1" 'BEGIN{exit !(l>6)}'; then high_load=$((high_load+1)); else high_load=0; fi
  [ "$high_load" -ge 4 ] && abort "load1 ${load1} > 6 for 20 s"
  # Extra fuse (added after the first run): the app container has mem_limit 1g and a ~524 MB V8 heap;
  # under overload its memory climbed to ~830 MiB, so stop before an OOM kill takes the site down.
  app_mib="$(awk -v m="${mem[$APP]:-0}" 'BEGIN{v=m+0; if (m ~ /GiB/) v*=1024; else if (m ~ /KiB/) v/=1024; print int(v)}')"
  [ "$app_mib" -gt "${APP_MEM_FUSE_MIB:-900}" ] && abort "$APP memory ${app_mib} MiB > ${APP_MEM_FUSE_MIB:-900}"
  state="$(docker inspect -f '{{.State.Running}} {{.State.StartedAt}} {{.RestartCount}}' "$APP" 2>/dev/null || echo "false - -")"
  if [ "$state" != "true $base_start $base_restarts" ]; then abort "$APP restarted or not running ($state)"; fi
  unset cpu mem
  sleep 3
done
