#!/usr/bin/env bash
# Scala PR po ZIELONYM CI najnowszego commita galezi i (opcjonalnie) wdraza main na serwerek.
#
#   scripts/ops/mergedeploy.sh <PR> <galaz> <prefiks-tagu>           # merge + deploy
#   scripts/ops/mergedeploy.sh <PR> <galaz> <prefiks-tagu> --no-deploy # tylko merge (dokumentacja)
#
# Wymaga: gh (zalogowany), ssh z aliasem `serwerek` (SERWEREK.md §15). Nie wypisuje sekretow.
# Merge tylko gdy KONKLUZJA ostatniego przebiegu CI galezi to "success" (sprawdzamy konkluzje, nie status).
# Deploy: ./deploy.sh <tag> na serwerku z archiwum origin/main; rollback robi sam deploy.sh przy nieudanym health.
set -uo pipefail

PR="${1:?brak numeru PR}"; BR="${2:?brak galezi}"; TAG="${3:?brak prefiksu tagu}"; MODE="${4:-}"
cd "$(git rev-parse --show-toplevel)" || exit 1

# SKIP_CI=1: GitHub Actions unavailable (billing/limit): the caller ran tests, typecheck and lint locally first.
if [ -n "${SKIP_CI:-}" ]; then
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

gh pr merge "$PR" --squash --admin 2>&1 | tail -1
state=$(gh pr view "$PR" --json state --jq .state); echo "PR: $state"
[ "$state" = "MERGED" ] || exit 3
[ "$MODE" = "--no-deploy" ] && exit 0

git fetch -q origin main
full="${TAG}\$(date +%m%d%H%M)"
git archive origin/main | ssh serwerek "cd /opt/serwerek/apps/polutek && rm -rf src && mkdir src && tar -x -C src && (nohup ./deploy.sh ${full} > deploy-${TAG}.log 2>&1 < /dev/null &); sleep 1; echo deploy-started"
ssh serwerek "until grep -qE 'OK: polutek-app|FAILED|migration failed|\] ERROR: ' /opt/serwerek/apps/polutek/deploy-${TAG}.log; do sleep 10; done; grep -E '^\[deploy' /opt/serwerek/apps/polutek/deploy-${TAG}.log | tail -2"
curl -s -o /dev/null -w "www %{http_code}\n" https://www.pawelperfect.com/en
