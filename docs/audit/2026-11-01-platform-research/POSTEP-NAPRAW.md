# Postęp realizacji roadmapy — H1

## Bieżące przejęcie — 3 listopada 2026, lokalna gałąź audytu

Producent dodany po części budowania (`c546726a`): `release-produce.mjs` uruchamia pełne ścisłe CI z jednym slotem, wymaga czystego wskazanego SHA przed/po i świeżego `runId`, tworzy rzeczywiste archiwum Git i dopiero przekazuje je do budowania. **121/121 testów**, lint zmienionych plików i skupiona ścisła kontrola typów PASS. Testy CI/Dockera kontrolowane, Git/tar rzeczywiste. Nie uruchomiono pełnego producenta aplikacji; brak kompletnego dowodu wydania. [Dowody producenta](program-audytu/evidence/k06-local-producer-2026-11-03/produce-result.json).

Następne: sprawdzić, czy Dockerfile faktycznie konsumują przypięte wejścia (ujemna próba ignorowanego ARG), uzupełnić brakujące zależności H1 w tej gałęzi i zintegrować wszystkich konsumentów. K06 pozostaje otwarte, szacunki bez zmian.

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
