#!/bin/bash
# OnFailure= handler (serwerek-alert@.service): one e-mail when a systemd unit of ours fails.
# Same throttle key as health.sh ("unit-failed-<unit>"), so one failure gives one e-mail, not two.
# Usage: unit-failed.sh <unit-name>     Installed as /opt/serwerek/scripts/unit-failed.sh.
set -uo pipefail
here="$(dirname "$(readlink -f "$0")")"
# shellcheck source=common.sh
. "$here/common.sh"
unit="${1:?unit name}"
unit="${unit%.service}"
send_alert "unit-failed-$unit" "[serwerek] FAILED: $unit" "systemd unit $unit failed at $(date -Is).
Details: journalctl -u $unit.service -n 50
Status of all jobs: systemctl list-timers 'polutek-cron-*' 'serwerek-*'"
