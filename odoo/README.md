# Odoo (back-office firmy)

Katalog osobny od aplikacji Next.js: nic tu nie jest przetwarzane przez `npm run lint/test/typecheck` ani wchodzi do obrazu aplikacji
(`.dockerignore`, `eslint.config.mjs`, `tsconfig*.json` mają wyłączenie `odoo`).

* `addons/l10n_pl_jdg_ryczalt/`: moduł Odoo 19 Community „Firma: JDG na ryczałcie” (README w środku).
* `deploy/run-tests.sh`: testy w tymczasowym kontenerze Odoo z własnym Postgresem (sprząta po sobie).
* `deploy/deploy-odoo-addon.sh`: wdrożenie/aktualizacja do `/opt/serwerek/apps/odoo/addons` z kopią bazy przed `-u`.

Środowisko Odoo (docker-compose, `firma.pawelperfect.com`) opisuje `/opt/serwerek/apps/odoo` i `docs/operations/ODOO.md`.
Sekretów w repozytorium nie ma; dane logowania leżą w `/root/.ai-secrets/odoo.env` na serwerze.

Wszystkie kwoty w module to szacunek, nie porada podatkowa.
