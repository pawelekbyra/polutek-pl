# D18 — testy i proces jakości

**W_TRAKCIE**, partia 16, 2 listopada 2026. Polutek `c397b9e548ca2c628e21457ac69d66e54b12ddbd`; PeerTube `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`. Rodzic zapisu `51a0639cd48d9fb4051ed9949b1d3c3f045c286d`. Bez zmian aplikacji, produkcji, merge i prawdziwych wiadomości/płatności.

Polutek ma dużo rzeczywistych testów oraz wartościowe granice: odmowę dostępu do cudzego kanału, równoległe operacje na bazie, idempotencję płatności, wykonywanie FFmpeg i limity procesów. Nie jest to projekt pozbawiony kontroli jakości. Jednocześnie liczba plików i zielone testy nie gwarantują kompletnego produktu: brakuje pełnych E2E, część sprawdzeń bada tekst zamiast działania, a niektóre atrapy pozwalają przejść testom po wyłączeniu istotnego zachowania.

W tej partii **nie dodano nowego ID problemu**. Wzmocniono R08 i R37, zachowując ich wcześniejsze priorytety. Rozpoczęto wszystkie 18 obszarów, lecz **żaden nie spełnia jeszcze warunków zamknięcia programu**. [Plan domknięcia dowodów](../DOMKNIECIE-DOWODOW.csv) obejmuje każdy obszar; [wniosek dla właściciela](../WNIOSEK-DLA-WLASCICIELA.md) opisuje znaczenie wyników bez wymagania znajomości kodu.

## Materiał i sposób badania

- [Inwentarz AST](../evidence/test-inventory.json), [CSV plików](../TESTY-INWENTARZ.csv), [skrypt](../tools/test-inventory.cjs). Odczyt śledzonych testów i konfiguracji; zero diagnostyk parsera. Nie uruchamia testów, nie jest typecheck ani ręcznym audytem 547 plików.
- [Osiem prób jakości istniejących testów](../evidence/test-oracle-probe.json), [skrypt](../tools/test-oracle-probe.py), [scenariusze](../SCENARIUSZE-JAKOSC.csv). Vitest **4.1.10**, Node 22, rzeczywiste testy bez zmian, minimalna konfiguracja w temp, zależności udostępnione przez symlink. Kontrolowane zmiany dotyczą tylko kopii źródeł w temp. Nie zmieniono zainstalowanego klienta Prisma, repo aplikacji ani testów.
- [Warstwy i granice](../WARSTWY-TESTOW.csv), [zakres/hash ręcznego przeglądu](../evidence/batch16-review.json), [brak zmian aplikacji](../evidence/source-scope-batch16.json), [walidacja materiału](../evidence/validation-batch16.json).
- [Interpretacja historycznych wyników](../evidence/test-run-interpretation.json) czyta zachowany wynik wcześniejszego pełnego Vitest; **nie uruchamia go ponownie**. Nie powtarzano generowania, npm audit, budowy, SQL i przeglądarki z poprzednich partii.

Pierwszą próbę mechanicznego inwentarza zatrzymał lokalny `spawnSync git EPERM`; [diagnoza](../evidence/test-inventory-initial-diagnostic.json). Normalna zatwierdzona ścieżka wykonania pozwoliła zakończyć odczyt. W metadanych nowej próby poprawiono też początkowe utożsamienie deklaracji `^4.1.7` z faktycznym runnerem 4.1.10; wyniki testów i logi nie zostały przez to zmienione. To diagnostyka badania, nie nowe defekty produktu.

## Co wynika z inwentarza, a co nie

| Pomiar statyczny | Wynik | Znaczenie |
|---|---|---|
| Śledzone pliki testów | 547: 533 unit, 2 integration, 12 postgres | Katalog jest wskazówką organizacyjną, nie dowodem poziomu integracji |
| Selekcja konfiguracji | Default Vitest wybiera 535 plików, postgres config osobne 12 | Wybranie pliku nie oznacza jego wykonania lub sukcesu |
| Literalne deklaracje testów | 4214 | AST nie rozwija parametrów, pętli, skip i dynamicznej rejestracji; to nie liczba wykonanych testów |
| Pliki z vi.mock/doMock | 275 | Atrapy pomagają izolować funkcje; sam ich udział nie jest miarą dobrej lub złej jakości |
| Pliki z odczytem filesystem | 58 | Odczyt może dotyczyć tekstu źródła lub prawdziwego fixture; nie uznano wszystkich za testy statyczne |
| Pliki z wykrytym markerem skip | 3 | Nie jest to liczba testów pominiętych podczas wykonania; aliasy i środowisko wymagają oceny |
| Markery only/todo | Nie znaleziono w badanej składni | To kontrola składni, nie gwarancja kompletności testów |

Konfiguracja coverage obejmuje wzorce dla API/modułów/usług/helpers i części panelu. W mechanicznym zbiorze 1145 śledzonych plików JS/TS z katalogów aplikacji do tych wzorców pasuje 586. **To liczba ścieżek pasujących do konfiguracji, nie 51% pokrycia kodu.** Poza tym zakresem są m.in. duże części UI, workerów, kolektora i helperów. Mogą mieć testy, choć nie należą do tego raportu coverage. Nie znaleziono jawnych progów `thresholds` w badanym config. Nie wykonano nowego pomiaru procentów ani nie ustalono na tej podstawie minimalnego potrzebnego procentu.

Historyczny pełny wynik zawiera 535 rekordów plików: 304 passed, 12 failed z zarejestrowanymi assertions oraz 219 failed bez zarejestrowanych assertions. Łącznie zarejestrowano 2602 testy: 2556 passed, 35 failed, 11 pending; cały przebieg nie jest zielony. Zagnieżdżone suites nie są liczbą plików. Wśród pustych wyników 136 wprost zgłasza brak inicjalizacji Prisma, inne m.in. brak enumów, validatora lub problem mocka. Nie utożsamiać 219 plików albo 35 nieudanych assertions z tyloma potwierdzonymi błędami produkcji. Także wyniki nowych celowanych podzbiorów nie zastępują tamtej blokady.

## Co wykrywają istniejące testy — próby na kopiach

| Przypadek | Wynik rzeczywistego Vitest | Wniosek |
|---|---|---|
| Health token, oryginał | 6 passed, exit 0 | Prawidłowa kontrola bazowa |
| Health token, celowe akceptowanie różnych wartości | 2 failed, exit 1 | Istniejące testy wykrywają ten błąd odmowy |
| Health token, celowe akceptowanie braku tokenu | 4 failed, exit 1 | Negatywne przypadki rzeczywiście chronią granicę |
| Health helper, zwykłe `===` zamiast delegowania do comparatora | 6 passed, exit 0 | Testy odpowiedzi logicznych nie wykazują stałego czasu działania. Nie zmierzono timing attack ani podatności oryginalnego kodu |
| Statyczny podzbiór ops, oryginał | 7 passed, 17 celowo odfiltrowanych, exit 0 | Sprawdza obecność struktur/tekstu |
| Ten sam statyczny podzbiór, `exit 0` przed działaniem kopii deploy | 7 passed, 17 odfiltrowanych, exit 0 | Zachowanie można zepsuć bez zmiany sprawdzanego tekstu. Nie ogłaszamy, że pominięte testy wykonania też tego nie wykryją |
| Weryfikator restore, oryginalne cztery testy | 4 passed, exit 0 | Badają preflight/logowanie i redakcję z atrapą process.exit |
| Weryfikator restore, właściwe sprawdzanie DB wyłączone przez return | 4 passed, exit 0 | Te cztery testy nie potwierdzają wykonania weryfikacji DB; wzmacnia R37 |

Logi i oryginalne raporty każdego przebiegu są podlinkowane z JSON. Dwa niezerowe wyniki mutantów są **oczekiwanym dowodem wykrycia kontrolowanego błędu**, nie awariami niezmienionej aplikacji. Nie sumujemy powtarzanych assertions jako nowych testów. Nie wyliczono globalnego mutation score: pięć ręcznie dobranych zmian nie jest reprezentatywną próbą całego projektu.

## R08 — gdzie kończy się dzisiejszy dowód działania

`playwright.config.ts` nadal wskazuje brakujący `tests/e2e`, bez śledzonych scenariuszy tego katalogu. Bazowy raport zachowuje wcześniejszy wynik `e2e:list`; nie ponawiano go bez zmiany źródeł. Sam walidator środowiska E2E istnieje. Konfiguracja może uruchamiać serwer dev z `ENABLE_DEMO_FALLBACKS=true`, co wymaga jawnego wyłączenia/rozróżnienia w przyszłych testach produktu. Nie uruchamiano takiego serwera.

`test:critical-path` wskazuje dwa pliki, z których `tests/unit/architecture/post-merge-state-reconciliation.test.ts` nie istnieje. Nie zastąpiono go automatycznie podobnie nazwanym plikiem. To źródłowa niespójność ścieżki, nie dowód, że cały command wykonuje zero testów albo że drugi plik jest bezwartościowy.

Istniejący `launch-candidate-critical-path.test.ts` wykonuje wiele prawdziwych use case'ów płatność → grant → dostęp → plan playback. To przydatna integracja komponentów. Baza jest jednak Map, `$transaction` wywołuje po prostu callback, Redis/metryki/poczta są atrapami; część UI sprawdza tekst źródeł. Nie dowodzi rollback PostgreSQL, poziomu izolacji, dostarczenia webhooka ani odtworzenia filmu w przeglądarce. Nie wykonywano tego zablokowanego podzbioru ponownie.

Z drugiej strony `tests/postgres/payments.pg.test.ts` ma rzeczywiste transakcje i jednoczesne fulfillment, z atrapą Stripe/poczty. Kolejka encode ma prawdziwy claim/requeue i testy współbieżności, DurableJob — claim/fencing/retry. To wartościowa oddzielna warstwa, której nie należy zastępować samymi E2E. Bieżące wykonanie przez wygenerowany Prisma pozostaje niepotwierdzone. Wcześniejsze surowe protokoły SQL są dowodem na innym poziomie.

`tests/integration/email-event-idempotency.test.ts` wymaga `RUN_INTEGRATION_TESTS=true`, inaczej obie deklaracje są `it.skip`. W badanym workflow flagi nie ma, a osobny config postgres wybiera wyłącznie `tests/postgres`. Nie znaleziono w tych ścieżkach automatycznego włączenia obu testów. Mogą być uruchamiane ręcznie; aktywnego procesu nie odczytano. Importy na poziomie modułu mogą nadal wymagać Prisma nawet przy skip.

Smoke FFmpeg ma rzeczywiste procesy, fixture wideo, kontrolę ladder/formatu i tryb wymagający narzędzi. Testy limitów uruchamiają prawdziwy subprocess i sprawdzają timeout/rozmiar/abort. Nie oznacza to testu całej drogi upload → R2 → finalizacja → widz. Osobna próba Chromium z D15 również sprawdziła komponenty, nie pełną aplikację.

## Atrapy, kontrakty i polityka

Największym problemem nie jest samo użycie mocków. Trzeba wiedzieć, której własności nie odtwarzają: transakcja bez rollback, licznik bez współbieżności, signer bez rzeczywistego Workera, fetch z JSON-em pasującym do typu, process.exit który wraca. R21 i R34 opisują odpowiednio rozproszone kontrakty oraz sprzężenie importu z domyślną bazą. Nie naprawiano tego w celu uzyskania zielonego wyniku.

R37 ma już prawdziwe próby procesu z partii 15, w których konkretne błędne przypadki kończą się sukcesem. Obecna próba pokazuje, dlaczego cztery dotychczasowe testy nie są zabezpieczeniem tych przypadków. Nie jest to kolejne osobne znalezisko za tę samą lukę.

Test może też dobrze chronić świadomy kompromis, którego właściciel nie chce w docelowym produkcie. Przykład: istniejące assertions rate-limit sprawdzają przepuszczenie żądania przy błędzie Redis. To nie jest „źle napisany test”, lecz zakodowana polityka R14, którą należy ocenić oddzielnie. Sam zielony wynik nie potwierdza właściwej polityki bezpieczeństwa ani specyfikacji biznesowej.

Domyślne local-ci uruchamia related tests oraz sprawdzenia czytające pliki. To rozsądne przyspieszenie, ale nie to samo co pełny zestaw z coverage, PostgreSQL i build. Istnieją też jawne skip z braku usług i `--passWithNoTests`; tabelę wyników trzeba czytać razem z zakresem. D17 opisuje strict/full i powiązanie z obrazem. Nie uznano samej obecności tych opcji za nowy defekt.

## Konkretne wzorce z PeerTube

| Wzorzec i przypięte źródło | Co warto przenieść | Granica porównania |
|---|---|---|
| [API HLS](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/transcoding/hls.ts) | Upload przez klienta API, oczekiwanie na zadania, kontrola playlist/segmentów i sprzątania, warianty concurrency/storage | Dwa serwery i opcjonalny mock object storage; nie certyfikacja każdego realnego providera |
| [Kontrola segmentów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/shared/streaming-playlists.ts) | Sprawdzenie danych Range/206 i hash segmentu, a nie tylko istnienia URL | Bez wykonania; hash nie zastępuje kontroli dostępu i dekodowania |
| [Runner shutdown](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/peertube-runner/shutdown.ts) i helper procesu | Uruchomienie prawdziwego procesu, zatrzymanie przy aktywnych zadaniach, stany ukończone/oczekujące | Nie wykazano odporności na każdy crash, utratę sieci lub awarię bazy |
| [Prywatny playback w przeglądarce](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/client/e2e/src/suites-all/private-videos.e2e-spec.ts) | Sprawdzenie postępu currentTime po logowaniu i różnych ścieżek HLS/embed | currentTime nie dowodzi braku wszystkich zacięć, jakości obrazu lub działania na każdym urządzeniu |
| [Publikacja](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/client/e2e/src/suites-local/publish.e2e-spec.ts), WDIO | Zadanie człowieka: upload, edycja, odświeżenie, widoczność danych w playerze | Testy mają stan i kontekst przeglądarki; nie deklarujemy doskonałej izolacji ani braku flaky tests |

PeerTube używa tutaj WebdriverIO/Mocha, Polutek ma konfigurację Playwright — nie ma potrzeby zmiany frameworka dla zgodności z konkurentem. Warto przenieść rodzaj dowodu i przygotowanie danych/usług. [Zakres dziesięciu źródeł](../evidence/batch16-review.json), brak instalacji/wykonania PeerTube i wspólnego benchmarku.

Oficjalne [Playwright Best Practices v1.61.1](../sources/playwright-best-practices.md), Microsoft/Playwright Contributors, wspiera sprawdzanie zachowania widocznego użytkownikowi, izolację testów, kontrolowane dane oraz atrapy usług zewnętrznych. Przeczytano wybrane sekcje, nie całą dokumentację. [Apache License 2.0](../sources/playwright-LICENSE), [HTTP 200/hash](../sources/fetch-testing-batch16.json). To zalecenia narzędzia, nie automatyczny certyfikat produktu.

## Jak oceniać kolejne dowody

Minimalny przebieg akceptacyjny musi wskazać: wersję kodu i artefaktu, uruchomione komponenty/usługi, dane, liczbę rzeczywiście wykonanych przypadków, skipped i przyczynę, błędy importu vs assertions, oczekiwaną odmowę, trwały skutek w DB/storage, cleanup oraz co pozostało atrapą. Retry przechodzący po błędzie powinien zachować pierwszy wynik; nie utożsamiać go z bezwarunkowo stabilnym przebiegiem.

Plan [DOMKNIECIE-DOWODOW.csv](../DOMKNIECIE-DOWODOW.csv) rozdziela wszystkie D01–D18 i zależności przygotowania środowiska. Nie obiecuje, że kilka nowych E2E zastąpi 290 niezakwalifikowanych wymagań ASVS, 207 nierozpoczętych rekordów wejść, testy awarii i niezależny przegląd. Następna praca to systematyczna kwalifikacja wymagań i wejść, równolegle do odblokowania pełnego runtime przez wspieraną konfigurację środowiska; bez obchodzenia proxy, generowania „na niby”, wdrożenia lub napraw aplikacji w tym trybie.
