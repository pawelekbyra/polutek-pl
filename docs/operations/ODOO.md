# Odoo (firma.pawelperfect.com): obsługa

Stan zweryfikowany na serwerze: **2026-11-03**. Odoo 19 Community, środowisko **testowe** firmy „Paweł Perfect” (JDG na ryczałcie), z własnym modułem `l10n_pl_jdg_ryczalt`.
Dokument odtworzony 2026-11-03 po tym, jak `deploy.sh` usunął wersję zapisaną tylko na serwerze (patrz „Dokumentacja a deploy” w [`SERWEREK.md`](SERWEREK.md) i `CLAUDE.md`, rozdz. 9).
Wszystkie kwoty w module to szacunek, nie porada podatkowa.

## Co działa i gdzie leży

| Rzecz | Wartość |
|---|---|
| Adres | `https://firma.pawelperfect.com/web/login` (Cloudflare Tunnel `serwerek`, hostname `firma.pawelperfect.com` → `http://127.0.0.1:3200`) |
| Katalog na serwerze | `/opt/serwerek/apps/odoo/` (`docker-compose.yml`, `odoo.conf.tmpl`, `render-config.sh`, `nginx/`, `addons/`, `oca/`) |
| Dane | `/opt/serwerek/data/odoo/pg` (Postgres, ok. 165 MB), `/opt/serwerek/data/odoo/odoo-data` (filestore, ok. 16 MB) |
| Kontenery (projekt compose `odoo`) | `odoo-db-1` (`postgres:17-alpine`, 512 MB, 1 CPU), `odoo-odoo-1` (`odoo:19.0-20261015`, **przypięty tag**, 2,5 GB, 2 CPU), `odoo-proxy-1` (`nginx:1.27-alpine`, 64 MB, tylko `127.0.0.1:3200`) |
| Sieć | `odoo_net`; brak publicznych portów |
| Baza | `pawelperfect` (jedyna; `dbfilter = ^pawelperfect$`, `list_db = False`) |
| Zainstalowane moduły (poza rdzeniem) | `account`, `contacts`, `auth_totp`, `l10n_pl`, `l10n_pl_bank_verification`, `l10n_pl_edi`, `l10n_pl_edi_jst`, `currency_rate_update`, `currency_rate_update_nbp` (OCA), `l10n_pl_jdg_ryczalt` 19.0.3.0.0 |
| Kod modułu | repozytorium: `odoo/addons/l10n_pl_jdg_ryczalt/` (README i CHANGELOG w środku), `odoo/deploy/`, `odoo/README.md` |
| Moduły OCA | `/opt/serwerek/apps/odoo/oca/` przypięte do commitów (`PINS.txt`): `currency_rate_update` (OCA/currency 19.0), `currency_rate_update_nbp` (OCA/l10n-poland 19.0), licencja AGPL-3 |

Limity pamięci są twarde: serwer (CX33, 8 GB RAM) dzieli ją z produkcją (strona, baza, Redis, enkoder, PP Support). Nie podnoś ich bez sprawdzenia `free -m`.
`odoo.conf`: `workers = 2`, `max_cron_threads = 1`, `limit_memory_soft/hard` 768 MB / 1 GB na proces, `proxy_mode = True`, `without_demo = True`, brak poczty wychodzącej (środowisko testowe).

## Uruchomienie, zatrzymanie, logi

    cd /opt/serwerek/apps/odoo
    ./render-config.sh            # tylko gdy brakuje .env / odoo.conf.env (tworzy je z /root/.ai-secrets/odoo.env; nic nie wypisuje)
    docker compose up -d          # start całości (db → odoo → proxy)
    docker compose ps             # powinno być: wszystkie healthy
    docker compose stop           # zatrzymanie (dane zostają)
    docker restart odoo-odoo-1    # sam Odoo (np. po zmianie kodu modułu)
    docker logs --tail 100 odoo-odoo-1

Kontrola zdrowia: `docker exec odoo-odoo-1 curl -fsS http://127.0.0.1:8069/web/health`, z zewnątrz `curl -sI https://firma.pawelperfect.com/web/login` (oczekiwane 200).
Nie używaj `docker compose down -v` ani nie kasuj `/opt/serwerek/data/odoo` (to jedyna kopia bazy i załączników poza backupem).

## Sekrety (tylko lokalizacje)

| Gdzie | Co |
|---|---|
| `/root/.ai-secrets/odoo.env` | zmienne: `ODOO_URL`, `ODOO_DB`, `ODOO_LOGIN`, `ODOO_PASSWORD`, `ODOO_MASTER_PASSWORD`, `ODOO_DB_PASSWORD` (dostęp agentów: [`AGENT_ACCESS.md`](AGENT_ACCESS.md)) |
| `/opt/serwerek/apps/odoo/.env`, `odoo.conf.env` | pliki 600 renderowane z powyższego przez `render-config.sh`; **nie trafiają do repozytorium** ani do `configs-*.tar.gz` (wyłączone wzorcem `*.env`) |
| offsite | `backup.sh` dołącza `/root/.ai-secrets/odoo.env` oraz pliki `.env` z `apps/` do zaszyfrowanego (age) `secrets-<ts>.tar.gz.age` w R2 |

Rotacja hasła bazy lub master: zmień wartość w `odoo.env`, `./render-config.sh`, a hasło roli `odoo` w Postgresie zmień osobno (`ALTER ROLE`), potem `docker compose up -d`. Nigdy nie wklejaj wartości do czatu, logów ani dokumentów.

## Kopie zapasowe i odtwarzanie

Nocny `backup.sh` (timer `serwerek-backup.timer`, 02:30) robi dla Odoo:
* `pg-odoo-db-1-<ts>.sql.gz`: `pg_dumpall` bazy Odoo (kontener wykrywany automatycznie jako „oportunistyczny”; **nie jest w `BACKUP_REQUIRED_DBS`**, więc brak tej kopii nie oznacza statusu `fail`),
* `odoo-filestore-<ts>.tar.gz`: katalog `filestore` z `odoo-data`,
* konfigurację (`apps/odoo` bez plików env) w `configs-<ts>.tar.gz`; wszystko szyfrowane do R2, lokalnie 7 dni (zasady ogólne: `/opt/serwerek/backups/RESTORE.md`, [`SERWEREK.md`](SERWEREK.md) rozdz. 23).
* Przed każdą aktualizacją modułu `odoo/deploy/deploy-odoo-addon.sh` robi `pg_dump` do `/opt/serwerek/backups/odoo/pre-l10n_pl_jdg_ryczalt-<ts>.sql.gz` (i tarball poprzedniego modułu).

Ręczna kopia przed ryzykowną zmianą:

    docker exec odoo-db-1 pg_dump -U odoo pawelperfect | gzip > /opt/serwerek/backups/odoo/manual-$(date +%Y%m%dT%H%M%S).sql.gz

Odtworzenie bazy z kopii `pre-*` / `manual-*` (jedna baza, bez CREATE DATABASE):

    cd /opt/serwerek/apps/odoo
    docker stop odoo-odoo-1                                   # nikt nie może być połączony z bazą
    docker exec odoo-db-1 psql -U odoo -d postgres -c 'DROP DATABASE pawelperfect'
    docker exec odoo-db-1 psql -U odoo -d postgres -c 'CREATE DATABASE pawelperfect OWNER odoo'
    gunzip -c /opt/serwerek/backups/odoo/<plik>.sql.gz | docker exec -i odoo-db-1 psql -U odoo -d pawelperfect
    docker start odoo-odoo-1

Odtworzenie z nocnej kopii `pg-odoo-db-1-<ts>.sql.gz` (to `pg_dumpall`, zawiera `CREATE DATABASE`): ten sam początek (stop Odoo, `DROP DATABASE pawelperfect`), potem
`gunzip -c pg-odoo-db-1-<ts>.sql.gz | docker exec -i odoo-db-1 psql -U odoo -d postgres` (komunikaty „role odoo already exists” są nieszkodliwe). Filestore: zatrzymaj Odoo, rozpakuj
`tar xzf odoo-filestore-<ts>.tar.gz -C /opt/serwerek/data/odoo/odoo-data` i uruchom Odoo. Kopie offsite najpierw odszyfruj (procedura w `RESTORE.md`, klucz prywatny age jest tylko u właściciela).

**Nie zweryfikowano:** pełnego odtworzenia Odoo z nocnej kopii na świeżym kontenerze (cotygodniowy `serwerek-restore-test` dotyczy innych baz). Kroki wyżej wynikają ze skryptów i zachowania `pg_dump/pg_dumpall`; przed poleganiem na nich zrób próbę na kopii.

## Dodanie lub aktualizacja własnego modułu (`addons/`)

Moduł `l10n_pl_jdg_ryczalt` wdraża skrypt z repozytorium (na serwerze, w klonie repo):

    odoo/deploy/run-tests.sh          # testy w tymczasowym kontenerze z własnym Postgresem (sprząta po sobie; nie dotyka bazy produkcyjnej)
    odoo/deploy/deploy-odoo-addon.sh  # kopia bazy → podmiana katalogu → -i / -u → restart → kontrola healthy; przy błędzie wraca poprzedni katalog

Skrypt ma na sztywno nazwę modułu `l10n_pl_jdg_ryczalt` i `ODOO_DIR=/opt/serwerek/apps/odoo`. Dla **nowego** modułu: wgraj katalog do `odoo/addons/<moduł>/` w repo, skopiuj `deploy-odoo-addon.sh` z podmienioną zmienną `ADDON`
(albo ją sparametryzuj), wykonaj kopię bazy, potem `docker exec odoo-odoo-1 odoo -d pawelperfect -i <moduł> --stop-after-init --no-http --workers=0 --max-cron-threads=0` i `docker restart odoo-odoo-1`.
Moduły OCA: pobierz tarball przypiętego commita do `apps/odoo/oca/<moduł>/`, dopisz commit do `oca/PINS.txt`, zainstaluj tak samo (`-i`). Katalogi `addons/` i `oca/` są montowane w kontenerze (addons zapisywalne, oca tylko do odczytu).
Dane reguł podatkowych w module są `noupdate=1`: edycje właściciela przetrwają aktualizację.

## Aktualizacja wersji Odoo

Obraz jest przypięty (`odoo:19.0-20261015`, wydanie 19.0 z 2026-10-15), więc nic się nie zmienia samo. Aktualizacja w obrębie 19.0 (poprawki):
1. Kopia ręczna (wyżej) i `df -h /` (potrzeba kilku GB wolnego miejsca; dysk jest zapełniony w ok. 82%).
2. Zmień tag w `docker-compose.yml` oraz w `ODOO_IMAGE` w `odoo/deploy/run-tests.sh`; uruchom `run-tests.sh` z nowym obrazem.
3. `docker compose pull odoo && docker compose up -d odoo`, potem
   `docker exec odoo-odoo-1 odoo -d pawelperfect -u all --stop-after-init --no-http --workers=0 --max-cron-threads=0`, `docker restart odoo-odoo-1`, sprawdź `docker compose ps`.
4. Wycofanie: poprzedni tag w compose + odtworzenie bazy z kopii z kroku 1.

Zmiana wersji **głównej** (Odoo 20) to osobny projekt (OpenUpgrade lub własna migracja, moduły OCA muszą mieć gałąź 20.0); nie jest planowana. Wsparcie 19.0: do ok. września 2028 (raport `research-odoo/RAPORT.md`).
Postgres 17 w kontenerze `odoo-db-1`: zmiana wersji głównej wymaga dumpu i ponownego załadowania, nie wystarczy zmiana tagu.

## Zabezpieczenia

* Brak publicznych portów: Odoo i proxy tylko w sieci `odoo_net`, proxy na `127.0.0.1:3200`; ruch wchodzi wyłącznie przez Cloudflare Tunnel.
* `nginx/default.conf`: `/web/database*`, `/xmlrpc/db`, `/xmlrpc/2/db`, `/jsonrpc` zwracają 404; limit logowania 10 żądań/min na IP (burst 10, odpowiedź 429); prawdziwy IP z `CF-Connecting-IP`; `server_tokens off`.
* `list_db = False`, `dbfilter = ^pawelperfect$`, hasło master i hasło bazy tylko w plikach 600.
* **noindex**: nagłówek `X-Robots-Tag: noindex, nofollow, noarchive` na wszystkich odpowiedziach oraz `GET /robots.txt` → `Disallow: /` (obie rzeczy w nginx; nie zmieniaj).
* Moduł `auth_totp` jest zainstalowany (2FA dla użytkowników); **czy 2FA jest włączone dla konta właściciela, nie zostało sprawdzone**.
* Nie ma Cloudflare Access przed `firma.pawelperfect.com` (Access chroni `admin`, `support`, `test`, `apptest`). Ochroną jest logowanie Odoo, limit żądań i brak listy baz. Zalecane (nie wdrożone): aplikacja Access dla tego hosta.
* Interfejs JSON-2 (`/json/2/...`) nie jest blokowany w nginx; wymaga klucza API użytkownika (do integracji z aplikacją, jeśli powstanie).

## Znane ograniczenia i ryzyka

* To środowisko testowe: dane to wpisy testowe (tabela ewidencji `jdg_income_entry` jest pusta na dzień 2026-11-03). Przed użyciem do realnych rozliczeń potrzebne: decyzje księgowe (stawka ryczałtu, VAT, KSeF), poczta wychodząca, 2FA, Access, osobna kopia i test odtworzenia.
* Odoo Community nie ma gotowych: KPiR/ewidencji ryczałtowej, JPK_V7, PIT-28 (moduł je tylko szacuje). KSeF (`l10n_pl_edi`) wymaga certyfikatu; w module faktur pole numeru KSeF jest tylko informacyjne.
* Kopia bazy Odoo jest „oportunistyczna” (brak w `BACKUP_REQUIRED_DBS`): gdyby kontener `odoo-db-1` nie działał, backup tego nie zgłosi jako błąd. Sprawdzaj obecność świeżego `pg-odoo-db-1-*.sql.gz`.
* Jeden serwer dla wszystkiego: restart/OOM Odoo nie dotyka produkcji (limity), ale ciężkie operacje (`-u all`, testy) obciążają wspólne 4 vCPU; używaj `nice` i unikaj godzin wdrożeń produkcji (`.deploy.lock`).
* Obraz `odoo:19.0-...` pochodzi z Docker Hub bez weryfikacji podpisu; aktualizuj świadomie.

## Powiązane dokumenty

[`SERWEREK.md`](SERWEREK.md) (serwer, backup, tunel) · [`AGENT_ACCESS.md`](AGENT_ACCESS.md) · [`HANDOFF-SERVER-AGENT.md`](HANDOFF-SERVER-AGENT.md) · [`ACCOUNTS.md`](ACCOUNTS.md) ·
[`STATIC-DEMO.md`](STATIC-DEMO.md) · [`DZIENNIKARSKI-EKSPERYMENT.md`](DZIENNIKARSKI-EKSPERYMENT.md) · [`NASZA-GAZETKA.md`](NASZA-GAZETKA.md) · [`DOMENA-PAWELPERFECT-PL.md`](DOMENA-PAWELPERFECT-PL.md) ·
`odoo/README.md` i `odoo/addons/l10n_pl_jdg_ryczalt/README.md` w repozytorium.
