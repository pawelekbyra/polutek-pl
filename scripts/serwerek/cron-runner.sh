#!/usr/bin/env bash
# Calls one app cron route on serwerek (replacement for Vercel Crons).
# Usage: cron-runner.sh <route-name>     e.g. stripe-reconciliation
#   route-name is the path after /api/cron/ (lowercase letters, digits, '-', '/').
# Env (from the systemd unit's EnvironmentFile, never printed):
#   CRON_SECRET (required)   CRON_BASE_URL (default http://127.0.0.1:3000)   CRON_TIMEOUT (default 280 s)
# Every run is recorded in telemetry.job_run as "cron:<route-name>" (common.sh, best effort).
set -euo pipefail
here="$(dirname "$(readlink -f "$0")")"
started="$(date +%s)"
record() { # $1 = ok|fail, $2 = detail
  if [[ -r "$here/common.sh" ]]; then
    # shellcheck source=common.sh
    . "$here/common.sh"
    job_run "cron:$name" "$1" "$started" "$2"
  fi
}

name="${1:-}"
if [[ ! "$name" =~ ^[a-z0-9][a-z0-9/-]*$ || "$name" == *..* ]]; then
  echo "usage: $0 <cron-route-name>" >&2
  exit 2
fi
: "${CRON_SECRET:?CRON_SECRET is not set}"
base="${CRON_BASE_URL:-http://127.0.0.1:3000}"
out="$(mktemp)"
trap 'rm -f "$out"' EXIT

# The secret goes through a curl config on stdin, so it never appears in the process list.
if ! code="$(printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" \
  | curl -sS -K - -o "$out" -w '%{http_code}' --max-time "${CRON_TIMEOUT:-280}" "$base/api/cron/$name")"; then
  echo "cron $name: curl failed" >&2
  record fail "curl failed"
  exit 1
fi

if [[ "$code" =~ ^2 ]]; then
  echo "cron $name: HTTP $code"
  record ok "HTTP $code"
else
  echo "cron $name: HTTP $code" >&2
  head -c 500 "$out" >&2 || true
  record fail "HTTP $code"
  exit 1
fi
