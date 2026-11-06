#!/usr/bin/env bash
# Scala PR po ZIELONYM CI najnowszego commita galezi i (opcjonalnie) wdraza main na serwerek.
#
#   scripts/ops/mergedeploy.sh <PR> <galaz> <prefiks-tagu> --no-deploy # merge only
#   RELEASE_BUNDLE_DIR=… RELEASE_REVISION=… RELEASE_PROOF_SHA256=… scripts/ops/mergedeploy.sh <PR> <galaz> <prefiks-tagu>
#   Or pass RELEASE_RUN_ID for an already completed images workflow run. It never starts Actions itself.
#
# Tryby sprawdzania przed scaleniem:
#   (domyslnie)  czeka na KONKLUZJE ostatniego przebiegu CI GitHuba dla galezi (konkluzja, nie status)
#   LOCAL_CI=1   uruchamia lokalne CI (scripts/ops/local-ci.mjs, docs/operations/LOCAL-CI.md) na
#                origin/<galaz> scalonej z origin/main; scala tylko przy PASS i tylko ten sam commit
#                (--match-head-commit), a tabela wynikow trafia do opisu scalenia.
#                LOCAL_CI_ARGS="--full" przekazuje opcje do local-ci (domyslnie: --build).
#   SKIP_CI=1    bez zadnego sprawdzania (wywolujacy sam uruchomil testy, typecheck i lint).
#
# Requires authenticated gh and ssh alias `serwerek`. Never prints secrets.
set -uo pipefail

PR="${1:?brak numeru PR}"; BR="${2:?brak galezi}"; TAG="${3:?brak prefiksu tagu}"; MODE="${4:-}"
cd "$(git rev-parse --show-toplevel)" || exit 1
[[ "$TAG" =~ ^[A-Za-z0-9._-]{1,32}$ ]] || { echo "nieprawidlowy prefiks tagu" >&2; exit 2; }
[[ -z "$MODE" || "$MODE" == "--no-deploy" ]] || { echo "nieznany tryb" >&2; exit 2; }

MERGE_ARGS=()

# Runs local-ci on origin/$BR (+ origin/main). In place when this checkout is exactly that commit,
# clean and already contains origin/main; otherwise in a temporary worktree with its own npm ci.
local_ci() {
  git fetch -q origin main "$BR" || { echo "git fetch nie powiodl sie"; return 2; }
  local sha prsha dir rc
  sha=$(git rev-parse "origin/$BR") || return 2
  prsha=$(gh pr view "$PR" --json headRefOid --jq .headRefOid) || return 2
  [ "$prsha" = "$sha" ] || { echo "PR $PR wskazuje $prsha, a origin/$BR to $sha: wypchnij galaz"; return 2; }

  if [ -z "$(git status --porcelain --untracked-files=no)" ] && [ "$(git rev-parse HEAD)" = "$sha" ] \
     && git merge-base --is-ancestor origin/main HEAD; then
    dir=$PWD
    echo "Lokalne CI: w biezacym katalogu ($sha)"
  else
    dir=$(mktemp -d "${TMPDIR:-/tmp}/local-ci-XXXXXX") || return 2
    LOCAL_CI_WORKTREE="$dir"
    trap 'git worktree remove --force "$LOCAL_CI_WORKTREE" >/dev/null 2>&1; rm -rf "$LOCAL_CI_WORKTREE"' EXIT
    echo "Lokalne CI: tymczasowy worktree $dir (origin/$BR + origin/main, npm ci)"
    git worktree add -q --detach "$dir" "$sha" || return 2
    if ! git -C "$dir" merge-base --is-ancestor origin/main HEAD; then
      git -C "$dir" -c user.name=local-ci -c user.email=local-ci@localhost merge -q --no-edit origin/main \
        || { echo "konflikt z origin/main: zmerguj main do galezi"; return 2; }
    fi
    (cd "$dir" && npm ci --no-audit --no-fund --loglevel=error) || { echo "npm ci nie powiodl sie"; return 2; }
  fi

  # shellcheck disable=SC2086  # LOCAL_CI_ARGS is a list of flags
  (cd "$dir" && node scripts/ops/local-ci.mjs ${LOCAL_CI_ARGS:---build}); rc=$?
  local report="$dir/.claude/local-ci-last.json"
  local tested
  tested=$(git -C "$dir" rev-parse HEAD)
  node -e 'const r=require(process.argv[1]); process.exit(r.ok && r.head===process.argv[2] && !r.dirty ? 0 : 1)' "$report" "$tested" \
    || { echo "Lokalne CI: FAIL (kod $rc), nie scalam. Raport: $report"; return 2; }
  [ "$rc" -eq 0 ] || { echo "Lokalne CI: kod $rc, nie scalam"; return 2; }

  MERGE_ARGS=(--match-head-commit "$sha" --body "$(printf 'PR #%s, galaz %s\n\n%s\n' "$PR" "$BR" "$(cat "$dir/.claude/local-ci-last.md")")")
  echo "Lokalne CI: PASS"
}

state=$(gh pr view "$PR" --json state --jq .state) || exit 2
if [ "$state" = "OPEN" ] && [ -n "${LOCAL_CI:-}" ]; then
  local_ci || exit 2
elif [ "$state" = "OPEN" ] && [ -n "${SKIP_CI:-}" ]; then
  # SKIP_CI=1: no checks at all; the caller ran tests, typecheck and lint locally first.
  echo "CI: pominiete (SKIP_CI), sprawdzenia lokalne"
elif [ "$state" = "OPEN" ]; then
  sleep 40
  id=$(gh run list --branch "$BR" --limit 1 --json databaseId --jq '.[0].databaseId')
  [ -n "$id" ] || { echo "brak przebiegu CI dla $BR"; exit 2; }
  until [ "$(gh run view "$id" --json status --jq .status)" = "completed" ]; do sleep 20; done
  c=$(gh run view "$id" --json conclusion --jq .conclusion); echo "CI: $c"
  if [ "$c" != "success" ]; then
    gh run view "$id" --json jobs --jq '.jobs[] | select(.conclusion!="success") | .name'
    exit 2
  fi
fi

if [ "$state" = "OPEN" ]; then
  gh pr merge "$PR" --squash "${MERGE_ARGS[@]}" 2>&1 | tail -1
  state=$(gh pr view "$PR" --json state --jq .state); echo "PR: $state"
fi
[ "$state" = "MERGED" ] || exit 3
[ "$MODE" = "--no-deploy" ] && exit 0

git fetch -q origin main
revision="${RELEASE_REVISION:-}"
approved_hash="${RELEASE_PROOF_SHA256:-}"
run_id="${RELEASE_RUN_ID:-}"
bundle_dir="${RELEASE_BUNDLE_DIR:-}"
[[ "$revision" =~ ^[a-f0-9]{40}$ && "$approved_hash" =~ ^[a-f0-9]{64}$ ]] \
  || { echo "PR scalony; deploy wymaga RELEASE_REVISION i zewnetrznie zatwierdzonego RELEASE_PROOF_SHA256" >&2; exit 4; }
if [[ -z "$bundle_dir" && ! "$run_id" =~ ^[0-9]+$ ]]; then
  echo "podaj lokalny RELEASE_BUNDLE_DIR albo ukończony RELEASE_RUN_ID" >&2; exit 4
fi
git rev-parse --verify "origin/main^{commit}" >/dev/null || exit 2
main_sha=$(git rev-parse origin/main)
[ "$revision" = "$main_sha" ] || { echo "RELEASE_REVISION nie odpowiada origin/main ($main_sha)" >&2; exit 4; }

tmp=$(mktemp -d "${TMPDIR:-/tmp}/polutek-release-deploy-XXXXXX") || exit 4
trap 'rm -rf "$tmp"' EXIT
artifact="$tmp/artifact"; bundle="$tmp/bundle"; stage="$tmp/stage"
mkdir -p "$stage/.release-artifacts"
if [[ -n "$bundle_dir" ]]; then
  artifact=$(cd "$bundle_dir" && pwd -P) || { echo "lokalny artifact nie istnieje" >&2; exit 4; }
else
  run_json=$(gh run view "$run_id" --json headSha,status,conclusion,event,workflowName) || exit 4
  printf '%s' "$run_json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s);process.exit(r.headSha===process.argv[1]&&r.status==="completed"&&r.conclusion==="success"&&r.workflowName==="images"?0:1)}catch{process.exit(1)}})' "$revision" \
    || { echo "images workflow nie ma zielonego wyniku dla tej rewizji" >&2; exit 4; }
  mkdir -p "$artifact"
  gh run download "$run_id" --name "polutek-release-$revision" --dir "$artifact" || { echo "brak artifactu wydania" >&2; exit 4; }
fi
prepared=$(node scripts/ops/release-artifact.mjs --artifact="$artifact" --revision="$revision" --out="$bundle") \
  || { echo "artifact wydania nie przechodzi walidacji" >&2; exit 4; }
prepared_hash=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).proof_sha256)' "$prepared")
[ "$prepared_hash" = "$approved_hash" ] || { echo "hash proofu nie odpowiada zewnetrznie zatwierdzonemu wynikowi" >&2; exit 4; }
mkdir -p "$stage/.release-artifacts/$revision"
cp -a "$bundle/." "$stage/.release-artifacts/$revision/"
cp -a "$bundle/source" "$stage/src"
full_tag="${TAG}-${revision:0:12}"

# The shared lock is acquired before staging source/artifact; the source-owned deploy script inherits fd 9.
tar -C "$stage" -cf - . | ssh serwerek "cd /opt/serwerek/apps/polutek && exec 9>.deploy.lock && { flock -n 9 || { echo 'deploy-busy: .deploy.lock'; exit 75; }; } && incoming=.deploy-staging-${revision} && rm -rf \"\$incoming\" && mkdir \"\$incoming\" && tar -xf - -C \"\$incoming\" && test -d \"\$incoming/.release-artifacts/${revision}/source\" && test -d \"\$incoming/src\" && mkdir -p .release-artifacts && { if [ -e .release-artifacts/${revision} ]; then diff -qr \"\$incoming/.release-artifacts/${revision}\" .release-artifacts/${revision} >/dev/null || exit 76; rm -rf \"\$incoming/.release-artifacts/${revision}\"; else mv \"\$incoming/.release-artifacts/${revision}\" .release-artifacts/; fi; } && rm -rf src.previous && { test ! -e src || mv src src.previous; } && mv \"\$incoming/src\" src && rm -rf \"\$incoming\" && DEPLOY_APP_DIR=\$PWD DEPLOY_LOCK_HELD=1 RELEASE_REVISION=${revision} RELEASE_PROOF_SHA256=${approved_hash} bash .release-artifacts/${revision}/source/deploy/serwerek/deploy.sh ${full_tag} && install -m 0755 .release-artifacts/${revision}/source/deploy/serwerek/deploy.sh ./deploy.sh && install -m 0755 .release-artifacts/${revision}/source/deploy/serwerek/deploy-admin.sh ./deploy-admin.sh && install -m 0755 .release-artifacts/${revision}/source/deploy/serwerek/verify-active-release.sh ./verify-active-release.sh"
rc=${PIPESTATUS[1]}
[ "$rc" -eq 0 ] || { echo "deploy nie przeszedl (kod $rc); PR pozostaje scalony, sprawdz logi serwera"; exit 4; }
