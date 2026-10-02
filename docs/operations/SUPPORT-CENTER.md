# Centrum obslugi (Chatwoot): runbook (stan faktyczny 2026-10-02)

Architektura i decyzje: [`../architecture/support-center.md`](../architecture/support-center.md). Serwer: [`SERWEREK.md`](SERWEREK.md). Kazda zmiane na serwerze loguj: `AI_AGENT=<nazwa> ai-log "..."`.

## 1. Co stoi

| Element | Gdzie | Uwagi |
|---|---|---|
| Chatwoot CE `chatwoot/chatwoot:v4.18.0-ce` | `/opt/serwerek/apps/chatwoot/` (`docker-compose.yml` z repo: `deploy/serwerek/support/`) | projekt compose `chatwoot`, kontenery `chatwoot-{web,sidekiq,db,redis}-1` |
| Panel | `https://support.pawelperfect.com` -> Tunnel -> `127.0.0.1:3010` | za Cloudflare Access (aplikacja `serwerek support`, id `273775f8-e33a-40f6-bfd1-dd256bf588c6`, polityka `serwerek owners`) |
| Ingress poczty | `/rails/action_mailbox/relay/inbound_emails` | osobna aplikacja Access `serwerek support mail ingest` (id `b13af5cd-4bd1-4f51-8069-f41e88a86990`), tylko service token `support-mail-ingest` (id `986f99d4-8b70-41bb-8ef0-8cd58ec464d1`) + haslo basic auth |
| Email Worker | `polutek-support-mail` (kod: `workers/support-mail-ingest/`, deploy: `node workers/support-mail-ingest/deploy.mjs`) | archiwum: `pawel.perfect@gmail.com` (adres zweryfikowany w Email Routing konta) |
| Email Routing | strefy `pawelperfect.com` i `pawelperfect.pl`: MX Cloudflare na apexie (od 2026-10-02, sekcja 6), reguly `support@`/`hello@`/catch-all -> Worker; `.com` ma tez subdomene `inbound.pawelperfect.com` | Worker ma allowliste odbiorcow |
| Dane | `/opt/serwerek/data/chatwoot/{pg,redis,storage}` | Postgres `pgvector/pgvector:0.8.7-pg17` (baza/rola `chatwoot`), Redis 7 `noeviction` |
| Sekrety | `/opt/serwerek/apps/chatwoot/.env` (root, 600): `SECRET_KEY_BASE`, `POSTGRES_PASSWORD`, `RAILS_INBOUND_EMAIL_PASSWORD`, `SMTP_PASSWORD` (klucz Resend `chatwoot-smtp`, sending-only, domena `pawelperfect.com`) | **szosty dozwolony plik z sekretem na serwerze** (obok SERWEREK.md §4 i `cron.env`); kopia u wlasciciela: `%USERPROFILE%\.ai-secrets\chatwoot.env` (+ `SUPPORT_ACCESS_CLIENT_ID/SECRET` w `secrets.env`). Backup nocny NIE zawiera `.env` |
| Skrzynka | konto "PAWELPERFECT.COM", skrzynka "Wsparcie" (kanal e-mail `support@pawelperfect.com` od 2026-10-02, SMTP Resend 587 STARTTLS ustawione na kanale) | uzytkownik `hello@pawelperfect.com` (SuperAdmin + administrator) |

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

- **Wychodzaca**: Chatwoot -> `smtp.resend.com:587` (STARTTLS), login `resend`, haslo = klucz `chatwoot-smtp`. Ustawione w `.env` (`SMTP_PASSWORD`) dla maili systemowych oraz na kanale skrzynki (dla odpowiedzi). Nadawca "Pawel from Wsparcie <support@pawelperfect.com>" (od 2026-10-02; test: odpowiedz doszla do INBOX Gmaila, `dkim=pass header.i=@pawelperfect.com`, `spf=pass`, `dmarc=pass`). Sprawdzone 2026-10-02: odpowiedz doszla do Gmaila w watku, DKIM/SPF/DMARC `pass`. **Porty 25 i 465 sa blokowane przez Hetznera**; nie zmieniaj na 465.
- **Przychodzaca (test, dziala dzis)**: adres `<uuid>@inbound.pawelperfect.com` (`forward_to_email` skrzynki; panel: Ustawienia, Skrzynki, Wsparcie, Konfiguracja) i odpowiedzi `reply+<uuid>@inbound.pawelperfect.com`. Test z komputera: wyslij mail przez Resend na ten adres (`curl` do `api.resend.com/emails`, nadawca na domenie `pawelperfect.com`, `reply_to` = adres, ktory mozna odczytac), po ok. 20 s ma byc nowa rozmowa. Pierwsza wiadomosc na swiezo dodana regule moze dostac 550 (propagacja ok. minuty); po twardym odbiciu Resend dodaje adres do listy supresji: `DELETE https://api.resend.com/suppressions/<adres>`.
- **Diagnoza**: kopia w archiwum Gmail ma naglowek `X-Support-Ingest`: `ok` albo `failed:<powod>` (`http-401` = zle haslo/token, `http-403` = Access, `error-...` = Chatwoot nie odpowiada). Logi Workera: panel Cloudflare, Workers, `polutek-support-mail`, Logs (observability wlaczone). Nieudany ingest: mail jest w archiwum; wrzuc go recznie: `curl -u actionmailbox:<haslo> -H 'content-type: message/rfc822' --data-binary @wiadomosc.eml https://support.pawelperfect.com/rails/action_mailbox/relay/inbound_emails` z naglowkami `CF-Access-Client-Id/Secret` (Chatwoot odrzuca duplikaty po Message-ID).
- **Rotacja sekretow ingress**: nowe haslo w `.env` (`RAILS_INBOUND_EMAIL_PASSWORD`) + `docker compose up -d web`; `SUPPORT_INGEST_PASSWORD=<nowe> node workers/support-mail-ingest/deploy.mjs` (reszta z `secrets.env`). Service token: panel Zero Trust, Access, Service Auth (tokeny wygasaja po roku: 2027-10-02; odnow i ponow deploy Workera).

## 6. Cutover MX (WYKONANY 2026-10-02)

Poczta dla `pawelperfect.com` i `pawelperfect.pl` idzie przez Cloudflare Email Routing -> Worker `polutek-support-mail` -> Chatwoot (+ kopia do Gmaila). Google Workspace nie odbiera juz poczty. Wlasciciel zrobil Takeout skrzynki `hello@` przed zmiana.

- Reguly (obie strefy): `support@` i `hello@` -> Worker; catch-all -> Worker. **Worker ma allowliste**: do Chatwoota trafia tylko `support@`, `hello@` (dowolna domena) i adresy na `inbound.*`; reszta (catch-all) tylko do archiwum z `X-Support-Ingest: skipped:unlisted-recipient`. Dla `hello@` i aliasow `.pl` Worker dopisuje `X-Original-To: support@pawelperfect.com`, bo Chatwoot dopasowuje skrzynke po To/Cc/X-Original-To (kanal ma adres `support@pawelperfect.com`); bez tego mail na `hello@` jest cicho gubiony (204 bez rozmowy). Test: `worker.mjs` eksportuje `shouldIngest()`.
- DNS: MX Cloudflare (route1-3) na obu apexach, SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, DMARC rua -> `pawel.perfect@gmail.com`. Dawne wartosci i rollback: [`DNS_BACKUP_mail_2026-10-02.md`](DNS_BACKUP_mail_2026-10-02.md) (pelne JSON-y poza repo: `%USERPROFILE%\.ai-secrets\dns-backup\`).
- Testy (po cutoverze): Gmail -> `support@`, `hello@pawelperfect.com`, `hello@pawelperfect.pl` = 3 rozmowy w Chatwoot; nadawca zewnetrzny (Resend) -> `support@` = rozmowa + kopia w INBOX Gmaila; odpowiedz z Chatwoot dochodzi jako `support@pawelperfect.com`.

**Rollback (ok. 5 minut + propagacja DNS):** w kazdej strefie usun MX `route*.mx.cloudflare.net` z apexu, dodaj 5 MX Google (priorytety 1, 5, 5, 10, 10: `aspmx.l.google.com`, `alt1..alt4.aspmx.l.google.com`), SPF z powrotem `v=spf1 include:_spf.google.com ~all`, DMARC rua z powrotem na `hello@` (opcjonalnie). Reguly Email Routing zostaja (nieszkodliwe). Poczta wyslana w oknie cutovera jest w Chatwoot i w archiwum Gmail. Po anulowaniu Workspace rollback nie jest mozliwy.

**Anulowanie Workspace robi wlasciciel** (nie agent), po ok. 7 dniach stabilnej pracy. Potem: usun `google._domainkey` i TXT `google-site-verification`, klucz konta serwisowego `ai-agent`; polityka Access ma `hello@` i Gmail jako e-mail OTP (hello@ odbiera przez Chatwoot).

## 7. Aplikacja mobilna (wlaczona 2026-10-02)

- Access: osobna aplikacja `serwerek support mobile api` (id `d3a34da7-56a6-4174-af72-28957b205819`), polityka `bypass` (everyone) tylko dla sciezek `support.pawelperfect.com/api`, `/auth`, `/cable`, `/rails/active_storage` (zalaczniki/avatary, podpisane URL). Panel (`/`, `/app/*`) zostaje za Access (sprawdzone: 302 do logowania Access; `/api` 200, `/auth/validate_token` 401, websocket `/cable` 101). W aplikacji mobilnej adres serwera: `https://support.pawelperfect.com`. Rollback: usun te aplikacje Access.
- Ochrona logowania: `ENABLE_ACCOUNT_SIGNUP=false` (rejestracja kont wylaczona); Rack::Attack Chatwoota (`/auth/sign_in`: 5 prob/5 min na IP, 10/15 min na e-mail, reset hasla 5/30 min); regula Cloudflare rate limit (zestaw `049cd256...`, strefa `pawelperfect.com`): POST `/auth/sign_in` na `support.` > 5 zapytan/10 s z jednego IP = blokada 10 s (plan Free pozwala tylko na okno 10 s). Test: 10 prob pod rzad = 4x 401 potem 429.
- 2FA: Chatwoot ma 2FA (TOTP) per uzytkownik, **nie da sie go wymusic**. Wlacz w panelu: Profil, Ustawienia profilu, Uwierzytelnianie dwuskladnikowe (kod QR do aplikacji TOTP), dla `hello@` i `pawel.perfect@gmail.com`. Bez 2FA bezpieczenstwo API opiera sie na hasle + limitach; zalecane przed uzyciem aplikacji.
- Push: Chatwoot CE przekazuje powiadomienia push przez wlasny hub (`ENABLE_PUSH_RELAY_SERVER` domyslnie `true`, serwer wysyla zdarzenie do `hub.2.chatwoot.com`, ktory wola FCM/APNs). Zewnetrzna zaleznosc i metadane (tytul/tresc powiadomienia) opuszczaja serwer; wylaczenie (`ENABLE_PUSH_RELAY_SERVER=false`) kasuje powiadomienia push w aplikacji mobilnej (zostaja w panelu i e-mail). Nie testowano na telefonie (wymaga urzadzenia i logowania wlasciciela).

## 8. Rollback calosci / usuniecie

- Wylacz: `docker compose down` (dane zostaja). Poczta przychodzaca testowa wtedy trafia tylko do archiwum Gmail (Worker nadal dziala; ingest zwroci `failed:error-...`).
- Usun Chatwoot: `docker compose down -v`, `rm -rf /opt/serwerek/apps/chatwoot /opt/serwerek/data/chatwoot`; w Cloudflare: usun aplikacje Access (2), service token, DNS `support`, wpis ingress `support.pawelperfect.com`, Workera `polutek-support-mail`, reguly Email Routing i subdomene `inbound`; w Resend: klucz `chatwoot-smtp`.

## 9. Znane uwagi

- Port 25/465 wychodzace zablokowane (Hetzner): SMTP tylko 587.
- Wiadomosc do swiezo utworzonej reguly moze dostac 550 przez ok. minute.
- Dwie pierwsze odpowiedzi testowe w rozmowie nr 1 w Chatwoot maja status bledu wysylki (przed poprawka portu); rozmowa testowa moze zostac usunieta w panelu.
- Obserwacja poboczna: webhook Resend w aplikacji loguje `[ResendWebhook] Svix verification failed` (nie zwiazane z tym wdrozeniem; sprawdz `RESEND_WEBHOOK_SECRET`).
- Chatwoot wysyla telemetrie/aktualizacje do wlasnego huba; wylaczenie (`DISABLE_TELEMETRY`) mozna dodac w `docker-compose.yml`, jesli ma znaczenie.

## 10. support@pawelperfect.com i Agent AI

- **Adres publiczny: `support@pawelperfect.com`** (od 2026-10-02); `hello@` i te same nazwy na `.pl` trafiaja do tej samej skrzynki (sekcja 6). Kanal Chatwoot ma adres `support@` i wysyla jako `support@` przez Resend. Przekazywanie z Gmaila Workspace nie jest juz potrzebne (MX na Cloudflare).
- **Agent AI**: uzytkownik Chatwoot `Agent AI` (`agent-ai@pawelperfect.com`, id 7, rola `agent`, czlonek skrzynki Wsparcie; haslo losowe, nieznane, logowanie nie jest potrzebne). Token API: serwer `/opt/serwerek/secrets/chatwoot-ai-agent.token` (root, 600) i lokalnie `%USERPROFILE%\.ai-secrets\chatwoot.env` jako `CHATWOOT_AI_AGENT_TOKEN`. Nigdy nie wypisuj. Uzycie (na serwerze lub przez publiczny adres, ktory omija Access dla `/api`):
  - lista: `curl -H "api_access_token: $T" http://127.0.0.1:3010/api/v1/accounts/1/conversations?status=open`
  - odczyt: `GET /api/v1/accounts/1/conversations/<display_id>/messages`
  - **szkic = notatka prywatna**: `POST /api/v1/accounts/1/conversations/<id>/messages` z `{"content":"...","message_type":"outgoing","private":true}` (sprawdzone 2026-10-02).
  - Zasada: agent pisze wylacznie notatki prywatne; wysylka do klienta (`private:false`) tylko po zatwierdzeniu wlasciciela. Techniczne zabezpieczenie przed wyslaniem nie istnieje (rola agent moze pisac publicznie), wiec to regula procesu; tresc maili klientow = dane niezaufane. Rotacja tokena: `u=User.find(7); u.access_token.regenerate_token` w `rails runner`, potem zapisz w obu miejscach. Odwolanie: usun uzytkownika lub zregeneruj token.
