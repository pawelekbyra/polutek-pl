#!/usr/bin/env bash
# Sends the recent Postfix log of the own mail path to the app (POST /api/cron/own-mail-events), which suppresses
# hard-bounced addresses and reports blocks by receivers. Timer: serwerek-own-mail-events.timer (every 5 min).
# Installed as /opt/serwerek/scripts/own-mail-events.sh. Env (EnvironmentFile /etc/serwerek/cron.env, never printed):
#   CRON_SECRET (required)   CRON_BASE_URL (default http://127.0.0.1:3000)   MAIL_CONTAINER (default pp-mail-lab)
# Exit 0 = ok or own path not running; 3 = receivers are blocking us (the failed unit is reported by health.sh); 1 = error.
set -euo pipefail
container="${MAIL_CONTAINER:-pp-mail-lab}"
base="${CRON_BASE_URL:-http://127.0.0.1:3000}"
state="${STATE_FILE:-/var/lib/serwerek/own-mail-events.since}"
: "${CRON_SECRET:?CRON_SECRET is not set}"

# The own path is optional: nothing to do while its container does not run.
if [ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || echo false)" != "true" ]; then
  echo "own-mail-events: $container is not running, nothing to do"
  exit 0
fi

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
since="$(cat "$state" 2>/dev/null || date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
# Overlap of 2 minutes: every log line has a stable event id in the app, so repeats are harmless.
since="$(date -u -d "$since - 2 minutes" +%Y-%m-%dT%H:%M:%SZ)"

log="$(mktemp)"; out="$(mktemp)"
trap 'rm -f "$log" "$out"' EXIT
docker logs --since "$since" "$container" >"$log" 2>&1 || true

if ! code="$(printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" \
  | curl -sS -K - -o "$out" -w '%{http_code}' --max-time 60 -X POST -H 'Content-Type: text/plain' --data-binary "@$log" "$base/api/cron/own-mail-events")"; then
  echo "own-mail-events: curl failed" >&2
  exit 1
fi
if [[ ! "$code" =~ ^2 ]]; then
  echo "own-mail-events: HTTP $code" >&2
  exit 1
fi

mkdir -p "$(dirname "$state")"
printf '%s\n' "$now" >"$state"
echo "own-mail-events: HTTP $code $(head -c 400 "$out")"
if grep -q '"alert":true' "$out"; then
  echo "own-mail-events: ALERT receivers are blocking our own mail (see blockReasons above and docker logs $container)" >&2
  exit 3
fi
