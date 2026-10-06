# Panel administratora `admin.pawelperfect.com`: runbook

Stan: 2026-10-05 (faza 1: powłoka, logowanie, ekrany „Dzisiaj” i „System”, tylko odczyt).
**Wdrożenie na serwerku wykonane 2026-10-05** (obraz `polutek-admin:adm10050110`, `admin.env`, Access, tunel, DNS). **Logowanie jest teraz proste: przez Cloudflare Access (kod na Gmail), bez rejestracji, kluczy dostępu i TOTP** (rozdział 1b; stary tryb z passkeyem zostaje pod `ADMIN_AUTH_MODE=passkey`). Architektura i decyzje:
[`architecture/admin-panel.md`](../architecture/admin-panel.md) (sekcja 9). Stary `/admin` na `www` działa bez zmian.

Panel to osobna aplikacja (`apps/admin`) i osobny kontener `admin` (`127.0.0.1:3100`, limit 384 MB) w stosie
`/opt/serwerek/apps/polutek`. Domyślnie (`ADMIN_AUTH_MODE=access`) wejście to **Cloudflare Access** (JWT sprawdzany też w aplikacji; zweryfikowany
adres e-mail z tokenu jest logowaniem) → dziennik logowań `AdminAuthEvent` (tylko dopisywanie). W trybie legacy (`ADMIN_AUTH_MODE=passkey`) dochodzi
warstwa 2: **klucz dostępu (passkey)** + TOTP z własnej instancji Better Auth panelu.
Każdą zmianę na serwerze loguj: `AI_AGENT=<nazwa> ai-log "..."`.

## 1. Pierwsze wdrożenie (sesja główna razem z właścicielem)

Kolejność ma znaczenie; nic z tego nie dzieje się samo.

1. **Kod i migracja.** Zwykłe wdrożenie strony dla commita z panelem (`./deploy.sh <tag>`): uruchamia migrację
   `20261004200000_add_admin_panel_auth` (nowe tabele `Admin*`, trigger na `AdminAuthEvent`; addytywna).
2. **Pliki na serwerze** (w `/opt/serwerek/apps/polutek`): `deploy-admin.sh` i zaktualizowany `docker-compose.yml`
   z `src/deploy/serwerek/`, oraz `admin.env` (root, `chmod 600`, nie w gicie, nie w kopiach):
   ```
   DATABASE_URL=...                      # ta sama baza co strona (host "db")
   DATABASE_URL_UNPOOLED=...
   ADMIN_APP_URL=https://admin.pawelperfect.com
   ADMIN_AUTH_SECRET=...                 # openssl rand -base64 48; INNY niż BETTER_AUTH_SECRET
   CF_ACCESS_TEAM_DOMAIN=https://pawelperfect.cloudflareaccess.com
   CF_ACCESS_AUD=...                     # tag AUD aplikacji Access z kroku 4
   ADMIN_ACCESS_EMAILS=pawel.perfect@gmail.com   # kto może wejść; puste w trybie access = tylko właściciel (domyślnie pawel.perfect@gmail.com)
   # ADMIN_AUTH_MODE=access                       # domyślne; `passkey` = stare logowanie kluczem + TOTP (rozdz. 1b i 2)
   # ADMIN_OWNER_EMAIL=pawel.perfect@gmail.com    # jedyny adres zakładany automatycznie (rola OWNER) przy pierwszym logowaniu
   ADMIN_INTERNAL_APP_URL=http://app:3000
   KV_REST_API_URL=http://srh:80         # jak w app.env (sonda Redisa)
   KV_REST_API_TOKEN=...
   HLS_DELIVERY_BASE_URL=https://video.pawelperfect.com
   NEXT_PUBLIC_APP_URL=https://www.pawelperfect.com   # linki do starego panelu
   ADMIN_TELEMETRY_DATABASE_URL=postgresql://pp_analytics_ro:...@db:5432/polutek   # opcjonalnie: „Zapas serwera”
   ```
   Panel celowo **nie** dostaje `BETTER_AUTH_SECRET`, kluczy Stripe ani Resend.

   **Od fazy 2 (Treści)** panel zapisuje filmy, więc dostaje też R2 (te same wartości co `app.env`):
   ```
   CLOUDFLARE_R2_ACCOUNT_ID=...
   CLOUDFLARE_R2_ACCESS_KEY_ID=...
   CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
   CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS=polutek       # oryginały (upload z przeglądarki)
   CLOUDFLARE_R2_BUCKET_HLS=polutek-hls               # sprzątanie wersji HLS przy usuwaniu
   CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE=polutek-thumbnails-private
   CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC=polutek-thumbnails
   NEXT_PUBLIC_R2_PUBLIC_HOST=thumbs.pawelperfect.pl  # publiczne miniatury i napisy VTT
   ALLOWED_THUMBNAIL_HOSTS=...                        # jak w app.env (podgląd starych miniatur)
   BLOB_READ_WRITE_TOKEN=...                          # opcjonalnie: 6 starych miniatur z Vercel Blob
   ```
   Oraz jednorazowo CORS bucketa oryginałów z originem panelu (przeglądarka PUT-uje części prosto do R2):
   `npx wrangler r2 bucket cors set polutek --file scripts/hls/originals-cors.json` (plik ma już
   `https://admin.pawelperfect.com`). Bez tego wgrywanie oryginału w panelu kończy się błędem sieci przy pierwszej części;
   reszta Treści działa.

   Rola `pp_analytics_ro` jest z migracji `NOLOGIN`; dla wskaźnika „Zapas serwera” operator nadaje jej raz hasło:
   `docker compose exec -T db psql -U polutek -d polutek -c "ALTER ROLE pp_analytics_ro LOGIN PASSWORD '<losowe>'"` (hasło tylko w `admin.env`).
   Bez tego wskaźnik pokazuje „nie skonfigurowano”, reszta panelu działa. Po powiększeniu serwera: nowy test obciążenia i nowe liczby w
   `lib/modules/admin-overview/domain/server-capacity.config.ts`.
3. **Status hosta** (zamiast gniazda Dockera):
   ```
   install -m755 src/deploy/serwerek/admin/host-status.py /opt/serwerek/scripts/host-status.py
   install -d -m755 /var/lib/serwerek/host-status
   cp src/deploy/serwerek/admin/admin-host-status.{service,timer} /etc/systemd/system/
   systemctl daemon-reload && systemctl enable --now admin-host-status.timer
   cat /var/lib/serwerek/host-status/status.json | head -c 400
   ```
4. **Cloudflare (właściciel albo sesja główna z jego zgodą):**
   - Access: nowa aplikacja self-hosted `serwerek admin` na `admin.pawelperfect.com`, polityka **tylko**
     `pawel.perfect@gmail.com` (nie `hello@`), czas sesji 12 h, dostawca tożsamości: jednorazowy kod PIN na e-mail
     (One-time PIN). W trybie `access` to jest **jedyne** logowanie, więc polityka musi zostać wąska. Zapisz tag **AUD** do
     `admin.env` (`CF_ACCESS_AUD`).
   - Tunel `serwerek`: reguła ingress `admin.pawelperfect.com -> http://127.0.0.1:3100` przed końcowym `http_status:404`
     (PUT zastępuje całą listę, SERWEREK.md §9), DNS CNAME `admin` na tunel, `proxied: true`.
   - Cache Rule: `admin.pawelperfect.com/*` → bypass cache.
5. **Start panelu:** `./deploy-admin.sh <tag>` (buduje obraz `polutek-admin:<tag>` z `nice -n 10`, ok. 2–4 min
   na CPX22, startuje profil `admin`, czeka na `healthy`). Panel nie startuje przy `./deploy.sh` ani `docker compose up`.
6. **Sprawdzenie bez logowania:**
   ```
   curl -s http://127.0.0.1:3100/api/health          # {"ok":true}
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/   # 403 (brak JWT Access) albo 503 (brak CF_ACCESS_*)
   curl -sI https://admin.pawelperfect.com/ | head -3  # 302 na pawelperfect.cloudflareaccess.com
   ```
7. **Pierwsze logowanie** (rozdział 1b; bez rejestracji), potem wpis w `ai-log` i w SERWEREK.md §4 (tabela ingress).

## 1a. Wdrożenie faz 2, 3 i A (jedna kolejność, stan 2026-10-05)

Kod faz 2 (Treści, Społeczność, tłumaczenia, zapas serwera), 3 i A jest w `main`, ale **niewdrożony**. Szczegóły i ryzyka każdej fazy:
`architecture/admin-phase2-community.md` §6, `admin-phaseA.md` §11, `admin-phase3.md` §7. Wszystkie migracje przeszły czysto na PostgreSQL 16
(testy integracyjne: 7 plików OK); Postgres 17 z produkcji nie był używany do testów, różnice składni dla tych migracji nie są oczekiwane, ale pierwsze `migrate deploy` na produkcji nadal jest sprawdzianem.

1. **Przed wszystkim:** udane logowanie do nowego panelu przez Access (rozdz. 1b; rejestracja nie jest już potrzebna) i potwierdzone działanie faz 1 (Dzisiaj, System). Zrób `./scripts/backup.sh` i sprawdź, że kopia trafiła do R2.
2. **Migracje (jednym `deploy.sh` strony):** `20261005100000_add_video_translations`, `20261005120000_add_user_comment_mute`, `20261005120000_analytics_rollups` (opakowuje `telemetry.rollup_day`, uzupełnia dane wstecz), `20261005200000_admin_phase3_roles_and_audit_immutable`
   (niezmienny `AuditLog`: od niej wiersze młodsze niż 400 dni nie dadzą się skasować; po migracji sprawdź, że zapis audytu działa).
   Kolejność: migracja → obraz `www` → obraz panelu. `www` bez migracji `..._add_user_comment_mute` zwróci błąd przy dodawaniu komentarza.
3. **`admin.env` (root, 600), nowe zmienne:**
   - faza 2: komplet `CLOUDFLARE_R2_*` (jak w `app.env`) + CORS bucketa oryginałów (rozdz. 1, krok R2);
   - zapas serwera i analityka: `ADMIN_TELEMETRY_DATABASE_URL` (rola `pp_analytics_ro` z logowaniem, hasło nadaje operator jednorazowo);
   - faza 3: `STRIPE_SECRET_KEY` (klucz OGRANICZONY: Refunds zapis, Disputes/Charges/PaymentIntents odczyt), `SES_SMTP_USER`, `SES_SMTP_PASS` i `EMAIL_FROM` (tylko test do siebie), `NEXT_PUBLIC_APP_URL`;
   - opcjonalnie (zostaw puste, dopóki nie zdecydujesz): `ADMIN_EDGE_TOLERANCE_PCT`, `ADMIN_MORNING_REPORT` (off), `ADMIN_MORNING_REPORT_TO`, `ADMIN_JOBS_TOKEN`, `EMAIL_DAILY_LIMIT`, `EMAIL_MONTHLY_LIMIT`, `TRANSLATION_AI_ENABLED`, `CLOUDFLARE_AI_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN`.
4. **Opcjonalnie:** rola bazy `pp_admin` (`deploy/serwerek/admin/pp-admin-role.sql`, panel działa bez niej), konta tłumaczy (`admin-enroll --role translator --languages de,es`; w trybie `access` skrypt tylko zakłada konto i języki, link rejestracji jest zbędny, a adres tłumacza trzeba dopisać do `ADMIN_ACCESS_EMAILS` i do polityki Access).
5. **Obraz panelu:** `./deploy-admin.sh <tag>`; rollback `./deploy-admin.sh x --rollback`. Obraz strony: `./deploy.sh <tag>`; rollback `./deploy.sh x --rollback`. Baza: nowe tabele są niegroźne przy powrocie do starego obrazu.
6. **Kontrola po wdrożeniu:** `docker compose ps`, `/api/health` strony i panelu, ekrany Treści, Społeczność, Analityka (czy rollupy się wypełniają: `job_run` `telemetry-rollup`), Przychody, Komunikacja, Bezpieczeństwo (zapis audytu), `/premiera` otwarta ≥ 12 minut (SSE przez tunel; przy przerwaniu po ok. 100 s sprawdź keep-alive i kompresję).
7. **Nie włączaj** bez decyzji: porannego raportu (wymaga polityki Service Auth w Access), wysyłki rozsyłek z panelu (panel tylko kolejkuje), szkiców AI (domyślnie wyłączone).

## 1b. Logowanie przez Cloudflare Access (tryb domyślny, od 2026-10-05)

Decyzja właściciela (system testowy, nie produkcja): zamiast kluczy dostępu i TOTP loguje samo Cloudflare Access. Szczegóły i uczciwy bilans
ryzyka: `architecture/admin-panel.md` §9.1a.

**Jak się logujesz (krok po kroku):**
1. Otwórz `https://admin.pawelperfect.com`.
2. Cloudflare Access pyta o adres e-mail: wpisz `pawel.perfect@gmail.com` i poproś o kod.
3. Przepisz 6-cyfrowy kod z maila. Panel otwiera się od razu. Nie ma rejestracji, klucza ani aplikacji z kodami.
4. Sesja trwa 12 godzin. Wylogowanie: „Wyloguj” w menu konta (to link do `/cdn-cgi/access/logout`, kończy sesję Access).
   Przy pierwszym wejściu panel sam zakłada konto właściciela (rola OWNER); kolejne logowania wracają na to samo konto.

**Zmienne (`admin.env`):**
| Zmienna | Znaczenie |
|---|---|
| `ADMIN_AUTH_MODE` | `access` (domyślnie, gdy brak) albo `passkey` (stare logowanie). Inna wartość = panel odpowiada 503 (literówka nie obniża zabezpieczeń po cichu). |
| `ADMIN_ACCESS_EMAILS` | Adresy, które panel przyjmuje (po przecinku). W trybie `access` puste = tylko `pawel.perfect@gmail.com` (jawny domyślny w kodzie). Adres musi też przejść politykę Access. |
| `ADMIN_OWNER_EMAIL` | Jedyny adres zakładany automatycznie jako OWNER (domyślnie `pawel.perfect@gmail.com`). Inny dozwolony adres musi mieć konto (np. tłumacz z `admin-enroll --role translator`), inaczej widzi komunikat „to konto nie ma dostępu”. |
| `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | Bez zmian; brak któregoś w produkcji = 503 na wszystko. |

**Co panel sprawdza przy każdym żądaniu:** podpis tokenu Access (RS256, klucze z `/cdn-cgi/access/certs`), wystawcę, tag AUD, ważność,
adres e-mail **z podpisanej treści tokenu** (nigdy z nagłówka `Cf-Access-Authenticated-User-Email`), obecność na liście dozwolonych. Brak sesji
panelu: nie ma ciasteczka ani wiersza w `AdminSession`. Operacje wrażliwe (pieniądze, usuwanie, eksport, zmiana roli) wymagają tokenu wystawionego w
ciągu 12 godzin (przy poprawnej sesji Access zawsze prawda); okna potwierdzeń „wpisz e-mail/slug” zostają bez zmian.

**Dziennik:** jeden wpis `ADMIN_ACCESS_SIGN_IN` na każdy nowy token Access (Bezpieczeństwo → Logowania do panelu); odmowa dla poprawnie
podpisanego, ale niedozwolonego adresu: `ADMIN_ACCESS_DENIED`. Łańcuch skrótów bez zmian.

**Powrót do trybu z kluczem dostępu:** w `admin.env` ustaw `ADMIN_AUTH_MODE=passkey`, `docker compose --profile admin up -d --no-deps admin`
(albo `./deploy-admin.sh <tag>`), potem rozdział 2 (rejestracja). Konto właściciela utworzone w trybie `access` nie ma klucza ani TOTP, więc
trzeba je zarejestrować (`admin-enroll --email … --reset`). W trybie `passkey` `ADMIN_ACCESS_EMAILS` puste znaczy „każda tożsamość Access”.

**Lokalnie (`next dev`):** `ADMIN_DEV_BYPASS_ACCESS=1` (działa jako właściciel, albo adres z `ADMIN_DEV_EMAIL`, wymaga bazy) lub
`ADMIN_DEV_BYPASS_AUTH=1` (podgląd bez bazy). Oba są ignorowane, gdy `NODE_ENV=production` (test jednostkowy tego pilnuje).

**Zalecenie:** włącz weryfikację dwuetapową Google na `pawel.perfect@gmail.com` (to ona teraz jest drugim czynnikiem), a przed produkcją
rozważ w Access dostawcę „Google” zamiast kodu e-mail albo powrót do `passkey`.

Źródła: [sesja i wylogowanie w Access](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/),
[walidacja JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[token aplikacji](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).

## 2. Rejestracja administratora (`admin-enroll`), tylko tryb `ADMIN_AUTH_MODE=passkey`

W trybie domyślnym (`access`) ten rozdział nie jest potrzebny: `/rejestracja` przekierowuje do panelu, a `/api/auth` odpowiada 404.

Konto panelu powstaje **tylko** z terminala serwera (korzeń zaufania = SSH). Link nie idzie e-mailem.

```
ssh serwerek
cd /opt/serwerek/apps/polutek
docker compose --profile admin run --rm admin node apps/admin/scripts/admin-enroll.mjs --email pawel.perfect@gmail.com
```

Skrypt wypisuje link `https://admin.pawelperfect.com/rejestracja#t=…` (ważny 15 minut, działa raz; w bazie jest tylko
jego skrót). Właściciel otwiera go w przeglądarce (najpierw Cloudflare Access), a potem:

1. „Pokaż kod QR” → dodaje panel w aplikacji z kodami (Aegis, Google Authenticator, 1Password…), **zapisuje 10 kodów
   zapasowych poza komputerem**, wpisuje 6-cyfrowy kod.
2. „Dodaj klucz dostępu” → Windows Hello, Face ID, telefon albo klucz z PIN-em. Warto od razu dodać drugi
   (np. telefon) przyciskiem „Dodaj kolejny klucz”.
3. „Zakończ i otwórz panel”.

Logowanie później: `admin.pawelperfect.com` → Access → „Zaloguj kluczem dostępu”. Hasła nie ma.
Linku nie wklejaj do czatu ani maila; po wykorzystaniu i tak przestaje działać.

## 3. Reset dostępu (zgubione urządzenia, podejrzenie przejęcia)

```
docker compose --profile admin run --rm admin node apps/admin/scripts/admin-enroll.mjs --email pawel.perfect@gmail.com --reset
```

Usuwa wszystkie sesje, klucze dostępu, TOTP i niewykorzystane linki tego konta i wypisuje nowy link (rozdział 2).
Wpis `ADMIN_ENROLL_RESET` trafia do `AdminAuthEvent`. Bez `--reset` skrypt odmawia wydania linku dla ukończonej
rejestracji. Zmiana `ADMIN_AUTH_SECRET` wylogowuje wszystkich i unieważnia TOTP (zaszyfrowany tym sekretem): po
rotacji zrób `--reset`.

## 4. Kolejne wdrożenia i rollback

```
cd /opt/serwerek/apps/polutek
rm -rf src && mkdir src && (git archive <commit> | tar -x -C src)   # jak przy deploy.sh
./deploy.sh <tag>            # jeśli commit zawiera migracje (zawsze najpierw strona)
cp src/deploy/serwerek/deploy-admin.sh . && ./deploy-admin.sh <tag>
./deploy-admin.sh <tag> --rollback   # poprzedni obraz panelu (.previous-admin-image)
./deploy-admin.sh <tag> --stop       # wyłącza panel; strona działa dalej
```

Panel padnięty = strona działa (osobny kontener). Strona padnięta = panel działa (o ile baza żyje).
Gdy faza 0 przeniesie budowę obrazów do GHCR, `deploy-admin.sh` zamiast `docker build` zrobi `docker pull`.

## 5. Diagnostyka

| Objaw | Co sprawdzić |
|---|---|
| 503 „Panel nie jest skonfigurowany” | brak `CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` w `admin.env`; `docker compose --profile admin logs admin` |
| 403 „Brak dostępu” mimo Access | zły `CF_ACCESS_AUD` (tag innej aplikacji) albo e-mail spoza `ADMIN_ACCESS_EMAILS`; log: `access denied: invalid_token / email_not_allowed` |
| Pętla do `/logowanie` | ciasteczko `__Host-ppadm.session_token` wymaga HTTPS i dokładnego hosta (`ADMIN_APP_URL`); sesja wygasa po 60 min bezczynności i po 12 h |
| „Klucz musi potwierdzić Ciebie” | klucz sprzętowy bez PIN-u: panel wymaga weryfikacji użytkownika |
| System: „Kontenery: brak danych” | `systemctl status admin-host-status.timer`, plik `/var/lib/serwerek/host-status/status.json`, montowanie `/host-status` w kontenerze |
| System: Redis/strona/Worker „bez pomiaru” | brak `KV_REST_API_*`, `ADMIN_INTERNAL_APP_URL`, `HLS_DELIVERY_BASE_URL` w `admin.env` (to nie awaria) |
| Dziennik logowań | `docker compose exec db psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c 'SELECT "createdAt",action,outcome,reason,ip,country FROM "AdminAuthEvent" ORDER BY seq DESC LIMIT 20'` |

`AdminAuthEvent` jest tylko do dopisywania: baza odrzuca `UPDATE`, `TRUNCATE` i `DELETE` wierszy młodszych niż 400 dni.

## 6. Rozwój lokalnie

```
npm run admin:dev                      # http://localhost:3100, potrzebuje DATABASE_URL i ADMIN_DEV_BYPASS_ACCESS=1
ADMIN_DEV_BYPASS_ACCESS=1 ADMIN_DEV_BYPASS_AUTH=1 ADMIN_DEV_FIXTURES=1 npm run admin:dev   # bez bazy: dane przykładowe
npm run admin:build                    # build produkcyjny (CI: job "admin build")
```

Obejścia `ADMIN_DEV_*` działają tylko przy `NODE_ENV=development`; w produkcji są ignorowane. Passkey działa na
`http://localhost` (przeglądarki traktują go jak bezpieczny kontekst).
