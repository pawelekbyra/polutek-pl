#!/usr/bin/env bash
# Testy modułu l10n_pl_jdg_ryczalt w TYMCZASOWYM kontenerze Odoo z własnym Postgresem (osobna sieć, bez portów,
# limit pamięci ~1,5 GB). Po testach wszystko jest usuwane. Nie dotyka produkcji ani bazy `pawelperfect`.
#
# Użycie (na serwerze):   odoo/deploy/run-tests.sh [tagi testów]
#   domyślnie tagi: /l10n_pl_jdg_ryczalt  (wszystkie testy modułu)
set -euo pipefail

ADDONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../addons" && pwd)"
IMAGE="${ODOO_IMAGE:-odoo:19.0-20261015}"      # ten sam przypięty obraz co w /opt/serwerek/apps/odoo
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
TAGS="${1:-/l10n_pl_jdg_ryczalt}"
SUFFIX="$$"
NET="jdgtest_net_${SUFFIX}"
DB_C="jdgtest-db-${SUFFIX}"
ODOO_C="jdgtest-odoo-${SUFFIX}"
DBNAME="jdgtest"

cleanup() {
  docker rm -f "$ODOO_C" "$DB_C" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

free -m | sed -n 2p
docker network create "$NET" >/dev/null
docker run -d --name "$DB_C" --network "$NET" --memory 512m --cpus 1 \
  -e POSTGRES_USER=odoo -e POSTGRES_PASSWORD=test -e POSTGRES_DB=postgres "$PG_IMAGE" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$DB_C" pg_isready -U odoo >/dev/null 2>&1 && break
  sleep 1
done

# nice: serwer dzieli CPU z produkcją
nice -n 10 docker run --rm --name "$ODOO_C" --network "$NET" --memory 1536m --cpus 2 \
  -e HOST="$DB_C" -e USER=odoo -e PASSWORD=test -e TZ=Europe/Warsaw \
  -v "$ADDONS_DIR":/mnt/extra-addons:ro \
  "$IMAGE" odoo -d "$DBNAME" \
    --db_host="$DB_C" --db_user=odoo --db_password=test \
    --addons-path=/usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons \
    -i l10n_pl_jdg_ryczalt --without-demo=all --test-enable --test-tags "$TAGS" \
    --stop-after-init --no-http --workers=0 --max-cron-threads=0 --log-level=test 2>&1 \
  | tee /tmp/jdg-test-run.log | grep -E "ERROR|FAIL|Ran [0-9]+ tests|tests in|jdg|WARNING" | grep -v "Cannot find translation" | tail -80 || true

echo "--- podsumowanie ---"
grep -E "Ran [0-9]+ tests|failed, [0-9]+ error|0 failed, 0 error" /tmp/jdg-test-run.log | tail -3 || true
if grep -qE "(FAIL:|ERROR:|[1-9][0-9]* failed|[1-9][0-9]* error\(s\))" /tmp/jdg-test-run.log; then
  echo "TESTY: BŁĄD (pełny log: /tmp/jdg-test-run.log)"; exit 1
fi
echo "TESTY: OK"
