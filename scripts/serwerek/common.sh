# shellcheck shell=bash
# Shared helpers of the serwerek host scripts. Installed next to them in /opt/serwerek/scripts; source, do not run.
# Docs: docs/operations/SERWEREK.md (section 23).

SERWEREK_DB_CONTAINER="${SERWEREK_DB_CONTAINER:-polutek-db-1}"
SERWEREK_STATE_DIR="${SERWEREK_STATE_DIR:-/var/lib/serwerek}"

# job_run <job> <ok|fail> <started-epoch-seconds> [detail]
# One row in telemetry.job_run (read by the admin panel). Best effort: never fails and never blocks the caller
# for long (no database, schema not migrated yet, container down: silently skipped).
job_run() {
  local job="$1" status="$2" started="$3" detail="${4:-}" now
  now=$(date +%s)
  timeout 15 docker exec -i "$SERWEREK_DB_CONTAINER" sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt -v ON_ERROR_STOP=1 "$@"' sh \
    -v job="$job" -v status="$status" -v started="$started" -v dur="$(( (now - started) * 1000 ))" \
    -v detail="${detail:0:2000}" -v host="$(hostname)" >/dev/null 2>&1 <<'SQL' || true
insert into telemetry.job_run (job, status, started_at, finished_at, duration_ms, detail, host)
values (:'job', :'status', to_timestamp(:'started'::bigint), now(), :'dur'::int, nullif(:'detail', ''), :'host');
SQL
}

# write_status <name> <ok|fail> [detail]: last result of a job in /var/lib/serwerek/<name>-last ("<epoch> <status> <detail>").
write_status() {
  mkdir -p "$SERWEREK_STATE_DIR"
  printf '%s %s %s\n' "$(date +%s)" "$2" "${3:-}" > "$SERWEREK_STATE_DIR/$1-last"
}

# send_alert <key> <subject> <text> [min-seconds-between, default 21600]
# One e-mail, at most once per key per interval. Returns 0 when sent or throttled.
# Provider from /etc/serwerek/alert.env (default resend, so nothing changes until the owner flips it):
#   ALERT_PROVIDER=resend  RESEND_API_KEY, ALERT_TO, ALERT_FROM          (Resend HTTP API)
#   ALERT_PROVIDER=ses     SES_SMTP_USER, SES_SMTP_PASS, ALERT_TO, ALERT_FROM, optional AWS_REGION (default eu-north-1)
#                          (Amazon SES SMTP, port 587 STARTTLS; docs/operations/EMAIL_SES.md)
send_alert() {
  local key="$1" subject="$2" text="$3" every="${4:-21600}" state now last payload
  [[ -r /etc/serwerek/alert.env ]] || { echo "send_alert: no /etc/serwerek/alert.env" >&2; return 1; }
  mkdir -p "$SERWEREK_STATE_DIR/alert-state"
  state="$SERWEREK_STATE_DIR/alert-state/$key"
  now=$(date +%s); last=$(cat "$state" 2>/dev/null || echo 0)
  (( now - last >= every )) || return 0
  # shellcheck disable=SC1091
  ( . /etc/serwerek/alert.env
    if [[ "${ALERT_PROVIDER:-resend}" == "ses" ]]; then
      # Credentials stay in the environment of this one process; never on a command line.
      export ALERT_FROM ALERT_TO SES_SMTP_USER SES_SMTP_PASS
      ALERT_SUBJECT="$subject" ALERT_TEXT="$text" AWS_REGION="${AWS_REGION:-}" python3 - <<'PY'
import os, smtplib
from email.message import EmailMessage
msg = EmailMessage()
msg["From"], msg["To"], msg["Subject"] = os.environ["ALERT_FROM"], os.environ["ALERT_TO"], os.environ["ALERT_SUBJECT"]
msg["Auto-Submitted"] = "auto-generated"
msg.set_content(os.environ["ALERT_TEXT"])
region = os.environ.get("AWS_REGION") or "eu-north-1"
with smtplib.SMTP(f"email-smtp.{region}.amazonaws.com", 587, timeout=20) as s:
    s.starttls()
    s.login(os.environ["SES_SMTP_USER"], os.environ["SES_SMTP_PASS"])
    s.send_message(msg)
PY
    else
      payload=$(python3 -c 'import json,sys; print(json.dumps({"from": sys.argv[1], "to": [sys.argv[2]], "subject": sys.argv[3], "text": sys.argv[4]}))' \
        "$ALERT_FROM" "$ALERT_TO" "$subject" "$text")
      printf 'header = "Authorization: Bearer %s"\n' "$RESEND_API_KEY" \
        | curl -fsS -m 20 -K - -X POST https://api.resend.com/emails -H 'Content-Type: application/json' -d "$payload" >/dev/null
    fi
  ) && echo "$now" > "$state"
}
