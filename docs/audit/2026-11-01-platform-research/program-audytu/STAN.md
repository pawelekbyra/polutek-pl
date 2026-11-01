# Stan badania — punkt wznowienia

Aktualizacja: 1 listopada 2026. Program v1.0, partia 06: granice finalizacji, audytu i usuwania HLS. Tryb: analiza, bez zmian aplikacji i produkcji.

## Cel i decyzje właściciela

- Docelowo duża platforma konkurująca z PeerTube funkcjami i skalą.
- Badanie ma być pogłębione i wieloobszarowe. Właściciel nie programuje; wnioski mają objaśniać wpływ na produkt i biznes.
- Dotychczasowe porównanie jest bazą i próbą metody, a nie zamkniętym pełnym audytem.
- Program i źródła są przygotowane. Rozpoczęto D01, D03, D04, D06, D07, D08 i D11; nie wykonano pełnej oceny 345 wymagań.
- Następnie właściciel polecił zachować poprzednie badanie i rozwijać całość na jednej gałęzi GitHub: `docs/polutek-platform-audit`. Katalog w repo: `docs/audit/2026-11-01-platform-research/`. Po każdej partii commit i push; bez automatycznego scalenia ani wdrożenia.

## Wersje

- Polutek: `/workspace/polutek-pl`, `c397b9e548ca2c628e21457ac69d66e54b12ddbd`.
- PeerTube: `/workspace/PeerTube`, `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`.
- Program: [PROGRAM.md](PROGRAM.md).
- Rodzic commitu partii 06: `9e3ee45e2950e5b7396fdb6be2e2ef0515d94885`. Dowód braku zmian aplikacji: [partia 01](evidence/source-scope.json), [partia 02](evidence/source-scope-batch02.json), [partia 03](evidence/source-scope-batch03.json), [partia 04](evidence/source-scope-batch04.json), [partia 05](evidence/source-scope-batch05.json), [partia 06](evidence/source-scope-batch06.json). SHA finalnego zapisu sprawdzić w historii Git gałęzi. Dodatkowe commity dokumentacyjne nie są automatycznie zmianą badanej implementacji.

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
17. Partia 03: [43 pliki w częściowym zakresie przeglądu](evidence/batch03-review.json), z nakładaniem się na wcześniejsze partie; nie sumować tego z poprzednią liczbą jako nowych ani kompletnie zaudytowanych plików. Sprawdzono znany mechanizm cache i dodano R24 jako potwierdzony kompromis, nie nowy błąd biblioteki/produkcji.
18. Rzeczywiste lokalne HTTP Better Auth 1.7.7 z oficjalnym adapterem pamięci: po logout i revoke-other prawidłowy pełny cache cookie nadal rozpoznaje cofniętą sesję; odczyt fresh i samo cookie tokenu odmawiają; po ponad 62 rzeczywistych sekundach replay odmawia. [Skrypt/wynik/ograniczenia](obszary/D03-TOZSAMOSC-I-SESJE.md). Brak Next/Prisma/hooków aplikacji; nie jest to pełna próba Polutka. Pierwsze wykonanie nie zapisało metadanych pakietu; zachowano log, poprawiono skrypt i powtórzono cały eksperyment z exit 0.
19. [19 obserwacji zasobów](evidence/resource-scope-experiment.json): 12 playlist i 7 cancel/state, rzeczywiste use case'y/authz/repozytoria z atrapą DB. Odmowy dla cudzych zasobów bez zmian stanu, legalne kontrole dodatnie działają. Rollback dotyczy atrapy, nie poziomu izolacji PostgreSQL. Nie powtarzano Vitest; jego wyniki z partii 02 pozostają takie same.
20. Aktualnie 43 scenariusze pełnego HTTP Polutka (dodano IA-043); wszystkie pełne próby nadal NIEWYKONANE. Osobne kolumny rozróżniają wykonane izolowane HTTP biblioteki i funkcje. Rozpoczęto 25 rekordów wejść, 254 NIEZBADANE. ASVS nadal 28 W_TRAKCIE i 317 NIEZBADANE, zero zaliczonych. Uzupełniono R24 przy wymaganiach cofnięcia sesji i zmian uprawnień.
21. Oficjalny opis Better Auth v1.7.7 pobrany online potwierdza kompromis cache i środki ograniczające jego wpływ. PeerTube jawnie czyści serwerowy cache i rozsyła unieważnienia; nie testowano tego przy awarii Redis. Otwarte pytania playlist: COUNT pod współbieżnym tworzeniem, lock po ID przed sprawdzeniem kanału, cofnięcie członkostwa między authorize a zapisem. Nie są jeszcze potwierdzonymi usterkami.
22. Partia 04: [D11](obszary/D11-MODERACJA-I-NADUZYCIA.md), aktualizacja [D04](obszary/D04-ROLE-I-IZOLACJA.md), [44 wskazane pliki w częściowym zakresie](evidence/batch04-review.json), z nakładaniem na wcześniejsze partie. Prześledzono moderację komentarzy/banów, odwołania i granty językowe panelu. Nie jest to ukończony przegląd 44 całych plików ani pełny test wejść.
23. [26 obserwacji](evidence/moderation-boundaries-experiment.json): 6 rozstrzygnięć/historii stanu, 4 granic odwołań/DTO, 2 komentarzy, 8 banów/guardów i 6 języków. Kod rzeczywisty, jawne atrapy DB/audytu/powiadomień/synchronizacji EN; brak HTTP, Access i prawdziwej DB. Nie ponawiano Vitest.
24. R25 potwierdzone w modelu: po SUSPENDED → ACTIVE → nowym SUSPENDED stare odwołanie przywraca ACTIVE; po REMOVED → VISIBLE → nowym REMOVED przywraca VISIBLE. Oryginalna decyzja bez nowszej cofa się prawidłowo, późniejszy inny status pozostaje. Problem porównania wartości zamiast tożsamości decyzji występuje nawet przy sekwencyjnych działaniach. P1 przed szerszą moderacją, niezależny przegląd PENDING, brak dowodu wystąpienia na produkcji.
25. Kontrole dodatnie: cudze odwołanie i komentarze odrzucone; zawieszony OWNER może się odwołać; creator DTO nie ujawnia reasonInternal; moderator nie banuje cudzego kanału; EDITOR nie banuje; brak banowania siebie/członków/ADMIN. Translator nie zapisuje nieprzydzielonego języka i nie zatwierdza szkiców nawet z pustymi grantami. Źródłowo sprawdzono gate/context i domyślne OWNER przy uploadzie napisów; nie zaliczono prawdziwego dispatchu Server Actions.
26. Aktualnie 44 scenariusze pełnego HTTP (nowy IA-044 dla R25); wszystkie pełne próby nadal NIEWYKONANE. 45 rekordów wejść W_TRAKCIE, 234 NIEZBADANE. ASVS: 31 W_TRAKCIE, 314 NIEZBADANE, zero zaliczonych. D07/D11 rozpoczęto częściowo; R25 ma własny wpis, a historyczne raporty/wyniki pozostają zachowane.
27. Partia 05: [D06](obszary/D06-DANE-I-INTEGRALNOSC.md), [D07](obszary/D07-TRANSAKCJE-I-PONOWIENIA.md), [15 niezmienników SQL](NIEZMIENNIKI-DANYCH.csv), [zakres 29 plików](evidence/batch05-review.json). Liczba plików jest częściowym zakresem i nakłada się na wcześniejsze partie, nie dowodzi przeczytania/zaudytowania każdego w całości.
28. Lokalny Docker i istniejąca baza SQL działają: PostgreSQL 17.11, READ COMMITTED. [Katalog 13 tabel](evidence/database-catalog-batch05.json): 30 constraints, 66 indeksów, 5 jawnych triggerów. [Rzeczywiste próby SQL](evidence/database-integrity-experiment.json): 15 prób, osiem oczekiwanych odmów i siedem akceptacji. Z akceptacji sześć pokazuje granice wymuszania przynależności/ACTIVE w DB, jedna jest prawidłową anonimizacją audytu. To nie sześć nowych luk HTTP.
29. R26: realny protokół COUNT/INSERT na dwóch połączeniach kończy się 101 playlistami przy limicie 100, podczas gdy kontrola sekwencyjna kończy się na 100. R27: opóźniony retry starego READY po ukończeniu v2 przestawia aktywny oryginał na v1 SUPERSEDED. Samo ukończenie v2 i zwykły retry mają poprawne kontrole. Ustalenia potwierdzają SQL przejrzanego protokołu, nie pełne funkcje TypeScript/Prisma/HTTP ani produkcję. Niezależny przegląd PENDING.
30. Próby integralności cofnięto; osobne fixture transakcyjne usunięto. Nie zmieniono trwałego schematu, triggerów i kodu aplikacji. Skrypt wymusza bazę badawczą i hashe źródeł. Pierwszy odczyt wielowierszowego JSON katalogu wymagał poprawy parsera przed mutacjami; później pełny przebieg miał exit 0, a odtwarzalność sprawdzono ponownie. Vitest nie powtarzano.
31. Aktualnie 46 scenariuszy pełnego HTTP (IA-045/R26 i IA-046/R27), wszystkie pełne próby nadal NIEWYKONANE. 47 wejść W_TRAKCIE, 232 NIEZBADANE. ASVS: 33 W_TRAKCIE, 312 NIEZBADANE, zero zaliczonych. Oficjalny opis izolacji PostgreSQL 17 pobrano online i zestawiono z wynikiem. Przegląd helperów transakcji PeerTube nie jest dowodem ich odporności na te konkretne przypadki.
32. Partia 06: [D08](obszary/D08-UPLOAD-KODOWANIE-I-USUWANIE.md), [11 scenariuszy pipeline](SCENARIUSZE-PIPELINE.csv) i [zakres 29 plików](evidence/batch06-review.json). To częściowy zakres nakładający się na poprzednie partie; 16 niezmienionych modułów wykonano w skrypcie komponentów, bez zaliczenia całych plików.
33. [11 obserwacji komponentów z atrapami](evidence/pipeline-boundaries-experiment.json): siedem poprawnych kontroli, dwa warianty nowego R28, jeden R29 oraz mocniejszy dowód istniejącego R02. R28: audyt po COMMIT rzuca, cleanup kasuje aktywowany wynik; przy istniejącym asset/ACTIVE kolejny retry zgłasza sukces bez operacji magazynu pomimo pustego prefiksu. R29: aktywacja po sprawdzeniu użycia, ale przed końcem usuwania, nie chroni przed trwającym cleanup. Pełnego Prisma/HTTP/R2/FFmpeg nie wykonano.
34. [Trzy osobne protokoły PostgreSQL](evidence/playback-cascade-experiment.json) potwierdziły COMMIT i skutki FK: usunięty asset zabiera nową trasę, wskaźnik null, poprzednia trasa PREVIOUS i primary=false. Dwa połączenia, jedna poprawna kontrola, fixture usunięte. To osobny poziom dowodu, nie pełna próba awarii audytu.
35. Pozytywne granice: normalny pipeline zachowuje pięć obiektów; błąd przed COMMIT pozostawia starą aktywną wersję; błąd statusu po finalizerze zachowuje nowy wynik. Już aktywna wersja PUBLISHED/UNLISTED jest chroniona przed kasowaniem. DRAFT i nieaktywny wynik zachowują zamierzoną politykę. Pierwszy błąd konfiguracji transpileModule zachowano w logu, poprawiono wyłącznie harness i powtórzono przebieg z exit 0. Nie ponawiano Vitest ani wcześniejszych identycznych R03/R04.
36. R02 doprecyzowano jako POTWIERDZONE w granicach komponentów/atrap: rzeczywista aktywacja odbywa się po zasymulowanej utracie własności, choć repozytorium odrzuca końcowy status. Nie wykonano prawdziwego takeover z czasem dzierżawy i dwóch procesów. R28/R29 mają własne ID; niezależny przegląd wszystkich pozostaje PENDING. PeerTube pokazuje fazy zakończenia i callback przed nieodwracalnymi zmianami; nie testowano równoważnych awarii.
37. Bieżąca powierzchnia ma 280 rekordów: dopisano pominięty osobny proces encoder, znany już z diagramu. 49 W_TRAKCIE, 231 NIEZBADANE; rozpoczęto także encodeAction. ASVS: 34 W_TRAKCIE, 311 NIEZBADANE, zero zaliczonych. 46 scenariuszy pełnego HTTP pozostaje niewykonanych; dodatkowe 11 pipeline ma otwartą walidację pełnego stosu. D08 rozpoczęto, D09 pozostaje do pogłębienia.

`NIEZBADANE` w nowej macierzy oznacza brak zakończonej procedury programu dla całego obszaru. Nie oznacza, że wcześniejsze przeglądy i eksperymenty nie istnieją. Referencje bazowe zapisano oddzielnie.

## Blokady i niewiadome

- Obserwowany runtime nie dopuszcza `binaries.prisma.sh`; instalacja/generowanie klienta zatrzymuje się na proxy HTTP 403. [Ponowne pojedyncze sprawdzenie w partii 03](evidence/prisma-network-batch03.json): curl exit 56, odmowa CONNECT 403, brak odpowiedzi docelowego HTTP. Reguła była zapisana w draft wcześniej, lecz nie zaobserwowano jej zastosowania. Nie wyłączać weryfikacji TLS/checksum ani ponawiać całego zestawu testów przy niezmienionych warunkach.
- Dlatego pełny typecheck/runtime/testy Prisma nie są potwierdzone. Wyników bazowego pełnego Vitest nie interpretować jako w pełni zielonego zestawu ani listy potwierdzonych usterek aplikacji.
- PeerTube nie był instalowany/uruchamiany. Nie ma porównawczego benchmarku.
- Nie ustalono konkretnych docelowych progów ruchu, SLO, RPO/RTO i budżetu; trzeba je doprecyzować przy mapie produktu. Samo „duża platforma” nie jest deklaracją pojemności.

## Lokalne zasoby

- Node 22.23.4: `/workspace/.cloud-setup/tools/node-v22.23.4-linux-x64/bin`.
- Kontener lokalnego PostgreSQL: `polutek-cloud-db`; dane deweloperskie, nie produkcyjne.
- Oddzielna badawcza baza SQL ma nazwę w `../migrations-sql.json`. Nie ma historii migracji Prisma.
- W partii 05 potwierdzono jej działanie przez lokalny socket Dockera. Skrypt `tools/database-integrity-experiment.py` korzysta z nazwy tej bazy, kontroluje hashe źródeł i usuwa własne fixture; nie uruchamia Prisma ani pełnej aplikacji.
- Partia 06: lokalny Docker 28.4.0 i PostgreSQL nadal działały. `tools/pipeline-boundaries-experiment.cjs` wykonuje komponenty z atrapami; `tools/playback-cascade-experiment.py` używa helpera SQL z partii 05, dwóch połączeń i usuwa własne fixture. Skrypty nie wymagają zmiany instrukcji ani kodu aplikacji.
- Skrypty eksperymentów pipeline i storage znajdują się w katalogu nadrzędnym; działają na atrapach usług i plikach tymczasowych.
- Nie zakładać, że procesy lub kontenery przeżyją odtworzenie środowiska. Sprawdzić ich stan przed użyciem.

## Następne działanie

Przejść do D09: pełny przepływ planu odtwarzania, tokeny/cache, cofnięcie dostępu po wylogowaniu/banie/zmianie widoczności, napisy i segmenty. D08 wymaga jeszcze formatów/FFmpeg, multipart i starych oryginałów, prawdziwego takeover/restartów oraz realnego magazynu. R26–R29 i rozszerzony R02 mają opisane dowody i kontrole; nie powtarzać ich identycznie bez zmiany. Po odblokowaniu Prisma wykonać pełne próby R28/R29 i dwóch workerów; nie podstawiać fałszywego klienta. D06 nadal obejmuje pozostałe modele, role, migracje na danych/drift, kaskady i indeksy; pieniądze/retencję/restore rozliczać w D10/D12/D17. Pełne scenariusze HTTP, pełny pipeline i niezależne przeglądy pozostają otwarte. Nie zmieniać aplikacji ani produkcji; parametry skali/SLO/budżetu nadal wymagają określenia.

Przed rozpoczęciem: odczytać ten plik, PROGRAM.md i właściwe instrukcje repo; porównać bieżący HEAD z podanym wyżej. Nie powtarzać wykonanych testów bez zmiany wersji, diagnozy lub warunków.

## Zapis po każdej partii

Uaktualnić STAN.md, POKRYCIE.csv, odpowiednie wymagania ASVS i USTALENIA.json. Zapisać dowody i krótki raport obszaru. Dopisać wpis do ZMIANY.md i odświeżyć GITHUB-MANIFEST.json. Wykonać commit i push na `docs/polutek-platform-audit`, a następnie sprawdzić zgodność zdalnego HEAD. Archiwum pozostaje dodatkową kopią.
