# Postęp realizacji roadmapy — H1

## Wznowienie właściciela — 6 listopada 2026

Właściciel wznowił realizację i polecił wykonać całą roadmapę. Historyczny STOP z 4 listopada nie obowiązuje od tego polecenia; pozostaje niżej jako zapis. Praca jest tylko w lokalnym worktree `/opt/codex/polutek-pl/.worktrees/platform-audit`, gałąź `docs/polutek-platform-audit`, bez publikacji, PR, wdrożeń ani dostępu do produkcji.

Punkt bazowy odświeżono przez lokalne scalenie `origin/main` (`e2d33e0e`) do gałęzi audytu, commit **`7e6f5335`**. Pełne `npm run quality` na dokładnym drzewie tego merge: architektura PASS, typecheck PASS, **564 pliki testowe PASS, 1 pominięty; 4980 testów PASS, 2 pominięte**, exit 0. Vitest trwał 493,89 s; nie uruchamiać go ponownie bez zmiany kodu lub konkretnej przyczyny. To bazowa kontrola zintegrowanego drzewa, nie zamknięcie pakietu napraw.

`origin/main` ma Next i eslint-config-next **16.4.4**; gałąź napraw podnosi je do **16.4.5** w lokalnym commicie `e2cb87d9`. K02 pozostaje niezamknięte bez pełnego przeglądu zależności i dowodu obrazu. W toku pozostaje K06: konsumenci wydania i rzeczywiste pięć obrazów. K01/K03 mają udokumentowane częściowe dowody, lecz pełny cykl API/worker/HLS/storage nadal nie jest odebrany. Cała roadmapa nadal ma 40 pakietów i żaden nie jest formalnie zamknięty.

**K02 — nowy dowód 6 listopada:** po rozbieżności między `node_modules` a lockfile odtworzono zależności z lockfile. Na Next **16.4.4**, sharp **0.35.5**, librsvg **2.63.2** i vips **8.18.7** przeszedł izolowany rzeczywisty Next image runtime: legalny PNG 200, SVG/uszkodzony obraz/niezatwierdzony host 400. Surowy wynik, log, SHA źródeł i zakres: [evidence](program-audytu/evidence/k02-runtime-2026-11-06/result.json). Odtworzenie użyło `npm ci`, które automatycznie uruchomiło nieprzejrzany audit i wyświetliło podsumowanie podatności; **nie jest to dowód audytu K02**, nie ponawiać go ani `npm ci` bez `npm_config_audit=false` do czasu rozwiązania blokady polityki uploadu grafu. K02 nadal nie ma dowodu aplikacyjnego obrazu ani reviewed audit.

**K02 — dowód Next 16.4.5, 6 listopada:** po sprawdzeniu nowych advisories podniesiono Next i eslint-config-next z 16.4.4 do 16.4.5 (`e2cb87d9`); instalacja została wykonana z `npm_config_audit=false`. Na Next **16.4.5**, sharp **0.35.5**, librsvg **2.63.2** i vips **8.18.7** przeszedł izolowany rzeczywisty Next image runtime: legalny PNG 200, SVG/uszkodzony obraz/niezatwierdzony host 400. Na tym samym SHA: 9 plików testów K02 **179/179**, typecheck i oba buildy PASS, w tym standalone admin bez ostrzeżenia śledzenia całego repo. Surowe wyniki i logi: [evidence 16.4.5](program-audytu/evidence/k02-runtime-2026-11-06-next-16.4.5/result.json). Starsze dowody 16.4.4 zachowano jako historię. Przy wcześniejszym `npm ci` automatycznie uruchomił się nieprzejrzany audit; nie traktujemy jego podsumowania jako wyniku i nie ponawiamy go. K02 nadal nie ma reviewed audit ani dowodu poprawionych zależności w obrazie aplikacyjnym.

## K07 — limity body przed parserem (częściowo)

Commity `b8b5d4dd` i `3dc8fb29` wprowadziły ograniczone czytniki JSON/FormData i stałe bloki 64 KiB. `c3c2c6c1` ustawił budżet kompletnego uploadu na 6 MiB, zachowując legalny payload 10 000 części (4 299 010 B); `1f467577` ustawił bufor Next proxy na 7 MiB. Powód: domyślny bufor Next 16.4.5 to 10 MiB i może kontynuować trasę po przekazaniu obciętego body.

Na aktualnym kodzie: 9 plików testów **111/111 PASS**, repo typecheck, ESLint, `git diff --check` i public/admin build PASS. Regresja Next: 13 MiB+1 bez `Content-Length` przy tymczasowym limicie aplikacji 13 MiB dało 303 po parsowaniu częściowej formy; limit 6 MiB odrzucił ten sam strumień kodem 413. Zoptymalizowany Next skonfigurowany na 7 MiB również zwrócił 413. Node-only pomiar 16 × 6 MiB+1 dał 16/16 413, RSS +137 420 800 → +127 262 720 B, czas 578 → 286 ms. Lokalna fixture trasa przez zoptymalizowany Next: 16 × 6 MiB+1 chunked bez `Content-Length`, **16/16 413**, RSS procesu +136 695 808 B, 1 398 ms ([wynik](program-audytu/evidence/k07-body-limits-2026-11-06/next-concurrent-6mb.json)). Fixture usunięto po pomiarze.

K07 pozostaje otwarte: nie zmierzono zewnętrznego Cloudflare Tunnel ani budżetu całego produkcyjnego stosu ([inwentaryzacja proxy](program-audytu/evidence/k07-body-limits-2026-11-06/proxy-inventory.json)). Pełne dowody i granice: [pakiet K07](program-audytu/evidence/k07-body-limits-2026-11-06/). Następny krok: dozwolony test zewnętrznego proxy w środowisku nieprodukcyjnym; bez takiej konfiguracji kontynuować niezależne pakiety.

## K10 — ukryta przyszła premiera ujawniała metadane (częściowo)

Dodano kontrolę `NOT_FOUND` przed bramką przyszłej premiery w `PlaybackService`. Testy RED potwierdziły błąd: gość dostawał `LOGIN_REQUIRED`, a zalogowany obcy `COMING_SOON` dla filmu oznaczonego `REMOVED`. Po zmianie oba dostają ogólne `UNAVAILABLE` bez tytułu, plakatu, terminu, źródła ani sesji. Legalna premiera zachowuje wcześniejszą obsługę.

Weryfikacja lokalna: 3 celowane pliki **18/18 PASS**, ESLint, repo typecheck i publiczny Next build PASS. Dowody z komend i granic: [K10](program-audytu/evidence/k10-hidden-premiere-2026-11-06/result.json). K10 pozostaje częściowe: brak rzeczywistego HTTP i macierzy ról/sesji; nie badano dostępu do HLS.

## K13 — błędy S3 przy usuwaniu obiektów (częściowo)

Odtworzono R04 testami RED: `DeleteObjects` HTTP 200 z `AccessDenied` był ignorowany, licznik zwracał wszystkie żądane klucze, a `SlowDown` nie było ponawiane. `HlsWriter.deletePrefix()` odczytuje teraz wyniki per klucz, liczy wyłącznie potwierdzone usunięcia, ponawia wyłącznie przejściowe błędy (maks. 3 próby), traktuje brakujący obiekt idempotentnie, a trwałe błędy raportuje przez `R2DeleteObjectsError` po przetworzeniu stron listy.

Weryfikacja lokalna: 2 pliki **14/14 PASS**, ESLint i repo typecheck PASS. Dowody: [K13](program-audytu/evidence/k13-r2-delete-2026-11-06/result.json). K13 pozostaje częściowe: brak sandboxa R2/S3 oraz niezależnego drugiego przeglądu R04.

## K14 — uploady kończą się przed cleanup (częściowo)

Odtworzono R03: szybka awaria jednego PUT pozwalała rozpocząć cleanup, kiedy inny transfer nadal trwał. Pula zatrzymuje dalsze przydzielanie, przerywa aktywne żądania sygnałem `AbortSignal` i czeka na zakończenie wszystkich rozpoczętych PUT przed cleanup. Sygnał uploadu jest odrębny od anulowania zadania, więc chwilowy błąd nadal kwalifikuje job do retry. `HlsWriter` przekazuje sygnał do AWS SDK i sprząta strumień pliku.

Wynik RED→GREEN z opóźnionym sukcesem i błędem; dodatkowo sprawdzenie braku kolejnych przydziałów oraz przekazania sygnału do S3. 2 pliki testów **23/23 PASS**, ESLint i repo typecheck PASS. Dowody: [K14](program-audytu/evidence/k14-upload-cleanup-2026-11-06/result.json). K14 częściowe: brak sandboxa R2/S3, potwierdzenia zachowania abort po stronie dostawcy i niezależnego przeglądu.

## K15 — monotoniczne ukończenie wersji oryginału (częściowo)

Test RED odtworzył cofnięcie `activeOriginalId`, gdy retry v1 zdążył odczytać `READY`, a potem v2 się ukończył. Ukończenie i replay używają teraz wspólnej blokady PostgreSQL per film oraz świeżego odczytu statusu i wersji. Aktywacja oryginału i stworzenie `VideoEncodeJob` są atomowe; retry `READY` nadal odzyskuje historyczny brak joba, ale tylko dla wersji, która nie została zastąpiona. Spóźnione ukończenie starszego uploadu zamyka go jako `SUPERSEDED` i nie tworzy kolejki.

Przez właściwy endpoint Studio z rzeczywistym PostgreSQL 17 i barierą wykonano **4/4** przypadki: retry v1 po v2, odzyskanie brakującego joba/idempotentny replay, spóźniony upload v1 oraz kontraktowe odpowiedzi start-upload/pipeline. W unit **28/28 PASS**, ESLint i repo typecheck PASS. Dowody: [K15](program-audytu/evidence/k15-monotonic-original-2026-11-06/result.json). Sesja i R2 były kontrolowane; brak sandboxa R2 i niezależnego przeglądu, zatem pakiet częściowy.

## K16 — tożsamość i prefiksy próby kodowania (częściowo)

Nowy claim zapisuje `attemptId` UUID; proces używa go spójnie w katalogu roboczym, ścieżkach uploadu i weryfikacji HLS, finalizerze, logach oraz cleanup. Każda próba ma osobny prefiks, a sprzątanie usuwa tylko prefiks właściciela. Migracja blokuje claim `RUNNING` bez ID, pozostawiając heartbeat już działającego historycznego zadania bez `attemptId`.

Na tymczasowym PostgreSQL 17 zastosowano **82 migracje**. Test integracyjny potwierdził odmowę starego claimu, różne prefiksy po ponowieniu, heartbeat legacy joba i odzyskanie po wygaśnięciu bez utraty `activeOriginalId` (**1/1 PASS**). Testy unit **53/53**, ESLint, `prisma validate` i repo typecheck PASS. Dowody: [K16](program-audytu/evidence/k16-attempt-isolation-2026-11-06/). Nie wykonano wygaszenia workerów w prawdziwym środowisku, testu R2 ani niezależnego przeglądu; fencing skutków starego workera pozostaje osobnym K17.

## K17 — atomowe odcięcie skutków starego workera (częściowo)

RED na prawdziwym PostgreSQL wykazał, że po przejęciu joba i finalizacji przez B stary A wciąż mógł zastąpić aktywną trasę. Aktywacja teraz blokuje i sprawdza `jobId + workerId + attemptId` w tej samej transakcji; odświeża tam heartbeat. Każdy zapis postępu, sukcesu, błędu/retry, anulowania i zwolnienia również sprawdza token próby. Gdy poprzednia próba zatwierdziła już trasę, retry może odnaleźć aktywny output z dowolnego prefiksu tej generacji.

Integracja K17 i repozytorium na PostgreSQL 17: **12/12 PASS** przy 82 migracjach; testy unit **34/34**, ESLint i repo typecheck PASS. Dowody: [K17](program-audytu/evidence/k17-stale-worker-fencing-2026-11-06/). Sekwencja takeover była kontrolowana w teście, bez dwóch niezależnych procesów i fizycznego R2. Brak pełnego buildu i niezależnego przeglądu; te granice nadal są otwarte.

## K18 — granica COMMIT i ochrona aktywowanego HLS (częściowo)

Obowiązkowy wpis audytu aktywacji trasy przeniesiono do tej samej transakcji co zmianę trasy, aktywnego wskaźnika i primary assetu. Finalizer uzgadnia utracone potwierdzenie COMMIT; jeśli odczyt bazy jest niedostępny, rzuca jawny błąd nieznanego wyniku, a proces kodowania zachowuje pliki HLS do kolejnego retry. Ponowienie uznaje wcześniejszy wynik tylko po rekurencyjnym sprawdzeniu mastera, playlist wariantów, URI w tagach i obiektów segmentów w R2; niekompletny output nie kończy joba sukcesem.

Weryfikacja na disposable PostgreSQL 17 po zastosowaniu **82 migracji**: **4/4 integracyjne** (K18: rollback audytu dla nowego i istniejącego assetu, utracone potwierdzenie COMMIT; regresja K17). Unit **52/52** w 13 plikach, ESLint zmienionego zakresu i repo typecheck PASS. JSON wyników i log migracji: [dowody K18](program-audytu/evidence/k18-finalizer-audit-2026-11-06/). Brak fizycznego sandboxa R2 i testu dwóch niezależnych procesów; niekompletna zawartość jest pokryta testem logiki, nie magazynem dostawcy. K18 pozostaje częściowe do niezależnego przeglądu i odbioru tych granic.

## K19 — wspólny protokół aktywacji i wycofywania HLS (częściowo)

Aktywacja trasy i rezerwacja cleanupu współdzielą blokadę wiersza filmu. Usuwanie najpierw atomowo wyłącza trasę aktywnego assetu szkicu, ustawia `cleanupPendingAt`, zapisuje audyt i wstawia `VIDEO_ASSET_CLEANUP`; aktywny asset filmu PUBLISHED/UNLISTED jest odrzucany. Addytywny trigger PostgreSQL sprawdza zarezerwowany asset przed utworzeniem/reaktywacją trasy, także gdy wywołuje ją stary kod. Usunięcie R2 działa poza transakcją; asset i końcowy audit są kasowane/zapisywane dopiero po potwierdzonym DeleteObjects. Awaria częściowa pozostawia job i rezerwację do idempotentnego retry.

W PostgreSQL 17 po **83 migracjach**: **4/4 testy K19** (cleanup-first, stary klient przez trigger, aktywny PUBLISHED/UNLISTED, DRAFT detach i retry po partial delete) oraz K17/K18 regresje **8/8 łącznie**. Unit **48/48**, ESLint, repo typecheck, `prisma validate` i `git diff --check` PASS. Dowody: [K19](program-audytu/evidence/k19-activation-cleanup-2026-11-06/). Storage jest fake; migrację trzeba aktywować po wygaszeniu starych procesów, bo poprzednia ścieżka kasowała R2 synchronicznie. Brak sandboxa R2 i niezależnego przeglądu; K19 pozostaje częściowe.

## K20 — kontekst właściwego kanału podczas auto-publish (częściowo)

Finalizer po aktywacji trasy ponownie odczytuje job z warunkiem aktualnego `RUNNING + workerId + attemptId` i relacją do filmu. `channelId` pochodzi z `video.creatorId`; jeśli denormalizowany `job.channelId` nie zgadza się z relacją albo odczyt ownera zawiedzie, publikacja jest wstrzymana. Weryfikacja kanału i filmu odbywa się w kontekście tego kanału, nie `main`; publikacja nadal używa standardowych use case'ów `publishAdminVideo`/`unlistAdminVideo` oraz `authorize()`. Kanały usunięte lub poza `ACTIVE`/`LIMITED` są odrzucane. Use case zwraca `published`, `unlisted`, `waiting`, `skipped`, `refused` albo `failed`; worker loguje wynik.

Testy jednostkowe: **24/24 PASS** w dwóch celowanych plikach, w tym niegłówny twórca, status zawieszony, niezgodność relacji job–video, kanał główny i dotychczasowe przypadki widoczności; ESLint, repo typecheck i `git diff --check` PASS. Siedem testów finalizera przeszło na prawdziwym PostgreSQL 17 po zastosowaniu 83 migracji: dwa kanały niegłówne, PUBLIC/UNLISTED, kanał zawieszony/usunięty, niezgodny job, main i stary token. Użyto osobnego, tymczasowego kontenera i zatrzymano go po teście; nie dotknięto istniejących kontenerów. Dowody: [K20](program-audytu/evidence/k20-channel-auto-publish-2026-11-06/result.json). Test obejmuje finalizer i bazę, nie pełny osobny proces workera; nie ma też próby wyścigu zawieszenia kanału między odczytem statusu a publikacją ani niezależnego przeglądu. K20 pozostaje częściowe.

## K21 — wspólne kontrakty JSON upload/job/playback (częściowo)

Dodano czysty moduł `lib/video-api-contracts/contracts.ts` (Zod i wyłącznie typowy import DTO odtwarzania) ze schematami multipart, pipeline Studio/admin i planu playback. Klient Studia, oba uploadery, panel admina i konsumenci planu odtwarzania walidują odpowiedzi na granicy; nieznany status lub zła struktura nie przechodzą jako typowane dane. Błędny 200 w uploadzie Studia staje się `API_CONTRACT_MISMATCH`/502, a niepoprawna odpowiedź multipart zatrzymuje przepływ przed kolejnym requestem lub PUT. Istniejące URL-e pozostają bez zmian, pola rozszerzające DTO są dopuszczone.

Celowane testy granic: **18/18 PASS**. Testy handlerów Studio i media-source: **53/53 PASS** w czterech plikach. Test Studio upload/pipeline używa rzeczywistych handlerów, use case'ów i PostgreSQL 17 po 83 migracjach; **4/4 testy pliku K15 PASS**, w tym starszy generyczny klient Studia i odpowiedź z dodatkowymi polami. Playback: **1/1** test handlera z prawdziwym `PlaybackService` i PostgreSQL PASS; lokalny Next.js 16.4.5/HTTP zwrócił 403 `LOGIN_REQUIRED` zgodne z `PlaybackPlanResponseSchema`. Autoryzowany GET Studio pipeline przeszedł przez Next HTTP i disposable PostgreSQL: **200**, `NO_ORIGINAL`, kontrakt poprawny; użytkownik, sesja i film były syntetyczne i usunięte po teście. R2 i limiter są kontrolowane. Repo typecheck i ESLint bez błędów (4 ostrzeżenia `react-hooks/set-state-in-effect` w szerszym zestawie); `git diff --check` PASS. Dowód: [K21](program-audytu/evidence/k21-contract-boundary-2026-11-06/result.json). Brakuje testu multipart upload przez żywy HTTP z realnym R2 oraz niezależnego przeglądu; dlatego K21-T1/T2 pozostają częściowe, a R21 nie jest zamknięte. Przy playback Next 16.4.5 wypisał ostrzeżenie `sync-dynamic-apis` w `lib/utils/correlation.ts:getCorrelationId()`; żądanie zakończyło się poprawnie, problem pozostawiono do serwerowego przeglądu Claude'a.

K02-T2 uzupełnione na SHA `d6f0d33c`: dziewięć celowanych plików testów **179/179**, trzy regresyjne fixture UI **25/25**, lint i repo typecheck PASS; buildy strony i panelu admina na Next 16.4.4 exit 0. Build ujawnił i doprowadził do naprawy czterech błędów typów istniejących fixture’ów — nie wyłączono typecheck. Pełne logi: [build-result](program-audytu/evidence/k02-runtime-2026-11-06/build-result.json). Ostrzeżenie admina o dynamicznym śledzeniu całego projektu naprawiono w `7d97d067`; standalone build zakończył się bez niego i nie dołączył źródeł `.ts/.tsx/.md` do app tree ([dowód](program-audytu/evidence/admin-standalone-trace-2026-11-06/result.json)). To nie jest build Docker image. Brak reviewed audit i dowodu rzeczywistych obrazów, zatem K02 pozostaje otwarte.

**Zapisane prace K06 — wznowienie po otwartych pomiarach K07:** `578cfd6b` podłączył proof do deploy/rollbacku, transferu lokalnego/GitHub i telemetrii; `64671a16` przeniósł kontrolę wejść przed GitHub CLI; `6f393985` usunął ruchome fallbacki compose; `371a03ce` dodał hermetyczne testy transferu; `cf8d1bbe` chroni jednorazowe narzędzia operatora; `227b5c37` pozwala używać cache bez GHCR tylko przy zgodnym niezmiennym ID. Runbooki odtworzenia oznaczają granicę starej produkcji i kandydata K06.

Dowody: lokalny handoff oraz GitHub Actions wariant przeszły **6/6** testów przez atrapowy SSH; błędny hash, SHA, run, brak artifactu i zły head run kończą się bez SSH. `deploy-release`/artifact/handoff: **10/10 PASS** (w tym cache miss wymusza pull wszystkich zatwierdzonych digestów przed tagowaniem); skrypty serwera **44/44 PASS**; narzędzia operatora **48/48 PASS**. Łącznie pięć wcześniejszych zestawów przeszło **102/102 PASS**. Po dodaniu scenariusza dumpu cały plik `serwerek-scripts.test.ts` przeszedł **45/45, zero skip**; cztery negatywne scenariusze dumpu, migracji, startu/rollbacku app i admina są opisane w [wyniku](program-audytu/evidence/k06-deployer-failures-2026-11-06/). ESLint, `bash -n`, YAML parse i `git diff --check` PASS. `docker compose config` nie dał się uruchomić z powodu braku serwerowego `db.env`; YAML został sparsowany osobno. Nie uruchamiano Actions, GHCR, prawdziwego SSH ani serwera. Commity tylko lokalnie, brak push.

K06 nadal nie jest zamknięte: brak odbioru pięciu rzeczywistych obrazów, pełnego produktu/runtime, prób prawdziwego rollbacku i pełnej bramki wydania. Dostępne testy przekazania kończą się na atrapie SSH; nie dowodzą zachowania serwera. K01/K02/K03, K05 i decyzje DP01–DP09 pozostają otwarte. Całość szacunkowo **16–18%** pracy implementacyjnej; K20 ma kod i kontrolowane testy, ale wymaga jeszcze realnego PostgreSQL/worker acceptance, a żaden pakiet nie jest formalnie zamknięty.

**Następny krok:** domknąć K21 przez odbiór działających tras upload/job/playback oraz zgodnego starszego klienta; K20 wymaga odrębnego przeglądu i testu wyścigu zmiany statusu kanału. K13/K14/K15/K16/K17/K18/K19 nadal wymagają odbioru sandboxowego i niezależnego przeglądu; K16 i K19 wymagają kontrolowanego wygaszenia starszych procesów przed migracją/wznowieniem żądań. K07 — nieprodukcyjny test zewnętrznego proxy. K11 wymaga jawnego kontraktu wkładów płatności oraz read-only raportu historycznych niejednoznaczności; nie cofać istniejących praw automatycznie. K06/K02 nadal wymagają obowiązkowej bramki `audit` i odbioru rzeczywistych obrazów. Bez push/PR/merge/deploy.

## K06 — GHCR images workflow, część 1

Zastąpiono bezpośrednie build-and-push czterech obrazów ścieżką `release-produce` → lokalne `verify` → publikacja pięciu obrazów zwróconymi ID → pull i sprawdzenie digestów → kompletny proof do artifactu. Commit włącza też walidowany generator ośmiu publicznych inputs oraz amd64 base manifesty przypięte digestem. Workflow odmawia commitów, których nie ma już na `main`.

Dowody części 1: test workflow/helperów **6/6 PASS**; pełny typecheck PASS; lint zmienionych plików PASS; YAML parsuje się. Trzy base digesty potwierdzone registry przez Buildx. Nie uruchamiano Actions ani GHCR. Część 2 w toku: testy deploy consumers **33/33 PASS**; sprawdzono także, że obcy registry jest odrzucany przed wywołaniem Dockera. Wdrożeniowe skrypty wymagają zewnętrznego hash proofu, a verifier blokuje migrację i aktywację bez poprawnych digestów. Nie jest to jeszcze pełna integracja: artifact transfer w `mergedeploy.sh`, alternatywne/manualne ścieżki i próby pełnego cyklu pozostają niezaimplementowane. Pełny producer wymaga obowiązkowego audit gate; status `release_ready=false` bez jego rzeczywistego zielonego raportu.

**Następny krok:** domknąć celowane testy deploy/admin i helpera, potem połączyć artifact Actions z `mergedeploy.sh`, w tym walidować pełną rewizję oraz przekazywać zewnętrznie zatwierdzony hash. Nie wykonywać tych skryptów na serwerze.

## STOP właściciela — 4 listopada 2026

Praca **zatrzymana na wyraźne polecenie właściciela** z powodu pozostałego1% limitu tygodniowego. Nie wznawiać automatycznie. Ukończone zielone części są w lokalnych commitach, ostatni kod **`2d081d7f`**; osobny commit WIP zawiera checkpoint niedokończonej integracji H1/K06. Kod roboczy nie pozostał niesprawdzony ani niezapisany. Nie uruchamiano nowych pakietów ani ciężkich testów po poleceniu zatrzymania; dokończono tylko lint aktualnych14 plików i zapis.

Ostatni pakiet: **61/61** testów transakcji i powiązanych modułów, **253/253** komponentów/Studia/i18n,0fail/0skip; typy aplikacji, architektura, hotspots i strict-escapes PASS; lint0 błędów/12 ostrzeżeń. Cztery duże komponenty podzielono bez zmiany klas/tekstów i bez podnoszenia limitów. Dwa testy najpierw odtworzyły błąd `$transaction` w istniejącej transakcji, potem przeszły po użyciu standardowego adaptera. [Dowody](program-audytu/evidence/k06-local-producer-2026-11-03/final-gates/result.json).

Wcześniejsze, osobno przypisane dowody: pełny unit4729/0fail/3skip i whole types/lint (`d72dc0e5`); HDR3/3 (`f9e5b027`); realny PG77/77 z oboma e-mail DB (`1aaef191`). Nie przypisujemy wcześniejszego pełnego unit/typecheck-all do ostatniego SHA. Dwa własne kontenery PG sprzątnięte; brak wdrożeń/push/PR/produkcji.

**WIP:** konsumenci K06 (workflow publikacji, wszystkie deploy/admin/rollback/manualne ścieżki), pięć faktycznych obrazów i pełny własny cykl produktu oraz decyzje K05. Publikator rejestru nie został rozpoczęty. Mandatory audit wciąż niewykonany po historycznej odmowie uploadu grafu. Żaden cały pakiet/ustalenie nie jest formalnie zamknięty; `release_ready=false`, całość szacunkowo5–10%.

**Następny krok i komenda:** [STAN.md](program-audytu/STAN.md), sekcja „Komenda do wznowienia” — tylko po nowym poleceniu właściciela. Najpierw odczytać kontrakt RELEASE-PROOF i obecne konsumenty, potem dodać testy odmowy jednego konsumenta. Nie uruchamiać produkcyjnego deploya ani ponownie pełnego unit bez potrzeby.

## Zapis realizacji przed zatrzymaniem


## Bieżące przejęcie — 3 listopada 2026, lokalna gałąź audytu

Producent dodany po części budowania (`c546726a`): `release-produce.mjs` uruchamia pełne ścisłe CI z jednym slotem, wymaga czystego wskazanego SHA przed/po i świeżego `runId`, tworzy rzeczywiste archiwum Git i dopiero przekazuje je do budowania. **121/121 testów**, lint zmienionych plików i skupiona ścisła kontrola typów PASS. Testy CI/Dockera kontrolowane, Git/tar rzeczywiste. Nie uruchomiono pełnego producenta aplikacji; brak kompletnego dowodu wydania. [Dowody producenta](program-audytu/evidence/k06-local-producer-2026-11-03/produce-result.json).

Domknięto kontrolę konsumowania baz w Dockerfile: dwa testy rzeczywiście czerwone (zaakceptowany ruchomy FROM i zewnętrzny COPY) → zielone; preflight odrzuca je przed Dockerem. **124/124 testy**, lint i skupione strict types PASS, oba rzeczywiste Dockerfile zgodne z kontraktem. [Dowody](program-audytu/evidence/k06-local-producer-2026-11-03/pins-result.json). Producent: `6f5d09c0`, wcześniejsze budowanie: `c546726a`.

Przeniesiono zależności K03 z `7b2b341b`, `e79ec89c` i `03115f0f`: poprawny weryfikator odtworzenia oraz strażnik obu zestawów krytycznych. Na tej gałęzi **26 RED + 5 PASS → 31 PASS** weryfikatora; razem z regresjami strażnika **44/44 PASS**, właściwe `npm run test:critical-path -- --maxWorkers=1` **36/36**, oba pliki bez skip. Lint i skupione strict types PASS. DB/providerzy syntetyczni; w integracji widoczne błędy brakujących fixture powiadomień, których asercje nie sprawdzają. Nie jest to dowód dostarczenia powiadomień ani prawdziwego restore. [Dowody](program-audytu/evidence/k06-local-producer-2026-11-03/critical-result.json).

Przywrócono build typecheck obu aplikacji (pochodzenie `f7ff10b5`), zweryfikowany od nowa na tej gałęzi i Next 16.3.8: dwa rzeczywiste buildy akceptowały celowy błąd; po zmianie oba odrzucają dokładnie ten błąd i oba przyjmują poprawny kod. Sześć małych buildów, jeden CPU, lint konfiguracji PASS. [Dowody](program-audytu/evidence/k06-local-producer-2026-11-03/next-typecheck/result.json). Nie są to buildy całej aplikacji ani poprawione wersje K02.

K02 przywrócony z `989682ff`: Next/eslint-config-next 16.4.1 i sharp 0.35.5, zwykłe `npm ci` z prawdziwym generowaniem Prisma PASS. Próba RED ładowała sharp 0.35.4; GREEN ładuje 0.35.5/librsvg 2.63.2/vips 8.18.7. Rzeczywisty loopback HTTP: PNG 200, SVG/błędny plik/obcy host 400. **170/170 testów** (46 obrazów/nagłówków i 124 rdzenia), lint helpera PASS. Na aktualnym Next dodatkowo cztery prawdziwe małe buildy: dwa błędy odrzucone, dwa legalne przyjęte. [Dowody K02](program-audytu/evidence/k06-local-producer-2026-11-03/k02-runtime/result.json). Nie ma nowych obrazów aplikacji ani świeżego npm audit; K02 niezamknięte.

Przywrócono baseline K03 z pięciu wcześniejszych commitów: fixture używają istniejących poziomów dostępu, poprawnych kształtów i kontraktów mocków, typów Locale; poprawiono zakres konfiguracji lint i izolację testu autoryzacji komentarzy od Redis. Przy konfliktach zachowano testy aktualnego interfejsu tej gałęzi, bez przenoszenia późniejszych zmian wyglądu. JSDoc enrollment nie zmienia ról ani wykonywanego kodu. Dwa importy audytu mają zgodną z tsconfig postać bez `.ts`; trzy lokalne nazwy `module` narzędzi badawczych zmieniono po czerwonym lint. Historyczne wyniki eksperymentów zachowane.

**Typecheck całego repo: 82 wcześniejsze diagnostyki → 0. Pełny unit przez local-CI: 4729 PASS, 0 FAIL, 3 pominięte, 540 plików; źródła stabilne. Pełny lint: 0 błędów / 100 ostrzeżeń.** [Dowody baseline](program-audytu/evidence/k06-local-producer-2026-11-03/baseline/result.json). To jawnie częściowe CI na brudnym checkoutcie, nie dowód wydania. Po unit zmieniono tylko nazwy trzech zmiennych w helperach audytu i dokumentację; raw snapshot zachowany. Pominięcia: dwa testy EmailEventLockService z prawdziwą bazą oraz HLG/HDR.

Baseline zapisany w `d72dc0e5`. HDR przywrócony z `a2708f00`: strict gate najpierw odrzucił 2 PASS/1 skip, po jawnym VUI fixture i niezależnej kontroli ffprobe **3/3 rzeczywiste encody PASS bez skip**; lint i focused types PASS, źródła stabilne. Kod enkodera bez zmian. [Dowody HDR](program-audytu/evidence/k06-local-producer-2026-11-03/hdr/result.json). To hostowy FFmpeg i syntetyczne filmy, nie pełny pipeline/obraz aplikacji.

HDR zapisany w `f9e5b027`. Realny PostgreSQL przywrócony z fixture `8dce5f94`: RED **64 PASS / 11 FAIL** w dwóch nieprawidłowych fixture → GREEN **77/77, 13 plików, zero skip**, w tym oba e-mail DB. Rzeczywisty PostgreSQL **17.11**, autentyczny Prisma, 81 niezmienionych migracji, własne nowe kontenery i syntetyczne dane; oba kontenery sprzątnięte i sprawdzone po ID. Lint i focused types PASS. Nowy guard wymaganych plików: 9 RED → GREEN, z istniejącymi regresjami kompilatora **48/48**. [Dowody PG](program-audytu/evidence/k06-local-producer-2026-11-03/postgres/result.json).

Do profilu PG dołączono oba testy e-mail; runner odrzuca brakujące/puste/pominięte pliki mimo zielonych sum. To dowód DB/Prisma, nie całego HTTP/storage/kolejki/Workera. Dwie pominięte pozycje e-mail i HDR ze starego pełnego unit mają teraz oddzielne rzeczywiste dowody; raw unit nie jest przepisywany.

Następne: pozostałe bramki H1 (architektura, hotspots, strict-escapes, env, parytet/migracje i typy aplikacji), pozostali konsumenci K06 oraz pełny własny cykl produktu. [Mapa dotychczasowych commitów](program-audytu/MAPA-COMMITOW.csv). Wszystkie pełne pakiety nadal otwarte. K06 pozostaje otwarte, szacunki bez zmian.

Obowiązuje `/opt/codex/ZADANIE-AUDYT.md`: implementacja tylko w tym worktree na `docs/polutek-platform-audit`, bez PR/merge/deploy. Cztery commity rdzenia K06 przeniesiono lokalnie do `37eb1edb`; wcześniejsze wyniki H1 niżej zachowują przypisanie do historycznych SHA. Pozostałych zmian tamtego kandydata jeszcze nie przeniesiono; nie traktować tej gałęzi jako identycznej z f9edc23a.

K06, część budowania: nowe `release/build.mjs` i polecenie `release-proof.mjs build` walidują kompletny raport, źródła i wejścia przed budową. Pięć obrazów kolejno, przypięte bazy, komplet publicznych argumentów i etykiet, `--iidfile` i ponowny seal; bez push. Oba Dockerfile obsługują przypięte wejścia. Wynik: **82/82 testy celowane, lint zmienionych plików PASS**. Tsc całego repo exit 2, diagnostyki w istniejących testach, brak w zmienionych ścieżkach; bez porównania czystej bazy nie ogłaszamy całej kontroli zieloną. Dowody: [k06-local-producer](program-audytu/evidence/k06-local-producer-2026-11-03/build-result.json).

Testy budowania używają jawnego adaptera kontrolnego Dockera. Nie wykonano budowy rzeczywistych pięciu obrazów ani odbioru aplikacji. K06 nadal otwarte. Producent pełnego CI opisany wyżej; pozostają wszystkie konsumujące ścieżki i odbiór rzeczywistych obrazów. Historyczny szacunek H1 ~80%, całości 5–10% bez podwyższenia i bez formalnego zamknięcia pakietu.

## Poprzedni odbiór — historyczny kandydat f9edc23a

Stan: 3 listopada 2026 (partia rozpoczęta 2 listopada). **Wspólny walidator źródeł/kontroli/wejść/obrazów jest zaimplementowany i sprawdzony. Runner CI zapisuje pochodzenie wyników i nie ignoruje błędów w `.next/`. Producent wydania i wszystkie ścieżki publikacji/aktywacji pozostają do podłączenia.**

**Szacunkowo H1 około 80% / 20% pozostało; cała roadmapa 5–10% / 90–95% pozostało.** Szacunek makro pozostaje ostrożny: ten pakiet to rdzeń K06, nie zakończona ochrona całego procesu. Zero całych pakietów i ustaleń formalnie zamkniętych.

Kod [`fix/polutek-h1-acceptance`](https://github.com/pawelekbyra/polutek-pl/tree/fix/polutek-h1-acceptance), `f9edc23ae278fbd2764b39c7bcd0c71810ba78b2`; [szkic PR #2065](https://github.com/pawelekbyra/polutek-pl/pull/2065), baza c80ef652. Handoff: [STAN](program-audytu/STAN.md), [h1-status](program-audytu/evidence/h1-status.json). Dokumentacja/dowody na `docs/polutek-platform-audit`. Bez merge/deploy.

## Co działa i co sprawdzono

- Nowe `scripts/ops/release-proof.mjs` i moduły `release/`: wymagają pełnego ścisłego raportu 17 bramek na Node 22, czystych i niezmienionych źródeł, niepustych raportów testowych oraz kompletnego archiwum/argumentów i pięciu tożsamości obrazów. Brak/porażka/pominięcie bramki blokuje dowód. Weryfikacja wymaga SHA kodu i oczekiwanego hasha dowodu dostarczonych przez zaufanego wywołującego, a nie odczytanych z badanego pliku.
- Local CI zapisuje inwentarze/hash źródeł przed i po, stan checkoutu oraz podsumowania unit/critical/PG/encoder. Dodano bramkę obu krytycznych plików. Obserwowany niezerowy wynik tsc w `.next/` daje FAIL; nie jest dłużej pomijany.
- **128/128 testów celowanych** w 4 plikach przed ostatnim doprecyzowaniem asercji TS2322; pełny końcowy unit obejmuje też te asercje. Wcześniejsze czerwone iteracje fixture zachowano.
- **15/15 oczekiwanych wyników z prawdziwym Dockerem**, sześć małych obrazów kontrolnych. Pozytywne seal/verify i odmowy błędnego typu/testu/audytu, źródeł, wejść, hasha manifestu i bazy. Podmiana tagu nie przekierowuje weryfikacji, która korzysta z zapisanego ID. To kontrolne obrazy i raporty, nie odbiór aplikacji. Przebieg na `55f3a6d8`; moduły i runner identyczne w finalnym kandydacie.
- **Prawdziwy kompilator, próba przed/po:** baseline `9824` widzi TS2322 w `.next/invalid.ts`, ale runner kończy exit 0/PASS; kandydat kończy exit 1/FAIL. Kontrolny minimalny projekt jawnie wyłącza Prisma; nie wytwarza zastępczego klienta ani dowodu wydania.
- Prawdziwe archiwum całego finalnego kodu pasuje do inwentarza z rzeczywistego częściowego CI. **Udany częściowy raport został odrzucony jako podstawa wydania.**

## Końcowe wyniki na dokładnym SHA

| Kontrola | Wynik | Zakres |
|---|---|---|
| Unit / komponenty | **4779 PASS, 0 FAIL, 2 pominięte**, 544 pliki | Pełny zestaw przez zmieniony local-CI runner; wartości workflow są syntetyczne. |
| PostgreSQL | **75/75 PASS**, 12 plików | Własna rzeczywista baza; zewnętrzni providerzy są atrapami. |
| Krytyczne / encoder | **36/36 i 3/3**, bez pominięć | Również rzeczywiste podsumowania w częściowym local-CI; encoder z HDR. |
| Typy aplikacji / całego repo | **PASS / PASS** | Także prawdziwy przypadek ujemny generowanych typów. |
| Lint, architektura, hotspots, strict-escapes, env | **PASS** | Lint 0 błędów / 100 ostrzeżeń; env nie jest aktywną produkcją. |
| Build strony / panelu | **PASS / PASS** | Lokalne standalone; w tej partii bez nowych obrazów aplikacji. |

Zbiorczy wykonany odbiór lokalny exit 0; `release_ready=false`. W częściowym local-CI jawnie wybrano unit/critical/encoder/whole-types/parity i pominięto generowanie Prisma; autentyczny klient/schemat są niezmienione. Osobny PG testuje własną bazę. `audit` nie wybrano i nie ponawiano po wcześniejszej automatycznej odmowie uploadu grafu zależności. **Polityka wydania nadal wymaga tej bramki; nie podstawiono PASS.** Nie ma kompletnego dowodu wydania aplikacji.

## Zmiany i granice

| Commit | Zakres |
|---|---|
| `6cd26d90` | Walidator archiwum, jakości, wejść i tożsamości; seal/verify oraz kontrolne testy kontraktu. |
| `5af98a07` | Local-CI źródła przed/po, strukturalne raporty, krytyczne testy, zakaz ignorowania niezerowego tsc i wyłączenie obejść panelu; test procesu z prawdziwym kompilatorem. |
| `55f3a6d8` | [RELEASE-PROOF.md](https://github.com/pawelekbyra/polutek-pl/blob/f9edc23ae278fbd2764b39c7bcd0c71810ba78b2/docs/operations/RELEASE-PROOF.md), konwencje i jawne granice integracji/zaufania. |
| `f9edc23a` | Test wymaga konkretnego TS2322 i ścieżki `.next/invalid.ts`, aby inny błąd konfiguracji nie dawał fałszywie zaliczonej regresji. |

Dowód jest niesygnowanym zapisem zaufanego operatora; nie nadaje poziomu SLSA. Producent musi faktycznie wykonać kontrole i zbudować zweryfikowane archiwum z zadeklarowanych wejść. Pochodzenie kopiowanego FFmpeg wymaga przypiętego producenta; walidator końcowych warstw sam tego nie dowodzi. Seal/verify wymagają POSIX (Linux/WSL); natywny Windows jest odrzucany, a odpowiednie testy mają jawny warunek platformy. W tej sesji Linux wszystkie nowe przypadki wykonano.

**Nie zmieniono images.yml, deploy.sh, deploy-admin.sh ani mergedeploy.sh.** Obecne ścieżki nie wywołują jeszcze nowego walidatora. Włączenie całego protokołu, w tym istniejących obrazów, GHCR, panelu i rollbacku, pozostaje następnym pakietem. Poprzednie obrazy aplikacji/native/HTTP/HDR dotyczą `9824`, nie finalnego artefaktu f9; ich właściwe źródła aplikacyjne/biblioteki są niezmienione, ale nie przypisujemy im nowego SHA.

## Następna praca i przejęcie

1. Dokończyć K06: zaufany producent przypiętych wejść i pełnych kontroli; podłączenie weryfikacji przed publikacją/migracjami/aktywacją do wszystkich wspieranych konsumentów, użycie zwróconych ID. Oczekiwany hash dowodu i SHA muszą przyjść z zaufanego wyniku, nie być wyliczane z badanego pliku. Wymagane próby ujemne całych ścieżek oraz migrator/collector.
2. Uzupełnić pełny własny API/kolejka/worker/HLS/Redis/storage i dwa przypadki e-mail DB. Dotychczasowe syntetyczne encody nie zastępują tego cyklu.
3. K05: aktywna konfiguracja i DP01–DP09 nadal otwarte. Późniejsze naprawy finansów/uprawnień/pipeline i pogłębiony audyt pozostają w roadmapie.

[Atrybucja](program-audytu/evidence/h1-release-core-2026-11-02/source-map.json), [pełny wykonany odbiór](program-audytu/evidence/h1-release-core-2026-11-02/final/acceptance-run.json), [prawdziwy raport częściowy](program-audytu/evidence/h1-release-core-2026-11-02/final/local-ci-partial.json). Starsze [obrazy/HDR](program-audytu/evidence/h1-images-2026-11-02/source-map.json) i pozostałe dowody zachowane. `program-audytu/tools/` ma użyte helpery; kopiować poza checkout, wybrać czystą gałąź kodu i nowy katalog wyników. Nie kopiować `source.tar`/prywatnego env do repo. Kontrolne obrazy to prefix `polutek-release-control-*`, bez usług/portów/publicznego registry.

Node 22.23.4; lokalny klient Prisma 6.19.3, własna baza PG 17.11 i 81 migracji bez zmian. Nie przełączać gałęzi podczas pracy testów; jedno ciężkie polecenie naraz. Stan kanoniczny bez zmian: ASVS 86 częściowych/254 NIEZBADANE/5 warunkowych NA/0 PASS; wejścia 84/202 z 286; 18 obszarów otwartych; R01–R37 i Windows/batch17 zachowane. Nie zmieniano konfiguracji środowiska. Bez merge/deploy/produkcji/kosztów i nowych kwalifikacji ASVS. Po partii commit/push obu gałęzi, sprawdzenie remote SHA i procentu.
