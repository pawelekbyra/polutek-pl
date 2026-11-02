# Postęp realizacji roadmapy — H1

Stan: 2 listopada 2026. Właściciel zatwierdził roadmapę słowami „ok droga wolna dzialaj”. Bieżący zakres: **K01/K02/K05 oraz odblokowane części K03/K06**. To pierwsza partia kandydatów, nie pełny odbiór H1. Bez scalenia, wdrożenia, produkcyjnych zmian danych lub płatnych zasobów zewnętrznych.

**Kod całej przygotowanej partii:** [`fix/polutek-h1-foundations`](https://github.com/pawelekbyra/polutek-pl/tree/fix/polutek-h1-foundations), commit `f5e061546ef4e309cc69994810ba20a5ffd68a0b`. **Historia badań i bieżący punkt:** `docs/polutek-platform-audit`. Maszynowy indeks bieżący: [h1-status.json](program-audytu/evidence/h1-status.json). Indeks `roadmap-v1-plan.json` jest historyczną propozycją v1.

## Stan pakietów

| Pakiet | Przygotowano / sprawdzono | Co nadal otwarte |
|---|---|---|
| **K01** — środowisko | Lokalny PostgreSQL 17.11 działa. Utworzono osobną pustą bazę `polutek_h1_6b21d176e3`; drugi przebieg zachował ją bez resetu. Prywatna konfiguracja poza repo: `/workspace/.cloud-setup/h1.env`, tryb 0600. | Reguła Prisma nadal nieaktywna w runtime. Autentyczny generate, silnik migracji i integracja DB nie zostały wykonane w chmurze. Starszych baz raw SQL nie bazowano ani nie zmieniano. |
| **K02 / R01** — zależności | Next/ESLint 16.4.1, sharp 0.35.5, rzeczywisty librsvg 2.63.2. 46/46 istniejących testów w 4 plikach, architektura i lokalny fixture HTTP obrazów PASS. | `npm ci --ignore-scripts` służyło tylko niezależnej próbie. Normalna instalacja/quality/typecheck/build obu aplikacji i rzeczywisty obraz wymagają odbioru. Typecheck K02: exit 2, 515 diagnostyk; nie przypisywać wszystkich automatycznie Prisma. |
| **K03 / R37, R08** — wiarygodność testów | Weryfikator odmawia przy błędzie obowiązkowych odczytów/migracji/manifestu; zamyka klienta po obsłużonym błędzie. 31/31 testów prawdziwego procesu z jawną syntetyczną DB, lint/typy nowego testu i architektura PASS. Komenda krytyczna wskazuje dwa istniejące pliki. | Cała komenda krytyczna nadal exit 1: 31 testów PASS, drugi plik integracyjny zablokowany przed rejestracją przez `.prisma/client/default`. Brak rzeczywistego restore/Prisma/pełnego baseline. Naprawa selekcji nie tworzy pełnego E2E ani kompletnego zabezpieczenia przed przyszłym zniknięciem targetu. |
| **K05 / R19** — specyfikacja | Rozdzielono darmowe VOD/napiwki, obecne Premium i przyszły marketplace; usunięto sprzeczne aktualne opisy. [Profil i rejestr 9 decyzji](https://github.com/pawelekbyra/polutek-pl/blob/e3801c2725b330a40573ba35afe92939bde57fdb/docs/architecture/product-profile.md). Tylko dokumentacja, linki i ID sprawdzone. | Aktywna konfiguracja produkcji nieodczytana. Decyzje refundów/retencji/świeżości/cofania dostępu/SLO/RPO/RTO/budżetu nadal otwarte przed właściwymi pakietami; nie zastąpiono ich domysłami. |
| **K06 / R09** — build | Obie konfiguracje mają `ignoreBuildErrors=false`. Dwa rzeczywiste buildy fixture przed zmianą przyjmowały celowy błąd; po zmianie dwa odmawiają z właściwym błędem typu, dwa legalne przechodzą. Lint konfiguracji PASS. | To część K06. Pełne aplikacje/quality, wymuszenie wszystkich ścieżek wydania i związanie wyników z dokładnym SHA/wejściami/digest obrazu nadal otwarte. Fixture build nie jest buildem produktu. |

Żadnego całego pakietu ani obszaru audytu nie uznano za zamknięty na podstawie tych częściowych dowodów. Nie wdrożono żadnej poprawki. Pozostałych pakietów poza H1 nie rozpoczęto.

## Małe commity i kolejność gałęzi

Baza napraw: `main` `5f848a9304d19a6d03860444808abbe120b57623`, nowsza od baseline raportu `c397b9e`. Nie cofano zmian UI ani nie przepisywano aplikacji. Każda kolejna gałąź zawiera poprzednie kandydaty przez rodzica commitu; nie wykonano merge. Porównanie z rodzicem daje mały zakres do przeglądu.

| Krok | Gałąź | Commit | Zakres względem rodzica |
|---|---|---|---|
| K02 | `fix/polutek-k02-security-dependencies` | `e582ead4e1a20ec1e4080c1d1f6a899650304a09` | 2 plików; rodzic `5f848a93` |
| K03/R37 | `fix/polutek-k03-restore-verifier` | `5d78380dfe659eedd0ef776cccb0ccb81566fa84` | 7 plików; rodzic `e582ead4` |
| K05 | `docs/polutek-k05-product-profile` | `e3801c2725b330a40573ba35afe92939bde57fdb` | 5 plików; rodzic `5d78380d` |
| K06 — typy builda | `fix/polutek-k06-build-typecheck` | `2f8ff90683e4a51469ecb7086a3532b4a3345e06` | 4 plików; rodzic `e3801c27` |
| K03 — selekcja testów / zbiorcze H1 | `fix/polutek-h1-foundations` | `f5e061546ef4e309cc69994810ba20a5ffd68a0b` | 2 plików; rodzic `2f8ff906` |

Wszystkie te gałęzie są wypchnięte. Szkic PR K02 nie powstał: GitHub GraphQL zwrócił Forbidden. Nie ponawiano tej operacji przy niezmienionej regule. Nie wnioskować z tego o konieczności nowego tokenu. Do przeglądu całego H1 służy ostatnia gałąź; do oddzielnych zmian — porównania kolejnych commitów.

## Dowody i ich granice

- K01: [pierwsze przygotowanie bazy](program-audytu/evidence/h1-k01-db-first-check.json), [bezpieczny drugi przebieg](program-audytu/evidence/h1-k01-db-repeat-check.json), [helper](program-audytu/tools/prepare-h1-db.py).
- K02: [podsumowanie](program-audytu/evidence/h1-k02-summary.json), [runtime obrazów](program-audytu/evidence/h1-k02-image-runtime.json), [46 testów](program-audytu/evidence/h1-k02-vitest.json), [nieudane typy](program-audytu/evidence/h1-k02-typecheck.log). Pierwszy fixture miał niedozwoloną szerokość 16; poprawiono próbę do 32, bez zmiany aplikacji pod test.
- K03: [podsumowanie](program-audytu/evidence/h1-k03-summary.json), [RED: 29/24 fail](program-audytu/evidence/h1-k03-verifier-red.json), [dodatkowy RED manifestu: 31/2 fail](program-audytu/evidence/h1-k03-manifest-red.json), [31/31 po zmianie](program-audytu/evidence/h1-k03-verifier-final.json), [cała komenda krytyczna — NIEZALICZONA](program-audytu/evidence/h1-k03-critical-path.json).
- K06: [dwa buildy przed zmianą](program-audytu/evidence/h1-k06-build-baseline.json), [cztery buildy po zmianie](program-audytu/evidence/h1-k06-build-fixed.json), [helper odtwarzający](program-audytu/tools/k06-build-typecheck-check.mjs). Każdy fixture ma jedną stronę, jeden worker i importuje realną konfigurację danej aplikacji; nie używa DB ani usług produkcji.
- [Stan szkicu i runtime](program-audytu/evidence/h1-environment-status.json): szkic rev. 6 zapisany, domeny `binaries.prisma.sh` i `api.github.com`, instrukcje startowe zapisane. Runtime spec. 1 nadal nie ma tych hostów. `requires_publish=true`; zapis szkicu nie stosuje zmian.

Zachowano odrębne wyniki Windows `b3a19a64`/`f7e288bd`: prawdziwy generate, Vitest 4573/4596 pass i mechaniczna adopcja partii 17, ale Node 24 zamiast 22 i brak PostgreSQL. Nie przenosić ich na tę chmurę. Kanonicznie wszystkie 18 obszarów są otwarte; ASVS 86 częściowych / 254 NIEZBADANE / 5 warunkowych NA / 0 PASS; wejścia 84/202 z 286. Ta partia H1 nie dodała kwalifikacji ani PASS ASVS.

## Dokładny punkt wznowienia

1. **Właściciel:** w ustawieniach środowiska przejrzeć i zapisać przygotowane zmiany oraz opublikować środowisko. To konieczny krok konfiguracji wskazany przez narzędzie (`requires_publish=true`), a nie dodatkowa zgoda na naprawy. Nie oznacza zgody na deploy/main.
2. **Agent:** sprawdzić runtime/obserwacje i faktyczną aktywację obu hostów. Dopiero po zmianie warunku ponowić dotknięty krok. Nie obchodzić proxy/TLS/checksum, nie wysyłać ponownie grafu npm audit i nie instalować klienta-atrapy.
3. Przeczytać STAN i pełne instrukcje właściwej gałęzi, sprawdzić czysty stan. Wybrać `fix/polutek-h1-foundations`; cache node_modules pochodzi z lockfile K02, natomiast na gałęzi audytu package.json jest historyczny. Przed wiarygodnym odbiorem wykonać normalne `npm ci --no-audit --no-fund` na gałęzi kodu, bez `--ignore-scripts`.
4. Użyć wyłącznie nowej lokalnej konfiguracji `/workspace/.cloud-setup/h1.env`, PostgreSQL 17 i Node 22. Autentyczny Prisma generate/validate, `migrate deploy` na pustej własnej bazie, smoke i rzeczywiste testy PostgreSQL. Nie dodawać ręcznie historii migracji do starych baz raw SQL.
5. Wykonać wymagane typy/quality/testy/oba buildy i realny odbiór weryfikatora na dokładnym SHA, rozliczyć każde skip/fail. R37 i pełne K03 wymagają tej integracji i przeglądu. K06 dalej wymaga konkretnego protokołu wiążącego testy z artefaktem we wszystkich wspieranych ścieżkach; samo usunięcie bypassu tego nie załatwia.
6. Po odblokowaniu API utworzyć małe szkice PR z właściwymi bazami/ograniczeniami, bez automatycznego scalania. Zapis, manifest, commit/push i porównanie zdalnego SHA. Przy każdym kolejnym kroku aktualizować tę tabelę oraz CSV.

### Odtworzenie już wykonanych prób bez worktree

Harnessy są na gałęzi audytu; przed przełączeniem kodu skopiować je poza checkout, np. `git show docs/polutek-platform-audit:docs/audit/2026-11-01-platform-research/program-audytu/tools/k06-build-typecheck-check.mjs > /tmp/polutek-k06.mjs`. Następnie przełączyć czystą gałąź i uruchamiać z katalogu repo z Node 22. K02 analogicznie korzysta z `tools/k02-image-runtime-check.mjs`; utworzyć `/workspace/.cloud-setup` dla jego wyników.

K06 tryb `baseline` odtwarza akceptację złego typu na `e3801c27` (oba stare configi); tryb `fixed` sprawdza zły i legalny kod na gałęzi H1. K03: `node node_modules/vitest/vitest.mjs run tests/unit/operations/verify-restored-database-process.test.ts --maxWorkers=1`. Cała komenda `npm run test:critical-path` pozostaje niezaliczona do czasu odblokowania klienta.

Nie uruchamiać ponownie kosztownych prób bez zmiany/hipotezy. Nie kontynuować ogólnego V3+ zamiast odbioru H1, nie uznawać warunkowych NA za PASS i nie przywracać przyjętej partii 17 z archiwum. Pełny audyt pozostaje celem dalszych kamieni; bieżącą blokadą jest środowisko, nie brak zgody właściciela na H1.


## Ponowna próba po zgłoszeniu „Full Access”

2 listopada 2026 właściciel zgłosił zmianę na Full Access. Jednorazowo powtórzono dotknięte odczyty: Prisma checksum nadal proxy CONNECT 403 (curl exit 56, HTTP celu 000), API GitHub nadal Forbidden (gh exit 1). Runtime potwierdza enforced/restricted/spec. 1. [Dowód](program-audytu/evidence/h1-full-access-recheck.json).

Ta zgłoszona zmiana nie usunęła obserwowanej blokady tej instancji. Nie wiadomo, który dokładnie przełącznik UI został zmieniony; nie utożsamiać uprawnień wykonywania poleceń z aktywacją reguł HTTP. Potrzebny zrzut widoku, w którym właściciel zmienił Full Access, aby wskazać właściwą konfigurację bez zgadywania. Nie ponawiano instalacji, testów ani zapisu niezmienionego szkicu, nie próbowano alternatywnego hosta/proxy i nie proszono o nowy token.
