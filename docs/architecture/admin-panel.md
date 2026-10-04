# Panel administratora `admin.pawelperfect.com`: wizja i plan

Stan: 2026-10-04. Status: **faza 0 w budowie** (telemetria: [`admin-telemetry.md`](admin-telemetry.md), stan
faktyczny ma tam pierwszeństwo); **faza 1 zbudowana w kodzie (`apps/admin`), jeszcze niewdrożona**. Jak faza 1 jest
zbudowana i czym różni się od planu: sekcja 9. Wdrożenie, rejestracja, reset, rollback:
[`operations/ADMIN-PANEL.md`](../operations/ADMIN-PANEL.md). Parytet ze starym panelem:
[`admin-parity.md`](admin-parity.md). Dokument scala trzy raporty badawcze (mapa w sekcji 8). Każdy fakt pochodzi z
raportów albo z kodu; czego nie wiemy, oznaczam „do ustalenia”.
Gdy któraś decyzja się zmieni albo faza się skończy, ten plik zmienia się w tym samym PR.

**Decyzje właściciela z 2026-10-04 (12 pytań z sekcji 7):** wszystkie według rekomendacji, z wyjątkami: nic za
pieniądze (bez Workers Paid, Resend Pro, kluczy sprzętowych i nowych płatnych usług; „Workers Paid 5 USD” i „Resend
Pro” z sekcji 6.1 są nieaktualne), inne projekty Cloudflare zostają na koncie, przed startem publicznym fazy 0–1 +
poprawki z sekcji 5. Wygląd prototypu zatwierdzony.

## 1. Cel i zasady

- **Dla kogo:** jeden administrator, właściciel. Nie ma ról, zespołu ani wielu kanałów.
- **Po co:** w 10 sekund odpowiedzieć na trzy pytania: czy wszystko działa, co się zmieniło, co wymaga mojej decyzji.
- **Czego panel nie robi:** nie jest częścią serwisu publicznego (bez jego paska, regulaminu i wyglądu), nie jest „zbuduj sobie dashboard”,
  nie pyta zewnętrznych API w czasie renderu, nie omija modułów domenowych (`fulfillPayment()`, blokady publikacji, audyt).
- **Bez szkieletów:** strony to komponenty serwerowe czytające gotowe agregaty; brak `loading.tsx`, szarych bloków i migających liczników.
- **Własny stos:** z zewnątrz tylko Stripe, Cloudflare i Resend. Nic, co potrzebuje gigabajtów RAM (serwer ma 4 GB).
- **Panel nigdy nie jest ślepy:** każda liczba ma godzinę pomiaru i źródło, brak danych jest stanem jawnym, a strażnik działa poza serwerem.
- **Bezpieczeństwo przed funkcjami:** najpierw logowanie, warstwy i audyt, dopiero potem zapisy; zwroty i rozsyłki na końcu, z ponownym potwierdzeniem.
- **Zbieraj teraz, pokazuj później:** telemetrii nie da się dopisać wstecz, więc zbieranie startuje przed ekranami.
- **Jeden język (polski), jedna powłoka, jedna tabela, jeden formularz na obiekt.**

## 2. Decyzje architektoniczne

| Obszar | Decyzja | Uzasadnienie | Odrzucone alternatywy |
|---|---|---|---|
| Układ aplikacji | **Osobna aplikacja Next.js w tym samym repo** (`apps/admin`, npm workspaces, osobny obraz `polutek-admin:<sha>`, kontener na `127.0.0.1:3100`, `mem_limit: 384m`). Na start importuje `../../lib/*` przez alias; `packages/core` dopiero, gdy granice się ustalą. | Decyzja właściciela „niezależna aplikacja”; osobne CSP, ciasteczka, auth i rola bazy; obraz publiczny bez kodu admina; wdrożenie i rollback niezależne; te same use case'y z `lib/modules/**` (41 z 48 tras admina to cienkie adaptery). Wzorzec Next.js „multi-zones”. | (a) routing po hoście w jednej aplikacji: 0 MB RAM, ale wspólny obraz, ciasteczko i CSP (zostaje jako awaryjne „szybko na subdomenę”). (c) inny stos + API: dubluje niezmienniki. (d) Directus, Retool, Grafana jako rdzeń: omijają domenę albo nie mieszczą się w RAM. Refine: zbędna abstrakcja CRUD. |
| Subdomena | `admin.pawelperfect.com` jako nowy hostname tunelu `serwerek`; Cache Rule „bypass”, `X-Robots-Tag: noindex`; awaryjnie tunel SSH na `127.0.0.1:3100`. | Osobny origin = osobne ciasteczka i CSP; XSS na `www` nie działa z uprawnieniami admina (ADM-35). | Panel pod `www/admin` (dzisiejszy stan). |
| Logowanie, warstwa 1 | **Cloudflare Access**: aplikacja `serwerek admin`, include tylko `pawel.perfect@gmail.com`, require „independent MFA” (klucz/biometria); aplikacja weryfikuje `Cf-Access-Jwt-Assertion` (podpis, `aud`). | Odcina świat od panelu przed tunelem; wzorzec już działa dla `support.`. | Sam Access (jedna warstwa); `hello@` w polityce (pętla zaufania, sekcja 7 pkt 4). Dostępność independent MFA na planie Free: **do ustalenia przy wdrożeniu**. |
| Logowanie, warstwa 2 | **Osobna instancja Better Auth** w panelu, osobne tabele (`AdminUser`, `AdminSession`, `AdminPasskey`, `AdminTwoFactor`, `AdminVerification`); passkey (`rpID: admin.pawelperfect.com`) + TOTP z 10 kodami zapasowymi; bez rejestracji, bez resetu e-mailem, bez Google. Ciasteczko `__Host-`, host-only, `SameSite=Strict`. Sesja: bezczynność 30–60 min, absolutnie 12 h, `freshAge` 5 min. **Step-up** (ponowny passkey) przed zwrotem, masowym usunięciem, rozsyłką, eksportem danych osobowych, podglądem sekretów. Bootstrap tylko przez SSH: `scripts/admin-enroll.js` z linkiem jednorazowym (15 min) w terminalu; `ADMIN_EMAILS` znika. | Sesja i reset hasła konta publicznego nigdy nie dają drogi do panelu; Google omija 2FA z założenia; `www` i `admin` są „same-site”, więc CSRF = dokładny `Origin` + `Sec-Fetch-Site: same-origin`. | Rola `ADMIN` na koncie publicznym z 2FA (dziś: 0/4 kont z 2FA, sesja 30 dni). Logowanie Google. Better Auth nie ma wbudowanego wymuszenia 2FA dla adminów, więc wymusza je nasz `requireAdmin()`. |
| Logowanie, warstwa 3 | **Rola bazy `pp_admin`**: `SELECT` na domenie, `INSERT/UPDATE` tylko tam, gdzie panel zmienia dane, na `AuditLog` tylko `INSERT`. **`AuditLog` niezmienny**: `REVOKE UPDATE/DELETE/TRUNCATE`, trigger blokujący, łańcuch `hash = sha256(prev_hash ‖ wiersz)`, nocny eksport do R2 z bucket lock (400 dni). Audyt sam dopisuje IP, UA i `requestId` z kontekstu żądania. | Dziś aplikacja łączy się prawdopodobnie superużytkownikiem (do ustalenia, odczyt ról zablokowany); w produkcji 0/25 wpisów admina z IP (ADM-14). | Wspólna rola z serwisem; audyt edytowalny. |
| Baza | Ten sam Postgres 17, **osobny schemat `telemetry`** z rolami `pp_collector` (zapis), `pp_analytics_ro` (odczyt, `statement_timeout = 5s`). Tabele surowe partycjonowane miesięcznie, BRIN na `ts`, retencja przez `DETACH`/`DROP`. Przy drugim serwerze schemat `telemetry` przenosi się jako pierwszy. Włączyć `pg_stat_statements` (restart bazy na kilka sekund). | Jedno źródło, łączenie ruchu z `User`/`Payment`/`Video` w SQL; łatwa wyprowadzka. | Osobna baza teraz (RAM), TimescaleDB (licencja, rozszerzenie), ClickHouse (≥ 2 GB RAM). |
| Telemetria i agregaty | **Zbudowane inaczej, patrz [`admin-telemetry.md`](admin-telemetry.md) §2: bez Redis Stream (Next przekazuje beacon do kolektora po odpowiedzi) i bez `userId`.** Pierwotnie: własny beacon `navigator.sendBeacon` → `/api/t` na `www` (zod, limit, jeden `XADD` do Redis Stream `tel`, `MAXLEN ~200000`, odpowiedź 204, fail-open) → `pp-collector` wsadowo `INSERT … unnest` → rollupy przyrostowe co 5 min (`r_traffic_*`, `r_video_daily`, `r_funnel_daily`, `r_vitals_daily`, `r_host_*`). Odtwarzacz: paczki co 30–60 s i przy `pagehide`, podsumowanie sesji (`startupMs`, `rebufferMs`, bitrate, przełączenia, bitmapa obejrzanych 1% z `video.played`, wyjście przed startem). Rollup filmów liczony **przed** cronem `prune-playback-sessions`. | Jedyna droga do „ten film przyniósł X kont i Y napiwków”. Dziś wiersz `VideoPlaybackEvent` ≈ 1 KB i jedno żądanie HTTP na zdarzenie; docelowo ≈ 100 B. Strona nigdy nie czeka na telemetrię. | Plausible CE (ClickHouse ≥ 2 GB), PostHog i Sentry self-host (16 GB), Umami (plan B, gdyby własny pipeline się opóźniał), sam Cloudflare Web Analytics (brak złączeń; dziś i tak blokowany przez CSP). Raport 2 zapisywał zdarzenia wprost do Postgresa: wybrany wariant raportu 3 (Redis Stream), bo nie dotyka bazy w ścieżce żądania. |
| Kolektor | Jeden kontener **`pp-collector`** (60–80 MB): `/proc` i `/sys` co 60 s, cgroup v2 dla kontenerów, lista kontenerów przez `docker-socket-proxy` tylko `GET /containers`; Postgres i Redis co 1–5 min; Cloudflare GraphQL co 15 min (zona, Workery, R2; 1 zapytanie, limit 300/5 min); Stripe (klucz restricted read-only) i PP Support co 15–60 min; RDAP i certyfikaty raz dziennie. Wynik do `telemetry.external_snapshot` z `fetchedAt`. | Ekran czyta tylko lokalną bazę: szybki i odporny na awarię API. | Netdata (100–350 MB), Prometheus + cAdvisor + Grafana (0,5–2 GB), Beszel (najlżejsza gotowa opcja, ale osobne logowanie), surowe gniazdo Dockera (raport 2; montowanie „tylko do odczytu” nie ogranicza API, stąd proxy). |
| Strażnik zewnętrzny | **Zbudowany 2026-10-04 z cronem co 5 min (SERWEREK.md §25).** Pierwotnie: Worker **`pp-watchdog`** z cron triggerem co 1 min: `www`, `video.`, `support.`, `admin.` (oczekiwany 302 do Access); dead man's switch dla cronów i kopii (pingi z `cron-runner.sh` i `backup.sh`); historia w D1; alert e-mailem przez Resend (push w PWA później); awaryjna strona `admin.pawelperfect.com/_status`, gdy origin nie odpowiada. Opcjonalnie drugi monitor UptimeRobot Free. | Monitor na tym samym serwerze umiera razem z nim; dziś monitoring jest tylko lokalny (`health.sh`). | Uptime Kuma na serwerze, Better Stack i Healthchecks.io (kolejny dostawca). Liczba wolnych cron triggerów na koncie (Free: 5, konto współdzielone z innymi projektami): **do ustalenia**. |
| Odświeżanie | Komponenty serwerowe czytają rollupy i migawki (< 50 ms); `<Link prefetch>`; cache 30–60 s z unieważnieniem tagiem po mutacji; odpowiedzi `private, no-store`. Dane starsze niż 2× interwał dostają znacznik, „odśwież teraz” zleca odczyt kolektorowi. Tryb „na żywo” (premiera) to SSE co 2–5 s z keep-alive co 15–30 s (tunel zamyka bezczynne połączenia po ok. 100 s). | Wzorzec `/admin/channel` i `/admin/payments` (dane z serwera) już działa; reszta panelu ma dziś 13 `loading.tsx` i podwójne szkielety na 6 trasach (ADM-21). | `useEffect`-fetch po stronie klienta (`useAdminListQuery`), WebSocket, wołanie API zewnętrznych przy renderze. |
| Retencja i prywatność | Bez ciasteczek i localStorage do identyfikacji, bez surowego IP: odwiedzający = `hash(dzienna sól ‖ IP ‖ UA ‖ host)` obcięty do 64 bitów, sól niszczona co dobę. `userId` tylko dla zalogowanych i tylko tam, gdzie potrzebny lejek. Surowe zdarzenia 90 dni, agregaty 25 mies. (górny limit CNIL), metryki serwera 1 min / 14 dni, 5 min / 90 dni, 1 h bez limitu; `job_run` 400 dni; próbki błędów 30 dni. `ipHash` jest już solony (HMAC, #1648). Polityka prywatności opisuje statystyki od wersji 2026-10-05. | **Korekta 2026-10-04:** po wytycznych EDPB 2/2023 beacon bez cookies może podlegać art. 399 PKE, który nie ma wyjątku dla analityki; ryzyko ograniczone i wyłącznik `TELEMETRY_BEACON=off` opisane w [`admin-telemetry.md`](admin-telemetry.md) §1, ocena prawnika przed startem. Raport 2 dawał 30–90 dni surowych: przyjęte 90 (raport 3, mieści się w limicie CNIL). | Analityka z ciasteczkami i banerem zgody; surowe IP. |
| Reużycie kodu | KEEP: use case'y `lib/modules/**` (video, video-pipeline, payments, users, comments, email, audit do rozszerzenia), UI pipeline'u (`VideoPipelinePanel`, `PipelineStatusCard`, `useVideoPipeline`, `multipart-uploader.ts`), `BroadcastWizard`/`BroadcastHistory`, `UserPatronActions`, `FundraisingGoalCard`, `video-utils.ts`, `parseAdminBody` + schematy zod, `lib/api/csrf.ts` jako wzór, `readAdminApiError` (dodać `fieldErrors`). REWRITE: `admin-stats`, `lib/admin/query-parser.ts`. Przenieść z tras do modułów: domyślna miniatura, `cover-upload`, orkiestracja usuwania filmu, eksport CSV. | Domena jest przetestowana i poprawna; zła jest warstwa stron. | DROP: `useAdminListQuery`, 15 szkieletów z `components/skeletons/admin.tsx`, publiczny `Navbar` w panelu, `AdminLayoutShell`, `AdminVisualShell`, edycja inline filmu, 8 tras bez wywołującego (ADM-24). |

### 2.1 Sprzeczności między raportami i jak je rozstrzygnąłem

| Temat | Raporty mówią | Przyjęte | Podstawa |
|---|---|---|---|
| Układ aplikacji | R1: najtaniej (a) routing po hoście. R3: (b) osobna aplikacja. | (b), (a) jako awaryjne | Decyzja właściciela „niezależna aplikacja” i ADM-35 (wspólne ciasteczko). R1 liczył tylko koszt pracy i RAM. |
| Pamięć serwera | R2: RAM 3,8 GB, zajęte 2,27 GB, pp-support-web 163 MB. R3: 3809 MB, użyte 2165 MB, dostępne 1643 MB, pp-support-web 91 MiB. | R3 | Pomiar z godziną (09:53) i limitami kontenerów; różnice to inna chwila pomiaru. Zgodne: swap ok. 1,48 GB, dysk 46/75 GB (64%), app ok. 138 MiB. |
| Kopie zapasowe | R2: tylko lokalnie. R3: lokalnie 7 dni + R2 `serwerek-backups` 14 dni. | R3 | Potwierdza `audit-ops.md` (OPS-06, OPS-10: każda wysyłka rclone najpierw dostaje 501). Brakuje testu odtworzenia i alertu. |
| Liczba zadań okresowych | R1 i R3: 7 timerów. R2: 7 timerów + 2 wpisy cron; makieta mówi „8”. | **9 zadań do monitorowania** | 7 timerów `polutek-cron@*` + `backup.sh` (02:30) + `health.sh` (co 5 min). |
| `ADMIN_EMAILS` | R3 i STATUS: `hello@` na liście. R1: na produkcji pusty ciąg (zmierzone 2026-10-04). | Pusty na produkcji | Pomiar długości zmiennej na serwerze ma pierwszeństwo przed opisem. `hello@` nadal jest w polityce Access dla `support.` (R3, sprawdzone w API). Które konta mają rolę `ADMIN`: **do ustalenia**. |
| Numery ADM | R2 i R3 cytują numery z audytu 2026-10-03 (np. ADM-05 = 2FA). | Numery z R1 | R1 sprawdził każde znalezisko w obecnym kodzie i nadał numery od nowa (ADM-04 = 2FA, ADM-05 = potwierdzenia, ADM-29 = zwroty). |
| Kolejność faz | R2: faza 0 = powłoka + logowanie + zbieranie. R3: etap 0 = poprawki bezpieczeństwa, etap 1 = powłoka, etap 2 = telemetria. | Faza 0 = bezpieczeństwo **i** zbieranie; powłoka w fazie 1 | Zbieranie żyje w aplikacji publicznej, serwerze i Workerze, więc nie czeka na panel, a danych nie da się dopisać wstecz (R2). Bezpieczeństwo pierwsze, bo dziura jest dziś (R3). |
| Nazwa ekranu startowego | R2: „Dzisiaj”. R3: „Teraz”. | „Dzisiaj” | Spójne z 8-pozycyjną nawigacją R2. |
| Historia Cloudflare GraphQL | R2: co najmniej 31 dni. R3: 30 dni także na Free (changelog 2026-10-02). | 30 dni | Nowsze źródło. Kolektor i tak zapisuje migawki u nas. |

## 3. Nawigacja i moduły

Lewy pasek z 8 pozycjami i Ustawieniami na dole; liczba przy pozycji = elementy w kolejce, kropka = alert.
Wszystkim steruje paleta **Ctrl/Cmd+K** (obiekty i akcje), `?` pokazuje skróty, `g` + litera przechodzi do modułu.
Globalny filtr czasu i porównanie są w URL (`?range=28d&cmp=prev`), strefa Europe/Warsaw. Każda liczba jest linkiem do przefiltrowanej listy.
Telefon: dolny pasek (Dzisiaj, Skrzynka, Treści, Przychody, Więcej), tabele jako listy. Tryb ciemny systemowy.
ID funkcji (A1, B6, T3…) odsyłają do katalogu w [`admin-2-research.md`](../audit/2026-10-03/admin-2-research.md) §3; tam są źródła danych i nakład.

| Moduł | Co zawiera | MUST na start | SHOULD (1–2 mies. po starcie) | LATER |
|---|---|---|---|---|
| **1 Dzisiaj** | stan zdrowia, skrzynka „Wymaga uwagi”, KPI z porównaniem, limity z prognozą, aktywność, nadchodzące | A1 kropka zdrowia, A2 triage (zgłoszenia, spory z terminem, nieudane kodowania, odbicia, wątki PP Support, alerty), A3 KPI vs ta sama pora tydzień temu, A5 aktywność, A6 limity (Worker HLS x/100 tys., Resend x/100 i x/3000, R2, dysk, swap), A10 świeżość na każdym kaflu; tryb „Premiera na żywo”; poranny raport e-mailem | A4 teraz na stronie, A7 nadchodzące (premiera, domeny, tokeny), A8 najlepsze 48 h, A9 od ostatniej wizyty | – |
| **2 Analityka** | ruch i źródła, lejek i atrybucja, oglądalność, jakość odtwarzania | B1 odwiedzający/wizyty/odsłony, B2 źródła, B3 kraje, B6 lejek (wersja z liczbami z bazy), B7 atrybucja kont i napiwków, C1 obejrzenia, C2 czas oglądania, C7 czas startu p50/p95, C8 wyjścia przed startem, C9 błędy odtwarzania, C10 buforowanie, C14 ruch Workera HLS vs limit, C15 cache hit i kody `video.` | B4, B5, B8–B13 (urządzenia, strony, powroty, mapa godzin, linki kampanii, boty, 404, udostępnienia), C3 krzywa retencji (zbieranie MUST), C4, C6, C11–C13, C16–C20 | B14 kohorty, B15 wyszukiwania, C5 kluczowe momenty, C21 napisy |
| **3 Treści** | filmy (Przegląd, Analityka, Jakość, Edycja, Miniatury, Napisy, Historia), kalendarz i premiery, układ kanału, wgrywanie i kodowanie | D1 lista ze stanem, D2 upload i kodowanie na żywo, D3 kolejka kodowania z logiem, D4 pre-flight przed publikacją, D5 jeden formularz z historią, D6 premiery, D7 układ kanału (działający), D10 zbiórka, D12 podgląd jako widz; post-flight po publikacji | D6 kalendarz, D8 miniatury z podglądem, D9 napisy (#1219), D11 sieroty w R2 | D13 rozdziały, testy A/B miniatur |
| **4 Społeczność** | moderacja, komentarze, użytkownicy z profilem 360° | E1 kolejka moderacji z klawiszami, E2 komentarze z filtrami, E6 profil 360° (konto, 2FA, sesje, komentarze, wpłaty, e-maile, PP Support, audyt), E7 akcje na koncie (wycisz, zablokuj, wyloguj wszędzie, reset 2FA, RODO), E8 segmenty, E9 wzrost kont | E3 odpowiedź twórcy i serduszko, E4 pytania bez odpowiedzi, E5 ochrona przed spamem, E10 superfani | E11 streszczenia AI |
| **5 Przychody** | napiwki, lejek bramki, wspierający, zwroty i spory, Stripe | F1 przychód brutto/netto **jedną definicją** (`SUCCEEDED` + `PARTIALLY_REFUNDED`, netto), F2 lista, F3 lejek bramki, F4 zwroty ze step-up, F5 spory z terminem dowodów, F6 zdrowie webhooków, F7 rekonsylacja, F8 alert card testing, F9 eksport CSV | F10 wspierający, F11 saldo i wypłaty, F12 rozkład kwot, F13 atrybucja napiwku | F14 prognoza |
| **6 Komunikacja** | e-maile, rozsyłki, szablony, PP Support | G1 maile transakcyjne, G2 dostarczalność vs progi Resend, G3 limity, G4 rozsyłki (logika z #1636), G5 wypisy i blokady, G8 PP Support (liczby + link), G9 poczta przychodząca | G6 szablony z diffem, G7 DNS poczty, G10 powiadomienia w aplikacji (dzwonek usunięty decyzją 2026-10-04) | – |
| **7 System** | zdrowie i alerty, serwer i kontenery, baza, zadania i kopie, domeny/DNS/Cloudflare/R2, błędy i logi, deploye, koszty | H1 centrum zdrowia, H2 strażnik zewnętrzny, H3 serwer (CPU, RAM, swap, dysk), H4 kontenery, H5 9 zadań okresowych, H6 kopie (poza serwerem, test odtworzenia), H7 domeny i certyfikaty (RDAP), H9 deploye, H10 Cloudflare i tunel, H11 grupy błędów, H12 kolejki; diagnostyka R2 (dziś martwa trasa `r2-diagnostics`) | H8 zmiany DNS, H13 Postgres, H14 retencja tabel, H15 R2, H16 koszty, H17 czasy odpowiedzi, H18 Web Vitals, H19 logi, H20 aktualizacje, H21 prognoza pojemności | status page |
| **8 Bezpieczeństwo** | logowania i sesje, zdarzenia podejrzane, dziennik audytu | I1 logowania admina i sesje, I2 passkey/TOTP + step-up + Access, I3 nieudane logowania i blokady, I4 dziennik audytu z filtrami i eksportem | I5 403/429, I6 podejrzane zdarzenia, I7 CSP, I8 WAF, I9 inwentarz sekretów (same nazwy), I10 SSH, I11 rejestr żądań RODO | – |
| **Ustawienia** | kanał, płatności, alerty, integracje, konto admina | J1 kanał (nazwa, opis, avatar; bez okładki, usuniętej 2026-10-04), J2 progi płatności, J4 progi alertów i godziny ciszy, J5 stan integracji (bez wartości sekretów), J7 konto admina | J3 flagi w runtime, J6 baner i tryb konserwacji, J9 przekierowania | J8 teksty prawne |

Pełny katalog (ok. 140 pozycji z pytaniem właściciela, źródłem i odświeżaniem) i 23 narzędzia „o których właściciel nie pomyślał” są w raporcie 2 (§3, §4).

## 4. Plan budowy w fazach

Szacunki: faza 0 i 1 z raportów 2 i 3; podział fazy MUST z raportu 2 (3–5 tygodni łącznie) na fazy 2–4 jest mój.
Stary `/admin` działa bez zmian do fazy 5. Każda faza kończy się PR-em i aktualizacją tego pliku.

### Faza 0: fundament bezpieczeństwa i zbieranie danych (1–2 tygodnie)
- **Stan 2026-10-04:** zrobione w kodzie (PR) i na serwerze: telemetria (`admin-telemetry.md`), `job_run` ze wszystkich zadań i wdrożeń, kopie szyfrowane z bucket lock i cotygodniowym testem odtworzenia, `pg_stat_statements` (restart zaplanowany na noc), obrazy w GitHub Actions → GHCR (czeka na token `read:packages`), `hello@` poza Access, strażnik `pp-watchdog` (co 5 min, nie co 1 min: limit planu Free i decyzja „nic za pieniądze”). Zostaje dla właściciela: TOTP/passkey na kontach i decyzja o rolach `ADMIN` (STATUS.md pkt 4). Nie zrobione w tej fazie: metryki hosta i Cloudflare GraphQL w kolektorze, grupy błędów (T6), atrybucja (T11), liczniki bezpieczeństwa (T10), `requireAdminActor` z 2FA (najpierw 2FA na kontach).
- **Cel:** zamknąć dzisiejsze dziury i zacząć zbierać dane, których nie da się odtworzyć wstecz.
- **Zakres, bezpieczeństwo:** TOTP na kontach z rolą `ADMIN` albo zdjęcie roli z nieużywanych; `hello@` poza polityką Access dla `support.`; agent AI w PP Support bez wglądu w linki resetu i kody OTP; `requireAdminActor` wymaga `twoFactorEnabled` (minimalne ADM-04); budowa obrazów poza serwerem (GitHub Actions → GHCR → `docker pull` w `deploy.sh`); `pg_stat_statements`; solony `ipHash`.
- **Zakres, dane:** schemat `telemetry` i role; `job_run` z `cron-runner.sh`, `backup.sh`, `health.sh`, encodera; wpis deployu z `deploy.sh` (oś zmian, T8); rollup filmów przed pruningiem (T3); paczki i QoE w odtwarzaczu (T2, uzgodnić z gałęzią `fix/hls-audit`); `pp-collector` (T4, T7); grupy błędów z `instrumentation.ts` i `window.onerror` (T6); atrybucja (T11: `signupSource`, metadane intentu Stripe) i lejek bramki (T13); liczniki bezpieczeństwa (T10); Worker `pp-watchdog`. Beacon ruchu (T1) **dopiero po zmianie polityki prywatności**.
- **Kryterium ukończenia:** 7 dni ciągłych danych w `telemetry` (ruch, odtwarzanie, serwer, 9 zadań w `job_run`); watchdog wysłał alert testowy i wykrył wyłączony cron; wszystkie konta `ADMIN` mają 2FA albo nie mają roli; wdrożenie nie buduje obrazu na serwerze.
- **Stare zakładki:** żadna. **ADM znika:** ADM-04 (część: 2FA kont). **Testy:** uprawnienia ról Postgresa (`pp_collector` nie czyta domeny, nikt nie robi `DELETE` z `AuditLog`), rollupy na ustalonych danych, `/api/t` fail-open przy padniętym Redisie, solenie hasha.
- **Ryzyka:** RAM (kolektor 60–80 MB przy swapie 1,5 GB); prawo (polityka prywatności); dryf wskaźników (kontrola krzyżowa z Cloudflare GraphQL); limit minut CI dla prywatnego repo. **Zależności:** decyzje 1, 4, 6, 9 z sekcji 7.

### Faza 1: powłoka, logowanie, „Dzisiaj” i System, tylko odczyt (ok. 1–2 tygodnie)
- **Cel:** nowy panel daje wartość od pierwszego dnia bez ryzyka dla danych.
- **Zakres:** `apps/admin`, cel Dockerfile, `deploy.sh <tag> [app|admin|all]` z osobnym health i rollbackiem; Access + walidacja JWT; Better Auth panelu (passkey + TOTP), `admin-enroll.js`; `AuditLog` niezmienny z automatycznym kontekstem; powłoka z 8 pozycjami, Ctrl+K (wyszukiwanie obiektów), `?`, filtr czasu w URL, tryb ciemny, CSP panelu bez skryptów zewnętrznych. Ekrany: Dzisiaj (A1, A2, A3, A5, A6, A10), System (H1–H7, H9–H12), Bezpieczeństwo I1, I2.
- **Kryterium ukończenia:** wejście tylko przez Access + passkey; żądanie bez JWT odrzucone; każda strona renderuje się z serwera bez `loading.tsx`; panel działa przy padniętym wdrożeniu strony.
- **Stare zakładki:** pulpit `/admin` (zastąpiony przez Dzisiaj), diagnostyka R2 (do System). **ADM znika:** ADM-20, ADM-21 (w nowych ekranach), ADM-26, ADM-35, ADM-36 pkt 1, 7. **Testy:** Playwright z wirtualnym WebAuthn i seedowanym adminem; `Origin`/`Sec-Fetch-Site`; odrzucenie bez JWT; trigger `AuditLog`.
- **Ryzyka:** drugi build Next.js na 4 GB (stąd GHCR w fazie 0); independent MFA w Access Free do sprawdzenia. **Zależności:** faza 0 (GHCR, `job_run`, kolektor), decyzje 1–3, 5.

**Zmiana kolejności (właściciel, 2026-10-04):** nowy panel ma pokryć **wszystko**, co robi stary panel i cała obsługa
strony, nie tylko analitykę. Po fazie 1 zaraz idzie pełny CRUD treści i społeczności (faza 2), potem kanał,
płatności i komunikacja (faza 3); analityka (faza A) toczy się równolegle, bo czeka na 7+ dni danych z fazy 0.
Fazy 2 i 3 od razu przenoszą **odczyt i zapis** danej sekcji (bez osobnej „fazy tylko do odczytu”), więc sekcja
przechodzi na 308 do nowego panelu, gdy tylko jest gotowa. Każdy wiersz starego panelu ma swoje miejsce w
[`admin-parity.md`](admin-parity.md) (tabela funkcja → ekran → faza → status, 66 handlerów API, wszystkie przyciski).
Każda akcja przechodzi przez jeden wrapper `requireAdmin → zod (.strict) → limit → step-up → use case → audyt`.

### Faza 2: Treści i Społeczność, pełny CRUD (ok. 2 tygodnie)
- **Cel:** codzienna praca z filmami, komentarzami i ludźmi w całości w nowym panelu.
- **Zakres, Treści:** lista z filtrami i stroną w URL (D1); **nowy film** jako osobny ekran: metadane → wgranie oryginału (multipart, wznawianie) → kodowanie na żywo (D2, D3); **edycja wszystkich pól** w jednym formularzu (tytuł, slug, opisy PL/EN, dostęp, napisy PL/EN, miniatura z podglądem, premiera, pasek zbiórki: procent ręczny albo cel) z historią (D5, D6, D8, D9, D10); publikacja z pre-flight i post-flight (D4), cofnięcie publikacji, archiwizacja, przywrócenie, **usunięcie** (okno „Skutek”, wpisanie sluga), duplikat, Hero i sidebar, układ kanału (D7), podgląd jako widz (D12), wersje HLS (przekoduj, anuluj, usuń wersję). Jeden `PATCH` filmu, status tylko przez akcje, `updatedAt` → 409.
- **Zakres, Społeczność:** moderacja z klawiatury (E1; akcje zbiorcze jednym żądaniem, atomowe „rozwiąż z akcją”, „Cofnij”), komentarze z filtrami (E2), odpowiedź twórcy i serduszko (E3); użytkownicy: lista, szukanie, segmenty (E8), profil 360° z wpłatami, znacznikiem wspierającego, sesjami, e-mailami i audytem (E6), **zmiana roli** i **usunięcie konta z wpisaniem e-maila**, oba ze step-up; wycisz, wyloguj wszędzie (E7); eksport CSV ze step-up.
- **Kryterium ukończenia:** każdy wiersz sekcji 1.2–1.4 i odpowiadające trasy w `admin-parity.md` mają status „zrobione”; stare `/admin/videos*`, `/admin/comments*`, `/admin/users` (bez wpłat) przekierowują 308.
- **ADM znika:** ADM-01, 02, 03, 05, 06, 08, 09, 10, 11, 12, 13, 17, 18, 27, 28, 33, 34. **Testy:** Playwright (wirtualny WebAuthn): nowy film z wgraniem, premiera, moderacja klawiszami, usunięcie konta ze step-up; testy domeny dla jednej ścieżki zapisu filmu; CSV injection.
- **Ryzyka:** podwójne źródło zapisu, gdy stary panel nadal działa (przekierowanie sekcji zaraz po przeniesieniu). **Zależności:** faza 1.

### Faza 3: Kanał, Przychody, Komunikacja, Powiadomienia, Bezpieczeństwo (ok. 1–2 tygodnie)
- **Cel:** reszta obsługi strony: ustawienia, pieniądze, poczta, audyt.
- **Zakres:** Ustawienia → Kanał (nazwa, opis, banner i domyślna miniatura przez wgranie, konto kanału, przeliczenie subskrybentów; J1), Ustawienia → Płatności (minimalne kwoty; J2), progi alertów (J4), stan integracji bez sekretów (J5), konto admina (J7); Przychody: jedna definicja przychodu (F1), wpłaty z filtrami (F2), lejek bramki (F3), **zwroty ze step-up, powodem i kluczem idempotencji** (F4), spory z terminem (F5), webhooki (F6), rekonsylacja (F7), eksport (F9); Komunikacja: szablony z podglądem i różnicą względem domyślnych (G6), rozsyłki (kreator, test, step-up przed wysłaniem, anulowanie; G4), dostarczalność i limity (G1–G3), wypisy (G5), PP Support (G8); Powiadomienia w aplikacji: ekran gotowy, wysyłka wyłączona do decyzji o dzwonku; Bezpieczeństwo: logowania i sesje panelu (I1–I3), dziennik audytu z filtrami i eksportem (I4), rola bazy `pp_admin` i niezmienny `AuditLog`.
- **Kryterium ukończenia:** wszystkie wiersze `admin-parity.md` poza fazą A mają status „zrobione” albo „DROP”; zwrot w trybie testowym Stripe wymaga step-up.
- **ADM znika:** ADM-07, 14, 15, 16, 19, 22, 23, 29, 30, 36, 37, 38. **Testy:** Playwright: zwrot ze step-up, rozsyłka testowa; uprawnienia roli `pp_admin`.
- **Zależności:** faza 2 (wzorce formularzy i list), decyzja o dzwonku.

### Faza A: Analityka i tryb premiery (równolegle od fazy 2, ok. 1–2 tygodnie pracy)
- **Cel:** „wiem wszystko o ruchu i oglądaniu”.
- **Zakres:** Analityka B1–B3, B6 (z bazy), B7, C1, C2, C7–C10, C14, C15; film → Analityka i Jakość; tryb „Premiera na żywo” (SSE); poranny raport e-mailem; adnotacje z osi zmian na wykresach.
- **Kryterium ukończenia:** liczby z rollupów zgodne z surowymi danymi na danych testowych; ruch strony w granicach ±X% względem Cloudflare GraphQL (próg X: do ustalenia); SSE przeżywa 10 min przez tunel.
- **Testy:** rollupy, wzory QoE (startup 8/(8+s), płynność), ostrzeżenie przy małym n. **Zależności:** faza 0 (7+ dni danych), faza 1.

### Faza 5: wygaszenie starego panelu (2–3 dni, szacunek mój)
- **Zakres:** każda sekcja na `www` dostaje 308 na `admin.`; potem usunięcie `app/admin/**`, `app/api/admin/**`, `components/skeletons/admin.tsx`, martwego kodu z `lib/auth-utils.ts`; proxy zwraca 404 dla `/admin*` i `/api/admin*`; moderacja z `CommentItem.tsx` według decyzji 8; rola `ADMIN` na koncie publicznym tylko jako odznaka; `ADMIN_EMAILS` znika z kodu; aktualizacja `CLAUDE.md` §5.
- **Kryterium ukończenia:** obraz publiczny nie zawiera kodu ani tras admina (grep i test); żadna funkcja nie zginęła (każdy wiersz [`admin-parity.md`](admin-parity.md) „zrobione” albo „DROP”).
- **ADM znika:** ADM-24, 25, 31, 32. **Testy:** test, że `/api/admin/*` na `www` zwraca 404; testy statyczne „tekstu źródła” zastąpione mapą kontraktów.

### Paczki po starcie (SHOULD, 1–2 miesiące; LATER potem)
| Paczka | Zawartość |
|---|---|
| Oglądalność+ | C3 retencja z pasmem typowego filmu, C4, C6, C11–C13, C16–C20, D8 miniatury, D9 napisy |
| Ruch+ | B4, B5, B8–B13, Web Vitals (T12, H18), linki kampanii `/go/…` |
| Infrastruktura+ | H8, H13–H17, H19–H21, prognozy limitów i pasmo anomalii, koszty |
| Bezpieczeństwo+ | I5–I11, test odtworzenia kopii co tydzień (jeśli nie wcześniej) |
| Wygoda | PWA z pushami (iOS 16.4+), zapisane widoki, flagi w runtime (J3), kalendarz premier z checklistą promocji, notatnik na osi zmian, eksport wszystkiego |
| AI | streszczenia komentarzy, wykrywanie spamu (E5), szkice odpowiedzi w PP Support |
| LATER | asystent AI (pytanie → SQL na `pp_analytics_ro`), A/B miniatur, C5, B14, status page, tryb incydentu, F14, D13; GlitchTip/Umami tylko na drugim serwerze |

## 5. Poprawki w obecnym panelu, zanim powstanie nowy

Stary panel będzie w użyciu do fazy 5, więc warto naprawić tylko to, co jest tanie (S) i może zaszkodzić danym albo wprowadzić w błąd.
Szacunek łączny: ok. 2–3 dni pracy agenta (mój, z wag S/M z raportu 1).

| ID | Co | Dlaczego teraz | Nakład |
|---|---|---|---|
| ADM-02 | „Układ kanału”: Hero przez `set-hero`, `pageSize`→`limit`, kolejność jak w serwisie, wszystkie filmy | pokazuje sukces, a nie zapisuje; przestawia kolejność inaczej, niż widać | S |
| ADM-05 | `ConfirmDialog` z opisem skutku przy usunięciu komentarzy, cofnięciu publikacji, archiwizacji | operacje nieodwracalne albo zdejmujące Hero bez pytania | S |
| ADM-03 | przy statusie innym niż `PUBLISHED` nie walidować sidebaru | nie da się cofnąć do szkicu filmu z sidebaru | S |
| ADM-01 | paginacja w filmach, użytkownikach i wpłatach (stan strony, debounce, `AbortController`) | listy wracają na stronę 1 | S |
| ADM-06 | podpiąć `GET /videos/[id]/comments`, liczyć `playbackSessions`, usunąć odznakę bez danych | fałszywe „Brak komentarzy” i „0 sesji” | S |
| ADM-04 (min.) | `requireAdminActor` wymaga `twoFactorEnabled` (po włączeniu TOTP na kontach) | jedno skradzione ciasteczko = zwroty i rozsyłki | M |
| ADM-17 | toasty i stan `pending` w zgłoszeniach | błędy znikają w logach | S |
| ADM-18 | dashboard użytkowników nie pada przy błędzie API | TypeError zamiast strony | S |
| ADM-28, ADM-27 | walidacja `orderDir`; poprawne escapowanie CSV | 500 przy złym parametrze; CSV injection | S |
| ADM-16 | schować „Powiadomienia” z nawigacji (dzwonek usuwany decyzją 2026-10-04) | wysyłka do niewidocznego dzwonka, bez idempotencji | S |

Nie warto teraz (zrobi to przebudowa): ADM-08, 09, 11, 14, 19–22, 30, 31, 33.

## 6. Ryzyka i koszty

### 6.1 Koszty miesięczne

| Pozycja | Koszt | Uwagi |
|---|---|---|
| Cloudflare Access (Zero Trust Free, do 50 użytkowników) | 0 | logi Access tylko 24 h; independent MFA na Free: do ustalenia |
| Worker `pp-watchdog`, D1, Workers Analytics Engine | 0 | w darmowych limitach |
| Workers Paid | 5 USD | decyzja już podjęta „przy starcie” (STATUS); niezależna od panelu, ale zdejmuje wspólny limit 100 tys. żądań/dobę |
| Resend Pro | 20 USD od startu | decyzja już podjęta; alerty i poranny raport to 1–2 maile dziennie; na Free limit 100/dobę |
| UptimeRobot Free (opcjonalny drugi monitor) | 0 | – |
| Serwer dziś (CPX22) | ok. 24,59 €/mies. z VAT | `SERWEREK.md` |
| Powiększenie przy starcie | CX43 15,99 €, CPX32 35,49 €, EX44 57,30 € (netto) | opcje z `STATUS.md`; wybór do ustalenia |
| Klucze FIDO2 (jednorazowo, opcjonalnie) | do ustalenia | decyzja 5 |
| **Panel sam w sobie** | **0 USD/mies.** | koszt to RAM, dysk i czas budowy |

### 6.2 Wpływ na serwer

| Zasób | Dziś | Panel dodaje |
|---|---|---|
| RAM | 3809 MB, użyte 2165 MB, swap 1476 MB, `dockerd` ok. 1 GB RSS (anomalia do zbadania) | `admin` 150–250 MB (limit 384 MB) + `pp-collector` 60–80 MB |
| Dysk | 46/75 GB (64%), baza `polutek` 26 MB | telemetria: ok. 22 MB/mies. przy 10 tys. wizyt, ok. 1,2 GB/mies. przy 1 mln (surowe 90 dni: 70 MB / 3,6 GB) |
| CPU | 2 vCPU, jedno kodowanie naraz | znikomo: zapisy wsadowe co 2 s, ekrany tylko po agregatach |
| Żądania | dziś każde zdarzenie odtwarzacza to osobne żądanie | 1–3 żądania beaconu na odsłonę zamiast jednego na zdarzenie (mniej niż dziś) |

**Kolejność względem serwera:** (1) budowa obrazów poza serwerem (GHCR) jest twardym warunkiem drugiej aplikacji Next.js i i tak jest na liście przed startem;
(2) kolektor i zmiany telemetrii mieszczą się na CPX22 (faza 0); (3) kontener `admin` na CPX22 tylko z limitem pamięci i po (1);
(4) powiększenie serwera przy starcie, najlepiej przed pierwszą prawdziwą premierą w trybie „na żywo”. Najpierw zbadać 1 GB RSS `dockerd` (pozostałość po budowach).

### 6.3 Ryzyka

| Ryzyko | Skala | Ograniczenie |
|---|---|---|
| Pętla zaufania `hello@` → PP Support → token agenta AI (reset hasła, OTP Access) | wysoka, **istnieje dziś** | faza 0 |
| Konta admina bez 2FA (0/4) | wysoka, dziś | faza 0 i poprawka ADM-04 |
| Pamięć (swap 1,5 GB przy zerowym ruchu) | wysoka do powiększenia | GHCR, limity kontenerów, `dockerd` |
| Panel z dostępem do wszystkiego jako cel ataku | wysoka | 3 warstwy, step-up, brak skryptów zewnętrznych, niezmienny audyt, alerty logowań |
| Wspólny limit Workerów z innymi projektami na koncie (`kulfon`, `naszagazetka`, `kakaowy-sklepik`, `chmurka`) | średnia | Workers Paid przy starcie albo osobne konto (decyzja 11) |
| Analityka bez zgody | średnia | bez cookies, solony dzienny hash, retencja ≤ 25 mies., polityka prywatności, prawnik |
| Kopie: rclone dostaje 501, brak testu odtworzenia, brak alertu | średnia | `audit-ops.md` OPS-06/10; H6 i dead man's switch |
| Złożoność dla jednej osoby | średnia | jeden język i repo, bez Prometheusa/Grafany/ClickHouse/Sentry, runbook |
| Uzależnienie od Cloudflare (Access, Worker, D1) | średnia | awaria Access = brak dostępu, nie dziura; wejście awaryjne przez tunel SSH |

## 7. Decyzje dla właściciela

1. **Układ:** osobna aplikacja w tym samym repo (`apps/admin`) czy routing po hoście w obecnej aplikacji? *Rekomendacja:* osobna. *Konsekwencja:* +150–250 MB RAM i warunek budowy obrazów poza serwerem; w zamian osobne ciasteczka, CSP i wdrożenia.
2. **Tożsamość admina:** osobne konto panelu (passkey, bez resetu e-mailem, bez Google) czy rola na koncie publicznym? *Rekomendacja:* osobne. *Konsekwencja:* rola `ADMIN` na `www` staje się odznaką; moderacja „w miejscu” wymaga decyzji 8.
3. **Polityka Access:** tylko `pawel.perfect@gmail.com` z wymaganym kluczem/passkey; warunek „kraj = PL”? *Rekomendacja:* Gmail + MFA tak, kraju nie na start. *Konsekwencja:* z warunkiem kraju wyjazd wymaga wyjątku.
4. **Etap 0 teraz:** włączyć TOTP na kontach `ADMIN` (które to 4 konta: do ustalenia), zdjąć rolę z nieużywanych, usunąć `hello@` z polityki Access, ograniczyć agenta AI w PP Support. *Rekomendacja:* tak, przed czymkolwiek innym. *Konsekwencja:* bez tego reset hasła z `hello@` jest dziś czytelny dla tokenu agenta.
5. **Klucze sprzętowe:** 2 klucze FIDO2 czy passkey w telefonie + Windows Hello + kody zapasowe? *Rekomendacja (moja):* na start passkey w telefonie + Windows Hello + kody zapasowe, klucz sprzętowy jako zapas, gdy cena będzie znana. *Konsekwencja:* utrata telefonu i komputera naraz = odzyskanie przez SSH (`admin-enroll.js --reset`).
6. **Analityka bez zgody:** własny pipeline bez cookies (sól dzienna, surowe 90 dni, agregaty 25 mies.) i zmiana polityki prywatności z prawnikiem? *Rekomendacja:* tak. *Konsekwencja:* bez tego nie ma żadnych danych o ruchu (`@vercel/analytics` nic nie wysyła od przejścia na serwer); z tym trzeba poczekać z beaconem na nową politykę.
7. **Cloudflare Web Analytics:** naprawić CSP czy wyłączyć? *Rekomendacja:* wyłączyć (ruch krawędzi mamy z GraphQL). *Konsekwencja:* tracimy niezależny „drugi zegar” Web Vitals; naprawa CSP dokłada skrypt zewnętrzny na stronę.
8. **Moderacja na `www`** (`CommentItem.tsx` woła `/api/admin/comments/{hide,restore,heart}`): przenieść całość do panelu czy zostawić „serduszko autora”? *Rekomendacja:* przenieść całość (E3 daje odpowiedź i serduszko z panelu). *Konsekwencja:* na stronie publicznej nie zostaje żadne uprawnienie admina; ukrycie komentarza wymaga otwarcia panelu.
9. **Infrastruktura przed budową:** restart Postgresa (kilka sekund) dla `pg_stat_statements` w oknie serwisowym oraz budowa obrazów w GitHub Actions + GHCR? *Rekomendacja:* tak, oba w fazie 0. *Konsekwencja:* GHCR zużywa minuty CI prywatnego repo (testy mogą dalej iść na serwerze).
10. **Kopie zapasowe:** naprawić wysyłkę do R2 (nowy rclone, `rclone check`, bucket lock) i dodać cotygodniowy test odtworzenia? *Rekomendacja:* tak, w fazie 0 razem z `job_run`. *Konsekwencja:* test odtworzenia zajmuje chwilowo ok. 200 MB RAM nocą.
11. **Konto Cloudflare:** przenieść inne projekty na osobne konto czy dzielić limity do Workers Paid? *Rekomendacja:* przenieść. *Konsekwencja:* cudzy ruch nie wyłączy wideo i nie zajmie cron triggerów potrzebnych strażnikowi; wymaga przeniesienia Workerów i bucketów tamtych projektów.
12. **Zakres przed startem publicznym:** czy start czeka na wszystkie MUST (fazy 0–4), czy wystarczą fazy 0–1 + poprawki z sekcji 5? *Rekomendacja:* minimum fazy 0–1 + sekcja 5 przed startem, fazy 2–4 możliwie przed, najpóźniej tuż po. *Konsekwencja:* faza 0 jest obowiązkowa w każdym wariancie, bo bez niej pierwsze tygodnie po starcie przepadają bez danych.

## 8. Słownik i mapa dokumentów

| Pojęcie | Znaczenie |
|---|---|
| Access | Cloudflare Zero Trust Access: bramka logowania przed tunelem, zanim żądanie dojdzie do serwera |
| Passkey / TOTP | klucz kryptograficzny w urządzeniu (WebAuthn) / 6-cyfrowy kod z aplikacji |
| Step-up | ponowne potwierdzenie tożsamości tuż przed groźną operacją |
| `__Host-` | prefiks ciasteczka: tylko HTTPS, tylko ten host, nie da się go nadpisać z innej subdomeny |
| Beacon | małe żądanie wysyłane przez przeglądarkę w tle (`navigator.sendBeacon`), nie blokuje strony |
| Redis Stream | kolejka zdarzeń w Redisie; kolektor odbiera paczkami i zapisuje do bazy |
| Rollup | gotowy agregat (np. obejrzenia filmu na dzień) liczony co 5 min, z którego czyta ekran |
| Migawka | ostatni odczyt z zewnętrznego API zapisany w bazie z godziną (`external_snapshot`) |
| QoE | jakość odtwarzania: czas startu, wyjścia przed startem, błędy, buforowanie, rendycje (definicje Mux Data) |
| Dead man's switch | alert, gdy zadanie NIE zgłosiło się w oczekiwanym czasie |
| SSE | Server-Sent Events: jednokierunkowy strumień z serwera do przeglądarki, dla trybu „na żywo” |
| RDAP | następca WHOIS; daty wygaśnięcia domen (`rdap.dns.pl` dla .pl, Verisign dla .com) |
| MUST / SHOULD / LATER | przed startem / 1–2 mies. po starcie / później |
| ADM-xx | znalezisko z raportu 1 (obecny panel) |
| A1…J9, T1…T13 | funkcja i źródło danych z katalogu raportu 2 (§3) |

| Dokument | Co w nim jest |
|---|---|
| [`audit/2026-10-03/admin-vision-brief.md`](../audit/2026-10-03/admin-vision-brief.md) | brief: czego chce właściciel |
| [`audit/2026-10-03/admin-1-audit.md`](../audit/2026-10-03/admin-1-audit.md) | audyt obecnego panelu: inwentarz 16 stron i 63 handlerów, 38 znalezisk ADM-xx, KEEP/REWRITE/DROP |
| [`audit/2026-10-03/admin-2-research.md`](../audit/2026-10-03/admin-2-research.md) | porównanie produktów, katalog funkcji, 23 narzędzia, szkice ekranów, skróty |
| [`audit/2026-10-03/admin-3-architecture.md`](../audit/2026-10-03/admin-3-architecture.md) | układ aplikacji, logowanie, źródła danych, model `telemetry`, szacunki, etapy |
| [`audit/2026-10-03/audit-feat-admin.md`](../audit/2026-10-03/audit-feat-admin.md) | poprzedni audyt panelu (stara numeracja ADM, zastąpiony raportem 1) |
| [`audit/2026-10-03/audit-ops.md`](../audit/2026-10-03/audit-ops.md), [`audit-legal-privacy.md`](../audit/2026-10-03/audit-legal-privacy.md), [`audit-security.md`](../audit/2026-10-03/audit-security.md) | kopie i monitoring, analityka a prawo, bezpieczeństwo |
| [`design/admin-panel/`](../design/admin-panel/DESIGN-SYSTEM.md) | zatwierdzony prototyp i system projektowy (źródło wyglądu `apps/admin`) |
| [`operations/STATUS.md`](../operations/STATUS.md) | otwarte prace i decyzje właściciela |
| [`operations/SERWEREK.md`](../operations/SERWEREK.md), [`VIDEO-PIPELINE.md`](../operations/VIDEO-PIPELINE.md), [`SUPPORT-CENTER.md`](../operations/SUPPORT-CENTER.md), [`AGENT_ACCESS.md`](../operations/AGENT_ACCESS.md) | serwer i wdrożenia, kodowanie wideo, PP Support, dostępy agentów |
| [`architecture/auth-better-auth.md`](auth-better-auth.md), [`self-hosted-hls.md`](self-hosted-hls.md) | logowanie serwisu, własny HLS |
| `git show 88c787d0:docs/audit/2026-09-30-admin-backoffice-architecture.md` | stara analiza osobnego panelu (odłożonego 2026-09-30), materiał historyczny |
| [`operations/ADMIN-PANEL.md`](../operations/ADMIN-PANEL.md) | runbook panelu: wdrożenie, rejestracja administratora, reset, rollback, status hosta |

## 9. Faza 1: jak to jest zbudowane (2026-10-04)

Kod: `apps/admin` (aplikacja), `lib/modules/admin-overview` (odczyty dla ekranów), `prisma/migrations/20261004200000_add_admin_panel_auth`,
`deploy/serwerek/{Dockerfile.admin,deploy-admin.sh,admin/}`. Testy: `tests/unit/admin-app`, `tests/unit/admin-overview`,
`tests/postgres/admin-panel-auth.pg.test.ts`.

### 9.1 Decyzje techniczne (badanie 2026-10-04)

| Temat | Wybór | Dlaczego | Zmiana względem sekcji 2 |
|---|---|---|---|
| Układ repo | `apps/admin` jako **drugi katalog Next.js bez npm workspaces**: bez własnego `package.json`, używa wspólnego `node_modules` i jednego `package-lock.json`; budowa `next build apps/admin`, `turbopack.root` i `outputFileTracingRoot` = katalog repo ([Turbopack root](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack), [standalone w monorepo](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)). Kod wspólny przez alias `@/…` (ten sam co w serwisie), własny przez `@admin/…`. | Workspaces zmieniają lockfile, `npm ci` w obu Dockerfile'ach i w CI (osobne `package.json` musi być skopiowane przed instalacją), a niczego nie dają przy tych samych wersjach Next/React. Jedna instalacja = zero rozjazdu wersji. | sekcja 2 mówiła „npm workspaces”: zastąpione prostszym wariantem; `packages/core` dalej „później”. |
| Granice | Bramka `architecture boundaries` sprawdza `apps/admin`: tylko indeksy modułów (`@/lib/modules/<m>`, plus `shared`), **zakaz** `@/lib/auth`, `@/lib/api/auth`, `@/app/*`, `@/components/*`; Prisma tylko w `apps/admin/lib/auth`. `hotspots` obejmuje `apps/`. | Panel nie może przypadkiem użyć tożsamości strony ani jej UI. | nowe |
| Warstwa 1 (Access) | `proxy.ts` (Next 16, runtime Node) weryfikuje `Cf-Access-Jwt-Assertion` biblioteką `jose`: RS256, `iss` = zespół, `aud` = tag aplikacji, `exp`; klucze z `/cdn-cgi/access/certs` z pamięcią 10 min i odświeżeniem przy nieznanym `kid` ([Cloudflare](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)). Opcjonalna lista e-maili `ADMIN_ACCESS_EMAILS`. W produkcji bez `CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` każde żądanie dostaje 503 (fail closed). Jedyny wyjątek: `/api/health` (tylko `{ok:true}`, dla healthchecka kontenera). | Nawet źle ustawiony ingress tunelu albo wystawiony port nie wpuści bez Access. | zgodnie z planem |
| Warstwa 2 (sesja) | Osobna instancja Better Auth (`apps/admin/lib/auth/auth.ts`), własny sekret `ADMIN_AUTH_SECRET`, tabele `Admin*`, ciasteczko `__Host-ppadm.session_token` (host-only, `SameSite=Strict`, bez cache sesji). **Logowanie wyłącznie passkeyem** z weryfikacją użytkownika (`userVerification: required`, `rpID` = host panelu) ([passkey](https://better-auth.com/docs/plugins/passkey)). **Bez hasła, bez e-maila, bez Google, bez rejestracji.** TOTP + 10 kodów zapasowych ustawiane przy rejestracji (`allowPasswordless`, [2FA](https://better-auth.com/docs/plugins/2fa)); TOTP służy do step-up. Sesja: bezczynność 60 min (przesuwne okno), twardo 12 h od logowania (sprawdzane w `requireAdmin()`, sesja jest wtedy unieważniana). Wyłączone ścieżki Better Auth: zmiana e-maila/hasła, usuwanie konta, wyłączanie 2FA, usuwanie passkeyów (wszystko to robi `admin-enroll --reset`). | Najmniej sposobów wejścia = najmniej ataków; passkey jest odporny na phishing; utrata urządzeń = SSH. | sekcja 2 dopuszczała hasło z obowiązkowym 2FA: wybrano wariant bez hasła. |
| Rejestracja | `apps/admin/scripts/admin-enroll.mjs` (zwykły ESM, działa w obrazie standalone): tworzy `AdminUser`, link jednorazowy 15 min w **fragmencie URL** (`/rejestracja#t=…`, nie trafia do logów ani Referer), w bazie tylko SHA-256 tokenu; `--reset` usuwa sesje, passkeye, TOTP i niewykorzystane linki. Strona rejestracji: wykorzystanie linku → TOTP (QR + klucz ręczny + kody zapasowe, kod weryfikujący) → passkey → „Zakończ” (`enrolledAt`). Niedokończona rejestracja nigdy nie jest zaufana: nowy link kasuje to, co poprzedni zdążył dodać. | Korzeń zaufania = SSH, nic nie idzie e-mailem. | `scripts/admin-enroll.js` → `apps/admin/scripts/admin-enroll.mjs` |
| Step-up | `requireStepUp()` + ekran `/potwierdz`: ponowne logowanie passkeyem (nowa sesja) albo kod TOTP potwierdzony na bieżącej sesji (`AdminSession.stepUpAt`, 5 błędów = blokada 15 min). Ważne 5 min. W fazie 1 tylko mechanizm i ekran; pierwsze akcje, które go wymagają, przychodzą w fazie 4. | jak w planie | – |
| Audyt logowań | Nowa tabela **`AdminAuthEvent`**: tylko dopisywanie (trigger odrzuca `UPDATE`, `DELETE` młodszych niż 400 dni i `TRUNCATE`), łańcuch `hash = sha256(prevHash ‖ wiersz)` pod blokadą doradczą; IP z `CF-Connecting-IP`, kraj, UA, `cf-ray`. Zdarzenia: wydanie/reset/wykorzystanie linku, rejestracja, logowanie (też nieudane), step-up, wylogowanie, wygaśnięcie 12 h, dodanie passkeya i TOTP. | `AuditLog` nie może być niezmienny już teraz: cron `retention` anonimizuje w nim IP po 90 dniach. | „`AuditLog` niezmienny” zostaje na później (faza 3, razem z rolą `pp_admin`). |
| CSRF i nagłówki | Każda mutacja: `Origin` = dokładnie origin panelu, `Sec-Fetch-Site` (jeśli jest) = `same-origin`. CSP z nonce na żądanie: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'nonce-…'` (zero atrybutów `style=` w znacznikach; szerokości i wysokości przez klasy skali `scale.css`), `connect-src 'self'`, `frame-ancestors 'none'`, `base-uri 'none'` ([Next CSP](https://nextjs.org/docs/app/guides/content-security-policy)); do tego HSTS, COOP/CORP same-origin, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`. Wszystkie strony dynamiczne (nonce wymaga renderu na żądanie). | Zero skryptów i czcionek z zewnątrz; panel działa bez `unsafe-inline`. | zgodnie z planem |
| Wykresy | Własne komponenty: kolumny w HTML/CSS (zaokrąglone końce, ≤ 24 px, siatka, oś), sparkline w SVG z `vector-effect: non-scaling-stroke`, licznik z `role="meter"`; podpowiedź tylko uzupełnia, obszar wykresu czytany strzałkami, pod każdym wykresem prawdziwa tabela danych. **Bez uPlot/Recharts.** | Rysowane na serwerze w pełnej szerokości (bez mierzenia i bez szkieletu), zgodne z CSP bez stylów inline, ~0 kB zależności; uPlot rysuje na canvasie dopiero po pomiarze w przeglądarce. | wybór z DESIGN-SYSTEM.md §8 |
| Dane ekranów | Komponenty serwerowe czytają `lib/modules/admin-overview` (zapytania ograniczone oknem czasu albo `take`). Sondy własnych usług (strona `/api/health` po sieci Dockera, Redis REST `PING`, `HEAD` do Workera HLS) z twardym limitem 1,5 s i pamięcią 60 s (stale-while-revalidate). Żadnych wywołań API Stripe/Cloudflare/Resend przy renderze. Brak danych = jawny stan „bez pomiaru”, nigdy zero. | Panel nie jest ślepy i nie czeka na zewnętrzne API. | zgodnie z planem |
| Host bez `docker.sock` | Zadanie na hoście `deploy/serwerek/admin/host-status.py` (systemd, co minutę, root) zapisuje **jeden plik JSON** (kontenery z `docker inspect/stats`, wynik i termin timerów `polutek-cron-*`, ostatnia kopia, `backup.sh`/`health.sh`); kontener panelu montuje tylko ten katalog tylko do odczytu. RAM, swap, dysk i obciążenie panel czyta sam (`/proc/meminfo`, `statfs`, `loadavg` w kontenerze opisują hosta). | Gniazdo Dockera (nawet „ro”) daje pełną kontrolę nad hostem; plik nie daje żadnej. Kolektor z fazy 0 może pisać ten sam format (wersja 1) albo go zastąpić. | nowe |
| Na żywo (SSE) | Faza 2. Plan: Route Handler z `ReadableStream`, zdarzenia co 2–5 s, komentarz keep-alive co 25 s (Cloudflare zamyka bezczynne połączenie po ok. 100 s, [524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)), przycisk „Wstrzymaj” (WCAG 2.2.2). | – | – |
| Wdrożenie | Osobny obraz `polutek-admin:<tag>` (`Dockerfile.admin`, standalone ok. 106 MB plików), usługa `admin` w `docker-compose.yml` z **profilem `admin`** (nie startuje przy `deploy.sh` ani zwykłym `docker compose up`), `127.0.0.1:3100`, `mem_limit: 384m`, `read_only`, `cap_drop: ALL`, `no-new-privileges`. Osobny `deploy-admin.sh <tag> [--rollback|--stop]` z własnym health i rollbackiem; migracje robi zwykły `deploy.sh`. | Panel i strona wdrażane i wycofywane niezależnie. | `deploy.sh <tag> [app|admin|all]` → osobny skrypt (żeby nie kolidować z przebudową `deploy.sh` pod GHCR w fazie 0). |

### 9.2 Co jest w fazie 1

- Powłoka 1:1 z zatwierdzonego prototypu: pasek boczny (8 modułów + Premiera + Ustawienia, liczniki), górny pasek
  (paleta Ctrl/⌘+K z wyszukiwaniem filmów, osób i płatności, okres i porównanie w URL, kropka zdrowia z
  podglądem, motyw jasny/ciemny/systemowy bez mignięcia, konto z wylogowaniem), dolny pasek i szuflada na telefonie,
  skróty `g`+litera, `?`, `/`, `[` `]`, Esc, toasty, link „Przejdź do treści”, fokus na `h1` po zmianie ekranu.
- **Dzisiaj**: baner zdrowia, 6 kafli z porównaniem (napiwki netto jedną definicją, wpłaty, nowe konta, komentarze,
  obejrzenia, zgłoszenia) i sparkline, „Wymaga uwagi” (spory, nieudane kodowania bez późniejszego sukcesu, webhooki
  Stripe, moderacja, zawieszone wpłaty, błędy rozsyłek), wykres napiwków w okresie, aktywność, limity serwera,
  stan systemu, kolejka kodowania, nadchodzące premiery i rozsyłki. Akcje z „Wymaga uwagi” otwierają stary panel.
- **System**: centrum zdrowia (11 kontroli z wiekiem pomiaru), kolejki, serwer (CPU/RAM/swap/dysk/czas pracy),
  kontenery i zadania z pliku statusu hosta, kopie, proces panelu, Postgres, domeny i koszty (z dokumentacji, z datą stanu).
- Pozostałe moduły: uczciwe strony „w budowie, faza N” z zakresem i linkami do starego panelu; Ustawienia mają
  działający wybór motywu.
- Bez danych telemetrii (ruch, QoE): to faza 2.

### 9.3 Czego faza 1 nie robi (świadomie)

- Nie zastępuje jeszcze `ADMIN_EMAILS` ani roli `ADMIN` na `www` (stary panel działa do fazy 5).
- Rola bazy `pp_admin`: panel łączy się tym samym użytkownikiem co strona; osobna rola razem z niezmiennym `AuditLog`.
- Playwright z wirtualnym WebAuthn: Playwright jest w repo, ale w CI nie ma przeglądarek ani bazy dla tego testu;
  logika rejestracji i step-up jest pokryta testami jednostkowymi i testem na prawdziwym Postgresie.
- Niezależne MFA w Cloudflare Access (plan Free) i polityka tylko dla Gmaila ustawia właściciel przy wdrożeniu.
