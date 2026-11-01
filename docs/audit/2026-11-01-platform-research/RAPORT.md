# Polutek kontra PeerTube: audyt porównawczy i gotowość do dużej platformy

**Data:** 1 listopada 2026. **Przyjęty cel właściciela:** duża platforma konkurująca z PeerTube funkcjami i skalą. **Zakres:** kod, testy, wybrane eksperymenty awarii, migracje i procesy opisane w repozytoriach. Bez modyfikacji aplikacji i bez operacji na produkcji.

## 1. Ocena wprost

**Polutek nie jest byle jakim prototypem. Ma szereg profesjonalnie zaprojektowanych mechanizmów. Nie ma jednak dzisiaj dowodów na dojrzałość operacyjną i skalowalność porównywalną z PeerTube jako dużą platformą.** To solidny własny serwis VOD z rozwijanym modelem wielu twórców, który wymaga wzmocnienia kilku krytycznych granic: awarie pomiędzy usługami, koszty magazynu, odtwarzalność testów, aktualizacje bezpieczeństwa i egzekwowanie jakości wydania.

Najważniejszy wniosek z badania nie brzmi „zmień Next.js na Express” ani „napisz więcej testów jednostkowych”. Brzmi: **spraw, żeby operacje pozostawały poprawne podczas utraty połączenia, restartu procesu, ponownego żądania i częściowego sukcesu zewnętrznej usługi.** W tych miejscach znaleziono konkretne luki, mimo istniejących zabezpieczeń.

Na pytanie „czy możemy być lepsi?” odpowiedź jest dwuczęściowa:

- **Tak, w wybranym produkcie i doświadczeniu użytkownika.** Prostszy przebieg oglądania, dobry start filmu, sprawny upload, prywatność, spójne Studio i monetyzacja mogą dać lepszy produkt dla konkretnej grupy. Wymaga to pomiarów, nie opinii o wyglądzie kodu.
- **Nie ma dziś podstaw, by twierdzić, że jesteśmy lepsi jako uniwersalna platforma lub pod względem skali.** PeerTube ma implementacje i testy zdalnych runnerów, wielu procesów API, replik odczytu, transmisji na żywo, federacji, rozszerzeń i przenoszenia kont. Nie zbadano ich wydajności w tym środowisku, więc nie przypisuję im dowolnej liczby widzów czy gwarancji dostępności.

Profesjonalizm nie oznacza braku błędów. Oznacza między innymi, że ograniczenia są nazwane, ryzyko jest ograniczane automatycznie, awarie są wykrywane, a poprawki można bezpiecznie i powtarzalnie wydać. W Polutku część tego już istnieje, a część nadal zależy od pamięci właściciela i osoby wykonującej wdrożenie.

## 2. Metoda, dowody i granice

Porównano:

| Projekt | Checkout | Commit |
|---|---|---|
| Polutek | `/workspace/polutek-pl` | `c397b9e548ca2c628e21457ac69d66e54b12ddbd` |
| PeerTube, package version 8.3.2 | `/workspace/PeerTube` | `fa7d2b5d8a44bbec99159b11e91763f7d2308faa` |

Przegląd objął przepływy uploadu, kodowania, publikacji, odtwarzania, autoryzacji kanałów, płatności, powiadomień, usuwania danych, eksportu, monitoringu i wdrażania. Porównano implementacje i odpowiadające im testy. PeerTube pobrano z domyślnej gałęzi; wskazany commit, nie hipotetyczna konfiguracja dowolnej instancji, jest punktem odniesienia.

**Poziomy dowodu:**

- **A — wykonanie:** polecenie lub kontrolowany eksperyment wykonany tutaj. Eksperyment z atrapą magazynu potwierdza reakcję kodu na daną odpowiedź, a nie incydent na produkcyjnym R2.
- **B — kod:** zachowanie lub brak zabezpieczenia wynika z prześledzonej implementacji. Nie oznacza odtworzenia pełnego incydentu.
- **C — źródło zewnętrzne / dokumentacja:** advisory, opis działania produkcji lub historyczny pomiar. Aktualny stan produkcji nie został sprawdzony.
- **D — brak dowodu:** sprawdzenie nie zostało wykonane albo uniemożliwiło je środowisko. Nie jest to automatycznie błąd aplikacji.

**Priorytety:** P0 — pilne sprawdzenie przed następnym wydaniem; P1 — przed szerszym otwarciem platformy; P2 — przed wzrostem skali; P3 — rozwój zależny od strategii produktu. Nie są to oceny CVSS.

Nie wykonano pełnego audytu każdej trasy, penetracji produkcji, pomiaru UX na użytkownikach, przeglądu prawnego ani porównawczego benchmarku obu uruchomionych aplikacji. Nie ma podstaw do certyfikowania bezpieczeństwa, zgodności z prawem czy obsługi określonej liczby widzów. Wnioski „brak funkcji” oznaczają brak odnalezionego odpowiednika w analizowanej strukturze, a nie wiedzę o prywatnych gałęziach i usługach poza repozytorium.

## 3. Co rzeczywiście sprawdzono

| Sprawdzenie Polutka | Wynik | Co potwierdza / czego nie potwierdza |
|---|---|---|
| `quality:architecture-boundaries` | PASS | Zgodność z obecną bramką architektury; nie poprawność całej autoryzacji |
| `npm run typecheck` | FAIL, kod 2 | Brak wygenerowanego klienta Prisma powoduje błędy i błędy wtórne; nie można ocenić czystości typów aplikacji |
| Pełny Vitest, 2 workery | FAIL, kod 1 | 2556 testów zaliczonych, 35 niezaliczonych, 11 pominiętych; część plików nie załadowała testów |
| Pliki w raporcie pełnego Vitest | 304 zaliczone / 231 niezaliczonych | Raport obejmuje 535 plików, nie cały zestaw PG ani E2E |
| Osobny wcześniej wykonany zestaw upload/HLS/FFmpeg | 28 PASS / 1 SKIP | Realne kodowanie krótkich klipów i testy klienta uploadu; nie cały łańcuch usług |
| `npm run e2e:list` | FAIL: 0 testów | Playwright wskazuje nieistniejący `tests/e2e` |
| 81 migracji SQL na nowej bazie PostgreSQL 17 | 81 PASS | Składnia i kolejność pustej bazy; wykonano przez `psql`, nie silnik migracji Prisma |
| Eksperymenty procesu kodowania | Odtworzono trzy niepożądane ścieżki | Szczegóły R02–R03 |
| Eksperyment częściowego błędu DeleteObjects | Odtworzono fałszywy sukces | Szczegóły R04 |
| `npm audit --omit=dev --package-lock-only --json` | 1 critical, 5 high, 7 moderate, 1 low | Alarmy dla grafu lockfile; nie 14 niezależnych exploitów aplikacji |

Pełny Vitest zarejestrował 2602 testy. **Nie należy liczyć „procentu zielonych” jako miary jakości**, ponieważ wiele plików nie zdążyło zarejestrować testów przez brak Prisma. W raporcie JSON `numTotalTestSuites` obejmuje również grupy `describe`; nie jest liczbą plików.

W checkoutcie jest 533 plików testów jednostkowych, 2 integracyjne i 12 PostgreSQL. 58 plików testowych używa odczytu plików, a 273 zawiera `vi.mock`; kategorie się nakładają, a odczyt pliku może dotyczyć fixture. To nie dowód złych testów. To dowód, że duża liczba testów nie zastępuje sprawdzenia połączenia usług.

**Blokada środowiska:** pobieranie silnika i checksum Prisma z `binaries.prisma.sh` otrzymuje HTTP proxy 403. Oficjalny tryb generowania `--no-engine` również zatrzymał się na tym pobraniu. Nie wyłączono weryfikacji ani nie podstawiono klienta. Dlatego brak pełnego typecheck, uruchomienia aplikacji i testów Prisma/Postgres pozostaje D. Błędy pełnego Vitest są w dużej mierze z tym związane; pozostałych nie ogłaszam naprawionymi ani potwierdzonymi błędami produktu.

Dowody wykonania: [zestaw kontroli](checks.json), [Vitest JSON](vitest-results.json), [błędy ładowania i testów](failing-suites.json), [migracje SQL](migrations-sql.json), [skan npm](npm-audit-production.json).

Do dalszej pracy: [lista 22 obszarów w CSV](BACKLOG.csv) oraz [konkretny plan weryfikacji niewiadomych](PLAN-WERYFIKACJI.md). Plan opisuje badania przyszłe, a nie zaliczone testy.

PeerTube nie został uruchomiony. Jego testy i mechanizmy są dowodem implementacji, nie dowodem, że cały wskazany commit przechodzi testy w tym środowisku.

## 4. Gdzie Polutek jest już profesjonalnie zbudowany

| Obszar | Mocna strona | Dowód |
|---|---|---|
| Tożsamość i uprawnienia | Rola i stan konta czytane z bazy, sesja nie jest jedynym autorytetem | [auth.ts](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/api/auth.ts#L25) |
| Izolacja kanałów | Centralna macierz uprawnień i sprawdzanie filmu w kanale | [policy.ts](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/authz/domain/policy.ts#L40), [video-guard.ts](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/video-guard.ts#L1) |
| Dostęp do filmu | Token wydawany po decyzji dostępu, podpis obejmuje wersję i znacznik publiczny | [SelfHlsTokenService](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playback/infrastructure/self-hls-token.service.ts#L1) |
| Dostarczanie filmu | Worker sprawdza token przed cache, prywatne napisy nie dostają publicznego adresu | [HLS Worker](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/workers/hls-edge/worker.mjs#L175) |
| Kodowanie | Oddzielny kontener, limity zasobów, timeouty, brak skalowania obrazu w górę, dopasowane GOP i HLS | [encoder](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/hls/encode-hls.mjs#L1), [Compose](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/deploy/serwerek/docker-compose.yml#L41) |
| Kolejka | SKIP LOCKED, ponowienia, heartbeat, odzyskiwanie i uczciwość między kanałami | [repozytorium kolejki](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/infrastructure/encode-job.repository.ts#L41) |
| Rezerwacja uploadu | Limit i rezerwacja pod blokadą kanału; kontrola rozmiaru i nagłówka pliku po uploadzie | [use case](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/original-upload.use-cases.ts#L94) |
| Płatności istniejącego przepływu | Weryfikacja webhooka, limity body, CAS, centralna realizacja i uzgadnianie | [webhook](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/webhooks/stripe/route.ts#L16), [fulfillPayment](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/payments/application/fulfill-payment.use-case.ts#L39) |
| Trwałe zadania | Dzierżawa z tokenem, checkpointy i ograniczone porcje pracy | [durable-job.ts](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/shared/durable-job.ts#L1) |
| Usuwanie filmu | Manifest sprzątania zapisany w transakcji usunięcia | [storage-cleanup-job.ts](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/admin-content/application/storage-cleanup-job.ts#L10) |
| Panel | Oddzielna aplikacja i tożsamość, weryfikacja JWT Access, ścisły CSP | [proxy panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/proxy.ts#L10), [weryfikacja JWT](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/security/cf-access.ts#L36) |
| Obserwowalność | Własne QoE: start filmu i rebuffering; zewnętrzny watchdog i skrypty backup/restore | [QoE](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/telemetry/client/playback-qoe.ts#L49), [watchdog](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/workers/pp-watchdog/worker.mjs#L1) |

To są konkretne mechanizmy, nie „ładna struktura katalogów”. Część ma już więcej zabezpieczeń niż typowy mały projekt VOD. Jednocześnie ich istnienie nie zapewnia poprawności wszystkich dróg awarii — przykładem jest trwała kolejka sprzątania oparta na funkcji, która nie sprawdza błędów poszczególnych usunięć.

## 5. Najważniejsze znaleziska

### R01. Aktualne zależności wymagają pilnego przeglądu bezpieczeństwa — P0, A/C

Lockfile zawiera Next.js **16.3.8** i sharp **0.35.4**. Skan npm zgłasza critical dla Next oraz high dla sharp. Zweryfikowano źródłowe strony GitHub Advisory:

- [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw): Next Image Optimization, potencjalne RCE na Linux/glibc; advisory wskazuje sharp co najmniej 0.35.5 jako obejście i Next 16.4.1 jako poprawkę tego konkretnego problemu.
- [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w): upstream librsvg w sharp, wersja poprawiona 0.35.5.

Dockerfile strony używa `node:22-bookworm-slim`, czyli platforma glibc jest istotna. Aplikacja używa `next/image`. Nie potwierdzono możliwości dostarczenia złośliwego SVG do podatnej ścieżki ani wykonania kodu. Nie zakładam takiej możliwości wyłącznie na podstawie numeru wersji. Również nie wolno odrzucić problemu tylko dlatego, że `dangerouslyAllowSVG` nie jest jawnie włączone — trzeba zweryfikować warunki advisory.

Npm proponuje obecnie Next 16.4.3 dla zbioru alarmów; 16.4.1 nie należy traktować jako automatycznej naprawy wszystkich trzech zgłoszeń Next. Pozostałe alarmy obejmują m.in. nodemailer, Zod i sanitize-html. Zod wymaga osobnej analizy: opis advisory odwołuje się do `$ZodArray`, a projekt ma główne Zod 3 i dodatkowe wersje w zależnościach auth. Nie wnioskuję z szerokiego zakresu `<4.6.6`, że wszystkie są tak samo osiągalne.

**Zmiana:** oddzielna aktualizacja zależności z regresją obu aplikacji, ścieżek obrazów, auth i poczty. Bez `npm audit fix --force`. Frozen lockfile zachowa obecną wersję, dopóki świadomie nie zmienimy zależności/lockfile. Kilka alarmów dotyczy narzędzi testowych w grafie zależności; nie jest to równoznaczne z publicznie wystawionym Vitest UI.

**Odbiór:** znana poprawiona wersja w zbudowanym obrazie, brak niewyjaśnionych high/critical lub udokumentowana analiza nieosiągalności konkretnego advisory, zielona regresja. PeerTube też ma historię poważnych podatności: [CHANGELOG](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/CHANGELOG.md#L3). Dojrzałość oznacza proces ich obsługi, nie brak wpisów CVE.

### R02. Utrata zadania nie odcina wszystkich skutków starego workera — P1, A/B

Aktualizacje statusu zadania sprawdzają `workerId`, ale efekty w R2 i finalizacja nie są spięte z tą samą ochroną. `handleFailure` usuwa prefiks **przed** sprawdzeniem `lostState.lost`. Ponowne przejęcie tego samego zadania używa tego samego prefiksu wersji. Stary worker może więc sprzątać pliki należące już do następnej próby.

Odtworzono dwie ścieżki: po zasymulowanym przejęciu zadania i zapisie nowego właściciela stary worker zwrócił `lost`, lecz usunął cały prefiks; po utracie zadania w trakcie `finalize` efekt publikacji nadal się wykonał, a dopiero końcowy zapis statusu zwrócił brak własności. Ten drugi eksperyment używa atrap finalizacji, ale rzeczywisty finalizer również nie dostaje sygnału anulowania ani tokenu przejęcia i nie kontroluje właściciela zadania.

Źródła: [procesor](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/process-encode-job.ts#L318), [sprzątanie](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/process-encode-job.ts#L339), [finalizer](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/finalize-self-hls.ts#L40). PeerTube jawnie modeluje etap `COMPLETING` i nieodwracalne zakończenie: [obsługa](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/runners/job-handlers/abstract-job-handler.ts#L151), [ochrona zakończeń](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/runners/job-handlers/shared/pending-completions.ts#L1). Nie jest to dowód, że PeerTube rozwiązuje każdy możliwy podział sieci.

**Zmiana:** token każdej próby/dzierżawy, osobny prefiks roboczy próby oraz transakcyjna kontrola własności przed aktywowaniem wersji; sprzątanie ograniczone do własnej próby. Samo `if (lost)` w JavaScript nie zabezpiecza operacji, podczas której proces może stanąć.

**Odbiór:** test z dwoma workerami i realną bazą, wstrzymaniem A, przejęciem przez B i wznowieniem A; A nie usuwa ani nie aktywuje wyniku B.

### R03. Sprzątanie uploadu może wyprzedzać nadal trwające PUT — P1, A/B

`runPool` używa `Promise.all`. Pierwszy błąd kończy oczekiwanie, ale nie kończy pozostałych operacji. Procesor zaczyna sprzątać prefiks i katalog pracy. `putFile` nie przyjmuje `AbortSignal`, więc rozpoczęte wysyłki mogą kończyć się później.

**Eksperyment:** jedna wysyłka zawiodła; w chwili zakończenia procesora prefiks był pusty; po ukończeniu pozostałych PUT pozostały **3 obiekty**. Nie dowodzi to publikacji niepełnego filmu — master/aktywacja nadal są osobno — lecz dowodzi nieskutecznego sprzątania i ryzyka kolizji z kolejną próbą.

Źródła: [runPool](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/process-encode-job.ts#L149), [putFile](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/infrastructure/r2-storage.ts#L92).

**Zmiana:** zatrzymanie przydzielania pracy po pierwszym błędzie, anulowanie transferów, oczekiwanie na ich zakończenie, dopiero później cleanup. Połączyć z prefiksami prób z R02.

**Odbiór:** po niepowodzeniu i po zakończeniu wszystkich transferów nie zostają nieodnotowane pliki; test kontroluje także opóźniony sukces i opóźniony błąd.

### R04. Częściowy błąd S3 DeleteObjects jest traktowany jako sukces — P1, A/B

`HlsWriter.deletePrefix` nie odczytuje `Errors` odpowiedzi `DeleteObjectsCommand`; zwiększa licznik o liczbę żądanych kluczy. S3 może zwrócić HTTP 200 z błędami konkretnych obiektów. Istnienie tego pola potwierdza również typ SDK `DeleteObjectsOutput`.

**Eksperyment na rzeczywistej klasie HlsWriter:** odpowiedź zawierała `AccessDenied` dla jednego klucza. Metoda zwróciła „usunięto 1”, choć atrapa magazynu nie usunęła pliku. Wyższa warstwa `purgeVideoStorageStrict` czeka na wyjątek, więc może błędnie zakończyć trwałe zadanie.

Źródła: [deletePrefix](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/infrastructure/r2-storage.ts#L127), [strict cleanup](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/output-cleanup.use-cases.ts#L122). PeerTube w analizowanej ścieżce usuwa obiekty pojedynczo i propaguje błędy: [object-storage helpers](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/object-storage/object-storage-helpers.ts#L240). Nie trzeba kopiować wolniejszej metody pojedynczych DELETE; można poprawnie obsłużyć batch.

**Odbiór:** błędy per klucz powodują retry; licznik odzwierciedla potwierdzone usunięcia; trwale odrzucony klucz jest widoczny operatorowi. To dotyczy kosztów i obietnicy usunięcia danych.

### R05. Trwała kolejka powiadomień ma lukę przed jej utworzeniem — P1, B

Film staje się `PUBLISHED` w transakcji. Zadanie fan-out jest tworzone dopiero później, w wywołaniu best effort. Jeśli proces padnie lub enqueue zawiedzie pomiędzy tymi krokami, zwykły film bez `premiereAt` może nie zostać ogłoszony. Cron premier wybiera `premiereAt != null`, więc nie jest ogólnym mechanizmem odtworzenia tego braku. Ponowne wywołanie publikacji dla już opublikowanego filmu wraca wcześniej.

Źródła: [publikacja](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/application/publish-admin-video.use-case.ts#L34), [enqueue po commit](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/notifications/application/new-video-fan-out.use-case.ts#L232), [kandydaci crona](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/notifications/application/premiere-notifications.use-case.ts#L54).

**Zmiana:** transactional outbox — trwały zamiar ogłoszenia zapisany razem z publikacją. Dostarczenie i rozsyłka poza transakcją. Polutek już stosuje taki wzorzec przy usuwaniu filmu; warto rozszerzyć własne dobre rozwiązanie. Nie twierdzę, że PeerTube ma bezlukowy outbox dla każdego powiadomienia.

**Odbiór:** przerwanie procesu tuż po commit nie gubi ogłoszenia; powtórzenie niczego nie dubluje.

### R06. Limit magazynu nie jest limitem rzeczywistego kosztu — P1, B

Limit kanału sumuje oryginały z wyłączeniem `SUPERSEDED`, `ABANDONED`, `FAILED`. Nie sumuje wszystkich wariantów HLS i poprzednich wersji. Oznaczenie oryginału jako `SUPERSEDED` w procesie wymiany samo go nie usuwa. Odtwarzanie poprzedniej wersji przed gotowością nowej jest dobre, ale potrzebuje oddzielnego budżetu retencji.

Źródła: [liczenie limitu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/channel-limits.ts#L15), [promowanie nowego oryginału](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/original-upload.use-cases.ts#L265). PeerTube rozróżnia użytkowy quota i całkowite rozmiary plików: [scope totalVideoFileSize](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/models/user/user.ts#L169). **PeerTube też nie liczy każdej kopii do quota użytkownika**, więc nie należy przedstawiać go jako idealnego modelu kosztów.

**Zmiana:** dwa liczniki: umowny limit produktu i rzeczywisty koszt wszystkich przechowywanych danych; retencja oryginałów/wersji, rezerwacja miejsca na kodowanie oraz budżet per twórca. Dzienny limit uploadu ogranicza tempo wzrostu, lecz nie zastępuje budżetu całkowitego.

**Odbiór:** wielokrotna wymiana filmu nie pozwala bez końca zwiększać magazynu poza ustalonym budżetem; w panelu osobno widać oryginały, rendycje, stare wersje i osierocone dane.

### R07. Cofnięcie dostępu ma okno zależne od tokenów i cache — P1/P2, B

Token HLS jest podpisanym bearer linkiem bez identyfikatora sesji użytkownika. Worker sprawdza podpis i czas, nie aktualny stan konta/filmu. Domyślne TTL: chronione 30 minut, publiczne 6 godzin. Ban konta, zwrot lub cofnięcie publikacji nie zmienia podpisu już wydanego linku. Cache edge i przeglądarki wymagają oddzielnego rozpatrzenia. Już pobranych plików nie da się „odebrać”.

Źródła: [TTL i podpis](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playback/infrastructure/self-hls-token.service.ts#L23), [walidacja przed cache](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/workers/hls-edge/worker.mjs#L175). PeerTube ma tokeny w Redis i lokalne unieważnianie tokenów użytkownika: [VideoTokensManager](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/video-tokens-manager.ts#L22). Jego zależność od współdzielonego stanu ma z kolei koszt dostępności i obsługi.

**Ocena:** to świadomy kompromis korzystny dla wydajności edge, nie automatycznie błąd. Przed dużą platformą trzeba określić czas egzekwowania blokady treści i zwrotu. Jeśli wymagane są minuty/sekundy, potrzebne jest unieważnianie wersji/epoch i proces purge, a nie samo odmawianie nowych planów odtwarzania.

**Odbiór:** osobne testy: ban użytkownika, refund, ukrycie filmu, usunięcie filmu; znany maksymalny czas dostępu dla już wydanego tokenu i znana polityka cache.

### R08. Brak działających E2E mimo konfiguracji — P1, A/B

`playwright.config.ts` wskazuje `tests/e2e`, którego nie ma. `npm run e2e:list` potwierdza 0 testów. Są wartościowe testy FFmpeg i PG, ale test procesu kodowania korzysta z atrap magazynu/enkodera.

PeerTube ma [testy API całego HLS](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/transcoding/hls.ts#L41), [test zatrzymania runnera](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/peertube-runner/shutdown.ts#L1) oraz [zestaw przeglądarkowy](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/client/e2e/src/suites-local/publish.e2e-spec.ts#L1). Ich istnienie jest znaczącą przewagą strategii walidacji, choć nie wykonano ich tutaj.

**Zmiana:** lokalny stos PostgreSQL + S3-compatible storage + worker + aplikacja; krótki film przez prawdziwe HTTP. Następnie przeglądarka sprawdzająca postęp czasu/klatek oraz odmowę dostępu. Izolowane testy awarii R02–R04 zachować dodatkowo.

**Odbiór:** upload, wznowienie, kodowanie, wymiana źródła, publikacja, publiczny playback, blokada gościa, anulowanie i usunięcie mają scenariusze integracyjne. Nie trzeba zaczynać od setek E2E.

### R09. Zielony build nie oznacza zielonych typów — P1, B

Obie konfiguracje Next ustawiają `ignoreBuildErrors: true`; Dockerfile nie uruchamia osobnego typecheck. Istnieje `npm run quality`, ale można zbudować obraz bez tej bramki. Wcześniejsze instrukcje scalania dopuszczają `SKIP_CI=1`, zakładając ręczne wykonanie kontroli.

Źródła: [strona](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/next.config.mjs#L35), [panel](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/next.config.mjs#L29), [Dockerfile](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/deploy/serwerek/Dockerfile#L41). PeerTube w [build server](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/scripts/build/server.sh#L3) przerywa po błędzie kompilacji.

**Zmiana:** obowiązkowa bramka na każdej obsługiwanej ścieżce tworzenia artefaktu/wydania; wynik związany z dokładnym SHA. Płatny GitHub Actions nie jest warunkiem — może to być lokalny runner lub inny system.

**Odbiór:** celowo wprowadzony błąd typu blokuje wydanie każdej z aplikacji; nie wystarcza zapis w instrukcji „pamiętaj uruchomić”.

### R10. Obecna topologia nie jest architekturą dużej platformy — P2, B

Polutek: jedna aplikacja, jedna baza i jeden globalnie aktywny encode, wszystko w topologii jednego serwera. Jest to rozsądna faza oszczędnego rozwoju, nie dowód obsługi dużego ruchu. Same dodatkowe instancje Next nie rozwiązują koordynacji cronów, stanu lokalnego, migracji, dostępu do bazy i operacji kodowania.

PeerTube jawnie definiuje primary/secondary, współdzielenie Redis/Postgresa i role procesów: [server.ts](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/server.ts#L1). Ma testy [wielu procesów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/horizontal-scalability/secondary-server-processes.ts#L1), [replik odczytu](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/server/database-read-replicas.ts#L1) i opcjonalne [zdalne runnery](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/transcoding/create-transcoding-job.ts#L34). Primary pozostaje szczególną rolą; „wiele procesów” nie jest synonimem pełnego HA.

**Zmiana:** najpierw R02–R06 i niezależne skalowanie kodowania. Później bezstanowe repliki web/API, jeden kontrolowany scheduler, budżety połączeń/pooling, plan odtwarzania bazy. Bez przepisywania domeny na mikrousługi dla samej etykiety.

**Odbiór:** testy co najmniej dwóch procesów API i workerów, spójność limitów i uprawnień, brak podwójnego działania schedulerów, kontrolowana awaria jednego procesu.

### R11. Historyczny load test nie uzasadnia dzisiejszej deklaracji skali — P2, C/D

Repo ma staranny [load test z 4 października](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/docs/operations/LOAD-TEST.md#L1), z bezpiecznikami i wynikami nasycenia. To zaleta. Mierzył jednak stary obraz, gościa, ograniczone trasy i mały zestaw danych. Około 17 wykonanych podróży/s przy nasyceniu w tamtym teście nie oznacza „17 widzów” ani limitu obecnego kodu.

Brakuje aktualnego dowodu dla mieszanego ruchu: oglądanie + sesje + komentarze + powiadomienia + wyszukiwanie + upload/kodowanie, z dużą liczbą filmów/kanałów. Pomiary PeerTube również nie zostały tu wykonane, więc nie ma uczciwego rankingu szybkości.

**Zmiana:** wspólny scenariusz porównawczy VOD, te same zasoby, czas trwania i rozmiar katalogu; pomiary p95/p99, błędów, czasu pierwszej klatki, rebufferingu, CPU, pamięci i kosztu. Oddzielić ścieżkę control plane od transferu segmentów przez CDN/P2P.

**Odbiór:** powtarzalny raport z dokładnym SHA i konfiguracją, co najmniej test długotrwały oraz zachowanie po nasyceniu. Granice ruchu określać SLO, nie samym „serwer nie padł”.

### R12. Backup bazy nie oznacza możliwości odtworzenia platformy — P1/P2, B/C/D

Są sensowne skrypty backupu, szyfrowania, sprawdzania uploadu i testowego restore. Dokumentacja mówi jednak o RPO do 24 h bez WAL/PITR oraz braku kopii/blokady usuwania oryginałów i HLS w R2. Wskazuje również współdzielone uprawnienia i połączenia bazy z szeroką rolą. To **stan opisany w dokumentacji, nie zweryfikowany stan produkcji**; wymaga aktualnego przeglądu.

Źródła: [backup](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/serwerek/backup.sh#L1), [restore-test](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/serwerek/restore-test.sh#L1), [ograniczenia opisane w runbooku](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/docs/operations/SERWEREK.md#L436). Test restore sprawdza lokalny dump i obecność zaszyfrowanej kopii w R2; nie dowodzi regularnego odszyfrowania/odtworzenia z samego offsite ani odzyskania wszystkich plików wideo.

**Zmiana:** ustalić docelowe RPO/RTO dla kont, zakupów, oryginałów i HLS; odrębne uprawnienia app/encoder/cleanup; ochronę i drugą kopię najcenniejszych danych, jeśli wynika z wymagań. HLS można odtworzyć z zachowanego oryginału, ale trzeba policzyć czas i koszt ponownego kodowania.

**Odbiór:** ćwiczenie odtworzenia na pustym, odizolowanym serwerze wyłącznie z zasobów offsite, wraz z testowym filmem i stanem zakupów. Snapshot serwera sam nie zapewnia kopii obiektów R2.

### R13. Ważność logowania administratora jest za słabą definicją świeżego potwierdzenia pieniędzy — P1 przed delegowaniem obsługi, B

Panel ma dobre sprawdzenie JWT Access, osobną tożsamość i audyt. Jednak w domyślnym trybie Access „świeżość” dla wrażliwych działań dopuszcza 12 h, podczas gdy legacy step-up ma 5 min. To jawna decyzja konfiguracyjna, nie odkryte obejście logowania.

Źródło: [ADMIN_ACCESS_MAX_AGE_SECONDS](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/config.ts#L50).

**Zmiana:** przed wieloosobową obsługą platformy rozdzielić wejście do panelu od potwierdzenia zwrotów, zmian ról i wypłat; określić MFA i krótką świeżość działania. Nie przenosić automatycznie ustawień wygodnych dla jednego właściciela na zespół moderatorów i finansów.

**Odbiór:** przejęcie starej sesji nie wystarcza do najbardziej wrażliwych operacji bez dodatkowego potwierdzenia.

### R14. Awaria Redis świadomie osłabia limity auth — P2, B

Auth rate-limit jest fail-open i loguje awarię. Dokumentacja kodu opisuje pozostające Turnstile/TOTP i kompromis dostępności. To nie jest „zapomniany limit”, lecz decyzja dla małego serwisu. Przy dużej platformie potrzebny jest sprawdzony tryb degradacji, współdzielone liczniki i limity także na brzegu.

Źródło: [rate-limit-storage.ts](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/auth/rate-limit-storage.ts#L19). PeerTube używa [współdzielonych limiterów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/middlewares/rate-limiter.ts#L25); nie zakładam, że jego zachowanie podczas awarii jest bezwarunkowo lepsze.

**Odbiór:** test awarii/timeoutu Redis, znane limity skuteczne w tym trybie, mierzalny alarm; brak masowego zablokowania wszystkich kont i brak niekontrolowanej liczby prób.

### R15. Limity body nie są jednolicie egzekwowane przed parsowaniem — P1/P2, B

Webhook Stripe i komentarze używają strumieniowego limitu bajtów. Wspólne `readStudioJson` wykonuje zwykłe `request.json()` przed walidacją Zod, bez własnego limitu. Ograniczenie liczby elementów w schemacie nie ogranicza pamięci potrzebnej wcześniej do odczytu i parsowania. Granica proxy może ograniczać rozmiar, lecz nie ustalono tu jej konfiguracji produkcyjnej dla każdej trasy.

Źródła: [Studio parser](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/api/studio-route.ts#L50), [gotowy helper](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/utils/request-body.ts#L26). PeerTube ma [globalny limit JSON 500 KB](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/server.ts#L284); nie należy kopiować jednej wartości do wszystkich typów uploadu.

**Zmiana:** budżet bajtów per rodzaj żądania przed parsowaniem; osobne limity multipart, tekstów, obrazów i tablic.

**Odbiór:** ponadlimitowy body daje 413 przy ograniczonym zużyciu pamięci, także bez Content-Length i przy wielu równoległych żądaniach.

### R16. Eksport danych wymaga rozwoju razem z domeną i skalą — P2, B

Eksport własnych danych jest dobrym punktem wyjścia: biała lista pól, brak sekretów, limit wywołań. Pobiera jednak pełne kolekcje przez `findMany` i składa całość w pamięci żądania. Deklaracja „everything” wyprzedza rozwój domeny: nie ma w tym eksporcie np. osobnych danych członkostwa kanału czy stanu dostępu patrona przechowywanego w AppSetting. Nie jest to rozstrzygnięcie prawne o wymaganym zakresie.

Źródła: [export use case](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/users/application/export-own-data.use-case.ts#L25), [trasa](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/user/export/route.ts#L17). PeerTube ma kolejkę tworzenia archiwum, eksportery domenowe i [testy import/export](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/users/user-export.ts#L1).

**Zmiana:** mapa danych osobowych i polityka eksportu per moduł; większe eksporty jako zadania z paginacją/streamingiem i wygasającym pobraniem. To samo podejście zastosować do dużych operacji retencji.

**Odbiór:** kompletność względem ustalonej mapy i eksport aktywnego konta o dużej historii bez przekroczenia pamięci lub timeoutu API.

### R17. Rdzeń marketplace nie jest gotowym systemem rozliczeń — P1 przed uruchomieniem sprzedaży wielu twórców, B

Moduł sales ma wartościowe podstawy: obliczenia groszowe, uprawnienia, księgę i idempotencję `providerRef`. Brakuje jednak kompletnej drogi sprzedaży/wypłat, co opisuje dokumentacja. Nie wolno traktować istniejącej kasy patrona jako dowodu gotowego marketplace.

`refundOrder` wywołuje operatora przed transakcją/CAS w bazie. `IssueRefund` nie wymaga identyfikatora operacji/idempotency key. Jeśli przyszły adapter nie deduplikuje zwrotu, dwa równoległe wywołania lub awaria po sukcesie operatora mogą dać rozjazd finansów i księgi. To ryzyko interfejsu **wyłączonego domyślnie modułu**, nie dowód podwójnego zwrotu w aktualnym Stripe premium.

Źródła: [refundOrder](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/sales/application/sales.use-cases.ts#L167), [obecny bardziej rozbudowany admin refund](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/payments/application/admin-refund.use-case.ts#L54), [stan etapu sprzedaży](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/docs/architecture/multi-creator-platform.md#L60).

**Zmiana:** trwała operacja finansowa, idempotency key, stan pośredni, uzgadnianie z operatorem, obsługa refund/dispute/payout i wymagania prawno-podatkowe przed otwarciem. To oddzielny projekt, nie kilka endpointów.

**Odbiór:** scenariusze dwóch równoległych refundów, awarii w każdej granicy, sporu, ponowienia webhooka i nieudanej wypłaty. Jedna operacja finansowa ma jeden spójny ślad audytowy.

### R18. Watchdog sprawdza dostępność procesu, ale nie pełną usługę wideo — P2, B

Monitor zewnętrzny i dead-man heartbeat są dobrą praktyką. Test `video` oczekuje jednak 404 na `/`, a publiczny `/api/health` bez tokenu może odpowiedzieć `{ok:true}` bez testu bazy. To poprawne endpointy liveness, ale nie dowód, że widz dostanie poprawny manifest i segment. Hostowy health z tokenem daje więcej danych, nadal nie zastępuje pełnego playback probe.

Źródła: [watchdog](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/workers/pp-watchdog/worker.mjs#L25), [health use case](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/health/application/check-health.use-case.ts#L25).

**Zmiana:** osobny syntetyczny film i cykliczny test token → manifest → wybrany segment, z rozróżnieniem awarii auth, bazy, R2, Workera i cache. Testy monitorujące muszą mieć własny, ograniczony budżet i nie zanieczyszczać oglądalności.

**Odbiór:** uszkodzenie samej ścieżki R2 lub manifestu wyzwala alarm mimo sprawnego HTTP 404 z głównego adresu Workera.

### R19. Dokumentacja ma konkurujące definicje produktu — P2, B

README opisuje jeden niekomercyjny kanał, `.env.example` ma m.in. pozostałości Neon i wpis „multi-creator removed”, podczas gdy CLAUDE opisuje model wielu twórców i końcową strefę patrona. To rzeczywiście wprowadziło w błąd także pierwszy pobieżny opis projektu w tym wątku.

Źródła: [README](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/README.md#L1), [.env.example](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/.env.example#L19), [aktualniejszy opis](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/CLAUDE.md#L10).

**Zmiana:** jedna aktualna definicja produktu i konfiguracji, krótki README, zweryfikowany start od zera. Historyczne decyzje nie powinny udawać aktualnej specyfikacji.

**Odbiór:** nowa osoba poprawnie uruchamia projekt i rozumie aktywne możliwości oraz wyłączniki bez zgadywania, któremu dokumentowi wierzyć.

### R20. Dostępność i wejście do aplikacji wymagają testów produktu — P2/P3, B/D

Globalne `maximumScale: 1` i `userScalable: false` oraz własny ZoomLock są świadomymi decyzjami właściciela. Mogą utrudniać użycie osobom słabowidzącym. Intro i bramka dźwięku mają własne limity oczekiwania; nie oceniono tutaj ich jakości na rzeczywistych telefonach i czytnikach.

Źródła: [viewport](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/layout.tsx#L64), [opis i decyzje](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/CLAUDE.md#L164).

**Zmiana badawcza:** test klawiatury, screen readera, powiększenia, reduced motion i słabej sieci; pomiar porzuceń przed pierwszą klatką. Nie zmieniać zamrożonych decyzji wizualnych bez osobnego zadania właściciela. Nie twierdzę, że PeerTube jest automatycznie w pełni dostępny.

**Odbiór:** znane wyniki testów i świadoma decyzja na podstawie danych, a nie samego „u mnie wygląda dobrze”. To potencjalny obszar przewagi Polutka, jeśli UX zostanie naprawdę dopracowany.

### R21. Kontrakty API są zbyt rozproszone dla dużej liczby klientów — P2, B

Zod i wspólne use case'y są dobrym fundamentem. Klient Studia i panel mają jednak osobne implementacje uploadu i ręczne kształty odpowiedzi. PeerTube ma [OpenAPI](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/support/doc/api/openapi.yaml#L1), wspólne modele i walidację specyfikacji. OpenAPI samo nie dowodzi zgodności runtime.

**Zmiana:** zacząć od wspólnych request/response dla uploadu, zadań i playback; generowanie typów albo schematów i test odpowiedzi prawdziwego HTTP. Dopiero później publiczny, wersjonowany API/SDK dla zewnętrznych klientów.

**Odbiór:** zmiana kontraktu łamie test lub kontrolę typów przed wdrożeniem. Studio i panel współdzielą silnik uploadu, ale zachowują osobne adaptery tras i zasady uprawnień.

### R22. Studio nie korzysta z już istniejącego wznawiania uploadu — P1, A/B

Klient Studia zawsze POST-uje nową sesję, trzyma ETagi w pamięci i po wyczerpaniu prób wysyła DELETE. Backend ma GET do listy części. Uploader panelu ma zapis `originalId` w localStorage, wznowienie oraz odnawianie adresów części. Testy Studia wręcz oczekują przerwania rezerwacji po błędzie — przechodzą, ale kodują mniej odporny produkt.

Źródła: [Studio uploader](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/components/studio/upload-original.ts#L43), [gotowy uploader panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/video-upload/multipart-uploader.ts#L99), [test po błędzie](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/tests/unit/studio/upload-original.test.ts#L82). PeerTube: [wspólny upload service](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/client/src/app/+videos-publish-manage/shared-manage/common/video-upload.service.ts#L48), [retry](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/client/src/app/helpers/utils/upload.ts#L30).

**Zmiana:** wspólny silnik, pauza i błąd sieci nie kasują sesji; świadome anulowanie ją usuwa. Nie wystarczy podmienić `apiBase`, ponieważ struktury końcówek tras są różne.

**Odbiór:** odświeżenie karty, ponowny wybór pliku i wygaśnięcie podpisu nie powodują wysyłania już zapisanych części od początku.

## 6. Mapa porównania możliwości

| Obszar | Polutek | PeerTube w badanym kodzie | Znaczenie dla celu |
|---|---|---|---|
| VOD HLS | Własny encoder i edge delivery | Własne kodowanie i dostarczanie | Wspólny rdzeń, Polutek ma dobre podstawy |
| Konta, kanały, role | Są, otwarcie kanałów za gate | Są, szerszy produkt wielu użytkowników | Ważniejsze są testy izolacji niż nazwa frameworka |
| Studio i upload | Dwie różne jakości uploadu | Wspólne usługi uploadu | Pilna poprawa spójności |
| Playlists, rozdziały, resume | Są | Są | Nie ma sensu przepisywać działających modułów |
| QoE oglądania | Start i rebuffering w kolektorze | Metryki playback/OpenTelemetry | Najpierw mierzyć w obu, nie deklarować zwycięzcy |
| Zdalne kodowanie | Osobny lokalny worker, globalne 1 zadanie | Runnery i zależności zadań | Istotna luka dla wzrostu |
| Wiele procesów/repliki | Brak porównywalnego dowodu testowego | Implementacje i testy | Wymaga projektu i testów, nie samego autoskalowania |
| Live | Nie odnaleziono odpowiednika pełnego pipeline live | RTMP/HLS i runnery live | Duży osobny produkt, nie mały dodatek |
| Automatyczna transkrypcja | Napisy prywatne; brak porównywalnego silnika auto-STT | Pakiet transcription i zadania | Dobra funkcja dla twórców, z budżetem kosztu |
| Podgląd klatek na pasku | Czas i tytuł rozdziału | Storyboard generator | Użyteczne UX, niższy priorytet od niezawodności |
| Federacja / ActivityPub | Brak porównywalnej implementacji | Rdzeń produktu | Potrzebne tylko przy strategii interoperacyjności |
| P2P | Cloudflare edge zamiast P2P | P2P i redundancja instancji | Alternatywne koszty i ryzyka, nie automatyczny brak |
| Plugins / ekosystem | Brak porównywalnego publicznego systemu | Rozbudowane API pluginów | Zwiększa powierzchnię ataku i koszty kompatybilności |
| Import/export konta i kanału | Eksport JSON wybranych danych | Archiwa, importery i eksportery | Ważne dla zaufania i migracji twórców |
| Moderacja | Zgłoszenia, role, bany i odwołania już są | Szersze mechanizmy, również federacyjne | Rozwijać workflow i obsługę, nie tylko formularze |
| Monetyzacja | Stripe/patron i częściowy marketplace | Brak odnalezionego odpowiednika tego rdzenia Stripe marketplace | Potencjalna przewaga Polutka, ale też odrębne ryzyko finansowe |
| Wydawanie i bezpieczeństwo | Lokalne skrypty i testy, niespójne bramki | Build, testy, SECURITY.md, security releases | Uczyć się procesu, nie kopiować w ciemno konfiguracji |

Rozwiązania PeerTube, które szczególnie warto studiować: [job builder](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/transcoding/shared/job-builders/transcoding-runner-job-builder.ts#L24), [token manager](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/video-tokens-manager.ts#L22), [konfiguracja limitów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/config/default.yaml#L730), [eksporty](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/user-import-export/user-exporter.ts#L1), [storyboard](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/job-queue/handlers/generate-storyboard.ts#L1), [globalne concurrency kolejki](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/job-queue/job-queue.ts#L233).

## 7. Czego nie kopiować bez decyzji

**Nie kopiować całego stosu technicznego.** Express/Sequelize/Angular/BullMQ nie gwarantują lepszego produktu niż Next/Prisma/React/Postgres. Obecna kolejka PostgreSQL może pozostać, jeśli dostanie wymagane własności i testy. R02 nie naprawi sama zmiana nazwy biblioteki.

**Nie kopiować całej federacji i P2P dla parytetu marketingowego.** To nowe problemy z tożsamością, moderacją, SSRF, zgodnością i kosztami. PeerTube [opisuje poprawki federacyjnego podszywania i XSS storyboardów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/CHANGELOG.md#L3). Mniejsza powierzchnia produktu może być przewagą Polutka, ale nie dowodem bezpieczeństwa.

**Nie rozdzielać każdego wariantu jakości bez pomiaru.** Polutek dekoduje źródło raz do wielu wariantów. Osobne zadania mogą poprawić wznowienia i rozkład pracy, ale zwiększyć łączny koszt dekodowania. Najpierw checkpointy i budżety, potem wybór modelu.

**Nie kopiować luźnego CSP.** PeerTube także ma `unsafe-inline` i `unsafe-eval` w [CSP](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/middlewares/csp.ts#L11). To nie wzorzec, który należy przenieść tylko z powodu reputacji projektu.

**Kopiować zachowania i wzorce z testem odbioru.** Wspólne uploady, rozdział quota i kosztu, ochrona zakończeń, testy całych usług i przenośne eksporty są wartościowsze niż kopiowanie plików. PeerTube jest na [AGPL-3.0](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/LICENSE#L1); dosłowne przenoszenie kodu lub tworzenie rozwiązania pochodnego wymaga uwzględnienia tej licencji. Samodzielna implementacja opisanych wzorców jest innym działaniem niż kopiowanie źródła. Raport nie jest opinią prawną o licencjonowaniu konkretnego planu.

## 8. Jak realnie być lepszym

| Możliwa przewaga Polutka | Jak to udowodnić | Czego nie wolno wywnioskować z kodu |
|---|---|---|
| Szybszy start filmu na telefonie | p75/p95 pierwszej klatki na tej samej sieci i urządzeniu | Że mniej komponentów oznacza szybsze oglądanie |
| Mniej zacięć | udział czasu rebufferingu i odsetek nieudanych startów | Że własny HLS jest z definicji lepszy od PeerTube |
| Lepszy upload twórcy | odsetek ukończonych uploadów przy zerwaniach, czas wznowienia, przesłane ponownie bajty | Że retry w jednostkowym teście potwierdza odporność |
| Niższy koszt | koszt godziny obejrzanej i zakodowanej, GB magazynu na film, obsługa i backup | Że jeden tani serwer zapewnia tanią dużą platformę |
| Lepsza monetyzacja | skuteczność zakupu, poprawność refundów, rozliczalność i satysfakcja twórcy | Że formularz Stripe oznacza gotowy marketplace |
| Lepsza prywatność | mapa danych, retencja, kompletne usuwanie i eksport, brak zbędnego śledzenia | Że brak cookies oznacza brak danych osobowych |
| Prostota i dostępność | wykonanie kluczowych zadań przez użytkowników, testy klawiatury i screen readera | Że nietypowe intro jest dla każdego atutem |

Dla badań porównawczych trzeba rozdzielić cztery osie: **funkcje**, **jakość wykonania**, **skala**, **koszt**. Można wygrać w jednej i przegrać w drugiej. „Lepszy od PeerTube” bez podania osi i wyniku jest hasłem, nie oceną techniczną.

## 9. Kolejność prac i bramki gotowości

### Etap A — bezpieczeństwo wydania i domknięcie krytycznych awarii

R01, R02–R05, R08–R09, R22. Dokończyć środowisko Prisma, odtworzyć pełne kontrole i poprawić awarie razem z testami. Bez dokładania live/P2P.

**Bramka:** powtarzalne przygotowanie checkoutu; zielone typy i wymagane testy; działający test całego VOD; stare przejęcie zadania nie wpływa na nowe; batch delete nie gubi błędów; publikacja nie gubi zamiaru powiadomienia; build z błędem typów jest blokowany.

### Etap B — bezpieczne otwarcie na większą liczbę twórców

R06–R07, R12–R18, R21. Budżety kosztów, retencja, ograniczone role infrastruktury, testy cofania dostępu, backup/restore, kompletne i ograniczone eksporty, monitorowanie faktycznej usługi. Sprzedaż wielu twórców pozostaje osobną bramką.

**Bramka:** zmierzony limit kosztu kanału; udane odtworzenie z offsite; kontrolowany czas unieważnienia dostępu; testy wielu ról/kanałów przez HTTP; budżety pamięci i żądań; operator widzi awarie przed zgłoszeniami użytkowników.

### Etap C — udowodniona skala

R10–R11. Niezależne skalowanie enkoderów, potem API i bazy według wyników. Testy dużego katalogu, wielu procesów, awarii i długiego obciążenia. Zdefiniować docelowe SLO z budżetem kosztów. Liczby typu „10 tysięcy widzów” muszą określać bitrate, miks ruchu, liczbę nowych sesji/s i to, czy transfer obsługuje CDN.

**Bramka:** raporty z dokładnym SHA, scenariuszem i zasobami; brak utraty poprawności po nasyceniu; znany czas opróżniania kolejki i koszt dodatkowej pojemności. Nie ma jeszcze podstaw do wpisania arbitralnej pojemności dzisiejszego systemu.

### Etap D — przewaga produktu

Storyboardy, automatyczne napisy, zaawansowane analityki twórcy i monetyzacja według badań potrzeb. Live, federacja i pluginy tylko wtedy, gdy odpowiadają strategii — każdy wymaga własnego modelu nadużyć, kosztów i testów.

Nie podaję kalendarza typu „zrobimy w dwa tygodnie”: nie zweryfikowano pełnego runtime ani zakresu przyszłych wymagań. Etapy mają mierzalne warunki ukończenia, co jest uczciwsze niż pozorna dokładność estymacji.

## 10. Dowody i odtwarzanie eksperymentów

Po aktywowaniu Node 22, z katalogu `/workspace/polutek-pl`:

```bash
# Aktywuj Node 22 zgodnie z .nvmrc przed uruchomieniem poleceń.
node --import tsx docs/audit/2026-11-01-platform-research/pipeline-experiments.ts
node --import tsx docs/audit/2026-11-01-platform-research/storage-experiment.ts
```

Skrypty nie łączą się z R2 ani produkcyjną bazą; wywołują wskazane klasy/funkcje z atrapami portów. Pierwszy zapisuje syntetyczne pliki tymczasowe i je usuwa. Są poza repo, bo to materiał badawczy, nie zatwierdzony zestaw regresji.

- [Kod eksperymentów pipeline](pipeline-experiments.ts), [wynik](pipeline-experiments.json).
- [Kod eksperymentu S3](storage-experiment.ts), [wynik](storage-experiment.json).
- [Skan zależności](npm-audit-production.json), [weryfikacja stron advisory](advisory-fetch.json).
- [Wyniki kontroli](checks.json), [typecheck log](typecheck.log), [Vitest JSON](vitest-results.json), [migracje](migrations-sql.json).

Weryfikacja migracji SQL pozostawiła oddzielną lokalną bazę o nazwie zapisanej w `migrations-sql.json`. Nie jest to baza produkcyjna ani skonfigurowana baza aplikacji. Nie utworzono tabeli historii migracji Prisma; przed przyszłym `migrate deploy` tej badawczej bazy nie należy traktować jako bazy zarządzanej przez Prisma.

**Co pozostaje do zweryfikowania, zanim można zamknąć ocenę runtime:** odblokowanie `binaries.prisma.sh` w ustawieniach środowiska, standardowe `npm ci`/generate, pełny typecheck, pełny zestaw jednostkowy i PG, build obu aplikacji i działające HTTP/playback. Zapisana reguła w draft nie jest zastosowaną regułą: obserwowany runtime nadal jej nie dopuszczał. Dalej potrzebne są kontrolowane staging i benchmark obu aplikacji na wspólnym scenariuszu. Te ograniczenia nie unieważniają odtworzonych problemów R02–R04, ale nie pozwalają ogłosić całości „w pełni sprawdzoną”.

## Ostateczna ocena

**Warto rozwijać Polutka. Nie ma uzasadnienia, żeby go wyrzucać i przepisywać na PeerTube. Nie ma też uzasadnienia, żeby na obecnych dowodach ogłaszać równorzędność dużej platformy.** Największa przewaga PeerTube w tym badaniu to szerszy, sprawdzalny model eksploatacji i testów wielu współpracujących komponentów. Największy potencjał Polutka to skupiony produkt i kontrola całego doświadczenia — pod warunkiem domknięcia niezawodności i mierzenia efektów.

To 22 nazwane obszary do decyzji lub poprawy, nie 22 potwierdzone exploity. Trzy kategorie błędów granicznych zostały odtworzone na kodzie; część pozostałych to świadome kompromisy, ograniczenia skali i brakujące dowody. Taki podział pozwala poprawiać projekt bez ani uspokajania się liczbą testów, ani bezpodstawnego nazywania całości słabą.
