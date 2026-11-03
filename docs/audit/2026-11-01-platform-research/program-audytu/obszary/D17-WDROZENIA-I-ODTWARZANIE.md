# D17 — wdrożenia i odtwarzanie

**W_TRAKCIE**, 2 listopada 2026, partia 15. Polutek `c397b9e548ca2c628e21457ac69d66e54b12ddbd`, PeerTube `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`; rodzic zapisu `3318f5321e54d3a613bbfe120700642be724785b`. Badanie bez wdrożenia i zmian aplikacji/produkcji.

Polutek ma konkretne zabezpieczenia operacyjne: blokadę równoległego wdrożenia, zrzut przed migracją, zatrzymanie po błędzie, powrót do poprzedniego obrazu oraz szyfrowane kopie poza hostem. W kontrolowanych próbach wiele z tych granic działa. Udało się też rzeczywiście odtworzyć w lokalnym PostgreSQL schemat z 81 migracji wraz z syntetycznymi danymi i sprawdzić ograniczenia po odtworzeniu. To wartościowy wynik, lecz nie dowód odzyskania całej platformy z kopii produkcji.

Najważniejsze braki pozostają w **R09** (powiązanie jakości z wydawanym artefaktem) i **R12** (pełne odtworzenie obejmuje więcej niż bazę). Nowy **R37** dotyczy pomocniczego weryfikatora odtworzonej bazy: może zwrócić sukces mimo niewykonanych kontroli. Nie przenosimy tej usterki na niezależny cotygodniowy skrypt restore.

## Co wykonano

| Dowód | Wynik | Ograniczenie |
|---|---|---|
| [Mapa źródeł wydania](../evidence/release-evidence-map.json), [skrypt](../tools/release-evidence-map.py) | 13 zadeklarowanych zadań CI, osobny workflow czterech obrazów, argumenty i konfiguracja | Analiza YAML/tekstu; żadnego workflow nie uruchamiano, ustawienia repo/registry nie były odczytane |
| [Backup — siedem scenariuszy](../evidence/backup-boundaries-experiment.json), [skrypt](../tools/backup-boundaries-experiment.py) | Poprawny przebieg kontrolny; wykryte brak bazy, pusty i częściowy błędny zrzut, błąd archiwum sekretów, szyfrowania i sprawdzenia uploadu | Rzeczywisty niezmieniony backup.sh w temp; Docker/tar/age/rclone są atrapami. Gzip i semantyka pipeline rzeczywiste; brak prawdziwego szyfrowania/offsite |
| [Wdrożenie — osiem scenariuszy](../evidence/deployment-boundaries-experiment.json), [skrypt](../tools/deployment-boundaries-experiment.py) | Zrzut/migracja/blokada/rollback i jawne ostrzeżenia sprawdzone | Niezmieniony deploy.sh, atrapy wszystkich usług i poleceń zmieniających host; pliki stanu wyłącznie w temp |
| [Weryfikator — 11 scenariuszy](../evidence/restore-verifier-experiment.json), [skrypt](../tools/restore-verifier-experiment.cjs) | Cztery warianty R37, siedem kontroli zachowania | Rzeczywisty TS w VM, osobny prawdziwy proces na przypadek i prawdziwy process.exit; jawna atrapa konstruktora/zapytań. Bez zainstalowanego klienta Prisma lub DB |
| [Rzeczywiste SQL dump/restore — trzy obserwacje](../evidence/database-restore-drill.json), [skrypt](../tools/database-restore-drill.py) | Wszystkie 81 migracji SQL do pustej bazy; pg_dump → gzip → psql do drugiej; zgodność wybranego snapshotu, FK i unique odrzucają błędne dane; obie bazy usunięte | PostgreSQL 17.11 lokalnie, syntetyczne konto/kanał/film/asset/płatność/grant. Bez Prisma migration engine/history, ról pg_dumpall, R2, aplikacji i realnej płatności |
| Istniejący Vitest | [28/28 logiki local-ci](../evidence/release-local-ci-vitest.json), [7 statycznych sprawdzeń skryptów](../evidence/release-static-vitest.json), oba exit 0 | W drugim przebiegu pozostałych 17 testów celowo pominięto filtrem. Nie są zaliczone. Nie powtarzano pełnego zestawu, generowania ani npm audit |

[Zakres/hash plików](../evidence/batch15-review.json), [brak zmian aplikacji](../evidence/source-scope-batch15.json), [29 scenariuszy](../SCENARIUSZE-WDROZENIA.csv), [mapa odzyskiwania](../ODTWARZANIE-POKRYCIE.csv), [walidacja](../evidence/validation-batch15.json). Zakres źródeł jest częściowy i nakłada się na poprzednie partie. Mechaniczne odczytanie 81 migracji nie oznacza ich ponownego ręcznego audytu.

## Co chroni wdrożenie, a czego nie dowiedziono

W [deploy.sh](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/deploy/serwerek/deploy.sh) wspólna blokada z panelem ma zapobiegać jednoczesnej zmianie katalogu i plików wersji. Kontrola busy dała exit 75 przed atrapą Docker. Nie wykonano rzeczywistej rywalizacji dwóch procesów flock; to dowód obsługi odmowy blokady.

Błąd zrzutu przed migracją, także po wypisaniu części danych, zatrzymał próbę przed migracją/restartem i usunął niepełny plik. Błąd migracji zatrzymał start nowej aplikacji. Nie oznacza to automatycznie, że nieudana migracja nie zmieniła bazy: atomowość i częściowy skutek zależą od SQL i narzędzia migracji. Nieudany start nowego obrazu uruchomił start starego, a wdrożenie zwróciło błąd mimo skutecznego powrotu. To właściwa informacja dla operatora.

Gdy aplikacja przechodzi lekki health, niedziałający encoder albo niepotwierdzona baza podczas końcowego readiness dają **OK WITH WARNINGS i exit 0**. Kod nie ukrywa ostrzeżenia, a nieudany encoder nie jest promowany jako uruchomiony. To jawna polityka częściowego wdrożenia; przy platformie wielu twórców trzeba określić, kto odbiera takie ostrzeżenie i kiedy wolno je zaakceptować. Sygnał „proces odpowiada” oraz ostrzeżenia nie dowodzą działającego uploadu/płatności/filmu — związek z R18, bez nowego duplikatu.

Ręczny rollback pominął migrację i przywrócił poprzedni obraz w fixture. **Nie cofa schematu.** Kod i instrukcja ostrzegają o migracji destrukcyjnej `20261005210000_cleanup_dead_schema`. Po usunięciu kolumn stary obraz też może nie działać. Odtworzenie bazy z wcześniejszej chwili może z kolei usunąć późniejsze zapisy, choć obciążenia u dostawcy płatności już istnieją. Potrzebna jest zgodność stary/nowy kod–schemat, zatrzymanie zapisów lub właściwa migracja naprawcza i kontrolowane uzgodnienie płatności. Nie ćwiczono tego pełnego przebiegu.

## R09 — build, kontrola jakości i publikowany obraz

[CI](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/.github/workflows/ci.yml) zawiera oddzielne typecheck, testy, lint, migracje PostgreSQL i smoke FFmpeg. To mocna intencja procesu. [Workflow obrazów](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/.github/workflows/images.yml) jest jednak uruchamiany osobno — ręcznie lub tagiem `deploy-*` — i nie ma w badanym YAML zależności od wyniku tamtego CI. Sam Dockerfile generuje Prisma i buduje Next, bez wywołania quality/typecheck/testów. Konfiguracje publicznego Next i panelu mają `ignoreBuildErrors:true`.

Wniosek jest ograniczony: **sam sukces budowy/publicznego obrazu nie jest dowodem przejścia kontroli typów i testów dla tego wydania**. Nie odczytano branch protection, wymaganych statusów, środowisk GitHub ani aktywnego procesu operatora. Może on sprawdzać to oddzielnie; nie udowodniono, że wadliwe wydanie trafiło na produkcję. Nie uruchamiano ponownie pełnego build/typecheck, więc nie ogłaszamy nowej liczby błędów typów.

Lokalne `quality` łączy architecture, typecheck i testy; bardziej rozbudowane local-ci planuje też inne bramki. Istniejące 28 testów jego czystej logiki przeszło. Domyślne `summarize` dopuszcza SKIP środowiskowy, a `--strict` go odrzuca; `--full` i `--strict` mają różne zadania. Raport z pominięciami trzeba czytać wraz z tabelą wyników. Nie uruchomiono całego local-ci — m.in. nie omijano wcześniejszej odmowy npm audit ani blokady binariów Prisma.

`scripts/ops/mergedeploy.sh` to dodatkowa ścieżka historyczna: tryb LOCAL_CI wiąże merge z `--match-head-commit`, natomiast zwykły wybiera ostatni przebieg po nazwie gałęzi. Dokumentacja wskazuje, że bieżąca praca używa procesu lokalnego, bez tego GitHub/SSH flow. Nie wykonywano merge, gh, SSH i deploy; nie potwierdzono aktywnego użycia ani nie zarejestrowano kolejnej podatności za samą obecność skryptu.

Wydanie otrzymuje tag skróconego SHA, a workflow wypisuje digests. To pomaga identyfikować wersję, lecz tag można ponownie opublikować, a odbudowa tego samego kodu może użyć innych obrazów bazowych, pakietów systemu i zmiennych publicznych. Deploy pobiera tag i nie weryfikuje w źródle atestacji ani zatwierdzonego digestu. Nie sprawdzano registry. Buildx może wytwarzać domyślne atestacje bez jawnej opcji w YAML — brak opcji nie jest dowodem braku takiego artefaktu. Sam hash bez weryfikacji pochodzenia też nie potwierdza zaufanego wydania.

Mapa wykazała dwa publiczne ARG z Dockerfile nieprzekazywane w kroku app workflow: `NEXT_PUBLIC_SITE_BETA` i `NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY`. Domyślna wartość może być zamierzona, a lokalny build ma inny zestaw wejść. To otwarte pytanie o zgodność ścieżek budowania, bez dowodu błędnej kasy lub nowego ustalenia.

Kierunek R09: wiązać testy i publikację z dokładnym kodem, konfiguracją budowy i digestem artefaktu; zdefiniować warunki blokujące i świadome wyjątki. Trzymać oddzielnie uprawnienia tworzenia wydania i jego akceptacji; sprawdzać pochodzenie przed uruchomieniem. Nie trzeba do tego porzucać autoryzowanego procesu lokalnego na rzecz GitHub Actions.

## R12 — kopia i odtworzenie całego produktu

[backup.sh](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/serwerek/backup.sh) używa wymaganej listy baz, `pipefail`, minimalnego rozmiaru, gzip -t, manifestu/hash, szyfrowania age i rclone check. W siedmiu próbach normalny wariant przeszedł, a wszystkie zasymulowane awarie zostały odrzucone. Podejrzenie ukrywania błędu częściowego zrzutu **odrzucono**: `set -uo pipefail` włącza pipefail. Zachowano [diagnostykę badania](../evidence/batch15-harness-diagnostics.json), bez rejestracji pozornego błędu aplikacji.

Cotygodniowy [restore-test.sh](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/serwerek/restore-test.sh) izoluje kontener (`--network none`, tmpfs, limity), bada User/Video, wiek zrzutu, liczbę zakończonych migracji z tolerancją trzech oraz dopuszcza do jednego ERROR psql. Ten próg nie sprawdza rodzaju pojedynczego błędu, a równa liczba migracji nie porównuje nazw/checksum. To ograniczenia procedury z odczytu, bez odtworzenia ataku lub nowego ID. Opcjonalna kontrola R2 sprawdza obecność kopii; nie pobiera jej i nie odszyfrowuje. Przy braku pliku konfiguracji offsite ten fragment jest pomijany. Nie uruchamiano tego skryptu ani jego rzeczywistego timera.

W lokalnej próbie odtworzenia zastosowano całe 81 migracji SQL do świeżej bazy. Snapshot obejmował liczby tabel/ograniczeń/indeksów/triggerów oraz wybrane pola syntetycznych rekordów konta, filmu, assetu, płatności i grantu. Po pg_dump/gzip/psql wartości były identyczne, FK i unique działały. Nie porównano treści wszystkich tabel/definicji schematu i nie użyto silnika migracji Prisma, pg_dumpall ról, produkcyjnego wolumenu danych ani aplikacji. Czasy lokalne zapisano jako kontekst tej próby, **nie RTO produkcji**.

Zrzut `pre-deploy-*` powstaje lokalnie. `backup.sh` szyfruje i wysyła pliki z własnym bieżącym znacznikiem czasu, a nie cały katalog istniejących kopii. Sama obecność zrzutu pre-deploy nie dowodzi jego kopii poza hostem; przed ryzykowną migracją runbook zaleca osobny pełny backup. Trzeba wyraźnie odróżnić lokalny punkt rollback od potwierdzonego punktu odzyskania po utracie serwera.

[Mapa odzyskiwania](../ODTWARZANIE-POKRYCIE.csv) rozdziela bazę od obiektów filmów, sekretów, obrazów, konfiguracji i usług. Według dokumentacji `SERWEREK.md` kopie nie obejmują oryginałów, HLS i miniatur w R2; deklarowany dobowy zrzut bez WAL/PITR oznacza możliwość utraty późniejszych zapisów. To opisane ograniczenia, nie zweryfikowana bieżąca polityka bucketów lub dowód utraty danych. Zaszyfrowana kopia DB może być poprawna, a wskazywać na nieistniejący film.

`RESTORE.md` mówi, że klucz age jest wyłącznie u właściciela. Nowszy runbook wskazuje niezweryfikowaną informację o kopii na serwerze. Nie sprawdzano plików sekretów ani klucza. Trzeba uzgodnić rzeczywisty model dostępu i potwierdzić drugą bezpieczną kopię; sprzeczność nie jest dowodem kompromitacji klucza. Retencja/lock R2 i dawne wyniki restore są zapisami historycznymi, nie nowym pomiarem ich działania.

Test odbioru R12 wymaga odzyskania z samej kopii poza hostem: dostępu do kont/klucza, DB i ról, właściwych wersji kodu, sekretów, konfiguracji sieci/Access/Workerów, plików wideo i zadań. Następnie logowanie, uprawnienia, odtwarzanie własnego filmu, bezpieczna obsługa płatności i wznowienie kolejek bez niepożądanych powtórek. Zmierzyć dopuszczalną stratę danych (RPO), czas przywrócenia (RTO), datę kopii i punkt zgodności DB–R2–dostawca płatności. Nie tworzyć płatnych kopii/snapshotów ani nie zmieniać polityk produkcji bez osobnego zakresu.

## R37 — pomocniczy weryfikator może dać fałszywy sukces

Źródło: [verify-restored-database.ts](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/verify-restored-database.ts). **P2 narzędzia weryfikacji**, independent review PENDING. Nie wykazano użycia tego narzędzia w aktywnym procesie ani rzeczywistej błędnej bazy uznanej za zdrową.

Cztery odtworzone warianty, każdy z rzeczywistym exit 0 i komunikatem VERIFICATION SUCCESSFUL:

1. Odrzucony count Payment jest wypisany jako błąd, lecz `checkModel` zwraca null bez zwiększenia licznika porażek. Późniejsze syntetyczne zapytania działają i całe sprawdzenie przechodzi. To błąd pojedynczego count, nie dowód istnienia brakującej całej tabeli.
2. To samo z manifestem oczekującym Payment=1: brak wartości w counts daje ostrzeżenie zamiast niezgodności, nadal sukces.
3. Błąd zapytania do historii migracji daje warning i pozwala przejść dalej.
4. Wpis migracji z finished_at=null, rolled_back_at=null i logs=null nie spełnia filtra „failed or unfinished”, więc nie jest odrzucony.

Kontrole dodatnie/ujemne: poprawne dane przechodzą; brak URL, brak opt-in i dokładnie ten sam URL co DATABASE_URL kończą proces przed utworzeniem klienta. Wpis migracji z logs, rzeczywista niezgodność znanej liczby w manifeście i osierocony grant kończą proces błędem. To nie jest narzędzie, które zawsze zwraca sukces.

Pierwszy harness rzucał wyjątek zamiast kończyć proces; kod mógł go złapać wewnętrznym catch, więc kontrola była niewiarygodna. Poprawiono wyłącznie harness: każdy przypadek ma własny proces, a process.exit naprawdę go kończy. [Diagnoza zachowana](../evidence/batch15-harness-diagnostics.json), finalne 11 obserwacji exit 0 skryptu badania. Nie podmieniano zainstalowanego klienta Prisma i nie uzyskiwano tym sposobem zielonego Vitest.

Propozycja: zbierać wszystkie nieudane obowiązkowe kontrole i zwracać błąd/niepełną weryfikację; brak oczekiwanego pola manifestu traktować jako porażkę; sprawdzać jednoznacznie statusy i oczekiwaną tożsamość migracji. Test odbioru: każdy wariant powyżej kończy się bez komunikatu sukcesu i kodem niezerowym; zachować kontrolę poprawnego przypadku i preflight bezpieczeństwa. R37 jest konkretnym błędem wyniku narzędzia; R12 obejmuje szerszy, nadal nieudowodniony pełny proces odzyskiwania.

## Co warto przejąć z PeerTube

| Źródło przypiętego PeerTube | Wzorzec | Ograniczenie porównania |
|---|---|---|
| [Lista wydania](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/support/doc/development/release.md) | Sprawdzenie migracji między wersjami, języków, zielonego CI, E2E i etapowe aktualizowanie instancji | Lista nie dowodzi wykonania tych czynności w sesji lub każdym wydaniu |
| [Skrypt release](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/scripts/release.sh#L107) | Podpisy GPG archiwów i publikacja podpisów obok paczek | Nie uruchomiono podpisywania/weryfikacji; sam dostępny podpis nie oznacza sprawdzenia go przez odbiorcę |
| [Upgrade](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/scripts/upgrade.sh) | Zrzut SQL do pliku, kontrola miejsca, wersjonowane katalogi, sprawdzenie nowego symlinku i przegląd zmian konfiguracji | Brak pg_dump wypisuje ostrzeżenie i nie blokuje reszty; badany downloader nie weryfikuje GPG. Nie kopiować bez oceny |
| [Instrukcja rollback](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/support/doc/production.md#L447) | Powrót do starej wersji wraz z odtworzeniem SQL, jawne powiązanie kod–schemat | Przywracanie wcześniejszej bazy ma koszt utraty nowych zapisów; nie wykazano kompletnego restore mediów/offsite |
| [CI](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/.github/workflows/test.yml) i obrazy | Macierz API/transkodowania/federacji/object-storage; publikacja osobnych wersji i architektur | Nie uruchomiono testów/obrazów; osobne Docker workflow również nie dowodzi automatycznie zależności od całego CI; bazowe tagi/pakiety zmieniają się |

Polutek ma już prostsze, użyteczne rozdzielenie app/worker/collector/migrator i osobnego panelu, non-root w obrazach oraz mocniejsze ustawienia panelu/kolektora. Compose wiąże porty z loopback, panel nie dostaje docker.sock. To deklaracje źródła, nie test izolacji produkcji. Dla kilkunastu twórców nie ma podstaw do kopiowania całej infrastruktury PeerTube; warto przejąć kontrolę wydania i sprawdzoną ścieżkę aktualizacji/odzyskiwania.

## Źródło internetowe i dalsze warunki odbioru

Przeczytano wybrane części oficjalnej **SLSA v1.2, Build Track Basics i Build Requirements**, źródło `slsa-framework/slsa`, commit `ae7fc76215004e8fae250c877eff8919bf048e3b`. [Kopia basics](../sources/slsa-v1.2-build-track-basics.md), [requirements](../sources/slsa-v1.2-build-requirements.md), [Community Specification License 1.0](../sources/slsa-v1.2-LICENSE.md), [HTTP/hash](../sources/fetch-release-batch15.json). Początkowa próba sieciowa bez odpowiedzi HTTP i dwa 404 błędnych ścieżek zachowane; nie uznano ich za źródła specyfikacji.

SLSA odróżnia informację o pochodzeniu od podpisanego, zaufanego pochodzenia i jego sprawdzenia przez odbiorcę. Nie przyznano Polutkowi ani PeerTube poziomu SLSA. Certyfikacja wymaga oceny platformy budowy, dystrybucji i weryfikacji dowodów; sam YAML lub SHA tagu nie wystarcza.

D17 pozostaje otwarte: pełny build i kontrole z Prisma w dozwolonym środowisku; rzeczywiste wymagane bramki i akceptacja ostrzeżeń; digest/pochodzenie uruchomionego obrazu; zgodność schematu w obie strony; odtworzenie z samego offsite z mediami/rolami/konfiguracją; uprawnienia do kluczy i backupów; pomiary RPO/RTO przy reprezentatywnych danych. Następny osobny zakres D18: jakość testów i całościowy plan zamykania pozostałych luk dowodowych.
