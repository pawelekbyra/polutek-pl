# Panel administratora, faza A: Analityka i tryb premiery

Stan: 2026-10-05, gałąź `feat/pA-analityka`, **zbudowane w kodzie, niewdrożone**. Plan: [`admin-panel.md`](admin-panel.md) §4 „Faza A”.
Dane wejściowe: [`admin-telemetry.md`](admin-telemetry.md) (schemat `telemetry`, kolektor, beacon). Wygląd: [`../design/admin-panel/DESIGN-SYSTEM.md`](../design/admin-panel/DESIGN-SYSTEM.md).
Zasada tego dokumentu: co jest w kodzie, co uruchomiono, czego nie dało się sprawdzić (sekcja 9).

## 1. Co zbudowano

| Ekran / mechanizm | Adres | Funkcje z katalogu | Dane |
|---|---|---|---|
| Ruch i źródła | `/analityka` (`?tab=ruch`) | B1 odwiedzający i odsłony, B2 źródła i kampanie, B3 kraje, kontrola krzyżowa z Cloudflare | `r_traffic_hourly`, `r_traffic_daily`, `r_traffic_extra_daily`, `r_video_qoe_daily` (obejrzenia) |
| Lejek i atrybucja | `?tab=lejek` | B6 lejek z liczb w bazie, B7 atrybucja (część: patrz 7) | baza serwisu (`User`, `Comment`, `Payment`) + telemetria |
| Oglądalność | `?tab=ogladalnosc` | C1 obejrzenia, C2 czas oglądania, retencja filmu z pasmem „typowy film” | `r_video_*`, `r_video_daily.retention` |
| Jakość odtwarzania | `?tab=jakosc` | C7 czas startu p50/p95, C8 wyjścia przed startem, C9 błędy wg typu, C10 buforowanie i rendycje, C14/C15 (interfejs, bez danych) | `r_video_qoe_daily`, `r_playback_*`, `external_snapshot` |
| Film → Analityka | `/tresci/<slug>/analityka` | obejrzenia, widzowie, retencja filmu | jak wyżej, filtr po `video_id` |
| Film → Jakość | `/tresci/<slug>/jakosc` | QoE jednego filmu, ostrzeżenie o małej próbie | jak wyżej |
| Premiera na żywo | `/premiera`, strumień `GET /api/live` | widzowie teraz, czas startu p95, błędy/min, serwer, napiwki i komentarze, prognoza Workera, „Wstrzymaj” | surowe wiersze z okna 30 min, baza serwisu |
| Poranny raport | `GET/POST /api/jobs/morning-report` | zbudowany, **WYŁĄCZONY** | jak wyżej, wczorajsza doba |
| Adnotacje | na każdym wykresie czasu | oś zmian: wdrożenia (`job_run`) i publikacje filmów | `job_run`, `Video.publishedAt` |

Moduł: `lib/modules/admin-analytics` (domena: `histogram`, `qoe`, `retention`, `series`, `funnel`; aplikacja: przypadki użycia, `live-hub`; infrastruktura: SQL, Prisma, cache SWR). Tylko odczyt. Ekrany w `apps/admin` czytają wyłącznie ten moduł (bramka `architecture boundaries` przechodzi).

Zmiany w plikach wspólnych (minimalne): filtr okresu w pasku górnym działa teraz także na `/analityka` i kartach filmu (wcześniej odsyłał zawsze na `/`), nowa zakładka „Analityka” i „Jakość” w `FilmTabs`, `analityka` i `premiera` zniknęły z listy „w budowie”, `compress: false` w `next.config.mjs`, `no-transform` w nagłówku `cache-control` tras API (proxy), jeden wpis w `lib/modules/email/index.ts` (`sendOperatorEmail`), sekcja w `CLAUDE.md` §4.20, zmienne w `.env.example`.

## 2. Definicje metryk

Wszystko w strefie Europe/Warsaw (doby), godziny w UTC (przesunięcie Polski to zawsze pełne godziny, więc granice godzin są wspólne).

| Metryka | Definicja | Uwaga |
|---|---|---|
| Odwiedzający | suma **dobowych** unikalnych (dzienny solony skrót, bez ciasteczek) | osoba, która wraca drugiego dnia, liczy się dwa razy; unikalności nie da się dodawać między godzinami |
| Odsłona | jedno `page_view` | bez botów i bez GPC/DNT, więc mniej niż Cloudflare |
| Wizyty, odrzucenia, czas wizyty | **nie ma** (brak sesji z założenia) | zastępnik „odrzuceń”: odsetek odwiedzających z jedną odsłoną w dobie (`r_traffic_extra_daily`) |
| Obejrzenie | start odtwarzania z ≥ 10 s oglądania (`VIEW_MIN_WATCH_MS`) | ta sama definicja co licznik wyświetleń strony |
| Start | próba z pierwszą klatką | |
| Czas oglądania | suma `watch_ms` | próba, która przekracza północ, jest liczona w dwóch dobach (jak w istniejących rollupach) |
| Czas startu | od żądania odtworzenia do pierwszej klatki, tylko starty | percentyle z histogramu (sekcja 3) |
| Wynik startu (0–100) | `100 · 8 / (8 + s)`, s w sekundach: 0,4 s → 95, 2 s → 80, 8 s → 50, 20 s → 29 | definicja Mux Data [1]; uśredniany po próbach (suma wyników per próba liczona w SQL) |
| Udział buforowania | `rebuffer_ms / (watch_ms + rebuffer_ms)` | 0, gdy nic nie zagrano |
| Wynik płynności (0–100) | średnia z `100/√(1+(przerwy/2)²)` i `100·e^(−10·udział buforowania)` | definicja Mux Data [2]; liczony **per próba** w SQL i uśredniany |
| Wynik niezawodności | `100 · (1 − próby z błędem krytycznym / próby)` | |
| Wynik doświadczenia widza | średnia arytmetyczna trzech wyników powyżej | **nasza** kompozycja; Mux ważąc inaczej [3] |
| Wyjścia przed startem | próby z `exited_before_start` bez startu / wszystkie próby | |
| Błędy | próby z jakimkolwiek `error_code` / wszystkie próby; krytyczne osobno | klasy: `hls:<typ>:<szczegół>`, `media:<kod>`; maks. 30 klas na film i dobę |
| Rendycja | najwyższa wysokość obrazu osiągnięta w próbie, kubełki 240/360/480/720/1080/1440/2160/4320, 0 = brak danych | odtwarzacz nie raportuje czasu w każdej jakości, więc to **nie** udział czasu oglądania |
| Retencja | `retention[k] / starty · 100` dla k = 0..99: odsetek startów, które obejrzały k-ty procent filmu; kilka dób sumuje się liczbami | powtórki tego samego fragmentu liczą się raz na próbę; wartość przycięta do 100% [4] |
| Pasmo „typowy film” | 25.–75. percentyl krzywych **innych** filmów z ≥ 30 startów, tylko gdy takich filmów jest ≥ 3 | inaczej brak pasma, bez atrapy |
| Mała próba | `n < 30` prób (`LOW_N_ATTEMPTS`): ostrzeżenie „Mała próba: n = …”; brak prób = „bez pomiaru” | p95 przy < 20 startach opisane jako orientacyjne |
| Lejek | wejścia (telemetria) → nowe konta → kohorta: z kont założonych w okresie ile **kiedykolwiek** skomentowało / wpłaciło | procent to przejście z poprzedniego kroku; krok bez pomiaru nie daje procentów następnym |

**Zasada „bez pomiaru”:** brak wiersza w rollupie wewnątrz okresu objętego telemetrią to 0 (rollup tworzy wiersz tylko, gdy coś się zdarzyło), ale przedział przed pierwszą dobą telemetrii to `null` i wykres pokazuje przerwę, a kafel napis „bez pomiaru”. Porównanie z poprzednim okresem pokazujemy tylko wtedy, gdy cały poprzedni okres był zmierzony. Doba bez żadnej próby odtwarzania nie ma p95 (`null`, nie 0).

## 3. Rollupy (SQL)

Migracja `prisma/migrations/20261005120000_analytics_rollups` (tylko dodająca, idempotentna; test statyczny `tests/unit/admin-analytics/migration.test.ts` pilnuje braku `DROP`/`TRUNCATE`/`ALTER TABLE`, `IF NOT EXISTS` i zgodności krawędzi histogramu z kodem).

| Tabela | Klucz | Treść |
|---|---|---|
| `r_traffic_hourly` | godzina UTC | odsłony, unikalni w godzinie |
| `r_traffic_extra_daily` | doba | odwiedzający, odwiedzający z jedną odsłoną |
| `r_video_hourly` | godzina, film | próby, starty, obejrzenia, wyjścia, błędy, czas oglądania, buforowanie, widzowie (próba należy do godziny pierwszego sygnału) |
| `r_video_qoe_daily` | doba, film | obejrzenia, próby z buforowaniem, przełączenia, bitrate, **histogram czasu startu** (`int[13]`), sumy wyników startu i płynności |
| `r_playback_total_daily` | doba | widzowie kanału (unikalni, nie sumowalni po filmach) i histogram kanału |
| `r_playback_error_daily` | doba, film, klasa | próby i błędy krytyczne |
| `r_playback_ladder_daily` | doba, film, wysokość | próby |
| `external_snapshot` | źródło, rodzaj, czas | migawki zewnętrzne (sekcja 7), pisze je przyszły kolektor |

Funkcje: `telemetry.startup_histogram(int[])` (krawędzie 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 12000, 20000 ms, `width_bucket` z tablicą progów [5]; te same stałe w `domain/histogram.ts`), `telemetry.playback_attempts(lo, hi)` (jedna próba = złączone dawki beaconów, reguły jak w `rollup_day`), `telemetry.rollup_analytics_day(day)` (kasuje i wstawia wiersze doby, po czym czyści stare: godzinowe 120 dni, dobowe 25 miesięcy).

**Podpięcie bez przebudowy kolektora.** Kolektor co 5 minut woła `telemetry.rollup_day(dzisiaj/wczoraj)`. Migracja zmienia nazwę starej funkcji na `rollup_day_core` (strzeżone, więc ponowne uruchomienie niczego nie przemianuje) i tworzy nowe `rollup_day`, które woła `rollup_day_core` i `rollup_analytics_day`. Dzięki temu rollupy ruszają zaraz po migracji. **Ryzyko:** późniejsza migracja, która zrobi `CREATE OR REPLACE FUNCTION telemetry.rollup_day` ze starą treścią, wyłączy nowe rollupy po cichu; test `tests/postgres/analytics-rollups.pg.test.ts` to wychwyci (nowe tabele przestaną się wypełniać).

**Przed przycinaniem surowych danych.** Surowe wiersze trzymamy 90 dni, `rollup_day` przelicza tylko dziś i wczoraj, więc dobę rolluje się setki razy zanim surowe wiersze znikną. Migracja robi też **jednorazowe uzupełnienie wstecz** z tego, co jest w surowych tabelach (maks. 100 dni; ponowne uruchomienie przelicza te same doby).

**Percentyle bez przybliżania średnich.** Percentyl kilku dób albo filmów nie składa się z percentyli. Histogram o stałych krawędziach sumuje się dokładnie; p50/p95 czytamy interpolacją liniową w przedziale z docelową pozycją (`histPercentile`), błąd ≤ szerokość przedziału (np. 1000–1500 ms: ≤ 500 ms). Alternatywa `percentile_cont` na surowych wierszach odpadła: surowe dane znikają po 90 dniach, a zapytanie skanowałoby miliony wierszy.

**Rozumowanie o planach zapytań (EXPLAIN „na papierze”; nie uruchomiono, brak Postgresa lokalnie).**
- Zakresy dobowe: wszystkie nowe tabele dobowe mają `day` jako pierwszą kolumnę klucza, więc `day BETWEEN a AND b` to Index Scan po prefiksie; 90 dób × liczba filmów (jeden twórca, rząd dziesiątek) = kilka tysięcy wierszy. Zapytania o jeden film korzystają z nowych indeksów `(video_id, day)` i `(video_id, hour)`.
- `trafficDimension`: klucz `r_traffic_daily` to `(day, dimension, value)`; dla każdej doby podzakres `dimension = …` jest ciągły; najgorszy przypadek to 90 × 1000 wartości (limit 1000 na wymiar i dobę z `rollup_day`), a `GROUP BY value` na 90 tys. wierszy mieści się w `statement_timeout` 5 s roli `pp_analytics_ro`.
- Tryb na żywo czyta surowe `playback`/`page_view` tylko z okna 30 minut (`ts > teraz − 30 min`): partycje miesięczne są przycinane po `ts`, BRIN na `ts`; `count(DISTINCT …)` na co najwyżej dziesiątkach tysięcy wierszy. Jeden zbiór zapytań co 3 s dla wszystkich otwartych kart (hub), niezależnie od liczby przeglądarek.
- Kohorta lejka: `User.createdAt` w oknie + `EXISTS` na `Comment`/`Payment` (`Payment.userId` ma indeks; `Comment.authorId` nie ma, ale tabele są małe, a okno ogranicza liczbę kont; indeks nie jest wart osobnej zmiany schematu Prismy).
- Wszystkie zapytania mają `LIMIT` albo ograniczenie czasowe; panel nie czyta surowych tabel poza trybem na żywo.

## 4. Tryb „Premiera na żywo” (SSE)

- **Trasa** `GET /api/live[?video=<slug|id>]`: Cloudflare Access (proxy), sesja administratora (jak każda trasa panelu), walidacja klucza filmu. Odpowiedź `text/event-stream`, `cache-control: private, no-store, no-transform`, `x-accel-buffering: no`. `compress: false` w `next.config.mjs`, bo kompresja origin buforowałaby strumień (Cloudflare i tak kompresuje na krawędzi).
- **Zdarzenia:** `snapshot` co 3 s (`LIVE_INTERVAL_MS`), pierwszy od razu po połączeniu; `retry: 5000`; `problem`, gdy odczyt się nie powiedzie.
- **Keep-alive:** komentarz `: keep-alive` co **25 s** niezależnie od zdarzeń. Cloudflare zamyka połączenie bez żadnych bajtów po ok. 100 s (błąd 524) [6][7]; przy zdarzeniach co 3 s i komentarzu co 25 s cisza nigdy nie przekracza 25 s. Test symuluje 10 minut zegarem testowym i sprawdza ≥ 24 komentarze i ciągłość zdarzeń; **przez prawdziwy tunel nie sprawdzono** (sekcja 9).
- **Pamięć i obciążenie:** jeden wspólny „hub” na film (jeden odczyt na 3 s dla wszystkich kart); start przy pierwszym słuchaczu, stop przy ostatnim, brak nakładających się odczytów; maks. 3 huby i 4 słuchaczy na hub (inaczej 503 „Za dużo otwartych podglądów”). Kolejka strumienia ma `highWaterMark` 4: **powolny klient dostaje pominięte migawki** zamiast nieograniczonej kolejki (następna przychodzi po kilku sekundach). Strumień kończy się sam po 30 minutach (`MAX_LIFETIME_MS`): przeglądarka łączy się ponownie (`EventSource`), co sprawdza sesję od nowa. `abort` żądania zwalnia timery i subskrypcję (test `vi.getTimerCount() === 0`).
- **Dostępność:** przycisk „Wstrzymaj odświeżanie” zamyka strumień i zamraża liczby do „Wznów” (WCAG 2.2.2 [8]); liczby nie są odczytywane przy każdej zmianie (`aria-live="off"`), komunikat roli `status` mówi tylko o stanie połączenia; 15 s ciszy pokazuje ostrzeżenie; `prefers-reduced-motion` wyłącza pulsowanie (CSS panelu).
- **Zawartość:** widzowie (unikalni z sygnałem w ostatnich 90 s, bo odtwarzacz wysyła paczki co 30–60 s), czas startu p95 z 5 minut (z liczbą startów i ostrzeżeniem), błędy w ostatniej pełnej minucie i odsetek prób z błędem, odsłony/min, obciążenie hosta (te same pomiary co „System”), napiwki i komentarze od premiery (albo z ostatniej godziny), limit Workera HLS, gdy istnieje migawka. Cel: film z `premiereAt` w ±24 h najbliższy teraz, inaczej cały kanał.
- Przy wygasłej sesji Access ponowne połączenie `EventSource` dostanie przekierowanie/403 i będzie ponawiać; panel pokaże „połączenie przerwane, ponawiam” (przeglądarka nie podaje kodu odpowiedzi). Odświeżenie strony loguje na nowo.

## 5. Poranny raport

Zbudowany (`buildMorningReport`, `runMorningReport`), **wyłączony domyślnie**: wysyła tylko przy `ADMIN_MORNING_REPORT=on` **i** poprawnym `ADMIN_MORNING_REPORT_TO`; w każdym innym stanie wynik to `disabled` i transport poczty nie jest wywoływany (test pilnuje 4 wariantów). Transport jest wstrzykiwany: testy używają atrapy, prawdziwy to `sendOperatorEmail` (moduł `email`, Resend). `GET /api/jobs/morning-report` = podgląd JSON dla zalogowanego administratora (nigdy nie wysyła); `POST` wysyła, o ile flaga włączona; autoryzacja sesją administratora albo `Authorization: Bearer ADMIN_JOBS_TOKEN` (≥ 32 znaki, porównanie w stałym czasie), zawsze po Cloudflare Access i sprawdzeniu `Origin`. Klucz idempotencji `morning-report-<doba>` (Resend deduplikuje 24 h). Treść: wczorajsza doba (Warsaw) na tle poprzedniej doby i tej samej doby tydzień wcześniej, odwiedzający, odsłony, obejrzenia, p95 startu, błędy, nowe konta, napiwki (liczba), wdrożenia, 3 najczęściej oglądane filmy; każdy brak to „bez pomiaru”, mała próba ma ostrzeżenie. **Harmonogram nie jest podpięty** (żaden timer ani cron): zob. wdrożenie.

## 6. Adnotacje z osi zmian

`buildAnnotations`: wdrożenia z `telemetry.job_run` (`job IN ('deploy','deploy-admin')`, `status = 'ok'`) i publikacje filmów (`Video.publishedAt`, a dla premiery jej godzina) w oknie bieżącego okresu, maks. 12. Wykres rysuje numerowane znaczniki i przerywane linie, a pod wykresem jest lista tekstowa (czytniki ekranu). Etykieta wdrożenia zawiera pierwsze 80 znaków `detail` (`<tag> (<źródło>): <komunikat>`), bez sekretów.

## 7. Cloudflare i dane krawędzi (interfejs, bez danych)

C14 (ruch Workera HLS względem 100 tys./dobę) i C15 (cache hit, kody 403/404/5xx na `video.`) oraz kontrola krzyżowa ruchu **nie mają jeszcze źródła**: moduł kolektora odpytujący Cloudflare GraphQL nie istnieje, a panel z założenia nie woła Cloudflare przy renderze (brak sekretów, brak sieci). Zaprojektowany interfejs: kolektor wstawia wiersze do `telemetry.external_snapshot (source = 'cloudflare', kind, fetched_at, payload)`, panel czyta najnowszy wiersz każdego rodzaju, waliduje zodem (`application/edge.ts`) i pokazuje wiek. Kształty ładunków:

| `kind` | `payload` |
|---|---|
| `hls_worker_hourly` | `{ day: "YYYY-MM-DD" (UTC), requests: n, hourly: [{ hour, requests }] (maks. 48) }` |
| `edge_video_daily` | `{ day, cacheHitPct: 0..100, status403, status404, status5xx }` |
| `edge_www_daily` | `{ day (Warsaw), documentRequests }`: żądania dokumentów HTML `www` z botami |

Dopóki wiersze nie istnieją, ekrany piszą „bez pomiaru” z przyczyną i nigdy zero. Kontrola krzyżowa: odchylenie `(własne odsłony − documentRequests) / documentRequests` dla zakończonej doby, domyślna granica **±30%** (`ADMIN_EDGE_TOLERANCE_PCT`; to **decyzja robocza**: własne liczby są niższe z natury, bo kolektor odrzuca boty i GPC/DNT; właściwy X do ustalenia po tygodniu porównań). Prognoza wyczerpania limitu Workera: tempo z ostatnich 3 godzin (`workerLimitForecast`).

**B7, atrybucja per źródło:** nie da się policzyć uczciwie: źródło konta ani napiwku nie jest zapisywane (T11 nie jest zbudowane), a telemetria celowo nie łączy wizyt z kontami (admin-telemetry.md §2). Panel pokazuje kohortowy lejek i dzienne serie kont i napiwków, a atrybucja ma kartę z przyczyną. Dokończenie wymaga zapisu pierwszego źródła w serwisie (np. `User.signupSource` z `utm_*` i referera przy rejestracji oraz klucz w metadanych intentu Stripe): to zmiana w logowaniu i płatnościach, poza zakresem tej fazy.

## 8. Prywatność

Niczego nie dodano po stronie odwiedzającego ani w danych: nowe tabele mają tylko liczniki, histogramy i liczby unikalnych (liczba, nie identyfikator); żadnych skrótów odwiedzających, `ip`, `userId`. Panel nie pokazuje pojedynczych widzów (tryb na żywo: liczba unikalnych w 90 s). Retencja: nowe agregaty godzinowe 120 dni, dobowe 25 miesięcy (jak istniejące, limit CNIL), migawki zewnętrzne 400 dni; surowe 90 dni bez zmian. Rola `pp_analytics_ro` dalej tylko czyta i nie widzi soli (test statyczny i test Postgres). CSP panelu bez zmian: nonce, brak atrybutów `style=` (test renderuje każdy nowy komponent i szuka `style=`), brak zewnętrznych skryptów, czcionek i CDN; wykresy to własny HTML/CSS/SVG.

## 9. Testy i czego nie sprawdzono

Uruchomione (`npx vitest run tests/unit/admin-analytics tests/unit/admin-app`): domena i wzory (histogram i percentyle na ustalonych danych, wyniki startu 95/80/50/29, płynność, retencja i pasmo, lejek), granice dób Europe/Warsaw kontra UTC (00:30 czasu letniego = 22:30 UTC poprzedniego dnia, zima 23:00 UTC, doba 25-godzinna 25.10.2026, porównanie godzinowe o tydzień), serie bez fałszywych zer, cache SWR (świeży, nieświeży z jednym odświeżeniem, błąd, ograniczenie rozmiaru), przypadki użycia na atrapach repozytoriów (ruch dzienny i godzinowy, porównanie, telemetria wyłączona i awaria, jakość, oglądalność, film, lejek, migawki krawędzi), hub i strumień SSE (nagłówki trasy, keep-alive, 10 minut zegarem testowym, `abort`, limit czasu życia, ucinanie migawek przy powolnym kliencie, pełny hub), poranny raport (4 warianty wyłączenia, wysyłka z atrapą, błąd transportu, podgląd, escapowanie HTML, token), komponenty (klawiatura, tabela danych, adnotacje, „bez pomiaru”, brak `style=`, „Wstrzymaj” zamyka `EventSource`), przegląd statyczny migracji.

**Nie uruchomiono (brak lokalnego Postgresa):** `tests/postgres/analytics-rollups.pg.test.ts` (kubełki SQL kontra TypeScript, rollup przez opakowanie `rollup_day`, idempotencja, granica doby 00:30 Warsaw, uprawnienia roli). SQL przeczytano ręcznie pod kątem typów i zakresów. `npm run admin:build` (`next build apps/admin`) przechodzi (wykryło i naprawiło import sterownika Postgresa do bundla przeglądarki; komponenty kliencie nie importują `ui.tsx` ani `lib/modules`). **Nie sprawdzono też:** prawdziwych danych (telemetria produkcyjna nie była dostępna), wyglądu w przeglądarce (nie uruchamiano przeglądarki; komponenty sprawdzone w jsdom i przez renderowanie statyczne), strumienia SSE przez prawdziwy tunel Cloudflare (10 minut przeżycia potwierdza tylko test na zegarze testowym i nagłówki), wysyłki poczty (nigdy nie wysyłano).

## 10. Decyzje i ryzyka

| Decyzja / ryzyko | Uzasadnienie |
|---|---|
| Histogramy zamiast percentyli z surowych | surowe znikają po 90 dniach; sumowanie jest dokładne |
| Opakowanie `rollup_day` w SQL zamiast zmiany kolektora | rollupy ruszają po samej migracji; ryzyko nadpisania opisane w sekcji 3 |
| Odwiedzający = suma dobowych unikalnych | uczciwa konsekwencja braku ciasteczek; opisane na kaflu |
| „Dziś” dla jakości i retencji = 7 dni | agregaty jakości są dobowe; ekran mówi o tym wprost |
| Wynik doświadczenia = średnia trzech wyników | wagi Mux nie są publiczne w pełni; nasza prosta definicja jest opisana |
| Dzisiejsza doba jest niepełna w porównaniu dobowych okresów | zaniża ostatni dzień; nota pod wykresem |
| Brak atrybucji per źródło | brak danych, brak łączenia z kontem; interfejs i przyczyna zamiast atrapy |
| `compress: false` w aplikacji panelu | bufor kompresji psuje SSE; ruch publiczny i tak kompresuje Cloudflare |
| Ucinanie migawek zamiast kolejki | pamięć ograniczona; liczby na żywo są chwilowe |

## 11. Wdrożenie (kolejność)

1. **Kopia:** `backup.sh` (zwyczajowo przed migracją; ta jest tylko dodająca).
2. **Migracja:** zwykły `deploy.sh` strony uruchamia `prisma migrate deploy`; tworzy tabele, opakowuje `rollup_day`, nadaje uprawnienia i uzupełnia dane wstecz (sekundy przy obecnych wolumenach). Kolektor **nie wymaga** przebudowy: najbliższy rollup (≤ 5 min) wypełni nowe tabele. Sprawdzenie: `select count(*) from telemetry.r_video_qoe_daily;` oraz `select * from telemetry.job_run where job='telemetry-rollup' order by id desc limit 1;` (status `ok`).
3. **Panel:** `deploy-admin.sh <tag>`. Wymaga `ADMIN_TELEMETRY_DATABASE_URL` (rola `pp_analytics_ro` z logowaniem, jak dla „Zapasu serwera”, ADMIN-PANEL.md). Bez niej ekrany piszą wprost, że telemetria nie jest podłączona.
4. **Zmienne opcjonalne (zostaw puste, dopóki nie decydujesz inaczej):** `ADMIN_EDGE_TOLERANCE_PCT` (domyślnie 30), `ADMIN_MORNING_REPORT` (off), `ADMIN_MORNING_REPORT_TO`, `ADMIN_JOBS_TOKEN`.
5. **Sprawdzenie SSE przez tunel (do zrobienia przy wdrożeniu):** otwórz `/premiera` na ≥ 12 minut i potwierdź, że „dane z …” wciąż się zmienia i nie pojawia się „połączenie przerwane”. Jeśli strumień pada po ok. 100 s, sprawdź, czy między przeglądarką a origin nie ma warstwy buforującej (nagłówek `cache-control` odpowiedzi powinien zawierać `no-transform`).
6. **Poranny raport:** włączenie to osobna decyzja. Harmonogram wymaga wywołania `POST /api/jobs/morning-report` z hosta; ponieważ proxy panelu wymaga JWT Cloudflare Access także dla żądań lokalnych, trzeba albo utworzyć w Access politykę „Service Auth” i wołać publiczny adres z nagłówkami tokenu serwisowego (oraz `Authorization: Bearer ADMIN_JOBS_TOKEN` i `Origin` panelu), albo dodać wywołanie do przyszłego kolektora. Nic z tego nie jest zrobione.
7. **Wycofanie:** panel: `deploy-admin.sh --rollback`. Baza: nowe tabele są niegroźne (nikt inny z nich nie czyta); aby wrócić do poprzedniego `rollup_day`: `DROP FUNCTION telemetry.rollup_day(date); ALTER FUNCTION telemetry.rollup_day_core(date) RENAME TO rollup_day;` (rola `pp_collector` zachowuje `EXECUTE`).
8. **Zasoby:** panel ma limit 384 MB; cache SWR ma ≤ 64 wpisy, hub ≤ 3 × 4 słuchaczy; dodatkowe zapytania to kilka lekkich odczytów z agregatów na stronę.

## Źródła

1. Mux Data, Startup Time: https://www.mux.com/docs/guides/data-startup-time-metric
2. Mux Data, Smoothness: https://www.mux.com/docs/guides/data-smoothness-metric
3. Mux Data, Overall Viewer Experience: https://www.mux.com/docs/guides/data-overall-viewer-experience-metric
4. Wistia, Understanding Audience Retention (wykres zaangażowania, rewatche, procent widzów w danym momencie): https://wistia.com/learn/marketing/understanding-audience-retention (nasza krzywa liczy odsetek startów, które dotarły do momentu, bez warstwy powtórek)
5. PostgreSQL, `width_bucket` z tablicą progów (0 poniżej pierwszego progu): https://www.postgresql.org/docs/17/functions-math.html ; omówienie: https://www.crunchydata.com/blog/histograms-with-postgres
6. Cloudflare, błąd 524 (brak odpowiedzi przez ~100 s): https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/
7. Cloudflare Community, SSE i przerwanie po ok. 100 s, komentarz keep-alive: https://community.cloudflare.com/t/server-side-events-sse-is-interrupted-in-approx-100s/424548
8. WCAG 2.2, kryterium 2.2.2 Pause, Stop, Hide: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
