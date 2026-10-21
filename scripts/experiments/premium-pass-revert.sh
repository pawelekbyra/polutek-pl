#!/usr/bin/env bash
# Wycofanie eksperymentu "Wejściówka Premium" (docs/experiments/premium-pass.md, rozdz. 17).
#
#   bash scripts/experiments/premium-pass-revert.sh              # pełne: flaga off, revert kodu, wdrożenie, sprzątanie
#   bash scripts/experiments/premium-pass-revert.sh --flag-only  # tylko wyłączenie flagą (sekundy, bez wdrożenia)
#   bash scripts/experiments/premium-pass-revert.sh --dry-run    # podgląd: nic nie zmienia (łączy --flag-only)
#   bash scripts/experiments/premium-pass-revert.sh --confirm-real-payments   # pełne wycofanie mimo prawdziwych wpłat (patrz niżej)
#
# PRAWDZIWE PŁATNOŚCI (PREMIUM_PASS_PAYMENTS=stripe): wiersze `Payment` (księga wpłat, ta sama co napiwki) NIGDY nie są
# usuwane ani zmieniane przez ten skrypt. Kasowane jest tylko mapowanie dostępu (AppSetting xp.premium_pass*), po zapisaniu
# jego kopii do pliku na serwerze. Skrypt odmawia pełnego wycofania (kod 6), gdy istnieją dostępy z prawdziwych wpłat albo
# wpłaty w toku, dopóki nie podasz --confirm-real-payments: zwroty robi właściciel ręcznie w panelu Stripe.
#
# Uruchomienie przez właściciela jest jego zgodą na zmianę app.env, restart aplikacji i wdrożenie (CLAUDE.md §0).
# Wymaga: git, gh (zalogowany), ssh z aliasem `serwerek`. Nie wypisuje sekretów (z app.env czyta tylko linie PREMIUM_PASS_*).
# Kody wyjścia: 0 OK, 2 błąd przygotowania, 3 konflikt revertu (flaga już wyłączona), 4 nieudane wdrożenie, 5 weryfikacja FAIL,
# 6 prawdziwe wpłaty (brak --confirm-real-payments).
set -uo pipefail

EXPERIMENT_ID="premium-pass"
HOST="${PP_SSH_HOST:-serwerek}"
APP_DIR="/opt/serwerek/apps/polutek"
DB_CONTAINER="polutek-db-1"
APP_CONTAINER="polutek-app-1"
SITE="${PP_SITE:-https://www.pawelperfect.com}"
TAG_PREFIX="revert-xpass"

DRY=0
FLAG_ONLY=0
CONFIRM_REAL=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --flag-only) FLAG_ONLY=1 ;;
    --confirm-real-payments) CONFIRM_REAL=1 ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "nieznana opcja: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '[premium-pass-revert %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "BŁĄD: $*" >&2; exit "${2:-2}"; }

# Runs a bash script on the server (stdin). In --dry-run only shows what would run.
remote() { # $1 = description; stdin = script
  if [[ $DRY -eq 1 ]]; then
    log "[dry-run] na $HOST: $1"
    sed 's/^/    | /'
    return 0
  fi
  log "na $HOST: $1"
  ssh -o BatchMode=yes "$HOST" bash -s
}

# Read-only remote command, also run in --dry-run.
remote_read() { ssh -o BatchMode=yes "$HOST" bash -s; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "uruchom w katalogu repozytorium polutek-pl"
cd "$ROOT" || exit 2
command -v ssh >/dev/null || die "brak ssh"

# --------------------------------------------------------------------------- 1. flag off, immediately
flag_off() {
  remote "PREMIUM_PASS_EXPERIMENT=off i PREMIUM_PASS_PAYMENTS=demo w app.env + restart aplikacji (kopia app.env obok)" <<REMOTE
set -euo pipefail
cd "$APP_DIR"
ts=\$(date -u +%Y%m%dT%H%M%S)
cp -p app.env "app.env.bak-premium-pass-\$ts"
if grep -q '^PREMIUM_PASS_EXPERIMENT=' app.env; then
  sed -i 's/^PREMIUM_PASS_EXPERIMENT=.*/PREMIUM_PASS_EXPERIMENT=off/' app.env
else
  printf '\nPREMIUM_PASS_EXPERIMENT=off\n' >> app.env
fi
# Second switch: no new real payment can start (the experiment is off as well, so the API answers 404 anyway).
if grep -q '^PREMIUM_PASS_PAYMENTS=' app.env; then
  sed -i 's/^PREMIUM_PASS_PAYMENTS=.*/PREMIUM_PASS_PAYMENTS=demo/' app.env
else
  printf '\nPREMIUM_PASS_PAYMENTS=demo\n' >> app.env
fi
APP_IMAGE="\$(cat .current-image)" docker compose up -d --no-deps app >/dev/null
for _ in \$(seq 1 50); do
  s=\$(docker inspect -f '{{.State.Health.Status}}' "\$(docker compose ps -q app)" 2>/dev/null || echo unknown)
  [ "\$s" = healthy ] && break
  sleep 3
done
echo "app: \$s, kopia: app.env.bak-premium-pass-\$ts"
AI_AGENT=premium-pass-revert ai-log "premium-pass: PREMIUM_PASS_EXPERIMENT=off, PREMIUM_PASS_PAYMENTS=demo + restart app (kopia app.env.bak-premium-pass-\$ts)"
REMOTE
}

# --------------------------------------------------------------------------- real payments (read-only)
# Counts (never deletes): access grants that come from real Stripe payments, and patron payments still waiting.
REAL_GRANTS="?"
REAL_PENDING="?"
REAL_PAYMENTS="?"
real_payments_report() {
  REAL_GRANTS=$(printf '%s\n' "docker exec -i $DB_CONTAINER sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA' <<'SQL'" \
    "SELECT count(*) FROM \"AppSetting\" WHERE key LIKE 'xp.premium\\_pass:%' AND value LIKE '%\"provider\":\"STRIPE\"%';" "SQL" | remote_read 2>/dev/null | tr -d '[:space:]')
  REAL_PENDING=$(printf '%s\n' "docker exec -i $DB_CONTAINER sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA' <<'SQL'" \
    "SELECT count(*) FROM \"Payment\" WHERE status = 'PENDING' AND metadata->>'purpose' = 'premium_pass';" "SQL" | remote_read 2>/dev/null | tr -d '[:space:]')
  REAL_PAYMENTS=$(printf '%s\n' "docker exec -i $DB_CONTAINER sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA' <<'SQL'" \
    "SELECT count(*) FROM \"Payment\" WHERE metadata->>'purpose' = 'premium_pass';" "SQL" | remote_read 2>/dev/null | tr -d '[:space:]')
  log "prawdziwe płatności strefy patrona w księdze Payment: ${REAL_PAYMENTS:-?} (w toku: ${REAL_PENDING:-?}); dostępy z prawdziwych wpłat (w tym „bez limitu”, znacznik lifetime): ${REAL_GRANTS:-?}"
  log "wiersze Payment zostają zawsze (to księga pieniędzy); zwroty robi właściciel ręcznie w panelu Stripe"
}

# Refuses the full revert while real money is involved, unless the owner said so explicitly.
guard_real_payments() {
  real_payments_report
  local blocked=0
  [[ "${REAL_GRANTS:-?}" != "0" || "${REAL_PENDING:-?}" != "0" ]] && blocked=1
  if [[ $blocked -eq 1 && $CONFIRM_REAL -ne 1 ]]; then
    log "STOP: są dostępy z prawdziwych wpłat albo wpłaty w toku (albo odczyt się nie udał). Flaga jest wyłączona (nikt nowy nie zapłaci)."
    log "Poczekaj, aż wpłaty w toku się rozstrzygną, rozważ zwroty w panelu Stripe i uruchom ponownie z --confirm-real-payments."
    exit 6
  fi
}

# --------------------------------------------------------------------------- verification
PASS=0
FAIL=0
check() { # $1 = label, $2 = 0|1
  if [[ "$2" == "0" ]]; then log "PASS  $1"; PASS=$((PASS + 1)); else log "FAIL  $1"; FAIL=$((FAIL + 1)); fi
}

verify_public() {
  local code jj_id plan robots
  code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/premium")
  # Flag off: the page answers 404. Code reverted: the path is no longer public, so a guest is sent to sign-in (307).
  check "a) oferta /premium niedostępna: 404 albo 307 (jest: $code)" "$([[ $code == 404 || $code == 307 ]] && echo 0 || echo 1)"
  jj_id=$(printf '%s\n' "docker exec -i $DB_CONTAINER sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA' <<'SQL'" \
    "SELECT id FROM \"Video\" WHERE slug = 'jj';" "SQL" | remote_read 2>/dev/null | tr -d '[:space:]')
  if [[ -n "$jj_id" ]]; then
    plan=$(curl -s "$SITE/api/media-source/$jj_id")
    check "b) plan filmu jj dla gościa: LOGIN_REQUIRED, nigdzie PASS_REQUIRED" \
      "$([[ $plan == *'"status":"LOGIN_REQUIRED"'* && $plan != *PASS_REQUIRED* ]] && echo 0 || echo 1)"
  else
    check "b) nie znaleziono filmu jj w bazie" 1
  fi
  robots=$(curl -sI "$SITE/en")
  check "c) /en: 200 i X-Robots-Tag noindex" \
    "$([[ $(head -1 <<<"$robots") == *200* && ${robots,,} == *"x-robots-tag: noindex"* ]] && echo 0 || echo 1)"
}

verify_full() {
  git fetch -q origin main
  local left
  left=$(git grep -l -e "experiment-premium-pass" -e "experiment: premium-pass" origin/main -- app lib middleware.ts 2>/dev/null || true)
  check "d) brak kodu eksperymentu w origin/main (app, lib, middleware.ts)" "$([[ -z $left ]] && echo 0 || echo 1)"
  [[ -n $left ]] && printf '      %s\n' $left
  local rows envs
  rows=$(printf '%s\n' "docker exec -i $DB_CONTAINER sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA' <<'SQL'" \
    "SELECT count(*) FROM \"AppSetting\" WHERE key LIKE 'xp.premium\\_pass%';" "SQL" | remote_read 2>/dev/null | tr -d '[:space:]')
  check "e) wiersze AppSetting xp.premium_pass%: 0 (jest: ${rows:-?})" "$([[ $rows == 0 ]] && echo 0 || echo 1)"
  envs=$(echo "docker exec $APP_CONTAINER env | cut -d= -f1 | grep '^PREMIUM_PASS' || true" | remote_read 2>/dev/null)
  check "f) brak zmiennych PREMIUM_PASS_* w kontenerze aplikacji" "$([[ -z $envs ]] && echo 0 || echo 1)"
  log "g) ręcznie: film jj gra zalogowanemu, test-transkodowania gra gościowi"
  real_payments_report
  log "h) wiersze Payment strefy patrona zostały w księdze (nie są usuwane); dostępy z wpłat są w pliku premium-pass-grants-*.tsv na serwerze"
}

summary() {
  log "weryfikacja: $PASS PASS, $FAIL FAIL"
  [[ $FAIL -eq 0 ]] || exit 5
  exit 0
}

# --------------------------------------------------------------------------- dry run / flag only
if [[ $DRY -eq 1 ]]; then
  log "PODGLĄD (--dry-run): nic nie zostanie zmienione"
  log "stan flagi na serwerze (tylko linie PREMIUM_PASS_*):"
  echo "grep '^PREMIUM_PASS_' $APP_DIR/app.env || echo '(brak linii PREMIUM_PASS_*)'" | remote_read | sed 's/^/    /'
  flag_off
  git fetch -q origin main || die "git fetch nie powiódł się"
  mapfile -t SHAS < <(git log origin/main --format=%H --grep="^Experiment-Id: $EXPERIMENT_ID\$")
  log "commity eksperymentu w origin/main (do revertu, od najnowszego): ${#SHAS[@]}"
  for sha in "${SHAS[@]}"; do git log -1 --format='    %h %s' "$sha"; done
  if [[ $FLAG_ONLY -eq 0 ]]; then
    log "[dry-run] potem: worktree revert/$EXPERIMENT_ID-<MMDDHHMM>, git revert, sprawdzenie, PR (gh), scalenie (mergedeploy --no-deploy),"
    log "[dry-run]        git archive origin/main | tar -x w $APP_DIR/src, usunięcie plików eksperymentu z src, ./deploy.sh <sha10> w tmux,"
    log "[dry-run]        backup.sh, DELETE xp.premium_pass% w $DB_CONTAINER, usunięcie linii PREMIUM_PASS_* z app.env, restart, ai-log."
  fi
  real_payments_report
  log "obecny stan publiczny (odczyt):"
  verify_public
  log "koniec podglądu ($PASS PASS, $FAIL FAIL przed wycofaniem; FAIL jest tu oczekiwany, gdy eksperyment działa)"
  exit 0
fi

flag_off || die "nie udało się wyłączyć flagi na serwerze"

if [[ $FLAG_ONLY -eq 1 ]]; then
  log "--flag-only: kod zostaje uśpiony; pełne wycofanie: uruchom skrypt bez opcji"
  sleep 5
  verify_public
  summary
fi

guard_real_payments

# --------------------------------------------------------------------------- 2. experiment commits
command -v gh >/dev/null || die "brak gh (GitHub CLI)"
git fetch -q origin main || die "git fetch nie powiódł się"
mapfile -t SHAS < <(git log origin/main --format=%H --grep="^Experiment-Id: $EXPERIMENT_ID\$")
ALREADY_REVERTED=0
if [[ -z $(git grep -l -e "experiment-premium-pass" origin/main -- app lib 2>/dev/null || true) ]]; then
  ALREADY_REVERTED=1
  log "kod eksperymentu nie występuje już w origin/main: pomijam revert i wdrożenie, robię tylko sprzątanie"
elif [[ ${#SHAS[@]} -eq 0 ]]; then
  die "kod eksperymentu jest w origin/main, ale żaden commit nie ma linii 'Experiment-Id: $EXPERIMENT_ID' (wyłączone flagą, pełny revert wymaga agenta)" 3
fi

# Files the experiment ADDED: the server's src/ only receives `tar -x` (never deletes), so these are removed by hand.
added_files() {
  local sha
  for sha in "${SHAS[@]}"; do git diff-tree --no-commit-id --name-only -r --diff-filter=A "$sha"; done | sort -u
}

if [[ $ALREADY_REVERTED -eq 0 ]]; then
  # ------------------------------------------------------------------------- 3. revert in a temporary worktree
  BRANCH="revert/$EXPERIMENT_ID-$(date +%m%d%H%M)"
  WT="$(mktemp -d "${TMPDIR:-/tmp}/premium-pass-revert-XXXXXX")"
  is_windows() { [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]]; }
  # node_modules in the worktree is a link to the repo's own: always unlink it BEFORE the worktree is deleted.
  unlink_nm() {
    [[ -e "$WT/node_modules" || -L "$WT/node_modules" ]] || return 0
    if is_windows; then cmd //c "rmdir \"$(cygpath -w "$WT/node_modules")\"" >/dev/null 2>&1; else rm -f "$WT/node_modules"; fi
  }
  cleanup_wt() { unlink_nm; git worktree remove --force "$WT" >/dev/null 2>&1; rm -rf "$WT"; }
  git worktree add -q -b "$BRANCH" "$WT" origin/main || die "nie można utworzyć worktree"
  log "revert ${#SHAS[@]} commitów na gałęzi $BRANCH"
  if ! git -C "$WT" revert --no-edit "${SHAS[@]}"; then
    git -C "$WT" revert --abort >/dev/null 2>&1
    cleanup_wt
    git branch -D "$BRANCH" >/dev/null 2>&1
    die "konflikt revertu. Wyłączone flagą (krok 1), pełny revert wymaga agenta." 3
  fi

  # ------------------------------------------------------------------------- 4. check the reverted tree
  left=$(git -C "$WT" grep -l -e "experiment-premium-pass" -e "premium-pass" -- app lib middleware.ts 2>/dev/null || true)
  if [[ -n $left ]]; then
    printf '    %s\n' $left
    cleanup_wt
    die "po revercie zostały odwołania do eksperymentu (wyżej). Wyłączone flagą, pełny revert wymaga agenta." 3
  fi
  if [[ -d "$ROOT/node_modules" ]]; then
    if is_windows; then
      cmd //c "mklink /J \"$(cygpath -w "$WT/node_modules")\" \"$(cygpath -w "$ROOT/node_modules")\"" >/dev/null
    else
      ln -s "$ROOT/node_modules" "$WT/node_modules"
    fi
    (cd "$WT" && npx prisma generate >/dev/null 2>&1; nice -n 10 npx vitest run tests/unit/i18n/catalog-parity.test.ts tests/unit/modules/access) \
      || { cleanup_wt; die "testy po revercie nie przechodzą. Wyłączone flagą, pełny revert wymaga agenta." 3; }
    unlink_nm
  else
    log "brak node_modules w $ROOT: pomijam szybkie testy (npm ci, żeby je włączyć)"
  fi

  # ------------------------------------------------------------------------- 5. PR, merge, deploy
  git -C "$WT" push -q -u origin "$BRANCH" || { cleanup_wt; die "git push nie powiódł się"; }
  PR_URL=$(cd "$WT" && gh pr create --base main --head "$BRANCH" --title "Revert premium-pass experiment" \
    --body "Full revert of the premium-pass demo experiment (docs/experiments/premium-pass.md, section 17), made by scripts/experiments/premium-pass-revert.sh. The flag was turned off first.") \
    || { cleanup_wt; die "gh pr create nie powiódł się"; }
  PR_NUM="${PR_URL##*/}"
  log "PR: $PR_URL"
  SKIP_CI=1 bash "$ROOT/scripts/ops/mergedeploy.sh" "$PR_NUM" "$BRANCH" "$TAG_PREFIX" --no-deploy || { cleanup_wt; die "scalenie PR nie powiodło się" 4; }
  cleanup_wt

  git fetch -q origin main
  SHA=$(git rev-parse origin/main)
  TAG="${SHA:0:10}"
  STALE=$(comm -23 <(added_files) <(git ls-tree -r --name-only origin/main | sort -u))
  log "wdrożenie $TAG: git archive origin/main -> $APP_DIR/src"
  git archive origin/main | ssh -o BatchMode=yes "$HOST" "cd $APP_DIR/src && tar -x" || die "kopiowanie źródeł nie powiodło się" 4
  if [[ -n $STALE ]]; then
    log "usuwam z $APP_DIR/src pliki eksperymentu, których nie ma już w origin/main ($(wc -l <<<"$STALE") plików)"
    { printf 'set -e\ncd %q\n' "$APP_DIR/src"; while IFS= read -r f; do printf 'rm -f -- %q\n' "$f"; done <<<"$STALE"
      printf '%s\n' 'find app lib scripts tests docs -type d -empty -delete 2>/dev/null || true'; } | remote_read || die "nie udało się usunąć starych plików" 4
  fi
  # Anything else the server has that git does not (report only; the deploy builds from src/).
  extra=$(comm -13 <(git ls-tree -r --name-only origin/main | sort -u) \
    <(echo "cd $APP_DIR/src && find . -type f -not -path './node_modules/*' -not -path './.next/*' | sed 's#^\./##' | sort -u" | remote_read))
  [[ -n $extra ]] && { log "UWAGA: w src/ są pliki spoza origin/main (nie usuwam):"; printf '    %s\n' $extra | head -20; }

  remote "./deploy.sh $TAG w tmux (log: deploy-$TAG_PREFIX.log)" <<REMOTE
set -euo pipefail
cd "$APP_DIR"
tmux new-session -d -s "$TAG_PREFIX-$TAG" "./deploy.sh $TAG > deploy-$TAG_PREFIX.log 2>&1"
until grep -qE 'OK: polutek-app|FAILED|migration failed|\] ERROR: ' deploy-$TAG_PREFIX.log 2>/dev/null; do sleep 10; done
grep -E '^\[deploy' deploy-$TAG_PREFIX.log | tail -2
grep -q 'OK: polutek-app' deploy-$TAG_PREFIX.log
REMOTE
  [[ $? -eq 0 ]] || die "wdrożenie nie powiodło się (deploy.sh sam przywraca poprzedni obraz; flaga jest off)" 4
fi

# --------------------------------------------------------------------------- 6. cleanup on the server
remote "kopia bazy, eksport i usunięcie mapowania dostępu xp.premium_pass% (NIE wierszy Payment), usunięcie PREMIUM_PASS_* z app.env, restart" <<REMOTE
set -euo pipefail
/opt/serwerek/scripts/backup.sh
cd "$APP_DIR"
ts=\$(date -u +%Y%m%dT%H%M%S)
# The grants are the only record of who had access until when: save them to a file before they are deleted.
docker exec -i $DB_CONTAINER sh -c 'psql -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -tA' <<'SQL' > "premium-pass-grants-\$ts.tsv"
SELECT key || E'\t' || value FROM "AppSetting" WHERE key LIKE 'xp.premium\_pass%';
SQL
echo "eksport dostępów: $APP_DIR/premium-pass-grants-\$ts.tsv"
# Only the access mapping goes. The Payment ledger (real money, refunds, disputes) is never touched.
docker exec -i $DB_CONTAINER sh -c 'psql -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL'
DELETE FROM "AppSetting" WHERE key LIKE 'xp.premium\_pass%';
SQL
cp -p app.env "app.env.bak-premium-pass-clean-\$ts"
sed -i '/^PREMIUM_PASS_/d' app.env
APP_IMAGE="\$(cat .current-image)" docker compose up -d --no-deps app >/dev/null
for _ in \$(seq 1 50); do
  s=\$(docker inspect -f '{{.State.Health.Status}}' "\$(docker compose ps -q app)" 2>/dev/null || echo unknown)
  [ "\$s" = healthy ] && break
  sleep 3
done
echo "app: \$s"
AI_AGENT=premium-pass-revert ai-log "premium-pass: pełne wycofanie: backup, eksport i DELETE xp.premium_pass% (Payment nietknięte), usunięte PREMIUM_PASS_* z app.env (kopia app.env.bak-premium-pass-clean-\$ts), restart"
REMOTE
[[ $? -eq 0 ]] || die "sprzątanie na serwerze nie powiodło się" 4

# --------------------------------------------------------------------------- 7. verification
verify_public
verify_full
summary
