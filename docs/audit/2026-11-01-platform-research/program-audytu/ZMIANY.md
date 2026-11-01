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
