# Stan badania — punkt wznowienia

Aktualizacja: 1 listopada 2026. Program v1.0, partia 02: częściowy D03/D04. Tryb: analiza, bez zmian aplikacji i produkcji.

## Cel i decyzje właściciela

- Docelowo duża platforma konkurująca z PeerTube funkcjami i skalą.
- Badanie ma być pogłębione i wieloobszarowe. Właściciel nie programuje; wnioski mają objaśniać wpływ na produkt i biznes.
- Dotychczasowe porównanie jest bazą i próbą metody, a nie zamkniętym pełnym audytem.
- Program i źródła są przygotowane. Rozpoczęto D01, D03 i D04; nie wykonano pełnej oceny 345 wymagań.
- Następnie właściciel polecił zachować poprzednie badanie i rozwijać całość na jednej gałęzi GitHub: `docs/polutek-platform-audit`. Katalog w repo: `docs/audit/2026-11-01-platform-research/`. Po każdej partii commit i push; bez automatycznego scalenia ani wdrożenia.

## Wersje

- Polutek: `/workspace/polutek-pl`, `c397b9e548ca2c628e21457ac69d66e54b12ddbd`.
- PeerTube: `/workspace/PeerTube`, `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`.
- Program: [PROGRAM.md](PROGRAM.md).
- Rodzic commitu partii 02: `15dffc0a14139946853699db1d840b4b00155375`. Dowód braku zmian aplikacji: [partia 01](evidence/source-scope.json), [partia 02](evidence/source-scope-batch02.json). SHA finalnego zapisu sprawdzić w historii Git gałęzi. Dodatkowe commity dokumentacyjne nie są automatycznie zmianą badanej implementacji.

## Gotowe

1. Raport bazowy `../RAPORT.md`: 22 obszary, wykonane kontrole i eksperymenty, jawne ograniczenia.
2. Pobrano oficjalne źródła OWASP ASVS/WSTG, W3C, Web Vitals i SLSA; źródła w `sources/`.
3. Utworzono inwentarz wszystkich 2172 śledzonych plików Polutka wraz z hashami. Nie jest to ewidencja zakończonych przeglądów.
4. Utworzono rejestr 345 pozycji ASVS 5.0.0: wszystkie `NIEZBADANE`, zakres do kwalifikacji.
5. Utworzono mapę 18 obszarów i zaimportowano R01–R22 do rejestru ustaleń z prośbą o drugi przegląd.
6. Zapisano zasady dowodu, zamknięcia zakresu, archiwizacji i wznawiania długiej sesji.
7. Przeniesiono materiały do repo, zachowano surowe wyniki jako historyczne dowody, a linki do kodu przypięto do analizowanych commitów. Dodano README oraz wyjątek w instrukcjach agentów.
8. Wykonano ekstrakcję AST: 113 plików tras / 147 jawnych metod, 46 Server Actions, 54 stron, 4 layouty, 31 modułów z index, 4 workery, kolektor, 15 timerów, 71 modeli i 37 enumów Prisma. Zero diagnostyk parsera; nie jest to typecheck.
9. Zapisano [mapę systemu](MAPA-SYSTEMU.md), [279 rekordów wejść](POWIERZCHNIA-WEJSC.csv) i [D01](obszary/D01-PRODUKT-I-ZAKRES.md): P01–P22, F01–F14 i granice zaufania.
10. Wszystkie pozycje ASVS mają wstępnie przypisane obszary przeglądu, bez automatycznej oceny stosowalności. Dziewięć przeczytanych wymagań dokumentacji/inwentarza: DOTYCZY / W_TRAKCIE; pozostałe 336: NIEZBADANE. Brak pozycji zaliczonych w tej partii.
11. R19 doprecyzowano na podstawie źródeł i oznaczono jako potwierdzoną niespójność opisów. Nie oznacza błędu runtime ani zakończenia niezależnego drugiego przeglądu.
12. Partia 02: [D03](obszary/D03-TOZSAMOSC-I-SESJE.md) i [D04](obszary/D04-ROLE-I-IZOLACJA.md), z częściowym przeglądem 56 plików źródłowych Polutka oraz wybranych źródeł/testów PeerTube. Lista/hash/zakres: [identity-authz-review.json](evidence/identity-authz-review.json). To nie liczba w pełni zaudytowanych plików.
13. Dwa celowane przebiegi istniejących testów: 18 plików, 10 przeszło w całości, 1 z dwoma błędami sprawdzeń enumów, 7 zablokowanych przed rejestracją; 123 zarejestrowane testy, 121 przeszło, 2 błędy sprawdzeń enumów z niewygenerowanego Prisma. Nie klasyfikować tych błędów jako dowiedzionych usterek produkcji. Zero pełnych prób HTTP.
14. Osobny eksperyment wykonuje rzeczywisty kod z atrapami: cztery obserwacje tożsamości/Studia, 11 decyzji authorize oraz trzy próby kontekstu publikacji. Potwierdzono R23: finalizer nie przekazuje kanału zadania, więc auto-publish filmu spoza main cicho kończy się przed publikacją. Kontrola z poprawnym kontekstem dochodzi do granicy publikatora. Publikator i aktywacja route nie są realnymi usługami w tym eksperymencie.
15. R13 potwierdzono jako różnicę polityki świeżości Access/legacy w kodzie; R14 jako fail-open liczników potwierdzone trzema testami. Brak dowodu przejęcia konta lub aktywnej konfiguracji produkcji; niezależny przegląd nadal PENDING. Nowy R23 ma osobny wpis, nie zmienia historycznego raportu 22 ustaleń.
16. Zapisano [42 scenariusze D03/D04](SCENARIUSZE-D03-D04.csv), każdy HTTP_NIEWYKONANE w znaczeniu kolumny http_status=NIEWYKONANE. Rozpoczęto przegląd 12 rekordów metod tras; pozostałe 267 wejść NIEZBADANE. Stan ASVS: 28 W_TRAKCIE, 317 NIEZBADANE, zero zaliczonych. Pobrano i przeczytano trzy konkretne metody OWASP WSTG v4.2 z HTTP 200.

`NIEZBADANE` w nowej macierzy oznacza brak zakończonej procedury programu dla całego obszaru. Nie oznacza, że wcześniejsze przeglądy i eksperymenty nie istnieją. Referencje bazowe zapisano oddzielnie.

## Blokady i niewiadome

- Obserwowany runtime nie dopuszcza `binaries.prisma.sh`; instalacja/generowanie klienta zatrzymuje się na proxy HTTP 403. Reguła była zapisana w draft wcześniej, lecz nie zaobserwowano jej zastosowania. Nie wyłączać weryfikacji TLS/checksum.
- Dlatego pełny typecheck/runtime/testy Prisma nie są potwierdzone. Wyników bazowego pełnego Vitest nie interpretować jako w pełni zielonego zestawu ani listy potwierdzonych usterek aplikacji.
- PeerTube nie był instalowany/uruchamiany. Nie ma porównawczego benchmarku.
- Nie ustalono konkretnych docelowych progów ruchu, SLO, RPO/RTO i budżetu; trzeba je doprecyzować przy mapie produktu. Samo „duża platforma” nie jest deklaracją pojemności.

## Lokalne zasoby

- Node 22.23.4: `/workspace/.cloud-setup/tools/node-v22.23.4-linux-x64/bin`.
- Kontener lokalnego PostgreSQL: `polutek-cloud-db`; dane deweloperskie, nie produkcyjne.
- Oddzielna badawcza baza SQL ma nazwę w `../migrations-sql.json`. Nie ma historii migracji Prisma.
- Skrypty eksperymentów pipeline i storage znajdują się w katalogu nadrzędnym; działają na atrapach usług i plikach tymczasowych.
- Nie zakładać, że procesy lub kontenery przeżyją odtworzenie środowiska. Sprawdzić ich stan przed użyciem.

## Następne działanie

Kontynuować D03/D04 według macierzy: w pierwszej kolejności cofnięcie sesji (replay cookie i 60 s cache) oraz pełne powiązanie videoId/originalId/jobId z kanałem. Najpierw sprawdzić, czy blokada binariów Prisma nadal obowiązuje; nie ponawiać całego Vitest, jeżeli warunki się nie zmieniły. Gdy runtime nadal zablokowany, przejść do przeglądu niezamkniętych wejść: pipeline cancel/state, playlisty, moderacja/bany/odwołania, role i języki panelu oraz Server Actions. Sprawdzić granice tworzenia aktora system, zawieszenie kanału podczas zadania i cofnięcie członkostwa w trakcie zapisu. Każde wejście aktualizować indywidualnie. R23 wymaga drugiego przeglądu i późniejszego testu rzeczywistego workera; nie implementować poprawki w ramach audytu. D01/D03/D04 pozostają W_TRAKCIE. Docelowa skala, SLO i budżet nadal otwarte.

Przed rozpoczęciem: odczytać ten plik, PROGRAM.md i właściwe instrukcje repo; porównać bieżący HEAD z podanym wyżej. Nie powtarzać wykonanych testów bez zmiany wersji, diagnozy lub warunków.

## Zapis po każdej partii

Uaktualnić STAN.md, POKRYCIE.csv, odpowiednie wymagania ASVS i USTALENIA.json. Zapisać dowody i krótki raport obszaru. Dopisać wpis do ZMIANY.md i odświeżyć GITHUB-MANIFEST.json. Wykonać commit i push na `docs/polutek-platform-audit`, a następnie sprawdzić zgodność zdalnego HEAD. Archiwum pozostaje dodatkową kopią.
