# Load test (guest, read-only)

Measures how many new guest visitors per minute the production server (serwerek) handles before
response times degrade. Results and method: `docs/operations/LOAD-TEST.md`.

## Safety rules (built into the scripts)

- The generator (k6 in a throw-away container, `--cpus 0.5 --memory 256m`, `--network host`) runs **on the
  server** against `http://127.0.0.1:3000` with `Host: www.pawelperfect.com`. Never through Cloudflare.
- Guest GET requests only: `/pl`, `/api/channel/sidebar`, `/api/comments`, `/api/media-source/<id>`,
  `/api/videos/<id>/thumbnail`. No logins, writes, payments, `/api/admin`, PP Support.
- Each 200 response must have the expected MIME type (HTML for home, JSON for APIs, image for thumbnail);
  non-200 and wrong/missing MIME metrics make the summarizer stop the series. The three small JSON APIs
  (`sidebar`, `comments`, `media`) selectively return text to k6 and are checked for their required response
  shape; page HTML and image bodies remain discarded to cap generator memory. The checks validate only the
  JSON fields needed to prove a usable public page/playback plan, not all domain fields or media decoding.
- Every run gets a unique `User-Agent: pp-loadtest/<uuid>` saved in `OUT_DIR/client-user-agent` and a fake `CF-Connecting-IP` from `198.18.0.0/15`
  (RFC 2544 benchmark range), so each iteration looks like a new visitor (the app trusts that header behind the
  tunnel). `/api/media-source` creates one `VideoPlaybackSession` row per call. `cleanup.sh` asks the running
  app container to derive the exact HMAC using its configured client-hash secret and deletes only guest rows
  matching this run's unique user-agent hash. The secret never leaves the app container. Missing/invalid
  identity, unavailable app, HMAC failure, database failure or an active runner stop cleanup before deletion.
  Both `run-steps.sh` and `count-queries.sh` take the same exclusive per-OUT_DIR lock and share the same unique
  user-agent identity; cleanup refuses to run while either is active. Clean up only after all measurements finish.
  If a runner was killed with SIGKILL, verify no `run-steps.sh`/`count-queries.sh`/k6 process is active before manually removing
  the stale `.run-lock`; the scripts never clear it automatically.
- `preflight.sh` refuses to start a step during a deploy (`deploy.sh`), an encode (`VideoEncodeJob`
  RUNNING/QUEUED), with < 600 MB available memory or load1 > 3.
- `guard.sh` samples every ~5 s (memory, swap, load, `docker stats`, `pg_stat_activity`) into `monitor.csv`
  and kills the generator when: MemAvailable < 400 MB, swap grew > 1 GB over its value at guard start
  (`SWAP_GROWTH_FUSE_MB`), load1 > 6 for 20 s, `polutek-app-1` restarted, or `polutek-app-1` memory
  > 900 MiB (`APP_MEM_FUSE_MIB`; the container limit is 1 GiB). It exits by itself after `GUARD_MAX_SECONDS`
  (1 h). k6 itself aborts at > 2% 5xx/timeouts; `run-steps.sh` ends a series at the first saturated step or
  p95 > `STOP_P95_MS` (default 2000 ms) and waits (up to 2 min) for the host to calm down between series.
- Each `run-steps.sh` series writes `<LABEL>-profile.json`; `count-queries.sh` writes a fixed-count profile next to its output with its profile version, target, exact rate schedule, duration/rest, endpoint mix, k6 image reference and SHA-256 hashes of the generator, response probe and cleanup scripts. `results.tsv` and each `queries.tsv` result record that profile hash. An existing label cannot be reused for a different profile; `count-queries.sh` records exact N iterations, not throughput; choose a new `LABEL` or `OUT_DIR`. For `journey`, rate means new guest journeys per second (five requests per iteration); single-endpoint targets mean requests per second. Neither is a count of concurrent viewers. The label does not prove cache state; the profile records cache state as unspecified.
- Before either runner measures a target that includes home or thumbnail, `response-probe.py` makes one separate loopback GET per relevant endpoint. It accepts numeric loopback targets only, reads at most 64 KiB plus one sentinel byte, checks for an HTML document marker or a supported image signature matching the MIME type, and closes the response; this traffic is outside k6 timing and results. Redirects are refused. It does not decode the image, validate the whole HTML, or establish that the full asset is usable. `profile.json` records the request target (with a SHA-256 of the video ID), whether the probe runs, the fixed bound, its result filename, and the source hash; results are appended as JSONL.

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

STEP_SECONDS=15 LABEL=smoke ./run-steps.sh journey 1 1     # smoke test
./run-steps.sh journey 2 64                # main series: 2, 4, 8, ... journeys/s, 60 s each, 30 s pause
STOP_P95_MS=1000 ./run-steps.sh home 16 64 # single endpoints start at a rate the journey already proved safe
./count-queries.sh home 100                # DB transactions/rows per request (also: sidebar, comments, media, thumb, journey)
column -t -s $'\t' out/results.tsv
```

The full step plan of the 2026-10-04 baseline is in `docs/operations/LOAD-TEST.md` ("Jak powtórzyć").

Cold start: `docker restart polutek-app-1`, wait for `healthy`, restart `guard.sh` (it treats a restart as a
fuse), then one journey step at a known-safe rate.

## Clean up (always)

```bash
./cleanup.sh                   # stops guard, deletes only this run's sessions, removes the k6 image
rm -rf /tmp/pp-loadtest
curl -s -o /dev/null -w '%{http_code}\n' https://www.pawelperfect.com/api/health   # 200
AI_AGENT=claude-loadtest ai-log "load test end, cleaned up"
```
