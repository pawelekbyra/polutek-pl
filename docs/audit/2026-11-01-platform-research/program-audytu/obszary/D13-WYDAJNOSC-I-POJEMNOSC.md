# D13 — wydajność i pojemność

Partia 11, 1 listopada 2026. **W_TRAKCIE**. Polutek `c397b9e548ca2c628e21457ac69d66e54b12ddbd`, PeerTube `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`. [Zakres i hashe](../evidence/batch11-review.json), [21 scenariuszy](../SCENARIUSZE-SKALA.csv), [walidacja](../evidence/validation-batch11.json). Bez zmian aplikacji i produkcji.

Właściciel wskazał **kilkunastu twórców i 10 tys. widzów**, odpowiadając na pytanie o równoczesnych widzów w szczycie. Do liczb przyjęto roboczo 15 twórców, z zakresem 10–19. To bieżący scenariusz pojemności; długoterminowa ambicja dużej platformy pozostaje. Nie traktujemy liczby widzów jako liczby nowych wejść na sekundę ani deklaracji, że system już tyle obsłuży.

## Co wynika z kodu

Polutek ma sensowny podział: aplikacja podejmuje decyzję o dostępie i wydaje plan, a HLS dostarczają Worker i R2. Encoder jest osobnym procesem. Duża liczba oglądających nie wymaga przesyłania całego wideo przez Next.js. Nadal obciąża aplikację i DB przez otwarcia, sesje, odnowienia, zdarzenia odtwarzania, komentarze i telemetrię. Ich częstość trzeba zmierzyć oddzielnie.

| Część | Przeczytana deklaracja | Granica wiedzy |
|---|---|---|
| Aplikacja | Compose: 1 GiB, jeden serwis; dynamiczne wyszukiwanie i własny rate limit | Brak aktualnego HTTP, czasu renderowania i profilu zalogowany/gość |
| PostgreSQL | Compose: 512 MiB, shared_buffers 128 MB, max_connections 60; osobne klienty procesów | Nie czytano sekretów/URL produkcji; nie znamy faktycznych parametrów poola ani aktywnych połączeń |
| Encoder | 1500 MiB, niższa waga CPU, katalog roboczy; claim z advisory lock i globalnym NOT EXISTS świeżego RUNNING | Współdzielenie CPU z aplikacją; replika encodera nie zmienia globalnego limitu jednego zadania |
| HLS | Token sprawdzany przed cache; cache klucza obiektu wspólny między tokenami, R2 na miss | Cache lokalny dla lokalizacji; brak rzeczywistych CPU/hit ratio/limitów konta i testu 10 tys. widzów |
| Kolektor/admin | Deklarowane limity 96 MiB / 384 MiB | Rzeczywisty wspólny koszt połączeń, cronów i dysku niezmierzony |

Źródła: [Compose](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/deploy/serwerek/docker-compose.yml), [claimNext](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/infrastructure/encode-job.repository.ts#L33), [Prisma](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/prisma.ts), [Worker](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/workers/hls-edge/worker.mjs#L180). To kod deklaracji, nie odczyt działającej produkcji.

**R10:** ograniczenia obecnej topologii są potwierdzone źródłowo. Jeden encoder jest rozsądną ochroną małego hosta. Dla obecnego założenia 30 ośmiominutowych uploadów/miesiąc i niezmierzonego RTF=2 wychodzi tylko 8 godzin pracy/miesiąc. Nie ma podstaw, by z samej liczby 10 tys. widzów postulować farmę encoderów. Oddzielenie aplikacji/DB i budżet połączeń zależą od profilu żądań oraz odporności na awarie.

## Wykonany pomiar prawdziwego SQL

[Capture](../tools/search-sql-capture.cjs) wykonuje niezmienione eksportowane buildSearchSql i parser parametrów z oficjalnym zainstalowanym runtime szablonów SQL Prisma. Namespace Prisma jest jawnie dostarczony w VM badawczej; klient, dostęp do DB i DTO są odcięte. Niczego nie zainstalowano w miejsce wygenerowanego Prisma. Sześć rzeczywistych modułów TS ma kontrolę hashy baseline. [Wynik i parametry SQL](../evidence/search-sql-capture.json).

[Pomiar](../tools/search-query-plans.py) wykonuje captured SQL na istniejącym lokalnym PostgreSQL 17.11 w bazie `polutek_research_1793539467`. Tymczasowe Creator/Video z LIKE INCLUDING ALL kopiują realne indeksy/defaulty/checks, ale nie FK ani triggerów; do INSERT fixture dodano tymczasowy trigger wywołujący istniejącą funkcję public.video_search_refresh. 100 kanałów, kolejno 1000 i 10000 filmów. Po ANALYZE jeden EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) na przypadek. ROLLBACK i zamknięcie sesji usuwają tabele; brak trwałego fixture lub zmiany schematu. [16 surowych planów](../evidence/search-query-plans.json).

| Zapytanie | 1000 filmów, ms | 10000 filmów, ms | Plan i interpretacja |
|---|---:|---:|---|
| Rzadkie słowo FTS | 0,433 | 1,223 | Bitmap/index lookup; zwrócony jeden film |
| Częste słowo FTS | 16,769 | 172,963 | Bitmap, join i ranking/sort wielu kandydatów; wynik ograniczony do 21 nie ogranicza automatycznie pracy poprzedzającej sort |
| Brak słowa FTS | 0,184 | 1,230 | Zero wyników; aplikacja może następnie wykonać LIKE |
| Substring LIKE, częsty | 16,651 | 168,053 | Sekwencyjne czytanie Video, ranking i sort |
| Brak słowa LIKE | 0,333 | 3,199 | Zero wyników, sekwencyjne czytanie |
| Browse newest | 0,630 | 5,547 | Seq scan/sort w tym rozkładzie danych |
| Browse views | 0,147 | 0,132 | Indeks views + incremental sort i memoize |
| Kategoria/newest | 0,466 | 3,941 | Seq scan/sort przy połowie katalogu w kategorii |

Te pojedyncze lokalne czasy nie są p95, SLO, regresją między wydaniami ani benchmarkiem względem PeerTube. Wszystkie fixture są publiczne, aktywne, bez premier; popularne słowo występuje prawie wszędzie. Nie zmierzono rozkładu produkcyjnego, zimnego cache, wielu klientów, sieci, transakcji wrappera, kanałów pasujących nazwą, hydrate/DTO ani facets. Tymczasowe bufory i host różnią się od serwera produkcyjnego. Z tabeli nie wolno wyprowadzać liczby obsługiwanych widzów lub ekstrapolować do miliona filmów.

Wyszukiwarka ma dobre ograniczenia wejścia: 100 znaków, 6 tokenów, limit strony do 30, keyset cursor i statement_timeout 4000 ms dla statementów rankingu. Po pustym FTS może nastąpić drugie runPage z LIKE. Facets mają osobne agregacje i 60-sekundowy cache w pamięci procesu, poza tym wrapperem timeout; ich nasycenie/stampede pozostaje pytaniem. Stwierdzenie, że GIN istnieje, nie zastępuje pomiaru rankingu i popularnych słów.

## R11 — gotowość narzędzia do ponownego testu ruchu

Konfiguracja wskaźnika pojemności ma measuredAt=2026-10-04, obraz `polutek-app:m10040944`, comfortablePerSec=8 i limitPerSec=16.5. Dotyczy pięciu żądań nowego gościa, bez ciągłego HLS, mieszanki użytkowników i całego aktualnego katalogu. Nie dowodzi obecnej skali.

[Rzeczywisty summarizer na syntetycznych danych](../evidence/loadtest-summary-probe.json) zwrócił exit 0 zarówno dla poprawnego scenariusza, jak i 500/500 unexpected_status z server_errors=0 i szybkim p95. K6 rejestruje każde !=200, ale próg bezpieczeństwa dotyczy 5xx/timeout, a summarizer nie odrzuca unexpected_status. Kontrole 10% błędów serwera i zbyt wolnego p95 odrzucono exit 11/10. Nie wykonano rzeczywistych 429 ani nowego k6. Ten wynik nie podważa automatycznie historycznych odpowiedzi 200; pokazuje brak automatycznej akceptacji poprawności przed kolejnym testem.

cleanup.sh nadal szuka plain SHA256('pp-loadtest/1'). Aktualna trasa media-source używa clientFingerprint/HMAC i przekazuje wynik do utworzenia VideoPlaybackSession. Rzeczywisty hash helper z syntetycznym kluczem zwrócił inną wartość niż cleanup; to kontrola niezgodności protokołów, bez odczytu sekretu i usuwania sesji. [Hash i zakres](../evidence/search-sql-capture.json). Dokumentacja określa test jako read-only, ale wyraźnie przyznaje tworzenie sesji. Nie uruchamiano skryptów kierujących na produkcyjne nazwy kontenerów.

R11 rozszerzono o dowody narzędzi, bez nowego numeru. Przed ponownym load testem potrzebne są: poprawne statusy/treści, identyfikowalne fixture i skuteczne sprzątanie, wersja obrazu/katalogu oraz profil otwarć, oglądania, odnowień i heartbeat.

## Konkretne odniesienie do PeerTube

Przeczytano wybrane fragmenty **13 plików**, w tym źródła omówione niżej; [hashe i zakres](../evidence/batch11-review.json). PeerTube nie uruchomiono, nie zmierzono i nie kopiowano implementacji.

| Mechanizm | Wzorzec PeerTube | Zastosowanie i ograniczenie |
|---|---|---|
| Kodowanie | [JobQueue](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/job-queue/job-queue.ts) używa BullMQ i konfigurowalnego TRANSCODING.CONCURRENCY; globalConcurrencyJobTypes dotyczy wskazanej kolejki AP | Jawnie rozdziela współbieżność procesu i całej kolejki. Nie przenosić bez limitów CPU i naprawy wcześniej wykazanego R02/fencing |
| Zdalne kodowanie | [Wybór buildera](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/transcoding/create-transcoding-job.ts), zależności parent/children i runner lifecycle | Możliwość odsunięcia ciężkiej pracy od www; większy koszt protokołu, zaufania, retry i obsługi plików. Brak dowodu, że potrzebne przy 15 twórcach |
| Wyszukiwanie | Osobne [videoSearch z przechowywanym TSVECTOR/GIN](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/models/video/video-search.ts); [CTE FTS+trigram](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/models/video/sql/video/videos-id-list-query-builder.ts#L858), budowanie tsquery i ranking | Kandydat do eksperymentu z preliczonym wektorem i oddzieleniem kandydatów od szerokiego rankingu. Inna semantyka i rozszerzenia, brak dowodu szybszego SQL na równych danych |
| Repliki odczytu | Opt-in dla wybranych SELECT poza transakcją, kontrola lag, primary fallback i read-your-writes | Wzorzec planu spójności, nie samo dodanie kolejnego DB. [Router](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/database-replicas/shared/read-replica-router.ts) ma osobne pule i monitoring; [recent writes](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/database-replicas/shared/user-recent-writes.ts) zależy też od Redis i obsługi błędów |
| Procesy | Primary/secondary z podziałem odpowiedzialności, jawny DB pool.max w konfiguracji | Pomaga unikać duplikacji schedulerów. Nie dowodzi HA ani poprawności po awarii; rośnie liczba zależności i budżet połączeń |

## Weryfikacja i następny poziom

Dwa istniejące pliki Vitest: search-query — **22 passed**, channel-limits — zablokowany przez niewygenerowane Prisma przed rejestracją. Globalny exit 1; zero nieudanych zarejestrowanych assertions. [JSON](../evidence/scale-targeted-vitest.json), [log](../evidence/scale-targeted-vitest.log). Nie powtarzano pełnego zestawu, generowania ani odrzuconego npm audit. Wynik parsera nie jest testem SQL, a SQL nie jest testem endpointu.

Do uzgodnienia SLO: poprawność i p95/p99 otwarcia filmu/wyszukiwania, startup/rebuffering, odsetek nieudanych odtworzeń, wiek najstarszego joba i czas publikacji. Potem reprezentatywny stos lokalny, katalog i profile 100/1000/10000 widzów z ustaloną częstością żądań, test długotrwały, skok ruchu oraz awarie. Nie zatwierdzono ruchu na produkcji. D13 pozostaje otwarte; niezależny przegląd PENDING.
