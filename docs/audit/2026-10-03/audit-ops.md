# Audyt infrastruktury i operacji: serwerek / pawelperfect.com (2026-10-03)

Audyt tylko do odczytu. Źródła: repo (`main` @ 88c787d0), polecenia odczytu przez `ssh serwerek` (ok. 17:40-18:05 CEST, 9 min po restarcie serwera), publiczne `curl`/DNS (DoH 1.1.1.1), lista wdrożeń Vercel (odczyt). Nie czytano wartości sekretów (z plików `.env` tylko nazwy zmiennych). Jedyne użycie poświadczeń: `rclone lsl/size` na buckecie kopii (odczyt, bez wypisywania kluczy).

---

## 1. Podsumowanie i ocena

**Ocena ogólna: 6/10 ("solidny start, nie wzorzec").** Podstawy są dobre: brak publicznych portów poza SSH (zweryfikowane `ss`), Tunnel + Access, SSH tylko kluczem, UFW + fail2ban, limity pamięci na wszystkich kontenerach, healthy app/db, deploy z zrzutem przed migracją i automatycznym rollbackiem, kopia poza serwerem w R2 (zweryfikowana: 28 obiektów, 9,8 MiB, dzisiejsze pliki są), crony systemd działają (wszystkie HTTP 200), dziennik zmian `ai-log`.

Największe ryzyka (poza samym faktem "jeden serwer"):

1. **Sekrety produkcyjne trafiają do kopii w R2** wbrew dokumentacji: archiwum `configs-*.tar.gz` zawiera `app.env.bak-hls-20261002` i `app.env.pre-betterauth.bak` (wzorzec `--exclude='*.env'` ich nie łapie), niezaszyfrowane.
2. **Vercel nadal wdraża produkcję przy każdym merge'u i ma aktywne Vercel Crons** (`vercel.json`) na starym Neonie, w tym `sync-public-thumbnails`, który kasuje "osierocone" obiekty we wspólnym publicznym buckecie miniatur. Apex `pawelperfect.com` i `pawelperfect.pl` nadal są serwowane przez Vercel (`Server: Vercel`).
3. **Dane wideo w R2 (oryginały, HLS, miniatury) nie mają żadnej kopii ani blokady**, a ten sam token R2 (w `app.env` i `worker.env`) może je skasować; kopie bazy co 24 h (RPO do 24 h), bez PITR.
4. **Budowanie obrazów na produkcji** (Next build z `--max-old-space-size=3072` na maszynie 3,8 GB, w której stos zajmuje ok. 1,8 GB, encoder ma bezpiecznik 1,5 GB), 34 GB cache buildera, obraz nigdy nie budowany w CI.
5. **Monitoring tylko z wnętrza serwera**, alert e-mailem na adres, który przez Email Worker trafia do PP Support na tym samym serwerze; brak alertu o nieudanym backupie/cronie.

Liczba znalezisk: **P0: 0, P1: 7, P2: 16, P3: 8 (razem 31).**

---

## 2. Stan faktyczny

### 2.1 Host

| Pozycja | Stan |
|---|---|
| Maszyna | Hetzner CPX22, 2 vCPU, 3,8 GB RAM, swap 4 GB (plik, `vm.swappiness=10`), dysk 75 GB: **49 GB zajęte (69%)**, 23 GB wolne |
| System | Ubuntu 26.04.1 LTS, jądro 7.0.0-34 (zainstalowane też stare 7.0.0-30; w `-updates` czeka 7.0.0-38) |
| Docker | 29.8.2 (docker-ce z repo Dockera), compose plugin 5.5.1 (5.6.0 dostępny), containerd 2.3.6, storage overlayfs, cgroup v2, `live-restore=false`, **brak `/etc/docker/daemon.json`** |
| Czas | Europe/Warsaw, chrony, zsynchronizowany |
| SSH | port 22 na 0.0.0.0/::, `PermitRootLogin prohibit-password`, `PasswordAuthentication no`, `KbdInteractive no`, **`X11Forwarding yes`, `AllowAgentForwarding yes`, `MaxAuthTries 6`, `LoginGraceTime 120`**; 1 klucz ed25519 w `/root/.ssh/authorized_keys`; jedyny użytkownik interaktywny: root |
| Zapory | UFW: deny in, allow 22/tcp (v4+v6), logging low. Hetzner FW `serwerek-fw` (wg dokumentacji; nie weryfikowano API) |
| fail2ban | 1 jail `sshd`, 6 banów od startu, 1 aktywny |
| Aktualizacje | `unattended-upgrades` tylko `-security` + ESM; **brak `Automatic-Reboot`**; Docker, containerd, cloudflared (repo zewnętrzne) i rclone nie są objęte |
| Logi | journald 32 MB (domyślne limity), sysstat aktywny, `/var/log/serwerek/*.log` bez logrotate (health.sh sam przycina swój log) |
| OOM | brak zdarzeń OOM w `journalctl -k` od restartu |

### 2.2 Usługi i porty

| Usługa | Obraz | Port hosta | Limit RAM | Zużycie (spoczynek) | Healthcheck | Log rotation | Użytkownik |
|---|---|---|---|---|---|---|---|
| polutek-app | `polutek-app:f10031614` (632 MB) | 127.0.0.1:3000 | 1 GiB | 214 MiB | tak (obraz) | **brak** | node |
| polutek-db | `postgres:17-alpine` (17.11) | 127.0.0.1:5432 | 512 MiB | 73 MiB | tak | **brak** | postgres (po entrypoincie) |
| polutek-redis | `redis:7-alpine` (AOF, 128 MB LRU) | brak | 192 MiB | 8 MiB | **brak** | **brak** | redis |
| polutek-srh | `hiett/serverless-redis-http:latest` (**obraz sprzed 2 lat**) | brak | 128 MiB | 71 MiB | **brak** | **brak** | root |
| polutek-encoder | `polutek-worker:f10031614` (**2,3 GB**) | brak | 1500 MiB, `cpu_shares 256` | 96 MiB | **brak** | 20m x3 | node |
| pp-support-web | `pp-support:4.18.0` (retag `chatwoot/chatwoot:v4.18.0-ce`, 2,7 GB) | 127.0.0.1:3010 | 700 MiB | 422 MiB | tak | **brak** | **root** |
| pp-support-sidekiq | j.w. | brak | 640 MiB | 443 MiB | **brak** | **brak** | **root** |
| pp-support-db | `pgvector/pgvector:0.8.7-pg17` | 127.0.0.1:5434 | 256 MiB | 63 MiB | tak | **brak** | postgres |
| pp-support-redis | `redis:7-alpine` (noeviction) | brak | 128 MiB | 10 MiB | tak | **brak** | redis |
| cloudflared-serwerek | systemd, 2026.9.3, `--no-autoupdate`, 4 połączenia QUIC (cdg/fra) | 127.0.0.1:20241 (metrics) | - | - | - | journald | root |
| serwerek-placeholder | systemd, `python3 -m http.server` | 127.0.0.1:8088 | - | - | - | - | nobody |
| caddy | zainstalowany, wyłączony | - | - | - | - | - | - |

Suma limitów pamięci kontenerów: **ok. 5,08 GB przy 3,8 GB RAM** (realne zużycie ok. 1,8 GB, "available" ok. 2,0 GB). Żaden kontener nie ma `cap_drop`, `no-new-privileges`, `read_only` ani `pids_limit`. Sieci: `polutek_default`, `pp-support_default` (rozdzielone). Wszystkie kontenery `restart: unless-stopped`.

### 2.3 Postgres (polutek)

17.11, baza 26 MB, 19 połączeń (14 z aplikacji), `shared_buffers=128MB`, `max_connections=60`, `work_mem=4MB`, `effective_cache_size=4GB` (domyślne, za dużo przy limicie 512 MiB), `wal_level=replica`, **`archive_mode=off`**, `data_checksums=off`, `statement_timeout=0`, `idle_in_transaction_session_timeout=0`, `log_min_duration_statement=-1`, autovacuum on. **Jedyna rola logowania to superuser `polutek`, której używają aplikacja, encoder i migrator.** PP Support: 20 MB, rola `pp_support` też superuser.

### 2.4 Dysk (główni konsumenci)

| Pozycja | Rozmiar |
|---|---|
| Cache buildera Dockera | **34,2 GB (27,2 GB do odzyskania)** |
| Obrazy | 10,8 GB (3,7 GB do odzyskania; m.in. `polutek-tools:test` 3,4 GB) |
| `/opt/serwerek/data` | 602 MB (z tego `polutek-test` 326 MB, `polutek-prod` 80 MB = śmieci) |
| `/opt/serwerek/backups` | 48 MB (29 zrzutów pre-deploy/ad hoc + nocne) |

### 2.5 Timery i cron

| Zadanie | Mechanizm | Ostatni wynik |
|---|---|---|
| stripe-reconciliation | timer systemd co 15 min (`Persistent=false`) | HTTP 200 (17:45) |
| prune-unverified-accounts / video-provider-jobs / prune-playback-sessions / sync-public-thumbnails | timery dzienne 03:30/04:00/05:00/06:00 UTC, `Persistent=true` | HTTP 200 (2026-10-03) |
| backup.sh | `/etc/cron.d/serwerek-backup` 02:30 | `fail=0`, ale każda wysyłka R2 najpierw 501 |
| health.sh | `/etc/cron.d/serwerek-health` co 5 min | OK |
| Vercel Crons (poza serwerem!) | `vercel.json`: video-provider-jobs 04:00, prune-playback 05:00, sync-public-thumbnails 06:00 UTC | **nadal aktywne na projekcie Vercel** |

Pliki unitów w repo (`deploy/serwerek/systemd/*`, `scripts/serwerek/cron-runner.sh`) są identyczne z serwerem.

### 2.6 Brzeg (Cloudflare) - publiczne sprawdzenia

| Host | Wynik |
|---|---|
| `www.pawelperfect.com` | 200 z Tunnel; HSTS `max-age=31536000; includeSubDomains; preload`, CSP, `X-Frame-Options: DENY`, **`X-Powered-By: Next.js`**; HTML `DYNAMIC`, `/_next/static/*` `HIT` + `immutable` (dobrze). **`http://www...` zwraca 200 (brak przekierowania na HTTPS)** |
| `pawelperfect.com`, `pawelperfect.pl` | 301/308 na `www.pawelperfect.com`, **`Server: Vercel`** |
| `video.pawelperfect.com` | Worker, 404 dla `/` i niepoprawnego tokenu (dobrze) |
| `support.pawelperfect.com` | 302 do Access; wyjątki: `/api` 200, `/auth/sign_in` 302 do `/app/login` (poza Access), `/cable` i `/rails/active_storage` 404 bez Access |
| `test.`, `apptest.` | 302 do Access. **`apptest` wskazuje `127.0.0.1:3000`, czyli dziś PRODUKCYJNĄ aplikację** (stos `polutek-test` zatrzymany) |
| `thumbs.pawelperfect.pl` | 404 dla `/` (publiczny bucket R2, OK) |
| DNS poczty | MX obu domen: Cloudflare Email Routing; SPF `include:_spf.mx.cloudflare.net ~all`; DKIM `resend._domainkey` + `cf2024-1` + **pozostały `google._domainkey`**; `send.` SPF/MX Amazon SES (Resend). **DMARC `p=none`** (.pl bez `rua`), brak MTA-STS/TLS-RPT |
| DNSSEC / CAA | **brak DS dla `.com` i `.pl`, brak CAA** |

---

## 3. Znaleziska

Legenda: waga P0 (natychmiast) ... P3 (porządki); nakład S (< 2 h), M (pół dnia - 2 dni), L (> 2 dni).

### OPS-01 | P1 | bezpieczeństwo | sekrety produkcyjne w kopii poza serwerem
- **Miejsce:** `/opt/serwerek/scripts/backup.sh` krok 2; R2 `serwerek-backups/configs-*.tar.gz`.
- **Problem:** `tar ... --exclude='*.env' --exclude='*/.env'` nie wyklucza `app.env.bak-hls-20261002` ani `app.env.pre-betterauth.bak` (sprawdzone `tar tzf configs-20261003-172737.tar.gz`). Pierwszy z nich (2026-10-02 07:40, po wdrożeniu Better Auth) zawiera komplet runtime: Stripe live secret, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, Resend, R2, Mux, `HLS_TOKEN_SECRET`... Archiwa są niezaszyfrowane, leżą lokalnie 7 dni i w R2 14 dni. SERWEREK.md §16 twierdzi "archiwum configs wyklucza `*.env` (sekrety nie idą do R2)". Dodatkowo archiwum zawiera logi deployu (`deploy-*.log`).
- **Naprawa:**
  1. Przenieść `.bak` poza drzewo `apps/` (np. do `/root/secret-archive/` 700) albo usunąć po decyzji właściciela; to samo `deploy.sh.bak-*`, `docker-compose.yml.bak-*`.
  2. W `backup.sh` przejść na listę dozwolonych zamiast wykluczeń i dodać twarde wykluczenia: `--exclude='*.env*' --exclude='.env*' --exclude='*.bak*' --exclude='*.log' --exclude='*/secrets/*'`.
  3. Szyfrować wszystko przed wysyłką: `age -r <publiczny-klucz-właściciela>` (klucz prywatny tylko offline u właściciela), np. `pg_dumpall ... | gzip | age -r "$AGE_RECIPIENT" > ...sql.gz.age`.
  4. Usunąć z R2 obiekty `configs-2026100{2,3}-*.tar.gz` (albo odczekać 14 dni) i zdecydować o rotacji sekretów, które w tych plikach są nadal aktualne (Stripe secret key i webhook secret, klucze R2, Resend, Google client secret, `HLS_TOKEN_SECRET`; `BETTER_AUTH_SECRET` tylko świadomie: rotacja wylogowuje wszystkich i psuje TOTP).
- **Nakład:** S (skrypt) + M (rotacja). **Pewność:** wysoka (zweryfikowane listą archiwum). **Koszt:** brak.

### OPS-02 | P1 | dostępność / integralność danych | Vercel jako drugi, "cichy" backend produkcyjny
- **Miejsce:** projekt Vercel `polutek.pl` (team `pawelperfect-5617s-projects`), `vercel.json`, `.github/workflows/production-db-migrations.yml`.
- **Problem:** każdy merge do `main` daje nowe wdrożenie produkcyjne na Vercel (ostatnie: `88c787d0`, READY). `vercel-build` uruchamia `prisma migrate deploy` na Neonie, a `vercel.json` nadal ma 3 Vercel Crons, które wołają produkcyjne wdrożenie (crony omijają ochronę SSO). `sync-public-thumbnails` (`reconcilePublicThumbnails`) kasuje z **wspólnego** publicznego bucketu miniatur obiekty, których nie reklamuje żaden film w bazie: na Vercelu to stary Neon, więc miniatury filmów dodanych na serwerku po 2026-10-01 mogą być codziennie kasowane o 06:00 UTC i odtwarzane przez cron serwerka o tej samej godzinie (wyścig). Skutek zależy od tego, czy env Vercela ma jeszcze ważny token R2 (CLAUDE.md: zmienne R2 były ustawione w Vercelu; nowy token wygenerowano dla serwerka, stary prawdopodobnie nadal ważny). `video-provider-jobs/reconcile` na Neonie może też wołać API Mux/Stream. Workflow `production-db-migrations.yml` (ręczny) celuje w `secrets.DATABASE_URL` (Neon).
- **Naprawa:** (a) usunąć sekcję `crons` z `vercel.json` i dodać `"git": {"deploymentEnabled": false}` (albo odłączyć repo w Settings, Git); (b) z env Vercela usunąć sekrety R2/Stripe/Resend/Mux/DB (zostaje projekt tylko do przekierowań, patrz OPS-03, albo usunięcie po decyzji); (c) usunąć lub przepiąć `production-db-migrations.yml`; (d) sprawdzić w logach Vercela (Runtime logs, ścieżka `/api/cron/sync-public-thumbnails`), czy coś kasowało.
- **Nakład:** S. **Pewność:** wysoka co do wdrożeń i cronów, średnia co do faktycznego kasowania. **Koszt:** brak.

### OPS-03 | P1 | dostępność | apex i domena .pl zależą od Vercela
- **Miejsce:** DNS `pawelperfect.com` (apex), `pawelperfect.pl`, `www.pawelperfect.pl`.
- **Problem:** przekierowania na `www.pawelperfect.com` serwuje Vercel. Planowane zamknięcie konta Vercel (STATUS-2026-10-03 pkt 3) wyłączy apex `.com` i całe `.pl` (strona i linki w starych mailach).
- **Naprawa:** w Cloudflare: rekordy apex jako proxied (np. `AAAA 100::` lub `A 192.0.2.1`, proxied), reguła Redirect Rules (plan Free: 10 reguł) `http.host in {"pawelperfect.com" "pawelperfect.pl" "www.pawelperfect.pl"}` -> `https://www.pawelperfect.com${uri}` 301, z zachowaniem ścieżki i query. Dopiero potem odpiąć domeny w Vercelu.
- **Nakład:** S. **Pewność:** wysoka (`Server: Vercel`). **Koszt:** brak.

### OPS-04 | P1 | utrata danych | RPO do 24 h, brak PITR
- **Miejsce:** `backup.sh` (nocny `pg_dumpall`), Postgres `archive_mode=off`.
- **Problem:** awaria dysku/serwera o 02:00 = utrata prawie doby: konta, komentarze, wgrane filmy (wiersze), zdarzenia płatności (Stripe pozwala odtworzyć płatności, ale nie resztę). Zrzuty pre-deploy zostają na tym samym dysku.
- **Naprawa:**
  - Natychmiast (S): co godzinę zrzut samej bazy `polutek` do R2 (baza 26 MB, zrzut ok. 600 KB; 24 x 14 dni = ok. 200 MB, w darmowych 10 GB). Timer systemd `serwerek-backup-hourly.timer` z `pg_dump -Fc` + age + rclone.
  - Docelowo (M): **WAL-G** (lub pgBackRest) do R2: obraz Postgresa z binarką wal-g (Dockerfile w repo), `archive_mode=on`, `archive_command='wal-g wal-push %p'`, `archive_timeout=300`, kompresja zstd, szyfrowanie libsodium; base backup co noc (`wal-g backup-push`), retencja 14 dni (`wal-g delete retain FULL 14`). Daje PITR z RPO <= 5 min. Test odtworzenia do punktu w czasie raz w miesiącu.
- **Nakład:** S / M. **Pewność:** wysoka. **Koszt:** w darmowym limicie R2 (sprawdzić operacje klasy A przy WAL co 5 min: ok. 9 tys./mies., limit Free 1 mln).

### OPS-05 | P1 | utrata danych / bezpieczeństwo | treści wideo w R2 bez kopii i bez blokady, jeden token do wszystkiego
- **Miejsce:** buckety `polutek` (oryginały), `polutek-hls`, `polutek-thumbnails(-private)`; `CLOUDFLARE_R2_ACCESS_KEY_ID/SECRET` w `app.env` i `worker.env` (te same nazwy, prawdopodobnie ten sam token).
- **Problem:** oryginały to jedyne niezastąpione dane wideo (HLS da się odtworzyć z oryginałów). Brak wersjonowania, blokady i drugiej kopii; błąd w kodzie (np. cleanup), kompromitacja aplikacji lub agenta = skasowanie wszystkiego. Backup obejmuje tylko wiersze bazy, nie obiekty.
- **Naprawa:** (1) R2 **bucket lock** na `polutek` (np. prefiks `videos/`, retencja 30-90 dni lub bezterminowo) i na miniaturach prywatnych; (2) osobne tokeny: aplikacja (presign uploadu do `polutek`, miniatury), encoder (odczyt `polutek`, zapis `polutek-hls`, bez kasowania oryginałów), Worker (binding, bez tokenu); (3) druga kopia oryginałów poza Cloudflare (decyzja kosztowa: Hetzner Storage Box BX11 ok. 4 EUR/mies. albo Backblaze B2) przez `rclone copy --immutable` po każdym uploadzie / nocą.
- **Nakład:** M. **Pewność:** wysoka (konfiguracja), średnia (czy tokeny są wspólne). **Koszt:** blokada bez kosztu; druga kopia płatna.

### OPS-06 | P1 | utrata danych | kopia w R2 do skasowania z serwera, bez szyfrowania
- **Miejsce:** `backup.sh` krok 4 (`rclone delete --min-age 14d`), token `serwerek-backups-r2` w `/etc/serwerek/backup.env`.
- **Problem:** token ma prawo kasowania; root na serwerze (atak, błąd agenta) usuwa wszystkie kopie poza serwerem. Kopie nie są szyfrowane (zob. OPS-01).
- **Naprawa:** bucket lock na `serwerek-backups` (retencja 14 dni) + reguła lifecycle "usuń po 15 dniach"; z `backup.sh` wyrzucić `rclone delete`. Szyfrowanie age (OPS-01). Raz na kwartał kopia "zimna" do miejsca, do którego serwer nie ma dostępu (np. pobranie na komputer właściciela).
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak (mieści się w 10 GB).

### OPS-07 | P1 | dostępność | budowanie obrazów na produkcyjnym serwerze, CI nie buduje obrazu
- **Miejsce:** `deploy.sh` krok 1, `deploy/serwerek/Dockerfile` (`NODE_OPTIONS=--max-old-space-size=3072`), `.github/workflows/ci.yml` (job `build` = `npm run build`, nie Docker).
- **Problem:** Next build może wziąć do 3 GB sterty na maszynie z 3,8 GB RAM, gdzie stos zajmuje ok. 1,8 GB, a encoder może urosnąć do 1,5 GB: realne ryzyko swapowania i OOM-killera (ofiarą może być Postgres lub PP Support). Budowa zajmuje oba vCPU (SSR wolniejszy o 20-30%, pomiar §14). Każdy deploy buduje 3 obrazy (worker 2,3 GB); cache buildera urósł do 34 GB (69% dysku, alert przy 80%). Dockerfile nie jest budowany w CI, więc błąd obrazu wychodzi dopiero przy deployu na produkcji; obraz nie ma digestu ani podpisu.
- **Naprawa:**
  - Docelowo (M): GitHub Actions buduje `runner`/`migrator`/`worker` z `docker/build-push-action` (cache `type=gha`), wypycha do **GHCR (prywatne)** z tagiem `sha` i zapisuje digest; opcjonalnie `cosign sign` (keyless, OIDC). `deploy.sh <digest>` robi tylko `docker pull ghcr.io/...@sha256:...` (token GHCR read-only w `/etc/serwerek/ghcr.env`). Build args `NEXT_PUBLIC_*` jako zmienne repo (są publiczne).
  - Doraźnie (S): w `deploy.sh` przed buildem `df` (min. 10 GB wolne) i sprawdzenie, czy encoder nie koduje (zapytanie o `VideoEncodeJob` w stanie RUNNING); `NODE_OPTIONS=--max-old-space-size=1536`; po deployu `docker builder prune -f --keep-storage 8GB`; w `daemon.json` GC buildera (OPS-11).
- **Nakład:** M. **Pewność:** wysoka (konfiguracja), średnia (realne zużycie pamięci przy buildzie obok pełnego stosu nie było mierzone; pomiar §14 był przed uruchomieniem produkcji i PP Support). **Koszt:** brak (GHCR i Actions w limitach darmowych dla repo).

### OPS-08 | P2 | dostępność | brak monitoringu z zewnątrz, alert wraca na ten sam serwer
- **Miejsce:** `health.sh` (cron na serwerze), `/etc/serwerek/alert.env` (`ALERT_TO` = wg dokumentacji `hello@pawelperfect.com`).
- **Problem:** pad serwera, sieci Hetznera lub Tunnelu = cisza. `hello@` od 2026-10-02 idzie przez Email Worker do PP Support na tym samym serwerze (kopia do Gmaila ratuje sytuację tylko, jeśli Worker działa).
- **Naprawa:** (1) UptimeRobot lub Better Stack (plany darmowe): HTTP `https://www.pawelperfect.com/api/health` (oczekiwane `{"ok":true}`), `https://video.pawelperfect.com/` (oczekiwane 404 z Workera), `https://support.pawelperfect.com/api` (200); (2) **Healthchecks.io** (darmowe 20 sprawdzeń) jako "dead man's switch": ping z `health.sh` co 5 min (brak pingu = serwer nie żyje), z `backup.sh` (start/sukces/fail), z timerów cron (OPS-09); (3) Cloudflare Notifications: alert zdrowia Tunnelu; (4) `ALERT_TO` na `pawel.perfect@gmail.com` bezpośrednio.
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-09 | P2 | dostępność / utrata danych | brak alertu o nieudanym backupie, cronie i innych stanach
- **Miejsce:** `backup.sh` (tylko log), `polutek-cron@.service` (brak `OnFailure=`), `health.sh`.
- **Problem:** nieudany backup lub cron (np. `stripe-reconciliation`) nie daje maila. `health.sh` nie sprawdza: encodera, wieku ostatniej udanej kopii, `systemctl --failed`, `/run/reboot-required`, rozmiaru cache buildera, wolnego miejsca na `/opt/serwerek/data/video-work`.
- **Naprawa:** jednostka `serwerek-alert@.service` (wysyła mail przez to samo API Resend) i w `polutek-cron@.service` + przyszłej `serwerek-backup.service`: `OnFailure=serwerek-alert@%n.service`; przenieść backup z cron.d na timer systemd. W `health.sh` dodać: `grep -q "done fail=0" <(tac backup.log | grep -m1 "== done")` i wiek < 26 h; `systemctl is-failed` dla `polutek-cron@*`; kontener `polutek-encoder-1`; `[ -f /run/reboot-required ]`.
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-10 | P2 | utrata danych | `501 NotImplemented` przy każdym uploadzie rclone do R2
- **Miejsce:** `backup.sh` krok 4; rclone `1.60.1+dfsg-4ubuntu3.2` (pakiet Ubuntu, wersja z 2022).
- **Diagnoza:** w każdym przebiegu pierwsza próba wysłania KAŻDEGO pliku kończy się `Failed to copy: NotImplemented ... status code: 501`, a "Attempt 2/3" przechodzi. Pliki faktycznie są w buckecie (sprawdzone `rclone lsl`, rozmiary zgodne). Konfiguracja przez env: `type=s3 provider=Cloudflare`, endpoint, `no_check_bucket=true`, bez `region` i bez `acl`. Najbardziej prawdopodobna przyczyna: stara biblioteka S3 w rclone 1.60 wysyła przy pierwszym PUT nagłówek, którego R2 nie obsługuje (w znanych zgłoszeniach dla dokładnie tego objawu z rclone 1.60 i R2: `X-Amz-Acl`); poprawka w nowszych wersjach rclone. Dokumentacja Cloudflare wymaga rclone >= 1.59 i podaje konfigurację z `provider = Cloudflare`, `region = auto`. Ryzyko: zachowanie "ponów aż przejdzie" maskuje prawdziwe błędy, a `rclone copy` z ponowieniem nie weryfikuje treści.
- **Naprawa:**
  1. Diagnoza bez zgadywania (jednorazowo): `rclone copyto -vv --dump headers --retries 1 /etc/hostname R2:serwerek-backups/_probe/hostname` (rclone maskuje `Authorization`) i odczytać nagłówki żądania, na które przyszło 501; potem `rclone deletefile` próbki.
  2. Zainstalować aktualny rclone z oficjalnego pakietu `.deb` z rclone.org (przypięta wersja, sprawdzona suma SHA256) zamiast pakietu Ubuntu; `apt-mark hold rclone`, żeby apt nie cofnął.
  3. W `backup.sh`: `export RCLONE_CONFIG_R2_REGION=auto` (oraz, jeśli diagnoza potwierdzi ACL, `RCLONE_CONFIG_R2_ACL=private` albo pusty zgodnie z dokumentacją R2 dla danej wersji), `rclone copy ... --retries 1 --low-level-retries 3`, a po wysyłce `rclone check "$D" R2:serwerek-backups --one-way --include "*$TS*"` i dopiero wtedy `r2 upload ok`.
- **Nakład:** S. **Pewność:** wysoka co do starej wersji jako przyczyny, średnia co do konkretnego nagłówka. **Koszt:** brak.

### OPS-11 | P2 | dostępność | brak rotacji logów kontenerów, brak `daemon.json`
- **Miejsce:** 8 z 9 kontenerów: `json-file` bez `max-size`. Aplikacja loguje ostrzeżenie `themeColor` przy każdym renderze.
- **Problem:** przy ruchu logi rosną bez końca (dysk 75 GB, już 69% zajęte).
- **Naprawa:** `/etc/docker/daemon.json`:
  ```json
  {
    "log-driver": "local",
    "log-opts": { "max-size": "10m", "max-file": "5" },
    "live-restore": true,
    "no-new-privileges": true,
    "builder": { "gc": { "enabled": true, "defaultKeepStorage": "10GB" } }
  }
  ```
  `systemctl restart docker` (w oknie serwisowym; zmiana sterownika logów dotyczy nowo tworzonych kontenerów, więc potem `docker compose up -d --force-recreate` obu stosów). W kodzie przenieść `themeColor` do `export const viewport`. `live-restore` pozwala aktualizować dockerd bez zatrzymywania kontenerów.
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-12 | P2 | bezpieczeństwo | kontenery bez utwardzenia, PP Support jako root
- **Miejsce:** oba pliki compose.
- **Problem:** brak `cap_drop`, `no-new-privileges`, `read_only`, `pids_limit`; `pp-support-web/sidekiq` i `srh` działają jako root (CIS Docker Benchmark 4.1, 5.3, 5.12, 5.25, 5.28). Brak healthchecków dla `encoder`, `sidekiq`, `srh`, `redis` (polutek).
- **Naprawa (przykład dla `app`, `encoder`, `srh`):**
  ```yaml
  security_opt: ["no-new-privileges:true"]
  cap_drop: ["ALL"]
  pids_limit: 512
  read_only: true            # app: + tmpfs /tmp i wolumen na /app/.next/cache
  tmpfs: ["/tmp"]
  ```
  Dla Postgresa/Redisa `cap_drop: [ALL]` + `cap_add: [CHOWN, SETUID, SETGID, DAC_OVERRIDE, FOWNER]` (entrypoint zmienia użytkownika). Healthchecki: encoder - plik heartbeat (`find /work/.heartbeat -mmin -2`) lub zapytanie o heartbeat w bazie; sidekiq - `ps`/`sidekiqmon`; redis - `redis-cli ping`. PP Support: sprawdzić, czy obraz działa jako `user: "1000:1000"` (właściciel `storage`), inaczej zostawić root, ale z `no-new-privileges` i `cap_drop`.
- **Nakład:** M (testy). **Pewność:** wysoka. **Koszt:** brak.

### OPS-13 | P2 | bezpieczeństwo | aplikacja i encoder łączą się jako superuser bazy
- **Miejsce:** `app.env`, `worker.env` (`DATABASE_URL`); `pg_stat_activity` pokazuje tylko użytkownika `polutek` (superuser).
- **Problem:** SQL injection, błąd lub przejęcie encodera = pełna kontrola nad klastrem (`COPY ... PROGRAM` = wykonanie poleceń w kontenerze db).
- **Naprawa:** rola właściciela schematu `polutek_owner` (tylko migrator), `polutek_app` (DML na schemacie public, bez DDL), `polutek_worker` (DML tylko na tabelach pipeline'u); `ALTER DEFAULT PRIVILEGES` dla nowych tabel; `statement_timeout`/`idle_in_transaction_session_timeout` per rola. To samo dla PP Support (osobna rola aplikacyjna).
- **Nakład:** M. **Pewność:** wysoka. **Koszt:** brak.

### OPS-14 | P2 | bezpieczeństwo | obrazy bez przypiętych wersji/digestów, brak procesu aktualizacji
- **Miejsce:** `postgres:17-alpine`, `redis:7-alpine`, `pgvector/pgvector:0.8.7-pg17`, `hiett/serverless-redis-http:latest` (obraz sprzed 2 lat), `node:22-bookworm-slim`, `mwader/static-ffmpeg:8.0.1`, `pp-support:4.18.0` (lokalny retag).
- **Problem:** tagi pływające: wersja zależy od chwili `pull`, a aktualizacje bezpieczeństwa nie przychodzą wcale (nikt nie robi `pull`). `docker-compose.override.yml` (redis+srh) nie jest w repo, więc nawet Renovate go nie zobaczy.
- **Naprawa:** przypiąć `image: postgres:17.6-alpine@sha256:...` itd.; Renovate albo Dependabot (`docker-compose`, `dockerfile`) na pliki w repo; comiesięczne okno aktualizacji (pull, `up -d`, test). Docelowo usunąć `srh` (OPS w "Lepsze rozwiązania").
- **Nakład:** S/M. **Pewność:** wysoka. **Koszt:** brak.

### OPS-15 | P2 | bezpieczeństwo | aktualizacje hosta niepełne
- **Miejsce:** `50unattended-upgrades`, pakiety z repo zewnętrznych.
- **Problem:** brak automatycznego restartu i brak alertu `reboot-required` (jądro z poprawkami bezpieczeństwa czeka na ręczny restart); `docker-ce`, `containerd.io`, `cloudflared` (`--no-autoupdate`) i `rclone` nie są aktualizowane wcale.
- **Naprawa:** alert `reboot-required` (OPS-09) i stałe okno serwisowe (np. niedziela 04:30, ok. 1-2 min przerwy) z `apt full-upgrade`, `cloudflared` i Dockerem; alternatywnie `Unattended-Upgrade::Automatic-Reboot "true"; Automatic-Reboot-Time "04:30";`. Dopisać pochodzenie `cloudflared` do `Allowed-Origins` (Cloudflare zaleca aktualny cloudflared; stare wersje tracą wsparcie). `apt autoremove` starego jądra 7.0.0-30.
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-16 | P2 | bezpieczeństwo | SSH otwarte na świat, luźniejsze ustawienia
- **Miejsce:** `sshd -T`, UFW, Hetzner FW.
- **Problem:** 22/tcp otwarte dla wszystkich (fail2ban już banuje), `X11Forwarding yes`, `AllowAgentForwarding yes`, `MaxAuthTries 6`, `LoginGraceTime 120`; jeden klucz (utrata komputera właściciela = tylko konsola Hetznera).
- **Naprawa:** `/etc/ssh/sshd_config.d/20-tight.conf`: `X11Forwarding no`, `AllowAgentForwarding no`, `MaxAuthTries 3`, `LoginGraceTime 30`, `AllowUsers root`, `ClientAliveInterval 300`. Docelowo SSH przez Cloudflare Access (`cloudflared access ssh`, hostname `ssh.pawelperfect.com` za Access) i zamknięcie 22 w obu zaporach (konsola Hetzner jako awaryjne wejście) albo przynajmniej ograniczenie 22 w Hetzner FW. Drugi, awaryjny klucz offline (np. w menedżerze haseł właściciela).
- **Nakład:** S (sshd) / M (SSH przez Access). **Pewność:** wysoka. **Koszt:** brak.

### OPS-17 | P2 | dostępność | przerwa przy każdym wdrożeniu
- **Miejsce:** `deploy.sh` `start_app` (`docker compose up -d --no-deps app` = stop starego, start nowego).
- **Problem:** kilka do kilkunastu sekund 502 z Cloudflare przy każdym deployu (Tunnel ma jeden origin `127.0.0.1:3000`).
- **Naprawa:** blue/green: dwie usługi `app_blue`/`app_green` (porty 3001/3002), lokalny Caddy (już zainstalowany) na `127.0.0.1:3000` z `reverse_proxy 127.0.0.1:3001 127.0.0.1:3002 { health_uri /api/health; lb_policy first }`; deploy startuje nieaktywny kolor, czeka na healthy, zatrzymuje stary. Albo narzędzie `docker-rollout`. Pamięć: dwie instancje na ok. 30 s (ok. +250 MB).
- **Nakład:** M. **Pewność:** wysoka. **Koszt:** brak.

### OPS-18 | P2 | dostępność / bezpieczeństwo | `mergedeploy.sh` i szczegóły `deploy.sh`
- **Miejsce:** `scripts/ops/mergedeploy.sh`, `deploy/serwerek/deploy.sh`.
- **Problem:** (1) bierze ostatni przebieg CI gałęzi (`gh run list --limit 1`), a nie przebieg dla SHA głowy PR (wyścig po pushu w trakcie `sleep 40`); (2) `gh pr merge --admin` omija ochronę gałęzi; (3) wdraża squash-commit z `main`, który nie przeszedł CI (równolegle z Vercelem, OPS-02); (4) pętla `until grep ...` bez limitu czasu: gdy `deploy.sh` umrze przez `set -e` bez komunikatu `ERROR:` (np. błąd `docker build`), skrypt wisi w nieskończoność; (5) log `deploy-<prefiks>.log` nadpisywany przy tym samym prefiksie; (6) `deploy.sh` zapisuje zrzuty `pre-deploy-*.sql.gz` z prawami **0644** (dane osobowe; katalog 755); (7) zrzut pre-deploy tylko lokalnie.
- **Naprawa:** `gh pr checks <PR> --required --watch` + porównanie `headRefOid`; merge bez `--admin`; deploy dopiero po zielonym CI na `main` (albo docelowo obraz z GHCR, OPS-07); `timeout 1800` wokół pętli i `trap 'log "ERROR: line $LINENO"' ERR` w `deploy.sh`; `umask 077` na początku `deploy.sh`; nazwa logu z pełnym tagiem.
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-19 | P2 | dokumentacja / odtwarzanie | pliki tylko na serwerze, brak wykonywalnej procedury DR
- **Miejsce:** nie ma w repo: `/opt/serwerek/scripts/backup.sh`, `health.sh`, `/opt/serwerek/backups/RESTORE.md`, **`/opt/serwerek/apps/polutek/docker-compose.override.yml` (redis + srh, krytyczne dla produkcji)**, `/etc/cron.d/serwerek-{backup,health}`, `cloudflared-serwerek.service`, `serwerek-placeholder.service`, `/usr/local/bin/ai-log`, `/root/base.sh`, `/root/harden.sh`, `/etc/ssh/sshd_config.d/10-hardening.conf`, `/etc/sysctl.d/99-swap.conf`, motd. Kopia `configs` nie obejmuje: `/etc/cron.d/serwerek-backup`, unitów `polutek-cron*`, `/etc/serwerek/*`, `ai-log`, `changes.log`, `/opt/serwerek/data/backups`, `DNS_BACKUP_www_2026-10-01.json`.
- **Problem:** odtworzenie serwera od zera wymaga wiedzy rozproszonej po 6 dokumentach i ręcznych kroków; czas odtworzenia (RTO) nieznany, szacunkowo 3-6 h, nigdy nie ćwiczony (dzisiejszy test to tylko odtworzenie bazy).
- **Naprawa:** katalog `deploy/serwerek/host/` w repo (skrypty, unity, cron jako timery, sshd drop-in, sysctl, `daemon.json`, `override.yml` scalony do głównego compose) + idempotentny `bootstrap.sh` (albo Ansible/cloud-init) + `RESTORE.md` krok po kroku z kolejnością: system -> bootstrap -> sekrety z sejfu (OPS w "Lepsze rozwiązania") -> rclone z R2 -> `pg` restore -> pull obrazów -> tunnel token -> testy. Ćwiczenie DR raz na kwartał na tymczasowym CX22 (rozliczenie godzinowe, koszt kilku eurocentów, wymaga zgody).
- **Nakład:** M/L. **Pewność:** wysoka. **Koszt:** marginalny (ćwiczenie).

### OPS-20 | P2 | dokumentacja / odtwarzanie | konfiguracja Cloudflare bez IaC i bez kopii
- **Miejsce:** DNS obu stref, ingress Tunnelu (zdalny), aplikacje i polityki Access (w tym bypass d3a34da7), ruleset rate limit 049cd256, Email Routing (reguły + Workery), Workery (kod jest w repo, ale nie bindingi/sekrety/trasy), CORS i ustawienia bucketów R2, custom domain `thumbs`.
- **Problem:** utrata/zmiana konta lub błędna edycja przez agenta = odtwarzanie z pamięci; brak historii zmian.
- **Naprawa:** Terraform (provider `cloudflare`) z importem obecnego stanu (`cf-terraforming`), stan w R2; minimum: nocny eksport JSON przez API (DNS `export`, tunnel config, Access apps/policies, rulesets, email routing rules) do kopii.
- **Nakład:** M/L. **Pewność:** wysoka. **Koszt:** brak.

### OPS-21 | P2 | dostępność / koszt | Workery: ręczny deploy z komputera, limit planu Free
- **Miejsce:** `workers/*/deploy.mjs`.
- **Problem:** deploy z laptopa właściciela przez API (bez śladu, która wersja kodu działa; sekret przekazywany przy każdym wdrożeniu); limit Free 100 tys. żądań/dzień dla całego konta (HLS: playlisty + segment co 6 s na widza, plus `pp-support-brand` na trasach supportu i Email Worker). Po przekroczeniu żądania kończą się błędem, a dostawców zapasowych już nie ma (wideo staje). Brak alertu zbliżania się do limitu.
- **Naprawa:** w metadanych uploadu dodać adnotację wersji (`annotations: {"workers/tag": "<git sha>", "workers/message": "..."}` w API Versions, albo `wrangler deploy --tag`), deploy z GitHub Actions; sekrety ustawiać osobno (`wrangler secret put`) zamiast przy każdym uploadzie; przed realnym ruchem Workers Paid (5 USD/mies., już w STATUS pkt 4); do tego czasu dzienny odczyt metryk Workers (GraphQL Analytics) w `health.sh` z progiem 70%.
- **Nakład:** S/M. **Pewność:** wysoka. **Koszt:** 5 USD/mies. przy włączeniu planu Paid (decyzja właściciela).

### OPS-22 | P2 | bezpieczeństwo | PP Support: wyjątki Access i aktualizacje
- **Miejsce:** Access bypass `/api`, `/auth`, `/cable`, `/rails/active_storage`; obraz 4.18.0 (2 tygodnie), uruchamiany jako root; konto właściciela bez 2FA (STATUS pkt 6).
- **Problem:** wyjątki wystawiają publiczną powierzchnię silnika (logowanie, API z tokenem, endpointy widżetu) bezpośrednio do internetu, więc każda luka przed uwierzytelnieniem w silniku jest osiągalna; jedyna reguła rate limiting planu Free jest zużyta na `sign_in`. Aktualizacje obrazu ręczne, bez subskrypcji powiadomień.
- **Naprawa:** jeśli aplikacja mobilna nie jest używana, usunąć bypass (zostaje tylko Email Worker -> ingress przez wewnętrzną ścieżkę, np. Worker z service tokenem Access); jeśli jest, zawęzić do `/api/v1/profile`, `/auth/sign_in`, `/cable` i potrzebnych ścieżek; obserwować GitHub Security Advisories silnika (watch "Security alerts") i aktualizować w oknie miesięcznym; 2FA właściciela; `no-new-privileges` (OPS-12).
- **Nakład:** S. **Pewność:** średnia (nie testowano, które ścieżki aplikacja mobilna naprawdę potrzebuje). **Koszt:** brak.

### OPS-23 | P2 | dokumentacja | dokumentacja operacyjna rozjechana ze stanem faktycznym
- Szczegóły w sekcji 4. Najgroźniejsze: obietnica "sekrety nie idą do R2" (fałsz, OPS-01), "501 to normalne" (OPS-10), "Vercel Crons nie są już potrzebne" przy wciąż aktywnych cronach (OPS-02), kopia na serwerze `/opt/serwerek/docs/README.md` kończy się na §14 (brak §15-20 o produkcji).
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-24 | P3 | dostępność | strojenie Postgresa
- **Miejsce:** `docker-compose.yml` usługa `db`.
- **Naprawa:** `-c effective_cache_size=384MB -c idle_in_transaction_session_timeout=60s -c log_min_duration_statement=500ms -c log_lock_waits=on -c log_autovacuum_min_duration=1s`; `shm_size: 256m` (domyślne 64 MB Dockera potrafi dać błędy `could not resize shared memory segment` przy zapytaniach równoległych); sumy kontrolne danych przy najbliższej okazji (`pg_checksums --enable` offline albo przy następnej wersji głównej); zdjąć publikację portów 5432/5434 na hoście (wystarcza `docker exec`), albo zostawić świadomie dla tunelu SSH.
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-25 | P3 | dostępność | logi i drobne ustawienia hosta
- **Naprawa:** `/etc/logrotate.d/serwerek` dla `/var/log/serwerek/{backup,changes,alerts}.log` (weekly, rotate 12, compress; `changes.log` raczej archiwizować niż kasować); `journald.conf.d/size.conf`: `SystemMaxUse=500M`; `net.ipv4.conf.all.send_redirects=0`; `apt autoremove` (jądro 7.0.0-30).
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-26 | P3 | bezpieczeństwo | brzeg: HTTP, nagłówki, DNSSEC, poczta
- **Problem:** `http://www.pawelperfect.com/` odpowiada 200 bez przekierowania; `X-Powered-By: Next.js`; brak DNSSEC i CAA dla `.com` i `.pl`; DMARC `p=none` na obu (`.pl` bez `rua`); brak MTA-STS/TLS-RPT; pozostałości Google (`google._domainkey`, `google-site-verification`) do usunięcia po anulowaniu Workspace (już w planie).
- **Naprawa:** SSL/TLS -> Edge Certificates: "Always Use HTTPS" on; `poweredByHeader: false` w `next.config.mjs`; DNSSEC: włączyć w Cloudflare i wpisać DS u rejestratora (home.pl dla `.pl`; `.com` u Cloudflare Registrar automatycznie); CAA `0 issue "letsencrypt.org"`, `"pki.goog"`, `"digicert.com"` (urzędy używane przez Cloudflare Universal SSL; sprawdzić aktualną listę w dokumentacji przed wpisaniem); DMARC: po 2-4 tygodniach czystych raportów `p=quarantine`, potem `reject`; dla `.pl` (nie wysyła poczty) od razu `v=DMARC1; p=reject;` + `v=spf1 -all` gdyby nie wysyłała (dziś SPF `.pl` dopuszcza Cloudflare do przekazań; sprawdzić przed zmianą).
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-27 | P3 | śmieć | pozostałości na serwerze (ok. 31 GB do odzyskania)
- **Lista:** cache buildera 27 GB (`docker builder prune --keep-storage 8GB`); `polutek-tools:test` 3,4 GB; stary `polutek-migrator:2315db6e`; nieużywany wolumen anonimowy 83 MB; `/opt/serwerek/apps/polutek-test` + `data/polutek-test` (326 MB) + ingress/Access `apptest` (dziś wskazuje produkcję) ; `/opt/serwerek/apps/polutek-prod` + `data/polutek-prod` (80 MB, stara baza/redis, możliwe dane osobowe); `test.pawelperfect.com` + `serwerek-placeholder.service` (python http.server); Caddy (wyłączony; zostawić, jeśli OPS-17); `/opt/serwerek/apps/cloudflared/` (sam README); 16 plików `deploy-*.log`, `build-worker.log`, `apps/polutek-test/build*.log`; pliki `*.bak*` (w tym 2 z sekretami, OPS-01); `scripts/*.bak*` (3 szt.); `/root/tmp-migr` (1,7 MB, prawdopodobnie zrzut z Neona z danymi osobowymi), `/root/pp-stage`, `/root/base.sh`, `/root/harden.sh` (do repo, OPS-19); `data/hls-work` (skrypty pilota + wyniki HLS 25 MB; skrypty są w repo `scripts/hls/`); `data/backups/chatwoot-before-acc6-*.dump`, `emailtemplate-*.sql` (po potwierdzeniu); stare `chatwoot-*` kopie (wygasną same za 7 dni); `pg-polutek-test-db-1-*` i zrzuty `pre-*` starsze niż potrzeba; jądro 7.0.0-30; ewentualnie nieoznaczony `chatwoot/chatwoot:v4.18.0-ce` (prawdopodobnie ten sam obraz co `pp-support:4.18.0`, wtedy usunięcie tagu nic nie zwalnia).
- **Naprawa:** jedno okno sprzątania z wpisem `ai-log`; przed skasowaniem danych z `polutek-prod`/`tmp-migr` potwierdzenie właściciela.
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-28 | P3 | dostępność | pojedyncze punkty awarii i pojemność
- **Co pada razem z serwerem:** strona, logowanie, płatności (webhooki Stripe ponawiane do 3 dni, reconciliation wraca po starcie), baza, Redis (limity), PP Support i poczta przychodząca do niego (Email Worker zostawia kopię w Gmailu), kodowanie wideo, crony, monitoring, orkiestracja kopii. **Działa dalej:** odtwarzanie już wgranych filmów (Worker + R2, token ważny do wygaśnięcia), miniatury publiczne, przekierowania (dziś Vercel).
- **Inne SPOF:** jeden proces cloudflared; konto Cloudflare (DNS, Tunnel, R2, Workery, poczta, kopie); komputer właściciela (klucz SSH, sekrety agentów); Resend (maile aplikacji, PP Support i alerty).
- **Pojemność (pomiar §14 + dziś):** SSR strony głównej ok. 50-60 req/s lokalnie (CPU-bound), API setki req/s; RAM: zajęte ok. 1,8 GB z 3,8 GB, suma limitów 5,08 GB (nadsubskrypcja; bezpiecznikiem jest swap). Wideo nie obciąża serwera.
- **Kiedy większy serwer (CPX32, 4 vCPU/8 GB):** RAM available < 500 MB przez > 15 min regularnie; swap > 500 MB stale; load > 1,5 przez > 15 min; p95 `/api/health` przez Cloudflare > 1 s; kolejka kodowania czeka > 30 min; baza > 1 GB; albo gdy budowanie zostaje na serwerze (OPS-07). Przy przejściu na budowanie w CI obecny CPX22 wystarczy na mały i średni ruch.
- **Nakład:** n/d. **Pewność:** średnia (brak pomiarów pod realnym ruchem). **Koszt:** rescale = wyższa stawka (decyzja właściciela).

### OPS-29 | P3 | dostępność | jeden proces cloudflared
- **Naprawa:** Cloudflare pozwala uruchomić kilka replik tego samego tunelu; druga replika na tym samym hoście chroni tylko przed padem procesu (systemd i tak restartuje w 5 s), więc wartość ograniczona. Ważniejsze: aktualizacje cloudflared (OPS-15) i alert zdrowia tunelu (OPS-08).
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

### OPS-30 | P3 | bezpieczeństwo | sekrety w plikach env bez sejfu i rejestru
- **Problem:** 10+ plików z sekretami (`app.env`, `worker.env`, `db.env`, `.env` x3, `/etc/serwerek/*.env` x4, `secrets/pp-support-ai-agent.token`), widoczne w `docker inspect`; brak rejestru dat ważności/rotacji (tokeny Cloudflare z datą wygaśnięcia, Google client secret, Stripe, Resend).
- **Naprawa:** SOPS + age (plik zaszyfrowany w repo albo w R2, klucz age u właściciela), `deploy.sh` odszyfrowuje do `/run/serwerek/*.env` (tmpfs); rejestr sekretów (nazwa, gdzie używany, właściciel, data utworzenia, data wygaśnięcia) w `docs/operations/`; alert 14 dni przed wygaśnięciem tokenów z datą.
- **Nakład:** M. **Pewność:** wysoka. **Koszt:** brak.

### OPS-31 | P3 | dostępność | rollback tylko jeden krok wstecz, brak śladu wersji w aplikacji
- **Miejsce:** `deploy.sh --rollback`.
- **Problem:** po rollbacku `.previous-image` się nie zmienia (drugi rollback nic nie robi); rollback cofa tylko kod (migracje addytywne: OK, ale niezgodność schematu nie jest sprawdzana); `/api/health` nie podaje wersji, więc z zewnątrz nie widać, co działa.
- **Naprawa:** `./deploy.sh --rollback-to <tag>`; `GIT_SHA` jako build arg i pole `version` w `/api/health` (bez danych wrażliwych); lista ostatnich wdrożeń w `deploy-history.log`.
- **Nakład:** S. **Pewność:** wysoka. **Koszt:** brak.

---

## 4. Rozbieżności: dokumentacja vs serwer

| # | Dokument | Twierdzenie | Stan faktyczny |
|---|---|---|---|
| 1 | SERWEREK.md §1 | "To nie jest produkcja (produkcja to nadal Vercel + Neon)" | produkcja na serwerku od 2026-10-01 |
| 2 | SERWEREK.md §4 | "Nie ma jeszcze produkcyjnej aplikacji ani workera" | są `polutek-app`, `polutek-encoder` |
| 3 | SERWEREK.md §4 i §6 pkt 3 | sekrety tylko w 3 plikach `/etc/serwerek/*.env` | także `cron.env`, `app.env`, `worker.env`, `db.env`, `build.env`, 3x `.env`, `secrets/pp-support-ai-agent.token`, 2x `app.env.*bak` |
| 4 | SERWEREK.md §4 (tabela ingress) | tylko `test` i `apptest` | także `www`, `support`; `apptest` wskazuje dziś produkcję |
| 5 | SERWEREK.md §4/§8, §16 | "Backup ich NIE zawiera", "sekrety nie idą do R2" | `configs-*.tar.gz` zawiera `app.env.bak-hls-20261002`, `app.env.pre-betterauth.bak` |
| 6 | SERWEREK.md §4 | "pierwsza próba zwraca 501 ... to normalne" | błąd starej wersji rclone (OPS-10) |
| 7 | SERWEREK.md §4 (health) | sprawdza dysk/RAM/swap/usługi | sprawdza też app, kontenery, stronę publiczną, PP Support; nie sprawdza encodera ani backupu |
| 8 | SERWEREK.md §11/§13 | test odtworzenia "not started", worker "not started" | test bazy wykonany 2026-10-03, worker działa |
| 9 | SERWEREK.md §15 | "Nie testowano na serwerze"; timer `prune-unverified-accounts` "trzeba skopiować" | deploy używany kilkanaście razy; timer działa |
| 10 | SERWEREK.md §16 pkt 5 | redis/srh/db nie są w `health.sh` | są |
| 11 | SERWEREK.md §15/§16 | "Po przełączeniu usuń `crons` z `vercel.json` albo wyłącz projekt", "Vercel Crons nie są już potrzebne" | `vercel.json` nadal ma 3 crony, Vercel wdraża każdy merge |
| 12 | SERWEREK.md §3 zasada "aktualizuj OBIE" | kopia `/opt/serwerek/docs/README.md` | ma 242 linie i kończy się na §14 (repo: 339 linii, §1-20) |
| 13 | STATUS-2026-10-03 | ostatni obraz `polutek-app:s10031102` | działa `polutek-app:f10031614` (`.previous` = `j10031553`) |
| 14 | STATUS-2026-10-03, `ai-log` 2026-10-02 18:39 | limit pamięci encodera 1 GB | compose i `docker stats`: 1500 MiB (VIDEO-PIPELINE.md i SERWEREK §19 mówią 1500m, zgodnie z serwerem) |
| 15 | CLAUDE.md §2 (tabela Stack) | Vercel, Neon, Vercel Crons, Cloudflare Stream primary, Upstash | serwerek, lokalny Postgres, timery systemd, SELF_HLS, Redis + srh |
| 16 | CLAUDE.md §6 | crony w `vercel.json`, Hobby | crony na serwerku (systemd), Vercel crons to pozostałość |
| 17 | CLAUDE.md §8.1 | "MX is still Google" | MX = Cloudflare Email Routing od 2026-10-02 (CLAUDE.md §0 mówi to poprawnie, czyli dokument sam sobie przeczy) |
| 18 | CLAUDE.md §8 | `DATABASE_URL` = "Neon PostgreSQL" | lokalny Postgres na serwerku |
| 19 | `docs/architecture/serwerek.md` §G | "Stan faktyczny (2026-10-01)" | nieaktualny po produkcji, encoderze i PP Support |
| 20 | `RESTORE.md` (na serwerze) | opis kopii | nie wspomina `pp-support-storage`, kolejności odtworzenia stosów, override.yml, tokenu tunelu, workerów |
| 21 | Repo vs serwer | `deploy.sh`, `docker-compose.yml`, unity cron, `cron-runner.sh`, compose PP Support: zgodne | `docker-compose.override.yml`, `backup.sh`, `health.sh`, unity cloudflared/placeholder, cron.d, `ai-log`, `harden.sh`, `base.sh` istnieją tylko na serwerze (OPS-19) |

---

## 5. Lepsze rozwiązania (wzorzec dla "jeden VPS + Docker Compose + Cloudflare")

1. **Obrazy z CI, nie z produkcji.** GitHub Actions: test -> `docker buildx build` (3 targety, cache GHA) -> push do GHCR z digestem -> (opcjonalnie) `cosign sign` -> deploy = `docker pull @digest` + migracja + blue/green. Serwer nie potrzebuje źródeł (`src/`), Node ani cache buildera; CI testuje dokładnie ten obraz, który jedzie na produkcję.
2. **Jeden plik compose w repo, wersjonowany i przypięty.** Scalić `override.yml` (redis/srh) do `deploy/serwerek/docker-compose.yml`; wszystkie obrazy z digestem; Renovate otwiera PR z aktualizacjami; comiesięczne okno serwisowe.
3. **Usunąć `srh`.** Bramka REST do Redisa istnieje tylko dlatego, że kod używa klienta Upstash REST. Na własnym serwerze prostsze i szybsze jest bezpośrednie połączenie (`ioredis`/`node-redis`) za cienkim adapterem w `lib/` (wybór po env: REST albo `REDIS_URL`). Minus jeden kontener na tagu `latest` sprzed 2 lat i jeden token.
4. **Kopie: 3-2-1 z niezmiennością.** Postgres: WAL-G do R2 (PITR, RPO minuty) + nocny `pg_dump -Fc` zaszyfrowany age; bucket lock na kopiach i oryginałach wideo; druga lokalizacja dla oryginałów i kopii bazy poza Cloudflare (Hetzner Storage Box albo B2); kwartalne ćwiczenie odtworzenia całego serwera na tymczasowej maszynie, z zapisanym czasem (RTO).
5. **Sekrety:** SOPS + age, odszyfrowanie do tmpfs przy deployu, rejestr dat ważności; osobne tokeny R2 per komponent z minimalnymi uprawnieniami; role Postgresa bez superusera.
6. **Infrastruktura jako kod:** `deploy/serwerek/host/` + `bootstrap.sh` (lub Ansible) dla hosta; Terraform dla Cloudflare (DNS, Tunnel ingress, Access, Redirect Rules, Email Routing, Workery z wrangler w CI) ze stanem w R2. Agent AI zmienia konfigurację przez PR, a nie bezpośrednio w panelu (ślad i rollback).
7. **Monitoring warstwowy, darmowy:** z zewnątrz UptimeRobot/Better Stack (HTTP) + Healthchecks.io (heartbeat hosta, backupów, cronów) + Cloudflare Notifications (tunel); z wewnątrz `health.sh` rozszerzony o backup/cron/reboot/encoder; logi kontenerów w journald (`log-driver: journald`, `journalctl CONTAINER_NAME=polutek-app-1 -p err --since -1h`) albo `local` z rotacją; dzienny raport błędów 5xx (Cloudflare Analytics GraphQL) mailem. Pełny Prometheus/Loki/Grafana na 4 GB RAM to przerost.
8. **Bez przerwy przy deployu:** Caddy (już zainstalowany) jako lokalny balanser blue/green przed aplikacją; Tunnel wskazuje Caddy.
9. **SSH bez otwartego portu:** Cloudflare Access for Infrastructure / `cloudflared access ssh`, port 22 zamknięty, konsola Hetznera jako wejście awaryjne.
10. **Rozdzielenie ról maszyny w przyszłości** (zgodnie z decyzją "drugi serwer na końcu"): pierwszym kandydatem do wyniesienia jest encoder (CPU) i ewentualnie PP Support (RAM ok. 0,9 GB), nie baza.

---

## 6. Kolejność prac

**Tydzień 1 (szybkie, bez kosztów, największy zysk):**
1. OPS-01: wyjąć `.bak` z drzewa kopii, poprawić wykluczenia, szyfrowanie age, usunąć zainfekowane archiwa z R2, decyzja o rotacji sekretów.
2. OPS-02 + OPS-03: wyłączyć wdrożenia i crony Vercela, przenieść przekierowania apex/.pl do Cloudflare Redirect Rules, sprawdzić logi Vercela pod kątem kasowania miniatur.
3. OPS-06 + OPS-10: bucket lock na `serwerek-backups`, nowy rclone, `rclone check` po wysyłce.
4. OPS-04 (wariant S): godzinowy zrzut bazy `polutek`.
5. OPS-08 + OPS-09: Healthchecks.io + UptimeRobot, `OnFailure=` dla cronów i backupu, alert na Gmail.
6. OPS-11 + OPS-27: `daemon.json` (rotacja logów, GC buildera, live-restore) i sprzątanie ok. 31 GB w jednym oknie serwisowym.
7. OPS-23: zaktualizować SERWEREK.md, STATUS, CLAUDE.md §2/§6/§8, kopię README na serwerze.

**Tydzień 2-3:**
8. OPS-07: build w GitHub Actions -> GHCR -> pull po digeście (eliminuje też OPS-18 pkt 3 i ryzyko OOM przy buildzie).
9. OPS-05: bucket lock na oryginałach, osobne tokeny R2; decyzja właściciela o drugiej kopii oryginałów.
10. OPS-16, OPS-15, OPS-18: SSH, okno aktualizacji, poprawki `mergedeploy.sh`/`deploy.sh`.
11. OPS-13, OPS-12, OPS-14: role bazy, utwardzenie kontenerów, przypięcie obrazów + Renovate.

**Miesiąc 1-2:**
12. OPS-04 (WAL-G, PITR) i OPS-19 (host w repo + bootstrap + ćwiczenie DR z pomiarem RTO).
13. OPS-20 (Terraform Cloudflare), OPS-30 (SOPS), OPS-17 (blue/green), OPS-21 (Workery z CI, decyzja o Workers Paid przed ruchem), OPS-22 (zawężenie wyjątków PP Support).
14. Reszta P3 (OPS-24, 25, 26, 29, 31) przy okazji.

---

## Źródła

- Cloudflare R2 + rclone (wymagane rclone >= 1.59, `provider = Cloudflare`, `no_check_bucket`): https://developers.cloudflare.com/r2/examples/rclone/
- rclone S3/R2: https://rclone.org/s3/
- Zgłoszenia tego samego objawu (rclone 1.60 z apt, 501 przy pierwszej próbie do R2, naprawa przez nowszy rclone): https://github.com/Slimydog21/Antiek/pull/3324 , https://github.com/BirchDesignLab/queryModule/issues/487 , https://github.com/NXA13/NazareNow/issues/153 (źródła zewnętrzne, niezweryfikowane; dlatego zalecana diagnoza `--dump headers`)
- R2 bucket locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- Cloudflare Tunnel, repliki: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/deploy-tunnels/deploy-cloudflared-replicas/
- Workers limits (plan Free 100 tys. żądań/dzień): https://developers.cloudflare.com/workers/platform/limits/
- Docker: konfiguracja logowania i sterownik `local`: https://docs.docker.com/engine/logging/configure/ , https://docs.docker.com/engine/logging/drivers/local/ ; GC cache buildera: https://docs.docker.com/build/cache/garbage-collection/ ; live restore: https://docs.docker.com/engine/daemon/live-restore/
- CIS Docker Benchmark: https://www.cisecurity.org/benchmark/docker
- PostgreSQL 17, ciągła archiwizacja i PITR: https://www.postgresql.org/docs/17/continuous-archiving.html ; WAL-G: https://github.com/wal-g/wal-g ; pgBackRest (S3-compatible): https://pgbackrest.org/user-guide.html
- Healthchecks.io: https://healthchecks.io/ ; UptimeRobot: https://uptimerobot.com/
