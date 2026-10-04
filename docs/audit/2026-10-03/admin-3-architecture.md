# Panel `admin.pawelperfect.com`: architektura, dane, bezpieczeństwo (ścieżka 3 z 3)

Stan na 2026-10-04. Repo: `origin/main` @ `355fbf36`. Pomiary na serwerze tylko do odczytu (`docker stats`, `free`, `df`, `systemctl list-timers`, skrypty w `/opt/serwerek/scripts`), Cloudflare tylko GET/GraphQL tokenem konta. Część odczytów z bazy (role Postgresa, liczba adminów z 2FA) została zablokowana przez klasyfikator uprawnień; tam, gdzie to ma znaczenie, opieram się na `docs/operations/STATUS.md` i oznaczam to.

---

## 1. Podsumowanie i rekomendacja (10 zdań)

1. Panel budujemy jako **osobną aplikację Next.js w tym samym repo** (`apps/admin`, osobny obraz `polutek-admin:<sha>`, osobny kontener na `127.0.0.1:3100`), która importuje te same moduły domenowe (`lib/modules/*`, Prisma), więc niezmienniki (`fulfillPayment()`, `PatronGrant`, blokady publikacji) zostają w jednym miejscu.
2. Gotowe narzędzia (Directus, Retool, Grafana jako rdzeń) odpadają, bo omijają warstwę domenową albo nie mieszczą się w 4 GB RAM; całkiem inny stos podwaja logikę dla jednej osoby.
3. Bezpieczeństwo jest warstwowe: **Cloudflare Access** (tylko prywatny adres właściciela, wymagany klucz/passkey przez „independent MFA”) → **osobna instancja Better Auth** w panelu (passkey + TOTP, bez rejestracji, bez resetu hasła mailem, własne tabele sesji, ciasteczko `__Host-`), → osobna **rola Postgresa** z wąskimi prawami i **niezmienny `AuditLog`**.
4. Dzisiejsze ryzyko numer jeden jest poza nowym panelem: 4 konta admina bez 2FA, a `hello@` (adres bootstrap admina i e-mail OTP Access) trafia do skrzynki PP Support, którą czyta też token agenta AI; to trzeba zamknąć przed budową.
5. Analityka ruchu: **własny, lekki pipeline bez cookies i bez danych osobowych** (`sendBeacon` → Redis Stream → zbiorczy zapis do schematu `telemetry` w Postgresie → tabele rollup), bo tylko on połączy ruch z filmami, użytkownikami i napiwkami; Plausible odpada (ClickHouse ≥ 2 GB RAM), Umami jest awaryjnym planem B.
6. Telemetrię oglądania trzeba odchudzić i uzupełnić: dziś jeden wiersz `VideoPlaybackEvent` waży ok. **1 KB** (10 196 wierszy = 10 MB) i każde zdarzenie to osobne żądanie HTTP; brakuje czasu startu, procentu zacięć, jakości/bitrate i mapy obejrzanych fragmentów do wykresu retencji.
7. Serwer, kontenery, bazę, crony, backup, Cloudflare, Stripe, Resend i PP Support zbiera **jeden mały kontener `pp-collector`** (ok. 60–80 MB), a monitoring z zewnątrz robi **Worker Cloudflare z cron triggerem** (dead man's switch dla backupu i cronów, alert przez Resend), bo serwer nie wykryje własnej awarii.
8. Ekrany ładują się **bez szkieletów**: komponenty serwerowe czytają gotowe agregaty (zapytania < 50 ms), wolne źródła zewnętrzne pokazują ostatnią znaną wartość z godziną odczytu, a tryb „na żywo” (premiera) to SSE co 2–5 s.
9. Migracja idzie etapami: najpierw powłoka + logowanie + ekran „Teraz” (tylko odczyt), potem telemetria, potem przenoszenie sekcji od odczytu do zapisu (zwroty na końcu, ze step-up), a stary `/admin` działa do ostatniego etapu i wtedy jest usuwany z `www`.
10. Koszt dodatkowy w gotówce jest bliski zeru (Access do 50 użytkowników, D1/Worker w darmowych limitach, Workers Paid 5 USD i tak planowany), a realny koszt to ok. **250–350 MB RAM** i drugi build Next.js, który wymaga przeniesienia budowania obrazów poza serwer (to i tak jest na liście przed startem).

---

## 2. Układ aplikacji: porównanie i wybór

### 2.1 Stan faktyczny (pomiar 2026-10-04 09:53)

| Kontener | RAM teraz / limit |
|---|---|
| polutek-app-1 (Next.js) | 138 MiB / 1 GiB |
| polutek-encoder-1 | 117 MiB / 1,465 GiB |
| polutek-db-1 (Postgres 17) | 52 MiB / 512 MiB (`shared_buffers=128MB`, `max_connections=60`) |
| polutek-redis-1 + polutek-srh-1 | 2 + 11 MiB |
| pp-support (web, sidekiq, db, redis) | 91 + 132 + 33 + 5 MiB |
| **Host** | 3809 MB, użyte 2165, dostępne 1643, **swap użyty 1476 MB**, dysk 46/75 GB (64%) |

Uwagi: `dockerd` ma **ok. 1 GB RSS** (ps), to anomalia do zbadania (pamięć po budowach obrazów na serwerze, `STATUS.md` pkt „obrazy budowane na serwerze produkcyjnym: swap ok. 1,5 GB”). Baza `polutek` ma 26 MB; największe tabele to `VideoPlaybackEvent` (10 MB) i `VideoPlaybackSession` (2,7 MB). `shared_preload_libraries` jest pusty (brak `pg_stat_statements`).

### 2.2 Opcje

| | (a) ta sama aplikacja, routing po hoście | (b) osobna aplikacja Next.js w tym samym repo | (c) osobna aplikacja, inny stos + API | (d) gotowe narzędzie jako rdzeń |
|---|---|---|---|---|
| Jak | `proxy.ts` przepisuje `admin.*` na `/admin/*`, osobny layout i CSP per host | `apps/admin` (npm workspaces), wspólny kod domenowy z `lib/modules` i Prisma, osobny `Dockerfile` target, osobny kontener | np. Go/Python + HTMX albo SPA, gada z API www | Directus / Payload / Refine / Retool / Grafana + własne ekrany |
| RAM | 0 dodatkowo | +150–250 MB (drugi proces Next; dziś app = 138 MiB) | 30–100 MB, ale + utrzymanie API | Directus ok. 300–500 MB; Retool self-hosted wymaga wielu GB; Grafana 150–300 MB |
| Niezależność | Brak: jeden obraz, padnięcie wdrożenia strony = brak panelu; kod admina w publicznym obrazie | Pełna na poziomie procesu i wdrożenia; wspólna baza | Pełna | Częściowa |
| Bezpieczeństwo | Słabsze: trasy `/api/admin` osiągalne na `www`, jedna instancja auth, wspólne ciasteczka, jedno CSP z wyjątkami | Dobre: osobne CSP, auth, ciasteczka, rola DB; publiczny obraz bez kodu admina | Dobre, ale API z uprawnieniami admina na `www` to nowa powierzchnia ataku | Directus pisze bezpośrednio do tabel: omija `fulfillPayment()`, blokady publikacji, audyt |
| Niezmienniki domenowe | Zachowane | Zachowane (import tych samych modułów) | **Zduplikowane** w drugim języku | **Omijane** |
| Wdrożenie | jeden `deploy.sh` | `deploy.sh` z celem `admin` lub `all`; drugi build Next | dwa łańcuchy budowania | aktualizacje cudzego produktu |
| Testy | wspólne | wspólny Vitest + osobny Playwright dla panelu | dwa zestawy | trudne |
| Licencja | – | – | – | Directus: MSCL, darmowy poniżej 5 mln USD przychodu ([mobian.studio](https://mobian.studio/directus-cms-license/)); Retool self-hosted płatny |
| Wysiłek | najmniejszy | średni (jednorazowo: workspace, Dockerfile, CI) | największy | pozornie mały, potem walka z narzędziem |

### 2.3 Wybór: (b)

- Panel i tak powstaje od nowa (decyzja właściciela), więc nie przenosimy starych stron, tylko budujemy nowe ekrany na tych samych przypadkach użycia. Next.js w obu aplikacjach = jeden język, jeden ORM, jedno CI.
- Wzorzec jest oficjalnie opisany przez Next.js jako „multi-zones” (każda strefa osobna aplikacja, wdrażana i wycofywana niezależnie): [nextjs.org/docs/app/guides/multi-zones](https://nextjs.org/docs/app/guides/multi-zones). Nie potrzebujemy przepisywania ścieżek między strefami, bo panel ma własny host.
- **Krok przejściowy bez dużego refaktoru**: na początku `apps/admin` importuje `../../lib/*` przez alias ścieżek (Turbopack `root` = katalog repo), bez przenoszenia `lib/` do pakietu. Wydzielenie `packages/core` (moduły + Prisma) robimy dopiero, gdy granice się ustalą. Turborepo nie jest potrzebne na start (npm workspaces wystarczą).
- (a) zostawiam tylko jako awaryjną opcję „szybko na subdomenę” (np. jeśli build drugiej aplikacji okaże się za ciężki przed przeniesieniem budowania poza serwer).
- Biblioteki UI: shadcn/ui + TanStack Table/Query (już w zależnościach). Refine niepotrzebny: dodaje abstrakcję CRUD, a my chcemy ekrany zaprojektowane per zadanie.

### 2.4 Co to znaczy dla serwera, wdrożeń i testów

- **RAM**: +150–250 MB panel, +60–80 MB `pp-collector`. Przy dostępnych 1,6 GB i 1,5 GB w swapie to mieści się, ale bez zapasu na build. **Warunek**: obrazy budowane poza serwerem (GitHub Actions → rejestr GHCR → `docker pull` w `deploy.sh`), co i tak jest w `STATUS.md` jako zadanie przed startem. Limit kontenera `admin`: `mem_limit: 384m`, `cpu_shares: 512`.
- **CPU**: panel jest prawie bezczynny (jeden użytkownik); koszt to zapytania analityczne, dlatego tylko po agregatach (sekcja 6).
- **`deploy.sh`**: dodać `deploy.sh <tag> [app|admin|all]`; panel ma własny health (`/api/health` na 3100), własne `.current-admin-image` i rollback. Migracje Prisma dalej jedne, wspólne (jeden schemat), uruchamiane raz.
- **Testy**: Vitest wspólny; nowy projekt Playwright dla panelu z wirtualnym uwierzytelniaczem WebAuthn (Chrome DevTools Protocol `WebAuthn.addVirtualAuthenticator`) i seedowanym adminem; testy integracyjne Postgresa sprawdzające uprawnienia ról (np. `pp_admin` nie może `DELETE FROM "AuditLog"`).

---

## 3. Logowanie i bezpieczeństwo panelu

### 3.1 Stan dziś (fakty)

- Admin = zwykłe konto `User` z `role=ADMIN`, logowanie tą samą instancją Better Auth co strona, ciasteczko z prefiksem `pp` na `www` (`lib/auth/auth.ts`: `cookiePrefix`, `freshAge`, plugin `twoFactor`). Passkeys nie są włączone.
- **Żadne z 4 kont admina nie ma 2FA** (`STATUS.md` pkt 4). `hello@pawelperfect.com` jest w `ADMIN_EMAILS` i jest promowany przy każdym żądaniu (`lib/api/auth.ts`, komentarz AUTH-27).
- Poczta `hello@` trafia do PP Support (`SUPPORT-CENTER.md`), a token użytkownika „Agent AI” w PP Support ma prawo czytać rozmowy. **Wniosek: kto ma token agenta albo dostęp do skrzynki, może przeczytać link resetu hasła konta admina `hello@` i kod OTP Cloudflare Access dla `support.`** (polityka `serwerek owners` dopuszcza `hello@` i Gmail; jedyny dostawca tożsamości w Access to „One-time PIN”, sprawdzone API). To jest pętla zaufania do przerwania.
- Wzorzec Access przed PP Support (sprawdzony przez API): aplikacja `serwerek support` na `support.pawelperfect.com`, polityka `serwerek owners` (allow, include: 2 adresy e-mail), sesja 24 h, osobne aplikacje dla wyjątków (`/rails/action_mailbox/...` tylko service token; `/api`, `/auth`, `/cable` bypass dla aplikacji mobilnej). Tunel `serwerek` (zdalnie zarządzany) jest `healthy`.
- Strona ma ochronę CSRF dla `/api/admin` przez porównanie `Origin` (`lib/api/csrf.ts`) i limity (`lib/api/admin-rate-limit.ts`). Audyt panelu z 2026-10-03 (`docs/audit/2026-10-03/audit-feat-admin.md`) daje 5/10, m.in. brak 2FA i step-up (ADM-05), brak idempotencji zwrotu (ADM-04).

### 3.2 Model docelowy: trzy warstwy

**Warstwa 1, Cloudflare Access (przed tunelem).**
- Nowa aplikacja Access `serwerek admin` na `admin.pawelperfect.com`, polityka: include = tylko `pawel.perfect@gmail.com` (nie `hello@`), require = **independent MFA** z kluczem WebAuthn/biometrią urządzenia. Cloudflare dodał niezależne MFA w Access (aplikacje: kody z aplikacji, klucze WebAuthn, biometria; per aplikacja i per polityka): [Access changelog](https://developers.cloudflare.com/cloudflare-one/changelog/access/), [wymagania MFA](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements). Do sprawdzenia przy wdrożeniu: czy jest na planie Free (Free = do 50 użytkowników, logi Access tylko 24 h: [costbench](https://costbench.com/software/business-vpn/cloudflare-zero-trust/free-plan/)).
- Opcjonalnie require = kraj PL (z wyjątkiem na wyjazd), sesja Access 12 h zamiast 24 h.
- W aplikacji: weryfikacja nagłówka `Cf-Access-Jwt-Assertion` (podpis z `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, `aud` = tag aplikacji). Jeśli ktoś pomyli ingress tunelu albo wystawi port, panel i tak odrzuci żądanie bez JWT.
- Cache Rule: `admin.pawelperfect.com/*` → bypass cache; nagłówek `X-Robots-Tag: noindex`.

**Warstwa 2, własne logowanie panelu (Better Auth, osobna instancja).**
- Osobna instancja w `apps/admin`, **osobne tabele** przez `modelName` (np. `AdminUser`, `AdminSession`, `AdminPasskey`, `AdminTwoFactor`, `AdminVerification`), więc sesja ze strony nigdy nie działa w panelu i odwrotnie, a reset hasła konta publicznego nie daje drogi do panelu.
- Metody: **passkey jako pierwszy czynnik** (plugin `passkey`, `rpID: "admin.pawelperfect.com"`, więc klucz nie działa na `www` i odwrotnie: [better-auth.com/docs/plugins/passkey](https://better-auth.com/docs/plugins/passkey)), TOTP + 10 kodów zapasowych jako zapas. Bez hasła albo hasło tylko z obowiązkowym drugim czynnikiem. Brak rejestracji (`disabledPaths` dla sign-up), brak resetu przez e-mail, brak Google.
- Sesja: bezczynność 30–60 min, absolutnie 12 h, `freshAge` 5 min. **Step-up** (ponowne dotknięcie klucza) przed: zwrotem, usunięciem filmu/komentarzy masowo, wysyłką broadcastu, zmianą ról, podglądem sekretów, eksportem danych osobowych. Better Auth nie ma wbudowanego „required-admins” ([issue #10310](https://github.com/better-auth/better-auth/issues/10310)), więc wymuszenie jest w naszym `requireAdmin()`.
- Ciasteczko: host-only (bez `crossSubDomainCookies`, inny `cookiePrefix`: [better-auth.com/docs/concepts/cookies](https://www.better-auth.com/docs/concepts/cookies)), nazwa z prefiksem `__Host-` (Secure, Path=/, bez Domain), `SameSite=Strict`. `__Host-` chroni przed „cookie tossing”: XSS na `www` może ustawić ciasteczko dla `.pawelperfect.com`, ale nie nadpisze ciasteczka `__Host-`.
- **CSRF**: `www` i `admin` to ta sama strona w sensie SameSite (ta sama domena rejestrowalna), więc `SameSite` NIE chroni przed żądaniem z `www` do `admin`. Ochrona: dokładne porównanie `Origin == https://admin.pawelperfect.com` i `Sec-Fetch-Site: same-origin` dla każdej mutacji (Server Actions w Next sprawdzają Origin vs Host; dla Route Handlers własny helper jak `lib/api/csrf.ts`).
- Limity i alerty: 5 nieudanych logowań / 15 min per IP i per konto; każde logowanie, nieudane logowanie, nowe urządzenie i nowy kraj (`CF-IPCountry`) → `AuditLog` + e-mail przez Resend.

**Warstwa 3, baza.**
- Rola `pp_admin` (panel): `SELECT` na tabelach domenowych, `INSERT/UPDATE` tylko tam, gdzie panel coś zmienia, `INSERT` (bez `UPDATE/DELETE`) na `AuditLog`, brak `TRUNCATE`, brak DDL. Rola `pp_analytics_ro`: tylko `SELECT` na schemacie `telemetry` i widokach, `statement_timeout = 5s`. Rola `pp_collector`: `INSERT` do `telemetry`, wywołanie funkcji rollup.
- Dziś aplikacja łączy się prawdopodobnie użytkownikiem z `POSTGRES_USER`, którego oficjalny obraz tworzy jako superużytkownika (nie zweryfikowałem odczytem, klasyfikator zablokował zapytanie o role). Docelowo także strona publiczna dostaje rolę bez superużytkownika; migracje Prisma wykonuje osobna rola właściciela schematu w kontenerze `migrate`.
- **`AuditLog` niezmienny**: `REVOKE UPDATE, DELETE, TRUNCATE` dla wszystkich ról aplikacyjnych, trigger `BEFORE UPDATE OR DELETE` rzucający wyjątek, kolumna `hash = sha256(prev_hash || wiersz)` (łańcuch, wykrywa podmianę przez superużytkownika), nocny eksport dnia do R2 do bucketu z **bucket lock** (retencja np. 400 dni: [R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)); token R2 serwera bez prawa zmiany locków.

### 3.3 Twarde zasady ekranu

- CSP panelu: `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; connect-src 'self'; img-src 'self' data: https://thumbs.pawelperfect.com; media-src 'self' blob: https://video.pawelperfect.com; frame-ancestors 'none'; form-action 'self'; base-uri 'none'`. Zero skryptów zewnętrznych (bez Stripe.js, Google, Turnstile; Turnstile niepotrzebny za Access).
- Dodatkowo: `Cross-Origin-Opener-Policy: same-origin`, `Referrer-Policy: no-referrer`, `Permissions-Policy` bez kamery/mikrofonu, fonty lokalne.
- **Podgląd jako użytkownik** bez wydawania sesji: panel liczy to, co widzi użytkownik X (np. `checkVideoAccess()` z aktorem X, lista komentarzy, stan napiwków), w trybie tylko do odczytu, z wpisem `ADMIN_VIEW_AS` w audycie. Żadnego „zaloguj się jako”.
- Moderacja z publicznego UI (`CommentItem` → `/api/admin/comments/*`) przestaje działać po przeniesieniu: albo przenosimy moderację w całości do panelu, albo zostawiamy na `www` wąską akcję „serduszko autora” (decyzja właściciela, sekcja 9).

### 3.4 Bootstrap pierwszego admina bez `ADMIN_EMAILS`

1. Korzeń zaufania = SSH na serwer (już tak jest).
2. `ssh serwerek 'cd /opt/serwerek/apps/polutek && docker compose run --rm admin node scripts/admin-enroll.js --email pawel.perfect@gmail.com'` tworzy wiersz `AdminUser` i jednorazowy link rejestracji (ważny 15 min, w bazie tylko jego hash), wypisany w terminalu, nie wysyłany mailem.
3. Właściciel otwiera link (przez Access), rejestruje 2 passkeys (np. telefon + klucz sprzętowy), włącza TOTP, drukuje kody zapasowe.
4. Wpis `ADMIN_ENROLLED` w audycie; od tej chwili `ADMIN_EMAILS` znika z kodu i środowiska. Odzyskanie dostępu = ta sama komenda z `--reset` (unieważnia wszystkie sesje i klucze).

### 3.5 Do zrobienia od razu, niezależnie od nowego panelu

- Włączyć TOTP na 4 kontach admina albo zdjąć rolę z kont, których właściciel nie używa.
- Usunąć `hello@` z `ADMIN_EMAILS` i z polityki Access (`serwerek owners`), zostawić prywatny Gmail.
- Ograniczyć widoczność wiadomości z linkami resetu/OTP dla agenta AI (np. reguła w PP Support albo osobna skrzynka dla wiadomości systemowych).

---

## 4. Źródła danych

Zasada prywatności dla całej tabeli: **domyślnie bez cookies, bez localStorage do identyfikacji, bez surowego IP**. Unikalność odwiedzin = `hash(dzienna_sól || IP || UA || host)` obcięty do 64 bitów, sól losowana co dobę i niszczona (wzorzec Plausible/Cloudflare Web Analytics). Wtedy nie ma zapisu na urządzeniu (art. 399 Prawa komunikacji elektronicznej nie wymaga zgody, bo nie ma przechowywania ani odczytu informacji z urządzenia), a podstawą RODO jest prawnie uzasadniony interes. **Polityka prywatności musi to opisać** (dziś nie mówi o analityce); ostateczna ocena należy do prawnika. CNIL podaje warunki zwolnienia pomiaru oglądalności ze zgody: tylko dla wydawcy, ograniczone zdarzenia, skrócone IP, 13 mies. życia identyfikatora, 25 mies. retencji, brak użycia reklamowego: [CNIL, fiche 16](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications). Przyjmuję te liczby jako górny limit retencji.

Uwaga do obecnego kodu: `app/api/videos/[id]/playback-event/route.ts` zapisuje `ipHash = sha256(ip)` **bez soli**; przestrzeń IPv4 da się przeliczyć, więc to dana osobowa. Do poprawy (dzienna sól albo HMAC z kluczem rotowanym).

| Źródło | Dane | Sposób | Koszt (CPU/RAM/dysk/żądania) | Retencja | Prywatność |
|---|---|---|---|---|---|
| **Własny beacon** `/api/t` na `www` | odsłony, ścieżka (bez query), referrer (host), UTM, kraj (`CF-IPCountry`), klasa urządzenia, przeglądarka (rodzina), zdarzenia (klik „Wspieraj”, otwarcie bramki, kroki płatności, logowanie), unikalni (dzienny hash) | `navigator.sendBeacon`, 1–3 żądania na odsłonę (paczki), odpowiedź 204; zapis do Redis Stream, `pp-collector` co 2 s robi wielowierszowy `INSERT` | ~0,1 ms CPU na żądanie w app, ok. 100 B/wiersz na dysku, RAM znikomy | surowe 90 dni, agregaty 25 mies. | bez cookies, bez surowego IP, bez user-id w zdarzeniach anonimowych |
| **Web Vitals (RUM)** | LCP, INP, CLS, FCP, TTFB per ścieżka, urządzenie, typ połączenia | `useReportWebVitals` z Next → ten sam beacon ([nextjs analytics](https://nextjs.org/docs/app/guides/analytics), [przykład](https://www.corewebvitals.io/pagespeed/nextjs-measure-core-web-vitals)); próbkowanie 100% przy małym ruchu, 10–25% przy dużym | jw. | surowe 30 dni, p75 dzienne 25 mies. | jw. |
| **Odtwarzacz** (istniejące `VideoPlaybackSession`, `VideoPlaybackEvent`, `VideoView`) | dziś: sesje, `totalWatchMs`, `maxProgressMs`, zdarzenia (BUFFERING_*, PLAY_*, WATCHED_25/50/75/90, SEEKED, HEARTBEAT, PLAYER_ERROR; policzone na prod: 10 196 wierszy od 2026-06-25) | obecnie: osobne POST na każde zdarzenie, heartbeat co 15 s; docelowo: paczki co 30–60 s i przy `pagehide` | dziś ~1 KB/wiersz; docelowo ~100 B | surowe 90 dni, agregaty 25 mies. | `userId` tylko dla zalogowanych; w agregatach brak |
| **Cloudflare GraphQL Analytics** (zona) | żądania, cache hit, bajty, kody, kraje, hosty, zagrożenia, boty | `pp-collector` co 15–60 min; `httpRequestsAdaptiveGroups` (od 2026-10-02 **30 dni historii także na Free**: [changelog](https://developers.cloudflare.com/changelog/post/2026-10-02-30-days-analytics-on-every-plan/)) | 1 zapytanie GraphQL / 15 min | snapshot w `telemetry.edge_*` bez limitu (małe) | agregaty, brak osobowych |
| **Cloudflare Workers** | wywołania, błędy, subrequesty per skrypt, % limitu 100 tys./dobę | GraphQL `workersInvocationsAdaptive` co 15 min | jw. | jw. | – |
| **R2** | rozmiar i liczba obiektów per bucket, operacje A/B | GraphQL `r2StorageAdaptiveGroups`, `r2OperationsAdaptiveGroups` dziennie | jw. | jw. | – |
| **Cloudflare Web Analytics** | odsłony + Core Web Vitals po stronie Cloudflare | jest skonfigurowana dla `pawelperfect.com` (auto-install), ale w ostatnich 24 h zebrała 17 odsłon przy ok. 200 odsłonach według krawędzi; CSP strony nie dopuszcza `static.cloudflareinsights.com`/`cloudflareinsights.com`, więc to prawie na pewno blokada CSP (wniosek, nie test) | 0 | 30 dni+ | bez cookies ([opis](https://developers.cloudflare.com/analytics/web-analytics/understanding-web-analytics/core-web-vitals/)) |
| **Serwer** (host) | CPU, load, RAM, swap, dysk, I/O, sieć, temperatura n/d | `pp-collector` czyta `/proc` i `/sys` (montowane tylko do odczytu) co 60 s | ~0 CPU, 14 tys. wierszy/dobę ≈ 1,5 MB | 1 min: 14 dni; 5 min: 90 dni; 1 h: bez limitu | – |
| **Kontenery** | RAM, CPU, restarty, OOM, health per kontener | cgroup v2 `/sys/fs/cgroup/system.slice/docker-<id>.scope/{memory.current,cpu.stat,memory.events}` (bez gniazda Dockera); lista kontenerów przez `docker-socket-proxy` tylko GET `/containers` | jw. | jw. | – |
| **Postgres** | rozmiar baz/tabel, połączenia, cache hit, martwe krotki, autovacuum, blokady, najwolniejsze zapytania | `pg_stat_database`, `pg_stat_user_tables`, `pg_locks`, **`pg_stat_statements`** (wymaga `shared_preload_libraries` = restart bazy, kilka sekund) co 5 min | < 1% narzutu | 90 dni | teksty zapytań bez parametrów |
| **Redis** (oba) | pamięć, klucze, długość strumienia telemetrii | `INFO` co 1 min | 0 | 14 dni | – |
| **Kolejka kodowania** | zadania wg statusu, etap, czas, błędy, heartbeat workera | odczyt `VideoEncodeJob` (już w bazie) | zapytanie co 30 s tylko gdy panel otwarty | jak tabela | – |
| **Crony systemd (7 timerów)** | start, czas, kod wyjścia, wynik JSON | `cron-runner.sh` dopisuje wiersz do `telemetry.job_run` (przez collector) + ping do Workera „dead man's switch” | 0 | 400 dni | – |
| **Backup** (`backup.sh` 02:30, lokalnie 7 dni + R2 `serwerek-backups` 14 dni) | sukces/porażka, rozmiar, wiek ostatniej kopii offsite, **test odtworzenia** | wynik do `job_run`; nowy tygodniowy timer: odtworzenie ostatniego dumpa do kontenera tymczasowego, liczba wierszy kluczowych tabel, wynik do `job_run` | test raz w tygodniu: kilka minut CPU, ~200 MB RAM chwilowo | 400 dni | – |
| **Uptime z zewnątrz** | dostępność `www`, `video`, `support`, `admin`, czas odpowiedzi, region | Worker `pp-watchdog` z cron triggerem co 1 min (darmowy plan: 5 cron triggerów na konto: [crontap](https://crontap.com/blog/cloudflare-workers-cron-minute-limit)); historia w D1; alert przez Resend; opcjonalnie drugi, niezależny monitor UptimeRobot Free (50 monitorów co 5 min, od 2026 znów dozwolony komercyjnie: [flarewarden](https://flarewarden.com/insights/uptimerobot-free-plan-commercial-use)) | 1440 wywołań/dobę na sprawdzenie (ok. 6 tys. przy 4 hostach, mieści się w 100 tys.) | 90 dni w D1 | – |
| **Certyfikaty i domeny** | wygasanie certów krawędzi (Cloudflare Universal SSL), domen `.com`/`.pl` | API Cloudflare (`ssl/certificate_packs`) + RDAP dla `.com` (Verisign), WHOIS/RDAP NASK dla `.pl`; raz dziennie | 0 | snapshot | – |
| **Stripe** | wpłaty, zwroty, spory, saldo, wypłaty, prowizje | źródło prawdy: własne `Payment`, `StripeEvent` (webhook już działa); API `balance`, `payouts`, `disputes` raz na godzinę | znikomy | jak `Payment` | dane płatnika tylko w szczegółach, nie w agregatach |
| **Resend** | wysłane, doręczone, odbicia, skargi, otwarcia, kliki, zużycie limitu dobowego | `EmailEvent` (webhook już działa), licznik dzienny z własnych wysyłek; Free = 3000/mies. i **100/dobę** ([nuntly](https://nuntly.com/resend-pricing)) | 0 | 13 mies. | adres e-mail tylko w szczegółach |
| **PP Support** | otwarte rozmowy, czas pierwszej odpowiedzi, wolumen | API agenta (`/api/v1/accounts/1/conversations`, raporty) co 15 min | 0 | snapshot | treść rozmów nie trafia do panelu analitycznego |
| **Błędy aplikacji** | wyjątki serwera (Server Components, Route Handlers, Server Actions, proxy), błędy klienta, fingerprint, licznik, ostatnia próbka | `instrumentation.ts` → `onRequestError` ([docs](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)) + `window.onerror` przez beacon → `telemetry.app_error` (grupowanie po fingerprincie) | znikomy | próbki 30 dni, liczniki 13 mies. | bez ciał żądań, bez nagłówków auth |
| **Logi kontenerów** | stdout/stderr | odczyt na żądanie (`docker logs --since` przez collector, filtr po tekście), bez indeksu | 0 w spoczynku | jak `json-file` (20 MB × 3) | maskowanie tokenów |

### 4.1 Porównanie analityki ruchu

| | Własny pipeline (rekomendacja) | Umami v3 self-hosted | Plausible CE | Cloudflare Web Analytics / GraphQL |
|---|---|---|---|---|
| RAM | 0 w app + część `pp-collector` | ok. 100–200 MB + Postgres (może dzielić `polutek-db`): [dyskusja Umami](https://github.com/umami-software/umami/discussions/2715) | **≥ 2 GB** (ClickHouse): [community-edition](https://github.com/plausible/community-edition/) | 0 |
| Łączenie z naszymi danymi (film → napiwek, logowanie → komentarz) | pełne, SQL | tylko przez eksport | nie | nie |
| Zgodność z „własny stos” | tak | tak | tak, ale za ciężkie | zewnętrzne, ale dozwolone (Cloudflare) |
| Gotowe ekrany | trzeba zbudować | są (osobny UI) | są | są w panelu Cloudflare |
| Ryzyko | czas budowy, poprawność liczenia unikalnych | druga aplikacja do utrzymania | OOM na 4 GB | próbkowanie, brak zdarzeń własnych |
| Werdykt | **źródło prawdy** | plan B, gdyby własny pipeline się opóźniał | odpada | kontrola krzyżowa ruchu krawędzi i botów |

### 4.2 Telemetria oglądania: czego brakuje

Wykres retencji (jaki % widzów ogląda sekundę *t*) i QoE wg standardu CTA-2066 / definicji Mux Data (start time, playback failure %, rebuffer %, exits before start: [Mux](https://mux.com/video-glossary/qoe/), [opis metryk](https://www.forasoft.com/learn/video-quality/articles-vqm/streaming-qoe-metrics)):

| Potrzeba | Dziś | Do dodania |
|---|---|---|
| Krzywa retencji | progi 25/50/75/90% i `maxProgressMs` (za mało, nie widać przewijania i powrotów) | klient wysyła **mapę obejrzanych fragmentów**: 100 kubełków po 1% długości jako bitmapa (13 bajtów) z natywnego `video.played` (TimeRanges); serwer robi OR do sesji; rollup sumuje kubełki per film/dzień |
| Czas startu (time to first frame) | brak | `startupMs` = od kliknięcia/autoplay do pierwszej klatki (już wykrywane w `VideoPlayer.tsx` jako `hasRenderedFrame`) |
| Rebuffer % | są zdarzenia BUFFERING_STARTED/ENDED, brak sumy | `rebufferMs`, `rebufferCount` w podsumowaniu sesji |
| Jakość | brak | rendycja/bitrate (hls.js `LEVEL_SWITCHED`), średni bitrate ważony czasem, liczba przełączeń, `getVideoPlaybackQuality().droppedVideoFrames` |
| Błędy | PLAYER_ERROR (17 wierszy) z kodem | klasyfikacja: fatal przed startem / w trakcie, kod hls.js, host segmentu |
| Wyjścia przed startem | brak | sesja z `PLAYER_READY` bez `PLAY_STARTED` i bez błędu |
| Krawędź wideo | brak w aplikacji; w Cloudflare dziś m.in. **266 odpowiedzi 404 z `video.pawelperfect.com`** w ciągu doby | Worker `hls-edge` zapisuje do Workers Analytics Engine (darmowy plan: 100 tys. punktów/dobę: [cennik](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)) próbkę: film, rendycja, status, cache, kraj; `pp-collector` pobiera agregaty SQL API co godzinę |
| Widzowie teraz | da się policzyć z `lastHeartbeatAt` | widok „aktywne sesje w ostatnich 60 s” dla trybu premiery |

### 4.3 Znaleziska z pomiaru, które panel ma pokazywać sam

- Konto Cloudflare jest **wspólne z innymi projektami**: Workery `kulfon` (10 572 wywołań w 7 dni), buckety `naszagazetka`, `kakaowy-sklepik-media`, `chmurka`. Darmowy limit Workers 100 tys. żądań/dobę jest wspólny dla całego konta, więc cudzy ruch może wyłączyć wideo. Panel musi filtrować po nazwach i pokazywać limit konta.
- Worker `polutek-support-mail`: **15 błędów na 32 wywołania** w 7 dni (47%). Do sprawdzenia w osobnym zadaniu.
- `polutek-hls-edge`: 2 145 wywołań w 7 dni, 0 błędów.
- Ruch krawędzi: 2026-10-02: 11 500 żądań, 540 odsłon, 264 unikalnych; 2026-10-03: 6 046 / 438 / 272.

---

## 5. Model danych telemetrii i szacunki

### 5.1 Gdzie

Ten sam Postgres, **osobny schemat `telemetry`**, osobne role (sekcja 3.2). Tabele surowe partycjonowane po czasie (`PARTITION BY RANGE (ts)`, partycje miesięczne na start, dzienne przy dużym ruchu), indeks BRIN na `ts` plus minimalne B-tree. Retencja = `DETACH` + `DROP` partycji (pg_partman albo własna funkcja w collectorze): [przegląd praktyk](https://mydba.dev/blog/postgres-partition-maintenance-guide). Bez TimescaleDB (licencja, dodatkowe rozszerzenie). Gdy powstanie drugi serwer, schemat `telemetry` przenosi się tam jako pierwszy (osobna baza), panel czyta z niego, strona publiczna o nim nie wie.

### 5.2 Tabele (szkic)

```sql
-- słowniki (małe, stałe identyfikatory zamiast tekstu w każdym wierszu)
telemetry.dim_path (id int PK, path text UNIQUE)          -- znormalizowana, bez query
telemetry.dim_referrer (id int PK, host text UNIQUE)

-- zdarzenia surowe (partycjonowane po ts)
telemetry.page_event (
  ts timestamptz, visitor bigint,      -- dzienny solony hash (64 bit)
  session bigint,                      -- hash wizyty (visitor + 30 min bezczynności)
  path_id int, referrer_id int, utm_source smallint,
  country char(2), device smallint, browser smallint,
  kind smallint,                       -- pageview, cta_support, tip_step_n, sign_in, ...
  video_id uuid NULL, user_id uuid NULL,  -- tylko gdy zalogowany i potrzebne do lejka
  props jsonb NULL)
telemetry.web_vital (ts, path_id, metric smallint, value real, rating smallint, device smallint, conn smallint)
telemetry.playback_session (            -- zastępuje VideoPlaybackSession (po migracji)
  id bigint, video_id uuid, user_id uuid NULL, visitor bigint, started_at, first_frame_ms int,
  watch_ms int, rebuffer_ms int, rebuffer_count smallint, avg_bitrate_kbps int, switches smallint,
  dropped_frames int, played_bitmap bytea, error_code text NULL, exit_before_start bool, counted_as_view bool)
telemetry.playback_event (ts, session_id bigint, kind smallint, position_ms int, value int, code text NULL)
telemetry.app_error (fingerprint text PK, first_seen, last_seen, count bigint, route text, sample jsonb)

-- infrastruktura
telemetry.host_metric (ts, cpu real, load1 real, mem_used int, mem_avail int, swap_used int, disk_used_pct real, net_rx bigint, net_tx bigint)
telemetry.container_metric (ts, container text, cpu real, mem_mb int, restarts int, oom int, health smallint)
telemetry.db_metric (ts, db text, size_mb int, conns int, cache_hit real, dead_tuples bigint, slowest jsonb)
telemetry.job_run (id, job text, started_at, finished_at, ok bool, exit_code int, result jsonb)   -- crony, backup, test odtworzenia, rollupy
telemetry.uptime_check (ts, target text, region text, status int, ms int)                      -- kopia z D1 Workera
telemetry.external_snapshot (source text, key text, ts, value jsonb, PRIMARY KEY (source, key)) -- ostatni stan Cloudflare/Stripe/Resend/PP Support

-- agregaty (rollup), liczone przyrostowo co 5 min dla bieżącej godziny/dnia
telemetry.r_traffic_hourly (hour, path_id, country, device, referrer_id, pageviews, visitors, sessions, bounces)
telemetry.r_traffic_daily  (... jw. + avg_session_s)
telemetry.r_video_daily (day, video_id, starts, views, unique_viewers, watch_ms, completion_buckets int[100],
                         startup_p50, startup_p95, rebuffer_pct, failure_pct, exit_before_start_pct, avg_bitrate)
telemetry.r_vitals_daily (day, path_id, device, metric, p75, good_pct)
telemetry.r_funnel_daily (day, step, count)          -- odsłona → film → „Wspieraj” → kwota → metoda → sukces
telemetry.r_host_5m / r_host_1h, r_container_5m / r_container_1h
```

### 5.3 Szacunek rozmiaru

Założenia na wizytę: 3 odsłony, Web Vitals 4 metryki/odsłonę (100% przy 10 tys., 20% przy 1 mln), 0,8 sesji odtwarzania z ok. 6 zdarzeniami (start, przełączenia, błędy, podsumowanie; heartbeat aktualizuje wiersz sesji zamiast dodawać), 2 zdarzenia własne. Wiersz smukły ≈ 100 B na dysku z indeksami.

| | 10 tys. wizyt / mies. | 1 mln wizyt / mies. |
|---|---|---|
| Wiersze surowe / mies. | ok. 22 tys. × 10 = **220 tys.** | ok. **12 mln** (vitals próbkowane) |
| Dysk surowe / mies. | ok. **22 MB** | ok. **1,2 GB** |
| Surowe przy retencji 90 dni | ok. 70 MB | ok. **3,6 GB** |
| Agregaty / rok | < 20 MB | ok. 200–400 MB |
| Infrastruktura (1 min / 5 min / 1 h) | ok. 50 MB / 14 dni + kilkadziesiąt MB/rok | to samo (nie zależy od ruchu) |
| Średni zapis | 0,1 wiersza/s | ok. 5 wierszy/s, w premierze kilkaset/s (paczki co 2 s, bez problemu) |
| Żądania HTTP telemetrii do app | ok. 40 tys./mies. | ok. 4 mln/mies. (1–3 na odsłonę zamiast jednego na zdarzenie) |
| **Dla porównania: obecny model** | ~1 KB/wiersz | przy ~25 zdarzeniach/sesję (heartbeat co 15 s) ≈ 20 mln wierszy ≈ **20 GB/mies.** i ok. 20 mln dodatkowych żądań do Next.js |

### 5.4 Wzorzec zapisu (bez wpływu na szybkość strony)

1. Przeglądarka: kolejka w pamięci, wysyłka `sendBeacon` co 30–60 s i przy `pagehide`/`visibilitychange`; nigdy w ścieżce renderu.
2. `/api/t` na `www`: walidacja zod, limit per hash IP, dzienna sól z pamięci (rotacja o północy UTC, trzymana w Redis z TTL), wyliczenie `visitor`, **jeden `XADD`** do Redis Stream `tel` z `MAXLEN ~ 200000` (bezpiecznik), odpowiedź 204. Bez dotykania Postgresa.
3. `pp-collector`: `XREADGROUP` paczkami do 1000, `INSERT ... SELECT unnest(...)` jednym zapytaniem, `XACK`; przy padnięciu bazy zdarzenia czekają w strumieniu.
4. Rollupy przyrostowe co 5 min (ostatnia godzina + domknięcie poprzedniej), wpis do `job_run`.
5. Jeśli Redis lub collector leżą, `/api/t` po prostu traci zdarzenia (fail-open). Strona nigdy nie czeka na telemetrię.

### 5.5 Co zostaje w narzędziach zewnętrznych

- Panel Cloudflare: śledztwa WAF/bot, szczegóły reguł, logi Access (24 h na Free).
- Dashboard Stripe: spory z dowodami, podatki, wypłaty szczegółowo (panel pokazuje skrót i link).
- Dashboard Resend: pojedyncze wiadomości i treść (panel: wskaźniki i limity).
- PP Support: obsługa rozmów (panel: liczby i link).
- **Grafana: nie teraz.** Osadzanie w iframe wymaga anonimowego dostępu lub auth-proxy i luzuje CSP. Ewentualnie później na drugim serwerze, do analiz ad hoc, z rolą `pp_analytics_ro`.
- Monitoring serwera: własny collector zamiast Netdata (100–350 MB) i zamiast Prometheus + cAdvisor + Grafana (0,5–2 GB+): [porównanie](https://selfhosting.sh/compare/prometheus-vs-netdata/). Jeśli trzeba szybko mieć wykresy przed własnymi, **Beszel** (hub < 50 MB, agent ok. 23 MB, historia i alerty dla kontenerów: [github](https://github.com/henrygd/beszel)) jest najlżejszą gotową opcją, za Access na osobnym hoście.
- Błędy: własna tabela zamiast GlitchTip (256–512 MB + Postgres/Valkey) i zamiast Sentry self-hosted (16 GB+): [porównanie](https://selfhosting.sh/compare/glitchtip-vs-sentry/). GlitchTip rozważyć na drugim serwerze.

---

## 6. Ładowanie i odświeżanie bez szkieletów

- **Odczyt w komponentach serwerowych** z gotowych agregatów i snapshotów. Strona panelu renderuje się z danymi w pierwszym HTML. Żadnego `loading.tsx` i szkieletów; nawigacja między zakładkami przez `<Link prefetch>` (RSC payload pobrany przy najechaniu).
- **Wolne źródła** (Cloudflare, Stripe, Resend, PP Support) nigdy nie są pytane w czasie żądania. Collector zapisuje je do `external_snapshot`, panel pokazuje ostatnią wartość z podpisem „stan z 14:05” i znacznikiem, jeśli dane są starsze niż próg (np. 2× interwał). Przycisk „odśwież teraz” zleca odczyt collectorowi i strumieniuje wynik.
- **Strumieniowanie pojedynczych kafli** tylko tam, gdzie jest coś rzeczywiście wolnego (np. raport ad hoc po surowych danych): kafel startuje z ostatnią policzoną wartością, nie z pustym prostokątem.
- **Na żywo** (tryb premiery, obciążenie): SSE z panelu (`text/event-stream`) co 2–5 s: widzowie teraz, starty/min, błędy/min, CPU/RAM, kolejka. Źródło: Redis pub/sub od collectora albo `LISTEN/NOTIFY`. Przez Cloudflare Tunnel wysyłać komentarz keep-alive co 15–30 s (proxy zamyka bezczynne połączenia po ok. 100 s). WebSocket niepotrzebny.
- **Cache**: dane per tenant nie istnieją (jeden admin), więc cache po stronie serwera z krótkim TTL (`'use cache'` / `unstable_cache` 30–60 s, unieważnianie tagiem po mutacji). Odpowiedzi HTTP `Cache-Control: private, no-store`, w Cloudflare bypass.
- **Koszt dla bazy produkcyjnej**: ekrany czytają tylko `r_*` i snapshoty (dziesiątki do tysięcy wierszy), zapytania po surowych danych tylko w „Eksploratorze” z rolą `pp_analytics_ro` i `statement_timeout = 5s`. Widoki zmaterializowane niepotrzebne (rollupy są tańsze i przyrostowe). Replika odczytu dopiero z drugim serwerem (tam telemetria i panel czytają lokalnie).

---

## 7. Wdrożenie i migracja etapami

### 7.1 Infrastruktura

- Tunel `serwerek` (zdalnie zarządzany): nowy hostname `admin.pawelperfect.com` → `http://127.0.0.1:3100`; DNS CNAME tworzy się z tunelu.
- Access: aplikacja `serwerek admin` (sekcja 3.2), osobna aplikacja dla ewentualnego wejścia z Workera (service token), jeśli Worker awaryjny ma czytać stan.
- `docker-compose.yml`: usługi `admin` (`polutek-admin:<sha>`, `admin.env` tylko z tym, czego panel potrzebuje: `DATABASE_URL` roli `pp_admin`, sekret Better Auth panelu, Stripe/Resend tylko jeśli panel wykonuje zwroty/wysyłki, `CF_ACCESS_AUD`) i `collector` (`pp-collector:<sha>`, `collector.env`: rola `pp_collector`, token Cloudflare tylko do odczytu analityki, klucz Stripe **restricted read-only**, klucz Resend tylko do odczytu jeśli dostępny, token agenta PP Support).
- `health.sh`: dodać kontenery `polutek-admin-1`, `polutek-collector-1`, health panelu.
- Backup bez zmian (schemat `telemetry` wchodzi do `pg_dumpall`); przy dużym ruchu wyłączyć surowe partycje telemetrii z kopii, a agregaty zostawić.

### 7.2 Niezależność

| Sytuacja | Strona | Panel |
|---|---|---|
| Padło wdrożenie strony | leży, rollback `deploy.sh --rollback` | działa (osobny kontener) |
| Padł panel | działa | leży, rollback osobny |
| Padła baza | leży | odpowiada, pokazuje „baza niedostępna” + dane z collectora/Workera z pamięci |
| Padł serwer | leży | leży; **Worker `pp-watchdog` wysyła alert i obsługuje awaryjną stronę stanu** `admin.pawelperfect.com/_status` (Worker na trasie, czyta D1, gdy origin zwraca błąd) |

To jest odpowiedź na „panel nigdy nie jest ślepy”: przy całkowitej awarii serwera zostaje widok z zewnątrz (dostępność, czas, ostatni backup i ostatni cron z dead man's switch).

### 7.3 Etapy

- **Etap 0 (przed budową, 1–2 dni):** 2FA na kontach admina, `hello@` poza `ADMIN_EMAILS` i polityką Access, budowa obrazów poza serwerem (GHCR), `pg_stat_statements`, poprawka CSP lub wyłączenie Cloudflare Web Analytics, solony hash w `playback-event`.
- **Etap 1, szkielet (tydzień):** `apps/admin`, Dockerfile target, `deploy.sh admin`, Access + walidacja JWT, Better Auth panelu (passkey + TOTP), bootstrap CLI, powłoka z nawigacją, `AuditLog` niezmienny. Ekran **„Teraz”** tylko do odczytu: zdrowie usług, RAM/CPU/dysk/swap, kolejka kodowania, ostatnie crony i backup, wpłaty dziś, błędy. Wartość od pierwszego dnia, zero ryzyka dla danych.
- **Etap 2, telemetria:** `pp-collector`, `/api/t`, schemat `telemetry`, rollupy, Worker `pp-watchdog` + D1, zmiany w odtwarzaczu (paczki, bitmapa obejrzanych fragmentów, QoE). Ekrany: Ruch, Wideo (retencja, QoE), Wydajność (Web Vitals), Infrastruktura, Krawędź.
- **Etap 3, sekcje operacyjne tylko do odczytu:** użytkownicy (z „podglądem jako”), wpłaty, dziennik audytu z filtrami, poczta (statystyki, odbicia), komentarze (przegląd).
- **Etap 4, zapisy, od najmniej ryzykownych:** moderacja komentarzy → filmy (upload, publikacja, premiera, Hero, kolejność) → e-maile i broadcast (step-up, idempotencja) → ustawienia → zwroty (step-up, klucz idempotencji Stripe, blokada wiersza: ADM-04).
- **Etap 5, wygaszenie:** każda przeniesiona sekcja dostaje na `www` przekierowanie 308 na `admin.`; po ostatniej usuwamy `app/admin/**` i `app/api/admin/**` z publicznej aplikacji, a `proxy.ts` zwraca 404 dla `/admin*` i `/api/admin*`. Rola `ADMIN` na koncie publicznym zostaje tylko jako odznaka (jeśli właściciel chce „serduszko autora”), bez uprawnień.

### 7.4 Testy

- Kontrakt każdej akcji panelu w jednej mapie `{akcja, schemat zod, uprawnienie, step-up, zdarzenie audytu, limit}`; test generowany z mapy (zamiast obecnych testów „tekstu źródła”, ADM-31).
- Playwright z wirtualnym WebAuthn, seed admina, scenariusze: logowanie, step-up przed zwrotem (Stripe test mode), publikacja premiery, moderacja.
- Testy Postgresa: uprawnienia ról, trigger `AuditLog`, rotacja partycji, poprawność rollupów na ustalonych danych.
- Test syntetyczny z Workera: logowanie do panelu nie, ale dostępność `admin.` (302 do Access) tak.

---

## 8. Ryzyka i koszty

### 8.1 Ryzyka

| Ryzyko | Skala | Ograniczenie |
|---|---|---|
| Pamięć (swap już 1,5 GB, `dockerd` 1 GB RSS) | wysoka do czasu powiększenia serwera | budowa poza serwerem, limity kontenerów, zbadanie `dockerd`; powiększenie przy starcie (opcje w `STATUS.md`: CX43 8 vCPU/16 GB 15,99 € netto, CPX32 4 vCPU/8 GB 35,49 €) |
| Panel z dostępem do wszystkiego jako cel ataku | wysoka | 3 warstwy (Access z MFA, passkey + step-up, rola DB), brak skryptów zewnętrznych, niezmienny audyt, alerty logowań |
| Pętla zaufania przez `hello@` / PP Support / token agenta | wysoka, **istnieje dziś** | etap 0 |
| Złożoność dla jednego właściciela | średnia | jeden język i jedno repo, brak Prometheusa/Grafany/ClickHouse/Sentry, collector jako jeden proces, wszystko opisane w runbooku |
| Uzależnienie od Cloudflare (Access, Worker, D1) | średnia | to i tak fundament (tunel, DNS, wideo); panel ma własne logowanie, więc awaria Access = brak dostępu, nie dziura; awaryjnie dostęp przez tunel SSH na `127.0.0.1:3100` |
| Wpływ na szybkość strony | niski | beacon asynchroniczny, `XADD` zamiast `INSERT`, fail-open |
| Wspólny limit darmowych Workerów z innymi projektami | średnia | Workers Paid przy starcie (5 USD) albo osobne konto dla innych projektów |
| Prawo: analityka bez zgody | średnia | bez cookies, solony dzienny hash, retencja ≤ 25 mies., aktualizacja polityki prywatności, ocena prawnika |
| Dryf telemetrii (źle liczone wskaźniki) | średnia | testy rollupów, porównanie z Cloudflare (krawędź) jako kontrola krzyżowa |

### 8.2 Koszty miesięczne (ceny na dziś)

| Pozycja | Koszt | Źródło |
|---|---|---|
| Cloudflare Access (Zero Trust Free, ≤ 50 użytkowników) | 0 | [costbench](https://costbench.com/software/business-vpn/cloudflare-zero-trust/free-plan/) |
| Workers Paid (i tak planowany przy starcie; 10 mln żądań w cenie) | 5 USD | `STATUS.md`, [cennik Workers](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1 (historia watchdoga), Workers Analytics Engine (100 tys. punktów/dobę na Free) | 0 w limitach | [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) |
| Resend: alerty + broadcasty. Free 3000/mies., 100/dobę; Pro 20 USD (50 tys., bez limitu dobowego) | 0 → 20 USD przy starcie | [nuntly](https://nuntly.com/resend-pricing) |
| UptimeRobot Free (opcjonalny drugi monitor) | 0 | [flarewarden](https://flarewarden.com/insights/uptimerobot-free-plan-commercial-use) |
| Healthchecks.io (alternatywa dla dead man's switch w Workerze; Free 20 sprawdzeń) | 0 | [foursight](https://foursight.cloud/compare/healthchecks-pricing) |
| Klucze sprzętowe FIDO2 (2 sztuki, jednorazowo) | cena do sprawdzenia | – |
| Powiększenie serwera | wg decyzji przy starcie | `STATUS.md` |
| **Razem bez serwera** | **5–25 USD/mies.** | |

---

## 9. Decyzje dla właściciela

1. **Układ**: zgoda na (b) osobną aplikację w tym samym repo (`apps/admin`, kontener na 3100) zamiast przerabiania obecnego `/admin`.
2. **Tożsamość admina**: osobne konto panelu (osobne tabele, passkey, bez resetu przez e-mail) zamiast roli na koncie publicznym. Rekomendacja: osobne.
3. **Access**: tylko `pawel.perfect@gmail.com` w polityce panelu; wymagany klucz/passkey w Access; czy dodać warunek „kraj = PL”.
4. **Etap 0 teraz**: 2FA na 4 kontach admina, usunięcie `hello@` z `ADMIN_EMAILS` i z polityki Access, ograniczenie agenta AI w PP Support do wiadomości bez linków resetu/OTP.
5. **Klucze sprzętowe**: kupić 2 klucze FIDO2 czy oprzeć się na passkey w telefonie + Windows Hello (+ kody zapasowe).
6. **Analityka bez zgody**: zgoda na własny pipeline bez cookies (dzienny solony hash, retencja surowych 90 dni, agregatów 25 mies.) i na aktualizację polityki prywatności (z prawnikiem).
7. **Cloudflare Web Analytics**: naprawić CSP (kontrola krzyżowa, skrypt Cloudflare) czy wyłączyć po uruchomieniu własnej analityki. Rekomendacja: wyłączyć, krawędź mamy z GraphQL.
8. **Moderacja z publicznej strony**: przenieść całość do panelu czy zostawić „serduszko autora” na `www`.
9. **Restart Postgresa** (kilka sekund) dla `pg_stat_statements` w oknie serwisowym.
10. **Budowa obrazów poza serwerem** (GitHub Actions + GHCR) jako warunek drugiej aplikacji.
11. **Konto Cloudflare**: przenieść inne projekty (`kulfon`, `naszagazetka`, `kakaowy-sklepik`, `chmurka`) na osobne konto albo przyjąć wspólne limity do czasu Workers Paid.
12. **Budżet**: Resend Pro 20 USD przy starcie (alerty + broadcast bez limitu 100/dobę).
