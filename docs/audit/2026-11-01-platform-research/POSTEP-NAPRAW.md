# Postęp realizacji roadmapy napraw

Aktualizacja: 2 listopada 2026. Właściciel zatwierdził roadmapę i rozpoczęcie prac: „ok droga wolna dzialaj”; zakres bieżącej partii **H1: K01/K02/K05, potem K03/K06**. Bez scalenia, wdrożenia, produkcyjnych zmian danych i kosztów. Karty/testy: [ROADMAPA-NAPRAW.md](ROADMAPA-NAPRAW.md). Indeks `roadmap-v1-plan.json` zachowuje historyczny stan propozycji v1; aktualny stan podajemy tutaj.

| Pakiet | Stan | Obecny dowód / ograniczenie |
|---|---|---|
| K01 — Prisma i środowisko | BLOCKED — reguła szkicu niezastosowana | Runtime: enforced restricted, brak `binaries.prisma.sh`; szkic rev. 3 zawiera tę domenę. Nie ponawiano niezmienionej zablokowanej instalacji, nie obchodzono proxy. |
| K02 — zależności | KANDYDAT_CZESCIOWO_SPRAWDZONY | Kandydat `e582ead4` na `fix/polutek-k02-security-dependencies`, baza main `5f848a93`: Next 16.4.1, sharp 0.35.5, runtime librsvg 2.63.2. 46/46 testów, architektura i fixture Next HTTP PASS. Typecheck exit 2 (515 diagnostyk); full quality/build/obraz NIEWYKONANE/BLOCKED. |
| K05 — profil i decyzje | W_REALIZACJI | Instrukcje repo nadal rozróżniają obecne pakiety patrona od przyszłego marketplace; aktywne ustawienia produkcji nie są ustalone. Decyzji właściciela nie zastępuje kod. |
| K03 — baseline i restore verifier | OCZEKUJE_NA_ZALEZNOSC | Pełny baseline zależy od K01; istniejący manual helper oraz jego testy wymagają odrębnego odbioru procesu. |
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
