#!/usr/bin/env bash
# Activate a release built by release-build.sh (images already loaded here). Does NOT build anything.
# Docs: docs/operations/RELEASE-PROCESS.md. The old ./deploy.sh in $APP_DIR stays the emergency path.
#
# Usage (on the production server, as root):
#   release-deploy.sh <manifest.json>                       checks -> backup -> migrations -> app -> encoder/collector
#   release-deploy.sh <manifest.json> --check               only checks + list of pending migrations (changes nothing)
#   release-deploy.sh <manifest.json> --stop-before-migrate checks + backup + pending migrations, then stop
#   release-deploy.sh --rollback [<manifest.json>]          back to the previous release (or the given one); ALWAYS
#                                                           allowed: no proof needed, only the local images
#   release-deploy.sh --sync-env                            write .env image lines from the .current-* state files
#                                                           (run after any deploy made with the old deploy.sh)
# Options (env): RD_MIN_FREE_GB=5, RD_BACKUP=full|dump (full = /opt/serwerek/scripts/backup.sh + pre-deploy dump),
#   RD_DRAIN_ENCODER=1 (stop the encoder before migrations: video-schema migrations), HEALTH_TIMEOUT=150, KEEP_RELEASES=3,
#   RD_PUBLIC_URL=https://www.pawelperfect.com/api/health, RELEASE_FOREGROUND=1 (do not detach).
# Shares .deploy.lock with deploy.sh / deploy-admin.sh. State files (.current-image, .previous-image, ...) are the same
# ones deploy.sh uses, so `./deploy.sh <tag> --rollback` keeps working after a release and vice versa.
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/lib/common.sh"
LOG_TAG=release-deploy

arg1="${1:-}"; arg2="${2:-}"
[[ -n "$arg1" ]] || die "usage: $0 <manifest.json> [--check|--stop-before-migrate] | --rollback [<manifest.json>] | --sync-env"
detach_self "$RB_HOME/logs/deploy-$(date -u +%Y%m%dT%H%M%S).log" "$@"

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-150}"
START_SETTLE="${START_SETTLE:-5}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
RD_MIN_FREE_GB="${RD_MIN_FREE_GB:-5}"
RD_BACKUP="${RD_BACKUP:-full}"
RD_PUBLIC_URL="${RD_PUBLIC_URL:-https://www.pawelperfect.com/api/health}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"
started=$(date +%s)
warnings=()
summary="?"

finish() {
  local rc=$?
  if (( rc == 0 )); then record_job deploy ok "$started" "release: $summary${warnings:+ WITH WARNINGS: ${warnings[*]}}"
  else record_job deploy fail "$started" "release: $summary (exit $rc)"; fi
  write_rc "$rc"
  exit "$rc"
}
trap finish EXIT

cd "$APP_DIR"
exec 9>.deploy.lock
flock -n 9 || die "another deploy is running (lock $APP_DIR/.deploy.lock)"
for f in app.env docker-compose.yml; do [[ -f "$f" ]] || die "missing $APP_DIR/$f"; done

# ---------- helpers (same behaviour as deploy.sh) ----------
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) cid status
  while (( SECONDS < deadline )); do
    cid="$(docker compose ps -q app 2>/dev/null || true)"
    if [[ -n "$cid" ]]; then
      status="$(docker inspect -f '{{if .State.Running}}{{.State.Health.Status}}{{else}}stopped{{end}}' "$cid" 2>/dev/null || echo unknown)"
      [[ "$status" == healthy ]] && { log "app healthy ($1)"; return 0; }
    fi
    sleep 3
  done
  return 1
}
start_app() { APP_IMAGE="$1" docker compose up -d --no-deps app; }
service_running() {
  local cid; sleep "$START_SETTLE"
  cid="$(docker compose ps -q "$1" 2>/dev/null || true)"
  [[ -n "$cid" && "$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)" == running ]]
}
start_optional() { # $1 service (encoder|collector), $2 env var, $3 env file, $4 image; 0 ok, 1 failed, 2 not configured
  [[ -f "$3" ]] || { log "$3 missing, $1 not started"; return 2; }
  docker image inspect "$4" >/dev/null 2>&1 || { log "WARN: $1 image $4 missing"; return 1; }
  [[ "$1" == encoder ]] && { mkdir -p /opt/serwerek/data/video-work && chown 1000:1000 /opt/serwerek/data/video-work 2>/dev/null || true; }
  if env "$2=$4" docker compose up -d --no-deps "$1" && service_running "$1"; then log "$1 running on $4"; return 0; fi
  log "WARN: $1 failed to start on $4"; return 1
}
promote() { # $1 state suffix ("" | -worker | -collector), $2 new image
  local cur; cur="$(cat ".current$1-image" 2>/dev/null || true)"
  [[ "$cur" == "$2" ]] && return 0
  [[ -n "$cur" ]] && printf '%s' "$cur" > ".previous$1-image"
  printf '%s' "$2" > ".current$1-image"
}
readiness_check() {
  local token body svc cid code
  token="$(grep -E '^HEALTHCHECK_TOKEN=' app.env 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"\r' || true)"
  if [[ -n "$token" ]]; then
    body="$(printf 'header = "x-health-token: %s"\n' "$token" | curl -sS -m 10 -K - http://127.0.0.1:3000/api/health 2>/dev/null || true)"
    if grep -Eq '"database"[[:space:]]*:[[:space:]]*"ok"' <<<"$body"; then log "readiness: database ok"
    else log "WARN: readiness: database not confirmed"; warnings+=("readiness: database"); fi
  fi
  for svc in redis srh; do
    cid="$(docker compose ps -q "$svc" 2>/dev/null || true)"; [[ -z "$cid" ]] && continue
    [[ "$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null)" == running ]] && log "readiness: $svc running" \
      || { log "WARN: $svc not running"; warnings+=("$svc not running"); }
  done
  code="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$RD_PUBLIC_URL" || true)"
  if [[ "$code" == 200 ]]; then log "public check: $RD_PUBLIC_URL = 200"
  else log "WARN: public check $RD_PUBLIC_URL = $code"; warnings+=("public health $code"); fi
}
# .env holds SRH_TOKEN (secret): keep every other line, rewrite only our image lines. Values are never printed.
write_env() { # from the state files, so .env always matches what runs
  local tmp; tmp="$(mktemp "$APP_DIR/.env.XXXXXX")"; chmod 600 "$tmp"
  [[ -f .env ]] && grep -vE '^(APP_IMAGE|MIGRATOR_IMAGE|ENCODER_IMAGE|COLLECTOR_IMAGE|# release-deploy)' .env > "$tmp" || true
  {
    echo "# release-deploy: image lines below are written by deploy/release/release-deploy.sh (--sync-env)"
    local v
    v="$(cat .current-image 2>/dev/null || true)"; [[ -n "$v" ]] && echo "APP_IMAGE=$v"
    v="$(cat .current-migrator-image 2>/dev/null || true)"; [[ -n "$v" ]] && echo "MIGRATOR_IMAGE=$v"
    v="$(cat .current-worker-image 2>/dev/null || true)"; [[ -n "$v" ]] && echo "ENCODER_IMAGE=$v"
    v="$(cat .current-collector-image 2>/dev/null || true)"; [[ -n "$v" ]] && echo "COLLECTOR_IMAGE=$v"
  } >> "$tmp"
  mv -f "$tmp" .env
  log ".env image lines updated from state files"
}
release_of() { node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1]));process.stdout.write(m.tag)' "$1"; }

# ---------- --sync-env ----------
if [[ "$arg1" == --sync-env ]]; then summary="sync-env"; write_env; exit 0; fi

# ---------- --rollback ----------
if [[ "$arg1" == --rollback ]]; then
  target="${arg2:-$(cat "$RB_HOME/.previous-release" 2>/dev/null || true)}"
  if [[ -n "$target" && -f "$target" ]]; then
    eval "$(node "$RELEASE_LIB/manifest.mjs" env --manifest "$target" 2>/dev/null || true)"
    # A changed or missing manifest never blocks a rollback: fall back to the refs it names / to the state files.
    if [[ -z "${APP_IMAGE:-}" ]]; then
      log "WARN: manifest $target did not verify; using the image refs from it anyway"
      eval "$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1]));for(const [k,v] of Object.entries({APP_IMAGE:"app",ENCODER_IMAGE:"worker",COLLECTOR_IMAGE:"collector",MIGRATOR_IMAGE:"migrator"}))if(/^[a-z0-9._/-]+:[A-Za-z0-9._-]+$/.test(m.images?.[v]?.ref||""))console.log(k+"="+m.images[v].ref)' "$target")"
    fi
  fi
  APP_IMAGE="${APP_IMAGE:-$(cat .previous-image 2>/dev/null || true)}"
  ENCODER_IMAGE="${ENCODER_IMAGE:-$(cat .previous-worker-image 2>/dev/null || true)}"
  COLLECTOR_IMAGE="${COLLECTOR_IMAGE:-$(cat .previous-collector-image 2>/dev/null || true)}"
  [[ -n "$APP_IMAGE" ]] || die "nothing to roll back to (no previous release, no .previous-image)"
  docker image inspect "$APP_IMAGE" >/dev/null 2>&1 || die "image $APP_IMAGE is not on this server; emergency path: ./deploy.sh <tag> (builds here)"
  summary="rollback to $APP_IMAGE"
  log "ROLLBACK (code only, never the schema) to $APP_IMAGE"
  { start_app "$APP_IMAGE" && wait_healthy "$APP_IMAGE"; } || die "rollback image $APP_IMAGE is not healthy either"
  promote "" "$APP_IMAGE"
  [[ -n "$ENCODER_IMAGE" ]] && { rc=0; start_optional encoder ENCODER_IMAGE worker.env "$ENCODER_IMAGE" || rc=$?; (( rc == 1 )) && warnings+=("encoder") || promote -worker "$ENCODER_IMAGE"; }
  [[ -n "$COLLECTOR_IMAGE" ]] && { rc=0; start_optional collector COLLECTOR_IMAGE collector.env "$COLLECTOR_IMAGE" || rc=$?; (( rc == 1 )) && warnings+=("collector") || promote -collector "$COLLECTOR_IMAGE"; }
  [[ -n "${MIGRATOR_IMAGE:-}" ]] && printf '%s' "$MIGRATOR_IMAGE" > .current-migrator-image
  readiness_check; write_env
  [[ -n "$target" && -f "$target" ]] && { cur="$(cat "$RB_HOME/.current-release" 2>/dev/null || true)"; printf '%s' "$target" > "$RB_HOME/.current-release"; [[ -n "$cur" ]] && printf '%s' "$cur" > "$RB_HOME/.previous-release"; }
  log "OK: rolled back to $APP_IMAGE${warnings:+ (warnings: ${warnings[*]})}"
  exit 0
fi

# ---------- deploy ----------
manifest="$(readlink -f "$arg1")"; [[ -f "$manifest" ]] || die "no such manifest: $arg1"
mode="${arg2:-deploy}"
case "$mode" in deploy|--check|--stop-before-migrate) ;; *) die "unknown option $mode" ;; esac

# 1. Disk.
free="$(free_gb /)"
(( free >= RD_MIN_FREE_GB )) || die "only ${free} GB free (need ${RD_MIN_FREE_GB}); nothing changed"
log "disk: ${free} GB free"

# 2. Manifest + images: checksum of the manifest, every image present with the recorded ID and revision label.
node "$RELEASE_LIB/manifest.mjs" verify --manifest "$manifest" >/dev/null || die "manifest/images do not verify; nothing changed"
eval "$(node "$RELEASE_LIB/manifest.mjs" env --manifest "$manifest")"
[[ -n "${APP_IMAGE:-}" && -n "${MIGRATOR_IMAGE:-}" ]] || die "manifest is not an app release (probe?)"
summary="$RELEASE_TAG ($RELEASE_REVISION)"
prev_image="$(cat .current-image 2>/dev/null || true)"
log "release $summary verified; running now: ${prev_image:-none}"

# 3. Pending migrations (read-only).
log "migration status:"
status_out="$(MIGRATOR_IMAGE="$MIGRATOR_IMAGE" docker compose --profile tools run --rm -T migrate npx prisma migrate status 2>&1 || true)"
sed 's/^/  /' <<<"$status_out" | grep -vE 'DATABASE_URL|postgres(ql)?://' | tail -n 25
if [[ "$mode" == --check ]]; then summary="check $summary"; log "CHECK ONLY: nothing changed"; exit 0; fi

# 4. Backups: full nightly-style backup (offsite, encrypted) + quick local pre-deploy dump for this release.
if [[ "$RD_BACKUP" == full ]]; then
  log "backup.sh (full copy, offsite)"
  /opt/serwerek/scripts/backup.sh || die "backup.sh failed (see /var/log/serwerek/backup.log); nothing changed"
fi
backups="${BACKUP_DIR:-/opt/serwerek/backups}"
dump="$backups/pre-deploy-$RELEASE_TAG-$(date -u +%Y%m%dT%H%M%S).sql.gz"
( umask 077; mkdir -p "$backups"; docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$dump" && gzip -t "$dump" ) \
  || { rm -f "$dump"; die "pre-deploy dump failed; nothing changed"; }
ls -1t "$backups"/pre-deploy-*.sql.gz 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm -f --
log "pre-deploy dump: $dump ($(stat -c %s "$dump") bytes)"
if [[ "$mode" == --stop-before-migrate ]]; then summary="stopped before migrate $summary"; log "STOP before migrations (as asked). Continue: $0 $manifest"; exit 0; fi

# 5. Migrations: separate step, BEFORE the app. Optionally drain the encoder first (video-schema changes).
if [[ "${RD_DRAIN_ENCODER:-0}" == 1 ]]; then
  log "stopping encoder before migrations (running job goes back to the queue)"
  docker compose stop encoder || warnings+=("encoder stop failed")
fi
log "prisma migrate deploy ($MIGRATOR_IMAGE)"
MIGRATOR_IMAGE="$MIGRATOR_IMAGE" docker compose --profile tools run --rm -T migrate \
  || die "migration failed; app NOT restarted (still on ${prev_image:-none}); dump: $dump"

# 6. App, health, automatic rollback (always allowed).
log "starting app on $APP_IMAGE"
if ! { start_app "$APP_IMAGE" && wait_healthy "$APP_IMAGE"; }; then
  docker compose logs --tail 40 app >&2 || true
  if [[ -n "$prev_image" ]] && docker image inspect "$prev_image" >/dev/null 2>&1; then
    log "rolling back to $prev_image"
    { start_app "$prev_image" && wait_healthy "$prev_image"; } && die "release $RELEASE_TAG FAILED, rolled back to $prev_image (schema stays migrated)"
    die "release $RELEASE_TAG FAILED and rollback to $prev_image is NOT healthy"
  fi
  die "release $RELEASE_TAG FAILED, no previous image to roll back to"
fi
promote "" "$APP_IMAGE"
printf '%s' "$MIGRATOR_IMAGE" > .current-migrator-image
rc=0; start_optional encoder ENCODER_IMAGE worker.env "$ENCODER_IMAGE" || rc=$?
(( rc == 1 )) && warnings+=("encoder not running") || promote -worker "$ENCODER_IMAGE"
rc=0; start_optional collector COLLECTOR_IMAGE collector.env "$COLLECTOR_IMAGE" || rc=$?
(( rc == 1 )) && warnings+=("collector not running") || promote -collector "$COLLECTOR_IMAGE"
readiness_check
write_env
cur="$(cat "$RB_HOME/.current-release" 2>/dev/null || true)"
[[ -n "$cur" && "$cur" != "$manifest" ]] && printf '%s' "$cur" > "$RB_HOME/.previous-release"
printf '%s' "$manifest" > "$RB_HOME/.current-release"

# 7. Cleanup: keep the last KEEP_RELEASES releases; never touch an image a state file points at.
protected=" "
for s in .current-image .previous-image .current-worker-image .previous-worker-image .current-collector-image \
  .previous-collector-image .current-migrator-image .current-admin-image .previous-admin-image; do protected+="$(cat "$s" 2>/dev/null || true) "; done
mapfile -t old < <(ls -1dt "$RB_HOME"/*/manifest.json 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)))
for m in "${old[@]}"; do
  [[ "$m" == "$manifest" || "$m" == "$(cat "$RB_HOME/.previous-release" 2>/dev/null)" ]] && continue
  t="$(release_of "$m" 2>/dev/null || true)"; [[ -n "$t" ]] || continue
  for repo in polutek-app polutek-migrator polutek-worker polutek-collector; do
    [[ "$protected" == *" $repo:$t "* ]] && continue
    docker rmi "$repo:$t" >/dev/null 2>&1 || true
  done
  rm -rf "$(dirname "$m")"; log "cleanup: removed release $t"
done
docker image prune -f >/dev/null 2>&1 || true
find "$RB_HOME/logs" -type f -mtime +30 -delete 2>/dev/null || true

if (( ${#warnings[@]} )); then log "OK (WITH WARNINGS): $APP_IMAGE is live: ${warnings[*]}"; else log "OK: $APP_IMAGE is live"; fi
