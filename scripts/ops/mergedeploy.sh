#!/usr/bin/env bash
# Scala PR po ZIELONYM CI najnowszego commita galezi i (opcjonalnie) wdraza main na serwerek.
#
#   scripts/ops/mergedeploy.sh <PR> <galaz> <prefiks-tagu>           # merge + deploy
#   scripts/ops/mergedeploy.sh <PR> <galaz> <prefiks-tagu> --no-deploy # tylko merge (dokumentacja)
#
# Tryby sprawdzania przed scaleniem:
#   (domyslnie)  czeka na KONKLUZJE ostatniego przebiegu CI GitHuba dla galezi (konkluzja, nie status)
#   LOCAL_CI=1   uruchamia lokalne CI (scripts/ops/local-ci.mjs, docs/operations/LOCAL-CI.md) na
#                origin/<galaz> scalonej z origin/main; scala tylko przy PASS i tylko ten sam commit
#                (--match-head-commit), a tabela wynikow trafia do opisu scalenia.
#                LOCAL_CI_ARGS="--full" przekazuje opcje do local-ci (domyslnie: --build).
#   SKIP_CI=1    bez zadnego sprawdzania (wywolujacy sam uruchomil testy, typecheck i lint).
#
# Wymaga: gh (zalogowany), ssh z aliasem `serwerek` (SERWEREK.md, rozdz. 7; skrypt zakłada GitHub i `gh`, projekt go nie używa). Nie wypisuje sekretow.
# Deploy: ./deploy.sh <tag> na serwerku z archiwum origin/main; rollback robi sam deploy.sh przy nieudanym health.
set -uo pipefail

PR="${1:?brak numeru PR}"; BR="${2:?brak galezi}"; TAG="${3:?brak prefiksu tagu}"; MODE="${4:-}"
cd "$(git rev-parse --show-toplevel)" || exit 1

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

if [ -n "${LOCAL_CI:-}" ]; then
  local_ci || exit 2
elif [ -n "${SKIP_CI:-}" ]; then
  # SKIP_CI=1: no checks at all; the caller ran tests, typecheck and lint locally first.
  echo "CI: pominiete (SKIP_CI), sprawdzenia lokalne"
else
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

gh pr merge "$PR" --squash --admin "${MERGE_ARGS[@]}" 2>&1 | tail -1
state=$(gh pr view "$PR" --json state --jq .state); echo "PR: $state"
[ "$state" = "MERGED" ] || exit 3
[ "$MODE" = "--no-deploy" ] && exit 0

git fetch -q origin main
full="${TAG}\$(date +%m%d%H%M)"
# Remote lock (.deploy.lock, the same file deploy.sh / deploy-admin.sh flock): taken BEFORE ./src is replaced and handed to
# deploy.sh through the inherited fd 9 (DEPLOY_LOCK_HELD=1), so two deploys never share src or the .current-* files.
git archive origin/main | ssh serwerek "cd /opt/serwerek/apps/polutek && exec 9>.deploy.lock && { flock -n 9 || { echo 'deploy-busy: inny deploy trwa (.deploy.lock)'; exit 75; }; } && rm -rf src && mkdir src && tar -x -C src && (DEPLOY_LOCK_HELD=1 nohup ./deploy.sh ${full} > deploy-${TAG}.log 2>&1 < /dev/null &); sleep 1; echo deploy-started"
rc=${PIPESTATUS[1]}
[ "$rc" -eq 0 ] || { echo "deploy nie wystartowal (ssh/blokada, kod $rc); main jest scalony, wdroz pozniej"; exit 4; }
ssh serwerek "until grep -qE 'OK: polutek-app|OK \(WITH WARNINGS\): polutek-app|FAILED|migration failed|\] ERROR: ' /opt/serwerek/apps/polutek/deploy-${TAG}.log; do sleep 10; done; grep -E '^\[deploy' /opt/serwerek/apps/polutek/deploy-${TAG}.log | tail -2"
curl -s -o /dev/null -w "www %{http_code}\n" https://www.pawelperfect.com/en
