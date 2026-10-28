#!/usr/bin/env bash
# Deploy the app on serwerek: build image -> migrate DB in a one-off container -> restart app -> wait for health -> roll back on failure.
# Runs ON THE SERVER in /opt/serwerek/apps/polutek (this file lives there next to docker-compose.yml). Idempotent: safe to re-run with the same tag.
#
# Usage:  ./deploy.sh <tag> [--rollback]
#   <tag>        image tag, normally the short git sha; sources must be in ./src (git archive of that commit)
#   --rollback   skip build/migrate, just start the previously deployed image
# Images come from one of two places:
#   default            built here from ./src (fallback; heavy on the 2 vCPU / 4 GB server)
#   IMAGE_SOURCE=ghcr  pulled from GHCR, built by .github/workflows/images.yml (tag = 12-char commit sha shown in
#                      the workflow summary); needs a one-time `docker login ghcr.io` with a read:packages token.
#                      No ./src and no build.env needed. Docs: docs/operations/SERWEREK.md, section 24.
# Files next to this script (all root, 600, NOT in git):
#   app.env    runtime env of the app (DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_*, TURNSTILE_*, STRIPE_*, CRON_SECRET, TRUST_CF_CONNECTING_IP=true ...)
#   db.env     POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
#   build.env  PUBLIC build args only: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY (optional), NEXT_PUBLIC_R2_PUBLIC_HOST ...
# Lock: .deploy.lock (flock) shared with deploy-admin.sh; a second deploy exits 75 at once. scripts/ops/mergedeploy.sh takes
#   the lock itself before it replaces ./src and passes it on with DEPLOY_LOCK_HELD=1 (fd 9 inherited).
# Outcome: "OK: <image> is live" = app healthy and encoder/collector running (or not configured). "OK (WITH WARNINGS): ..."
#   = app live, but encoder/collector did not start, or the readiness check failed; the warning is also in telemetry.job_run
#   (status ok, detail "... WITH WARNINGS ..."; the table allows only running|ok|fail) and a failed worker/collector start does
#   NOT promote that image to .current-*-image.
# State: .current-image / .previous-image (image refs). --rollback restores CODE only, never the schema. Migrations were additive until
# 20261005210000_cleanup_dead_schema (destructive): after such a migration the previous image may select dropped columns and fail,
# so roll back by restoring the pre-deploy dump (docs/architecture/db-cleanup-2026-10-05.md).
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-150}"
IMAGE_SOURCE="${IMAGE_SOURCE:-build}"
GHCR_PREFIX="${GHCR_PREFIX:-ghcr.io/pawelekbyra}"
BUILD_CACHE_KEEP="${BUILD_CACHE_KEEP:-12GB}"
DEPLOY_STARTED="$(date +%s)"
KEEP_IMAGES="${KEEP_IMAGES:-3}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"
[[ "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]] || { echo "BACKUP_KEEP must be a positive integer" >&2; exit 1; }
log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
# Every deploy outcome lands in telemetry.job_run as "deploy" (the change axis of the admin panel); best effort.
record_deploy() { # $1 = ok|fail, $2 = detail
  local common="${SERWEREK_COMMON:-/opt/serwerek/scripts/common.sh}"   # override: tests
  if [[ -r "$common" ]]; then
    # shellcheck disable=SC1090
    . "$common"
    job_run deploy "$1" "$DEPLOY_STARTED" "${tag:-?} ($IMAGE_SOURCE): $2"
  fi
  return 0
}
die() { log "ERROR: $*" >&2; record_deploy fail "$*"; exit 1; }
# One deploy at a time (src, compose and .current-* are shared). Not a failure of a deploy, so no telemetry row.
if [[ "${DEPLOY_LOCK_HELD:-}" != "1" ]]; then
  exec 9>.deploy.lock
  flock -n 9 || { log "another deploy is already running (lock $PWD/.deploy.lock); try again when it finishes" >&2; exit 75; }
fi
warnings=()
START_SETTLE="${START_SETTLE:-5}"

tag="${1:-}"; [[ -n "$tag" ]] || die "usage: $0 <tag> [--rollback]"
mode="${2:-deploy}"
[[ "$tag" =~ ^[A-Za-z0-9._-]+$ ]] || die "bad tag '$tag'"
for f in app.env db.env docker-compose.yml; do [[ -f "$f" ]] || die "missing $f"; done

new_image="polutek-app:$tag"
migrator_image="polutek-migrator:$tag"
worker_image="polutek-worker:$tag"
collector_image="polutek-collector:$tag"
prev_image="$(cat .current-image 2>/dev/null || true)"

wait_healthy() { # $1 = image ref (for logs)
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) cid status
  while (( SECONDS < deadline )); do
    cid="$(docker compose ps -q app 2>/dev/null || true)"
    if [[ -n "$cid" ]]; then
      status="$(docker inspect -f '{{if .State.Running}}{{.State.Health.Status}}{{else}}stopped{{end}}' "$cid" 2>/dev/null || echo unknown)"
      [[ "$status" == "healthy" ]] && { log "app healthy ($1)"; return 0; }
    fi
    sleep 3
  done
  return 1
}

start_app() { APP_IMAGE="$1" docker compose up -d --no-deps app; }

# After "compose up" a container can still exit or crash-loop: check it is really running after a short settle time.
service_running() { # $1 = compose service
  local cid
  sleep "$START_SETTLE"
  cid="$(docker compose ps -q "$1" 2>/dev/null || true)"
  [[ -n "$cid" && "$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)" == "running" ]]
}

# pp-collector (analytics beacons -> schema "telemetry") is optional and best-effort like the encoder: it runs only
# when collector.env exists (docs/operations/SERWEREK.md, "Telemetria") and never fails or rolls back an app deploy.
# Return: 0 running, 1 failed to start / not running (the caller warns), 2 not configured (collector.env missing).
start_collector() { # $1 = collector image ref
  [[ -f collector.env ]] || { log "collector.env missing, collector not started (see docs/architecture/admin-telemetry.md)"; return 2; }
  docker image inspect "$1" >/dev/null 2>&1 || { log "WARN: collector image $1 missing, collector not started"; return 1; }
  if COLLECTOR_IMAGE="$1" docker compose up -d --no-deps collector && service_running collector; then
    log "collector running on $1"
  else
    log "WARN: collector failed to start or is not running on $1"; return 1
  fi
}

# The video encoder (own HLS pipeline) is optional and best-effort: it only runs when worker.env exists, and a failure
# here never fails or rolls back an app deploy (it does turn the outcome into "OK (WITH WARNINGS)").
# A running job is handed back to the queue when the container stops. Return codes as start_collector.
start_encoder() { # $1 = worker image ref
  [[ -f worker.env ]] || { log "worker.env missing, encoder not started (see docs/operations/VIDEO-PIPELINE.md)"; return 2; }
  docker image inspect "$1" >/dev/null 2>&1 || { log "WARN: worker image $1 missing, encoder not started"; return 1; }
  mkdir -p /opt/serwerek/data/video-work && chown 1000:1000 /opt/serwerek/data/video-work 2>/dev/null || true
  if ENCODER_IMAGE="$1" docker compose up -d --no-deps encoder && service_running encoder; then
    log "encoder running on $1"
  else
    log "WARN: encoder failed to start or is not running on $1"; return 1
  fi
}

# Post-deploy readiness (best effort, warnings only): database reachable from the app (needs HEALTHCHECK_TOKEN in app.env;
# the token goes to curl through stdin, never on a command line) and redis + srh containers running (rate limits, auth counters).
readiness_check() {
  local token body svc cid
  token="$(grep -E '^HEALTHCHECK_TOKEN=' app.env 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"\r' || true)"
  if [[ -n "$token" ]]; then
    body="$(printf 'header = "x-health-token: %s"\n' "$token" | curl -sS -m 10 -K - http://127.0.0.1:3000/api/health 2>/dev/null || true)"
    if grep -Eq '"database"[[:space:]]*:[[:space:]]*"ok"' <<<"$body"; then
      log "readiness: database reachable from the app"
    else
      log "WARN: readiness: app does not report a reachable database"; warnings+=("readiness: database not confirmed by /api/health")
    fi
  else
    log "readiness: HEALTHCHECK_TOKEN missing in app.env, database probe skipped"
  fi
  for svc in redis srh; do
    cid="$(docker compose ps -q "$svc" 2>/dev/null || true)"
    if [[ -z "$cid" ]]; then log "readiness: $svc not defined or not created in this compose project, skipped"; continue; fi
    if [[ "$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)" == "running" ]]; then
      log "readiness: $svc running"
    else
      log "WARN: readiness: $svc is not running (rate limits and auth counters need it; start: docker compose up -d $svc)"; warnings+=("$svc not running")
    fi
  done
}

if [[ "$mode" == "--rollback" ]]; then
  prev="$(cat .previous-image 2>/dev/null || true)"; [[ -n "$prev" ]] || die "no previous image recorded"
  log "rollback to $prev"
  { start_app "$prev" && wait_healthy "$prev"; } || die "rollback image is not healthy either"
  cp .current-image .rolled-back-from 2>/dev/null || true
  printf '%s' "$prev" > .current-image
  prev_worker="$(cat .previous-worker-image 2>/dev/null || true)"
  if [[ -n "$prev_worker" ]]; then
    rc=0; start_encoder "$prev_worker" || rc=$?
    if (( rc == 1 )); then warnings+=("encoder not running on $prev_worker"); else printf '%s' "$prev_worker" > .current-worker-image; fi
  fi
  prev_collector="$(cat .previous-collector-image 2>/dev/null || true)"
  if [[ -n "$prev_collector" ]]; then
    rc=0; start_collector "$prev_collector" || rc=$?
    if (( rc == 1 )); then warnings+=("collector not running on $prev_collector"); else printf '%s' "$prev_collector" > .current-collector-image; fi
  fi
  if (( ${#warnings[@]} )); then
    log "WARN: rollback to $prev done WITH WARNINGS: ${warnings[*]}"
    record_deploy ok "rollback to $prev WITH WARNINGS: ${warnings[*]}"
  else
    record_deploy ok "rollback to $prev"
  fi
  exit 0
fi

# 1. Images: pull from GHCR, or build here (skipped when the images for this tag already exist).
if [[ "$IMAGE_SOURCE" == "ghcr" ]]; then
  for pair in "polutek-app:$new_image" "polutek-migrator:$migrator_image" "polutek-worker:$worker_image" "polutek-collector:$collector_image"; do
    remote="$GHCR_PREFIX/${pair%%:*}:$tag"
    log "pulling $remote"
    docker pull -q "$remote" >/dev/null || die "cannot pull $remote (images workflow run for this commit? docker login ghcr.io?)"
    docker tag "$remote" "${pair#*:}"
    docker rmi "$remote" >/dev/null 2>&1 || true   # keep only the local name; the layers stay
  done
elif docker image inspect "$new_image" >/dev/null 2>&1 && docker image inspect "$migrator_image" >/dev/null 2>&1   && docker image inspect "$worker_image" >/dev/null 2>&1 && docker image inspect "$collector_image" >/dev/null 2>&1; then
  log "images for $tag already built, skipping build"
else
  [[ -d src ]] || die "missing ./src (git archive of the commit to deploy)"
  [[ -f build.env ]] || die "missing build.env (public NEXT_PUBLIC_* build args)"
  args=()
  while IFS='=' read -r k v; do
    [[ "$k" =~ ^NEXT_PUBLIC_[A-Z0-9_]+$ ]] && args+=(--build-arg "$k=$v")
  done < <(grep -v '^[[:space:]]*#' build.env | sed '/^[[:space:]]*$/d')
  log "building $new_image (${#args[@]} public build args)"
  docker build -f src/deploy/serwerek/Dockerfile --target runner "${args[@]}" -t "$new_image" src
  docker build -f src/deploy/serwerek/Dockerfile --target migrator -t "$migrator_image" src
  docker build -f src/deploy/serwerek/Dockerfile --target worker -t "$worker_image" src
  docker build -f src/deploy/serwerek/Dockerfile --target collector -t "$collector_image" src
fi

# 2. Database up, safety dump, migrations in a one-off container. A failure here leaves the running app untouched.
log "starting db"
docker compose up -d db
for _ in $(seq 1 30); do [[ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q db)" 2>/dev/null)" == "healthy" ]] && break; sleep 2; done
# The dump holds e-mails, password hashes, encrypted 2FA secrets and payments: root-only (dir 700, files 600),
# whatever the shell's umask. Only the last BACKUP_KEEP pre-deploy dumps are kept.
backups="${BACKUP_DIR:-/opt/serwerek/backups}"   # same variable as scripts/serwerek/backup.sh; override: tests
dump="$backups/pre-deploy-$tag-$(date -u +%Y%m%dT%H%M%S).sql.gz"
log "pre-deploy dump -> $dump"
(
  umask 077
  mkdir -p "$backups"
  chmod 700 "$backups"
  docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$dump"
) || { rm -f "$dump"; die "pre-deploy dump failed"; }
chmod 600 "$backups"/pre-deploy-*.sql.gz 2>/dev/null || true
ls -1t "$backups"/pre-deploy-*.sql.gz 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm -f --
log "prisma migrate deploy"
MIGRATOR_IMAGE="$migrator_image" docker compose --profile tools run --rm migrate || die "migration failed; app NOT restarted (still on ${prev_image:-none})"

# 3. Restart app on the new image, wait for health, roll back on failure.
log "starting app on $new_image"
# A failing "compose up" itself (port, network, mount) must reach the rollback below, so it is part of the condition.
if start_app "$new_image" && wait_healthy "$new_image"; then
  if [[ "$prev_image" != "$new_image" ]]; then
    [[ -n "$prev_image" ]] && printf '%s' "$prev_image" > .previous-image
    printf '%s' "$new_image" > .current-image
  fi
  # Keep the last N app/migrator images for rollbacks, drop the rest and dangling layers.
  # Encoder next to the app (after the app is healthy, so a broken worker image never delays the site).
  # A start that failed is a warning and does NOT promote the image to .current-*-image (the state keeps the last version
  # that was known to run); "not configured" (no worker.env / collector.env) keeps the old behaviour.
  prev_worker="$(cat .current-worker-image 2>/dev/null || true)"
  rc=0; start_encoder "$worker_image" || rc=$?
  if (( rc == 1 )); then
    warnings+=("encoder not running on $worker_image")
  elif [[ "$prev_worker" != "$worker_image" ]]; then
    [[ -n "$prev_worker" ]] && printf '%s' "$prev_worker" > .previous-worker-image
    printf '%s' "$worker_image" > .current-worker-image
  fi
  prev_collector="$(cat .current-collector-image 2>/dev/null || true)"
  rc=0; start_collector "$collector_image" || rc=$?
  if (( rc == 1 )); then
    warnings+=("collector not running on $collector_image")
  elif [[ "$prev_collector" != "$collector_image" ]]; then
    [[ -n "$prev_collector" ]] && printf '%s' "$prev_collector" > .previous-collector-image
    printf '%s' "$collector_image" > .current-collector-image
  fi
  readiness_check
  # Never remove an image that a state file points at (current or previous, of any service), nor this deploy's images.
  protected=" $new_image $migrator_image $worker_image $collector_image $prev_image "
  for state_file in .current-image .previous-image .current-worker-image .previous-worker-image .current-collector-image .previous-collector-image; do
    protected+="$(cat "$state_file" 2>/dev/null || true) "
  done
  for repo in polutek-app polutek-migrator polutek-worker polutek-collector; do
    docker images "$repo" --format '{{.Tag}}' | grep -v '^current$' | tail -n +$((KEEP_IMAGES + 1)) | while read -r t; do
      [[ "$protected" == *" $repo:$t "* ]] && continue
      docker rmi "$repo:$t" >/dev/null 2>&1 || true
    done || true   # best effort: no tag to remove (grep finds nothing) must not fail a finished deploy
  done
  docker image prune -f >/dev/null 2>&1 || true
  # Build cache grows by GBs per build on this 75 GB disk (44 GB on 2026-10-04): keep a bounded warm cache.
  docker builder prune -f --keep-storage "$BUILD_CACHE_KEEP" >/dev/null 2>&1 || true
  # Keep the human-readable documentation on the server in step with the deployed commit (docs/ plus the root guides and
  # the server README). Best effort: a failure here never affects the deploy.
  if [[ -d src/docs ]]; then
    {
      rm -rf /opt/serwerek/docs.new && mkdir /opt/serwerek/docs.new \
        && cp -a src/docs/. /opt/serwerek/docs.new/ \
        && cp -f src/CLAUDE.md src/AGENTS.md src/README.md /opt/serwerek/docs.new/ 2>/dev/null \
        && { [[ -f src/deploy/serwerek/SERVER-README.md ]] && cp -f src/deploy/serwerek/SERVER-README.md /opt/serwerek/README.md; true; } \
        && rm -rf /opt/serwerek/docs && mv /opt/serwerek/docs.new /opt/serwerek/docs \
        && log "docs synced to /opt/serwerek/docs"
    } || log "WARN: docs sync failed (ignored)"
  fi
  if (( ${#warnings[@]} )); then
    record_deploy ok "live on $new_image WITH WARNINGS: ${warnings[*]}"
    log "OK (WITH WARNINGS): $new_image is live, but: ${warnings[*]}"
  else
    record_deploy ok "live on $new_image"
    log "OK: $new_image is live"
  fi
  exit 0
fi

log "new image failed to start or did not become healthy in ${HEALTH_TIMEOUT}s; last logs:"
docker compose logs --tail 40 app >&2 || true
if [[ -n "$prev_image" ]] && docker image inspect "$prev_image" >/dev/null 2>&1; then
  log "rolling back to $prev_image"
  if start_app "$prev_image" && wait_healthy "$prev_image"; then die "deploy of $tag FAILED, rolled back to $prev_image"; fi
  die "deploy of $tag FAILED and rollback to $prev_image is NOT healthy"
fi
die "deploy of $tag FAILED and there is no previous image to roll back to"
