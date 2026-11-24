#!/usr/bin/env bash
# Build release images on a TEMPORARY Hetzner Cloud machine and stream them straight into Docker on this server.
# No registry, no GitHub Actions. The machine is deleted at the end, also on error / Ctrl+C / lost SSH (trap) and,
# as a last resort, by a TTL watchdog and by release-gc.sh. Docs: docs/operations/RELEASE-PROCESS.md.
#
# Usage (on the production server, as root):
#   deploy/release/release-build.sh <git-sha|ref>            full build: npm ci gate + app, migrator, worker, collector
#   deploy/release/release-build.sh <git-sha|ref> --probe    small test: tiny alpine image -> release-probe:test, no app build
# Result: $RB_HOME/<tag>/manifest.json (+ .sha256) and the images polutek-*:<tag> loaded locally (not started).
#   Next step: deploy/release/release-deploy.sh $RB_HOME/<tag>/manifest.json
#
# Nothing secret leaves this server: the builder gets `git archive` of the commit (tracked files only) and the
# PUBLIC build args from build.env that are on the allowlist below. The only credential on the builder is its own
# one-time SSH key. The Hetzner token stays here (lib/common.sh: hc).
#
# Settings (env): RB_HOME, RB_REPO (git repo with the commit; default $RB_HOME/repo.git, cloned from RB_GIT_URL),
#   RB_FETCH=1, RB_ALLOW_NOT_MAIN=0, RB_BUILD_ENV (default $APP_DIR/build.env), RB_SERVER_TYPE (force a type),
#   RB_LOCATION (default: location of this server), RB_MIN_CORES=4, RB_MIN_MEM_GB=8, RB_TTL_MIN=90,
#   RB_PROD_IP (default: this server's public IPv4), RB_EXTRA_SSH_CIDRS (comma list), RB_GATE (default: npm ci),
#   RB_MIN_FREE_GB=8, RB_DOCKER_MATCH=1 (install the same Docker version as here), RB_LOAD_RATE (e.g. 50m, needs pv).
# Trial runs (T3): RB_NO_LOAD=1 builds and compresses the images on the builder (size and time measured) but sends
#   nothing to this server: no docker load, no manifest (summary in $RB_HOME/<tag>/no-load.json).
#   RB_VM_CHECK=<file> runs that bash script on the builder after the images are built (env TAG, SHA; output in
#   $RB_HOME/logs/vmcheck-<run>.log; its exit code is logged, it does not fail the build).
#   The builder's RAM is sampled every 2 s (free -m); the peak is logged and kept in timings.
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/lib/common.sh"
LOG_TAG=build

ref="${1:-}"; mode=full
[[ "${2:-}" == "--probe" ]] && mode=probe
[[ -n "$ref" ]] || die "usage: $0 <git-sha|ref> [--probe]"
[[ "$ref" =~ ^[A-Za-z0-9._/-]+$ ]] || die "bad ref '$ref'"

run="${RB_RUN:-$(printf '%s' "${ref//[^A-Za-z0-9]/}" | tr 'A-Z' 'a-z' | cut -c1-8)-$(date -u +%m%d%H%M%S)}"
export RB_RUN="$run"
detach_self "$RB_HOME/logs/build-$run.log" "$@"
# from here on: detached (or RELEASE_FOREGROUND=1)

RB_REPO="${RB_REPO:-$RB_HOME/repo.git}"
RB_GIT_URL="${RB_GIT_URL:-git@github-codex:pawelekbyra/polutek-pl.git}"
RB_BUILD_ENV="${RB_BUILD_ENV:-$APP_DIR/build.env}"
RB_TTL_MIN="${RB_TTL_MIN:-90}"
RB_MIN_FREE_GB="${RB_MIN_FREE_GB:-8}"
RB_GATE="${RB_GATE:-npm ci --no-audit --no-fund}"
RB_PROD_IP="${RB_PROD_IP:-$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p')}"
export RB_PROD_IP
# Public build args the Dockerfile declares (deploy/serwerek/Dockerfile, stage "build"). Anything else in build.env
# is NOT sent. Publishable Stripe keys (pk_...) are public by design; secret-looking values abort the build.
ALLOWED_ARGS=(NEXT_PUBLIC_APP_URL NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY
  NEXT_PUBLIC_R2_PUBLIC_HOST NEXT_PUBLIC_APP_NAME NEXT_PUBLIC_SUPPORT_EMAIL NEXT_PUBLIC_SITE_BETA
  NEXT_PUBLIC_PLATFORM_VAT_STATUS NEXT_PUBLIC_BLOB_PUBLIC_HOST)

started=$(date +%s)
work="$(mktemp -d /run/release-build.XXXXXX)"; chmod 700 "$work"
facts="$work/facts"; mkdir "$facts"
created_attempt=0; destroyed=0; cost_done=0; location=""; watchdog_pid=""; t_create=0; t_destroyed=0; builder_json=""; result="FAILED"

destroy_builder() {
  local out rc=0
  out="$(hc destroy --run "$run")" || rc=$?
  t_destroyed=$(date +%s); destroyed=1
  log "destroy: $out"
  if (( rc != 0 )); then log "!!! RESOURCES MAY BE LEFT for run $run: run deploy/release/release-gc.sh --all and check the Hetzner console"; return 1; fi
  return 0
}

# Cost = machine lifetime x hourly price from the API (server type + primary IPv4). Logged and kept in costs.log.
compute_cost() { # $1 = exit status so far
  local secs type cost
  cost_done=1
  secs=$(( t_destroyed > 0 ? t_destroyed - t_create : $(date +%s) - t_create ))
  type="$(jget "$builder_json" 'd.name')"; [[ -n "$type" ]] || return 0
  cost="$(hc cost --type "$type" --location "$location" --seconds "$secs" 2>/dev/null)" || return 0
  log "cost: $cost"
  printf '%s
' "$cost" > "$facts/cost.json"
  printf '%s run=%s mode=%s type=%s seconds=%s exact_eur=%s billed_eur=%s result=%s
' "$(date -u +%FT%TZ)" "$run" "$mode"     "$type" "$secs" "$(jget "$cost" 'd.exact_gross_eur')" "$(jget "$cost" 'd.billed_gross_eur')" "$([[ ${1:-0} == 0 ]] && echo ok || echo fail)" >> "$RB_HOME/costs.log"
}

# Watchdog first, then its sleep (pids taken before, so the sleep is not orphaned and does not keep the build lock
# open). Killing the sleep first let the watchdog run on into its "TTL reached" branch. `wait` returns 143 for the
# killed watchdog: that must not trip `set -e` (it used to end every successful build with exit 143, no manifest).
stop_watchdog() {
  [[ -n "$watchdog_pid" ]] || return 0
  local kids
  kids="$(pgrep -P "$watchdog_pid" 2>/dev/null || true)"
  kill "$watchdog_pid" 2>/dev/null || true
  if [[ -n "$kids" ]]; then kill $kids 2>/dev/null || true; fi
  wait "$watchdog_pid" 2>/dev/null || true
  watchdog_pid=""
  return 0
}

cleanup() {
  local rc=$?
  set +e
  stop_watchdog
  if (( created_attempt && !destroyed )); then log "cleanup: deleting the builder (exit code $rc)"; destroy_builder || rc=1; fi
  (( t_create && !cost_done )) && compute_cost "$rc"
  rm -rf "$work"
  if (( rc == 0 )); then log "DONE ($mode) in $(( $(date +%s) - started )) s"; else log "FAILED ($mode), exit $rc"; fi
  record_job release-build "$([[ $rc == 0 ]] && echo ok || echo fail)" "$started" "run $run mode $mode ref $ref rc $rc"
  write_rc "$rc"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT; trap 'exit 143' TERM; trap 'exit 129' HUP

mkdir -p "$RB_HOME/logs"
exec 8>"$RB_HOME/.build.lock"
flock -n 8 || die "another release-build is running ($RB_HOME/.build.lock)"

log "run $run, mode $mode, ref $ref, production IP ${RB_PROD_IP:-?}"
[[ -n "$RB_PROD_IP" ]] || die "cannot detect this server's IPv4 (set RB_PROD_IP)"

# 0. Orphans from earlier runs (expired TTL) are removed first.
log "gc: removing expired builders"
hc gc >/dev/null || log "WARN: gc failed (continuing)"

# 1. Disk on this server: the images land here.
free="$(free_gb /)"
(( free >= RB_MIN_FREE_GB )) || die "only ${free} GB free on / (need ${RB_MIN_FREE_GB} GB): clean up first (docker image prune, docker builder prune)"
log "disk: ${free} GB free"

# 2. Source: exact commit from the repo, must be on main.
if [[ ! -d "$RB_REPO" ]]; then log "cloning $RB_GIT_URL -> $RB_REPO"; git clone -q --mirror "$RB_GIT_URL" "$RB_REPO"; fi
if [[ "${RB_FETCH:-1}" == "1" ]]; then git -C "$RB_REPO" fetch -q --prune origin 2>/dev/null || git -C "$RB_REPO" fetch -q --prune || die "git fetch failed"; fi
sha="$(git -C "$RB_REPO" rev-parse --verify -q "$ref^{commit}")" || die "commit $ref not found in $RB_REPO"
main_ref="$(git -C "$RB_REPO" rev-parse --verify -q origin/main || git -C "$RB_REPO" rev-parse --verify -q refs/heads/main || true)"
if [[ "${RB_ALLOW_NOT_MAIN:-0}" != "1" ]]; then
  [[ -n "$main_ref" ]] && git -C "$RB_REPO" merge-base --is-ancestor "$sha" "$main_ref" || die "$sha is not on main (RB_ALLOW_NOT_MAIN=1 to override)"
fi
tag="${sha:0:8}-b$(date -u +%y%m%d%H%M)"
if [[ "$mode" == probe ]]; then
  refs_json='{"probe":"release-probe:test"}'
else
  refs_json="{\"app\":\"polutek-app:$tag\",\"migrator\":\"polutek-migrator:$tag\",\"worker\":\"polutek-worker:$tag\",\"collector\":\"polutek-collector:$tag\"}"
fi
mapfile -t refs < <(jget "$refs_json" 'Object.values(d).join("\n")')
log "commit $sha, tag $tag"

# 3. Public build args (explicit allowlist) -> build-args file for the builder.
: > "$work/build-args"; chmod 600 "$work/build-args"
if [[ "$mode" == full ]]; then
  [[ -f "$RB_BUILD_ENV" ]] || die "missing $RB_BUILD_ENV"
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    k="${line%%=*}"; v="${line#*=}"; v="${v%$'\r'}"; v="${v#\"}"; v="${v%\"}"
    if ! printf '%s\n' "${ALLOWED_ARGS[@]}" | grep -qxF -- "$k"; then log "build.env: $k is not on the allowlist, NOT sent"; continue; fi
    [[ "$v" =~ ^(sk_|rk_|whsec_) ]] && die "build.env: $k looks like a secret, refusing to send it"
    printf '%s=%s\n' "$k" "$v" >> "$work/build-args"
  done < "$RB_BUILD_ENV"
fi
node -e 'const fs=require("fs"),c=require("crypto");const b=fs.readFileSync(process.argv[1]);const names=b.toString().split("\n").filter(Boolean).map(l=>l.split("=")[0]);process.stdout.write(JSON.stringify({names,sha256:c.createHash("sha256").update(b).digest("hex")}))' "$work/build-args" > "$facts/build-args.json"
log "build args: $(jget "$(cat "$facts/build-args.json")" 'd.names.join(" ")||"(none)"')"

# 4. One-time keys: client key (registered in Hetzner, deleted with the run) and host key (pinned, no TOFU).
ssh-keygen -q -t ed25519 -N '' -C "polutek-rb-$run" -f "$work/id"
ssh-keygen -q -t ed25519 -N '' -C "host-$run" -f "$work/host"

# 5. Server type, location, cloud-init.
location="${RB_LOCATION:-$(jget "$(hc locate-ip --ip "$RB_PROD_IP")" 'd.location')}"
builder_json="$(hc pick-type --location "$location" --min-cores "${RB_MIN_CORES:-4}" --min-mem "${RB_MIN_MEM_GB:-8}" ${RB_SERVER_TYPE:+--type "$RB_SERVER_TYPE"})"
log "builder type: $builder_json"
docker_pin=""
if [[ "${RB_DOCKER_MATCH:-1}" == "1" ]]; then docker_pin="5:$(docker version --format '{{.Server.Version}}')-1~ubuntu.24.04~noble"; fi
{
  printf '#cloud-config\nssh_deletekeys: true\nssh_genkeytypes: []\nssh_keys:\n  ed25519_private: |\n'
  sed 's/^/    /' "$work/host"
  printf '  ed25519_public: %s\n' "$(cut -d' ' -f1-2 "$work/host.pub")"
  cat <<EOF
package_update: true
packages: [zstd, ca-certificates, curl]
write_files:
  - path: /etc/docker/daemon.json
    content: '{"features":{"containerd-snapshotter":true},"log-driver":"local"}'
runcmd:
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update -q
  - sh -c 'P="$docker_pin"; export DEBIAN_FRONTEND=noninteractive; if [ -n "\$P" ] && apt-get install -yq docker-ce="\$P" docker-ce-cli="\$P" containerd.io docker-buildx-plugin; then echo pinned; else apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin; fi'
  - systemctl enable --now docker
  - touch /run/rb-ready
EOF
} > "$work/user-data"

allow="$RB_PROD_IP/32${RB_EXTRA_SSH_CIDRS:+,$RB_EXTRA_SSH_CIDRS}"
log "creating builder polutek-rb-$run ($location, ssh only from $allow, ttl ${RB_TTL_MIN} min)"
created_attempt=1; t_create=$(date +%s)
info="$(hc create --run "$run" --name "polutek-rb-$run" --type "$(jget "$builder_json" 'd.name')" --location "$location" \
  --image ubuntu-24.04 --user-data "$work/user-data" --ssh-pubkey "$work/id.pub" --allow-cidrs "$allow" --ttl-min "$RB_TTL_MIN")"
ip="$(jget "$info" 'd.ip')"
log "builder running: $info"
t_running=$(date +%s)

# Watchdog: whatever happens to this script's steps, the machine dies after RB_TTL_MIN minutes.
( exec 8>&-; trap - EXIT INT TERM HUP; sleep $(( RB_TTL_MIN * 60 )); echo "[watchdog] TTL ${RB_TTL_MIN} min reached, destroying $run"; hc destroy --run "$run"; kill -TERM $$ ) &
watchdog_pid=$!

printf '%s %s\n' "$ip" "$(cut -d' ' -f1-2 "$work/host.pub")" > "$work/known_hosts"
SSH=(ssh -q -i "$work/id" -o IdentitiesOnly=yes -o BatchMode=yes -o UserKnownHostsFile="$work/known_hosts"
  -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "root@$ip")
vm() { "${SSH[@]}" "$@"; }

log "waiting for SSH and cloud-init (Docker install)"
deadline=$(( $(date +%s) + 900 ))
until vm 'test -f /run/rb-ready' 2>/dev/null; do
  (( $(date +%s) < deadline )) || { vm 'cloud-init status --long; tail -n 30 /var/log/cloud-init-output.log' 2>&1 | sed 's/^/  vm: /' || true; die "builder not ready after 15 min"; }
  sleep 5
done
t_ready=$(date +%s)
vm 'docker info >/dev/null && zstd --version >/dev/null' || die "docker/zstd missing on the builder"
log "builder ready in $(( t_ready - t_create )) s (ssh+cloud-init); docker $(vm "docker version --format '{{.Server.Version}}'")"
# RAM sampler on the builder: "<epoch> <used MiB> <available MiB> <swap used MiB>" every 2 s.
vm "nohup sh -c 'while :; do free -m | awk -v t=\$(date +%s) \"/^Mem:/{u=\\\$3;a=\\\$7} /^Swap:/{s=\\\$3} END{print t, u, a, s}\"; sleep 2; done' > /root/mem.log 2>/dev/null < /dev/null &" || log "WARN: RAM sampler not started"
mem_peak() { vm "awk 'BEGIN{m=0;a=-1} {if(\$2>m)m=\$2; if(a<0||\$3<a)a=\$3; if(\$4>s)s=\$4} END{printf \"{\\\"peak_used_mib\\\":%d,\\\"min_available_mib\\\":%d,\\\"peak_swap_mib\\\":%d,\\\"samples\\\":%d}\", m, a, s, NR}' /root/mem.log" 2>/dev/null || printf '{}'; }

created_iso="$(date -u -d "@$(date +%s)" +%FT%TZ)"
lbl=(--label "org.opencontainers.image.revision=$sha" --label "org.opencontainers.image.version=$tag" --label "org.opencontainers.image.created=$created_iso")
t_src=$(date +%s)
if [[ "$mode" == probe ]]; then
  log "probe: building a tiny alpine image release-probe:test on the builder"
  vm "printf 'FROM alpine:3.20\nRUN echo probe-$run > /probe\n' | docker build -q ${lbl[*]} -t release-probe:test -" >/dev/null
  printf '{"files":0,"archive_sha256":null}' > "$facts/source.json"
  printf '{"cmd":"(probe: none)","ok":true,"seconds":0}' > "$facts/gate.json"
  t_gate=$(date +%s); t_built=$t_gate
else
  # 6. Source -> builder (tracked files only).
  files="$(git -C "$RB_REPO" ls-tree -r --name-only "$sha" | wc -l)"
  git -C "$RB_REPO" archive --format=tar "$sha" | tee >(sha256sum | cut -d' ' -f1 > "$work/src.sha") | zstd -q -T0 \
    | vm 'mkdir -p /build/src && zstd -dq | tar -x -C /build/src'
  for _ in $(seq 1 20); do [[ -s "$work/src.sha" ]] && break; sleep 0.5; done
  printf '{"files":%s,"archive_sha256":"%s","git_archive":"%s"}' "$files" "$(cat "$work/src.sha")" "$sha" > "$facts/source.json"
  vm 'umask 077; cat > /build/build-args' < "$work/build-args"
  log "source sent ($files files) in $(( $(date +%s) - t_src )) s"
  # 7. Gate: npm ci (and whatever RB_GATE adds) in a clean Node 22 container.
  t_g0=$(date +%s)
  vm "timeout 30m docker run --rm -v /build/src:/src -w /src node:22-bookworm-slim sh -c $(printf '%q' "$RB_GATE")" 2>&1 | tail -n 15 | sed 's/^/  gate: /' \
    || die "gate failed: $RB_GATE"
  t_gate=$(date +%s)
  printf '{"cmd":%s,"ok":true,"seconds":%s}' "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$RB_GATE")" $(( t_gate - t_g0 )) > "$facts/gate.json"
  log "gate ok in $(( t_gate - t_g0 )) s"
  # 8. Images: same Dockerfile and targets as deploy.sh; public args only for the app (runner), as deploy.sh does.
  vm "set -e; cd /build; args=(); while IFS= read -r l; do args+=(--build-arg \"\$l\"); done < build-args
    b() { local k=\"\$1\" t0=\$(date +%s); shift
      if ! timeout 45m docker build --progress=plain -f src/deploy/serwerek/Dockerfile ${lbl[*]} \"\$@\" src > /root/build-\$k.log 2>&1; then
        tail -n 30 /root/build-\$k.log; return 1; fi
      echo \"\$k \$(( \$(date +%s) - t0 )) s\"; }
    b app --target runner \"\${args[@]}\" --label pl.pawelperfect.release.kind=app -t polutek-app:$tag
    b migrator --target migrator --label pl.pawelperfect.release.kind=migrator -t polutek-migrator:$tag
    b worker --target worker --label pl.pawelperfect.release.kind=worker -t polutek-worker:$tag
    b collector --target collector --label pl.pawelperfect.release.kind=collector -t polutek-collector:$tag" 2>&1 | tail -n 40 | sed 's/^/  build: /'     || die "image build failed"
  t_built=$(date +%s)
  log "images built in $(( t_built - t_gate )) s"
  # Long steps of the app build (BuildKit step number -> duration), for the record.
  vm "awk 'FNR==1{delete name} /^#[0-9]+ /{if(!(\$1 in name)){s=\$0; sub(/^#[0-9]+ /,\"\",s); name[\$1]=s}} /^#[0-9]+ DONE [0-9.]+s/{d=\$3; sub(/s\$/,\"\",d); if (d+0 >= 5) printf \"%7.1fs %s\\n\", d, name[\$1]}' /root/build-app.log /root/build-worker.log" 2>/dev/null | sed 's/^/  step: /' || true
  log "RAM on the builder so far: $(mem_peak)"
fi

# 8b. Optional checks on the builder (e.g. ffmpeg in the worker image); never fails the build.
if [[ -n "${RB_VM_CHECK:-}" ]]; then
  [[ -r "$RB_VM_CHECK" ]] || die "RB_VM_CHECK: cannot read $RB_VM_CHECK"
  t_c0=$(date +%s); crc=0
  vm "TAG=$tag SHA=$sha bash -s" < "$RB_VM_CHECK" > "$RB_HOME/logs/vmcheck-$run.log" 2>&1 || crc=$?
  log "vm check: exit $crc in $(( $(date +%s) - t_c0 )) s, output in $RB_HOME/logs/vmcheck-$run.log"
fi

# 9. Facts from the builder.
vm "docker image inspect ${refs[*]}" > "$facts/inspect-builder.json"
vm "printf '{\"docker\":%s,\"buildx\":\"%s\",\"kernel\":\"%s\"}' \"\$(docker version --format json)\" \"\$(docker buildx version 2>/dev/null | head -n1)\" \"\$(uname -r)\"" > "$work/vm-versions.json"
node_v=""; [[ "$mode" == full ]] && node_v="$(vm "docker run --rm --entrypoint node polutek-app:$tag -v" 2>/dev/null || true)"

# 10. Transfer: builder -> this server, docker save | zstd | ssh | zstd -d | docker load. Checksum on both ends.
t_x0=$(date +%s)
remote="$(vm "set -e; docker save ${refs[*]} | zstd -q -T0 -3 -o /root/images.tar.zst; sha256sum /root/images.tar.zst | cut -d' ' -f1; stat -c %s /root/images.tar.zst")"
remote_sha="$(sed -n 1p <<<"$remote")"; remote_bytes="$(sed -n 2p <<<"$remote")"
t_x1=$(date +%s)
log "saved+compressed on the builder: $remote_bytes bytes in $(( t_x1 - t_x0 )) s"
mem="$(mem_peak)"; log "RAM on the builder (whole run): $mem"
if [[ "${RB_NO_LOAD:-0}" == "1" ]]; then
  # Trial run: nothing is sent to this server. Delete the machine, record cost and a summary, no manifest.
  log "RB_NO_LOAD=1: images NOT transferred to this server"
  stop_watchdog
  destroy_builder || die "builder deletion not confirmed"
  compute_cost 0
  log "left in Hetzner for this run: $(hc inventory --run "$run")"
  out="$RB_HOME/$tag"; mkdir -p "$out"
  printf '{"tag":"%s","revision":"%s","builder":%s,"compressed_bytes":%s,"sha256":"%s","ram":%s,"cost":%s,"timings":{"create_to_running":%s,"cloud_init":%s,"source_and_gate":%s,"build":%s,"save":%s,"machine_lifetime":%s,"total":%s}}\n' \
    "$tag" "$sha" "$builder_json" "$remote_bytes" "$remote_sha" "${mem:-null}" "$(cat "$facts/cost.json" 2>/dev/null || echo null)" \
    $(( t_running - t_create )) $(( t_ready - t_running )) $(( t_gate - t_src )) $(( t_built - t_gate )) $(( t_x1 - t_x0 )) \
    $(( t_destroyed - t_create )) $(( $(date +%s) - started )) > "$out/no-load.json"
  log "summary: $out/no-load.json"
  exit 0
fi
log "loading here"
rate=(cat); [[ -n "${RB_LOAD_RATE:-}" ]] && command -v pv >/dev/null && rate=(pv -q -L "$RB_LOAD_RATE")
vm 'cat /root/images.tar.zst' | "${rate[@]}" | tee >(sha256sum | cut -d' ' -f1 > "$work/recv.sha") \
  | ionice -c3 nice -n 10 zstd -dq | ionice -c3 nice -n 10 docker load -q | sed 's/^/  load: /'
for _ in $(seq 1 40); do [[ -s "$work/recv.sha" ]] && break; sleep 0.5; done
t_x2=$(date +%s)
[[ "$(cat "$work/recv.sha")" == "$remote_sha" ]] || die "transfer checksum mismatch (images loaded but not trusted; no manifest written)"
log "loaded in $(( t_x2 - t_x1 )) s, checksum ok"
printf '{"compressed_bytes":%s,"sha256":"%s","save_seconds":%s,"load_seconds":%s,"method":"docker save | zstd -3 | ssh | zstd -d | docker load"}' \
  "$remote_bytes" "$remote_sha" $(( t_x1 - t_x0 )) $(( t_x2 - t_x1 )) > "$facts/transfer.json"
docker image inspect "${refs[@]}" > "$facts/inspect-server.json"

# 11. Machine no longer needed: delete it now (the trap would do it too).
stop_watchdog
destroy_builder || die "builder deletion not confirmed"
compute_cost 0
left="$(hc inventory --run "$run")"
log "left in Hetzner for this run: $left"

node -e '
const [vmv, nodev, type, local] = process.argv.slice(1);
const v = JSON.parse(vmv);
process.stdout.write(JSON.stringify({ builder_docker: v.docker?.Server?.Version, builder_containerd: (v.docker?.Server?.Components||[]).find(c=>c.Name==="containerd")?.Version,
  builder_buildx: v.buildx, builder_kernel: v.kernel, app_node: nodev || null, server_docker: local }));' \
  "$(cat "$work/vm-versions.json")" "$node_v" "$(jget "$builder_json" 'd.name')" "$(docker version --format '{{.Server.Version}}')" > "$facts/versions.json"
printf '%s' "$builder_json" | node -e 'const b=JSON.parse(require("fs").readFileSync(0));const i=JSON.parse(process.argv[1]);process.stdout.write(JSON.stringify({...b,server_id:i.server_id,name:i.name}))' "$info" > "$facts/builder.json"
printf '{"create_to_running":%s,"cloud_init":%s,"gate":%s,"build":%s,"save":%s,"load":%s,"machine_lifetime":%s,"total":%s}' \
  $(( t_running - t_create )) $(( t_ready - t_running )) $(( t_gate - t_src )) $(( t_built - t_gate )) $(( t_x1 - t_x0 )) $(( t_x2 - t_x1 )) \
  $(( t_destroyed - t_create )) $(( $(date +%s) - started )) > "$facts/timings.json"
printf '{"tag":"%s","revision":"%s","mode":"%s","refs":%s}' "$tag" "$sha" "$mode" "$refs_json" > "$facts/meta.json"

# 12. Manifest (fails if any image ID / revision label differs between builder and this server).
out="$RB_HOME/$tag"; mkdir -p "$out"
cp "$work/build-args" "$out/build-args.public"; chmod 644 "$out/build-args.public"
node "$RELEASE_LIB/manifest.mjs" create --facts "$facts" --out "$out/manifest.json" >/dev/null
log "manifest: $out/manifest.json"
log "timings (s): $(cat "$facts/timings.json")"
if [[ "$mode" == probe ]]; then
  docker rmi release-probe:test >/dev/null && log "probe image release-probe:test removed from this server"
else
  log "next: deploy/release/release-deploy.sh $out/manifest.json"
fi
