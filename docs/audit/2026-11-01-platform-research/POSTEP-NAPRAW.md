# Postęp realizacji roadmapy napraw

Aktualizacja: 2 listopada 2026. Właściciel zatwierdził roadmapę i rozpoczęcie prac: „ok droga wolna dzialaj”; zakres bieżącej partii **H1: K01/K02/K05, potem K03/K06**. Bez scalenia, wdrożenia, produkcyjnych zmian danych i kosztów. Karty/testy: [ROADMAPA-NAPRAW.md](ROADMAPA-NAPRAW.md). Indeks `roadmap-v1-plan.json` zachowuje historyczny stan propozycji v1; aktualny stan podajemy tutaj.

| Pakiet | Stan | Obecny dowód / ograniczenie |
|---|---|---|
| K01 — Prisma i środowisko | BLOCKED — reguła szkicu niezastosowana | Runtime: enforced restricted, brak `binaries.prisma.sh`; szkic rev. 3 zawiera tę domenę. Nie ponawiano niezmienionej zablokowanej instalacji, nie obchodzono proxy. |
| K02 — zależności | KANDYDAT_CZESCIOWO_SPRAWDZONY | Kandydat `e582ead4` na `fix/polutek-k02-security-dependencies`, baza main `5f848a93`: Next 16.4.1, sharp 0.35.5, runtime librsvg 2.63.2. 46/46 testów, architektura i fixture Next HTTP PASS. Typecheck exit 2 (515 diagnostyk); full quality/build/obraz NIEWYKONANE/BLOCKED. |
| K05 — profil i decyzje | W_REALIZACJI | Instrukcje repo nadal rozróżniają obecne pakiety patrona od przyszłego marketplace; aktywne ustawienia produkcji nie są ustalone. Decyzji właściciela nie zastępuje kod. |
| K03 — baseline i restore verifier | CZESC_NARZEDZIOWA_SPRAWDZONA_RESZTA_BLOCKED | Kandydat 5d78380d: 31/31 procesowych testów R37, lint, typy nowego testu i architektura PASS. Prawdziwe DB/Prisma, baseline i pozostały zakres K03 nadal do wykonania. |
| K06 — jakość konkretnego wydania | OCZEKUJE_NA_ZALEZNOSC | Wymaga K01/K02/K03; przygotowanie kontroli nie jest dowodem przejścia wydania. |

Pozostałe pakiety nie rozpoczęte. Odrębny przebieg na Windows (`b3a19a64`/`f7e288bd`) zachowano: prawdziwy generate, Vitest 4573/4596 pass oraz mechaniczna adopcja partii 17; bez PostgreSQL, Node 24 zamiast 22. W chmurze nie rozpoczęto nowej kwalifikacji ASVS. Wszystkie 18 obszarów pozostaje otwarte. Ustalenia i surowe dowody zachowują historyczne wersje. Pełne ukończenie H1 wymaga prawdziwej instalacji/migracji, testów i buildów; zablokowana próba nie jest PASS.


## Gałęzie i przejęcie

- **Historia/plan:** `docs/polutek-platform-audit`; czytać najpierw STAN i ten plik.
- **K02:** `fix/polutek-k02-security-dependencies`, commit `e582ead4`; tylko package.json/lockfile, baza `5f848a93`. Gałąź wypchnięta, bez scalenia. `gh pr create --draft` zwróciło Forbidden dla GraphQL; PR nie utworzono.
- Środowisko cloud i lokalna maszyna Windows to osobne źródła dowodów. Nie zastępować brakujących testów cloud wynikami innej wersji Node/DB.
- Przygotowany szkic instalacji nadal wymaga zastosowania reguły Prisma; sprawdzić aktualną gotowość przed ponowieniem blokowanego kroku. Nie ponawiać npm audit ani obchodzić wcześniejszego odrzucenia wysłania grafu.


## Dowody i odtworzenie K02

Podsumowanie z pełnym SHA i ograniczeniami: [h1-k02-summary.json](program-audytu/evidence/h1-k02-summary.json). [Wynik runtime obrazów](program-audytu/evidence/h1-k02-image-runtime.json), [46 testów](program-audytu/evidence/h1-k02-vitest.json), [architektura](program-audytu/evidence/h1-k02-architecture.log), [nieudana kontrola typów](program-audytu/evidence/h1-k02-typecheck.log).

Po przełączeniu na gałąź K02, z Node 22 i jej zainstalowanym lockfile: `node <ścieżka-do-audytu>/program-audytu/tools/k02-image-runtime-check.mjs` z katalogu repo. Harness używa własnego katalogu temp/loopback i zapisuje wyniki w `/workspace/.cloud-setup` (utworzyć ten katalog); nie potrzebuje DB ani prawdziwego storage. To test runtime/config, nie pełnej strony. Pierwszy fixture błędnie użył szerokości 16; poprawiono go do dozwolonego 32. Nie zmieniano konfiguracji aplikacji pod test.

W szkicu środowiska zachowano domenę Prisma i dodano `api.github.com`. Zapis potwierdzony, `requires_publish=true`; **nie jest to zastosowanie do runtime**. Potrzebne przejrzenie i zapisanie zmian w ustawieniach oraz publikacja środowiska. Do tego czasu bez niezmienionych ponowień generate/PR i bez próśb o nowy token.


## K03 / R37 — oddzielny kandydat i dalszy krok

Gałąź `fix/polutek-k03-restore-verifier`, commit `5d78380dfe659eedd0ef776cccb0ccb81566fa84`, jest oparta na K02 `e582ead4` (spójny z użytym lockfile). Porównanie z K02 obejmuje tylko naprawę weryfikatora, testy i jego dokumentację. Bez merge/deploy. [Podsumowanie](program-audytu/evidence/h1-k03-summary.json), [przed zmianą](program-audytu/evidence/h1-k03-verifier-red.json), [dodatkowe granice manifestu](program-audytu/evidence/h1-k03-manifest-red.json), [31/31 po zmianie](program-audytu/evidence/h1-k03-verifier-final.json).

Odtworzenie: na gałęzi K03 z Node 22 i jej lockfile `node node_modules/vitest/vitest.mjs run tests/unit/operations/verify-restored-database-process.test.ts --maxWorkers=1`. Testy wykonują rzeczywisty CLI/kod wyjścia, lecz DB jest jawną granicą syntetyczną. Nie jest to rzeczywisty restore ani pełne zamknięcie K03/R37.

Dalszy zakres H1: uzgodniony profil i rejestr otwartych decyzji K05; niezależne przygotowanie K06 bez twierdzenia o gotowym wydaniu. Po zastosowaniu reguł środowiska wrócić do autentycznego generate/migracji i pełnych bramek na właściwym SHA. Nie powtarzać blokowanych operacji przy niezmienionym runtime.
