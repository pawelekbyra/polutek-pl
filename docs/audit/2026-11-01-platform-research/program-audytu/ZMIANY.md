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
