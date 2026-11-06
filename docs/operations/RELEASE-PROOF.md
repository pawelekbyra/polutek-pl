# Dowód źródeł, kontroli i tożsamości obrazów — K06

`scripts/ops/release-proof.mjs` zawiera wspólny walidator i zapis dowodu. `images.yml` używa `release-produce.mjs`, weryfikuje pięć lokalnych identyfikatorów przed logowaniem do GHCR, a `release-publish.mjs` publikuje dokładnie te ID i sprawdza każdy registry digest. **Kandydat na tej gałęzi**: `deploy.sh`, `deploy-admin.sh`, jawny/automatyczny rollback, transfer artifactu, włączenie telemetrii, compose bez awaryjnych tagów oraz jednorazowe kontenery operatora są związane z proofem. Proof-aware skrypty nie zostały zastosowane na serwerze.

`scripts/ops/release-artifact.mjs` sprawdza zgodność SHA, hash opublikowanego proofu, inputs i raportu jakości, a potem bezpiecznie rozpakowuje archiwum źródłowe i porównuje je z inwentarzem raportu. Wynikiem jest katalog `source/`, `proof.json`, `inputs.json` dla konsumenta.

`scripts/ops/deploy-release.mjs` przyjmuje ten katalog, pełny SHA commita i zatwierdzony hash dowodu. Ogranicza registry do `ghcr.io/pawelekbyra/polutek-{app,migrator,worker,collector,admin}@sha256:…`; używa lokalnego obrazu tylko wtedy, gdy jego ID pasuje do proofu, w przeciwnym razie pobiera dokładny digest. Samo pobranie nie uruchamia kontenera. Zachowuje zweryfikowane źródła i proof w `.release-state/<revision>/` do późniejszego rollbacku. Wymaga Node.js 22 na hoście. Konsument odmawia lokalnego budowania obrazów.

`mergedeploy.sh` przyjmuje lokalny `RELEASE_BUNDLE_DIR` albo artifact z ukończonego, zielonego runu `images` dla dokładnego SHA. W obu trybach wymaga zewnętrznego `RELEASE_PROOF_SHA256`, nie uruchamia Actions samodzielnie, sprawdza artifact przed transferem i blokuje serwer przed stagingiem źródeł. Lokalny wariant wspiera repozytoryjną politykę bez GitHub Actions: bundle zawiera `source.tar`, `quality.json`, `inputs.json`, `published-release-proof.json` i `published-release-result.json`. Dwa lokalne testy integracyjne potwierdzają poprawne przekazanie przez atrapę SSH oraz odmowę niezgodnego hasha; osobne próby odrzucają niewłaściwe SHA, run i brak artifactu. Nie było rzeczywistego SSH ani deployu; pozostałe ścieżki odzyskiwania i runtime wymagają odbioru.

Lokalna sekwencja: `release-produce.mjs` tworzy pełny zweryfikowany snapshot i pięć obrazów; `release-publish.mjs` publikuje wyłącznie ID z proofu po zalogowaniu operatora do GHCR i sprawdza digesty. Złóż pięć plików bundle opisanych wyżej, odczytaj hash publikacji i zatwierdź go niezależnie, a potem uruchom `mergedeploy.sh` z `RELEASE_BUNDLE_DIR`, `RELEASE_REVISION` i `RELEASE_PROOF_SHA256`. W wariancie Actions hash pochodzi z podsumowania runu, a `RELEASE_RUN_ID` wskazuje ten run. Skrypt sam nie uruchamia Actions ani nie wylicza zatwierdzonego hasha z badanego pliku. Nie wykonywano żadnej z tych sekwencji w bieżącej gałęzi.

## Kontrakt

Walidator przyjmuje pełny 40-znakowy SHA od wywołującego. Raport jakości musi pochodzić z Node 22, mieć pełne i ścisłe kontrole bez `--only`/`--skip`, zero nieudanych/pominiętych bramek oraz czyste i identyczne źródła przed i po kontroli. Wymagane są wszystkie 17 bramek, w tym `audit`, PostgreSQL, rzeczywisty encoder i oba zestawy krytyczne. Wszystkie raporty testowe muszą być niepuste i poprawne; testy krytyczne, PG i encoder nie mogą mieć pominięć. Pominięcia zwykłego unit pozostają jawne i nie są uznawane za pokryte wymagania.

Lokalne CI zapisuje `sourceBefore`, `sourceAfter`, `sourceStable`, `dirtyAfter` i `testSummary`. Każdy śledzony plik ma ścieżkę, tryb Git i SHA-256 bajtów. Zmiana źródeł podczas kontroli oznacza niezerowy wynik. Błędy kompilatora w `.next/` także kończą się FAIL. Raporty wcześniejszego formatu nie kwalifikują się do dowodu.

Kontekst budowy ma być czystym archiwum tych źródeł: bez `.git`, lokalnych `.env`, `node_modules`, dodatkowych plików/katalogów i dowiązań. Zmiany treści lub wykonywalności pliku są odrzucane. Nie normalizujemy CRLF po testach: bajty sprawdzane i budowane muszą być identyczne; na Windows stosować ustalone w repo `core.autocrlf=false`.

`seal` i `verify` wymagają semantyki uprawnień POSIX i odmawiają pracy w natywnym Windows. Użyć Linux/WSL; raport jakości można przygotować na Windows, ale jego pełne związanie z archiwum/obrazami należy wykonać w POSIX. Testy tych operacji również mają jawne ograniczenie platformy.

`inputs.json` zawiera dokładnie `schema_version: 1`, `platform` (`linux/amd64` lub `linux/arm64`), `bases` oraz `public_args`. Bazy `node`, `ffmpeg` i `collector` muszą być pełnymi odwołaniami `repo@sha256:...`. `public_args` wymaga kompletnego zestawu ośmiu argumentów `NEXT_PUBLIC_*` z Dockerfile; innych nazw, w tym sekretów, nie przyjmujemy. Wartości puste muszą być zapisane jawnie.

Dowód obejmuje pięć obrazów: `app`, `migrator`, `worker`, `collector`, `admin`. Każdy musi mieć etykiety rewizji, fingerprintu źródeł, raportu jakości, wejść i rodzaju obrazu. Docker jest odpytywany wyłącznie o ID, platformę, warstwy i etykiety; zmienne środowiska obrazu nie są wypisywane. Sprawdzana jest platforma i zgodność początkowych warstw z przypiętą bazą Node; dla kolektora używana jest jego osobna baza. Pochodzenie kopiowanych narzędzi, w tym FFmpeg, musi zapewnić zaufany producent z przypiętymi wejściami — sama analiza końcowych warstw tego nie dowodzi.

## Interfejs

Wszystkie opcje mają postać `--nazwa=wartość`; nieznane, puste i powtórzone opcje są odrzucane.

- `check-ci --report=... --revision=... --source=...`: sprawdza raport i archiwum bez Dockera.
- `labels --report=... --revision=... --source=... --inputs=... --kind=...`: zwraca wymagane etykiety dla producenta.
- `build --report=... --revision=... --source=... --inputs=... --out=...`: waliduje pełny raport i archiwum, buduje kolejno pięć obrazów lokalnie (`buildx --load`, bez publikacji), przekazując przypięte bazy, wszystkie publiczne argumenty i etykiety. Odczytuje niezmienne ID z nowych plików `--iidfile`, sprawdza obrazy i zapisuje `proof.json` w nowym katalogu poza archiwum. Nie przyjmuje dodatkowych flag Dockera. Przerwany wynik nie nadaje się do wznowienia; wybrać nowy katalog. Raport nadal musi pochodzić od zaufanego operatora; samo polecenie nie wykonuje kontroli.
- `seal --report=... --revision=... --source=... --inputs=... --images=... --out=...`: sprawdza pięć rzeczywistych obrazów i zapisuje nowy plik dowodu (0600, bez nadpisywania). `images.json` mapuje pięć rodzajów na lokalne odwołania; zapisujemy ich niezmienne ID.
- `verify --proof=... --proof-sha256=... --revision=... --source=... --inputs=... [--scope=all|app|admin]`: ponownie sprawdza dowód, archiwum i tożsamości obrazów. `app` obejmuje cztery obrazy bez panelu; `admin` tylko panel. Sam dowód zawsze musi opisywać komplet pięciu obrazów.

Wynik sukcesu to JSON i exit 0; każdy brak/niezgodność daje exit 1. `seal` wypisuje `proof_sha256`: hash kanonicznego JSON. Konsument musi otrzymać ten oczekiwany hash z zaufanego wyniku producenta/przeglądu. **Nie obliczać oczekiwanego hasha z pliku, który właśnie ma zostać zweryfikowany** — podmiana całego pliku nie byłaby wtedy wykrywana. Oczekiwany SHA kodu również pochodzi od wywołującego. Opcjonalne `registry_ref` obrazu musi wskazywać manifest przez digest, a odczytany obraz musi mieć zapisane wcześniej ID konfiguracji.

## Granice i dalsza integracja

Jest to niesygnowany lokalny zapis zaufanego operatora. Nie dowodzi, że lokalny administrator nie sfabrykował raportu ani etykiet, nie nadaje poziomu SLSA i nie zastępuje testów produktu. Producent ma uruchomić rzeczywiste kontrole, zbudować wyłącznie zweryfikowane archiwum z deklarowanymi wejściami, sprawdzić runtime oraz przekazać hash finalnego dowodu. Konsumenci wywołują `verify` przed publikacją, migracjami i aktywacją, a potem używają zwróconych niezmiennych ID. Pozostają próby rollbacku w atrapach oraz pełny pozytywny odbiór aplikacji.

W obecnej sesji nie wykonano pełnej bramki `audit`: wcześniejsza automatyczna kontrola odrzuciła upload grafu zależności. Wymaganie pozostaje w polityce; nie wstawiać fikcyjnego PASS i nie uznawać dotychczasowego lokalnego odbioru za kompletny dowód wydania. Raporty kontrolne i małe obrazy użyte w testach walidatora są syntetyczne, nie są dowodami zaliczenia aplikacji.

Dockerfile strony i panelu przyjmują globalne `NODE_BASE`, `FFMPEG_BASE`, `COLLECTOR_BASE`; polecenie `build` zawsze podaje pełne digesty. Compose dla wdrożenia odmawia uruchomienia domyślnych tagów `proof-required`; ścieżki narzędziowe i testowe Dockerfile nie aktywują obrazów produkcyjnych.

## Producent lokalny

`node scripts/ops/release-produce.mjs --revision=<pełny SHA> --inputs=<inputs.json> --out=<nowy katalog>` uruchamia pełne `local-ci --full --strict --jobs=1` na czystym checkoutcie wskazanego SHA. Katalog nadrzędny wyników musi istnieć; dla pracy lokalnej przewidziano ignorowany `.claude/releases/`. Nie przyjmuje raportu, listy testów, pominięć ani dodatkowych opcji Dockera. Błąd procesu, niepełny raport lub zmiana źródeł blokują budowanie. Losowe `POLUTEK_CI_RUN_ID`, zapisane przez runner w `runId`, wiąże raport z bieżącym uruchomieniem i uniemożliwia przypadkowe ponowne użycie starego pliku po awarii.

Po zaliczeniu kontroli producent zachowuje `quality.json`, `inputs.json`, rzeczywiste archiwum Git i rozpakowany, ponownie sprawdzony kontekst. Buduje pięć obrazów i zwraca hash dowodu. Jest to nadal dowód zaufanego lokalnego operatora, bez podpisu/SLSA. Testy producenta używają prawdziwego Git/tar oraz jawnych portów kontrolnych CI i Dockera; nie dowodzą zaliczenia pełnego produktu.

W tej partii nie uruchamiano pełnego producenta: obowiązkowe `audit` nadal wymaga rozstrzygnięcia historycznej odmowy uploadu. Nie obchodzić tych warunków filtrami ani syntetycznym raportem. Testowe proofy i obrazy są kontrolne, a nie dowodem zaliczenia aplikacji. Publikacja ani aktywacja nie zostały wykonane.

Przed pierwszą budową `release/dockerfile.mjs` sprawdza ograniczony kontrakt obu Dockerfile: zewnętrzne `FROM` muszą używać globalnie zadeklarowanych `NODE_BASE`, `FFMPEG_BASE` lub `COLLECTOR_BASE`, właściwych dla rodzaju etapu; `COPY --from` może wskazywać tylko wcześniejszy lokalny etap. Nowe dyrektywy parsera i montowane zewnętrzne źródła wymagają przeglądu. To kontrola użycia deklarowanych baz, nie pełny parser, audyt poleceń RUN ani gwarancja powtarzalności repozytoriów apt/npm.

## Publikowanie obrazów w GitHub Actions

`.github/workflows/images.yml` wymaga, by commit był już przodkiem `origin/main`. Instalacja, pełne ścisłe kontrole i pięć lokalnych buildów pochodzą z `release-produce.mjs`; nie używamy `docker/build-push-action`. Zanim workflow zaloguje się do GHCR, `release-proof.mjs verify` sprawdza pełny SHA, source archive, inputs, raport i pięć lokalnych image ID. `release-publish.mjs` ponownie wykonuje tę kontrolę, taguje obrazy wyłącznie zwróconymi ID, wypycha tag równy pełnemu SHA i pobiera każdy obraz z powrotem po digest. Wydaje kompletny proof z pięcioma `registry_ref` dopiero, gdy wszystkie digesty wskazują oczekiwane ID i etykiety.

`release-inputs.mjs` zapisuje wyłącznie osiem dozwolonych publicznych build args; tajne zmienne nie są wejściami. `release/bases-linux-amd64.json` przypina bazowe obrazy Node i FFmpeg do manifestów amd64. Zmiana platformy wymaga osobnych, zweryfikowanych digestów i zakresu buildera. Testy integracji używają syntetycznych proofów/obrazów; nie wykonano rzeczywistego workflow, logowania ani push do GHCR. Artifact lokalny i wariant Actions zostały sprawdzone do atrapowego transportu; żaden nie dotknął serwera.
