# Badanie Polutka i porównanie z PeerTube

Jedno długoterminowe badanie rozwijane na gałęzi **`docs/polutek-platform-audit`** w repozytorium `pawelekbyra/polutek-pl`. Właściciel 1 listopada 2026 polecił zachowywać tutaj także poprzednie badanie i dopisywać kolejne wnioski na tej samej gałęzi.

## Zacznij tutaj

| Materiał | Znaczenie |
|---|---|
| [Raport bazowy](RAPORT.md) | Pogłębione porównanie, 22 obszary oceny, wyniki kontroli i eksperymentów |
| [Program pełnego badania](program-audytu/PROGRAM.md) | Zakres 18 obszarów, etapy, wymagania dowodu i warunki ukończenia |
| [Stan i następny krok](program-audytu/STAN.md) | Punkt wznowienia każdej kolejnej sesji |
| [Mapa systemu](program-audytu/MAPA-SYSTEMU.md) | Komponenty, role, 14 przepływów krytycznych i granice zaufania |
| [D01: produkt i zakres](program-audytu/obszary/D01-PRODUKT-I-ZAKRES.md) | 22 obietnice produktu i rozdzielenie implementacji od aktywnej konfiguracji |
| [D03: tożsamość i sesje](program-audytu/obszary/D03-TOZSAMOSC-I-SESJE.md) | Konta WWW/panelu, zakres R13/R14 i R24: realny pomiar cofania sesji w izolowanym HTTP biblioteki |
| [D04: role i izolacja](program-audytu/obszary/D04-ROLE-I-IZOLACJA.md) | Role, R23 oraz 19 obserwacji zakresu playlist i kolejki na rzeczywistych funkcjach z atrapą DB |
| [D05: wejścia, pliki i zależności](program-audytu/obszary/D05-WEJSCIA-PLIKI-I-ZALEZNOSCI.md) | R15: limity przed parserem; R01: wersje objęte advisory; ograniczone próby FFmpeg bez potwierdzenia SSRF |
| [D06: dane i integralność](program-audytu/obszary/D06-DANE-I-INTEGRALNOSC.md) | 15 prób na prawdziwym PostgreSQL; działające FK/unique/triggery i granice odpowiedzialności aplikacji |
| [D07: transakcje i ponowienia](program-audytu/obszary/D07-TRANSAKCJE-I-PONOWIENIA.md) | R26: limit playlist przy współbieżności; R27: opóźnione ukończenie uploadu cofa wybór oryginału |
| [D08: kodowanie i usuwanie](program-audytu/obszary/D08-UPLOAD-KODOWANIE-I-USUWANIE.md) | R28: błąd audytu po aktywacji kasuje wynik; R29: aktywacja podczas kasowania; mocniejszy dowód R02 |
| [D09: odtwarzanie, tokeny i cache](program-audytu/obszary/D09-ODTWARZANIE-TOKENY-I-CACHE.md) | 33 istniejące testy przeszły; R30: metadane ukrytej premiery; pomiar mechanizmu R07 i poprawnych granic |
| [Scenariusze wejść](program-audytu/SCENARIUSZE-WEJSCIA.csv) | 25 obserwacji czytników i procesów; pełne HTTP/proxy oraz docelowy build FFmpeg do sprawdzenia |
| [Scenariusze pipeline](program-audytu/SCENARIUSZE-PIPELINE.csv) | 11 obserwacji komponentów, osobne dowody SQL i otwarta walidacja pełnego stosu |
| [Scenariusze odtwarzania](program-audytu/SCENARIUSZE-ODTWARZANIE.csv) | 38 obserwacji decyzji/planu, sesji i Workera z jawnymi granicami I/O i symulowanym czasem |
| [Scenariusze płatności](program-audytu/SCENARIUSZE-PLATNOSCI.csv) | 18 obserwacji komponentów i dwa protokoły PostgreSQL; pełny Stripe/HTTP do wykonania |
| [Niezmienniki danych](program-audytu/NIEZMIENNIKI-DANYCH.csv) | Wyniki bezpośrednich prób SQL oddzielone od pełnej oceny aplikacji |
| [D10: płatności i rozliczenia](program-audytu/obszary/D10-PLATNOSCI-I-ROZLICZENIA.md) | R31: refund odbiera inny opłacony pakiet; R32: zaniżona suma wpłat; R17 przyszłego marketplace, osobne dowody komponentów i SQL |
| [D11: moderacja i nadużycia](program-audytu/obszary/D11-MODERACJA-I-NADUZYCIA.md) | Granice komentarzy, banów i odwołań; R25: stare odwołanie cofa nowsze ograniczenie po cyklu statusu |
| [D12: prywatność i cykl danych](program-audytu/obszary/D12-PRYWATNOSC-I-CYKL-DANYCH.md) | R33: publiczny profil po usunięciu konta; R16: eksport; kontrolowane próby cleanup/retencji i konkretne porównanie PeerTube |
| [Cykl danych](program-audytu/CYKL-DANYCH.csv) | Kategorie eksportu/usuwania/retencji z poziomem dowodu i pytaniami |
| [Scenariusze prywatności](program-audytu/SCENARIUSZE-PRYWATNOSC.csv) | 15 obserwacji komponentów, pełny stos niewykonany |
| [Scenariusze pełnego HTTP](program-audytu/SCENARIUSZE-D03-D04.csv) | 46 planowanych prób; osobne kolumny dla dowodów izolowanych i SQL, powiązania z D06/D07/D08/D11/D14 |
| [Powierzchnia wejść](program-audytu/POWIERZCHNIA-WEJSC.csv) | Trasy, Server Actions, strony, zdarzenia workerów i wejścia operacyjne do kontroli |
| [Rejestr ustaleń](program-audytu/USTALENIA.json) | Stabilne R01–R34, statusy i przypisanie do obszarów; raport bazowy zachowuje wcześniejsze 22 |
| [Pokrycie obszarów](program-audytu/POKRYCIE.csv) | Ocena postępu bez ukrywania niezbadanych elementów |
| [ASVS — 345 wymagań](program-audytu/ASVS-POKRYCIE.csv) | Lista do kwalifikacji i sprawdzania; nie lista zaliczonych testów |
| [Plan eksperymentów i pomiarów](PLAN-WERYFIKACJI.md) | Dalsze testy runtime, awarie, benchmark i model kosztów |
| [Źródła zewnętrzne](program-audytu/SOURCES.md) | Oficjalne OWASP, W3C, Web Vitals, SLSA i PeerTube |
| [Historia badania](program-audytu/ZMIANY.md) | Zmiany programu i ustaleń |
| [Pierwszy przegląd](POROWNANIE-WSTEPNE.md) | Materiał historyczny poprzedzający raport bazowy; nie aktualne podsumowanie całego audytu |

## Jak rozwijamy tę gałąź

- Kolejne partie badania trafiają jako osobne commity na **tej samej gałęzi**. Nie tworzymy gałęzi i konkurującego raportu po każdej sesji.
- Przed pracą odczytujemy STAN.md, sprawdzamy SHA aplikacji i zmiany od ostatniego badania. Nie zakładamy, że wynik dla starego SHA opisuje nowszy kod.
- Aktualizujemy raport obszaru, rejestr ustaleń, pokrycie i punkt wznowienia. Odrzucone podejrzenia oraz naprawione problemy pozostają w historii z przyczyną i wynikiem retestu.
- Nie dopisujemy ustaleń jako zmian implementacji. Naprawy, scalanie do `main` i wdrożenia nie wynikają automatycznie z utworzenia tej gałęzi.
- Materiały nie zawierają sekretów; do dowodów nie kopiujemy plików env, dumpów danych ani danych prawdziwych użytkowników.

Jest to jawny wyjątek od ogólnej zasady usuwania rozwiązanych znalezisk z roboczych audytów i niewprowadzania raportów sesji do repo. W tym katalogu przechowujemy trwały materiał badawczy na wyraźne polecenie właściciela.

## Dowody i wersje

Bazowy kod Polutka: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. PeerTube: `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`. Linki do analizowanego kodu wskazują te konkretne commity na GitHubie; nie przesuwają się razem z `main`.

Logi i JSON z wcześniejszych przebiegów zachowano bez przepisywania. Ich ścieżki `/workspace/...`, lokalna nazwa bazy oraz wersje narzędzi są historycznym kontekstem wykonania, a nie instrukcją wymagającą takich samych katalogów na komputerze właściciela. Inwentarz plików opisuje wersję bazową i nie dowodzi przeczytania wszystkich plików.

Historyczne manifesty w `provenance/` odnoszą się do materiałów sprzed przeniesienia i adaptacji linków. `GITHUB-MANIFEST.json` zawiera hashe bieżących plików importu. Po zmianie materiału należy odświeżyć bieżący manifest, zachowując historię w Git.

## Odtwarzanie lokalnych eksperymentów

Z korzenia repo, po przygotowaniu zależności i aktywacji Node 22:

```bash
node --import tsx docs/audit/2026-11-01-platform-research/pipeline-experiments.ts
node --import tsx docs/audit/2026-11-01-platform-research/storage-experiment.ts
node docs/audit/2026-11-01-platform-research/program-audytu/tools/identity-context-experiment.cjs
node docs/audit/2026-11-01-platform-research/program-audytu/tools/session-revocation-experiment.mjs
node docs/audit/2026-11-01-platform-research/program-audytu/tools/resource-scope-experiment.cjs
node docs/audit/2026-11-01-platform-research/program-audytu/tools/moderation-boundaries-experiment.cjs
python3 docs/audit/2026-11-01-platform-research/program-audytu/tools/database-integrity-experiment.py
node docs/audit/2026-11-01-platform-research/program-audytu/tools/pipeline-boundaries-experiment.cjs
PYTHONDONTWRITEBYTECODE=1 python3 docs/audit/2026-11-01-platform-research/program-audytu/tools/playback-cascade-experiment.py
node docs/audit/2026-11-01-platform-research/program-audytu/tools/playback-access-experiment.cjs
node docs/audit/2026-11-01-platform-research/program-audytu/tools/input-boundaries-experiment.cjs
node docs/audit/2026-11-01-platform-research/program-audytu/tools/ffmpeg-input-experiment.mjs
node docs/audit/2026-11-01-platform-research/program-audytu/tools/payment-boundaries-experiment.cjs
PYTHONDONTWRITEBYTECODE=1 python3 docs/audit/2026-11-01-platform-research/program-audytu/tools/payment-total-sql-experiment.py
node docs/audit/2026-11-01-platform-research/program-audytu/tools/privacy-boundaries-experiment.cjs
```

Pierwsze dwa eksperymenty wywołują rzeczywisty procesor/klasę magazynu z atrapami portów. Nie łączą się z R2 ani produkcyjną bazą. Nie zastępują pełnych testów lokalnego stosu.

Trzeci skrypt wykonuje niezmienione moduły TypeScript przez transpiler z jawnymi atrapami I/O. Odtwarza decyzje tożsamości/uprawnień oraz utratę kanału w finalizerze. Nie używa wygenerowanego klienta Prisma, nie wykonuje faktycznej publikacji i nie zmienia wyniku zablokowanych testów aplikacji na zaliczony.

Czwarty uruchamia prawdziwy serwer HTTP Better Auth pod 127.0.0.1 z oficjalnym adapterem pamięci i stałymi sesji Polutka. Zajmuje około 62 sekund rzeczywistego czasu; wartości cookie i sekretów nie są drukowane. Nie uruchamia Next ani produkcyjnej integracji auth. Piąty sprawdza 19 przypadków playlist i kolejki na rzeczywistych funkcjach, z atrapą bazy. Szczegóły i granice dowodu opisują D03/D04.

Szósty wykonuje 26 obserwacji moderacji i języków panelu z atrapami I/O. Dwa warianty odtwarzają ten sam R25 dla kanału i filmu; pozostałe są kontrolami i przykładami poprawnych granic. Brak prawdziwej DB, HTTP i dispatchu Server Actions; szczegóły w D11/D04.

Siódmy wymaga Dockera z lokalnym kontenerem PostgreSQL i badawczej bazy wskazanej w historycznym manifeście migracji. Wykonuje 15 prób integralności, dwa protokoły limitu i przeplot ponowienia uploadu. Tworzy losowe fixture, wycofuje lub usuwa je po badaniu i nie zmienia schematu publicznego. To rzeczywiste SQL z protokołem przejrzanego kodu; nie uruchamia TypeScript/Prisma ani pełnych żądań aplikacji.

Ósmy łączy rzeczywiste komponenty procesora, finalizera, tras, audytu i cleanup z jawnymi atrapami I/O: 11 obserwacji, w tym siedem poprawnych kontroli. Nie uruchamia Prisma, R2, FFmpeg ani autoryzacji panelu. Dziewiąty używa lokalnego PostgreSQL i helpera siódmego skryptu; sprawdza trzy protokoły COMMIT/kaskad i usuwa własne fixture. Te dwa poziomy dowodu są rozliczone oddzielnie w D08.

Dziesiąty wykonuje rzeczywistą decyzję dostępu, pełny PlaybackService, podpis/sanitizer i funkcję Workera: 38 obserwacji przy jawnych atrapach DB/R2/cache i symulowanym zegarze. Nie wywołuje prawdziwego logout, zmiany stanu, Next/Prisma ani Cloudflare. Tokeny i podpisane URL-e nie są drukowane. D09 oddzielnie zapisuje celowany Vitest: cztery pliki, 33 testy, wszystkie przeszły.

Pełna walidacja runtime była zablokowana pobieraniem silnika/checksum Prisma. Ten stan pozostaje jawną niewiadomą, nie domyślnym zaliczeniem testów.

Jedenasty skrypt wykonuje rzeczywiste czytniki na native Request/FormData, z jawnymi niewywołanymi atrapami importów tożsamości/kontekstu. Dwunasty wymaga lokalnego ffmpeg/ffprobe i możliwości otwarcia własnego portu loopback; tworzy i usuwa fixture, nie używa produkcji. Host 7.1.5 nie zastępuje docelowego Docker 8.0.1. Szczegóły i nie w pełni zaliczony przebieg pięciu plików Vitest (38 passed, jeden plik zablokowany przez Prisma) opisuje D05. Nowe npm audit nie zostało wykonane po automatycznej odmowie ujawnienia grafu zależności.

Trzynasty skrypt wykonuje komponenty płatności i prawdziwy HMAC SDK Stripe na syntetycznym sekrecie: 18 obserwacji, jawne atrapy DB/Stripe API/audytu, bez sieci i pieniędzy. Czternasty korzysta z lokalnej badawczej bazy i helpera siódmego skryptu: dwa sekwencyjne protokoły SQL, własne fixture ROLLBACK. Nie uruchamiają pełnej aplikacji/Prisma. D10 osobno zapisuje sześć plików Vitest zablokowanych przed rejestracją, zero wykonanych testów.

Piętnasty skrypt wykonuje cleanup/eksport/retencję/publiczny header kanału/kolektor na syntetycznych danych: 15 obserwacji, jawne atrapy i kontrola nazw pól schematu. Nie uruchamia Prisma, HTTP ani dostawców. D12 oddzielnie zapisuje 19 passed assertions z trzech plików Vitest i dwa pliki zablokowane; globalny exit 1. Początkowy roboczy numer R34 dla eksportu przypisano do istniejącego R16, bez nowego ID w rejestrze.


Partia 11: [D13 — wydajność i pojemność](program-audytu/obszary/D13-WYDAJNOSC-I-POJEMNOSC.md), [D14 — koszty i limity](program-audytu/obszary/D14-KOSZTY-I-LIMITY.md), [21 scenariuszy](program-audytu/SCENARIUSZE-SKALA.csv), [parametry kosztów](program-audytu/ZALOZENIA-KOSZTOW.json). Właściciel wskazał kilkunastu twórców i 10000 widzów w szczycie. Pomiar obejmuje 16 lokalnych planów SQL, bez potwierdzenia pojemności całej aplikacji. Warunkowy rachunek wybranych R2+Workers nie jest pełnym budżetem. R06/R10/R11 rozszerzone, bez nowego ID; 13 obszarów rozpoczętych, żaden zamknięty. PeerTube: 13 konkretnych częściowo przeczytanych źródeł, bez równego benchmarku.

Odtworzenie partii 11 z katalogu repo (Node 22 z lokalnych tools, istniejące node_modules; lokalny SQL wymaga istniejącego kontenera i bazy badawczej, bez resetu):

```bash
node docs/audit/2026-11-01-platform-research/program-audytu/tools/search-sql-capture.cjs
PYTHONDONTWRITEBYTECODE=1 python3 docs/audit/2026-11-01-platform-research/program-audytu/tools/search-query-plans.py
PYTHONDONTWRITEBYTECODE=1 python3 docs/audit/2026-11-01-platform-research/program-audytu/tools/loadtest-summary-probe.py
PYTHONDONTWRITEBYTECODE=1 python3 docs/audit/2026-11-01-platform-research/program-audytu/tools/capacity-cost-model.py
```

Skrypty zapisują wyniki badania w evidence; SQL wyłącznie temp tables i ROLLBACK. Ponowny benchmark zmieni czasy/hashe archiwum i wymaga nowej partii, nie nadpisywania historycznego dowodu bez adnotacji. Dwa istniejące pliki Vitest dały 22 passed assertions i jeden plik zablokowany przed rejestracją przez Prisma; globalny exit 1. Nie interpretować jako zielonego zestawu.


Partia 12: [D02 — architektura i utrzymywalność](program-audytu/obszary/D02-ARCHITEKTURA-I-UTRZYMYWALNOSC.md), [zależności modułów](program-audytu/ZALEZNOSCI-MODULOW.csv), [17 scenariuszy](program-audytu/SCENARIUSZE-ARCHITEKTURA.csv). Nowe R34 opisuje dług strukturalny cyklicznych wejść i inicjalizacji DB przed injection; nie udowodnioną awarię produkcji. R21 rozszerzono o syntetyczną próbę rzeczywistego klienta JSON. Mechaniczny AST 1701 plików nie jest 1701 ręcznymi audytami; wybrane fragmenty 52 plików Polutka i 18 PeerTube. 14 obszarów rozpoczętych, żaden zamknięty.

```bash
node docs/audit/2026-11-01-platform-research/program-audytu/tools/architecture-graph.cjs
node docs/audit/2026-11-01-platform-research/program-audytu/tools/architecture-import-probe.cjs
node docs/audit/2026-11-01-platform-research/program-audytu/tools/api-contract-probe.cjs
PYTHONDONTWRITEBYTECODE=1 python3 docs/audit/2026-11-01-platform-research/program-audytu/tools/architecture-guard-probe.py
```

Wymagane istniejące node_modules i Node 22; skrypty wyłącznie badawcze, zapisują evidence. Graf zawiera ścieżki/hashe/zależności, nie treść całego kodu. Probe konstruktora nie jest zainstalowanym klientem Prisma. Bramka architektury przeszła, hotspots nie przeszła (cztery pliki); trzy celowane pliki Vitest dały 12/12 passed. Pełny stos i typecheck nadal niepotwierdzone. R34 ma tu pierwszy wpis rejestru; roboczy eksport R34 w historycznym initial JSON partii 10 był przypisany do istniejącego R16 i nie jest tym nowym ustaleniem.
