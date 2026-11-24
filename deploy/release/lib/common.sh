# Shared helpers for deploy/release/*.sh (sourced, not executed). Docs: docs/operations/RELEASE-PROCESS.md.
# shellcheck shell=bash

RELEASE_LIB="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
RB_HOME="${RB_HOME:-/opt/serwerek/releases}"            # manifests, logs, cost log, bare repo
APP_DIR="${APP_DIR:-/opt/serwerek/apps/polutek}"         # production compose project (deploy.sh, state files, .deploy.lock)
RB_TOKEN_FILE="${RB_TOKEN_FILE:-/root/.ai-secrets/secrets.env}"
RB_TOKEN_VAR="${RB_TOKEN_VAR:-HETZNER_API_TOKEN}"

log() { printf '[%s %s] %s\n' "${LOG_TAG:-release}" "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# Hetzner API token: read from the secrets file into the environment of ONE node process. Never printed, never
# on a command line (it would show in `ps`).
hc() {
  local tok
  tok="$(sed -n -E "s/^(export[[:space:]]+)?${RB_TOKEN_VAR}=//p" "$RB_TOKEN_FILE" 2>/dev/null | tail -n 1 | tr -d "\"'\r")"
  [[ -n "$tok" ]] || { log "ERROR: ${RB_TOKEN_VAR} not found in ${RB_TOKEN_FILE}" >&2; return 1; }
  HCLOUD_TOKEN="$tok" RB_PROD_IP="${RB_PROD_IP:-}" node "$RELEASE_LIB/hcloud.mjs" "$@"
}

# jget <json> <js expression on `d`>: tiny JSON reader (no jq on the server).
jget() { node -e 'const d=JSON.parse(process.argv[1]); const v=(new Function("d","return ("+process.argv[2]+")"))(d); process.stdout.write(v===undefined||v===null?"":(typeof v==="object"?JSON.stringify(v):String(v)))' "$1" "$2"; }

free_gb() { df -BG --output=avail "${1:-/}" | tail -n 1 | tr -dc '0-9'; }

# Run the calling script detached from the terminal (survives a dropped SSH session) with a log file, and follow
# the log. Ctrl+C stops only the follow, not the job. The job writes its exit code to "<log>.rc".
#   detach_self <logfile> "$@"   (no-op when already detached or RELEASE_FOREGROUND=1)
detach_self() {
  local logfile="$1"; shift
  [[ "${RELEASE_DETACHED:-}" == "1" || "${RELEASE_FOREGROUND:-}" == "1" ]] && return 0
  mkdir -p "$(dirname "$logfile")"
  : > "$logfile"; rm -f "$logfile.rc"
  RELEASE_DETACHED=1 RELEASE_LOG="$logfile" setsid nohup "$(readlink -f "$0")" "$@" >>"$logfile" 2>&1 </dev/null &
  local pid=$!
  printf 'running in background (pid %s), log: %s\n(Ctrl+C stops only this view; the job keeps running)\n' "$pid" "$logfile"
  tail --pid="$pid" -n +1 -f "$logfile" 2>/dev/null || true
  local rc; rc="$(cat "$logfile.rc" 2>/dev/null || echo 1)"
  exit "$rc"
}

# Called from the EXIT trap of a detached job.
write_rc() { [[ -n "${RELEASE_LOG:-}" ]] && printf '%s\n' "$1" > "$RELEASE_LOG.rc"; return 0; }

# Same telemetry row as deploy.sh (telemetry.job_run), best effort.
record_job() { # $1 job, $2 ok|fail, $3 started epoch, $4 detail
  local common="${SERWEREK_COMMON:-/opt/serwerek/scripts/common.sh}"
  if [[ -r "$common" ]]; then
    # shellcheck disable=SC1090
    ( . "$common" && job_run "$1" "$2" "$3" "$4" ) || true
  fi
  return 0
}
