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
#   build.env  PUBLIC build args only: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_R2_PUBLIC_HOST ...
# State: .current-image / .previous-image (image refs). Migrations are additive in this repo, so rollback restores code only, never the schema.
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
  local common=/opt/serwerek/scripts/common.sh
  if [[ -r "$common" ]]; then
    # shellcheck disable=SC1090
    . "$common"
    job_run deploy "$1" "$DEPLOY_STARTED" "${tag:-?} ($IMAGE_SOURCE): $2"
  fi
  return 0
}
die() { log "ERROR: $*" >&2; record_deploy fail "$*"; exit 1; }

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

# pp-collector (analytics beacons -> schema "telemetry") is optional and best-effort like the encoder: it runs only
# when collector.env exists (docs/operations/SERWEREK.md, "Telemetria") and never fails or rolls back an app deploy.
start_collector() { # $1 = collector image ref
  [[ -f collector.env ]] || { log "collector.env missing, collector not started (see docs/architecture/admin-telemetry.md)"; return 0; }
  docker image inspect "$1" >/dev/null 2>&1 || { log "collector image $1 missing, collector not started"; return 0; }
  if COLLECTOR_IMAGE="$1" docker compose up -d --no-deps collector; then log "collector running on $1"; else log "WARN: collector failed to start on $1"; fi
}

# The video encoder (own HLS pipeline) is optional and best-effort: it only runs when worker.env exists, and a failure
# here never fails or rolls back an app deploy. A running job is handed back to the queue when the container stops.
start_encoder() { # $1 = worker image ref
  [[ -f worker.env ]] || { log "worker.env missing, encoder not started (see docs/operations/VIDEO-PIPELINE.md)"; return 0; }
  docker image inspect "$1" >/dev/null 2>&1 || { log "worker image $1 missing, encoder not started"; return 0; }
  mkdir -p /opt/serwerek/data/video-work && chown 1000:1000 /opt/serwerek/data/video-work 2>/dev/null || true
  if ENCODER_IMAGE="$1" docker compose up -d --no-deps encoder; then log "encoder running on $1"; else log "WARN: encoder failed to start on $1"; fi
}

if [[ "$mode" == "--rollback" ]]; then
  prev="$(cat .previous-image 2>/dev/null || true)"; [[ -n "$prev" ]] || die "no previous image recorded"
  log "rollback to $prev"
  start_app "$prev"; wait_healthy "$prev" || die "rollback image is not healthy either"
  cp .current-image .rolled-back-from 2>/dev/null || true
  printf '%s' "$prev" > .current-image
  prev_worker="$(cat .previous-worker-image 2>/dev/null || true)"
  if [[ -n "$prev_worker" ]]; then start_encoder "$prev_worker"; printf '%s' "$prev_worker" > .current-worker-image; fi
  prev_collector="$(cat .previous-collector-image 2>/dev/null || true)"
  if [[ -n "$prev_collector" ]]; then start_collector "$prev_collector"; printf '%s' "$prev_collector" > .current-collector-image; fi
  record_deploy ok "rollback to $prev"
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
backups=/opt/serwerek/backups
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
start_app "$new_image"
if wait_healthy "$new_image"; then
  if [[ "$prev_image" != "$new_image" ]]; then
    [[ -n "$prev_image" ]] && printf '%s' "$prev_image" > .previous-image
    printf '%s' "$new_image" > .current-image
  fi
  # Keep the last N app/migrator images for rollbacks, drop the rest and dangling layers.
  # Encoder next to the app (after the app is healthy, so a broken worker image never delays the site).
  prev_worker="$(cat .current-worker-image 2>/dev/null || true)"
  start_encoder "$worker_image"
  if [[ "$prev_worker" != "$worker_image" ]]; then
    [[ -n "$prev_worker" ]] && printf '%s' "$prev_worker" > .previous-worker-image
    printf '%s' "$worker_image" > .current-worker-image
  fi
  prev_collector="$(cat .current-collector-image 2>/dev/null || true)"
  start_collector "$collector_image"
  if [[ "$prev_collector" != "$collector_image" ]]; then
    [[ -n "$prev_collector" ]] && printf '%s' "$prev_collector" > .previous-collector-image
    printf '%s' "$collector_image" > .current-collector-image
  fi
  for repo in polutek-app polutek-migrator polutek-worker polutek-collector; do
    docker images "$repo" --format '{{.Tag}}' | grep -v '^current$' | tail -n +$((KEEP_IMAGES + 1)) | while read -r t; do
      [[ "$repo:$t" == "$new_image" || "$repo:$t" == "$prev_image" ]] && continue
      docker rmi "$repo:$t" >/dev/null 2>&1 || true
    done
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
  record_deploy ok "live on $new_image"
  log "OK: $new_image is live"
  exit 0
fi

log "new image did not become healthy in ${HEALTH_TIMEOUT}s; last logs:"
docker compose logs --tail 40 app >&2 || true
if [[ -n "$prev_image" ]] && docker image inspect "$prev_image" >/dev/null 2>&1; then
  log "rolling back to $prev_image"
  start_app "$prev_image"
  wait_healthy "$prev_image" && die "deploy of $tag FAILED, rolled back to $prev_image" || die "deploy of $tag FAILED and rollback to $prev_image is NOT healthy"
fi
die "deploy of $tag FAILED and there is no previous image to roll back to"
