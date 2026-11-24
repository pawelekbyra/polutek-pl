#!/usr/bin/env bash
# Delete orphaned release builders in Hetzner Cloud (servers, firewalls, SSH keys labelled
# managed-by=polutek-release,role=builder). Never touches anything without those labels and the "polutek-rb-" name
# prefix, and never the server with this machine's IPv4. release-build.sh runs the expired-only variant at start.
# Usage:
#   release-gc.sh               delete builders whose TTL (label "expires") has passed
#   release-gc.sh --all         delete ALL builders (no release-build.sh may be running)
#   release-gc.sh --list        show what exists (also unassigned primary IPs, volumes, floating IPs), change nothing
#   release-gc.sh --dry-run     show what would be deleted
# Suggested timer (not installed by this script): every 30 min, `release-gc.sh >> /opt/serwerek/releases/logs/gc.log`.
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/lib/common.sh"
LOG_TAG=gc
RB_PROD_IP="${RB_PROD_IP:-$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p')}"
export RB_PROD_IP
case "${1:-}" in
  --list) hc inventory ;;
  --dry-run) hc gc --dry-run ;;
  --all)
    if [[ -e "$RB_HOME/.build.lock" ]] && ! flock -n "$RB_HOME/.build.lock" true; then die "a release-build is running; not deleting all builders"; fi
    hc gc --all ;;
  "") hc gc ;;
  *) die "usage: $0 [--all|--list|--dry-run]" ;;
esac
