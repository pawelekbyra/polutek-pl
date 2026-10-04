#!/usr/bin/env python3
"""Host status for the admin panel, WITHOUT giving the panel the Docker socket.

Runs on the host as root every minute (admin-host-status.timer) and writes ONE JSON file,
/var/lib/serwerek/host-status/status.json (atomic rename, mode 644). The panel container mounts that
directory read-only and can only read it; nothing in the panel can start, stop or inspect containers.
Format (version 1) is validated by lib/modules/admin-overview/infrastructure/host-status-file.ts.
The phase-0 collector (pp-collector / job_run) may replace this job later and write the same file.
Python 3 standard library only. Docs: docs/operations/ADMIN-PANEL.md, section "Status hosta".
"""
import datetime as dt
import glob
import json
import os
import re
import subprocess

OUT_DIR = os.environ.get("HOST_STATUS_DIR", "/var/lib/serwerek/host-status")
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/opt/serwerek/backups")
BACKUP_LOG = os.environ.get("BACKUP_LOG", "/var/log/serwerek/backup.log")
HEALTH_LOG = os.environ.get("HEALTH_LOG", "/var/log/serwerek/health.log")
TIMER_PREFIX = "polutek-cron-"


def run(args, timeout=20):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False).stdout
    except (OSError, subprocess.TimeoutExpired):
        return ""


def iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).isoformat().replace("+00:00", "Z") if ts else None


def parse_size(text):
    """'138.5MiB' -> bytes."""
    m = re.match(r"([\d.]+)\s*([KMGT]?i?B)", text or "")
    if not m:
        return None
    mult = {"B": 1, "KB": 1e3, "MB": 1e6, "GB": 1e9, "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3, "TiB": 1024**4}
    return int(float(m.group(1)) * mult.get(m.group(2), 1))


def containers():
    ids = run(["docker", "ps", "-aq"]).split()
    if not ids:
        return []
    stats = {}
    for line in run(["docker", "stats", "--no-stream", "--format", "{{json .}}"], timeout=40).splitlines():
        try:
            s = json.loads(line)
            used, _, limit = s.get("MemUsage", "").partition(" / ")
            stats[s.get("Name")] = (parse_size(used), parse_size(limit), float(s.get("CPUPerc", "0").rstrip("%") or 0))
        except (ValueError, KeyError):
            continue
    out = []
    try:
        inspected = json.loads(run(["docker", "inspect", *ids]) or "[]")
    except ValueError:
        inspected = []
    for c in inspected:
        name = c.get("Name", "").lstrip("/")
        state = c.get("State", {})
        mem, limit, cpu = stats.get(name, (None, None, None))
        started = state.get("StartedAt")
        out.append({
            "name": name[:120],
            "state": state.get("Status", "unknown")[:40],
            "health": (state.get("Health") or {}).get("Status"),
            "memBytes": mem,
            "memLimitBytes": c.get("HostConfig", {}).get("Memory") or limit,
            "cpuPercent": cpu,
            "restarts": c.get("RestartCount"),
            "image": (c.get("Config", {}).get("Image") or "")[:300] or None,
            "startedAt": started if started and not started.startswith("0001") else None,
        })
    return sorted(out, key=lambda x: x["name"])


def show(unit, props):
    text = run(["systemctl", "show", unit, "--timestamp=unix", "-p", ",".join(props)])
    return dict(line.split("=", 1) for line in text.splitlines() if "=" in line)


def unix(value):
    m = re.match(r"@(\d+)", value or "")
    return int(m.group(1)) if m else None


def timers():
    out = []
    for path in sorted(glob.glob(f"/etc/systemd/system/{TIMER_PREFIX}*.timer")):
        name = os.path.basename(path)[len(TIMER_PREFIX):-len(".timer")]
        t = show(os.path.basename(path), ["LastTriggerUSec", "NextElapseUSecRealtime"])
        svc = show(f"polutek-cron@{name}.service", ["Result", "ExecMainExitTimestamp"])
        last = unix(svc.get("ExecMainExitTimestamp")) or unix(t.get("LastTriggerUSec"))
        out.append({"name": name, "lastRunAt": iso(last), "lastResult": svc.get("Result") or None, "nextRunAt": iso(unix(t.get("NextElapseUSecRealtime")))})
    # The two root cron jobs (SERWEREK.md section 4): their logs are the evidence.
    for name, log in (("backup.sh", BACKUP_LOG), ("health.sh", HEALTH_LOG)):
        if os.path.exists(log):
            result = "success"
            if name == "backup.sh":
                tail = run(["tail", "-n", "20", log])
                fails = re.findall(r"fail=(\d+)", tail)
                result = "success" if not fails or fails[-1] == "0" else "failed"
            out.append({"name": name, "lastRunAt": iso(int(os.path.getmtime(log))), "lastResult": result, "nextRunAt": None})
    return out


def backups():
    files = [f for f in glob.glob(os.path.join(BACKUP_DIR, "*")) if os.path.isfile(f) and not f.endswith(".md")]
    dumps = [f for f in files if "pre-deploy" not in os.path.basename(f)]
    if not dumps:
        return {"latestAt": None, "latestBytes": None, "count": 0, "offsite": None}
    newest = max(dumps, key=os.path.getmtime)
    return {
        "latestAt": iso(int(os.path.getmtime(newest))),
        "latestBytes": os.path.getsize(newest),
        "count": len(dumps),
        "offsite": "R2 serwerek-backups (backup.sh, 14 dni)",
    }


def main():
    status = {
        "version": 1,
        "generatedAt": iso(int(dt.datetime.now(dt.timezone.utc).timestamp())),
        "containers": containers(),
        "timers": timers(),
        "backups": backups(),
    }
    os.makedirs(OUT_DIR, mode=0o755, exist_ok=True)
    tmp = os.path.join(OUT_DIR, ".status.json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False)
    os.chmod(tmp, 0o644)
    os.replace(tmp, os.path.join(OUT_DIR, "status.json"))


if __name__ == "__main__":
    main()
