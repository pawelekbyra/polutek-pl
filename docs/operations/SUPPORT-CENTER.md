# PP Support (centrum obslugi): runbook (stan faktyczny 2026-10-03)

PP Support to nasza wspolna skrzynka obslugi klienta dla `support@pawelperfect.com`. Architektura i decyzje: [`../architecture/support-center.md`](../architecture/support-center.md). Serwer: [`SERWEREK.md`](SERWEREK.md). Oprogramowanie osob trzecich, ktore za tym stoi, i jego licencja: wylacznie [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Kazda zmiane na serwerze loguj: `AI_AGENT=<nazwa> ai-log "..."`.

Nazwy techniczne (ujednolicone 2026-10-03): katalogi `/opt/serwerek/apps/pp-support` i `/opt/serwerek/data/pp-support`, baza i rola Postgresa `pp_support`, plik zapasowy `pp-support-storage-<ts>.tar.gz`, plik sekretow wlasciciela `pp-support.env` (zmienne `PP_SUPPORT_*`), token agenta `/opt/serwerek/secrets/pp-support-ai-agent.token`, klucz Resend `pp-support-smtp`. Kontenery i projekt compose nazywaja sie `pp-support`. Kopie i rollback zmiany nazw: sekcja 8 ("Rollback zmiany nazw"). Pelny przewodnik uzytkownika: [`PP-SUPPORT-GUIDE.md`](PP-SUPPORT-GUIDE.md).

## 1. Co stoi

| Element | Gdzie | Uwagi |
|---|---|---|
| PP Support: obraz `pp-support:4.18.0` | `/opt/serwerek/apps/pp-support/` (`docker-compose.yml` i `overrides/` z repo: `deploy/serwerek/support/`) | projekt compose `pp-support`, kontenery `pp-support-{web,sidekiq,db,redis}-1`. Pochodzenie obrazu i aktualizacja: THIRD_PARTY_NOTICES.md |
| Panel | `https://support.pawelperfect.com` -> Tunnel -> `127.0.0.1:3010` | za Cloudflare Access (aplikacja `serwerek support`, id `273775f8-e33a-40f6-bfd1-dd256bf588c6`, polityka `serwerek owners`) |
| Warstwa marki | Worker `pp-support-brand` (kod: `workers/support-brand/`), trasa `support.pawelperfect.com/*` | CSS, font Geist, ikony, manifest PWA, ukrywanie upsellu, podmiana nazwy; sekcja 8 |
| Ingress poczty | `/rails/action_mailbox/relay/inbound_emails` | osobna aplikacja Access `serwerek support mail ingest` (id `b13af5cd-4bd1-4f51-8069-f41e88a86990`), tylko service token `support-mail-ingest` (id `986f99d4-8b70-41bb-8ef0-8cd58ec464d1`) + haslo basic auth |
| Email Worker | `polutek-support-mail` (kod: `workers/support-mail-ingest/`, deploy: `node workers/support-mail-ingest/deploy.mjs`) | archiwum: `pawel.perfect@gmail.com` (adres zweryfikowany w Email Routing konta) |
| Email Routing | strefy `pawelperfect.com` i `pawelperfect.pl`: MX Cloudflare na apexie (od 2026-10-02, sekcja 6), reguly `support@`/`hello@`/catch-all -> Worker; `.com` ma tez subdomene `inbound.pawelperfect.com` | Worker ma allowliste odbiorcow |
| Dane | `/opt/serwerek/data/pp-support/{pg,redis,storage}` | Postgres `pgvector/pgvector:0.8.7-pg17` (baza/rola `pp_support`), Redis 7 `noeviction` |
| Sekrety | `/opt/serwerek/apps/pp-support/.env` (root, 600): `SECRET_KEY_BASE`, `POSTGRES_PASSWORD`, `RAILS_INBOUND_EMAIL_PASSWORD`, `SMTP_PASSWORD` (klucz Resend `pp-support-smtp`, sending-only, domena `pawelperfect.com`) | **szosty dozwolony plik z sekretem na serwerze** (obok SERWEREK.md §4 i `cron.env`); kopia u wlasciciela: `%USERPROFILE%\.ai-secrets\pp-support.env` (+ `SUPPORT_ACCESS_CLIENT_ID/SECRET` w `secrets.env`). Backup nocny NIE zawiera `.env` |
| Skrzynka | konto "PP Support", skrzynka "Wsparcie" (kanal e-mail `support@pawelperfect.com`, SMTP Resend 587 STARTTLS ustawione na kanale) | uzytkownik `hello@pawelperfect.com` (SuperAdmin + administrator) |

Wszystko slucha tylko na `127.0.0.1` (web `:3010`, db `:5434`); UFW/Hetzner bez zmian (tylko 22/tcp).

## 2. Limity pamieci (4 GB RAM + 4 GB swap)

| Kontener | `mem_limit` | Zmierzone (spoczynek 2026-10-02) |
|---|---|---|
| web (puma, 1 proces, 3 watki) | 700 MB | ok. 375 MB |
| sidekiq (wspolbieznosc 3) | 640 MB | ok. 480 MB |
| db (pgvector, `shared_buffers=64MB`) | 256 MB | ok. 70 MB |
| redis | 128 MB (`maxmemory 96mb`) | ok. 5 MB |
| **Razem PP Support** | 1,7 GB limity | **ok. 0,93 GB faktycznie** |

Reszta stosu: aplikacja ok. 130 MB, jej baza ok. 75 MB, Redis/SRH ok. 17 MB. Dostepne po uruchomieniu wszystkiego ok. 1,3 GB (razem z cache). **Uwaga na enkoder wideo**: `encoder` ma `mem_limit 1500m`; razem z PP Support (0,93 GB) przekroczy 4 GB RAM i zacznie uzywac swapu (alert health: `ram-avail-under-300mb` / `swap-over-2gb`). Zasada: enkoder tylko gdy serwer jest bezczynny, a przy kodowaniu ponad ok. 1 GB RAM rozwazyc ograniczenie enkodera do 1000 MB albo **CPX32 (8 GB RAM)** (decyzja wlasciciela, koszt). Gdy trzeba chwilowo zwolnic pamiec: `docker compose stop sidekiq web` (poczta przychodzaca dalej trafia do archiwum Gmail, a ingest zwroci blad do naglowka `X-Support-Ingest`; wiadomosci z okna wylaczenia wrzuc potem recznie, sekcja 5).

## 3. Codzienna obsluga

```
ssh serwerek 'cd /opt/serwerek/apps/pp-support && docker compose ps && docker stats --no-stream'
ssh serwerek 'cd /opt/serwerek/apps/pp-support && docker compose logs --since 30m web sidekiq | tail -50'
curl -s http://127.0.0.1:3010/api        # na serwerze: {"version":"4.18.0",...,"queue_services":"ok","data_services":"ok"}
```

- Restart: `docker compose restart web sidekiq`. Start po restarcie serwera: kontenery maja `restart: unless-stopped`.
- Monitoring: `health.sh` (co 5 min) sprawdza 4 kontenery `pp-support-*` i `:3010/api`; WARN -> mail na `hello@pawelperfect.com`.
- Logowanie do panelu: otworz `https://support.pawelperfect.com`, Access: wpisz `hello@pawelperfect.com` lub `pawel.perfect@gmail.com`, kod PIN z poczty; potem logowanie do PP Support. **Haslo konta nie zostalo nigdzie zapisane**: przy pierwszym logowaniu uzyj "Nie pamietam hasla" (mail przyjdzie na `hello@pawelperfect.com`, czyli do skrzynki PP Support). Dodatkowych agentow: Ustawienia, Agenci (adres musi tez byc na polityce Access `serwerek owners`, SERWEREK.md §9 pkt 5).
- Aktualizacja silnika: tylko wg THIRD_PARTY_NOTICES.md (nowy obraz i tag), potem `backup.sh`, `docker compose --profile tools run --rm prepare` (migracje), `docker compose up -d`, `./apply-brand.sh`, sprawdzenie plikow w `overrides/`.
- Wdrozenie plikow z repo: `cd deploy/serwerek/support && tar czf - docker-compose.yml apply-brand.sh apply-brand.rb overrides | ssh serwerek 'cd /opt/serwerek/apps/pp-support && tar xzf - && chmod -R a+rX overrides && docker compose up -d'` (zmiana pliku zamontowanego woluminem wymaga `docker compose up -d --force-recreate web sidekiq`).
- Pierwsze uruchomienie (odtworzenie od zera): katalogi `/opt/serwerek/data/pp-support/{pg,redis,storage}`, `.env` (4 klucze), obraz `pp-support:<ver>` (THIRD_PARTY_NOTICES.md), `docker compose up -d db redis`, `docker compose --profile tools run --rm prepare` (migracje + seed, ok. 15 s), `docker compose up -d web sidekiq`, `./apply-brand.sh`; konto przez `AccountBuilder` w `rails runner`; skrzynka przez `Channel::Email`. Ingress, Worker i Access: sekcja 5.

## 4. Backup i odtwarzanie

`/opt/serwerek/scripts/backup.sh` (cron 02:30): `pg_dumpall` kazdego kontenera z "postgres" **lub "pgvector"** w nazwie obrazu (wiec `pg-pp-support-db-1-<ts>.sql.gz`) + `pp-support-storage-<ts>.tar.gz` (zalaczniki). Lokalnie 7 dni, w R2 `serwerek-backups` 14 dni. Skrypt wybiera kontenery po obrazie, nie po nazwie, wiec zmiana nazw kontenerow go nie dotknela. `configs-<ts>.tar.gz` obejmuje `apps/` czyli rowniez `docker-compose.yml` i `overrides/` (bez `.env`). **Nie ma** w backupie `.env` (kopia u wlasciciela, patrz wyzej) ani Redisa (kolejka; nie krytyczny).

Odtworzenie bazy (na czystym kontenerze):
```
cd /opt/serwerek/apps/pp-support && docker compose up -d db
gunzip -c /opt/serwerek/backups/pg-pp-support-db-1-<ts>.sql.gz | docker compose exec -T db psql -U pp_support postgres
tar xzf /opt/serwerek/backups/pp-support-storage-<ts>.tar.gz -C /opt/serwerek/data/pp-support
docker compose up -d redis web sidekiq
```
Bez `SECRET_KEY_BASE` z kopii wlasciciela: sesje i zaszyfrowane pola (np. haslo SMTP kanalu) trzeba wprowadzic od nowa; dane rozmow zostaja.

## 5. Poczta: jak to dziala i jak sprawdzic

- **Wychodzaca**: PP Support -> `smtp.resend.com:587` (STARTTLS), login `resend`, haslo = klucz `pp-support-smtp`. Ustawione w `.env` (`SMTP_PASSWORD`) dla maili systemowych oraz na kanale skrzynki (dla odpowiedzi). Nadawca maili systemowych "PP Support <support@pawelperfect.com>" (`MAILER_SENDER_EMAIL`), odpowiedzi do klientow "Pawel from Wsparcie <support@pawelperfect.com>" (nazwa nadawcy kanalu, do zmiany w panelu: Ustawienia, Skrzynki, Wsparcie). Sprawdzone 2026-10-02: odpowiedz doszla do Gmaila w watku, `dkim=pass`, `spf=pass`, `dmarc=pass`. **Porty 25 i 465 sa blokowane przez Hetznera**; nie zmieniaj na 465.
- **Przychodzaca (test, dziala dzis)**: adres `<uuid>@inbound.pawelperfect.com` (`forward_to_email` skrzynki; panel: Ustawienia, Skrzynki, Wsparcie, Konfiguracja) i odpowiedzi `reply+<uuid>@inbound.pawelperfect.com`. Test z komputera: wyslij mail przez Resend na `support@pawelperfect.com` (`curl` do `api.resend.com/emails`, nadawca na domenie `pawelperfect.com`), po ok. 20-40 s ma byc nowa rozmowa (powtorzone 2026-10-03 po zmianie nazw bindingow Workera: dziala). Pierwsza wiadomosc na swiezo dodana regule moze dostac 550 (propagacja ok. minuty); po twardym odbiciu Resend dodaje adres do listy supresji: `DELETE https://api.resend.com/suppressions/<adres>`.
- **Diagnoza**: kopia w archiwum Gmail ma naglowek `X-Support-Ingest`: `ok` albo `failed:<powod>` (`http-401` = zle haslo/token, `http-403` = Access, `error-...` = PP Support nie odpowiada). Logi Workera: panel Cloudflare, Workers, `polutek-support-mail`, Logs (observability wlaczone). Nieudany ingest: mail jest w archiwum; wrzuc go recznie: `curl -u actionmailbox:<haslo> -H 'content-type: message/rfc822' --data-binary @wiadomosc.eml https://support.pawelperfect.com/rails/action_mailbox/relay/inbound_emails` z naglowkami `CF-Access-Client-Id/Secret` (duplikaty sa odrzucane po Message-ID).
- **Rotacja sekretow ingress**: nowe haslo w `.env` (`RAILS_INBOUND_EMAIL_PASSWORD`) + `docker compose up -d web`; `SUPPORT_INGEST_PASSWORD=<nowe> node workers/support-mail-ingest/deploy.mjs` (reszta z `secrets.env`; binding Workera nazywa sie `INGEST_PASSWORD`). Service token: panel Zero Trust, Access, Service Auth (tokeny wygasaja po roku: 2027-10-02; odnow i ponow deploy Workera).

## 6. Cutover MX (WYKONANY 2026-10-02)

Poczta dla `pawelperfect.com` i `pawelperfect.pl` idzie przez Cloudflare Email Routing -> Worker `polutek-support-mail` -> PP Support (+ kopia do Gmaila). Google Workspace nie odbiera juz poczty. Wlasciciel zrobil Takeout skrzynki `hello@` przed zmiana.

- Reguly (obie strefy): `support@` i `hello@` -> Worker; catch-all -> Worker. **Worker ma allowliste**: do PP Support trafia tylko `support@`, `hello@` (dowolna domena) i adresy na `inbound.*`; reszta (catch-all) tylko do archiwum z `X-Support-Ingest: skipped:unlisted-recipient`. Dla `hello@` i aliasow `.pl` Worker dopisuje `X-Original-To: support@pawelperfect.com`, bo panel dopasowuje skrzynke po To/Cc/X-Original-To (kanal ma adres `support@pawelperfect.com`); bez tego mail na `hello@` jest cicho gubiony (204 bez rozmowy). Test: `worker.mjs` eksportuje `shouldIngest()`.
- DNS: MX Cloudflare (route1-3) na obu apexach, SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, DMARC rua -> `pawel.perfect@gmail.com`. Dawne wartosci i rollback: [`DNS_BACKUP_mail_2026-10-02.md`](DNS_BACKUP_mail_2026-10-02.md) (pelne JSON-y poza repo: `%USERPROFILE%\.ai-secrets\dns-backup\`).
- Testy (po cutoverze): Gmail -> `support@`, `hello@pawelperfect.com`, `hello@pawelperfect.pl` = 3 rozmowy w PP Support; nadawca zewnetrzny (Resend) -> `support@` = rozmowa + kopia w INBOX Gmaila; odpowiedz z PP Support dochodzi jako `support@pawelperfect.com`.

**Rollback (ok. 5 minut + propagacja DNS):** w kazdej strefie usun MX `route*.mx.cloudflare.net` z apexu, dodaj 5 MX Google (priorytety 1, 5, 5, 10, 10: `aspmx.l.google.com`, `alt1..alt4.aspmx.l.google.com`), SPF z powrotem `v=spf1 include:_spf.google.com ~all`, DMARC rua z powrotem na `hello@` (opcjonalnie). Reguly Email Routing zostaja (nieszkodliwe). Poczta wyslana w oknie cutovera jest w PP Support i w archiwum Gmail. Po anulowaniu Workspace rollback nie jest mozliwy.

**Anulowanie Workspace robi wlasciciel** (nie agent), po ok. 7 dniach stabilnej pracy. Potem: usun `google._domainkey` i TXT `google-site-verification`, klucz konta serwisowego `ai-agent`; polityka Access ma `hello@` i Gmail jako e-mail OTP (hello@ odbiera przez PP Support).

## 7. Aplikacja mobilna i push (wlaczone 2026-10-02)

- Access: osobna aplikacja `serwerek support mobile api` (id `d3a34da7-56a6-4174-af72-28957b205819`), polityka `bypass` (everyone) tylko dla sciezek `support.pawelperfect.com/api`, `/auth`, `/cable`, `/rails/active_storage` (zalaczniki/avatary, podpisane URL). Panel (`/`, `/app/*`) zostaje za Access (sprawdzone: 302 do logowania Access; `/api` 200, `/auth/validate_token` 401, websocket `/cable` 101). W oficjalnej aplikacji mobilnej silnika adres serwera: `https://support.pawelperfect.com`. Rollback: usun te aplikacje Access. Warstwa marki (sekcja 8) tych sciezek nie widzi.
- Ochrona logowania: `ENABLE_ACCOUNT_SIGNUP=false` (rejestracja kont wylaczona); limity Rack::Attack (`/auth/sign_in`: 5 prob/5 min na IP, 10/15 min na e-mail, reset hasla 5/30 min); regula Cloudflare rate limit (zestaw `049cd256...`, strefa `pawelperfect.com`): POST `/auth/sign_in` na `support.` > 5 zapytan/10 s z jednego IP = blokada 10 s (plan Free pozwala tylko na okno 10 s). Test: 10 prob pod rzad = 4x 401 potem 429.
- 2FA: PP Support ma 2FA (TOTP) per uzytkownik, **nie da sie go wymusic**. Wlacz w panelu: Profil, Ustawienia profilu, Uwierzytelnianie dwuskladnikowe (kod QR do aplikacji TOTP), dla `hello@` i `pawel.perfect@gmail.com`. Bez 2FA bezpieczenstwo API opiera sie na hasle + limitach; zalecane przed uzyciem aplikacji.
- **Push (jedyna zewnetrzna zaleznosc, zostawiona celowo):** powiadomienia push w oficjalnej aplikacji mobilnej ida przez serwer posredniczacy producenta silnika (`ENABLE_PUSH_RELAY_SERVER`, domyslnie wlaczone): serwer wysyla tam zdarzenie z tytulem/trescia powiadomienia, a stamtad idzie FCM/APNs. Wylaczenie (`ENABLE_PUSH_RELAY_SERVER=false`) kasuje push w aplikacji mobilnej (zostaja powiadomienia w panelu i e-mail). Docelowo oficjalna aplikacja mobilna ma zostac zastapiona **PWA z wlasnymi kluczami VAPID** (Web Push bez posrednika): wtedy relay mozna wylaczyc. Do czasu PWA nic nie ruszamy; nie testowano na telefonie (wymaga urzadzenia i logowania wlasciciela).

## 8. Marka PP Support (2026-10-03)

Produkt wystepuje wszedzie jako **"PP Support"**. Nazwa jest w jednym miejscu: `workers/support-brand/brand.config.json` (pole `name`; kopia dla serwera: `deploy/serwerek/support/overrides/brand.config.json`, ma byc identyczna).

**Zmiana nazwy:** edytuj `brand.config.json` (obie kopie), potem
1. z komputera wlasciciela: `node workers/support-brand/gen-assets.mjs` (logo/ikony; napis w logo to `shortName` bez "PP "), `node workers/support-brand/deploy.mjs` (warstwa Cloudflare, sekrety z `secrets.env`),
2. skopiuj pliki na serwer (sekcja 3) i `ssh serwerek 'cd /opt/serwerek/apps/pp-support && PP_ACCOUNT_NAME="<nowa nazwa>" ./apply-brand.sh && docker compose up -d --force-recreate web sidekiq'`.

Warstwy (od najglebszej):
- **Konfiguracja instalacji w bazie** (`apply-brand.sh` + `apply-brand.rb`, idempotentne, trzeba powtorzyc po aktualizacji silnika): `INSTALLATION_NAME`, `BRAND_NAME` (stopka maili systemowych), `BRAND_URL`, `WIDGET_BRAND_URL`, `TERMS_URL`/`PRIVACY_URL` (nasze strony prawne), `LOGO*` (z `?v=pp1`, podbij po zmianie plikow), `DISPLAY_MANIFEST=false`, puste dane wbudowanego widgetu wsparcia producenta; nazwa konta (`PP_ACCOUNT_NAME`). Plan instalacji (`INSTALLATION_PRICING_PLAN`) nie jest ruszany.
- **Pliki nadpisywane woluminami** (`overrides/`, tylko do odczytu, lista w `docker-compose.yml`): logo i ikona (`public/brand-assets/*`, `manifest.json`, `android-icon-192x192.png`), plik tlumaczen `zz_pp_support.yml` (opisy integracji), 3 maile systemowe (usuniecie konta), widoki konsoli administratora (nazwa; **usuniety wbudowany widget wsparcia producenta** ladowany z cudzego serwera i wysylajacy e-mail/nazwe super-admina), harmonogram `schedule.yml` (bez dziennego sprawdzania wersji u producenta). Po aktualizacji silnika porownaj je z oryginalami w nowym obrazie (diff), bo nadpisuja pliki wewnatrz obrazu.
- **Worker `pp-support-brand`** (Cloudflare Free, `workers/support-brand/`): przepisuje tylko odpowiedzi HTML panelu (HTMLRewriter): ikony, manifest PWA, kolor motywu, opis, `brand.css` (font Geist pod nazwa "Inter", akcent `#2563eb` jak `--chan-blue` strony, ukrycie odnosnikow do stron producenta) i `brand.js` (podmiana wystapien starej nazwy w tekstach i atrybutach interfejsu, ukrycie przyciskow upsell/"Upgrade"/dokumentacji/stopki z wersja, przepiecie linkow regulaminu/prywatnosci na nasze). Zasoby serwuje spod `/pp-support/*` (za Access, nie publiczne).
- **Co Worker omija (trasy bez skryptu, ustawia `deploy.mjs`):** `/api*`, `/auth*`, `/cable*`, `/rails*`, `/webhooks*`, `/vite*`, `/packs*`, `/assets*`. Dzieki temu nie ma wplywu na aplikacje mobilna, agenta AI, websockety, ingress poczty, zalaczniki ani zasoby statyczne. Worker sam tez przepuszcza wszystko, co nie jest `GET` z `Accept: text/html`.
- **Wylaczenie/rollback warstwy Cloudflare (sekundy, bez dotykania serwera):** `node workers/support-brand/deploy.mjs --disable` (Worker staje sie czystym pass-through) albo `--off` (usuwa trasy; panel idzie wprost do origin). Ponowne wlaczenie: `node workers/support-brand/deploy.mjs`.
- **Rollback warstwy serwerowej (marka):** przywroc plik `docker-compose.yml.pre-brand` z kopii `/opt/serwerek/backups/pre-rename-20261003-163142/` (stare nazwy kontenerow; zaktualizuj `health.sh`), `docker compose down && docker compose up -d`. Dane sie nie zmieniaja. Wartosci z `apply-brand.sh` mozna cofnac edycja w konsoli administratora (`/super_admin`) albo ponownym uruchomieniem skryptu z innymi wartosciami.
- **Rollback zmiany nazw katalogow/bazy (2026-10-03):** przed zmiana powstala kopia `/opt/serwerek/backups/pre-rename-20261003-163142/`: `pg-pp-support-dumpall.sql.gz` (`pg_dumpall` przed zmiana), `data-cold.tar.gz` (zimna kopia katalogu danych po `docker compose down`), `docker-compose.yml.old`, `apply-brand.sh.old`, `backup.sh.old`, `env.old` i `env.pre-smtp-rotate` (600). Dawne nazwy katalogow, bazy i roli sa w `docker-compose.yml.old`. Procedura: `docker compose down`; usun katalog danych `pp-support`; `tar xzf data-cold.tar.gz -C /opt/serwerek/data` (przywraca katalog pod dawna nazwa, z baza i rola pod dawnymi nazwami); przenies katalog aplikacji (`mv`) na dawna nazwe i wgraj z kopii `docker-compose.yml.old`, `apply-brand.sh.old`, `.env` (`env.old`), przywroc `backup.sh.old` do `/opt/serwerek/scripts/backup.sh`; odwrotne `mv` pliku tokenu agenta w `/opt/serwerek/secrets`; `docker compose up -d`. Klucz Resend zostal wymieniony (nowy `pp-support-smtp`, stary usuniety): po rollbacku wstaw biezacy klucz do `.env` (`SMTP_PASSWORD`) i na kanale skrzynki. Przebieg zmiany: baza i rola przemianowane przez `ALTER DATABASE/ROLE ... RENAME` na zatrzymanych aplikacjach (okno ok. 2 min), woluminow Dockera nie ma (dane to katalogi bind-mount), wiec nic poza nazwami sie nie zmienilo.
- Test (2026-10-03): panel desktop i mobile, ustawienia, integracje, raporty, centrum pomocy: tytul "PP Support", brak starej nazwy w tekstach, brak odnosnikow do domen producenta, wszystkie zasoby ladowane wylacznie z `support.pawelperfect.com`. Strona logowania i konsola `/super_admin` wymagaja wylogowania (haslo konta: sekcja 3), sprawdzane osobno.

## 9. Kontakty z serwerami producenta oprogramowania (2026-10-03)

Sprawdzone w kodzie obrazu i w ruchu panelu:
- **Przegladarka**: panel laduje zasoby wylacznie z `support.pawelperfect.com` (zadnych czcionek/skryptow z cudzych domen).
- **Serwer, wylaczone konfiguracyjnie:** metryki instancji i zdarzenia (`DISABLE_TELEMETRY=true`), dzienne sprawdzanie wersji (zadanie usuniete z `schedule.yml`, sprawdzone: brak w Sidekiq Cron), wbudowany widget wsparcia w konsoli administratora (usuniety widok + puste dane konfiguracji).
- **Zostaje celowo:** push mobilny przez relay (sekcja 7). Brak innych wywolan.
- Wychodzace maile: wylacznie Resend (`smtp.resend.com`); webhooki, integracje i kanaly zewnetrzne: nieuzywane.
- Jesli po aktualizacji silnika pojawi sie nowe wywolanie, sprawdz w obrazie wystapienia adresow producenta (np. `grep -rn "hub\." lib app`) i zmienne `DISABLE_*` w `docker-compose.yml`.

## 10. Rollback calosci / usuniecie

- Wylacz: `docker compose down` (dane zostaja). Poczta przychodzaca testowa wtedy trafia tylko do archiwum Gmail (Worker nadal dziala; ingest zwroci `failed:error-...`).
- Usun PP Support: `docker compose down -v`, `rm -rf /opt/serwerek/apps/pp-support /opt/serwerek/data/pp-support`; w Cloudflare: `node workers/support-brand/deploy.mjs --off` i usun Workera `pp-support-brand`, usun aplikacje Access (3), service token, DNS `support`, wpis ingress `support.pawelperfect.com`, Workera `polutek-support-mail`, reguly Email Routing i subdomene `inbound`; w Resend: klucz `pp-support-smtp`.

## 11. Znane uwagi

- Port 25/465 wychodzace zablokowane (Hetzner): SMTP tylko 587.
- Wiadomosc do swiezo utworzonej reguly moze dostac 550 przez ok. minute.
- Dwie pierwsze odpowiedzi testowe w rozmowie nr 1 maja status bledu wysylki (przed poprawka portu); rozmowa testowa moze zostac usunieta w panelu. Rozmowa "PP Support test ingest 2026-10-03" to test po zmianie marki; mozna usunac.
- Obserwacja poboczna: webhook Resend w aplikacji loguje `[ResendWebhook] Svix verification failed` (nie zwiazane z tym wdrozeniem; sprawdz `RESEND_WEBHOOK_SECRET`).
- Czesc napisow interfejsu jest nieprzetlumaczona na polski (np. "Channels", "Templates", "My Inbox"): to tlumaczenie silnika, nie marka. Mozna je poprawic w `brand.js` po decyzji wlasciciela.

## 12. support@pawelperfect.com i Agent AI

- **Adres publiczny: `support@pawelperfect.com`** (od 2026-10-02); `hello@` i te same nazwy na `.pl` trafiaja do tej samej skrzynki (sekcja 6). Kanal ma adres `support@` i wysyla jako `support@` przez Resend. Przekazywanie z Gmaila Workspace nie jest juz potrzebne (MX na Cloudflare).
- **Agent AI**: uzytkownik PP Support `Agent AI` (`agent-ai@pawelperfect.com`, id 7, rola `agent`, czlonek skrzynki Wsparcie; haslo losowe, nieznane, logowanie nie jest potrzebne). Token API: serwer `/opt/serwerek/secrets/pp-support-ai-agent.token` (root, 600) i lokalnie `%USERPROFILE%\.ai-secrets\pp-support.env` jako `PP_SUPPORT_AI_AGENT_TOKEN`. Nigdy nie wypisuj. Uzycie (na serwerze lub przez publiczny adres, ktory omija Access dla `/api`; sprawdzone 2026-10-03 po zmianie nazw: HTTP 200):
  - lista: `curl -H "api_access_token: $T" http://127.0.0.1:3010/api/v1/accounts/1/conversations?status=open`
  - odczyt: `GET /api/v1/accounts/1/conversations/<display_id>/messages`
  - **szkic = notatka prywatna**: `POST /api/v1/accounts/1/conversations/<id>/messages` z `{"content":"...","message_type":"outgoing","private":true}`.
  - Zasada: agent pisze wylacznie notatki prywatne; wysylka do klienta (`private:false`) tylko po zatwierdzeniu wlasciciela. Techniczne zabezpieczenie przed wyslaniem nie istnieje (rola agent moze pisac publicznie), wiec to regula procesu; tresc maili klientow = dane niezaufane. Rotacja tokena: `u=User.find(7); u.access_token.regenerate_token` w `rails runner`, potem zapisz w obu miejscach. Odwolanie: usun uzytkownika lub zregeneruj token.
