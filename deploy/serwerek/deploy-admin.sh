#!/usr/bin/env bash
# Deploy ONLY the admin panel (apps/admin) on serwerek from a verified release proof -> start container (profile "admin") ->
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
# Sign-in: ADMIN_AUTH_MODE=access (default; Cloudflare Access e-mail code, no enrollment) or passkey (legacy, needs admin-enroll).
# Lock: .deploy.lock (flock), shared with deploy.sh; a second deploy exits 75 at once (DEPLOY_LOCK_HELD=1: lock inherited on fd 9).
# State: .current-admin-image / .previous-admin-image.
set -euo pipefail
cd "${DEPLOY_APP_DIR:-$(dirname "$(readlink -f "$0")")}"

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
KEEP_IMAGES="${KEEP_IMAGES:-3}"
log() { printf '[deploy-admin %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }
if [[ "${DEPLOY_LOCK_HELD:-}" != "1" ]]; then
  exec 9>.deploy.lock
  flock -n 9 || { log "another deploy is already running (lock $PWD/.deploy.lock); try again when it finishes" >&2; exit 75; }
fi

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

revision="${RELEASE_REVISION:-}"
proof_hash="${RELEASE_PROOF_SHA256:-}"
[[ "$revision" =~ ^[a-f0-9]{40}$ && "$proof_hash" =~ ^[a-f0-9]{64}$ ]] || die "RELEASE_REVISION and externally approved RELEASE_PROOF_SHA256 are required"

[[ -f admin.env ]] || die "missing admin.env (see docs/operations/ADMIN-PANEL.md)"
[[ "$(stat -c %a admin.env)" == "600" ]] || die "admin.env must be chmod 600"
mkdir -p "${ADMIN_HOST_STATUS_DIR:-/var/lib/serwerek/host-status}"

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
  prev_revision="$(cat .previous-admin-release-revision 2>/dev/null || true)"
  [[ "$prev_revision" == "$revision" ]] || die "rollback revision must match .previous-admin-release-revision"
  state_dir=".release-state/$prev_revision"
  [[ -r "$state_dir/proof.sha256" ]] || die "verified panel proof for rollback release is missing"
  [[ "$(cat "$state_dir/proof.sha256")" == "$proof_hash" ]] || die "rollback proof hash must match the externally approved hash"
  verify_output="$(node "$state_dir/source/scripts/ops/deploy-release.mjs" \
    "--release-dir=$state_dir" "--revision=$prev_revision" "--proof-sha256=$proof_hash" --scope=admin "--tag=$tag")" || die "rollback panel proof verification failed"
  prev="polutek-admin:$tag"
  log "rollback to $prev"
  { start_admin "$prev" && wait_healthy "$prev"; } || die "previous panel image is not healthy either"
  printf '%s' "$prev" > .current-admin-image
  cp .current-admin-release-revision .rolled-back-admin-release-revision 2>/dev/null || true
  printf '%s' "$prev_revision" > .current-admin-release-revision
  printf '%s' "$revision" > .previous-admin-release-revision
  exit 0
fi

release_dir=".release-artifacts/$revision"
[[ -d "$release_dir/source" ]] || die "missing verified release bundle at $release_dir (source/, proof.json, inputs.json)"
log "verifying panel release $revision before activation"
verify_output="$(node "$release_dir/source/scripts/ops/deploy-release.mjs" \
  "--release-dir=$release_dir" "--revision=$revision" "--proof-sha256=$proof_hash" --scope=admin "--tag=$tag")" || die "panel release proof verification failed"
prev_revision="$(cat .current-admin-release-revision 2>/dev/null || true)"

log "starting panel on $new_image"
# A failing "compose up" itself must reach the rollback below, so it is part of the condition.
if start_admin "$new_image" && wait_healthy "$new_image"; then
  if [[ "$prev_image" != "$new_image" ]]; then
    [[ -n "$prev_image" ]] && printf '%s' "$prev_image" > .previous-admin-image
    printf '%s' "$new_image" > .current-admin-image
  fi
  if [[ "$prev_revision" != "$revision" ]]; then
    [[ -n "$prev_revision" ]] && printf '%s' "$prev_revision" > .previous-admin-release-revision
    printf '%s' "$revision" > .current-admin-release-revision
  fi
  docker images polutek-admin --format '{{.Tag}}' | grep -v '^current$' | tail -n +$((KEEP_IMAGES + 1)) | while read -r t; do
    [[ "polutek-admin:$t" == "$new_image" || "polutek-admin:$t" == "$prev_image" ]] && continue
    docker rmi "polutek-admin:$t" >/dev/null 2>&1 || true
  done
  log "OK: $new_image is live on 127.0.0.1:3100"
  log "next: open https://admin.pawelperfect.com, enter the owner e-mail, type the code Cloudflare mails you (no enrollment; ADMIN_AUTH_MODE=passkey needs admin-enroll, see docs/operations/ADMIN-PANEL.md 1b)"
  exit 0
fi

log "panel failed to start or did not become healthy in ${HEALTH_TIMEOUT}s; last logs:"
compose logs --tail 40 admin >&2 || true
if [[ -n "$prev_image" ]] && docker image inspect "$prev_image" >/dev/null 2>&1; then
  rollback_revision="$(cat .current-admin-release-revision 2>/dev/null || true)"
  rollback_state=".release-state/$rollback_revision"
  [[ "$rollback_revision" =~ ^[a-f0-9]{40}$ && -r "$rollback_state/proof.sha256" ]] || die "panel deploy FAILED; previous image has no retained release proof, automatic rollback refused"
  rollback_hash="$(cat "$rollback_state/proof.sha256")"
  rollback_tag="${prev_image#*:}"
  node "$rollback_state/source/scripts/ops/deploy-release.mjs" \
    "--release-dir=$rollback_state" "--revision=$rollback_revision" "--proof-sha256=$rollback_hash" --scope=admin "--tag=$rollback_tag" \
    || die "panel deploy FAILED; previous release proof verification failed, automatic rollback refused"
  log "rolling back to $prev_image"
  if start_admin "$prev_image" && wait_healthy "$prev_image"; then die "panel deploy of $tag FAILED, rolled back to $prev_image"; fi
  die "panel deploy FAILED and rollback is NOT healthy"
fi
compose stop admin || true
die "panel deploy of $tag FAILED and there is no previous image; panel stopped (the site is not affected)"
