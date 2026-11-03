# ASVS V1/V2 — kodowanie, sanitizacja, walidacja i reguły biznesowe

Partia 17, 2 listopada 2026. Kod Polutka `c397b9e548ca2c628e21457ac69d66e54b12ddbd`, PeerTube `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`; rodzic zapisu `90de980e45bb827da72ddfea1aca18611bacb2e8`. Analiza i kontrolowane lokalne próby, bez zmian aplikacji/produkcji i prawdziwych usług.

Przeczytano wszystkie **43 wymagania V1 i V2 ASVS 5.0.0** oraz przypisano im konkretny zakres, źródła, dowody i brakującą weryfikację. To pierwszy etap systematycznej kwalifikacji, **nie zaliczenie 43 wymagań**. Z tej grupy 38 ma częściowy przegląd W_TRAKCIE, pięć warunkowo NIE_DOTYCZY_Z_UZASADNIENIEM. Dla parserów XML i wieloosobowego zatwierdzania zakres wymaga dalszego ustalenia; nie narzucono nowego procesu zgód. Nie dodano nowego numeru ustalenia.

## Wynik dla właściciela

Kod ma poprawne, sprawdzone w tej partii zabezpieczenia: e-mail nie zamienia badanego pseudonimu w HTML, kontrolne aktywne tagi/atrybuty są usuwane, nagłówek tematu nie zachowuje CR/LF, linki kanału odrzucają niebezpieczne protokoły i adresy dosłowne, schematy Studia odrzucają część niedozwolonych pól i sprzecznych ustawień. Reguły rozdziałów prawidłowo normalizują kolejność, a potem sprawdzają odstępy.

Są też pytania do pogłębienia. Dwa helpery CSV różnie traktują prefiksy kontrolne i białe znaki. Samo kodowanie HTML nie sprawdza protokołu URL. Nie oceniono globalnie wszystkich wyrażeń regularnych, wyjść HTML, parserów i zależności natywnych. To nie są w tej partii dowiedzione wykonanie formuły w arkuszu, XSS, SSRF lub przelew na złą kwotę. [Pytania i warunki rozstrzygnięcia](../PYTANIA-ASVS-V1-V2.csv) zapobiegają przekształceniu obserwacji helpera w nieuzasadniony alarm produkcyjny.

## Dowody i ich granice

- [43 kwalifikacje](../ASVS-V1-V2.csv), [cały rejestr ASVS](../ASVS-POKRYCIE.csv), [oryginalne wymagania](../sources/asvs-5.0.0.csv). Źródło: OWASP Application Security Verification Standard 5.0.0, OWASP ASVS Project, CC BY-SA 4.0; zachowano oryginał i atrybucję w [SOURCES](../SOURCES.md). Nowa tabela zawiera metadane i nasze uzasadnienia, nie nową wersję standardu.
- [Mechaniczna mapa markerów](../evidence/input-sink-inventory.json), [skrypt](../tools/input-sink-inventory.py): 1233 śledzone pliki źródeł/konfiguracji i lockfile z hashami. Wyszukanie wzorca nie jest ręcznym audytem pliku ani analizą przepływu danych.
- [16 obserwacji funkcji](../evidence/encoding-validation-experiment.json), [skrypt](../tools/encoding-validation-experiment.cjs), [scenariusze](../SCENARIUSZE-KODOWANIE.csv). Rzeczywiste czyste moduły TS, Zod 3.25.76 i sanitize-html 2.17.7, syntetyczne dane i środowisko. Żadnego DB, HTTP, providera, prawdziwego maila i arkusza.
- Politykę sanitizeOptions odczytano z dokładnego initializer AST i wykonano z rzeczywistym sanitize-html. Dwie funkcje RSS (`stripInvalidXmlChars`, `escapeXml`) oceniono z niezmienionych deklaracji. To nie wykonanie całego zapisu/podglądu e-maila lub pełnego feedu.
- [Celowany Vitest JSON](../evidence/encoding-targeted-vitest.json), [log](../evidence/encoding-targeted-vitest.log): dwa istniejące pliki, **46/46 testów passed, zero failed/pending, exit 0**. Obejmuje renderowanie e-maila/zmienne i rozdziały. Nie jest to świeży pełny wynik projektu ani test API/płatności.
- [Zakres ręcznego przeglądu/hash](../evidence/batch17-review.json), [brak zmian aplikacji](../evidence/source-scope-batch17.json), [walidacja materiałów](../evidence/validation-batch17.json). Wykorzystano wcześniejsze D04/D05/D07/D08/D09/D10 i ich dowody bez zbędnego powtarzania.

## Kwalifikacje niestosowalności

W badanym kodzie, konfiguracji i deklarowanych zależnościach nie znaleziono integracji LDAP, XPath, LaTeX, JNDI i Memcached. Warunkowo wyłączono odpowiednio V1.2.6, V1.2.7, V1.2.8, V1.3.8 i V1.3.9.

Zakres wyłączenia to aplikacja objęta tym repo i widoczny model integracji. Nie obejmuje niezbadanych wnętrz dostawców, osobno dystrybuowanego systemu supportu, możliwego zewnętrznego SSO ani ukrytej konfiguracji produkcji. Negatywne wyszukiwanie nie wystarczałoby samo: uwzględniono też Node/Next/PostgreSQL/Redis, zadeklarowane wejścia i brak odpowiadających funkcji w mapie produktu. Dodanie tych technologii, innego backendu lub nowego sposobu logowania otwiera kwalifikację ponownie. Wyłączenia czekają na niezależny przegląd.

XML nie został automatycznie wyłączony: RSS jest wyjściem, lecz obrazy/SVG i biblioteki natywne wymagają osobnej oceny osiągalności parsera. Dla V2.3.5 najpierw trzeba ustalić, które obecne operacje są wysokiej wartości w modelu zagrożeń; przyszłe wypłaty marketplace nie są istniejącym przepływem (R17). Brak dowodu stosowania nie oznacza tu nakazu podwójnego zatwierdzania każdej operacji.

## Kodowanie i niebezpieczne konteksty

**HTML/JavaScript/XML.** Renderer e-maila koduje `<`, `>`, cudzysłowy i ampersand w wartościach placeholderów. Rzeczywista konfiguracja sanitizera usuwała kontrolne script/SVG, event handlers i bezpośredni javascript: w href/src. Temat usuwał znaki sterujące. RSS poprawnie kodował metaznaki i usuwał badane niedozwolone znaki XML. Publiczna strona koduje `<` w JSON-LD, zanim umieści JSON w elemencie script. Wyjścia ikon i boot scripts wymagają rozróżnienia danych stałych od treści użytkownika; sam marker dangerouslySetInnerHTML nie jest dowodem XSS.

**URL.** `normalizeChannelLinkUrl` odrzucił javascript:, literalny loopback, jego szesnastkowy wariant normalizowany przez URL, credentials i znak nowej linii. Dozwolony syntetyczny HTTPS przeszedł. To reguła linków dla przeglądarki, nie test fetch/DNS/redirect lub pełnej ochrony SSRF. W `renderHtml('<a href="{{actionUrl}}">…')` tekst javascript: pozostaje tekstem wartości URL, mimo właściwego HTML escaping. Nie znaleziono w tej partii konkretnego nieufnego actionUrl docierającego tą drogą do użytkownika. Trzeba sprawdzać kontrakt źródła wartości URL i miejsce sanitizacji, a nie uznawać samo escapowanie za walidację schematu.

**SQL i regex.** Mapa wykazała trzy markery „unsafe/raw”. Dwa `Prisma.raw` w wyszukiwaniu budują identyfikatory z zamkniętej listy SORT_KEYS, wartości kursora są przekazywane przez Prisma.sql/join. Trzeci `$executeRawUnsafe` zawiera stałe `SET TRANSACTION READ ONLY`. Nie są to trzy dowiedzione SQL injection. Wcześniejsze plany i capture SQL pozostają osobnym dowodem; w tej partii nie wykonano nowej próby PostgreSQL. Route matcher poprawnie odróżnił kropkę literalną od metaznaku, zachowując zamierzony `(.*)`. Nie badano czasu każdego regex ani wszystkich dynamicznych wzorców.

**Natywne biblioteki i parsery.** Node/TypeScript ogranicza własne błędy wskaźników, lecz nie usuwa ryzyk sharp/libvips/librsvg i FFmpeg. R01 zachowuje wcześniejsze dowody dopasowania wersji do advisory, a R15 wcześniejszy problem limitów/parserów. Nie zmieniono zależności, nie ponawiano npm audit i nie ogłoszono nowego exploita na podstawie markera lub wersji.

## CSV: obserwacja, której nie należy jeszcze nazywać wykonaniem formuły

`lib/modules/shared/csv.ts` stosowany m.in. przez eksport analityki oraz `admin-community/domain/csv.ts` używają różnych reguł. Oba poprawnie zabezpieczyły badane proste prefiksy `= + - @ TAB CR`, quote/comma i format dokumentu. Wariant admin-community rozpoznaje także prefiksy z kontrolnymi znakami/białymi znakami oraz pełnoszerokie operatory; wspólny helper zachował część takich prefiksów bez apostrofu.

Ścieżka analityki eksportuje tytuł filmu, ma autoryzację, limit wierszy, bezpieczną nazwę pliku i attachment/nosniff/no-store. To nie dowodzi, że każdy spreparowany prefiks może przejść rzeczywisty zapis tytułu. PostgreSQL odrzuca NUL w text; poszczególne walidatory mogą usuwać białe znaki. Nie uruchamiano Excel/LibreOffice i nie wykazano wykonania nawet prostej formuły. Pozostaje pytanie o wspólną politykę i dozwolone dane, a nie nowe R38.

Do rozstrzygnięcia V1.2.10 potrzebne są legalne wejścia przez prawdziwą aplikację, eksport tych samych wartości, testy importerów/arkuszy w izolacji i kontrola tekstów/liczb. Cytowanie i poprawny CSV według formatu nie są tym samym co neutralizacja formuł. Nie należy automatycznie wyłączyć testów tylko dlatego, że istnieje jeden dobry helper.

## Walidacja kształtu, kontekstu i limitów

Schemat checkout odrzucił NaN, Infinity, ułamek, zero i wartość ujemną; normalizował walutę oraz usuwał nieznane pole. Zod 3 `.int()` zaakceptował liczbę większą od MAX_SAFE_INTEGER, lecz badany domyślny limit biznesowy ją odrzucił. Prawdziwa trasa dodatkowo używa aktualnych ustawień walut z DB. Nie odczytano tych ustawień i nie wykonano przyjęcia płatności/provider call; wynik nie jest exploitem przepełnienia. Pokazuje, że trzeba badać złożenie warstw, a nie jeden walidator w oderwaniu.

Schemat tworzenia filmu odrzucał tier PATRON, cudze pola kontekstu kanału usuwał, a połączenie UNLISTED z premierą odrzucał. Nie jest to samo w sobie test autoryzacji roli. Lista rozdziałów 0/30/20 po normalizacji staje się legalnym 0/20/30; lista 0/5/20 przechodzi kształt, ale nie regułę odstępów. Kod use case'ów korzysta z tych reguł. Dla kanału schemat kształtu i reguły domenowe linków/e-maila także są oddzielnymi kontrolami serwera.

Nie uznano nieznanego pola za obejście autoryzacji ani sortowania listy za pominięcie reguły kolejności. Dwa początkowe oczekiwania harnessu skorygowano po odczycie zachowania: [diagnoza zachowana](../evidence/encoding-validation-initial-diagnostic.json), zmieniono tylko próbę badawczą. Docelowy przebieg ma exit 0.

V2 obejmuje również dokumentację reguł, kolejność przepływów, transakcje i ograniczone zasoby. Istniejące R02–R05/R23/R25–R32 oraz badania SQL i komponentów mają tu znaczenie. Nie tworzymy nowych problemów za każdą kolejną referencję do tego samego błędu. Wymagania nie są zaliczone: trzeba nadal sprawdzić pełne HTTP/DB, awarie i wyścigi, aktualne konfiguracje i zasady biznesowe.

## Porównanie z PeerTube

Przeczytano wybrane fragmenty pięciu źródeł: [dokładna lista/hash](../evidence/batch17-review.json). PeerTube nie był uruchamiany.

| Źródło | Wzorzec do rozważenia | Ograniczenie |
|---|---|---|
| [Markdown helper](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/helpers/markdown.ts) | Markdown jest renderowany, potem wynik sanitizowany; osobne reguły HTML/plain text/mail | Polutek nie musi dodawać Markdown, żeby spełniać wymaganie. Nie wykonywano prób bypass |
| [Wspólne polityki rendererów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/core-utils/src/renderer/html.ts) | Jawne tagi/schematy URL i różne konteksty; osobne escapowanie JSON w HTML | Polutek ma już sanitize-html i własne kodowanie; warto ujednolicić kontrakty. Samo istnienie helpera nie dowodzi użycia wszędzie |
| [Image utils](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/helpers/image-utils.ts) | Sharp blokuje loadery i dopuszcza wybrane; SVG ma osobną sanitizację | Nie kopiować wsparcia SVG ani uznawać whitelisty za dowód braku błędów natywnych |
| Walidatory video i parser JSON serwera | Zamknięte wartości i wspólny limit przed handlerami | Różne typy danych/limity, brak runtime; porównanie parsera rozwinięte wcześniej w D05 |

## Stan i dalsze badanie

Rejestr pozostaje **R01–R37**. Po tej partii ASVS ma **86 W_TRAKCIE, 254 NIEZBADANE, pięć NIE_DOTYCZY_Z_UZASADNIENIEM**, bez PASS. Pięć dodatkowych rekordów metod tras rozpoczęto źródłowo; powierzchnia nadal ma 286 rekordów: 84 W_TRAKCIE/202 NIEZBADANE. Nie dodano tras ani zmian aplikacji.

Następny zakres kwalifikacji: **ASVS V3 — bezpieczeństwo frontendowych aplikacji webowych**. Trzeba uwzględnić CSP, pochodzenie iframe/preview, JS/URL, przeglądarkę, CSRF i cache, bez utożsamiania statycznego nagłówka z przetestowanym zabezpieczeniem. Pytania tej partii, pełny runtime i niezależne przeglądy pozostają otwarte.
