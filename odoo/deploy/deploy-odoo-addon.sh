#!/usr/bin/env bash
# Wdrożenie / aktualizacja modułu l10n_pl_jdg_ryczalt do działającego Odoo (/opt/serwerek/apps/odoo).
#
#   1. kopia bazy `pawelperfect` (pg_dump) i poprzedniej wersji katalogu modułu,
#   2. podmiana katalogu w /opt/serwerek/apps/odoo/addons,
#   3. `-i` (pierwsza instalacja) albo `-u` (aktualizacja) na bazie,
#   4. restart kontenera Odoo i sprawdzenie zdrowia,
#   5. przy błędzie: przywrócenie poprzedniego katalogu modułu i restart (baza: polecenie przywrócenia w komunikacie).
#
# Użycie:  odoo/deploy/deploy-odoo-addon.sh            (źródło: katalog repozytorium, w którym leży skrypt)
# Sekretów nie wypisuje. Aplikacji Next.js NIE dotyka.
set -euo pipefail

ADDON="l10n_pl_jdg_ryczalt"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../addons/${ADDON}" && pwd)"
ODOO_DIR="${ODOO_DIR:-/opt/serwerek/apps/odoo}"
TARGET="${ODOO_DIR}/addons/${ADDON}"
BACKUPS="${BACKUPS:-/opt/serwerek/backups/odoo}"
DB="${ODOO_DB:-pawelperfect}"
STAMP="$(date +%Y%m%dT%H%M%S)"
mkdir -p "$BACKUPS"

echo "== 1/5 kopia bazy i poprzedniej wersji modułu"
DUMP="${BACKUPS}/pre-${ADDON}-${STAMP}.sql.gz"
docker exec odoo-db-1 pg_dump -U odoo "$DB" | gzip > "$DUMP"
[ -s "$DUMP" ] || { echo "BŁĄD: pusta kopia bazy"; exit 1; }
echo "   baza: $DUMP ($(du -h "$DUMP" | cut -f1))"
PREV=""
if [ -d "$TARGET" ]; then
  PREV="${BACKUPS}/${ADDON}-${STAMP}.tar.gz"
  tar -czf "$PREV" -C "${ODOO_DIR}/addons" "$ADDON"
  echo "   moduł: $PREV"
fi

rollback() {
  echo "!! BŁĄD: przywracam poprzednią wersję modułu"
  rm -rf "$TARGET"
  [ -n "$PREV" ] && tar -xzf "$PREV" -C "${ODOO_DIR}/addons"
  docker restart odoo-odoo-1 >/dev/null || true
  echo "   Jeśli aktualizacja zdążyła zmienić bazę, przywróć ją:"
  echo "   gunzip -c $DUMP | docker exec -i odoo-db-1 psql -U odoo -d $DB   (po wyczyszczeniu bazy; zatrzymaj Odoo)"
}
trap 'rollback' ERR

echo "== 2/5 podmiana katalogu modułu"
rm -rf "${TARGET}.new"
cp -a "$SRC" "${TARGET}.new"
find "${TARGET}.new" -name __pycache__ -type d -prune -exec rm -rf {} +
rm -rf "$TARGET"
mv "${TARGET}.new" "$TARGET"

echo "== 3/5 instalacja lub aktualizacja w bazie $DB"
STATE="$(docker exec odoo-db-1 psql -U odoo -d "$DB" -Atc "select state from ir_module_module where name='${ADDON}'" || true)"
if [ "$STATE" = "installed" ]; then FLAG="-u"; else FLAG="-i"; fi
echo "   tryb: $FLAG (stan: ${STATE:-brak})"
docker exec odoo-odoo-1 odoo -d "$DB" "$FLAG" "$ADDON" --stop-after-init --no-http --workers=0 --max-cron-threads=0 2>&1 \
  | grep -E "ERROR|CRITICAL|Traceback|modules loaded|jdg" | tail -30 || true
docker exec odoo-db-1 psql -U odoo -d "$DB" -Atc "select state from ir_module_module where name='${ADDON}'" | grep -qx installed

echo "== 4/5 restart Odoo i zdrowie"
docker restart odoo-odoo-1 >/dev/null
for _ in $(seq 1 40); do
  status="$(docker inspect -f '{{.State.Health.Status}}' odoo-odoo-1 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  sleep 5
done
[ "$status" = "healthy" ] || { echo "Odoo nie wrócił do stanu healthy (status: $status)"; false; }

echo "== 5/5 kontrola"
VER="$(docker exec odoo-db-1 psql -U odoo -d "$DB" -Atc "select latest_version from ir_module_module where name='${ADDON}'")"
echo "OK: ${ADDON} ${VER} zainstalowany w ${DB}, Odoo healthy. Kopie: $DUMP"
trap - ERR
