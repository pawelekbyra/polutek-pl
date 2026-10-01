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
- **Nie ma jeszcze** produkcyjnej aplikacji ani workera. Trwa test wdrożenia w `/opt/serwerek/apps/polutek-test` (inny agent; jego notatki: `ai-log`).

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
| 6 | Test wdrożenia aplikacji + Postgres (`polutek-test`) | in progress (inny agent) | zmierzyć RAM/CPU/dysk realnej aplikacji; z pomiarów wynikają progi z §12 |
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

- [ ] Wpiąć wyniki pomiarów z `polutek-test` w progi z §12
- [ ] Test odtworzenia z backupu na czystym kontenerze
- [ ] Claude Code na serwerze (decyzja właściciela)
- [ ] Sejf na sekrety
- [ ] Aktualizować "Stan faktyczny" w `docs/architecture/serwerek.md` po każdym etapie
