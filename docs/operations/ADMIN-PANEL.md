# Panel administratora `admin.pawelperfect.com`: runbook

Stan: 2026-10-04 (faza 1: powłoka, logowanie, ekrany „Dzisiaj” i „System”, tylko odczyt). Architektura i decyzje:
[`architecture/admin-panel.md`](../architecture/admin-panel.md) (sekcja 9). Stary `/admin` na `www` działa bez zmian.

Panel to osobna aplikacja (`apps/admin`) i osobny kontener `admin` (`127.0.0.1:3100`, limit 384 MB) w stosie
`/opt/serwerek/apps/polutek`. Wejście ma trzy warstwy: **Cloudflare Access** (JWT sprawdzany też w aplikacji) →
**klucz dostępu (passkey)** z własnej instancji Better Auth panelu → dziennik logowań `AdminAuthEvent` (tylko dopisywanie).
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
   ADMIN_ACCESS_EMAILS=pawel.perfect@gmail.com
   ADMIN_INTERNAL_APP_URL=http://app:3000
   KV_REST_API_URL=http://srh:80         # jak w app.env (sonda Redisa)
   KV_REST_API_TOKEN=...
   HLS_DELIVERY_BASE_URL=https://video.pawelperfect.com
   NEXT_PUBLIC_APP_URL=https://www.pawelperfect.com   # linki do starego panelu
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
     `pawel.perfect@gmail.com` (nie `hello@`), czas sesji 12 h. Jeśli plan Free na to pozwala: wymagane niezależne MFA
     (klucz/biometria). Zapisz tag **AUD** do `admin.env` (`CF_ACCESS_AUD`).
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
7. **Rejestracja administratora** (rozdział 2), potem wpis w `ai-log` i w SERWEREK.md §4 (tabela ingress).

## 2. Rejestracja administratora (`admin-enroll`)

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
