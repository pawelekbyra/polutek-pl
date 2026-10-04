# Load test (guest, read-only)

Measures how many new guest visitors per minute the production server (serwerek) handles before
response times degrade. Results and method: `docs/operations/LOAD-TEST.md`.

## Safety rules (built into the scripts)

- The generator (k6 in a throw-away container, `--cpus 0.5 --memory 256m`, `--network host`) runs **on the
  server** against `http://127.0.0.1:3000` with `Host: www.pawelperfect.com`. Never through Cloudflare.
- Guest GET requests only: `/pl`, `/api/channel/sidebar`, `/api/comments`, `/api/media-source/<id>`,
  `/api/videos/<id>/thumbnail`. No logins, writes, payments, `/api/admin`, PP Support.
- Every request carries `User-Agent: pp-loadtest/1` and a fake `CF-Connecting-IP` from `198.18.0.0/15`
  (RFC 2544 benchmark range), so each iteration looks like a new visitor (the app trusts that header behind the
  tunnel). `/api/media-source` creates one `VideoPlaybackSession` row per call; `cleanup.sh` deletes exactly
  those rows (`userAgentHash = sha256('pp-loadtest/1')`, guest).
- `preflight.sh` refuses to start a step during a deploy (`deploy.sh`), an encode (`VideoEncodeJob`
  RUNNING/QUEUED), with < 600 MB available memory or load1 > 3.
- `guard.sh` samples every ~5 s (memory, swap, load, `docker stats`, `pg_stat_activity`) into `monitor.csv`
  and kills the generator when: MemAvailable < 400 MB, swap used > 3 GB, load1 > 6 for 20 s, or
  `polutek-app-1` restarted. k6 itself aborts at > 2% 5xx/timeouts; `run-steps.sh` ends a series at the
  first saturated step or p95 > `STOP_P95_MS` (default 2000 ms).

## Run

```bash
# from the repo, copy the scripts to the server
scp -r scripts/loadtest serwerek:/tmp/pp-loadtest
ssh serwerek
AI_AGENT=claude-loadtest ai-log "load test start (guest read-only, 127.0.0.1:3000)"
cd /tmp/pp-loadtest && chmod +x *.sh *.py
export OUT_DIR=/tmp/pp-loadtest/out K6_IMAGE=grafana/k6:1.3.0
export VIDEO_ID=<id of a PUBLISHED, PUBLIC video without upcoming premiere>
nohup ./guard.sh >/dev/null 2>&1 &         # keep running for the whole test

./run-steps.sh journey 0.5 0.5             # smoke test (set STEP_SECONDS=15)
./run-steps.sh journey 2 64                # main series: 2, 4, 8, ... journeys/s, 60 s each, 30 s pause
./run-steps.sh home 4 64                   # single endpoints (start at a rate the journey already proved safe)
./run-steps.sh sidebar 4 256
./count-queries.sh home 50                 # DB transactions/rows per request (also: sidebar, comments, media, thumb)
column -t -s $'\t' out/results.tsv
```

Cold start: `docker restart polutek-app-1`, wait for `healthy`, restart `guard.sh` (it treats a restart as a
fuse), then one journey step at a known-safe rate.

## Clean up (always)

```bash
./cleanup.sh                   # stops guard, deletes the test sessions, removes the k6 image
rm -rf /tmp/pp-loadtest
curl -s -o /dev/null -w '%{http_code}\n' https://www.pawelperfect.com/api/health   # 200
AI_AGENT=claude-loadtest ai-log "load test end, cleaned up"
```
