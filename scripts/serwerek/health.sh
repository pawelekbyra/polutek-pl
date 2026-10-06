#!/bin/bash
# Health check of serwerek (cron every 5 min, /etc/cron.d/serwerek-health). Installed as /opt/serwerek/scripts/health.sh.
# Logs to /var/log/serwerek/health.log; on WARN appends to alerts.log and sends ONE e-mail per issue (at most one per 6 h
# per issue, a pending reboot at most weekly) through Amazon SES SMTP (/etc/serwerek/alert.env, see common.sh). Records telemetry.job_run "health".
# Optional heartbeat to the external watchdog (workers/pp-watchdog): WATCHDOG_PING_URL + WATCHDOG_PING_TOKEN in alert.env.
# Test: SIMULATE_WARN=test /opt/serwerek/scripts/health.sh  (then remove /var/lib/serwerek/alert-state/simulated-test).
here="$(dirname "$(readlink -f "$0")")"
# shellcheck source=common.sh
. "$here/common.sh"

ts=$(date -Is); START=$(date +%s)
disk=$(df / --output=pcent | tail -1 | tr -dc 0-9)
availmb=$(free -m | awk '/Mem:/{print $7}')
swapmb=$(free -m | awk '/Swap:/{print $3}')
load=$(cut -d' ' -f1 /proc/loadavg)
running=$(docker ps --format '{{.Names}}' 2>/dev/null)
down=""
for s in ssh fail2ban ufw docker cloudflared-serwerek; do systemctl is-active --quiet "$s" || down="$down $s"; done
issues=()
[ "$disk" -gt 80 ] && issues+=("disk-over-80pct")
[ "$availmb" -lt 300 ] && issues+=("ram-avail-under-300mb")
[ "$swapmb" -gt 2048 ] && issues+=("swap-over-2gb")
for s in $down; do issues+=("service-down-$s"); done

# App stack: local health, containers (encoder/collector only where configured), public site through Cloudflare.
code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:3000/api/health || echo 000)
[ "$code" = "200" ] || issues+=("app-health-$code")
want="polutek-app-1 polutek-db-1 polutek-redis-1 polutek-srh-1"
[ -f /opt/serwerek/apps/polutek/worker.env ] && want="$want polutek-encoder-1"
[ -f /opt/serwerek/apps/polutek/collector.env ] && want="$want polutek-collector-1"
for c in $want; do grep -qx "$c" <<<"$running" || issues+=("container-down-$c"); done
pub=$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://www.pawelperfect.com/api/health || echo 000)
[ "$pub" = "200" ] || issues+=("public-site-$pub")

# PP Support.
for c in pp-support-web-1 pp-support-sidekiq-1 pp-support-db-1 pp-support-redis-1; do grep -qx "$c" <<<"$running" || issues+=("container-down-$c"); done
cw=$(curl -s -o /dev/null -m 10 -w "%{http_code}" http://127.0.0.1:3010/api || echo 000)
[ "$cw" = "200" ] || issues+=("pp-support-health-$cw")

# Periodic jobs: failed systemd units, last backup (< 26 h), last restore test (< 8 days, once the timer exists).
while read -r unit _; do [ -n "$unit" ] && issues+=("unit-failed-${unit%.service}"); done \
  < <(systemctl list-units --failed --plain --no-legend 'polutek-cron@*' 'serwerek-*' 2>/dev/null)
last_ok() { # $1 = status name, $2 = max age in seconds; prints an issue name or nothing
  local f="$SERWEREK_STATE_DIR/$1-last" when status
  [ -r "$f" ] || { echo "$1-never-ran"; return; }
  read -r when status _ < "$f"
  [ "$status" = ok ] || { echo "$1-failed"; return; }
  (( $(date +%s) - when <= $2 )) || echo "$1-stale"
}
b=$(last_ok backup 93600); [ -n "$b" ] && issues+=("$b")
if systemctl is-enabled --quiet serwerek-restore-test.timer 2>/dev/null; then
  r=$(last_ok restore-test 691200); [ -n "$r" ] && [ "$r" != restore-test-never-ran ] && issues+=("$r")
fi
[ -f /run/reboot-required ] && issues+=("reboot-required")

flag=OK; [ ${#issues[@]} -gt 0 ] && flag=WARN
[ -n "${SIMULATE_WARN:-}" ] && { issues+=("simulated-$SIMULATE_WARN"); flag=WARN; }
summary="disk=${disk}% ram_avail=${availmb}MB swap=${swapmb}MB load=$load down=[${down# }]"
echo "$ts $flag $summary" >> /var/log/serwerek/health.log
if [ "$flag" = "WARN" ]; then
  echo "$ts WARN $summary issues=${issues[*]}" >> /var/log/serwerek/alerts.log
  for i in "${issues[@]}"; do
    every=21600; [ "$i" = reboot-required ] && every=604800
    if send_alert "$i" "[serwerek] WARN: $i" "serwerek WARN: $i
$ts
$summary
Next e-mail for this issue not before $((every / 3600)) h. Log: /var/log/serwerek/alerts.log" "$every"; then
      :
    else
      echo "$ts alert email FAILED: $i" >> /var/log/serwerek/alerts.log
    fi
  done
else
  rm -f "$SERWEREK_STATE_DIR"/alert-state/* 2>/dev/null   # recovered: the next incident alerts at once
fi

job_run health "$([ "$flag" = OK ] && echo ok || echo fail)" "$START" "${issues[*]:-}"
# Heartbeat for the external watchdog: if these stop, the watchdog knows the whole server is gone.
if [ -r /etc/serwerek/alert.env ]; then
  # shellcheck disable=SC1091
  ( . /etc/serwerek/alert.env
    if [ -n "${WATCHDOG_PING_URL:-}" ] && [ -n "${WATCHDOG_PING_TOKEN:-}" ]; then
      printf 'header = "Authorization: Bearer %s"\n' "$WATCHDOG_PING_TOKEN" \
        | curl -fsS -m 10 -K - -X POST "$WATCHDOG_PING_URL" -H 'Content-Type: text/plain' --data "$flag ${issues[*]:-}" >/dev/null 2>&1 || true
    fi )
fi
tail -n 5000 /var/log/serwerek/health.log > /var/log/serwerek/health.log.tmp && mv /var/log/serwerek/health.log.tmp /var/log/serwerek/health.log
exit 0
