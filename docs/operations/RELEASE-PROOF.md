# Dowód źródeł, kontroli i tożsamości obrazów — rdzeń K06

`scripts/ops/release-proof.mjs` zawiera wspólny walidator i zapis dowodu. **Budowanie pięciu obrazów z przypiętych wejść jest dostępne przez `build`. Uruchamianie kontroli przez zaufanego producenta oraz podłączenie do `images.yml`, `deploy.sh`, `deploy-admin.sh` i ręcznych ścieżek nie są jeszcze gotowe.** Samo dodanie tego narzędzia nie zabezpiecza obecnych ścieżek publikacji i nie upoważnia do wydania platformy.

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

Jest to niesygnowany lokalny zapis zaufanego operatora. Nie dowodzi, że lokalny administrator nie sfabrykował raportu ani etykiet, nie nadaje poziomu SLSA i nie zastępuje testów produktu. Producent ma uruchomić rzeczywiste kontrole, zbudować wyłącznie zweryfikowane archiwum z deklarowanymi wejściami, sprawdzić runtime oraz przekazać hash finalnego dowodu. Konsumenci mają wywołać `verify` przed publikacją, migracjami i aktywacją, a następnie użyć zwróconych niezmiennych ID. Dotychczasowe skróty/manualne tagi i rollback wymagają osobnego podłączenia oraz prób ujemnych.

W obecnej sesji nie wykonano pełnej bramki `audit`: wcześniejsza automatyczna kontrola odrzuciła upload grafu zależności. Wymaganie pozostaje w polityce; nie wstawiać fikcyjnego PASS i nie uznawać dotychczasowego lokalnego odbioru za kompletny dowód wydania. Raporty kontrolne i małe obrazy użyte w testach walidatora są syntetyczne, nie są dowodami zaliczenia aplikacji.

Dockerfile strony i panelu przyjmują globalne `NODE_BASE`, `FFMPEG_BASE`, `COLLECTOR_BASE`; polecenie `build` zawsze podaje pełne digesty. Dotychczasowe bezpośrednie wywołania Dockerfile zachowują domyślne tagi i wymagają osobnego podłączenia do protokołu. Nie stanowią chronionej ścieżki wydania.
