# Historia programu badania

## 1 listopada 2026 — v1.0

- Cel: duża platforma, pogłębione badanie zamiast pojedynczego porównania.
- Zachowano wcześniejszy raport i dowody jako baseline.
- Sprawdzono oficjalne źródła internetowe; pobrano ASVS 5.0.0 i WSTG 4.2.
- Utworzono program 18 obszarów, reguły dowodu i kryteria zakończenia.
- Zapisano inwentarz 2172 plików, 345 wymagań ASVS i bazowe R01–R22.
- Nie zaliczono automatycznie żadnego wymagania ASVS. Nie zmieniono źródeł aplikacji ani produkcji.
- Następny etap: mapa produktu i granic systemu.

## 1 listopada 2026 — przeniesienie badania na GitHub

- Na polecenie właściciela utworzono jedną gałąź `docs/polutek-platform-audit`.
- Import obejmuje poprzednie porównanie, raport bazowy, wyniki, eksperymenty oraz program dalszego audytu.
- Linki do kodu wskazują analizowane SHA GitHuba, linki do materiałów badania są względne, a eksperymenty używają względnych importów.
- Surowe logi i JSON zachowują historyczne ścieżki wykonania; stare manifesty przeniesiono do `provenance/`.
- README stanowi punkt wejścia. AGENTS.md i CLAUDE.md opisują wyjątek umożliwiający zachowanie całej historii tego badania.

## 1 listopada 2026 — partia 01: mapa systemu i D01

- Utworzono odtwarzalny ekstraktor AST oraz zapis powierzchni systemu: 113 tras, 147 metod, 46 Server Actions i pozostałe komponenty opisane w MAPA-SYSTEMU.md.
- Dodano 279 rekordów wejść do kontroli; żaden nie uzyskał automatycznie statusu zgodności/bezpieczeństwa.
- Zapisano 22 obietnice produktu, 14 krytycznych przepływów i granice zaufania. Rozróżniono trzy modele pieniędzy oraz implementację, przełącznik i aktywną konfigurację.
- Uzupełniono R19 o dodatkowe źródła rozbieżności dokumentacji. Nie utworzono duplikatów ani nie zmieniono kodu aplikacji.
- Przypisano 345 wymagań ASVS do obszarów według rozdziałów. Dziewięć wymagań dokumentacji/inwentarza rozpoczęto, żadne nie jest zaliczone.
- D01 pozostaje W_TRAKCIE. Następna partia: D03/D04, tożsamość i izolacja kanałów.

## 1 listopada 2026 — partia 02: rdzeń D03/D04 i R23

- Zapisano częściowe raporty tożsamości/sesji oraz ról/izolacji; przegląd 56 wskazanych plików dotyczy konkretnych mechanizmów, nie kompletnego bezpieczeństwa każdego pliku.
- Celowane 18 plików testowych: 10 przeszło w całości, 1 z dwoma błędami sprawdzeń enumów, 7 nie załadowało testów. Ze 123 zarejestrowanych testów 121 przeszło, 2 błędy brakujących enumów Prisma; wyniki surowe zachowane. Pełne HTTP nadal niewykonane.
- Dodatkowy odtwarzalny eksperyment na niezmienionych źródłach potwierdził wybrane decyzje authorize i R23: utratę kanału w finalizerze automatycznej publikacji. Jawne atrapy I/O; bez fałszywego klienta Prisma i bez faktycznej publikacji.
- R13 i R14 doprecyzowano i potwierdzono w podanym zakresie. R23 dodano do stabilnego rejestru; niezależny przegląd pozostaje PENDING.
- Odrzucono zbyt szerokie interpretacje: obcy parametr channel sam nie daje obcego członkostwa; preferred w WebAuthn nie dowodzi pominięcia UV; udany test z mockowanym FORBIDDEN nie dowodzi ochrony HTTP.
- Zapisano 42 scenariusze do wykonania, 12 metod tras oznaczono W_TRAKCIE. ASVS: 28 rozpoczętych, 317 niezbadanych, zero zaliczonych.
- Pobrano trzy szczegółowe metody OWASP WSTG v4.2; porównano źródła kontroli/testów PeerTube. Nie skopiowano implementacji PeerTube ani nie zmieniono aplikacji/produkcji.
- Następny krok: replay i unieważnianie sesji, pozostałe wejścia kanałowe i role panelu; rzeczywiste HTTP po odblokowaniu przygotowania Prisma.

## 1 listopada 2026 — partia 03: pomiar cofnięcia sesji i zakres zasobów

- Ponowne pojedyncze sprawdzenie potwierdza odmowę CONNECT do binaries.prisma.sh. Nie ponawiano pełnego Vitest ani nie zmieniano klienta Prisma.
- Uruchomiono lokalne HTTP Better Auth 1.7.7 z oficjalnym adapterem pamięci i stałymi sesji Polutka. Replay pełnych cookie po logout/revoke-other działał przed TTL, odczyt fresh odmawiał; po 62 s oba replaye odmawiały. Osobny zapis różnic wobec aplikacji i pierwszego błędu metadanych skryptu.
- Dodano R24 jako zmierzone, znane ograniczenie/kompromis cache. Potwierdzają je już komentarz operatora i pobrana oficjalna dokumentacja. Nie jest to przejęcie konta udowodnione na produkcji ani nowy błąd Better Auth.
- Wykonano 19 obserwacji rzeczywistych funkcji playlist i cancel/state z atrapą DB, bez mockowania odpowiedzi authorize. Odmowy obcych zasobów nie zmieniają stanu; kontrole legalne działają. Nie zaliczono prawdziwych blokad/izolacji PostgreSQL ani pełnego HTTP.
- Rozszerzono częściowy przegląd o osiem metod playlist, dwie pipeline i trzy powiązane wejścia użytkownika. Aktualnie 25 rekordów W_TRAKCIE i 254 NIEZBADANE. Rejestr scenariuszy ma 43 pozycje i oddzielny wynik izolowany.
- Zachowano 28 rozpoczętych i zero zaliczonych wymagań ASVS. Otwarte pytania quota/lock/czasu cofnięcia członkostwa są pytaniami, nie dodatkowymi dowiedzionymi lukami.
- Porównano unieważnianie cache PeerTube i zapisano dokumentację/licencję Better Auth z oficjalnego tagu. Nie kopiowano implementacji PeerTube. Aplikacja i produkcja pozostają bez zmian.

## 1 listopada 2026 — partia 04: moderacja, języki panelu i R25

- Częściowo prześledzono granice kanałów przy komentarzach/banach, tworzenie i rozstrzyganie odwołań oraz gate → panelContext → granty języków. Wykaz 44 plików opisuje częściowy zakres, nakładający się na wcześniejsze partie.
- Nowy odtwarzalny eksperyment ma 26 obserwacji rzeczywistych funkcji z atrapami. Poprawne odmowy i legalne kontrole zapisano obok dwóch reprodukcji jednego R25.
- R25: stare odwołanie cofa nowsze zawieszenie/usunięcie, gdy status po cyklu wraca do tej samej wartości. Działa też sekwencyjnie; CAS na samym statusie nie identyfikuje decyzji. Istniejący test W03 wymusza count=0 i nie odwzorowuje tej historii. Brak pełnej DB/HTTP i niezależnego przeglądu.
- Pozytywne wyniki: własny zawieszony twórca zachowuje odwołanie, prywatne powody nie trafiają do badanego DTO/komunikatu, cudze zasoby i języki są odrzucane. Nie uznano pustych grantów za pełne uprawnienia ani helpera napisów bez własnego guarda za automatyczne osiągalne obejście.
- Rozpoczęto 20 dalszych rekordów wejść: aktualnie 45 W_TRAKCIE i 234 NIEZBADANE. Scenariusze pełnego HTTP: 44, żaden niezaliczony. ASVS: 31 rozpoczętych, 314 niezbadanych, zero zaliczonych.
- D07 i D11 oznaczono W_TRAKCIE. Kolejny krok: D06/D07, integralność relacji i wersji stanu; nie powtarzać bez powodu istniejących reprodukcji. Kod aplikacji i produkcja bez zmian.

## 1 listopada 2026 — partia 05: rzeczywisty PostgreSQL, R26 i R27

- Użyto wyłącznie lokalnej bazy badawczej po wcześniejszych migracjach SQL; potwierdzono PostgreSQL 17.11 i READ COMMITTED. Nie odblokowano ani nie zastąpiono klienta Prisma.
- Katalog 13 wybranych tabel: 30 ograniczeń, 66 indeksów, 5 jawnych triggerów. Wykonano 15 prób integralności z kontrolą SQLSTATE/constraint; osiem odmów i siedem akceptacji rozliczono według oczekiwanego zakresu DB.
- Potwierdzono działanie wybranych FK/unique i triggerów moderacji/audytu. Akceptacja powiązań niespełniających przynależności pokazuje granicę odpowiedzialności aplikacji, nie automatyczną lukę HTTP.
- Dodano R26: dwa nakładające się COUNT/INSERT dają 101 przy limicie 100; kontrola sekwencyjna daje 100. Dodano R27: spóźniony READY-retry po ukończeniu nowej wersji wskazuje SUPERSEDED. Protokół jest realnym SQL odpowiadającym kodowi, bez wykonania TypeScript/Prisma/HTTP.
- Fixture integralności wycofano, transakcyjne usunięto; schemat i triggery bez trwałych zmian. Wynik odtworzono po zmianie kontroli baseline/parsera. Nie powtarzano Vitest.
- D06 rozpoczęto, D07 uzupełniono; 47 wejść W_TRAKCIE, 232 NIEZBADANE. Scenariusze pełnego HTTP: 46, wszystkie niewykonane. ASVS: 33 rozpoczęte, 312 niezbadanych, zero zaliczonych.
- Pobrano oficjalną dokumentację PostgreSQL 17 i notę licencyjną. Helpery PeerTube są punktem odniesienia dla polityki transakcji, bez twierdzenia o rozwiązaniu tych samych przypadków. Aplikacja i produkcja bez zmian.

## 1 listopada 2026 — partia 06: finalizacja, audyt i usuwanie HLS

- Rozpoczęto D08, częściowy zakres 29 plików z nakładaniem na poprzednie partie. Wykonano 16 niezmienionych modułów w jawnym harnessie z atrapami I/O: 11 obserwacji, siedem poprawnych kontroli i cztery świadectwa trzech problemów.
- R28: wyjątek audytu po COMMIT aktywacji wywołuje cleanup. Nowy asset znika z trasą; wcześniej istniejący pozostaje ACTIVE w DB z pustym prefiksem, a kolejny retry zgłasza sukces bez PUT/HEAD/LIST/DELETE. R29: aktywacja podczas usuwania unieważnia wcześniejsze sprawdzenie użycia, lecz kasowanie trwa dalej.
- R02 rozszerzono o rzeczywisty finalizer/serwis tras/repozytorium statusu; nie dodano nowego ID dla tego samego problemu. Własność zadania zasymulowano, pełnego takeover nie wykonano.
- Osobno trzy protokoły realnego PostgreSQL sprawdziły COMMIT i kaskady FK na dwóch połączeniach. Fixture usunięte; żadna próba nie używała produkcji, R2, FFmpeg ani wygenerowanego Prisma.
- Zachowano początkowy błąd konfiguracji transpileModule; poprawiono interoperacyjność w skrypcie badawczym i wykonano całość ponownie. Nie powtarzano Vitest ani identycznych R03/R04.
- Potwierdzono w zakresie modeli normalną kolejność pipeline, ochronę przed błędem przed COMMIT i po finalizerze oraz odmowę kasowania już aktywnej wersji PUBLISHED/UNLISTED. Niezależny przegląd pozostaje PENDING.
- Dodano brakujący rekord procesu encoder: 280 wejść, 49 rozpoczętych i 231 niezbadanych. 46 scenariuszy pełnego HTTP bez zmian; 11 osobnych pipeline z otwartą walidacją pełnego stosu. ASVS: 34 rozpoczęte, 311 niezbadanych, zero zaliczonych.
- PeerTube porównano źródłowo pod kątem faz zakończenia i nieodwracalnych zmian; bez automatycznego przypisywania odporności na R28/R29. Kolejny zakres D09. Kod aplikacji i produkcja bez zmian.

## 1 listopada 2026 — partia 07: odtwarzanie, tokeny, cache i R30

- Rozpoczęto D09; częściowy zakres 54 plików, z nakładaniem na wcześniejsze partie. Niezmienione checkVideoAccess, pełny PlaybackService, signer, sanitizer i funkcja Workera wykonane z jawnymi granicami I/O.
- Cztery istniejące pliki celowanego Vitest: 33/33, zero failed/pending. Dodatkowy skrypt ma 38 obserwacji: 30 poprawnych kontroli, trzy warianty R30 i pięć właściwości znanego R07. Nie sumujemy tego jako niezależnych wymagań ani pełnego stosu.
- R30: NOT_FOUND ukrytego/usuniętego filmu z przyszłą premierą zostaje obsłużone dopiero po planie premiery, który zachowuje title/poster/termin. Bez źródła/tokenu/napisów/sesji; P2 i niezależny przegląd PENDING.
- R07 rozszerzono o faktyczne wydanie podpisu, odmowę nowego planu i replay do exp w funkcji Workera. Migawki i zegar symulowane, nie rzeczywiste logout/refund. Zachowano interpretację znanego kompromisu; pełne TTL/purge/cache produkcji niezweryfikowane.
- Pozytywne wyniki: kontrola podpisu przed cache, związanie z filmem/wersją/rodzajem, chronione nagłówki private, ochrona napisów i sesji, porzucenie odpowiedzi starego widza i odnawianie tokenu. Brak odtwarzania filmu w przeglądarce i rzeczywistej platformy Cloudflare.
- Oficjalną dokumentację Cloudflare i licencję CC BY 4.0 pobrano online. PeerTube porównano przez Redis/LRU, kontrolę praw i TTL 8 h; nie założono, że każdy logout natychmiast usuwa wszystkie tokeny wideo. Nie kopiowano implementacji.
- 280 wejść: 52 rozpoczęte, 228 niezbadanych. ASVS: 36 rozpoczętych, 309 niezbadanych, zero zaliczonych. Osobne 38 scenariuszy odtwarzania z pełnym stosem niewykonanym; wcześniejsze scenariusze i surowe wyniki zachowane. Kolejny zakres D05. Aplikacja i produkcja bez zmian.

## 1 listopada 2026 — partia 08: wejścia, pliki/FFmpeg, SSRF i zależności

- Rozpoczęto D05; częściowy zakres 30 plików, nakładający się na poprzednie partie. Zapisano 25 scenariuszy komponentów: 14 czytników i 11 FFmpeg/procesów, bez zaliczenia pełnego stosu.
- R15 potwierdzono na rzeczywistych czytnikach: parse-before-schema oraz duże nieużywane pole multipart poza limitem pojedynczego pliku. Kontrole dodatnie/helper strumieniowy działają; nie wykonano pomiaru DoS ani realnego proxy/HTTP.
- Hostowy FFmpeg 7.1.5 odrzucił cztery XML/MP4 bez żądania do własnego serwera, mimo działającej kontroli ffprobe HTTP. Nie potwierdzono SSRF. Literalne argumenty, timeout, stdout cap i abort sprawdzono w ograniczonych próbach; deklarowany Docker 8.0.1 i pełny encode pozostają do walidacji.
- Pięć istniejących plików Vitest: cztery passed, jeden zablokowany przez Prisma przed rejestracją; 38/38 zarejestrowanych assertions passed, globalny exit 1/success=false. Nie powtarzano pełnego zestawu ani nie podstawiano Prisma.
- R01 rozszerzono o lokalne wersje i dwa publiczne powiązane advisory pobrane GET. Automatyczna kontrola odrzuciła nowe npm audit ze względu na ujawnienie grafu zależności. Nie uruchomiono ani nie obchodzono skanu; brak świeżej liczby wszystkich alertów i exploitu RCE. Zachowano P0 jako historyczny priorytet naprawy zależności.
- PeerTube porównano źródłowo: format whitelist tylko dla remote HTTP(S), DNS/IP/redirect w opcjonalnym SSRF-safe got oraz limit parsera JSON. Otwarte pytania miniatur/zasobów nie dostały nowych ID bez dowodu. R01–R30 zachowane, niezależny przegląd PENDING.
- 280 wejść: 54 rozpoczęte, 226 niezbadanych. ASVS: 44 rozpoczęte, 301 niezbadanych, zero zaliczonych. Dziewięć z 18 obszarów rozpoczętych, żaden zamknięty. Kolejny zakres D10. Aplikacja i produkcja bez zmian.

## 1 listopada 2026 — partia 09: płatności, dostęp, refundy i spory

- Rozpoczęto D10: napiwki, patron pass i przyszłe sales rozliczono oddzielnie; częściowy zakres 54 plików, z nakładaniem na poprzednie partie.
- 18 obserwacji rzeczywistych komponentów i SDK HMAC z jawnymi atrapami, osobno dwa protokoły prawdziwego PostgreSQL. Oba skrypty exit 0 od pierwszego przebiegu, SQL fixture ROLLBACK. Pełnego HTTP/Prisma/Stripe API i ruchu pieniędzy nie wykonano.
- Sześć istniejących plików Vitest zablokowanych przed rejestracją: zero wykonanych testów, globalny exit 1. Brak zmiany importów/Prisma oraz powtórki pełnego zestawu.
- R31: refund wygasłego A odbiera nowy opłacony B; także refund ostatniego z dwóch opłaconych lifetime usuwa wspólny marker. R32: kolejność lost/refund zaniża UserPaymentTotal (100 zamiast 500 gr), zgodnie w komponentach i SQL; bez dowodu dodatkowego ruchu pieniędzy.
- R17 wzmocniono modelem dwóch wywołań przyszłego refundOrder przed CAS. Nie uznano bieżącego adminRefund Stripe za dowiedziony podwójny refund. Znane ręczne polityki dostępu po częściowym/cofniętym refundzie i sporze zachowano jako znane. Niezależny przegląd R17/R31/R32 PENDING.
- Pobrano oficjalny README/MIT Stripe SDK v20.4.1; PeerTube support przejrzano jako treść Markdown, bez fikcyjnego benchmarku księgi marketplace i bez uruchamiania PeerTube.
- 63 wejścia rozpoczęte, 217 niezbadanych. ASVS 47 rozpoczętych, 298 niezbadanych, zero zaliczonych. Dziesięć z 18 obszarów rozpoczętych; żaden zamknięty. Dodano 20 scenariuszy z pełnym stosem niewykonanym. Kolejny zakres D12; kod aplikacji i produkcja bez zmian.

## 1 listopada 2026 — partia 10: prywatność i cykl danych

- Rozpoczęto D12: częściowy zakres 44 plików, 20 wykonanych modułów TS, 24 kategorii macierzy cyklu danych i 15 obserwacji komponentów. Brak HTTP/Prisma/SQL/produkcji; atrapy i granice jawne.
- R33: cleanup konta pozostawia ACTIVE kanał; rzeczywisty publiczny header nadal zwraca kontakt/bio. Nie rozstrzygnięto prawnej retencji opublikowanego profilu; potrzebna polityka transferu/ukrycia/anonimizacji/usunięcia. Niezależny przegląd PENDING.
- R16 ma mocniejszy dowód istniejących braków eksportu i zbuforowanej architektury. Roboczy R34 z initial JSON scalono z R16 przed wpisem do rejestru. Nie nadmuchano liczby znalezisk; oba przebiegi exit 0, kopia initial zachowana, aplikacja bez zmian.
- Pięć istniejących plików Vitest: trzy passed, dwa zablokowane Prisma przed rejestracją; 19/19 assertions passed, globalny exit 1. Pełnego zestawu nie powtarzano.
- Kontrole usuwania/rollback modelu/kolejek i retry/retencji technicznej zadziałały. processBeacon usuwał badane bezpośrednie identyfikatory i odmawiał DNT/origin/automated. Brak certyfikacji anonimowości, prawa i faktycznych harmonogramów.
- PeerTube porównano w wybranych fragmentach 16 plików: domenowe eksportery, ZIP/job/JWT/expiry/kaskady oraz ich ograniczenia pamięci, outbox i usuwania plików. Nie uruchamiano PeerTube. OWASP privacy/CC BY-SA pobrano online z HTTP 200 i hashami.
- Rejestr R01–R33. Wejścia 68 rozpoczętych/212 niezbadanych; ASVS 50/295, zero zaliczonych. Jedenaście z 18 obszarów rozpoczętych; żaden zamknięty. Kolejny zakres D13/D14, bez zmian aplikacji i produkcji.

## 1 listopada 2026 — partia 11: wydajność, pojemność i koszty

- Właściciel doprecyzował scenariusz: kilkunastu twórców i 10000 widzów jednocześnie w szczycie. 15 twórców to przybliżenie z wariantami 10–19, nie utożsamienie twórców z widzami.
- D13/D14 rozpoczęte: 29 źródeł częściowo, sześć wykonanych modułów TS i oficjalny runtime szablonów SQL (bez wygenerowanego klienta), 16 lokalnych EXPLAIN na temp tabelach, 21 scenariuszy z pełnym stosem NIEWYKONANE.
- Common FTS/LIKE przy 10000 syntetycznych filmów ~173/168 ms, rare FTS ~1 ms; jedna próbka, brak p95 lub liczby widzów z tych pomiarów. ROLLBACK, bez trwałych danych i aplikacji.
- R11 rozszerzono: syntetyczny unexpected_status nie odrzuca summarizera; kontrole 5xx/p95 odrzucone. Hash cleanup SHA nie odpowiada bieżącemu HMAC z synthetic key. Bez k6/ruchu produkcyjnego i bez twierdzenia, że stary test miał błędne odpowiedzi.
- R06/R10 ponownie przejrzane źródłowo: quota nie jest pełnym kosztem, globalnie jeden encode; przy małej liczbie uploadów nie wykazano potrzeby wielu encoderów. R01–R33, bez nowych ID, niezależny przegląd PENDING.
- Dwa istniejące pliki Vitest: jeden passed (22 assertions), jeden zablokowany Prisma przed rejestracją; globalny exit 1. Pełnego zestawu/generowania nie ponawiano.
- Cenniki R2/Workers pobrano online HTTP 200, CC BY 4.0. Model ma trzy poziomy widzów, sześć osi wrażliwości, warianty twórców i 10 kontroli arytmetyki. Główny wariant ~582 USD/miesiąc tylko wybrane R2+Workers; pozostałe koszty nieoszacowane. Brak faktury i benchmarku CPU/bitrate/cache.
- PeerTube: 13 źródeł częściowo, konkretne kolejki/runnery/wektor wyszukiwania/CTE/pule/repliki z ograniczeniami. Bez runtime i równego benchmarku. 13 obszarów rozpoczętych, 5 niezbadanych, zero zamkniętych; ASVS 51/294, wejścia 70/210. Następnie D02.

## 1 listopada 2026 — partia 12: architektura, granice i kontrakty

- Rozpoczęto D02. Przegląd wybranych fragmentów 52 plików; mechaniczny graf AST 1701 plików TS/TSX nie jest ręcznym audytem ani typecheck. 32 katalogi modułów z shared, 31 index. Wszystkie źródła zgodne z baseline.
- Nowy R34: cykliczne publiczne wejścia modułów i inicjalizacja domyślnego DB przed injection. Jedna SCC 77 plików w grafie po transpile, jawny krótki cykl video/channel, osiągalność po 269 nakładających się plików. Konstruktor-probe w VM wywołany raz przy imporcie AppContext, własna baza jest respektowana. To dług architektoniczny, bez udowodnionej awarii/bundle/wycieku.
- R34 pierwszy raz w rejestrze; historyczny roboczy eksport R34 z initial JSON partii 10 był wcześniej przypisany R16 i nie był ustaleniem rejestru. Zachowano stare dowody bez zmiany bytes.
- R21 mocniejszy: rzeczywisty studioApi na syntetycznym fetch zwraca zmieniony JSON/null bez schematu; poprawne 200/403 kontrolne działają. Brak dowodu niezgodności działającego backendu, R22 nie odkryto ponownie.
- Bramka architektury exit 0; dziewięć syntetycznych prób pokazuje jej granice (dynamiczne importy/cykle/komentarz authorize). Hotspots exit 1 dla czterech komponentów, w tym jednego o jedną linię. Nie uznano LOC za samodzielny defekt funkcji ani nie naprawiano aplikacji.
- Trzy istniejące pliki Vitest, 12/12 passed, exit 0 podzbioru. 12 modułów TS wykonanych w VM i 17 obserwacji komponentów/bramki. Zero pełnego HTTP/SQL/Next/Prisma. Bez ponawiania pełnego CI, generowania i npm audit.
- 18 źródeł PeerTube częściowo, kontrakty w pakietach i OpenAPI/TS references oraz ograniczenia: barrels, modele w controllerach, strict=false, docUrl/typy bez dowodu walidacji body. Brak runtime, równego grafu i benchmarku. Oficjalne TypeScript type-only import docs i CC BY 4.0 HTTP 200.
- Rejestr R01–R34; 14 obszarów rozpoczętych/4 niezbadane, żaden zamknięty. ASVS 51/294, wejścia 70/210 bez zaliczenia. Następnie D15, z zachowaniem decyzji wizualnych właściciela.
