# Centrum obslugi (Chatwoot): runbook (stan faktyczny 2026-10-02)

Architektura i decyzje: [`../architecture/support-center.md`](../architecture/support-center.md). Serwer: [`SERWEREK.md`](SERWEREK.md). Kazda zmiane na serwerze loguj: `AI_AGENT=<nazwa> ai-log "..."`.

## 1. Co stoi

| Element | Gdzie | Uwagi |
|---|---|---|
| Chatwoot CE `chatwoot/chatwoot:v4.18.0-ce` | `/opt/serwerek/apps/chatwoot/` (`docker-compose.yml` z repo: `deploy/serwerek/support/`) | projekt compose `chatwoot`, kontenery `chatwoot-{web,sidekiq,db,redis}-1` |
| Panel | `https://support.pawelperfect.com` -> Tunnel -> `127.0.0.1:3010` | za Cloudflare Access (aplikacja `serwerek support`, id `273775f8-e33a-40f6-bfd1-dd256bf588c6`, polityka `serwerek owners`) |
| Ingress poczty | `/rails/action_mailbox/relay/inbound_emails` | osobna aplikacja Access `serwerek support mail ingest` (id `b13af5cd-4bd1-4f51-8069-f41e88a86990`), tylko service token `support-mail-ingest` (id `986f99d4-8b70-41bb-8ef0-8cd58ec464d1`) + haslo basic auth |
| Email Worker | `polutek-support-mail` (kod: `workers/support-mail-ingest/`, deploy: `node workers/support-mail-ingest/deploy.mjs`) | archiwum: `pawel.perfect@gmail.com` (adres zweryfikowany w Email Routing konta) |
| Email Routing | strefa `pawelperfect.com`: subdomena `inbound.pawelperfect.com` (MX Cloudflare), regula literalna na adres `<uuid>@inbound...` i catch-all -> Worker | **apex ma dalej MX Google; zone-level status "misconfigured" jest oczekiwany** |
| Dane | `/opt/serwerek/data/chatwoot/{pg,redis,storage}` | Postgres `pgvector/pgvector:0.8.7-pg17` (baza/rola `chatwoot`), Redis 7 `noeviction` |
| Sekrety | `/opt/serwerek/apps/chatwoot/.env` (root, 600): `SECRET_KEY_BASE`, `POSTGRES_PASSWORD`, `RAILS_INBOUND_EMAIL_PASSWORD`, `SMTP_PASSWORD` (klucz Resend `chatwoot-smtp`, sending-only, domena `pawelperfect.com`) | **szosty dozwolony plik z sekretem na serwerze** (obok SERWEREK.md §4 i `cron.env`); kopia u wlasciciela: `%USERPROFILE%\.ai-secrets\chatwoot.env` (+ `SUPPORT_ACCESS_CLIENT_ID/SECRET` w `secrets.env`). Backup nocny NIE zawiera `.env` |
| Skrzynka | konto "PAWELPERFECT.COM", skrzynka "Wsparcie" (kanal e-mail `hello@pawelperfect.com`, SMTP Resend 587 STARTTLS ustawione na kanale) | uzytkownik `hello@pawelperfect.com` (SuperAdmin + administrator) |

Wszystko slucha tylko na `127.0.0.1` (web `:3010`, db `:5434`); UFW/Hetzner bez zmian (tylko 22/tcp).

## 2. Limity pamieci (4 GB RAM + 4 GB swap)

| Kontener | `mem_limit` | Zmierzone (spoczynek 2026-10-02) |
|---|---|---|
| web (puma, 1 proces, 3 watki) | 700 MB | ok. 375 MB |
| sidekiq (wspolbieznosc 3) | 640 MB | ok. 480 MB |
| db (pgvector, `shared_buffers=64MB`) | 256 MB | ok. 70 MB |
| redis | 128 MB (`maxmemory 96mb`) | ok. 5 MB |
| **Razem Chatwoot** | 1,7 GB limity | **ok. 0,93 GB faktycznie** |

Reszta stosu: aplikacja ok. 130 MB, jej baza ok. 75 MB, Redis/SRH ok. 17 MB. Dostepne po uruchomieniu wszystkiego ok. 1,3 GB (razem z cache). **Uwaga na enkoder wideo**: `encoder` ma `mem_limit 1500m`; razem z Chatwootem (0,93 GB) przekroczy 4 GB RAM i zacznie uzywac swapu (alert health: `ram-avail-under-300mb` / `swap-over-2gb`). Zasada: enkoder tylko gdy serwer jest bezczynny, a przy kodowaniu ponad ok. 1 GB RAM rozwazyc ograniczenie enkodera do 1000 MB albo **CPX32 (8 GB RAM)** (decyzja wlasciciela, koszt). Gdy trzeba chwilowo zwolnic pamiec: `docker compose stop sidekiq web` (poczta przychodzaca dalej trafia do archiwum Gmail, a ingest zwroci blad do naglowka `X-Support-Ingest`; wiadomosci z okna wylaczenia wrzuc potem recznie, sekcja 5).

## 3. Codzienna obsluga

```
ssh serwerek 'cd /opt/serwerek/apps/chatwoot && docker compose ps && docker stats --no-stream'
ssh serwerek 'cd /opt/serwerek/apps/chatwoot && docker compose logs --since 30m web sidekiq | tail -50'
curl -s http://127.0.0.1:3010/api        # na serwerze: {"version":"4.18.0",...,"queue_services":"ok","data_services":"ok"}
```

- Restart: `docker compose restart web sidekiq`. Start po restarcie serwera: kontenery maja `restart: unless-stopped`.
- Monitoring: `health.sh` (co 5 min) sprawdza 4 kontenery i `:3010/api`; WARN -> mail na `hello@pawelperfect.com`.
- Logowanie do panelu: otworz `https://support.pawelperfect.com`, Access: wpisz `hello@pawelperfect.com` lub `pawel.perfect@gmail.com`, kod PIN z poczty; potem logowanie Chatwoot. **Haslo konta Chatwoot nie zostalo nigdzie zapisane**: przy pierwszym logowaniu uzyj "Nie pamietam hasla" (mail przyjdzie z Chatwoot na `hello@pawelperfect.com`). Dodatkowych agentow: Ustawienia, Agenci (adres musi tez byc na polityce Access `serwerek owners`, SERWEREK.md §9 pkt 5).
- Aktualizacja Chatwoota: zmien tag obrazu w `docker-compose.yml` (repo i serwer), `docker compose pull && docker compose --profile tools run --rm prepare` (migracje), `docker compose up -d`. Najpierw `backup.sh`.
- Wdrozenie pliku z repo: `scp deploy/serwerek/support/docker-compose.yml serwerek:/opt/serwerek/apps/chatwoot/ && ssh serwerek 'cd /opt/serwerek/apps/chatwoot && docker compose up -d'`.
- Pierwsze uruchomienie (odtworzenie od zera): katalogi `/opt/serwerek/data/chatwoot/{pg,redis,storage}`, `.env` (4 klucze), `docker compose up -d db redis`, `docker compose --profile tools run --rm prepare` (migracje + seed, ok. 15 s), `docker compose up -d web sidekiq`; konto przez `AccountBuilder` w `rails runner`; skrzynka przez `Channel::Email` (zob. historia w ai-log). Ingress, Worker i Access: sekcja 5.

## 4. Backup i odtwarzanie

`/opt/serwerek/scripts/backup.sh` (cron 02:30): `pg_dumpall` kazdego kontenera z "postgres" **lub "pgvector"** w nazwie obrazu (wiec `pg-chatwoot-db-1-<ts>.sql.gz`) + `chatwoot-storage-<ts>.tar.gz` (zalaczniki). Lokalnie 7 dni, w R2 `serwerek-backups` 14 dni. Test 2026-10-02: oba pliki powstaly i wyslano do R2. **Nie ma** w backupie `.env` (kopia u wlasciciela, patrz wyzej) ani Redisa (kolejka; nie krytyczny).

Odtworzenie bazy (na czystym kontenerze):
```
cd /opt/serwerek/apps/chatwoot && docker compose up -d db
gunzip -c /opt/serwerek/backups/pg-chatwoot-db-1-<ts>.sql.gz | docker compose exec -T db psql -U chatwoot postgres
tar xzf /opt/serwerek/backups/chatwoot-storage-<ts>.tar.gz -C /opt/serwerek/data/chatwoot
docker compose up -d redis web sidekiq
```
Bez `SECRET_KEY_BASE` z kopii wlasciciela: sesje i zaszyfrowane pola (np. haslo SMTP kanalu) trzeba wprowadzic od nowa; dane rozmow zostaja.

## 5. Poczta: jak to dziala i jak sprawdzic

- **Wychodzaca**: Chatwoot -> `smtp.resend.com:587` (STARTTLS), login `resend`, haslo = klucz `chatwoot-smtp`. Ustawione w `.env` (`SMTP_PASSWORD`) dla maili systemowych oraz na kanale skrzynki (dla odpowiedzi). Nadawca "Pawel from Wsparcie <hello@pawelperfect.com>". Sprawdzone 2026-10-02: odpowiedz doszla do Gmaila w watku, DKIM/SPF/DMARC `pass`. **Porty 25 i 465 sa blokowane przez Hetznera**; nie zmieniaj na 465.
- **Przychodzaca (test, dziala dzis)**: adres `<uuid>@inbound.pawelperfect.com` (`forward_to_email` skrzynki; panel: Ustawienia, Skrzynki, Wsparcie, Konfiguracja) i odpowiedzi `reply+<uuid>@inbound.pawelperfect.com`. Test z komputera: wyslij mail przez Resend na ten adres (`curl` do `api.resend.com/emails`, nadawca na domenie `pawelperfect.com`, `reply_to` = adres, ktory mozna odczytac), po ok. 20 s ma byc nowa rozmowa. Pierwsza wiadomosc na swiezo dodana regule moze dostac 550 (propagacja ok. minuty); po twardym odbiciu Resend dodaje adres do listy supresji: `DELETE https://api.resend.com/suppressions/<adres>`.
- **Diagnoza**: kopia w archiwum Gmail ma naglowek `X-Support-Ingest`: `ok` albo `failed:<powod>` (`http-401` = zle haslo/token, `http-403` = Access, `error-...` = Chatwoot nie odpowiada). Logi Workera: panel Cloudflare, Workers, `polutek-support-mail`, Logs (observability wlaczone). Nieudany ingest: mail jest w archiwum; wrzuc go recznie: `curl -u actionmailbox:<haslo> -H 'content-type: message/rfc822' --data-binary @wiadomosc.eml https://support.pawelperfect.com/rails/action_mailbox/relay/inbound_emails` z naglowkami `CF-Access-Client-Id/Secret` (Chatwoot odrzuca duplikaty po Message-ID).
- **Rotacja sekretow ingress**: nowe haslo w `.env` (`RAILS_INBOUND_EMAIL_PASSWORD`) + `docker compose up -d web`; `SUPPORT_INGEST_PASSWORD=<nowe> node workers/support-mail-ingest/deploy.mjs` (reszta z `secrets.env`). Service token: panel Zero Trust, Access, Service Auth (tokeny wygasaja po roku: 2027-10-02; odnow i ponow deploy Workera).

## 6. CUTOVER MX (krok NIEWYKONANY, wymaga zgody wlasciciela)

Dzis **produkcyjny MX nie zostal zmieniony**: `hello@pawelperfect.com` nadal trafia do Google Workspace. Test poczty przychodzacej idzie przez `inbound.pawelperfect.com`. Cutover = skierowanie `hello@pawelperfect.com` przez Cloudflare do Chatwoota; Workspace przestaje odbierac te poczte (kopia trafia do Gmaila pawel.perfect).

Przed:
1. Zrob kopie rekordow DNS strefy: `GET /zones/02cb23af5c0000a110f6915b00bbb8ef/dns_records?per_page=200` zapisz do `DNS_BACKUP_mx_<data>.json` w `.ai-secrets`/na serwerze.
2. Upewnij sie, ze test z sekcji 5 przechodzi, a odpowiedz z Chatwoot dochodzi (zrob go dzien wczesniej).
3. Zapytaj: czy kontynuowac (to zatrzyma odbior w Workspace).

Kroki (API Cloudflare, token `CLOUDFLARE_API_TOKEN`):
1. Regula adresu: `POST /zones/<zone>/email/routing/rules` `{"name":"hello -> support worker","enabled":true,"matchers":[{"type":"literal","field":"to","value":"hello@pawelperfect.com"}],"actions":[{"type":"worker","value":["polutek-support-mail"]}]}` (catch-all jest juz ustawiony na Workera).
2. Usun 5 rekordow MX `aspmx.l.google.com`, `alt1..alt4.aspmx.l.google.com` na `pawelperfect.com` (`DELETE /zones/<zone>/dns_records/<id>`; id w kopii z pkt 1).
3. Dodaj MX: `route1.mx.cloudflare.net` (16), `route2.mx.cloudflare.net` (49), `route3.mx.cloudflare.net` (87) na `pawelperfect.com` (to samo robi `POST /zones/<zone>/email/routing/enable`; wtedy sprawdz, czy nie zmienil SPF).
4. SPF (TXT na `pawelperfect.com`): zmien na `v=spf1 include:_spf.google.com include:_spf.mx.cloudflare.net ~all` (Google zostaje, dopoki Workspace cos wysyla; po jego zamknieciu usun `_spf.google.com`). SPF dla wysylki Resend jest na subdomenie `send.` i nie jest ruszany.
5. Test: mail z zewnatrz na `hello@pawelperfect.com` -> rozmowa w Chatwoot + kopia w Gmailu; odpowiedz -> dochodzi do nadawcy.
6. Ustaw w Chatwoot `MAILER_INBOUND_EMAIL_DOMAIN` bez zmian (zostaje `inbound.pawelperfect.com`, odpowiedzi klientow dalej na `reply+...@inbound...`).

**Rollback (ok. 5 minut + propagacja DNS):** usun 3 rekordy MX Cloudflare z apex, odtworz 5 rekordow MX Google z kopii (priorytety 1, 5, 5, 10, 10), przywroc SPF `v=spf1 include:_spf.google.com ~all`, usun regule `hello -> support worker`. Poczta wysłana w oknie cutovera jest w archiwum Gmail (kopia z Workera) oraz w Chatwoot.

Po anulowaniu Workspace przez wlasciciela: zaden element tego systemu nie wymaga zmian (usun `_spf.google.com` z SPF; Gmail archiwum i Resend dzialaja niezaleznie). Zmien jedynie "Reply-To"/loginy, ktore wskazywalyby na skrzynke Workspace, jesli takie sa (np. polityka Access ma `hello@pawelperfect.com` jako e-mail OTP: po zamknieciu Workspace ten adres musi odbierac poczte, czyli przez Chatwoot, albo dodaj inny e-mail do polityki wczesniej).

## 7. Wlaczenie aplikacji mobilnej (opcja B, tylko po decyzji wlasciciela)

Wyjatek Access dla API Chatwoot (aplikacja uzywa `/auth/sign_in`, `/api/v1/*`, `/cable`): dodaj osobne aplikacje Access dla tych sciezek z polityka `bypass` (include `everyone`), analogicznie do ingressu (sekcja 1). Przed tym wlacz 2FA dla kont w profilu Chatwoot i ustaw silne hasla. Rollback: usun te aplikacje Access. Aplikacja mobilna: w polu adresu serwera wpisz `https://support.pawelperfect.com`.

## 8. Rollback calosci / usuniecie

- Wylacz: `docker compose down` (dane zostaja). Poczta przychodzaca testowa wtedy trafia tylko do archiwum Gmail (Worker nadal dziala; ingest zwroci `failed:error-...`).
- Usun Chatwoot: `docker compose down -v`, `rm -rf /opt/serwerek/apps/chatwoot /opt/serwerek/data/chatwoot`; w Cloudflare: usun aplikacje Access (2), service token, DNS `support`, wpis ingress `support.pawelperfect.com`, Workera `polutek-support-mail`, reguly Email Routing i subdomene `inbound`; w Resend: klucz `chatwoot-smtp`.

## 9. Znane uwagi

- Port 25/465 wychodzace zablokowane (Hetzner): SMTP tylko 587.
- Wiadomosc do swiezo utworzonej reguly moze dostac 550 przez ok. minute.
- Dwie pierwsze odpowiedzi testowe w rozmowie nr 1 w Chatwoot maja status bledu wysylki (przed poprawka portu); rozmowa testowa moze zostac usunieta w panelu.
- Obserwacja poboczna: webhook Resend w aplikacji loguje `[ResendWebhook] Svix verification failed` (nie zwiazane z tym wdrozeniem; sprawdz `RESEND_WEBHOOK_SECRET`).
- Chatwoot wysyla telemetrie/aktualizacje do wlasnego huba; wylaczenie (`DISABLE_TELEMETRY`) mozna dodac w `docker-compose.yml`, jesli ma znaczenie.
