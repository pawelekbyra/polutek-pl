#!/usr/bin/env bash
# Turns on pp-collector on serwerek after a deploy that applied migration 20261004210000_telemetry_schema.
# Runs ON THE SERVER in /opt/serwerek/apps/polutek (next to docker-compose.yml). Idempotent.
#   1. gives role pp_collector a fresh random password and LOGIN (the migration creates it NOLOGIN),
#   2. writes collector.env (root, 600): TELEMETRY_DATABASE_URL, TELEMETRY_ALLOWED_HOSTS,
#   3. adds TELEMETRY_COLLECTOR_URL=http://collector:3200 to app.env (backup first) if missing,
#   4. verifies the retained release proof, then starts only those verified app/collector IDs.
# For config-only app restarts, verify the active proof with verify-active-release.sh before compose activation.
# Docs: docs/architecture/admin-telemetry.md, docs/operations/SERWEREK.md ("Telemetria").
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
umask 077
log() { printf '[telemetry-enable] %s\n' "$*"; }

for f in app.env db.env docker-compose.yml; do [[ -f "$f" ]] || { log "missing $f"; exit 1; }; done
exec 9>.deploy.lock
flock -n 9 || { log "another deploy is active (.deploy.lock)"; exit 75; }
image="$(cat .current-collector-image 2>/dev/null || true)"
revision="${RELEASE_REVISION:-}"
proof_hash="${RELEASE_PROOF_SHA256:-}"
state_dir=".release-state/$revision"
[[ "$revision" =~ ^[a-f0-9]{40}$ && "$proof_hash" =~ ^[a-f0-9]{64}$ ]] || { log "RELEASE_REVISION and externally approved RELEASE_PROOF_SHA256 are required"; exit 1; }
[[ "$(cat .current-release-revision 2>/dev/null || true)" == "$revision" ]] || { log "release revision does not match the deployed app"; exit 1; }
[[ -r "$state_dir/proof.sha256" && "$(cat "$state_dir/proof.sha256")" == "$proof_hash" ]] || { log "approved proof does not match the retained release"; exit 1; }
[[ -n "$image" ]] || { log "no collector image yet; deploy a proof-verified release first"; exit 1; }
tag="$revision"
./verify-active-release.sh app >/dev/null \
  || { log "release proof verification failed; no telemetry configuration changed"; exit 1; }

db_name="$(sed -n 's/^POSTGRES_DB=//p' db.env | tail -1)"
[[ -n "$db_name" ]] || { log "POSTGRES_DB missing in db.env"; exit 1; }
exists="$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select 1 from pg_roles where rolname = '"'"'pp_collector'"'"'"')"
[[ "$exists" == "1" ]] || { log "role pp_collector missing: the telemetry migration has not run"; exit 1; }

password="$(openssl rand -hex 24)"
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q' <<SQL
ALTER ROLE pp_collector LOGIN PASSWORD '${password}' CONNECTION LIMIT 4;
SQL
cat > collector.env <<ENV
TELEMETRY_DATABASE_URL=postgresql://pp_collector:${password}@db:5432/${db_name}
TELEMETRY_ALLOWED_HOSTS=www.pawelperfect.com
ENV
chmod 600 collector.env
log "collector.env written, pp_collector can log in"

if ! grep -q '^TELEMETRY_COLLECTOR_URL=' app.env; then
  cp -p app.env "app.env.bak-telemetry-$(date -u +%Y%m%dT%H%M%S)"
  printf '\nTELEMETRY_COLLECTOR_URL=http://collector:3200\n' >> app.env
  log "TELEMETRY_COLLECTOR_URL added to app.env (backup kept next to it)"
fi

old_app="$(cat .current-image 2>/dev/null || true)"
old_collector="$image"
image="polutek-collector:$tag"
COLLECTOR_IMAGE="$image" docker compose up -d --no-deps collector
APP_IMAGE="polutek-app:$tag" docker compose up -d --no-deps app
[[ -n "$old_app" && "$old_app" != "polutek-app:$tag" ]] && printf '%s' "$old_app" > .previous-image || true
[[ "$old_collector" != "$image" ]] && printf '%s' "$old_collector" > .previous-collector-image || true
printf '%s' "polutek-app:$tag" > .current-image
printf '%s' "$image" > .current-collector-image
log "collector and app restarted from verified release $revision; check: docker compose logs --tail 20 collector"
