#!/usr/bin/env bash
# Deploy ONLY the admin panel (apps/admin) on serwerek: build image -> start container (profile "admin") ->
# wait for health -> roll back to the previous panel image on failure. The public app is never touched.
# Runs ON THE SERVER in /opt/serwerek/apps/polutek next to docker-compose.yml. Runbook: docs/operations/ADMIN-PANEL.md.
#
# Usage:  ./deploy-admin.sh <tag> [--rollback | --stop]
#   <tag>        image tag, normally the short git sha; sources in ./src (git archive of that commit)
#   --rollback   start the previously deployed panel image
#   --stop       stop and remove the panel container (the site keeps running)
# Order: the panel's tables come from the normal Prisma migrations, so run ./deploy.sh <tag> for the same
# commit first (it applies migrations); this script never migrates.
# Needs admin.env (root, 600): DATABASE_URL, ADMIN_AUTH_SECRET, ADMIN_APP_URL, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD ...
# State: .current-admin-image / .previous-admin-image.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
KEEP_IMAGES="${KEEP_IMAGES:-3}"
log() { printf '[deploy-admin %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

tag="${1:-}"; [[ -n "$tag" ]] || die "usage: $0 <tag> [--rollback|--stop]"
mode="${2:-deploy}"
[[ "$tag" =~ ^[A-Za-z0-9._-]+$ ]] || die "bad tag '$tag'"
[[ -f docker-compose.yml ]] || die "missing docker-compose.yml"
compose() { docker compose --profile admin "$@"; }

if [[ "$mode" == "--stop" ]]; then
  compose stop admin || true
  compose rm -f admin || true
  log "panel stopped"
  exit 0
fi

[[ -f admin.env ]] || die "missing admin.env (see docs/operations/ADMIN-PANEL.md)"
[[ "$(stat -c %a admin.env)" == "600" ]] || die "admin.env must be chmod 600"
mkdir -p /var/lib/serwerek/host-status

new_image="polutek-admin:$tag"
prev_image="$(cat .current-admin-image 2>/dev/null || true)"

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) cid status
  while (( SECONDS < deadline )); do
    cid="$(compose ps -q admin 2>/dev/null || true)"
    if [[ -n "$cid" ]]; then
      status="$(docker inspect -f '{{if .State.Running}}{{.State.Health.Status}}{{else}}stopped{{end}}' "$cid" 2>/dev/null || echo unknown)"
      [[ "$status" == "healthy" ]] && { log "panel healthy ($1)"; return 0; }
    fi
    sleep 3
  done
  return 1
}
start_admin() { ADMIN_IMAGE="$1" compose up -d --no-deps admin; }

if [[ "$mode" == "--rollback" ]]; then
  prev="$(cat .previous-admin-image 2>/dev/null || true)"; [[ -n "$prev" ]] || die "no previous panel image recorded"
  log "rollback to $prev"
  start_admin "$prev"; wait_healthy "$prev" || die "previous panel image is not healthy either"
  printf '%s' "$prev" > .current-admin-image
  exit 0
fi

if docker image inspect "$new_image" >/dev/null 2>&1; then
  log "image $new_image already built"
else
  [[ -d src ]] || die "missing ./src (git archive of the commit to deploy)"
  log "building $new_image"
  # nice: a second Next.js build on a 2-vCPU server must not starve the running site.
  nice -n 10 docker build -f src/deploy/serwerek/Dockerfile.admin --target admin -t "$new_image" src
fi

log "starting panel on $new_image"
start_admin "$new_image"
if wait_healthy "$new_image"; then
  if [[ "$prev_image" != "$new_image" ]]; then
    [[ -n "$prev_image" ]] && printf '%s' "$prev_image" > .previous-admin-image
    printf '%s' "$new_image" > .current-admin-image
  fi
  docker images polutek-admin --format '{{.Tag}}' | grep -v '^current$' | tail -n +$((KEEP_IMAGES + 1)) | while read -r t; do
    [[ "polutek-admin:$t" == "$new_image" || "polutek-admin:$t" == "$prev_image" ]] && continue
    docker rmi "polutek-admin:$t" >/dev/null 2>&1 || true
  done
  log "OK: $new_image is live on 127.0.0.1:3100"
  exit 0
fi

log "panel did not become healthy in ${HEALTH_TIMEOUT}s; last logs:"
compose logs --tail 40 admin >&2 || true
if [[ -n "$prev_image" ]] && docker image inspect "$prev_image" >/dev/null 2>&1; then
  log "rolling back to $prev_image"
  start_admin "$prev_image"
  wait_healthy "$prev_image" && die "panel deploy of $tag FAILED, rolled back to $prev_image" || die "panel deploy FAILED and rollback is NOT healthy"
fi
compose stop admin || true
die "panel deploy of $tag FAILED and there is no previous image; panel stopped (the site is not affected)"
