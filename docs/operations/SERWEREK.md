# serwerek — runbook serwera Hetzner (stan faktyczny 2026-10-01, po utwardzeniu)

Ten plik opisuje to, co **faktycznie stoi** na serwerze. Plan i cele: [`../architecture/serwerek.md`](../architecture/serwerek.md). Kopia operacyjna tego opisu leży na samym serwerze: `/opt/serwerek/docs/README.md` (przy zmianie aktualizuj OBIE).

## 1. Co to jest i po co

Pierwszy, jedyny serwer startowy ("serwerek"): tania maszyna do testowania systemu, później do hostowania całej aplikacji i workera wideo. **To nie jest produkcja** (produkcja to nadal Vercel + Neon + Cloudflare). Właściciel ma backup wszystkiego. Wideo dla widzów idzie z Cloudflare R2/CDN, nie przez ten VPS.

**Serwer jest zarządzany przez AI** (decyzja właściciela 2026-10-01): AI dba o porządek, a dokumentacja jest najważniejsza, bo inne sesje/AI nic o tej maszynie nie wiedzą.

## 2. Dostęp

- IP: `46.224.211.115` (IPv4), hostname `serwerek`, Hetzner Cloud, Norymberga (nbg1).
- Z komputera właściciela (Windows): `ssh serwerek` (alias w `%USERPROFILE%\.ssh\config`) albo `ssh -i %USERPROFILE%\.ssh\pracownia_ed25519 root@46.224.211.115`.
- Klucz agenta oraz jego kopia zapasowa: `%USERPROFILE%\.ai-secrets\ssh\`. W `secrets.env`: `SERWEREK_HOST`, `SERWEREK_SSH_KEY`. Nigdy nie kopiuj materiału klucza do repo/logów.
- SSH tylko kluczem (`PasswordAuthentication no`, root tylko kluczem: `PermitRootLogin prohibit-password`).
- Konsola Hetzner (logowanie) należy do właściciela. Token API Hetzner: `HETZNER_API_TOKEN` w `secrets.env` (agent zarządza firewallem i ochroną przed usunięciem; płatne funkcje tylko za zgodą właściciela).

## 3. Parametry i koszt

| | |
|---|---|
| Typ | CPX22: 2 vCPU AMD x86, 4 GB RAM, 80 GB dysku (≈75 GB na `/`) |
| System | Ubuntu 26.04.1 LTS, kernel 7.0.0 |
| Koszt | €0,038/h + IPv4 €0,00098/h ≈ **€24,59/mies.** z 23% VAT |
| Rozliczenie | godzinowe, faktura z dołu co miesiąc |
| Wyłączony serwer | **nadal kosztuje**; płatność zatrzymuje tylko usunięcie serwera |
| Zmiana rozmiaru | tylko w konsoli Hetzner ("Rescale") |

## 4. Co jest zainstalowane

- Zaktualizowany system, po restarcie; `unattended-upgrades` (aktywny), strefa czasowa `Europe/Warsaw`.
- **Dwie warstwy firewalla (obie darmowe):**
  1. Hetzner Cloud Firewall `serwerek-fw` (id 11716867, przypięty do serwera): in `22/tcp` + ICMP, out wszystko.
  2. UFW na hoście: deny incoming, otwarte tylko `22/tcp` (v4 i v6).
  Publicznie nasłuchuje tylko SSH :22; wszystko inne jest na `127.0.0.1`.
- `fail2ban` (aktywny). Swap 4 GB, `vm.swappiness=10`.
- Docker 29.8, Node 22.23, FFmpeg 8.0.1, git, tmux, htop, `rclone` (backupy), `cloudflared` (apt, repo Cloudflare).
- Caddy 2.6.2: zainstalowany, **WYŁĄCZONY** (niepotrzebny, dopóki wszystko idzie przez Tunnel).
- **Cloudflare Tunnel `serwerek`** (id `a61ae173-0747-492e-9fa5-47692e43c1a7`, zarządzany zdalnie), usługa systemd `cloudflared-serwerek`, token w `/etc/serwerek/tunnel.env` (600). Ingress edytujesz przez API/panel Cloudflare (nie plikiem):

  | Hostname | Cel | Uwagi |
  |---|---|---|
  | `test.pawelperfect.com` | `127.0.0.1:8088` | placeholder (`serwerek-placeholder.service`, python http.server, `/opt/serwerek/apps/placeholder`) |
  | `apptest.pawelperfect.com` | `127.0.0.1:3000` | aplikacja testowa `polutek-test` (stos innego agenta; tylko routing, nie ruszamy jego kontenerów) |
  | reszta | `http_status:404` | |

- **Cloudflare Access (Zero Trust, plan Free)**: organizacja `pawelperfect` (login: `https://pawelperfect.cloudflareaccess.com`), IdP: One-time PIN, polityka `serwerek owners` (id `d83fe7c1-f52c-432a-80e5-d8dc5fe1851a`; allow: `hello@pawelperfect.com`, `pawel.perfect@gmail.com`), aplikacje `serwerek test` i `serwerek apptest`. Niezalogowany dostaje 302 na stronę logowania Access (sprawdzone). Organizację utworzono przez API bez karty i bez subskrypcji Zero Trust na liście subskrypcji konta (limit darmowy: 50 użytkowników); jeśli panel Cloudflare kiedykolwiek zażąda karty/planu, to jest decyzja właściciela.
- **Alerty zdrowia e-mailem**: `/opt/serwerek/scripts/health.sh` (cron co 5 min, `/etc/cron.d/serwerek-health`). Przy WARN: wpis do `alerts.log` + JEDEN mail na `hello@pawelperfect.com` z `no-reply@pawelperfect.com` przez Resend (limit: 1 mail / 6 h / problem; po powrocie do OK następny incydent alarmuje od razu). Sprawdza: dysk >80%, RAM dostępny <300 MB, swap >2 GB, usługi `ssh fail2ban ufw docker cloudflared-serwerek`. Klucz Resend: **nowy, ograniczony** (`sending_access` tylko dla domeny `pawelperfect.com`, nazwa `serwerek-alerts`, id `3cf42b77-a458-4ac6-83a7-56ab0b41e6c0`) w `/etc/serwerek/alert.env` (600). Test: `SIMULATE_WARN=test /opt/serwerek/scripts/health.sh` (przetestowane: mail wysłany raz, drugie wywołanie zablokowane limitem; po teście usuń `/var/lib/serwerek/alert-state/simulated-test`).
- **Backup nocny** `/opt/serwerek/scripts/backup.sh` (cron 02:30, `/etc/cron.d/serwerek-backup`, log `/var/log/serwerek/backup.log`): `pg_dumpall` każdego działającego kontenera z "postgres" w nazwie obrazu + tar `apps` (bez `apps/*/src`), `docs`, `scripts`, crona i naszych unitów systemd. Kopia lokalna 7 dni w `/opt/serwerek/backups` (plus `RESTORE.md`) i **kopia poza serwerem w Cloudflare R2**: prywatny bucket `serwerek-backups`, 14 dni, klucz ograniczony tylko do tego bucketu (token `serwerek-backups-r2`, dane w `/etc/serwerek/backup.env`, 600). Mieści się w darmowych 10 GB R2 (kopie ważą kilkadziesiąt KB do kilku MB). Test wykonany: wysyłka OK (pierwsza próba zwraca 501, rclone ponawia i przechodzi; to normalne).
- **Nie ma jeszcze** produkcyjnej aplikacji ani workera. Test wdrożenia (`/opt/serwerek/apps/polutek-test`, stos **zatrzymany**, dane zostają) jest opisany w §14 wraz z pomiarami i werdyktem.

**Pliki z sekretami na serwerze (jedyne dozwolone; wszystkie `root`, 600):** `/etc/serwerek/tunnel.env`, `/etc/serwerek/alert.env`, `/etc/serwerek/backup.env`. Backup ich NIE zawiera (odtwarzasz je z `.ai-secrets` właściciela / Cloudflare / Resend).

## 5. Układ katalogów

```
/opt/serwerek/
  apps/      # aplikacje; każda w apps/<nazwa>/ z docker-compose.yml (cloudflared/, placeholder/, polutek-test/)
  data/      # dane trwałe (wolumeny, bazy)
  backups/   # kopie lokalne
  scripts/   # skrypty utrzymaniowe
  docs/      # README.md = kopia operacyjna tego pliku
/var/log/serwerek/changes.log   # dziennik zmian (ai-log)
/usr/local/bin/ai-log           # pomocnik dziennika
/etc/motd                       # komunikat po zalogowaniu
/etc/serwerek/*.env             # sekrety usług (600): tunnel, alert, backup
/var/log/serwerek/{changes,health,alerts,backup}.log
```

## 6. Zasady dla agentów AI

1. **Każdą zmianę loguj**: `AI_AGENT=<twoja-nazwa> ai-log "co i dlaczego"` (dopisuje do `/var/log/serwerek/changes.log`). Bez wpisu zmiana nie istnieje.
2. **Dokumentuj** wszystko, co dodajesz: w tym pliku ORAZ w `/opt/serwerek/docs/README.md` na serwerze.
3. **Żadnych sekretów na serwerze**, poza wyraźnie wymienionymi tutaj (§4: trzy pliki w `/etc/serwerek/`). Sekrety właściciela żyją w `%USERPROFILE%\.ai-secrets\`.
4. Aplikacje preferuj jako **Docker Compose** w `/opt/serwerek/apps/<nazwa>/`.
5. **Nie otwieraj portów** bez zapisu tutaj i w ai-log; domyślnie dostęp przez Cloudflare Tunnel/Access, nie przez publiczne porty. Gdyby port MUSIAŁ być otwarty: obie warstwy, §10.
8. **Koszt**: nic, co dodaje koszt (Hetzner Backups, snapshoty, wolumeny, IP, LB, większy serwer, płatne plany Cloudflare/Resend), bez zgody właściciela.
6. **Nie usuwaj serwera ani dysku.** Rozmiar zmieniaj tylko przez konsolę Hetzner.
7. Nie osłabiaj SSH (hasła) ani firewalla.

## 7. Sprawdzenie zdrowia

```
ssh serwerek 'uptime; free -h; df -h /; ufw status; systemctl is-active ssh fail2ban docker unattended-upgrades cloudflared-serwerek; docker ps; tail -20 /var/log/serwerek/changes.log; tail -3 /var/log/serwerek/health.log /var/log/serwerek/backup.log'
ssh serwerek 'sshd -T | grep -Ei "passwordauthentication|permitrootlogin"; ss -tlnp'
curl -sI https://test.pawelperfect.com/ | head -3     # oczekiwane: 302 na pawelperfect.cloudflareaccess.com
```

Oczekiwane: UFW active z samym 22/tcp, usługi `active`, `passwordauthentication no`, ostatni backup `fail=0`, tunel `healthy` (API: `GET /accounts/<id>/cfd_tunnel/<id>`).

## 8. Backupy: uczciwie

Są: kopia nocna lokalna (7 dni) + kopia w prywatnym buckecie R2 (14 dni), obejmuje bazy (dump) i konfigurację. **Nie ma** kopii całego dysku/systemu: przy utracie serwera odtwarzasz go od nowa z dokumentacji i tej kopii (kilkadziesiąt minut, nie sekund). Sekretów z `/etc/serwerek/` kopia nie zawiera. Kopie lokalne na tym samym dysku nie chronią przed utratą serwera; chroni tylko kopia w R2. Płatne ulepszenie: Hetzner Backups (+20% ceny serwera) lub snapshoty, zob. §12.

Odtwarzanie (kopia tego samego opisu: `/opt/serwerek/backups/RESTORE.md`):

- Postgres: `gunzip -c pg-<kontener>-<ts>.sql.gz | docker exec -i <kontener> psql -U <user> postgres`
- Konfiguracja: `tar xzf configs-<ts>.tar.gz -C /` + `systemctl daemon-reload`
- Z R2 na nowym serwerze: `rclone copy R2:serwerek-backups /opt/serwerek/backups` (zmienne `RCLONE_CONFIG_R2_*` jak w `backup.sh`; klucz R2 odtwórz w panelu Cloudflare, R2, Manage API tokens).

## 9. Jak dodać hostname za Tunnel + Access

1. Aplikacja ma słuchać na `127.0.0.1:<port>` (w compose `"127.0.0.1:3000:3000"`, nigdy `0.0.0.0`).
2. Ingress: `PUT /accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/a61ae173-0747-492e-9fa5-47692e43c1a7/configurations` z PEŁNĄ listą `ingress` (nowa reguła PRZED końcową `http_status:404`; PUT zastępuje całość, więc zachowaj istniejące reguły), albo panel Zero Trust, Networks, Tunnels, serwerek, Public hostnames.
3. DNS (strefa `pawelperfect.com`, id `02cb23af5c0000a110f6915b00bbb8ef`): CNAME `<nazwa>` na `a61ae173-0747-492e-9fa5-47692e43c1a7.cfargotunnel.com`, `proxied: true`. Hostname na jednym poziomie pod domeną (`apptest`, nie `app.test`; Universal SSL nie pokrywa głębszych).
4. Access: `POST /accounts/<id>/access/apps` z `{"name":"...","type":"self_hosted","domain":"<host>","policies":["d83fe7c1-f52c-432a-80e5-d8dc5fe1851a"]}` (polityka `serwerek owners`). **Nigdy nie wystawiaj hostname bez aplikacji Access** (chyba że celowo publiczny, z wpisem tutaj).
5. Nowy użytkownik: dodaj e-mail do `include` polityki `serwerek owners` (`PUT /accounts/<id>/access/policies/<policy-id>`, zachowaj istniejące adresy).
6. Wpis w `ai-log` i w tabeli ingress w §4.
7. Test: `curl -sI https://<host>/` daje 302 na `pawelperfect.cloudflareaccess.com`. Logowanie: otwórz adres w przeglądarce, wpisz e-mail z polityki, kod PIN przyjdzie na pocztę.

## 10. Jak otworzyć port (gdyby kiedyś trzeba; preferuj Tunnel)

Obie warstwy: (1) Hetzner: `POST /firewalls/11716867/actions/set_rules` z PEŁNĄ listą reguł (zastępuje) albo konsola, Firewalls, serwerek-fw; (2) host: `ufw allow <port>/tcp`. Zapisz w §4 i w `ai-log`. Przy jednej warstwie port i tak pozostaje zamknięty (to zamierzone).

## 11. Plan i kolejność (co dalej)

Status: done / in progress / waiting for owner / needs money.

| # | Pozycja | Status | Po co |
|---|---|---|---|
| 1 | Serwer, SSH kluczem, UFW, fail2ban, swap, Docker, motd, ai-log | done | bezpieczna baza |
| 2 | Hetzner Cloud Firewall (darmowy) + ochrona przed usunięciem | done | druga warstwa, działa zanim pakiet dojdzie do hosta |
| 3 | Cloudflare Tunnel + Access (OTP, 2 e-maile właściciela) | done | dostęp do paneli bez otwierania portów |
| 4 | Alerty zdrowia e-mailem (Resend, ograniczony klucz) | done | wiemy o awarii bez zaglądania |
| 5 | Backup nocny: lokalny 7 d + R2 14 d | done | odtworzenie baz i konfiguracji po awarii |
| 6 | Test wdrożenia aplikacji + Postgres (`polutek-test`) | done (wyniki w §14: CPX22 wystarcza, limitem jest CPU) | zmierzyć RAM/CPU/dysk realnej aplikacji; z pomiarów wynikają progi z §12 |
| 7 | Decyzja o rozmiarze serwera na podstawie pomiarów | waiting for owner (po pkt 6) | nie kupujemy na zapas |
| 8 | Hetzner Backups (+20%) lub snapshoty | needs money (decyzja właściciela) | kopia całego systemu; gdy jest co chronić |
| 9 | Test odtworzenia z backupu na czystym kontenerze | not started (free) | kopia nieprzetestowana odtworzeniem jest nadzieją |
| 10 | Sejf na sekrety zamiast plików w `/etc/serwerek` | not started (free: SOPS+age) | rotacja i audyt sekretów |
| 11 | Zewnętrzny monitoring (gdy padnie cały serwer, `health.sh` też padnie) | waiting for owner (konto UptimeRobot/Better Stack, darmowe plany) | alert o awarii całej maszyny |
| 12 | Worker FFmpeg + własny HLS, wideo z R2/CDN | not started | cel z `docs/architecture/serwerek.md` |
| 13 | Claude Code na serwerze + opcjonalny pulpit zdalny | not started (decyzja właściciela) | agent bliżej maszyny, patrz §12 |

## 12. Sugestie wymagające pieniędzy lub decyzji właściciela

Cena CPX22 (≈ €24,59/mies. z VAT) pochodzi z konsoli/faktury Hetzner z 2026-10-01. "+20%" za Hetzner Backups to wartość z dokumentacji Hetzner, niesprawdzona na fakturze; pozostałe pozycje bez liczb, dopóki nie sprawdzone.

- **Hetzner Backups (+20% ceny serwera)**: automatyczne kopie całego dysku. Jedyna ochrona przed utratą całej maszyny. Sens, gdy na serwerze jest coś, czego nie da się odtworzyć z repo i dumpów. Dla serwera testowego darmowy backup z §8 wystarcza.
- **Większy serwer**: dopiero gdy pomiary agenta testowego (pkt 6) pokażą trwały brak zapasu: RAM dostępny <300 MB (próg alertu), swap regularnie >2 GB, dysk >80%, albo transkodowanie FFmpeg blokuje aplikację. Zmiana tylko przez konsolę Hetzner ("Rescale", z restartem).
- **Serwer dedykowany**: dopiero przy stałym wysokim obciążeniu CPU (transkodowanie) lub gdy koszt chmury przekroczy koszt dedyka; do tego czasu nie.
- **Sejf na sekrety**: darmowy SOPS+age wystarczy; płatny menedżer tylko gdy sekretów i ludzi przybędzie.
- **Drugi węzeł / region**: układ dwumaszynowy z `docs/architecture/serwerek.md` (aplikacja osobno, worker osobno). Ma sens po stabilnym pkt 6 i potwierdzonym ruchu; podwaja koszt.
- **Coolify (lub podobny panel)**: wygoda deployów kosztem dodatkowej warstwy i RAM. Rozważyć przy kilku aplikacjach; dziś Docker Compose wystarcza.
- **Claude Code na serwerze + pulpit zdalny (KasmVNC)**: opcjonalna "pracownia" (agent blisko serwera, przeglądarka do paneli). Zużywa RAM (szacunek: kilkaset MB na pulpit i przeglądarkę, niezmierzone) i wymaga klucza Anthropic na serwerze. Hostname za Tunnel + Access, bez otwartych portów. Decyzja właściciela.
- **Płatne plany Cloudflare/Resend**: niepotrzebne; Zero Trust Free, R2 w darmowych 10 GB, Resend w obecnym planie.
- **Monitoring zewnętrzny**: hostnames za Access nie nadają się do pingu bez tokena usługi Access; użyj osobnego publicznego `/health` (po decyzji) albo tokena usługi.

## 13. TODO

- [x] Test wdrożenia aplikacji + Postgres (zrobione 2026-10-01, §14)
- [ ] Wpiąć wyniki pomiarów z §14 w progi z §12 (rozmiar: zostać na CPX22; CPX32 gdy >30 renderów/s, równoległe lub 1080p+ transkodowania)
- [ ] Worker wideo jako osobny kontener (ffmpeg pod `nice -n 19` + `MemoryMax`, §14)
- [ ] Test z Clerk w trybie test i z Redisem (auth, płatności i limity nie były testowane)
- [ ] Test odtworzenia z backupu na czystym kontenerze
- [ ] Claude Code na serwerze (decyzja właściciela)
- [ ] Sejf na sekrety
- [ ] Aktualizować "Stan faktyczny" w `docs/architecture/serwerek.md` po każdym etapie

## 14. Test wdrożenia aplikacji (2026-10-01)

Cel: sprawdzić, jak cała aplikacja zachowuje się na tym serwerze i ile zasobów bierze. **Test, nie produkcja**: pusta lokalna baza (migracje + seed), atrapy zmiennych, bez prawdziwych sekretów i danych, bez publicznej ekspozycji.

### Co stoi

- Pliki w repo (odtwarzalne): `deploy/serwerek/Dockerfile`, `deploy/serwerek/docker-compose.test.yml` (teraz; wtedy `docker-compose.yml`), `.dockerignore`. Jedyna zmiana w kodzie aplikacji: `next.config.mjs` włącza `output: 'standalone'` tylko gdy `NEXT_OUTPUT=standalone` (ustawia to Dockerfile; na Vercel nic się nie zmienia).
- Na serwerze: `/opt/serwerek/apps/polutek-test/` (`docker-compose.yml`, `src/` = `git archive` repo), dane Postgresa w `/opt/serwerek/data/polutek-test/pg`, narzędzia testowe w `/opt/serwerek/data/polutek-test/bench/` (skrypty, `ff/src.mp4`, `stats.csv`).
- Usługi: `app` (Next.js standalone, `mem_limit 1536m`, `127.0.0.1:3000`), `db` (postgres:17-alpine, `127.0.0.1:5433`), jednorazowe `migrate` (profil `tools`: `prisma migrate deploy` + `tsx prisma/seed.ts`). Redisa nie dodawano (brak danych logowania do REST Redis; aplikacja wstała bez niego).
- **Stan końcowy: stos ZATRZYMANY (`docker compose down`), dane i obrazy zostają** (obrazy ok. 4,4 GB, dane testowe ok. 290 MB, zob. "Sprzątanie").
- Żaden port firewalla nie został otwarty (UFW: dalej tylko 22/tcp), porty kontenerów tylko na 127.0.0.1.
- Tunnel ma wpis `apptest.pawelperfect.com` -> `127.0.0.1:3000` (za Access, ustawiony przez innego agenta). Przy zatrzymanym stosie ten adres zwraca błąd bramy; żeby go ożywić: `cd /opt/serwerek/apps/polutek-test && docker compose up -d`. Uwaga: aplikacja ma atrapę Clerk i `NEXT_PUBLIC_APP_URL=http://localhost:3100`, więc logowanie tam nie zadziała.

### Jak to odtworzyć

```
# z komputera (repo na wybranym commicie):
git archive HEAD | ssh serwerek 'mkdir -p /opt/serwerek/apps/polutek-test/src && tar -x -C /opt/serwerek/apps/polutek-test/src'
scp deploy/serwerek/docker-compose.test.yml serwerek:/opt/serwerek/apps/polutek-test/docker-compose.yml
# na serwerze, w /opt/serwerek/apps/polutek-test:
docker compose build app && docker compose --profile tools build migrate
docker compose up -d db && docker compose --profile tools run --rm migrate
docker compose up -d app
# tunel z komputera:  ssh -L 3100:127.0.0.1:3000 serwerek   ->  http://localhost:3100/en
```

### Zmienne środowiskowe (atrapy)

Aplikacja wstaje w trybie `NODE_ENV=production` bez prawdziwych sekretów. Użyte atrapy (pełna lista w compose): `DATABASE_URL`/`DATABASE_URL_UNPOOLED` (lokalny Postgres), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (atrapa `pk_test_...` kodująca `dummy.clerk.local$`, wypalana w bundlu przy budowaniu), `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `MAIN_CREATOR_SLUG=polutek`, `ADMIN_EMAIL`, `EMAIL_UNSUBSCRIBE_SIGNING_SECRET`, `HEALTHCHECK_TOKEN`. `validateAppEnv()` nie blokuje startu (używają jej tylko skrypty/diagnostyka), więc brak Stripe/Resend/Mux/Redis niczego nie wywraca przy starcie. **Nie testowano**: logowania (Clerk), płatności, e-maili, wideo z Cloudflare, limitowania żądań na Redisie.

### Wyniki

Środowisko: CPX22 (2 vCPU, 3,8 GB RAM + 4 GB swap), Ubuntu 26.04, Docker 29, Next.js 16.3.8 (Turbopack), baza z seedem (kilka filmów).

| Pomiar | Wynik |
|---|---|
| Build obrazu (zimny: `npm ci` 35 s + `next build` 35 s + eksport warstw) | ok. 2 min 47 s; kolejny build runnera z cache: 17 s |
| Rozmiar obrazu aplikacji (standalone) | 624 MB na dysku (164 MB skompresowane) |
| Rozmiar obrazu narzędziowego (migracje/seed, pełne `node_modules`) | 3,4 GB (tylko do migracji; do usunięcia po testach) |
| Zimny start aplikacji | restart -> `/api/health` 200 w 1,9 s; pierwszy `/en` 0,52 s, kolejne 0,06 s |
| RAM aplikacji: spoczynek / szczyt | 122 MiB / 240 MiB |
| RAM Postgresa: spoczynek / szczyt | 35 MiB / 69 MiB |
| Swap | praktycznie nieużywany (szczyt 2 MB, także podczas ffmpeg) |
| Szczyt RAM systemu (aplikacja + baza + ffmpeg + autocannon) | 1,37 GB z 3,8 GB |
| CPU aplikacji | szczyt ok. 158% (z 200%) przy `/en` |
| Lokalnie na serwerze (autocannon, 20 poł.), `/en` | 59 req/s, p50 330 ms, p99 448 ms (SSR, CPU-bound) |
| Lokalnie, `/api/channel/sidebar` (20 poł.) | 422 req/s, p50 44 ms, p99 103 ms |
| Przez tunel SSH z PC (10 poł., 45 s) | `/en` 28 req/s p50 332 ms; sidebar 80 req/s p50 122 ms; `/api/payment-settings` 92 req/s p50 102 ms; `/en/regulamin` 68 req/s p50 134 ms; 0 błędów |
| Obciążenie ciągłe ok. 10 min (3 poł., przez tunel, mieszanka tras) | 0 błędów i timeoutów; sidebar p50 113 ms, regulamin p50 125 ms, `/en` p50 199 ms z ogonem p99 ok. 1,8 s (zob. uwaga) |

Uwaga: pomiary przez tunel zależą od łącza domowego i jednego strumienia SSH (strona `/en` to 83 KB; ogon opóźnień jest w dużej mierze po stronie tunelu, bo lokalnie p99 to 448 ms). Dla samej aplikacji wiarygodne są pomiary lokalne na serwerze.

**FFmpeg** (źródło syntetyczne 1080p30, 60 s, drabinka HLS 720p 2,8 Mb/s + 480p 1,4 Mb/s, `libx264 -preset veryfast`, segmenty 6 s; skrypt `/opt/serwerek/data/polutek-test/bench/ladder.sh`):

| Scenariusz | Czas transkodowania | CPU ffmpeg | Szczyt RAM ffmpeg | Aplikacja w tym czasie (`/en`, 5 poł.) |
|---|---|---|---|---|
| Sama aplikacja (odniesienie) | n/d | n/d | n/d | 49 req/s, p50 97 ms, p99 171 ms |
| ffmpeg sam | 19 s (3,2x czasu rzeczywistego) | 189% | 295 MB | n/d |
| ffmpeg bez limitów + ruch | 37 s | 96% (rywalizacja o rdzenie) | 295 MB | 39 req/s, p50 122 ms, p99 245 ms, 0 błędów |
| `nice -n 19` + `systemd-run --scope -p MemoryMax=1500M -p MemorySwapMax=0 -p CPUQuota=100%` + ruch | 43 s | 85% | 301 MB | 36 req/s, p50 128 ms, p99 306 ms, 0 błędów |

Wnioski z ffmpeg: aplikacja pozostała responsywna przez cały czas (bez błędów), przepustowość SSR spadła o 20-28%, p50 wzrosło o 25-30 ms. `CPUQuota=100%` wydłużył transkodowanie o ok. 15% i **nie poprawił** widocznie opóźnień aplikacji (różnica p99 w granicach szumu), więc nie jest potrzebny; wystarczą `nice -n 19` i `MemoryMax` jako bezpiecznik pamięci. RAM ffmpeg przy 720p/480p to ok. 300 MB; wąskim gardłem jest CPU, nie pamięć.

### Co się zepsuło / uwagi

- Nic nie przerwało testu: 0 odpowiedzi innych niż 2xx, brak OOM, brak swapowania.
- Podczas `next build` brak `DATABASE_URL` daje błędy Prisma w logu (strony generowane statycznie pytają bazę), ale build kończy się poprawnie. Szum, nie błąd.
- Ostrzeżenia Next.js: `middleware` jest przestarzałe (nowa nazwa `proxy`), `themeColor` w metadata zamiast w viewport. Bez wpływu na test.
- `typescript.ignoreBuildErrors: true` w `next.config.mjs`: build w obrazie nie sprawdza typów (robi to CI).
- Nie sprawdzono: drabinki 1080p/4K (tylko 480/720), wielu równoczesnych transkodowań, realnego rozmiaru bazy, logowania i płatności. Źródło wideo było syntetyczne (testsrc2); materiał z kamery może iść szybciej lub wolniej.

### Werdykt

- **CPX22 wystarcza** na aplikację + Postgresa + jedno zadanie ffmpeg naraz przy małym ruchu: pamięć ma duży zapas (szczyt ok. 1,4 GB z 3,8 GB), a aplikacja wytrzymuje ok. 50-60 renderów strony głównej na sekundę lokalnie i setki żądań API na sekundę.
- Ograniczeniem jest **CPU (2 vCPU)**, nie RAM: transkodowanie zajmuje oba rdzenie i spowalnia SSR o ok. jedną czwartą.
- **Kiedy zwiększyć**: do CPX32 (4 vCPU, 8 GB), gdy (a) stały ruch przekracza ok. 30 renderów strony na sekundę, (b) transkodowania mają iść równolegle albo w 1080p+ (ffmpeg skaluje się z rdzeniami), albo (c) baza urośnie powyżej ok. 1 GB. Alternatywa bez zmiany rozmiaru: worker ffmpeg na osobnej, taniej maszynie (cel dwumaszynowy z `docs/architecture/serwerek.md`).
- Zalecane limity w compose docelowym: `app` `mem_limit: 1g`, `db` `mem_limit: 512m` + `shared_buffers=128MB`, ffmpeg w osobnym kontenerze/skrypcie pod `nice -n 19` z `MemoryMax=1500M`, bez `CPUQuota`. Zostaw swap (4 GB).
- Wideo dla widzów dalej idzie z Cloudflare, nie przez ten VPS, więc ruch wideo nie wlicza się do powyższych obciążeń.

### Sprzątanie

Stos jest zatrzymany, nie usunięty. Odzyskanie miejsca (nieobowiązkowe, wolne jest 58 GB): `docker rmi polutek-tools:test`, `rm -rf /opt/serwerek/data/polutek-test/bench/{ff,out_*}`. Całkowite usunięcie: `docker compose down -v` + `rm -rf /opt/serwerek/apps/polutek-test /opt/serwerek/data/polutek-test`.

## 15. Produkcja na serwerku: obraz, deploy, crony, IP klienta (kod gotowy 2026-10-01)

Cel: `www.pawelperfect.com` z serwerka w Dockerze za Cloudflare Tunnel, bez Vercela. To jest **kod i procedura**; samo przełączenie (env, DNS, Tunnel, Clerk/Stripe webhooki) robi osobna sesja. Test z §14 używa teraz `deploy/serwerek/docker-compose.test.yml` (dawny `docker-compose.yml`); `docker-compose.yml` to już stos produkcyjny.

### Obraz (`deploy/serwerek/Dockerfile`)

- Cele: `runner` (domyślny, aplikacja, standalone), `migrator` (tylko `prisma` w wersji z `package-lock.json` + `prisma/`, bez `node_modules` aplikacji; używa go `deploy.sh`).
- Build args `NEXT_PUBLIC_*` (wypalane w bundlu klienta, publiczne z założenia): `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_R2_PUBLIC_HOST`, `NEXT_PUBLIC_BLOB_PUBLIC_HOST`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL` (to wszystkie, które czyta kod; `NEXT_PUBLIC_TIP_*` są tylko w `.env.example`). Domyślne wartości to atrapy, więc zwykły `docker build` nadal działa. **Zmiana któregokolwiek wymaga przebudowania obrazu.** Sekrety (`CLERK_SECRET_KEY`, `STRIPE_*`, `DATABASE_URL`...) nigdy nie trafiają do obrazu, tylko do `app.env` w runtime.
- `.next/cache` należy do `node` (cache optymalizatora `next/image`), użytkownik `node`, `HEALTHCHECK` na `/api/health` (status <500 = żyje; 15 s / start 40 s).

### Układ na serwerze: `/opt/serwerek/apps/polutek/`

`docker-compose.yml`, `deploy.sh` (z repo), `app.env`, `db.env`, `build.env` (root, 600, nie w repo), `src/` (`git archive` commita do wdrożenia), `.current-image`/`.previous-image`. Dane Postgresa 17: `/opt/serwerek/data/polutek/pg`. Porty tylko `127.0.0.1` (app `:3000`, db `:5432`); Tunnel dla `www.pawelperfect.com` -> `http://127.0.0.1:3000`.

- `app.env`: `DATABASE_URL`/`DATABASE_URL_UNPOOLED` (`postgresql://...@db:5432/...`), Clerk, Stripe, Resend, R2, `CRON_SECRET`, `HEALTHCHECK_TOKEN`, Upstash/KV (limity), `NEXT_PUBLIC_*` (jak w build.env, tylko dla spójności) i **`TRUST_CF_CONNECTING_IP=true`**.
- `db.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. `build.env`: tylko publiczne `NEXT_PUBLIC_*=...`.

### Deploy (`deploy/serwerek/deploy.sh <tag>`, na serwerze)

```
git archive <sha> | ssh serwerek 'rm -rf /opt/serwerek/apps/polutek/src && mkdir -p /opt/serwerek/apps/polutek/src && tar -x -C /opt/serwerek/apps/polutek/src'
scp deploy/serwerek/{deploy.sh,docker-compose.yml} serwerek:/opt/serwerek/apps/polutek/
ssh serwerek 'cd /opt/serwerek/apps/polutek && ./deploy.sh <sha>'
```

Kroki: build `runner`+`migrator` (pomijany, gdy obrazy tego tagu już są), start `db`, **zrzut `pg_dump` przed migracją** (`/opt/serwerek/backups/pre-deploy-*.sql.gz`, 14 dni), `prisma migrate deploy` w jednorazowym kontenerze (błąd = aplikacja NIE jest restartowana), start `app` na nowym obrazie, czekanie na `healthy` (150 s). Gdy nie wstanie: automatyczny powrót do poprzedniego obrazu (`.previous-image`) i kod wyjścia 1. Ręczny powrót: `./deploy.sh <cokolwiek> --rollback`. Migracje w tym repo są addytywne, więc rollback przywraca tylko kod, nie schemat. Idempotentny: ponowne uruchomienie z tym samym tagiem nic nie psuje. Trzyma 3 ostatnie obrazy. **Nie testowano na serwerze** (kod pisany bez dostępu do Dockera; pierwszy deploy sprawdzić na `polutek-test`).

### Crony (zamiast Vercel Crons)

`scripts/serwerek/cron-runner.sh <nazwa>` wywołuje `GET http://127.0.0.1:3000/api/cron/<nazwa>` z `Authorization: Bearer $CRON_SECRET` (sekret przez stdin do curl, nie widać go w `ps`; kod HTTP inny niż 2xx = niezerowy kod wyjścia, więc `systemctl` pokazuje błąd). Jednostki w `deploy/serwerek/systemd/`: szablon `polutek-cron@.service` + 4 timery (godziny w UTC, jak na Vercel):

| Timer | Trasa | Harmonogram |
|---|---|---|
| `polutek-cron-stripe-reconciliation` | `stripe-reconciliation` | co 15 min |
| `polutek-cron-video-provider-jobs` | `video-provider-jobs/reconcile` (alias `video-provider-jobs-reconcile`) | 04:00 |
| `polutek-cron-prune-playback-sessions` | `prune-playback-sessions` | 05:00 |
| `polutek-cron-sync-public-thumbnails` | `sync-public-thumbnails` | 06:00 |

Instalacja: `install -m755 scripts/serwerek/cron-runner.sh /opt/serwerek/scripts/`; `/etc/serwerek/cron.env` z jedną linią `CRON_SECRET=...` (root, 600; to piąty dozwolony plik z sekretem obok §4); `cp deploy/serwerek/systemd/* /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now polutek-cron-*.timer`. Podgląd: `systemctl list-timers 'polutek-cron-*'`, `journalctl -u 'polutek-cron@*' -n 50`. Po przełączeniu usuń sekcję `crons` z `vercel.json` albo wyłącz projekt Vercel, żeby crony nie szły podwójnie.

### Adres IP klienta (limity i audyt)

Wszystkie limity i adres w audycie biorą IP z jednego helpera `lib/api/client-ip.ts` (`getClientIp`; `getAdminClientIp` i `getMediaClientIp` go opakowują). Domyślnie (Vercel) bez zmian: ostatni hop `X-Forwarded-For`, potem `X-Real-IP`. Z `TRUST_CF_CONNECTING_IP=true` używa `CF-Connecting-IP`, a gdy brak/zepsuty nagłówek wraca do domyślnego łańcucha. **Włączaj tylko gdy aplikacja jest osiągalna wyłącznie przez Cloudflare Tunnel (origin na 127.0.0.1)**; inaczej każdy mógłby podszyć się pod dowolne IP i ominąć limity.
