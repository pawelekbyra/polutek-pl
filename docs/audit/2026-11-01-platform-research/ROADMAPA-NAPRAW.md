# ROADMAPA NAPRAW v1 — Polutek

Data propozycji v1: 2 listopada 2026. **Aktualizacja: właściciel zatwierdził roadmapę i rozpoczęto H1.** Bieżąca realizacja, gałęzie i ograniczenia: [POSTEP-NAPRAW.md](POSTEP-NAPRAW.md), [STAN.md](program-audytu/STAN.md). Dalsza treść zachowuje założenia i wymagania propozycji v1; historyczne polecenia oczekiwania nie zastępują obecnej zgody na H1.

Plan zawiera **40 pakietów pracy w 8 etapach i rozlicza wszystkie 37 ustaleń R01–R37**. Pakiet może być naprawą, przygotowaniem testów, weryfikacją lub decyzją produktową; nie oznacza to 40 dowiedzionych błędów aplikacji. Najpierw zatwierdzenie tej roadmapy i harmonogramu, później osobno uzgodniona realizacja. Nie zmieniono aplikacji, nie wdrożono i nie scalono gałęzi.

**Dalszy audyt jest tymczasowo wstrzymany wyłącznie na czas przygotowania i zatwierdzenia planu.** Nie rezygnujemy z pogłębionej weryfikacji. Zamknięcie 18 obszarów lub 345 kontroli OWASP nie jest warunkiem przygotowania roadmapy ani rozpoczęcia zatwierdzonej pilnej poprawki. Niewiadome mają własny harmonogram i dowody odbioru.

## 1. Podstawa i granice planu

Źródło ustaleń: [USTALENIA.json](program-audytu/USTALENIA.json), [raport bazowy](RAPORT.md), raporty D01–D18 oraz [plan brakujących dowodów](program-audytu/DOMKNIECIE-DOWODOW.csv). Punktem odcięcia jest commit dokumentacji `90de980e45bb827da72ddfea1aca18611bacb2e8`; kod Polutka badano na `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. PeerTube: `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`; źródła referencyjne, bez uruchomienia i porównawczego benchmarku. Nie wykonywano nowej analizy plików aplikacji na potrzeby tej roadmapy.

Pierwsze przejście objęło wszystkie 18 obszarów, **żaden nie jest zamknięty**. Kanonicznie: ASVS 55 W_TRAKCIE / 290 NIEZBADANE / 0 PASS; mapa 286 wejść: 79 W_TRAKCIE / 207 NIEZBADANE. Otwarta pozostaje stosowalność wymagań i drugi niezależny przegląd. Niedokończona partia 17 została zachowana jako [zamrożone archiwum](provenance/paused-batch17-before-roadmap-v1.tar.gz) z [opisem i hashami](provenance/paused-batch17-before-roadmap-v1.json), status `PAUSED_UNVALIDATED_NOT_ACTIVE_AUDIT_RESULTS`. Nie włączono jej roboczych kwalifikacji do wyników i nie należy ich przywracać automatycznie nad późniejszymi zmianami.

Scenariusz pomiaru właściciela: **kilkunastu twórców i 10000 widzów jednocześnie w szczycie**. 15 twórców to jedynie przybliżenie w modelu kosztów. To cel do sprawdzenia, nie dowiedziona pojemność. Wymagają decyzji: profil ruchu, SLO (np. start/rebuffer/p95/błędy), RPO/RTO i budżet. Plan nie wymyśla tych wartości za właściciela.

### Jak czytać klasyfikację

- **Potwierdzony błąd w podanym zakresie**: istnieje konkretny świadek komponentowy, SQL lub przeglądarkowy. Nie oznacza automatycznie incydentu produkcji; przed zamknięciem potrzebny test pełnej właściwej granicy.
- **Luka funkcjonalna/procesowa**: brakuje zachowania, trwałości lub dowodu potrzebnego dla wybranego produktu; część wymaga testu crash/restart.
- **Ryzyko/hipoteza**: potwierdzono warunek lub ograniczenie, ale nie całą szkodę, ekspozycję lub pojemność. Najpierw odpowiednia weryfikacja, bez udawania pewności.
- **Świadoma decyzja**: np. TTL/cache, fail-open czy zoom. Najpierw jawna ocena i decyzja właściciela, potem zmiana tylko jeśli konieczna. Dotychczasowa decyzja nie jest automatycznie zgodą na każde nowe ryzyko.
- **Dług**: poprawa wąskiej granicy, gdy przynosi konkretną korzyść; nie powód przepisywania platformy.

Statusy i priorytety źródłowego rejestru pozostają niezmienione. R03/R04/R05/R22 mają importowane DO_WERYFIKACJI: wymaga to drugiego przeglądu, a nie odrzuca wcześniejszych dowodów z raportu. R01 to pilne ryzyko wersji, **nie dowiedziony RCE**; R17 to przyszły marketplace z warunkowym dowodem, **nie aktywny podwójny refund**. Nie wykazano, że cała aplikacja jest niebezpieczna ani że jest gotowa do deklarowanej skali.

## 2. Kolejność wynikająca ze skutków i zależności

1. **Równolegle K02 i K01**: przygotować minimalną poprawkę zależności i usunąć blokady prawdziwego środowiska testowego. K05 ustala tylko decyzje potrzebne kolejnym pakietom. K02 nie czeka na refaktor, komplet ASVS ani wszystkie testy produktu; publikacja wymaga wiarygodnych kontroli.
2. K03 zapewnia rzetelny wynik, K06 wiąże go z wydaniem, K07/K08/K10 zamykają istotne granice wejścia, obsługi pieniędzy i metadanych.
3. **Pieniądze K11–K12 i integralność wideo K13–K20** przed aktywacją ich funkcji. Mogą być osobnymi ścieżkami po fundamentach; rekomendowana kolejność liniowa jest w planie wdrożenia. W obrębie wideo kolejność jest istotna: poprawny cleanup → monotoniczne wersje → własność próby → bezpieczny COMMIT → wspólna aktywacja/retirement.
4. Następnie moderacja, konta/kanały, upload resume, powiadomienia, eksport i cofanie dostępu. K04 to ograniczony dług pod K21, nie początek wielkiej przebudowy. K34 jest małą naprawą UX, którą wolno przyspieszyć po K03.
5. Funkcjonalny monitoring, odzyskiwanie, limity kosztu i realne podróże tworzą dowód gotowości. Krytyczna dostępność K36 jest przed otwarciem; szeroki UX, duże eksporty i pomiary skali mają osobne warunki.
6. Marketplace K40 dopiero po osobnej decyzji o jego rozwoju; nie blokuje dzisiejszych darowizn i pakietów.

Priorytet wykonania: **U0** pilna poprawka zależności; **U1** bezpieczeństwo/pieniądze/integralność lub ich konieczny dowód; **U2** warunek właściwego profilu/polityka/jakość; **U3** pomiar skali i optymalizacje; **UF** przyszła funkcja. Są to priorytety realizacji, nie nowe CVSS. R32 zachowuje audytowe P2, ale blokuje wydanie wspólnej obsługi płatności ze względu na błędne sumy.

## 3. Etapy

| Etap | Cel | Pakiety |
|---|---|---|
| E0 | Fundament dowodów, pilna zależność i profil produktu | K01–K05 |
| E1 | Bezpieczne wejścia i kontrolowane wydawanie | K06–K10 |
| E2 | Poprawność pieniędzy i płatnych uprawnień | K11–K12 |
| E3 | Integralność oryginałów, HLS i publikacji | K13–K23 |
| E4 | Izolacja, moderacja, prywatność i cofanie dostępu | K24–K29 |
| E5 | Odzyskiwanie, operacje i odbiór pełnego produktu | K30–K35 |
| E6 | Dostępność, duże dane i udowodniona pojemność | K36–K39 |
| E7 | Przyszły marketplace — warunkowo | K40 |

Etapy grupują odpowiedzialność; nie nakazują czekać z każdym zadaniem na całą wcześniejszą grupę. Wiążące są zależności pakietów i odbiór aktywowanego profilu. Trudność: **S** lokalna mała zmiana; **M** kilka współpracujących modułów/warstw; **L** protokół transakcyjny, migracja, odzyskiwanie lub wiele usług. To względna trudność, bez obietnicy godzin. Pakiety L realizuje się w wymienionych podkrokach i małych PR, bez rozdzielania atomowej gwarancji między niezgodne wydania.

## 4. Rejestr wszystkich ustaleń

Pełne priorytety oryginalne, ograniczenia dowodów, zależności, statusy i identyfikatory testów znajdują się w [KOLEJNOSC-NAPRAW.csv](KOLEJNOSC-NAPRAW.csv). W propozycji v1 wszystkie wpisy miały status **PLAN_DO_ZATWIERDZENIA_NIE_ROZPOCZETO**. CSV i POSTEP pokazują aktualny stan realizacji; ta tabela nie zamyka ustaleń.

| ID | Tytuł źródłowy | Klasyfikacja planu | Pilność | Pakiety |
|---|---|---|---|---|
| R01 | Aktualne zależności wymagają pilnego przeglądu bezpieczeństwa | RYZYKO ZALEŻNOŚCI | U0 | [K02](ROADMAPA-NAPRAW.md#k02) |
| R02 | Utrata zadania nie odcina wszystkich skutków starego workera | POTWIERDZONY BŁĄD W ZAKRESIE KOMPONENTÓW | U1 | [K16](ROADMAPA-NAPRAW.md#k16), [K17](ROADMAPA-NAPRAW.md#k17) |
| R03 | Sprzątanie uploadu może wyprzedzać nadal trwające PUT | POTWIERDZONY BŁĄD W ZAKRESIE KOMPONENTÓW | U1 | [K14](ROADMAPA-NAPRAW.md#k14) |
| R04 | Częściowy błąd S3 DeleteObjects jest traktowany jako sukces | POTWIERDZONY BŁĄD W ZAKRESIE KOMPONENTÓW | U1 | [K13](ROADMAPA-NAPRAW.md#k13) |
| R05 | Trwała kolejka powiadomień ma lukę przed jej utworzeniem | POTWIERDZONA ŹRÓDŁOWO LUKA NIEZAWODNOŚCI | U1 | [K23](ROADMAPA-NAPRAW.md#k23) |
| R06 | Limit magazynu nie jest limitem rzeczywistego kosztu | RYZYKO KOSZTÓW | U1 | [K33](ROADMAPA-NAPRAW.md#k33) |
| R07 | Cofnięcie dostępu ma okno zależne od tokenów i cache | ŚWIADOMY KOMPROMIS TOKEN/CACHE | U2 | [K29](ROADMAPA-NAPRAW.md#k29) |
| R08 | Brak działających E2E mimo konfiguracji | POTWIERDZONA LUKA TESTÓW I DOWODÓW | U1 | [K01](ROADMAPA-NAPRAW.md#k01), [K03](ROADMAPA-NAPRAW.md#k03), [K35](ROADMAPA-NAPRAW.md#k35) |
| R09 | Zielony build nie oznacza zielonych typów | POTWIERDZONA LUKA PROCESU WYDANIA | U1 | [K06](ROADMAPA-NAPRAW.md#k06) |
| R10 | Obecna topologia nie jest architekturą dużej platformy | RYZYKO POJEMNOŚCI — NIE AWARIA | U3 | [K39](ROADMAPA-NAPRAW.md#k39) |
| R11 | Historyczny load test nie uzasadnia dzisiejszej deklaracji skali | POTWIERDZONY BŁĄD NARZĘDZIA I BRAK DOWODU SKALI | U3 | [K38](ROADMAPA-NAPRAW.md#k38) |
| R12 | Backup bazy nie oznacza możliwości odtworzenia platformy | RYZYKO ODTWARZANIA I BRAK PEŁNEGO DOWODU | U1 | [K32](ROADMAPA-NAPRAW.md#k32) |
| R13 | Ważność logowania administratora jest za słabą definicją świeżego potwierdzenia pieniędzy | DECYZJA POLITYKI I RYZYKO | U1 | [K08](ROADMAPA-NAPRAW.md#k08) |
| R14 | Awaria Redis świadomie osłabia limity auth | ŚWIADOMA DECYZJA FAIL-OPEN I RYZYKO | U2 | [K09](ROADMAPA-NAPRAW.md#k09) |
| R15 | Limity body nie są jednolicie egzekwowane przed parsowaniem | POTWIERDZONY BŁĄD KONTROLI ZASOBÓW | U1 | [K07](ROADMAPA-NAPRAW.md#k07) |
| R16 | Eksport danych wymaga rozwoju razem z domeną i skalą | POTWIERDZONA LUKA FUNKCJONALNA I DŁUG SKALI | U2 | [K27](ROADMAPA-NAPRAW.md#k27), [K37](ROADMAPA-NAPRAW.md#k37) |
| R17 | Rdzeń marketplace nie jest gotowym systemem rozliczeń | WARUNKOWE RYZYKO PRZYSZŁEGO MARKETPLACE | UF | [K40](ROADMAPA-NAPRAW.md#k40) |
| R18 | Watchdog sprawdza dostępność procesu, ale nie pełną usługę wideo | POTWIERDZONA LUKA POKRYCIA MONITORINGU | U1 | [K30](ROADMAPA-NAPRAW.md#k30) |
| R19 | Dokumentacja ma konkurujące definicje produktu | POTWIERDZONA NIESPÓJNOŚĆ DOKUMENTACJI | U1 | [K05](ROADMAPA-NAPRAW.md#k05) |
| R20 | Dostępność i wejście do aplikacji wymagają testów produktu | DECYZJA WŁAŚCICIELA I NIEZWERYFIKOWANA JAKOŚĆ | U2 | [K36](ROADMAPA-NAPRAW.md#k36) |
| R21 | Kontrakty API są zbyt rozproszone dla dużej liczby klientów | POTWIERDZONY DŁUG KONTRAKTÓW | U2 | [K21](ROADMAPA-NAPRAW.md#k21) |
| R22 | Studio nie korzysta z już istniejącego wznawiania uploadu | POTWIERDZONA LUKA FUNKCJONALNA | U1 | [K22](ROADMAPA-NAPRAW.md#k22) |
| R23 | Automatyczna publikacja po kodowaniu pomija film spoza głównego kanału | POTWIERDZONY BŁĄD W ZAKRESIE KOMPONENTÓW | U1 | [K20](ROADMAPA-NAPRAW.md#k20) |
| R24 | Cofnięcie sesji WWW nie unieważnia od razu jej 60-sekundowego cache cookie | ŚWIADOMY KOMPROMIS BIBLIOTEKI I POLITYKA | U2 | [K28](ROADMAPA-NAPRAW.md#k28) |
| R25 | Stare odwołanie może cofnąć nowszą decyzję po powrocie do tego samego statusu | POTWIERDZONY BŁĄD W ZAKRESIE KOMPONENTÓW | U1 | [K24](ROADMAPA-NAPRAW.md#k24) |
| R26 | Równoczesne tworzenie playlist może przekroczyć limit 100 | POTWIERDZONY BŁĄD PROTOKOŁU SQL | U2 | [K25](ROADMAPA-NAPRAW.md#k25) |
| R27 | Spóźnione ponowienie ukończenia uploadu cofa wskaźnik na zastąpiony oryginał | POTWIERDZONY BŁĄD PROTOKOŁU SQL | U1 | [K15](ROADMAPA-NAPRAW.md#k15) |
| R28 | Błąd audytu po COMMIT aktywacji uruchamia usuwanie wyniku HLS | POTWIERDZONY BŁĄD GRANICY COMMIT | U1 | [K18](ROADMAPA-NAPRAW.md#k18) |
| R29 | Równoległa aktywacja omija wcześniejsze sprawdzenie użycia kasowanej wersji HLS | POTWIERDZONY BŁĄD WSPÓŁBIEŻNOŚCI | U1 | [K19](ROADMAPA-NAPRAW.md#k19) |
| R30 | Przyszła premiera ujawnia metadane filmu pomimo centralnej odmowy NOT_FOUND | POTWIERDZONY BŁĄD REDAKCJI METADANYCH | U2 | [K10](ROADMAPA-NAPRAW.md#k10) |
| R31 | Zwrot jednej wpłaty patrona może odebrać dostęp kupiony inną wpłatą | POTWIERDZONY BŁĄD PŁATNYCH UPRAWNIEŃ | U1 | [K11](ROADMAPA-NAPRAW.md#k11) |
| R32 | Spóźnione uzgodnienie zwrotu po przegranym sporze zaniża sumę wpłat użytkownika | POTWIERDZONY BŁĄD AGREGATU FINANSOWEGO | U1 | [K12](ROADMAPA-NAPRAW.md#k12) |
| R33 | Usunięcie konta właściciela pozostawia publiczny profil jego kanału | POTWIERDZONY BŁĄD CYKLU DANYCH | U1 | [K26](ROADMAPA-NAPRAW.md#k26) |
| R34 | Cykliczne wejścia modułów i kontekst utrudniają izolację infrastruktury | POTWIERDZONY DŁUG STRUKTURALNY | U2 | [K04](ROADMAPA-NAPRAW.md#k04) |
| R35 | Dialog potwierdzenia wypuszcza fokus do tła podczas operacji | POTWIERDZONY BŁĄD KOMPONENTU W PRZEGLĄDARCE | U2 | [K34](ROADMAPA-NAPRAW.md#k34) |
| R36 | Watchdog może utracić powiadomienie o powrocie usługi | POTWIERDZONY BŁĄD PONOWIEŃ KOMPONENTU | U2 | [K31](ROADMAPA-NAPRAW.md#k31) |
| R37 | Pomocniczy weryfikator odtworzonej bazy może zgłosić sukces mimo nieudanych kontroli | POTWIERDZONY BŁĄD NARZĘDZIA | U2 | [K03](ROADMAPA-NAPRAW.md#k03) |

## 5. Karty pakietów do realizacji po zatwierdzeniu

Każdy test poniżej jest **wymaganiem przyszłego odbioru, nie wykonanym wynikiem**. Najpierw odtworzenie problemu i kontrola dodatnia, potem zmiana i ponowny test w tej samej granicy. Pełne zamknięcie wymaga wskazanych rzeczywistych usług; atrapa może służyć do wymuszania awarii, ale nie zastępuje całego dowodu. Wspólny warunek: właściwe quality/typecheck/build, brak regresji objętych zależności i wyniki związane z SHA/digest.

### E0 — Fundament dowodów, pilna zależność i profil produktu

<a id="k01"></a>

#### K01. Prawdziwe środowisko testowe i klient Prisma

**Ustalenia:** R08. **Rodzaj:** PRZYGOTOWANIE. **Trudność:** M. **Pozycja proponowanego wykonania:** 2.

**Moduły:** Konfiguracja środowiska cloud, package.json/lockfile, prisma/schema.prisma i migracje; konfiguracje Vitest/Playwright; lokalne PostgreSQL/Redis/storage/encoder.

**Zmiana / wynik:** Zapisać odtwarzalną instalację na wspieranym Node, wygenerować autentyczny klient z właściwego schematu i odtworzyć usługi na danych syntetycznych. Wymagany dostęp do binaries.prisma.sh uzyskać wspieraną konfiguracją środowiska z przeglądem zmian. Nie podstawiać klienta, nie wyłączać TLS/checksum, nie obchodzić odmowy npm audit. Nowa baza musi przejść silnik migracji Prisma; wcześniejsze 81 plików raw SQL nie ustanawia historii Prisma.

**Zależności:** brak. **Bramka:** Wszystkie profile — fundament dowodów.

**Ryzyko regresji:** Średnie: zależności narzędziowe i migracje; wyłącznie nowe bazy badawcze.

**Do weryfikacji przed zamknięciem:** Najpierw potwierdzić zastosowaną politykę sieci i faktyczny błąd; nie powtarzać instalacji przy niezmienionej blokadzie. Oddzielić błędy środowiska, testu i produktu.

**Testy odbioru:**

- **K01-T1** — Na świeżym checkout i nowej bazie instalacja, generate oraz migracje kończą się exit 0; zapisać wersje i logi bez sekretów. Druga instalacja według instrukcji daje ten sam schemat i działający klient.
- **K01-T2** — Prawdziwy klient wykonuje zapis/odczyt i rollback transakcji; kontrola z niepoprawnym FK/unique jest odrzucona. Usunięcie klienta lub niedostępna DB blokuje wymagany test, zamiast dawać pusty PASS.
- **K01-T3** — Uruchamia się lokalne API i worker na własnym krótkim filmie; izolacja kont/bucketów i sprzątanie fixture potwierdzone. Zablokowane usługi oznaczone BLOCKED, bez deklaracji pełnej integracji.

**Postęp lokalny, 7 listopada 2026:** uruchomiono `prisma generate` na rzeczywistym `prisma/schema.prisma` (CLI i klient 6.19.3), następnie nowy test realnego klienta wygenerowanego przez Prisma na jednorazowym PostgreSQL 17.11 po 84 migracjach. **1/1 PASS**: zapis/odczyt `User`, rollback interaktywnej transakcji, odrzucenie duplikatu unique (`P2002`) i błędnego FK (`P2003`); repo typecheck i ESLint PASS. Kontener i baza były izolowane i usunięte. Osobne uruchomienie tego samego wymaganego testu bez obu zmiennych DB zakończyło się exit 1 z `PrismaClientInitializationError`; brak DB nie daje pustego PASS. To realizuje część K01-T1/T2, ale nie powtarza `npm ci` ze świeżego checkoutu i nie uruchamia HTTP/workera z krótkim własnym filmem (K01-T3); K01 pozostaje częściowe. [Dowód](program-audytu/evidence/k01-prisma-postgres-2026-11-07.json).

**Uzupełnienie K01-T3, 7 listopada 2026:** osobny proces Node/tsx uruchomił rzeczywisty `runWorkerLoop`, claim przez Prisma, FFmpeg 8.0.1, AWS SDK `OriginalsReader`/`HlsWriter`, weryfikację playlist, finalizer i zapisy route/asset/job na disposable PostgreSQL 17.11 po 84 migracjach. Syntetyczny film 6 s osiągnął `SUCCEEDED/DONE`; aktywna trasa wskazuje asset z prefiksem właściwego `attemptId`, a loopbackowy magazyn zawiera master/variant playlists, fMP4 segment i poster. **1/1 PASS**, repo typecheck i ESLint PASS; fixture’y i kontener usunięto. Storage był atrapą HTTP S3 na loopbackie; nie uruchamiano upload/playback HTTP ani `scripts/video-worker.ts`. K01-T3/K01 pozostaje częściowe do pełnego API, R2 i niezależnego odbioru. [Dowód i hashe](program-audytu/evidence/k01-local-worker-ffmpeg-loopback-2026-11-07.json).
**Uzupełnienie K01-T3 — rzeczywisty entrypoint, 7 listopada 2026:** test uruchamia bez helpera produkcyjny `scripts/video-worker.ts` w osobnym Node/tsx. Dla testu użyto `makeR2Client` z HTTP endpointem ograniczonym do loopbacka i dostępnym wyłącznie w `NODE_ENV=test`; testy odrzucają host zewnętrzny i tryb production. Syntetyczny film przeszedł od claimu do aktywnego SELF_HLS, a SIGTERM po `SUCCEEDED` zakończył worker kontrolowanie. PostgreSQL 17.11 po 84 migracjach: **1/1 integration + 2/2 guard unit PASS**, repo typecheck, ESLint i diff check PASS; fixture’y wyczyszczono. Nadal brak testu upload/playback HTTP i rzeczywistego R2; K01-T3/K35 pozostają częściowe. [Dowód i hashe](program-audytu/evidence/k01-worker-entrypoint-2026-11-07.json).
**Uzupełnienie K01-T3 — HTTP i naprawa routingu prób, 7 listopada 2026:** test z prawdziwym Next dev serverem potwierdził Studio pipeline: gość 401, właściciel po kodowaniu 200 ze stanem `SUCCEEDED/DONE`; `/api/media-source` odmawia gościowi (403), a właściciel dostaje `READY/SELF_HLS`. Próba ujawniła błąd: URL planu dla assetu z `/attempts/<uuid>` kończył się `ERROR`, bo parser planu i Cloudflare Worker znały tylko historyczny prefiks. Naprawa podpisuje teraz wersję dostarczania jako `v<N>~<attemptId>`, a Worker pobiera dokładnie z prefiksu tej próby; historyczne `v<N>` zachowuje mapowanie. PostgreSQL 17.11/84 migracje: integration **1/1 PASS**; cztery zestawy jednostkowe **62/62 PASS**, repo typecheck PASS, ESLint bez błędów (jeden dotychczasowy warning eksportu Worker), diff check PASS. [Dowód](program-audytu/evidence/k01-attempt-playback-http-2026-11-07.json). To nie jest test uploadu HTTP, segmentu przez wdrożony Worker ani R2. Worker musi być wdrożony przed aplikacją wydającą token z `~<uuid>`; K01-T3/K35 pozostają częściowe.
**Uzupełnienie K01-T3 — pełny upload HTTP przez Studio, 7 listopada 2026:** acceptance przechodzi teraz od start multipart przez presigned UploadPart PUT i complete API aż po prawdziwy worker, który koduje przesłany oryginał i aktywuje HLS; test nie wstawia ręcznie gotowego oryginału/job do DB. 84 migracje na jednorazowym PostgreSQL 17, Next 16.4.5, loopback S3 fixture: integration **1/1 PASS**, endpoint guard **3/3 unit PASS**, typecheck, ESLint i diff check PASS. [Dowód i hashe](program-audytu/evidence/k01-multipart-studio-http-2026-11-07.json). To zamyka lokalną ścieżkę upload/work/playback API. Chromium acceptance opisano w późniejszej korekcie K35-T1; rzeczywiste R2, deployed Worker i niezależny review pozostają otwarte, K01-T3/K35 są częściowe.


**Uzupełnienie K01-T3 — publikacja i publiczne API odtwarzania, 7 listopada 2026:** test używa teraz `publishAfterReady: true` i sprawdza pełny stan `PUBLISHED`, aktywną trasę/asset oraz publiczne `GET /api/media-source/:id` zwracające `READY/SELF_HLS`. Rzeczywisty upload Studio, worker i lokalne pobranie manifestów/segmentu przez kod edge Worker przechodzą razem: PostgreSQL 17.11/84 migracje, integration **1/1 PASS**, repo typecheck, ESLint i diff check PASS. [Dowód i hash](program-audytu/evidence/k01-publish-public-playback-api-2026-11-07.json). Korekta odbioru, 7 listopada: początkowa próba nie dała dowodu; diagnostyka wykazała ramki `aws-chunked` w lokalnym S3 fixture. Po ich dekodowaniu Chromium pobrał poprawne master/variant/init/segment przez lokalny kod Worker i osiągnął `currentTime > 0,5 s`; integration 1/1, typecheck/lint/diff check PASS. [Aktualny dowód](program-audytu/evidence/k35-browser-hls-local-2026-11-07.json). Wcześniejszy dowód edge oznaczono jako superseded dla poprawności payloadu. Rzeczywiste R2, wdrożony Worker, inne przeglądarki, pełna macierz K35 i niezależny review pozostają otwarte.

<a id="k02"></a>

#### K02. Pilna aktualizacja zależności objętych advisory

**Ustalenia:** R01. **Rodzaj:** NAPRAWA RYZYKA. **Trudność:** M. **Pozycja proponowanego wykonania:** 1.

**Moduły:** package.json, package-lock.json; konfiguracje Next public/admin, obrazy aplikacji i rzeczywiście ładowane sharp/libvips/librsvg.

**Zmiana / wynik:** Przygotować minimalną aktualizację do wspieranych wersji poza dotkniętymi zakresami advisory. Historycznie wskazano Next 16.4.1 i sharp >=0.35.5/librsvg 2.63.2; przy realizacji zweryfikować aktualny poprawiony zakres i zawartość obrazu, zamiast bezwarunkowo przypinać te numery. Dwa komunikaty nie dowodzą dwóch exploitów. Kandydata przygotowywać równolegle z K01; brak pełnego ASVS lub refaktoru nie opóźnia pilnej poprawki.

**Zależności:** brak. **Bramka:** Przed publicznym ruchem i płatnościami.

**Ryzyko regresji:** Średnie: zachowanie Next i natywnych bibliotek obrazów.

**Do weryfikacji przed zamknięciem:** Potwierdzone dopasowanie wersji, nie wykazany RCE. Sprawdzić ścieżkę przetwarzania obrazów i natywne biblioteki w docelowym artefakcie; bez nowego wysłania grafu zależności.

**Testy odbioru:**

- **K02-T1** — Lockfile i zbudowany obraz zawierają poprawione wersje, faktycznie ładowane zależności nie należą do potwierdzonych dotkniętych zakresów; zachować metadane wersji i digest.
- **K02-T2** — Legalne miniatury i obrazy działają; niedozwolony format/źródło pozostają odrzucone. Typy, wymagane testy i build obu aplikacji przechodzą na tym samym SHA. Do czasu usunięcia blokad K01 wynik pozostaje kandydatem, bez zgody na publikację.

<a id="k03"></a>

#### K03. Wiarygodny baseline testów i wynik weryfikatora restore

**Ustalenia:** R08, R37. **Rodzaj:** NAPRAWA NARZĘDZIA I WERYFIKACJA. **Trudność:** M. **Pozycja proponowanego wykonania:** 4.

**Moduły:** scripts/verify-restored-database.ts i jego testy; komendy critical-path/quality, konfiguracje oraz raporty Vitest.

**Zmiana / wynik:** Naprawić fałszywy sukces opcjonalnego manualnego helpera: kompletność obowiązkowych odczytów/counts, brakujące wartości manifestu i jawny stan migracji. Nie utożsamiać go z weekly restore-test.sh. Poprawić brakujący cel critical-path i wykonać nowy baseline po K01; rozliczyć każdą porażkę/pominięcie, zachować tanie skuteczne testy.

**Zależności:** [K01](ROADMAPA-NAPRAW.md#k01). **Bramka:** Przed uznaniem wydania lub odzyskania za sprawdzone.

**Ryzyko regresji:** Średnie: ostrzejsza weryfikacja może ujawnić wcześniej pomijane problemy.

**Do weryfikacji przed zamknięciem:** Dotychczas 535 plików: 304 pass, 12 failed z assertions i 219 failed przed rejestracją; to nie 35 dowiedzionych usterek produktu. Sprawdzić rzeczywisty kod wyjścia osobnego procesu, nie sam log ani mock process.exit.

**Testy odbioru:**

- **K03-T1** — Cztery świadki: błąd count, brak oczekiwanego count w manifeście, błąd query migracji i nieukończona migracja bez logs dają niezerowy exit lub jawny INCOMPLETE bez SUCCESS. Poprawny restore daje exit 0.
- **K03-T2** — Kontrole: preflight, różny manifest i osierocony rekord odmawiają; dozwolona historia rolled-back oceniana według jawnej polityki migracji. Wyłączenie obowiązkowej weryfikacji musi zepsuć test, który sprawdza jej efekt.
- **K03-T3** — Każda komenda baseline raportuje liczbę wykonanych, błędnych i pominiętych testów oraz SHA. Brak wymaganych plików/testów daje błąd; niezerowe wyniki mają osobny przydział, nie są automatycznie przypisane Prisma.

**Postęp lokalny 6 listopada 2026 (częściowy):** pusty `manifest.counts` jest teraz odrzucany, aby przekazany manifest nie stawał się bezwarunkowym no-opem. Test procesu CLI 32/32 PASS, ESLint i repo typecheck PASS. Test używa syntetycznej granicy DB. `npm run test:critical-path` przechodzi przez guarda wymuszającego oba zestawy; runner zachowuje dowód także przy porażce i zapisuje revision, fingerprint źródeł, stan drzewa oraz liczniki collected/executed/failed/skipped całości i per suite. Testy guarda 15/15 PASS; publiczna komenda **37/37 PASS** (37 wykonanych, 0 failed/skipped), potwierdzone zapisanym JSON. Uzupełniono mocki notyfikacji w scenariuszu i asercję podziękowania, usuwając ukryte błędy fixture. Nie dowodzi to dostarczenia powiadomienia ani pełnego baseline po K01; K03 pozostaje otwarte. [Dowód manifestu](program-audytu/evidence/k03-empty-manifest-2026-11-06/result.json), [wykonania guarda](program-audytu/evidence/k03-critical-path-invocation-2026-11-06/result.json), [proweniencji](program-audytu/evidence/k03-critical-path-provenance-2026-11-06/result.json).

<a id="k04"></a>

#### K04. Wąskie importy i jawne składanie infrastruktury

**Ustalenia:** R34. **Rodzaj:** DŁUG — WARUNKOWY MAŁY REFAKTOR. **Trudność:** M. **Pozycja proponowanego wykonania:** 22.

**Moduły:** lib/modules/video i channel — publiczne index; AppContext, lib/prisma i composition root aplikacji. lib/modules/shared/app-context.ts.

**Zmiana / wynik:** Wydzielić potrzebne czyste reguły/DTO i usunąć niepotrzebną inicjalizację domyślnej DB przy imporcie. Zacząć od rzeczywistego importu blokującego izolację. Nie przepisywać całego cyklu 77 plików. Jeśli K21 można bezpiecznie wykonać bez refaktoru, zamknąć tę zależność udokumentowanym odroczeniem K04, a nie udawanym usunięciem długu.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03). **Bramka:** Warunkowo przed zmianą kontraktów; nie blokuje K02.

**Ryzyko regresji:** Średnie: inicjalizacja kontekstu i zgodność eksportów.

**Do weryfikacji przed zamknięciem:** Graf i constructor probe dowodzą sprzężenia; nie dowodzą spowolnienia produkcji lub wielkości bundle. Zweryfikować w docelowym bundlerze po K01.

**Testy odbioru:**

- **K04-T1** — Import nowego czystego wejścia nie konstruuje DB, Redis ani providerów; test z zabronionym konstruktorem infrastruktury przechodzi. Produkcyjne złożenie nadal uruchamia prawdziwy klient.
- **K04-T2** — Wstrzyknięta DB jest użyta przez rzeczywisty use case; integracyjne legalne i odmowne scenariusze pozostają zgodne. Graf wybranego cyklu ma udokumentowaną zmianę lub świadome odroczenie, bez deklaracji naprawy wszystkich cykli.

**Postęp lokalny:** pierwotny probe wykazał 0 konstrukcji domyślnego klienta przy czystych importach i DB injection, oraz 1 przy pierwszym domyślnym transakcyjnym użyciu. Dodatkowy child-process test używa prawdziwego wygenerowanego PrismaClient przez `lib/prisma.ts`: delegat `user` i `$transaction` dostępne, `$disconnect` kończy się poprawnie bez DATABASE_URL lub połączenia do DB (**1/1 PASS**). Osobny test rzeczywistego `MainChannelService.getPubliclyVisibleById` i `ChannelRepository` potwierdza użycie przekazanego `createAppContext` delegata (`creator.findUnique`) (**1/1 PASS**; fake adapter, bez PostgreSQL). Repo typecheck/ESLint i granice architektury PASS. Nie jest to build docelowym bundlerem ani pełny test use case z DB; pełny zakres K04 i niezależny przegląd pozostają otwarte. [Probe i dowód injection](program-audytu/evidence/architecture-import-probe.json), [test injection](program-audytu/evidence/k04-injected-use-case-2026-11-07/result.json).

**Uzupełnienie 8 listopada:** zawężono importy w ścieżkach video, channel, access, patron-zone, payments, users, notifications i media; wyjątki są jawnie uzasadnione w strażniku, a mocki wskazują nowe granice. **29 suite, 269/269 PASS**, architektura, ESLint i diff check PASS. Probe 447 źródeł po `transpileModule` wykrywa zero statycznych SCC i zero błędów parsera; wcześniej największa grupa miała 86 plików. Probe nie obejmuje dynamicznych importów, node_modules ani kodu poza `lib/modules`, nie jest więc certyfikatem całego bundla ani runtime. [Dowód](program-audytu/evidence/k04-current-module-cycles-2026-11-08.json). Pełny typecheck zgłasza błąd `tests/helpers/k20-finalize-self-hls-process.ts(13,83): TS2554`. K04 pozostaje częściowe do review composition root.

**Uzupełnienie lokalne 7 listopada:** rzeczywisty serwis i repozytorium wykonano z wstrzykniętym wygenerowanym Prisma Client na disposable PostgreSQL 17.11 po 84 migracjach. ACTIVE zwrócił rekord; SUSPENDED, soft-deleted i brakujący zwróciły ten sam 404 (**4/4 PASS**). Test używa syntetycznych kont i nie obejmuje HTTP, innych composition rootów ani pełnego grafu importów. [Dowód PostgreSQL](program-audytu/evidence/k04-injected-context-postgres-2026-11-07.json).

<a id="k05"></a>

#### K05. Jednoznaczny profil produktu i decyzje właściciela

**Ustalenia:** R19. **Rodzaj:** SPECYFIKACJA I DECYZJE. **Trudność:** S. **Pozycja proponowanego wykonania:** 3.

**Moduły:** Dokumentacja produktu/operacji, P01–P22/F01–F14 w D01; katalog flag, kanałów, patrona i planów sprzedaży.

**Zmiana / wynik:** Rozdzielić obecne darowizny/pakiety od przyszłych zakupów marketplace, implementację od aktywnej flagi oraz kanał main od kanałów twórców. Utworzyć rejestr decyzji: refund/zużyte okresy, retencja/transfer kanału, świeżość admina i sesji, cofanie HLS, awaria auth, SLO/RPO/RTO/budżet. Brak odpowiedzi to otwarta decyzja z warunkiem, nie domyślna zgoda.

**Zależności:** brak. **Bramka:** Przed zmianami polityk i aktywacją funkcji.

**Ryzyko regresji:** Niskie technicznie; błędne założenie zmieniłoby politykę produktu.

**Do weryfikacji przed zamknięciem:** Aktualna konfiguracja produkcji nie jest dowiedziona przez kod. Później odczytać wyłącznie uprawnioną bezsekretową konfigurację i uzgodnić profil z właścicielem.

**Testy odbioru:**

- **K05-T1** — Każda aktywowana obietnica ma oczekiwany wynik dla widza/twórcy/admina i wskazanie flagi; sprzeczne aktualne opisy zastąpione jedną wersją.
- **K05-T2** — Lista decyzji wskazuje właściciela, termin względem bramki i status. Niedecydowane funkcje pozostają wyłączone lub bramka BLOCKED; dokument nie przedstawia ich jako przetestowanych.

### E1 — Bezpieczne wejścia i kontrolowane wydawanie

<a id="k06"></a>

#### K06. Wydanie związane z dokładnie sprawdzonym artefaktem

**Ustalenia:** R09. **Rodzaj:** NAPRAWA PROCESU. **Trudność:** M. **Pozycja proponowanego wykonania:** 5.

**Moduły:** Konfiguracje Next z ignoreBuildErrors, Dockerfiles, lokalne quality/CI/deploy i workflow publikacji obrazów.

**Zmiana / wynik:** Związać obowiązkowe typy/testy/build i zgodę na wydanie z SHA, wejściami budowy i digest obrazu. Zweryfikować wszystkie wspierane ścieżki, także ręczne/tagowane publikacje. Można zachować lokalny proces wymagany przez repo; nie narzucać GitHub Actions. Nieznane branch protection i attestation zweryfikować, nie zakładać ich braku.

**Zależności:** [K01](ROADMAPA-NAPRAW.md#k01), [K02](ROADMAPA-NAPRAW.md#k02), [K03](ROADMAPA-NAPRAW.md#k03). **Bramka:** Każde wydanie napraw.

**Ryzyko regresji:** Średnie: możliwość zablokowania dotychczasowej ścieżki wydania.

**Do weryfikacji przed zamknięciem:** Istniejące kontrole CI są wartościowe, ale sama deklaracja lub build nie dowodzi wykonania dla publikowanego obrazu.

**Testy odbioru:**

- **K06-T1** — Celowy błąd typu i celowa porażka wymaganego testu zatrzymują publikację/aktywację we wszystkich wspieranych ścieżkach. Wymagane testy nie mogą zostać zastąpione zerowym wyborem.
- **K06-T2** — Artefakt z innym SHA/digest lub zmienionymi wejściami nie przechodzi zatwierdzenia. Poprawny artefakt przechodzi cały proces w sandboxie; brak wymuszenia SLSA poziomu bez oddzielnego dowodu.

**Przyrost lokalny, 7 listopada 2026:** konsument `deploy-release.mjs` sprawdza i pobiera teraz wyłącznie obrazy wybrane przez `--scope`: cztery obrazy aplikacji dla `app`, sam panel dla `admin`. Wcześniej scope ograniczał końcowe tagowanie/weryfikację, ale Docker nadal odpytował wszystkie pięć registry digestów, więc niepowiązana niedostępność obrazu mogła blokować wąskie wdrożenie. Celowana regresja procesu obejmuje oba zakresy; bez registry, serwera ani publikacji. [Dowód](program-audytu/evidence/k06-scope-image-consumption-2026-11-07.json). K06 nadal częściowe do pozytywnego odbioru pełnego wydania, pięciu rzeczywistych obrazów i rollbacku.

<a id="k07"></a>

#### K07. Limit rzeczywistych bajtów przed parserem

**Ustalenia:** R15. **Rodzaj:** NAPRAWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 6.

**Moduły:** lib/api — czytniki JSON/formData; trasy Studio i panelu, proxy/reverse proxy oraz konfiguracja limitów.

**Zmiana / wynik:** Ograniczyć sumę odczytanych bajtów przed JSON/multipart, liczbę części/pól i rozmiary pól; ujednolicić kontrakt proxy i aplikacji. Zachować legalną listę 10000 części complete oraz osobne limity plików. Same Content-Length lub Zod po parse nie wystarczą.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Przed otwarciem publicznych wejść.

**Ryzyko regresji:** Średnie: legalne multipart i duże listy części mogą zostać niechcący odrzucone.

**Do weryfikacji przed zamknięciem:** Źródła i natywne Request potwierdzają parse-before-limit; pełnego proxy/Next/DoS nie wykonano. Najpierw zmierzyć rzeczywiste granice.

**Testy odbioru:**

- **K07-T1** — Brak/fałszywy Content-Length, chunked JSON, mały plik z wielkim polem i nadmiar części kończą się 413 przy granicy, przed pełnym buforowaniem; parser nie jest wywoływany po przekroczeniu.
- **K07-T2** — Dokładnie dozwolony rozmiar i legalny complete 10000 części przechodzą; +1 bajt/część ponad jawny limit odmawia. Równoległe odrzucone żądania mieszczą się w ustalonym budżecie pamięci/czasu w rzeczywistym stosie.

<a id="k08"></a>

#### K08. Świeże potwierdzanie wrażliwych operacji panelu

**Ustalenia:** R13. **Rodzaj:** DECYZJA, NASTĘPNIE ZMIANA JEŚLI POTRZEBNA. **Trudność:** M. **Pozycja proponowanego wykonania:** 7.

**Moduły:** Auth panelu Access/legacy, hasFreshStepUp i handlery refund/usunięcie/eksport/zmiana roli. apps/admin/lib/security/cf-access.ts; apps/admin/lib/auth/access-session.ts i guard.ts.

**Zmiana / wynik:** Uzgodnić okno i sposób potwierdzenia niezależnego od samej ważności logowania. Jeżeli obecne 12 h nie spełnia polityki, wprowadzić ograniczony mechanizm dla wrażliwych akcji z bezpiecznym odzyskaniem operatora. Nie dodawać obowiązkowego drugiego administratora bez decyzji.

**Zależności:** [K05](ROADMAPA-NAPRAW.md#k05), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Przed obsługą pieniędzy/delegowaniem panelu.

**Ryzyko regresji:** Średnie: utrata dostępu operatora lub osłabienie kontroli.

**Do weryfikacji przed zamknięciem:** Potwierdzona różnica polityk, nie obejście podpisu Access. Pełny tryb panelu i aktywna konfiguracja wymagają próby.

**Testy odbioru:**

- **K08-T1** — Stary poprawnie podpisany token nie pozwala na wrażliwą akcję po uzgodnionym progu; nowy legalny step-up pozwala. Odmowa nie zmienia DB ani nie wywołuje operatora płatności.
- **K08-T2** — Nieprawidłowy podpis, wygasły token, zła rola i tryb legacy mają jednoznaczne wyniki; błąd dostawcy potwierdzenia nie zamienia się w zgodę. Zachować ślad audytu bez tokenów.

<a id="k09"></a>

#### K09. Kontrolowana degradacja ochrony auth przy awarii Redis

**Ustalenia:** R14. **Rodzaj:** DECYZJA I OCHRONA ZASTĘPCZA. **Trudność:** M. **Pozycja proponowanego wykonania:** 33.

**Moduły:** Limity auth/liczniki błędów, adapter Redis, konfiguracja brzegu i alarm awarii. lib/auth/rate-limit-storage.ts i lib/auth/config.ts.

**Zmiana / wynik:** Uzgodnić i wdrożyć policzalne limity zastępcze oraz alarm. Zachować świadomy cel dostępności; nie zamieniać każdej awarii Redis w bezwarunkową blokadę wszystkich kont. Sprawdzić wszystkie rodziny wejść auth, a nie jeden helper.

**Zależności:** [K05](ROADMAPA-NAPRAW.md#k05), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Przed szerokim publicznym ruchem auth.

**Ryzyko regresji:** Średnie: kompromis dostępność logowania/ochrona przed automatyzacją.

**Do weryfikacji przed zamknięciem:** Fail-open jest zamierzony i potwierdzony testami; niezależne limity infrastruktury nie są zweryfikowane.

**Testy odbioru:**

- **K09-T1** — Odcięcie i opóźnienie Redis w izolowanym stosie nie omijają uzgodnionego limitu dla wielu IP/kont; działająca poprawna próba ma wynik zgodny z przyjętą polityką.
- **K09-T2** — Awaria generuje sygnał do własnego odbiornika; powrót przywraca zwykłe liczniki bez podwójnych kar i nieograniczonego retry. Zmierzone czasy i ograniczenia zapisane.

<a id="k10"></a>

#### K10. Odmowa dostępu przed metadanymi premiery

**Ustalenia:** R30. **Rodzaj:** NAPRAWA. **Trudność:** S. **Pozycja proponowanego wykonania:** 8.

**Moduły:** Łańcuch planu odtwarzania: centralne authorize/NOT_FOUND i budowanie DTO przyszłej premiery.

**Zmiana / wynik:** Obsłużyć centralną odmowę przed zwróceniem tytułu/postera/daty. Zachować legalny podgląd i odmowę tokenu mediów. Dowód dotyczy metadanych, nie dostępu do HLS.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Przed otwarciem treści/premier.

**Ryzyko regresji:** Niskie/średnie: zachowanie legalnego podglądu przyszłej premiery.

**Do weryfikacji przed zamknięciem:** Potwierdzony komponentowy łańcuch; potrzebne prawdziwe HTTP z rolami.

**Testy odbioru:**

- **K10-T1** — Gość i obcy użytkownik znający ID ukrytego/REMOVED filmu nie otrzymują tytułu, postera, daty ani tokenu; status/shape zgodny z kontraktem NOT_FOUND.
- **K10-T2** — Własny uprawniony podgląd i publiczna legalna premiera nadal działają, a odtwarzanie przed czasem pozostaje zabronione.

**Postęp lokalny 6 listopada 2026 (częściowy):** wspólny sanitizer planu publicznego dodatkowo czyści metadane dla `NOT_FOUND`/`VIDEO_NOT_FOUND`, nawet jeśli caller poda DTO z załadowanym filmem. Route-handler regresja dla gościa i obcego użytkownika pokrywa tytuł, poster, termin, ofertę, rozdziały, napisy, źródło/token, asset diagnostics i sesję. Wraz z testem gate **19/19 PASS**, ESLint i repo typecheck PASS. Nie uruchamiano osobnego serwera HTTP ani rzeczywistej sesji/DB; pełny odbiór HTTP i niezależny review pozostają otwarte. [Dowód](program-audytu/evidence/k10-public-redaction-2026-11-06/result.json).

### E2 — Poprawność pieniędzy i płatnych uprawnień

<a id="k11"></a>

#### K11. Uprawnienie liczone z wkładów poszczególnych wpłat

**Ustalenia:** R31. **Rodzaj:** NAPRAWA. **Trudność:** L. **Pozycja proponowanego wykonania:** 9.

**Moduły:** Moduły payments/patron/pass: fulfillment, refund, grant/entitlement; modele Payment i uprawnień, webhooki, migracje. lib/modules/patron-zone/application/patron-grant.ts; domain/pass-state.ts; lib/modules/payments/application/handle-refund.use-case.ts.

**Zmiana / wynik:** Wprowadzić deterministyczny wkład każdej wpłaty do czasu/lifetime i przeliczenie po refundzie; uzgodnić zużyte okresy. Rozdzielić kontrakt, migrację addytywną i backfill w sekwencyjnych podkrokach. Historycznych praw nie zgadywać i nie cofać automatycznie. Przed zmianą danych: read-only raport, niejednoznaczne rekordy i osobna zgoda na wykonanie.

**Zależności:** [K01](ROADMAPA-NAPRAW.md#k01), [K03](ROADMAPA-NAPRAW.md#k03), [K05](ROADMAPA-NAPRAW.md#k05), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Bezwzględnie przed aktywacją pakietów/refundów.

**Ryzyko regresji:** Wysokie: płatne prawa i zgodność danych historycznych.

**Do weryfikacji przed zamknięciem:** Komponenty: refund starego A usuwa prawa z nowego B; dwie wpłaty lifetime także tracą niezależność. Wymagany rzeczywisty Prisma/DB i operator wyłącznie test-mode.

**Testy odbioru:**

- **K11-T1** — Po zakupie A 30 dni, wygaśnięciu A i zakupie B refund A nie usuwa dostępu z B; refund jednej z dwóch aktywnych wpłat lifetime pozostawia wkład drugiej. Refund ostatniego skutecznego wkładu daje wynik według polityki.
- **K11-T2** — Częściowy refund, replay, zmiana kolejności i współbieżny zakup/refund nie dublują ani nie gubią wkładów. Webhook z błędnym podpisem odmawia bez skutku.
- **K11-T3** — Backfill dry-run uzgadnia stare i nowe uprawnienia oraz ujawnia niejednoznaczności. Mieszane wersje aplikacji/migracja mają sprawdzony plan; żadne rzeczywiste obciążenie lub odebranie praw nie jest częścią testu.

<a id="k12"></a>

#### K12. Agregat wpłat niezależny od kolejności refund/dispute

**Ustalenia:** R32. **Rodzaj:** NAPRAWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 10.

**Moduły:** Payment refund/dispute/reconciliation, UserPaymentTotal, obsługa walut i narzędzie uzgadniania agregatu. lib/modules/payments/application/handle-dispute.use-case.ts, handle-refund.use-case.ts; infrastructure/payment.repository.ts.

**Zmiana / wynik:** Aktualizować sumę różnicą kanonicznego wkładu płatności uwzględniającego refund i chargeback, pod spójną transakcją. Zapewnić odtwarzanie agregatu i read-only porównanie historii. Priorytet audytu P2 zachować; poprawność sum jest warunkiem wydania płatności. Naprawa danych produkcji to oddzielna zatwierdzana operacja.

**Zależności:** [K11](ROADMAPA-NAPRAW.md#k11). **Bramka:** Przed aktywacją bieżących płatności.

**Ryzyko regresji:** Wysokie: sumy finansowe i możliwa korekta historii.

**Do weryfikacji przed zamknięciem:** Komponent i protokół SQL potwierdziły różne wyniki; brak dowodu drugiego obciążenia karty.

**Testy odbioru:**

- **K12-T1** — A=1000 gr, B=500 gr, refund A=400 gr i przegrany spór A: obie kolejności kończą sumą 500 gr, nie 100 gr. Powtórzenie i współbieżne doręczenie nie zmieniają wyniku.
- **K12-T2** — Open/lost/won, refund częściowy/pełny oraz różne waluty mają uzgodnione wyniki; przeliczenie z Payment zgadza się z agregatem. Nie wykonuje się nowego charge/refund jako skutku naprawy sumy.

### E3 — Integralność oryginałów, HLS i publikacji

<a id="k13"></a>

#### K13. Błędy usuwania S3 per obiekt

**Ustalenia:** R04. **Rodzaj:** NAPRAWA. **Trudność:** S. **Pozycja proponowanego wykonania:** 11.

**Moduły:** lib/modules/video-pipeline/infrastructure/r2-storage.ts — HlsWriter.deletePrefix; application/output-cleanup.use-cases.ts — purgeVideoStorageStrict.

**Zmiana / wynik:** Obsłużyć Errors w HTTP 200 DeleteObjects, liczyć potwierdzone usunięcia, ponawiać przejściowe błędy i pokazywać trwałe operatorowi. Zachować wydajne batch DELETE; brak potrzeby kopiowania pojedynczych usunięć z PeerTube.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Przed poleganiem na cleanup/purge.

**Ryzyko regresji:** Średnie: retry i rozliczanie faktycznie usuniętych danych.

**Do weryfikacji przed zamknięciem:** Import DO_WERYFIKACJI oznacza potrzebny drugi przegląd; baseline wykonał rzeczywistą klasę z syntetyczną odpowiedzią AccessDenied.

**Testy odbioru:**

- **K13-T1** — HTTP 200 z jednym AccessDenied nie kończy strict purge jako SUCCESS i nie nalicza tego klucza jako usuniętego; trwały błąd jest widoczny z ID zadania.
- **K13-T2** — Mieszany sukces/błąd przejściowy ponawia tylko właściwe klucze, brakujący już obiekt jest idempotentny. Własny bucket/S3 sandbox potwierdza zgodność listowania i kolejnych stron.

**Dodatkowy przyrost lokalny, 7 listopada 2026:** paginowane odczyty odmawiają niepełnego wyniku, gdy strona jest oznaczona jako ucięta, ale nie ma nowego tokenu albo powtarza poprzedni. W `deletePrefix()` walidacja tokenu następuje przed usuwaniem obiektów z danej strony. Regresja przez prawdziwy AWS SDK na loopbackie sprawdza brak tokenu i powtórzony token; łącznie trzy suite K13: **22/22 PASS**, ESLint, typecheck i diff check PASS. Nie użyto R2 ani zewnętrznego bucketu. [Dowód](program-audytu/evidence/k13-pagination-fail-closed-2026-11-07.json). K13 pozostaje częściowe do odbioru sandboxa S3/R2 i niezależnego przeglądu.

<a id="k14"></a>

#### K14. Zatrzymanie i zakończenie transferów przed cleanup

**Ustalenia:** R03. **Rodzaj:** NAPRAWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 12.

**Moduły:** video-pipeline/application/process-encode-job.ts — runPool; infrastructure/r2-storage.ts — putFile i sygnał anulowania.

**Zmiana / wynik:** Po pierwszym błędzie przerwać przydzielanie nowych PUT, przekazać AbortSignal i doczekać zakończenia wszystkich rozpoczętych operacji przed cleanup katalogu i prefiksu. Współgra z izolacją prób w K16, lecz nie wymaga przepisywania pipeline.

**Zależności:** [K13](ROADMAPA-NAPRAW.md#k13). **Bramka:** Przed poleganiem na cleanup/retry kodowania.

**Ryzyko regresji:** Średnie: anulowanie i wycieki zasobów pod równoległym PUT.

**Do weryfikacji przed zamknięciem:** Baseline: trzy obiekty pojawiły się po przedwczesnym cleanup. Nie dowodzi publikacji częściowego filmu. Najpierw odtworzyć z kontrolą opóźnionych transferów.

**Testy odbioru:**

- **K14-T1** — Jedna awaria + opóźniony sukces i opóźniony błąd: po zakończeniu procesora oraz wszystkich PUT nie ma nieodnotowanych obiektów; cleanup zaczyna się dopiero po ustaniu zapisów.
- **K14-T2** — Normalny upload wszystkich części działa, anulowanie nie wiesza procesu, nowa praca nie jest przydzielana po awarii. Późniejsza integracja z K16 nie usuwa obiektów innej próby.

**Wynik lokalny 6 listopada 2026:** regresja RED odtworzyła cleanup przed zakończeniem rozpoczętego PUT. `runPool` zatrzymuje teraz przydzielanie plików po pierwszej awarii, anuluje uploadowy `AbortSignal` i czeka na wszystkie rozpoczęte operacje; błąd transferu pozostaje retryowalny, bo sygnał uploadu jest oddzielony od sygnału anulowania zadania. `HlsWriter.putFile()` przekazuje sygnał do `S3Client.send` i zamyka strumień po zakończeniu żądania. Kontrolowany test z opóźnionym sukcesem i opóźnionym błędem potwierdza kolejność cleanup; test potwierdza też brak przydzielania dalszych plików. Dwa pliki testów pipeline/storage: **23/23 PASS**, ESLint i repo typecheck PASS ([surowe wyniki](program-audytu/evidence/k14-upload-cleanup-2026-11-06/result.json)). Nadal brakuje sandboxa S3/R2, niezależnego przeglądu i potwierdzenia zachowania abort po stronie dostawcy; K14 częściowe, K16 nadal osobnym odbiorem.

**Dodatkowy lokalny odbiór klienta, 7 listopada 2026:** rzeczywisty `@aws-sdk/client-s3` na loopbackowym HTTP żądaniu PUT rozpoczął wysyłanie dużego, rzadkiego fixture; po anulowaniu sygnału `HlsWriter.putFile()` odrzucił request jako `AbortError`, a odbiorca po wznowieniu odczytu dostał zdarzenie `aborted`, nie dalszy pełny upload. Test ma limit 1 MiB dla wykrycia dalszych danych po anulowaniu. Łącznie **29/29** celowanych testów pipeline/storage PASS, ESLint, repo typecheck i diff check PASS. To dowodzi przerwania żądania klienta wobec lokalnego serwera HTTP; nie dowodzi, czy Cloudflare R2 zdążył utrwalić obiekt. [Dowód](program-audytu/evidence/k14-put-abort-sdk-2026-11-07.json). K14 nadal częściowe do testu na S3/R2 sandboxie i niezależnego review.

<a id="k15"></a>

#### K15. Monotoniczne ukończenie wersji oryginału

**Ustalenia:** R27. **Rodzaj:** NAPRAWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 13.

**Moduły:** Use case complete multipart/original, repozytoria oryginałów, activeOriginalId i enqueue kodowania. lib/modules/video-pipeline/application/original-upload.use-cases.ts.

**Zmiana / wynik:** Wspólny lock/CAS wersji i statusu dla ukończenia i retry; stare READY nie może reaktywować SUPERSEDED. Zachować naprawianie przerwy DB→enqueue zamiast bezwarunkowego early return.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Przed szerszym uploadem/wymianą filmu.

**Ryzyko regresji:** Wysokie: aktywny wskaźnik oryginału i odzyskiwanie kolejki.

**Do weryfikacji przed zamknięciem:** Potwierdzony protokół na dwóch połączeniach PostgreSQL; dołożyć rzeczywiste funkcje Prisma i HTTP z barierami.

**Testy odbioru:**

- **K15-T1** — Zatrzymać retry v1 po odczycie READY, ukończyć v2, wznowić v1: activeOriginalId pozostaje v2, v1 pozostaje SUPERSEDED i nie zleca nowej aktywacji.
- **K15-T2** — Zwykłe complete i jego replay działają; przerwa po DB przed enqueue zostaje naprawiona. Cancel/SUPERSEDED nie odzyskują aktywności przez spóźnione complete.

**Wynik lokalny 6 listopada 2026:** odtworzono błąd RED: spóźniony retry ze snapshotem `READY` cofał aktywny wskaźnik i próbował zlecić starszy oryginał. Complete i READY replay mają teraz wspólną transakcyjną blokadę per video, odczyt statusu/wersji pod blokadą i CAS; wersja aktywna, statusy oryginałów oraz zadanie kolejki są atomowe. READY replay naprawia historyczny brak joba tylko dla nadal zwycięskiej wersji. Trzy testy przez rzeczywistą trasę Studio z prawdziwymi transakcjami Prisma/PostgreSQL 17 i barierą: **3/3 PASS** (v1 retry po v2, recovery i idempotentny replay, spóźniony upload v1); dodatkowo 28/28 celowanych unit, ESLint i repo typecheck PASS ([dowody](program-audytu/evidence/k15-monotonic-original-2026-11-06/result.json)). Sesja Studio i R2 są kontrolowanymi atrapami; brak sandboxa R2 i niezależnego przeglądu, więc K15 częściowe.

<a id="k16"></a>

#### K16. Tożsamość próby i odrębne prefiksy kodowania

**Ustalenia:** R02. **Rodzaj:** KONTRAKT I MIGRACJA ADDYTYWNA. **Trudność:** M. **Pozycja proponowanego wykonania:** 14.

**Moduły:** EncodeJob i repozytorium claim/requeue/heartbeat, procesor, HLS storage layout, finalizer, migracje i diagnostyka. lib/modules/video-pipeline/application/encode-queue.use-cases.ts; scripts/video-worker.ts.

**Zmiana / wynik:** Nadać każdej próbie niepowtarzalną tożsamość/epokę i prywatny prefiks; przenieść ją przez wszystkie granice procesu. Opisać kontrakt właściciela cleanup. Wdrożenie wymaga kontrolowanego wygaszenia starych workerów; sama kolumna lub prefiks nie zamyka R02.

**Zależności:** [K14](ROADMAPA-NAPRAW.md#k14), [K15](ROADMAPA-NAPRAW.md#k15). **Bramka:** Część wymagana przed pełnym zamknięciem R02.

**Ryzyko regresji:** Wysokie: zgodność nowych i starych workerów.

**Do weryfikacji przed zamknięciem:** Sprawdzić odzyskiwanie po crash i mapowanie legacy prób; brak prawa starego kodu do wspólnego nowego prefiksu.

**Testy odbioru:**

- **K16-T1** — Dwie próby tego samego zadania mają rozłączne prefiksy i spójne ID w repo/finalizer/logach; cleanup A nie może adresować prefiksu B.
- **K16-T2** — Migracja na reprezentatywnym legacy snapshot i restart po claim nie gubią aktywnego filmu. Test mieszanego wykonania wykazuje blokadę niezgodnego starego workera; R02 pozostaje otwarte do K17.

**Wynik lokalny 6 listopada 2026:** każdy claim nowym repozytorium nadaje UUID; proces, katalog roboczy, HLS upload/weryfikacja, finalizer, logi i cleanup używają ID próby. Nowy prefiks ma postać `videos/<videoId>/v/v<version>/attempts/<uuid>/`; historyczny rekord `RUNNING` z pustym `attemptId` zachowuje stary prefiks i może dokończyć heartbeat. Addytywna migracja blokuje legacy claim do `RUNNING`, gdy UUID nie został ustawiony. Test na PostgreSQL 17 zastosował komplet 82 migracji i przeszedł: legacy claim odrzucony, dwie kolejne próby mają rozłączne ID/prefiksy, legacy heartbeat i odzyskanie po wygaśnięciu zachowują `activeOriginalId` (**1/1 test**). Testy unit: **53/53**, ESLint, Prisma validate i repo typecheck PASS ([dowody](program-audytu/evidence/k16-attempt-isolation-2026-11-06/)). To nie jest kontrolowane wygaszenie workerów w działającym środowisku ani fencing ich skutków; brak R2 sandboxa, niezależnego przeglądu i pełnego buildu. K16 pozostaje częściowe, K17 jest nadal wymagane dla R02.

<a id="k17"></a>

#### K17. Atomowe odcięcie skutków starego workera

**Ustalenia:** R02. **Rodzaj:** NAPRAWA. **Trudność:** L. **Pozycja proponowanego wykonania:** 15.

**Moduły:** process-encode-job.ts, self-hls-finalizer, repo EncodeJob, transakcja PlaybackRoute/VideoAsset i cleanup prób. lib/modules/video-pipeline/application/finalize-self-hls.ts; lib/modules/video/application/video-playback-route.service.ts.

**Zmiana / wynik:** Sprawdzać aktualną tożsamość próby w tej samej operacji atomowej co skutki aktywacji/statusów. Fencing dotyczy również usunięć i kolejnych efektów, a nie tylko końcowego zapisu SUCCESS. Dodatkowy SELECT przed transakcją jest niewystarczający.

**Zależności:** [K16](ROADMAPA-NAPRAW.md#k16). **Bramka:** Przed bezpiecznym retry/takeover i zwiększaniem encoderów.

**Ryzyko regresji:** Wysokie: transakcje aktywacji i przeniesienie własności zadania.

**Do weryfikacji przed zamknięciem:** Osobne procesy i DB są już objęte testem finalizera; pełny lifecycle starego workera, fizyczne obiekty storage, crash/lease expiry/requeue, kontrolowany drain i niezależny review pozostają otwarte.

**Testy odbioru:**

- **K17-T1** — Worker A zatrzymany przed finalizacją; B przejmuje zadanie i publikuje; A wraca: nie aktywuje starej trasy, nie zmienia statusu B ani nie usuwa obiektów B.
- **K17-T2** — Kontrola bez takeover aktywuje i kończy zadanie; crash/lease expiry/requeue mają jednoznaczny wynik i retry. Test obserwuje DB i fizyczne pliki, nie sam odrzucony końcowy status.

**Wynik lokalny 6 listopada 2026:** regresja RED na prawdziwym PostgreSQL 17 odtworzyła, że po finalizacji B stary A nadal aktywował własną trasę. Route activation blokuje job row, sprawdza `RUNNING + workerId + attemptId` i odświeża heartbeat w tej samej transakcji co zmianę trasy. Zapis progress/success/failure/cancel/release ma CAS z attempt ID, również gdy dwa procesy raportują ten sam `workerId`. Retry wyszukuje aktywny wynik dowolnej próby tej generacji. Po poprawce integracja K17 + repozytorium: **12/12 PASS** na PostgreSQL 17 z 82 migracjami; 3 pliki unit **34/34**, ESLint i repo typecheck PASS ([dowody](program-audytu/evidence/k17-stale-worker-fencing-2026-11-06/result.json)). Test przeprowadza takeover w kontrolowanej sekwencji, nie przez dwa niezależne procesy; brak fizycznego R2, pełnego buildu i niezależnego przeglądu. K17 częściowe; K18 sprawdza post-COMMIT/audyt, a R02 pozostaje otwarte.

**Uzupełnienie lokalne 7 listopada 2026:** test PostgreSQL po 84 migracjach uruchamia osobne procesy Node/tsx A i B. A odczytuje snapshot starej próby, jest zaobserwowany oczekując na blokadę `FOR UPDATE`, po czym po COMMIT przejęcia B jego finalizer odmawia; oddzielny proces B aktywuje wyłącznie własny asset/route. **1/1 PASS**, ESLint, repo typecheck i diff check PASS; fixture’y usunięte, kontener testowy zatrzymany. [Dowód](program-audytu/evidence/k17-two-worker-processes-2026-11-07.json). Test nie wykonuje pełnego download/FFmpeg/upload/cleanup worker lifecycle ani R2/S3; K17/R02 pozostaje częściowe do tych granic, kontrolowanego drainu i niezależnego review.

<a id="k18"></a>

#### K18. Granica COMMIT i ochrona już aktywowanego HLS

**Ustalenia:** R28. **Rodzaj:** NAPRAWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 16.

**Moduły:** Self-HLS finalizer, zapis AuditLog, aktywacja PlaybackRoute/VideoAsset, cleanup oraz rozpoznanie zakończonej próby. lib/modules/video-pipeline/application/finalize-self-hls.ts; lib/modules/video/application/video-playback-route.service.ts.

**Zmiana / wynik:** Rozróżnić błąd przed i po COMMIT. Obowiązkowy audyt powiązać transakcyjnie albo zapisać trwały zamiar; błąd po aktywacji nie uruchamia usuwania jej plików. Retry musi uzgodnić rzeczywisty rezultat przed zgłoszeniem sukcesu.

**Zależności:** [K17](ROADMAPA-NAPRAW.md#k17). **Bramka:** Przed bezpieczną publikacją/retry.

**Ryzyko regresji:** Wysokie: nieodwracalne usunięcie aktywnych plików.

**Do weryfikacji przed zamknięciem:** Komponenty potwierdziły zniknięcie plików po błędzie audytu; osobny SQL pokazał skutki FK, ale pełnego R2/Prisma nie było.

**Testy odbioru:**

- **K18-T1** — Wstrzyknięty błąd audytu tuż po COMMIT dla nowego i istniejącego assetu: aktywowany film nadal ma manifest/segmenty i się odtwarza; restart/retry nie zgłasza fałszywego sukcesu przy brakujących plikach.
- **K18-T2** — Awaria przed COMMIT nie pozostawia aktywnej trasy; cleanup usuwa tylko własny nieaktywny wynik. K17 nadal odcina starą próbę.

**Wynik lokalny 6 listopada 2026 (częściowy):** obowiązkowy `VIDEO_PLAYBACK_ROUTE_ACTIVATED` zapisuje się w tej samej transakcji co aktywacja trasy i zmiana primary assetu, więc błąd audytu wycofuje całą aktywację. Finalizer odróżnia rollback od utraconego potwierdzenia COMMIT; gdy odczyt uzgadniający sam zawiedzie, zachowuje wiersz i prefiks HLS do retry zamiast ryzykować skasowanie aktywnych plików. Retry ponownie używa aktywnego wyniku tylko po rekurencyjnym sprawdzeniu manifestów, playlist i referencji do segmentów w R2; brak obiektu uruchamia nową próbę zamiast fałszywego sukcesu. PostgreSQL 17 + 82 migracje: **4/4 integracyjne** (trzy K18, jedna regresja K17); unit **52/52**, ESLint i repo typecheck PASS ([dowody](program-audytu/evidence/k18-finalizer-audit-2026-11-06/)). Nie ma sandboxa R2, rzeczywistych plików kontrolnych ani dwóch niezależnych workerów; T1/T2 i K18 pozostają częściowe do odbioru tych granic oraz niezależnego przeglądu.

<a id="k19"></a>

#### K19. Wspólny protokół aktywacji i wycofywania HLS

**Ustalenia:** R29. **Rodzaj:** NAPRAWA. **Trudność:** L. **Pozycja proponowanego wykonania:** 17.

**Moduły:** output-cleanup.use-cases.ts, aktywacja tras/assetów, repo VideoAsset/PlaybackRoute, DurableJob i migracje stanów. lib/modules/video/application/video-playback-route.service.ts.

**Zmiana / wynik:** Rezerwować wycofanie pod wspólną blokadą/wersją z aktywacją; wycofywany asset nie może zostać aktywowany. Zewnętrzne kasowanie jako trwałe zadanie poza długą transakcją DB. Określić ścieżkę crash/retry i zgodność starych procesów; kolejny SELECT nie usuwa TOCTOU.

**Zależności:** [K13](ROADMAPA-NAPRAW.md#k13), [K17](ROADMAPA-NAPRAW.md#k17), [K18](ROADMAPA-NAPRAW.md#k18). **Bramka:** Przed usuwaniem wersji i publiczną publikacją.

**Ryzyko regresji:** Wysokie: locki, stany zasobów, migracja i długie I/O.

**Do weryfikacji przed zamknięciem:** Potwierdzono model activation-between-check-and-delete. Odtworzyć rzeczywistą bazę, oba porządki i opóźniony magazyn.

**Testy odbioru:**

- **K19-T1** — Cleanup rezerwuje zasób, potem aktywacja: aktywacja odmawia; aktywacja pierwsza, potem cleanup: aktywny zasób pozostaje. Po obu próbach DB i pliki są spójne.
- **K19-T2** — PUBLISHED/UNLISTED chronione zgodnie z polityką; dla DRAFT jawne oczekiwanie. Crash po rezerwacji i w połowie DeleteObjects daje idempotentne dokończenie lub odwrót, bez aktywnej trasy do skasowanych plików.

**Wynik lokalny 6 listopada 2026 (częściowy):** aktywacja i cleanup serializują się przez `Video FOR UPDATE`; cleanup odłącza aktywną trasę szkicu, zapisuje `cleanupPendingAt`, audyt i `VIDEO_ASSET_CLEANUP` atomowo. Addytywna migracja dodaje trigger blokujący route ACTIVE dla zarezerwowanego assetu także ze starego klienta. Runner usuwa R2 poza transakcją, po sukcesie usuwa asset i zapisuje audyt; partial delete zostawia trwałą rezerwację do retry. PostgreSQL 17 + 83 migracje: **4/4 testy K19** i **8/8 łącznie z regresjami K17/K18**; unit **48/48**, ESLint, repo typecheck, Prisma validate PASS ([dowody](program-audytu/evidence/k19-activation-cleanup-2026-11-06/)). Magazyn jest kontrolowanym fake, nie sandboxem R2; migracja i wznowienie żądań wymagają drainu starszych procesów. K19 pozostaje częściowe do odbioru R2 i niezależnego przeglądu.

<a id="k20"></a>

#### K20. Kontekst właściwego kanału podczas auto-publish

**Ustalenia:** R23. **Rodzaj:** NAPRAWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 18.

**Moduły:** Self-HLS finalizer, AppContext/authorize, powiązanie job→video→channel i publish-admin-video.use-case.ts. lib/modules/video-pipeline/application/finalize-self-hls.ts; lib/modules/video/application/publish-after-asset-ready.use-case.ts.

**Zmiana / wynik:** Tworzyć kontekst ze zweryfikowanego powiązania zadania, filmu i kanału, nigdy z niezaufanego body. Raportować jawnie wynik auto-publish. Zachować kontrole stanu kanału i fencing, zamiast omijać autoryzację.

**Zależności:** [K17](ROADMAPA-NAPRAW.md#k17), [K18](ROADMAPA-NAPRAW.md#k18), [K19](ROADMAPA-NAPRAW.md#k19). **Bramka:** Przed otwarciem wielu twórców.

**Ryzyko regresji:** Średnie: izolacja kanałów i publikacja w imieniu zadania.

**Do weryfikacji przed zamknięciem:** Komponentowy dowód dochodził do granicy publikatora po poprawieniu kontekstu; pełna aktywacja nie była wtedy realna.

**Testy odbioru:**

- **K20-T1** — Dwa niegłówne kanały, prawdziwe DB/worker: legalne PUBLIC i UNLISTED publikują właściwy film na właściwym kanale, a route i pliki odpowiadają temu filmowi.
- **K20-T2** — Cudze ID, usunięty/zawieszony kanał i stara próba nie publikują; odmowa nie jest raportowana jako skuteczna publikacja. Kanał main nadal działa.

**Wynik lokalny 6 listopada 2026 (częściowy):** finalizer sprawdza aktualne `RUNNING + workerId + attemptId`, rozwiązuje kanał z `video.creatorId` i odrzuca niezgodność z `job.channelId`; publikator ogranicza odczyt do tego kanału, odrzuca kanał usunięty/zawieszony i zwraca/loguje jawny wynik. Zachowano `publishAdminVideo`/`unlistAdminVideo` i `authorize()`. Dwa celowane pliki: **24/24 testy**, ESLint, typecheck i `git diff --check` PASS. Przygotowano też siedmioprzypadkowy test PostgreSQL realnego finalizera; typy i lint PASS, ale brak `DATABASE_URL`, więc test nie został wykonany ([dowody](program-audytu/evidence/k20-channel-auto-publish-2026-11-06/result.json)). **Nie zalicza K20-T1/T2:** brak uruchomionej bazy/workera, brak wyścigu statusu kanału oraz niezależnego przeglądu. K20 pozostaje częściowe.

**Uzupełnienie dowodów lokalnych 7 listopada 2026:** późniejsze wykonanie wykazało, że wcześniejszy opis braku DB/workera jest historyczny i nie opisuje bieżącego stanu. Test finalizera z rzeczywistym PostgreSQL 17 po 83 migracjach przeszedł **7/7**, obejmując non-main PUBLIC/UNLISTED, statusy kanałów, powiązanie job–film, main i fencing starej próby. Osobny test status race na PostgreSQL 17 po 84 migracjach przeszedł **1/1**: po rzeczywistym preflight status zmienił się na SUSPENDED, blokada `Creator FOR UPDATE` odrzuciła publikację, film pozostał DRAFT. Łącznie K20 ma też 26/26 celowanych unitów, ESLint i repo typecheck PASS. [Zbiorczy dowód](program-audytu/evidence/k20-channel-auto-publish-2026-11-06/result.json). To prawdziwe DB i finalizer, ale nie oddzielny proces całego encodera/workera; pozostają niezależny review oraz operacyjny odbiór tego procesu, więc K20 nadal częściowe.

**Oddzielny proces, 7 listopada:** child Node/tsx odczytuje job z PostgreSQL i wykonuje `createSelfHlsFinalizer` dla kanału non-main; film UNLISTED, jego route i asset pozostają powiązane z właściwym twórcą (**1 dodatkowy przypadek**, cały plik **8/8 PASS**). [Dowód](program-audytu/evidence/k20-worker-process-2026-11-07.json). To nie obejmuje kodowania ani realnego R2/HLS i nie zamyka K20.

**Aktualizacja lokalna 6 listopada:** `publishAdminVideo` serializuje publikację z moderacją przez `Creator FOR UPDATE` i odczytuje widoczność ponownie w transakcji. Nowy test na disposable PostgreSQL 17 po 84 migracjach zmienia status kanału z `ACTIVE` na `SUSPENDED` między preflight a publikacją; wynik 1/1 PASS, film pozostaje DRAFT. Fixture usunięte i kontener testowy usunięty. Jest to dowód świeżego odczytu na PostgreSQL, nie test dwóch niezależnych procesów. Szczegóły w [dowodach K20](program-audytu/evidence/k20-channel-auto-publish-2026-11-06/result.json); brak niezależnego przeglądu i worker acceptance, więc K20 nadal częściowe.

**Odbiór na aktualnym schemacie, 7 listopada:** istniejący zestaw realnej bazy uruchomiono razem na disposable PostgreSQL 17.11 po wszystkich 84 migracjach: testy finalizera **7/7** i status race **1/1**, łącznie **8/8 PASS**, repo typecheck i ESLint PASS. To wzmacnia K20-T1/T2 na DB dla właściwych odmów i publikacji, lecz nie wykonuje osobnego procesu workera ani prawdziwego zapisu/odtwarzania HLS z R2; niezależny review nadal wymagany. [Dowód](program-audytu/evidence/k20-postgres-acceptance-2026-11-07.json).

<a id="k21"></a>

#### K21. Wąski wspólny kontrakt upload/job/playback

**Ustalenia:** R21. **Rodzaj:** DŁUG I WALIDACJA GRANICY. **Trudność:** M. **Pozycja proponowanego wykonania:** 23.

**Moduły:** DTO upload/job/playback, klient JSON Studia, lib/video-upload i adaptery tras Studio/panelu.

**Zmiana / wynik:** Wydzielić czyste współdzielone typy/schematy odpowiedzi i jawne adaptery różnych tras. Walidować niezaufany JSON na granicy, zwracać kontrolowany błąd zamiast as T. Nie przebudowywać wszystkich API ani wymuszać identycznych URL.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K04](ROADMAPA-NAPRAW.md#k04), [K05](ROADMAPA-NAPRAW.md#k05). **Bramka:** Przed wspólnym resume; zakres ograniczony.

**Ryzyko regresji:** Średnie: zgodność UI z API i starszym klientem.

**Do weryfikacji przed zamknięciem:** Synthetic fetch 200 ze złą strukturą potwierdził brak walidacji; nie dowodzi faktycznego błędu odpowiedzi serwera.

**Testy odbioru:**

- **K21-T1** — Prawdziwy serwer zwraca zgodny kontrakt dla upload/job/playback; legalny starszy obsługiwany klient działa według opisanej zgodności.
- **K21-T2** — 200 z null/złą strukturą, niedozwolony enum, błędny status i uszkodzony JSON dają kontrolowany błąd bez kolejnego niepoprawnego żądania/zmiany stanu. Kontrakt nie importuje infrastruktury.

<a id="k22"></a>

#### K22. Wznowienie uploadu w Studio z istniejącego silnika

**Ustalenia:** R22. **Rodzaj:** UZUPEŁNIENIE FUNKCJONALNE. **Trudność:** M. **Pozycja proponowanego wykonania:** 24.

**Moduły:** app/components/studio/upload-original.ts, lib/video-upload/multipart-uploader.ts; GET parts/refresh signed URLs oraz adaptery Studio.

**Zmiana / wynik:** Użyć istniejącego silnika panelu z adapterami, zachować originalId i stan wznowienia. Błąd sieci/pauza nie oznaczają DELETE sesji; osobny świadomy cancel sprząta. Zweryfikować zgodność pliku i właściciela, nie tylko apiBase.

**Zależności:** [K14](ROADMAPA-NAPRAW.md#k14), [K15](ROADMAPA-NAPRAW.md#k15), [K20](ROADMAPA-NAPRAW.md#k20), [K21](ROADMAPA-NAPRAW.md#k21). **Bramka:** Przed obiecaniem odpornego uploadu twórcom.

**Ryzyko regresji:** Średnie: identyfikacja pliku, wielokrotne karty i cancel.

**Do weryfikacji przed zamknięciem:** Baseline pokazuje świadomie słabszy flow Studia; przed zmianą pełny browser→API→multipart. Zachować potrzebne kontrole przerwania.

**Testy odbioru:**

- **K22-T1** — Odświeżenie karty, ponowny wybór tego samego pliku i wygaśnięcie URL wznawiają ten sam upload; zapisane części nie są ponownie wysłane, wynik filmu jest poprawny.
- **K22-T2** — Inny plik, cudze originalId, dwie karty i stare complete nie nadpisują filmu. Pauza/wyczerpanie retry zachowują możliwość wznowienia, świadomy cancel usuwa własną rezerwację i dane według kontraktu.

**Postęp lokalny 7 listopada 2026 (częściowy):** dwa testy przeglądarkowe na lokalnym Next + disposable PostgreSQL potwierdzają wznowienie po reload (dowód 6 listopada) oraz kontynuację w drugiej karcie przy pierwszej pozostawionej otwartej (dowód 7 listopada). W drugim scenariuszu występuje jeden draft, jeden multipart start, jeden PUT zapisanej części i retry complete po kontrolowanym 502. Test jednostkowy potwierdza rozróżnienie dwóch plików o tych samych metadanych i różnej próbkowanej zawartości. API/R2 są kontrolowane, więc nie dowodzi to równoczesnego wyścigu dwóch uploaderów, realnego ETag/CORS ani expiry/retry presigned URL; K22 pozostaje częściowe. [Dowód dwóch kart](program-audytu/evidence/k22-two-tab-browser-2026-11-07.json).

<a id="k23"></a>

#### K23. Trwały zamiar powiadomienia razem z publikacją

**Ustalenia:** R05. **Rodzaj:** NAPRAWA LUKI NIEZAWODNOŚCI. **Trudność:** M. **Pozycja proponowanego wykonania:** 25.

**Moduły:** video/application/publish-admin-video.use-case.ts; notifications/application/new-video-fan-out.use-case.ts, premiere-notifications.use-case.ts; DurableJob/outbox.

**Zmiana / wynik:** Zapisać unikalny trwały zamiar ogłoszenia w transakcji publikacji; fan-out wykonywać po niej z retry i idempotencją. Rozszerzyć własny sprawdzający się wzorzec z usuwania filmu. Nie obiecywać exactly-once u dostawcy e-mail.

**Zależności:** [K20](ROADMAPA-NAPRAW.md#k20). **Bramka:** Przed uznaniem powiadomień o publikacji za niezawodne.

**Ryzyko regresji:** Średnie: duplikaty zdarzeń i zgodność z premierami.

**Do weryfikacji przed zamknięciem:** Luka wynika z kolejności commit→best effort enqueue; źródłowy dowód wymaga testu crash na pełnej DB.

**Testy odbioru:**

- **K23-T1** — Zabić proces po COMMIT publikacji zwykłego filmu bez premiereAt, przed fan-out: restart dostarcza zamiar i ogłoszenie do własnego odbiornika.
- **K23-T2** — Retry publikacji, retry dispatchu i premiera nie tworzą drugiego biznesowego zamiaru; rollback publikacji nie wysyła ogłoszenia. Awaria dostawcy pozostawia jawny stan ponowienia.

### E4 — Izolacja, moderacja, prywatność i cofanie dostępu

<a id="k24"></a>

#### K24. Odwołanie powiązane z tożsamością decyzji

**Ustalenia:** R25. **Rodzaj:** NAPRAWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 19.

**Moduły:** Moderacja kanału/komentarza, appeal resolution, repo bieżącej decyzji/stanu, audyt i migracje wersji. lib/modules/channel/application/moderation-appeals.use-cases.ts i channel-moderation.use-cases.ts.

**Zmiana / wynik:** Sprawdzać ID/wersję bieżącej decyzji w tej samej operacji co cofnięcie, zamiast samej wartości SUSPENDED/REMOVED. Stare A nie może odwrócić nowego B po cyklu stanów. Zachować legalne odwołanie od aktualnej decyzji.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K05](ROADMAPA-NAPRAW.md#k05), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Przed szerszą moderacją/kanałami.

**Ryzyko regresji:** Średnie: moderacja i historia zdarzeń.

**Do weryfikacji przed zamknięciem:** Dowód komponentowy pokazuje także sekwencyjny błąd ABA; do potwierdzenia w pełnym HTTP/Prisma i przy współbieżności.

**Testy odbioru:**

- **K24-T1** — Dla kanału SUSPENDED→ACTIVE→SUSPENDED i komentarza REMOVED→VISIBLE→REMOVED uznanie odwołania A nie cofa decyzji B.
- **K24-T2** — Odwołanie od aktualnej A bez B działa; dwie kolejności i równoczesne decyzje/replay mają spójną historię, cudza rola/odwołanie odmawia bez skutku.

<a id="k25"></a>

#### K25. Limit playlist odporny na współbieżność

**Ustalenia:** R26. **Rodzaj:** NAPRAWA. **Trudność:** S. **Pozycja proponowanego wykonania:** 20.

**Moduły:** Tworzenie/usuwanie playlist, repo kanału/playlist; limit 100 i protokół blokady/licznika. lib/modules/playlists/application/playlist-manage.use-cases.ts; domain/playlist-rules.ts.

**Zmiana / wynik:** Egzekwować COUNT/INSERT pod wspólną blokadą per kanał albo równoważnym licznikiem/izolacją z retry. Oprzeć się na istniejącym wzorcu advisory lock uploadu, bez globalnej serializacji całej platformy.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K06](ROADMAPA-NAPRAW.md#k06). **Bramka:** Przed otwarciem limitowanych kanałów.

**Ryzyko regresji:** Średnie: blokady kanału i retry transakcji.

**Do weryfikacji przed zamknięciem:** Dwa realne połączenia SQL dały 101 playlist; realne API i wszystkie role wymagają potwierdzenia.

**Testy odbioru:**

- **K25-T1** — Z 99 playlist dwa równoległe żądania przez odrębne procesy kończą z najwyżej 100; jedno ma legalny sukces, drugie kontrolowaną odmowę limitu.
- **K25-T2** — Usunięcie zwalnia miejsce; retry nie tworzy duplikatu ani nie psuje audytu. Inny kanał nie jest niepotrzebnie blokowany, cudzy zasób jest odrzucony.

**Uzupełnienie odbioru lokalnego 7 listopada 2026:** dwa osobne procesy Node uruchomiły rzeczywisty `createPlaylist` i authz jednocześnie na wspólnym disposable PostgreSQL 17 po 84 migracjach przy stanie 99 playlist. Wynik: jeden sukces, jedna odmowa `PLAYLIST_LIMIT`, licznik 100 i dokładnie jeden audit row. Istniejące testy tej samej bazy weryfikują zwolnienie slotu przez soft delete, odmowę cudzej playlisty i niezależny zapis na drugim kanale. Cały plik PostgreSQL **2/2 PASS**, ESLint i repo typecheck PASS; jednorazowy kontener usunięty. [Dowód](program-audytu/evidence/k25-playlist-limit-2026-11-06/result.json). To odrębne procesy aplikacyjne i prawdziwe use case’y, ale bez HTTP/Studio i serwerów wdrożonych; K25 pozostaje częściowe do endpoint acceptance i niezależnego review.

**HTTP Studio, 7 listopada:** prawdziwy `POST /api/studio/playlists` handler z rzeczywistymi operacjami Prisma na disposable PostgreSQL przyjmuje przy 99 aktywnych playlistach dwa równoległe POST-y; dostaje się dokładnie 201 i 409 `PLAYLIST_LIMIT`, stan końcowy wynosi 100, a zatwierdzona zmiana ma jeden wpis audytu. Cała suite PostgreSQL **3/3 PASS**, unit **18/18**, ESLint i repo typecheck PASS ([dowód](program-audytu/evidence/k25-studio-postgres-2026-11-07.json)). Sesja i limiter były kontrolowane; test nie obejmuje dwóch wdrożonych procesów HTTP ani DELETE przez endpoint. K25 pozostaje częściowe.

**Odbiór dwóch procesów HTTP, 7 listopada 2026:** dwa osobne lokalne `next start` z tym samym buildem obsłużyły równoległe uwierzytelnione POST-y na wspólnej disposable PostgreSQL: 201/409 `PLAYLIST_LIMIT`, stan 100, jeden audit row. DELETE na pierwszym procesie zwolnił slot, który drugi proces wykorzystał nowym POST-em; licznik wrócił do 100, audyty delete/create po jednym. Cudzy zasób przez DELETE z drugiego kanału dał 404 i nie zmienił celu. Użyto prawdziwej sesji i handlerów HTTP; bez Redis limiter był fail-open, więc nie jest zaliczony. [Dowód](program-audytu/evidence/k25-two-next-process-http-2026-11-07.json). To nie jest odbiór wdrożonej infrastruktury ani niezależny review; K25 pozostaje częściowe.

<a id="k26"></a>

#### K26. Usunięcie konta a własność i publiczny profil kanału

**Ustalenia:** R33. **Rodzaj:** NAPRAWA CYKLU DANYCH. **Trudność:** L. **Pozycja proponowanego wykonania:** 21.

**Moduły:** Account cleanup, Creator/Channel/ChannelMember, publiczny header/DTO, kolejka usuwania mediów i retencja audytu. lib/modules/users/application/account-deletion-cleanup.use-case.ts; lib/modules/channel/infrastructure/creator-content.service.ts.

**Zmiana / wynik:** Najpierw decyzja transfer/ukrycie/anonimizacja/usunięcie. Następnie spójnie zmienić publiczny stan i utrwalić pozostały cleanup; uwzględnić wiele kanałów, innych członków i ochronę main. Nie uznawać automatycznie wszystkich filmów za dane do skasowania. Wykonanie historycznej korekty dopiero po read-only wykazie i zgodzie.

**Zależności:** [K05](ROADMAPA-NAPRAW.md#k05), [K19](ROADMAPA-NAPRAW.md#k19), [K24](ROADMAPA-NAPRAW.md#k24). **Bramka:** Przed otwarciem kont twórców/usuwaniem ich kont.

**Ryzyko regresji:** Wysokie: własność, retencja i nieodwracalne usuwanie.

**Do weryfikacji przed zamknięciem:** Komponentowy cleanup konta zostawia ACTIVE kanał i stare publicContactEmail/bio. Nie jest to dowód prawnego obowiązku usunięcia każdej treści.

**Testy odbioru:**

- **K26-T1** — Po pełnym usunięciu syntetycznego właściciela publiczny profil i kontakt odpowiadają zatwierdzonej polityce, również przez cache; stary e-mail nie pozostaje przypadkiem publiczny.
- **K26-T2** — Transfer, kilku członków/kanałów, main, retry i crash nie odbierają cudzej własności ani nie usuwają aktywnych mediów innych kanałów. Audyt i retencja mają zgodne jawne wyniki.

<a id="k27"></a>

#### K27. Kompletność eksportu danych i wersja kontraktu

**Ustalenia:** R16. **Rodzaj:** UZUPEŁNIENIE FUNKCJONALNE. **Trudność:** M. **Pozycja proponowanego wykonania:** 28.

**Moduły:** Privacy export, kategorie CYKL-DANYCH.csv, kanały/członkostwa/patronAppSetting, nowe wkłady uprawnień z K11. app/api/user/export/route.ts; lib/modules/users/application/export-own-data.use-case.ts.

**Zmiana / wynik:** Wersjonować zakres i objąć wszystkie aktywne kategorie danych osoby. Nie mieszać kompletności z optymalizacją ogromnych eksportów K37. Gdy płatności są wyłączone, K11 może być warunkowo poza tym profilem; ich późniejsze włączenie wymaga ponownego testu eksportu.

**Zależności:** [K05](ROADMAPA-NAPRAW.md#k05), [K11](ROADMAPA-NAPRAW.md#k11), [K26](ROADMAPA-NAPRAW.md#k26). **Bramka:** Przed otwarciem odpowiednich modeli kont/kanałów.

**Ryzyko regresji:** Średnie: pominięcie kategorii lub eksport cudzych danych.

**Do weryfikacji przed zamknięciem:** Potwierdzono brak kategorii w komponencie; nie stwierdzono wycieku cudzych danych. Wymagany pełny profil HTTP/DB.

**Testy odbioru:**

- **K27-T1** — Osoba z kontem, rolami w kilku kanałach i aktywnymi danymi patrona otrzymuje każdą zadeklarowaną kategorię z wersją kontraktu; brak danych jest jawny, nie pominięty przypadkiem.
- **K27-T2** — Cudze dane, sekrety i prywatne pola wewnętrzne nie trafiają do eksportu. Cofnięta sesja i cudze ID odmawiają, legalny ponowny eksport działa; K37 nadal otwarte dla dużych zbiorów.

**Postęp lokalny 6 listopada 2026 (częściowy):** dodano `schemaVersion: 1`, własne profile kanałów, role i timestampy członkostwa, preferencje i metadane historii powiadomień, historię patron grants oraz własne binarne awatary i bannery jako Base64 z MIME. Bannery pobierane są wyłącznie dla kanałów z profili `Creator` przypisanych do eksportowanego konta; niedozwolony MIME lub przekroczony limit odrzuca eksport. Historia powiadomień zawiera rodzaj, stan przeczytania i czas; bez treści/parametrów, które mogłyby zawierać dane innych osób lub szczegóły moderacyjne. Query kategorii wierszowych są filtrowane po własnym `userId`; wybrane pola kanału i grant nie zawierają wewnętrznych reviewer IDs, powodów ani provider/payment IDs. Brak preferencji jest kategorią `null`, nie pominiętym kluczem. Test 5/5 PASS, ESLint, repo typecheck i diff check PASS. Globalne AppSetting i przyszłe marketplace orders/entitlements pozostają poza eksportem; brak pełnego HTTP/DB, review oraz decyzji zależnych K05/K11/K26. K27 pozostaje częściowe. [Dowód kategorii](program-audytu/evidence/k27-export-categories-2026-11-06/result.json), [dowód mediów](program-audytu/evidence/k27-export-media-2026-11-06/result.json), [dowód powiadomień](program-audytu/evidence/k27-notification-metadata-2026-11-06/result.json).

**Dodatkowy rekord AppSetting:** własny Premium Pass jest czytany po dokładnym kluczu konta przez walidowany `readPass`, a do eksportu trafiają tylko produkt, kwoty, waluta, metoda, okres i zgody — bez `ref`, `requestId` i `paymentIds`. Nie eksportujemy globalnych dziennych liczników. Dodanie kategorii podniosło kontrakt do `schemaVersion: 2`. Celowany eksport 6/6, architektura, ESLint, repo typecheck i diff check PASS; pełny HTTP/DB oraz review pozostają otwarte. [Dowód](program-audytu/evidence/k27-patron-pass-2026-11-06/result.json).

**Historia oglądania:** dodano własne widoki, sesje oraz zdarzenia odtwarzania w K27, wybierając tylko jawne pola i wykluczając hashe IP/UA, identyfikatory sesji/DB, dowolne metadata i teksty błędów. Zmiana podniosła kontrakt do `schemaVersion: 3`; celowane testy 6/6 i pozostałe lokalne bramki PASS. Brak pełnego HTTP/DB, review oraz paginacji/strumieniowania K37. [Dowód](program-audytu/evidence/k27-playback-history-2026-11-06/result.json).

**Komunikacja e-mail:** dodano własne metadane odbioru kampanii i zdarzeń webhooka filtrowane po `userId`, bez adresów, identyfikatorów dostawcy/kampanii/odbiorcy, payloadów, błędów i retry. Rekordów bez pewnego `userId` nie łączymy po adresie. Kontrakt wzrósł do `schemaVersion: 4`; lokalne kontrole PASS, brak realnego providera i pełnego HTTP/DB. [Dowód](program-audytu/evidence/k27-email-history-2026-11-06/result.json).

**Odbiór route/DB:** rzeczywisty handler eksportu wykonano przeciw świeżej PostgreSQL 17 z 84 migracjami; odpowiedź pobrania/no-store, zakres własnego konta, odmowa gościa i ponowny eksport przeszły **2/2**. Auth i limiter były kontrolowane; nie uruchomiono Next przez socket HTTP ani prawdziwej sesji. Dowód i ograniczenia: [K27 route/DB](program-audytu/evidence/k27-route-postgres-2026-11-06/result.json).

**Pełna macierz kategorii przez HTTP, 7 listopada 2026:** rozszerzony test uruchamia Next dev, prawdziwy Better Auth i handler na loopbackie przeciw disposable PostgreSQL 17.11 po 84 migracjach. Sprawdza wszystkie pola kontraktu `schemaVersion: 4` z syntetycznego konta mającego własny kanał i rolę EDITOR w cudzym kanale; odpowiedź zawiera oczekiwane dane własne, a obcy rekord, hashe, payloady, prywatne treści i wewnętrzne referencje pozostają poza JSON. Gość i cofnięta sesja dostają 401; właściciel 200/no-store; ponowny eksport ma identyczne dane poza zmiennym `exportedAt`. **1/1 PASS**, typecheck, ESLint i diff check PASS. [Dowód](program-audytu/evidence/k27-http-categories-postgres-2026-11-07/result.json), [test](../../../tests/postgres/user-export-http.pg.test.ts). Test zwiększa lokalny dowód K27-T1/T2, lecz nie rozstrzyga polityki ani prawnej kompletności, dostawców/reverse proxy, K37 ani niezależnego review; pakiet pozostaje częściowy.

<a id="k28"></a>

#### K28. Polityka cofania sesji WWW i krytyczne operacje

**Ustalenia:** R24. **Rodzaj:** DECYZJA, POTEM ZMIANA JEŚLI POTRZEBNA. **Trudność:** M. **Pozycja proponowanego wykonania:** 26.

**Moduły:** Better Auth cookie cache, fresh lookup, kontekst sesji i autoryzacja wrażliwych tras/actions. lib/auth/server.ts, lib/auth/config.ts; lib/api/auth.ts i lib/api/studio-session.ts.

**Zmiana / wynik:** Uzgodnić czas cofnięcia per operacja. Jeśli 60 s cache jest niedopuszczalne, stosować selective fresh/epokę/wyłączenie cache według pomiaru. Jeśli akceptowalne, zapisać ryzyko, test granicy i komunikat polityki. Ponowne delete w DB nie unieważnia podpisanego cache.

**Zależności:** [K05](ROADMAPA-NAPRAW.md#k05), [K08](ROADMAPA-NAPRAW.md#k08). **Bramka:** Przed profilem o wymaganym szybkim cofnięciu dostępu.

**Ryzyko regresji:** Średnie: obciążenie DB, dostępność sesji i zgodność biblioteki.

**Do weryfikacji przed zamknięciem:** Rzeczywiste HTTP biblioteki na pamięci potwierdziło cache i odmowę fresh/po TTL; aplikacja z Prisma i hookami pozostaje niezweryfikowana.

**Testy odbioru:**

- **K28-T1** — Dwa rzeczywiste klienty: logout/revoke-other/zmiana hasła i roli, replay starego cookie na prywatnym odczycie i zapisie. Przed/po ustalonym progu wynik dokładnie odpowiada polityce.
- **K28-T2** — Legalna aktywna sesja działa; odwołana nie wykonuje skutków na wymagającym świeżości wejściu. Awaria DB/cache ma jawny wynik i nie rozszerza ustalonego okna po cichu.

<a id="k29"></a>

#### K29. Polityka cofania HLS obejmująca token i cache

**Ustalenia:** R07. **Rodzaj:** DECYZJA I WARUNKOWE OGRANICZENIE RYZYKA. **Trudność:** M. **Pozycja proponowanego wykonania:** 27.

**Moduły:** Playback plan/signer, HLS Worker, TTL i cache klienta/brzegu, purge/epoka oraz zdarzenia refund/unpublish/block/delete. lib/modules/playback/application/playback.service.ts i public-playback-plan.ts; lib/modules/access/application/check-video-access.use-case.ts.

**Zmiana / wynik:** Określić osobno nowe tokeny, już wydane tokeny i już pobrane bajty. Dla obecnych 30 min protected/6 h public zdecydować akceptację albo krótszy TTL/epokę/unieważnianie. Mierzyć koszt i dostępność. Nie obiecywać DRM ani cofnięcia kopii pobranej przez użytkownika. Przy płatnościach OFF zależność K11 dotyczy dopiero profilu płatnego.

**Zależności:** [K05](ROADMAPA-NAPRAW.md#k05), [K10](ROADMAPA-NAPRAW.md#k10), [K11](ROADMAPA-NAPRAW.md#k11), [K19](ROADMAPA-NAPRAW.md#k19), [K28](ROADMAPA-NAPRAW.md#k28). **Bramka:** Przed płatnym/chronionym profilem zgodnie z wybraną polityką.

**Ryzyko regresji:** Wysokie: cache, koszty brzegu i ciągłość odtwarzania.

**Do weryfikacji przed zamknięciem:** Symulowany zegar i komponenty potwierdziły ważny stary token mimo odmowy nowego planu; realnego logout/refundu i edge purge nie wykonano.

**Testy odbioru:**

- **K29-T1** — Logout, unpublish, refund, blokada kanału i delete: dla zimnego/ciepłego cache sprawdzić stary i nowy token oraz manifest/segmenty; odcięcie następuje w zatwierdzonym czasie, bez wycieku metadanych.
- **K29-T2** — Wygaśnięty/zmieniony token i obca wersja odmawiają; legalne wznowienie działa. Brak połączenia z origin/revocation ma wynik zgodny z polityką, koszty i nieodwracalność już pobranych danych są jawne.

### E5 — Odzyskiwanie, operacje i odbiór pełnego produktu

<a id="k30"></a>

#### K30. Funkcjonalny monitoring własnego filmu

**Ustalenia:** R18. **Rodzaj:** UZUPEŁNIENIE NIEZAWODNOŚCI. **Trudność:** M. **Pozycja proponowanego wykonania:** 30.

**Moduły:** Public health, diagnostyczny token DB/Redis, watchdog, HLS probe, encoder heartbeat/queue, QoE i logowanie. app/api/health/route.ts; lib/modules/health/application/check-health.use-case.ts; lib/modules/admin-overview/infrastructure/probes.ts.

**Zmiana / wynik:** Rozdzielić liveness/readiness i tani canary: własny manifest, segment i faktyczny postęp odtwarzania. Ustalić świeżość QoE/kolejek, progi i routing. Nie usuwać działających DB/Redis/heartbeat checks; chronić tokeny i ograniczyć koszt próbkowania.

**Zależności:** [K06](ROADMAPA-NAPRAW.md#k06), [K17](ROADMAPA-NAPRAW.md#k17), [K19](ROADMAPA-NAPRAW.md#k19), [K20](ROADMAPA-NAPRAW.md#k20). **Bramka:** Przed publiczną i płatną obsługą.

**Ryzyko regresji:** Średnie: fałszywe alarmy, ruch i ujawnienie tokenów.

**Do weryfikacji przed zamknięciem:** Komponenty potwierdzają status-only publicznych probe i pozytywne kontrole głębszych; brak pełnej ścieżki wykrycia/odbioru.

**Testy odbioru:**

- **K30-T1** — Osobne awarie DB, brak segmentu, zatrzymany encoder i nieświeże QoE dają właściwy stan/sygnał w zadanym czasie; sam HTTP 200 nie wystarcza do zaliczenia filmu.
- **K30-T2** — Zdrowa kontrola dekoduje własny film i nie alarmuje; sygnał trafia do własnego odbiornika, logi nie zawierają tokenów, ruch nie przekracza budżetu canary.

**Postęp lokalny 7 listopada 2026 (częściowy):** probe aplikacji w panelu admina uznaje teraz wyłącznie odpowiedzi 2xx z `/api/health`; wcześniejsze `status < 500` maskowało m.in. 401/404 jako zdrowie. Publiczny health bez tokenu pozostaje lekkim liveness 200. Autoryzowany readiness zwraca teraz HTTP 503, gdy diagnostyka zależności zwróci `ok:false`, zamiast HTTP 200 z błędnym JSON-em. Test regresyjny probe akceptuje 200/204 i odrzuca 401/404/500/503; test trasy sprawdza liveness 200 oraz readiness 200/503; test use case wymusza niedostępność DB i potwierdza `database: failed`. Probe HLS pozostaje osobny: oczekiwane 404 na pustym korzeniu nadal oznacza działający Worker. Celowane testy health/probe: **29/29 PASS**, ESLint i repo typecheck PASS. Nie realizuje to canary manifestu/segmentu/dekodowania ani odbioru alarmu/QoE; K30-T1/T2 i pakiet pozostają otwarte. [Testy probe](../../../tests/unit/admin-overview/overview-use-cases.test.ts), [test trasy](../../../tests/unit/api/health-route.test.ts), [test DB](../../../tests/unit/modules/health/check-health.use-case.test.ts).

<a id="k31"></a>

#### K31. Trwałe ponowienie powiadomienia recovery watchdog

**Ustalenia:** R36. **Rodzaj:** NAPRAWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 31.

**Moduły:** Watchdog Worker.fetch, D1 incident/delivery state, sendMail, limity dzienne i timeouty. workers/pp-watchdog/worker.mjs.

**Zmiana / wynik:** Oddzielić zmierzony healthy/down od trwałego stanu doręczenia zdarzenia z ID incydentu. Zachować pending recovery po non-2xx/limicie; bounded retry, timeout i idempotencja. Nie nazywać acceptance dostawcy dowodem odbioru w skrzynce.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K30](ROADMAPA-NAPRAW.md#k30). **Bramka:** Przed poleganiem na zamknięciu incydentu przez watchdog.

**Ryzyko regresji:** Średnie: zgodność stanu incydentu i dostarczenia.

**Do weryfikacji przed zamknięciem:** Recovery network throw już jest ponawiane; błąd dotyczy false z HTTP non-2xx/limitu po wcześniejszym DOWN. Zachować działające kontrole DOWN.

**Testy odbioru:**

- **K31-T1** — Po zaakceptowanym DOWN zdrowa kontrola + recovery HTTP 503 lub osiągnięty limit pozostawiają pending; po powrocie dostawcy/limitu recovery zostaje wysłane i odnotowane.
- **K31-T2** — Network throw recovery, początkowy DOWN 503, restart i równoległe uruchomienia nie gubią zdarzenia ani nie zalewają wiadomościami. Próba w D1 sandbox/własnym mail sink, bez rzeczywistych adresatów.

**Postęp lokalny 6 listopada 2026 (częściowy):** dodano D1 outbox, retry/backoff, lease współbieżnego claimu i stabilny klucz idempotencji. Testy z atrapą D1 pokrywają recovery HTTP 503, wyjątek sieciowy, wyczerpanie limitu dziennego oraz dwa równoległe runy; 6/6 testów, typecheck i architektura PASS, ESLint bez błędów. Dodatkowy probe uruchomił rzeczywisty kod Workera na lokalnym SQLite 3.51.3 i potwierdził DDL, `UPDATE ... RETURNING` i pojedynczy claim podczas dwóch równoległych runów. Brak rzeczywistego Cloudflare D1/Resend/sandboxu, restartu i sprawdzenia kolejności awarii między dostawcą a zapisem SENT; K31 nie jest zamknięte. Szczegóły i ograniczenia: D16, sekcja K31.

**Uzupełnienie lokalne 7 listopada 2026:** po odpowiedzi sukcesu dostawcy zmiana `alert_delivery` na SENT, zwiększenie limitu dnia i sprzątanie starych limitów wykonują się w jednym transakcyjnym `D1.batch()`. Awaria partii po pierwszym zapisie wycofuje całość; retry po zwolnieniu lease ponawia ten sam klucz idempotencji. Celowane testy **7/7 PASS**, ESLint (0 błędów, jedno istniejące ostrzeżenie), repo typecheck i diff check PASS. Rzeczywisty kod Workera na lokalnym SQLite 3.51.3: dwa równoległe runy dały jeden provider call dla jednego eventu; awaria commitu pozostawiła event PENDING i nie zmieniła licznika; retry zachował ten sam klucz, oznaczył SENT i zwiększył licznik raz. Cloudflare D1, Resend, timeout i inbox nadal nieprzetestowane; restart lokalnego procesu po 503 pokrywa osobny dowód niżej. K31 pozostaje częściowe. [Dowód](program-audytu/evidence/k31-atomic-acceptance-2026-11-07/result.json).

**Restart procesu, 7 listopada:** osobny probe uruchomił rzeczywisty moduł Workera w dwóch kolejnych procesach Node, korzystających z tego samego trwałego pliku SQLite przez lokalny adapter zgodny z używanym zakresem D1. Pierwsza próba dostała provider HTTP 503 i pozostawiła recovery PENDING z attempts=1; po zakończeniu procesu i przekroczeniu backoff drugi proces podjął zdarzenie, wysłał ten sam klucz idempotencji i zapisał SENT z jednym zwiększeniem dziennego licznika. Celowany test jednostkowy **7/7 PASS**, składnia helpera PASS. Nie uruchomiono Cloudflare D1, Resend ani inboxu, więc K31 pozostaje częściowe. [Dowód i helper](program-audytu/evidence/k31-worker-restart-retry-2026-11-07.json).

<a id="k32"></a>

#### K32. Odtworzenie całego produktu wyłącznie z kopii poza hostem

**Ustalenia:** R12. **Rodzaj:** WERYFIKACJA I UZUPEŁNIENIE OCHRONY DANYCH. **Trudność:** L. **Pozycja proponowanego wykonania:** 35.

**Moduły:** backup.sh, restore-test.sh, verify-restored-database.ts, runbook, role/migracje DB, klucze/konfiguracja, własne R2 originals/HLS/thumbs i uzgodnienie płatności.

**Zmiana / wynik:** Najpierw inwentarz i zatwierdzone RPO/RTO per zasób. Zaplanować spójną kopię nieodtwarzalnych oryginałów i konfiguracji; HLS może być odtwarzany, jeśli mieści się w RTO. Zweryfikować rozdział klucza i kopii bez publikowania sekretów. Kolejne podkroki: specyfikacja, kopia syntetyczna, izolowany offsite-only drill, próba awarii. Zewnętrzne zasoby/budżet i operacje produkcyjne wymagają późniejszej odrębnej zgody.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K11](ROADMAPA-NAPRAW.md#k11), [K12](ROADMAPA-NAPRAW.md#k12), [K19](ROADMAPA-NAPRAW.md#k19), [K26](ROADMAPA-NAPRAW.md#k26), [K27](ROADMAPA-NAPRAW.md#k27). **Bramka:** Przed płatną/publiczną obsługą danych nieodtwarzalnych.

**Ryzyko regresji:** Wysokie: kompletność odzysku, tajemnice, retencja i koszty.

**Do weryfikacji przed zamknięciem:** Lokalny raw SQL restore wybranych danych działał; polityki chmury/role/media/Prisma/offsite i rzeczywiste RPO/RTO nie są dowiedzione. Dla profilu bez płatności K11/K12 nie są warunkiem próby, ale po ich włączeniu wymagany ponowny drill uzgodnienia.

**Inwentarz lokalny, 7 listopada 2026:** zapisano źródłowy spis DB, konfiguracji/sekretów, kodu/obrazów, R2 media, Cloudflare, płatności i Redis wraz z dowodami z repo oraz granicami istniejącego `restore-test.sh`. Potwierdza on brak offsite-only restore, niezmierzone RTO, niezweryfikowaną niezależną kopię klucza age i brak rutynowej kopii oryginałów/HLS/miniatur. Zawiera listę decyzji właściciela i brakujących testów, nie przypisuje samodzielnie wartości docelowych. [Inwentarz K32](program-audytu/K32-RECOVERY-INVENTORY.md).

**Lokalny syntetyczny acceptance, 7 listopada 2026:** jednorazowy PostgreSQL 17.11 uruchomiono na loopbackie z katalogami danych i scratch w tmpfs, co pozwoliło przeprowadzić test mimo pełnego Docker root. Narzędzie zastosowało **84/84 aktualne migracje Prisma**, wygenerowany klient Prisma zapisał syntetyczne relacje User–Creator–ChannelMember–Video–VideoAsset, a custom-format `pg_dump`/`pg_restore` odtworzył zgodny snapshot i historię migracji. Po restore Prisma odczytała relacje, a PostgreSQL odrzucił błędny FK i duplikat członkostwa: **7/7 kontroli PASS**. Dowód: [wynik acceptance](program-audytu/evidence/k32-synthetic-restore-tmpfs-final-2026-11-07.json); [narzędzie](program-audytu/tools/k32-synthetic-restore-acceptance.py). Wcześniejsze nieudane próby pozostają zachowane jako diagnostyka, nie są wynikiem końcowym. Ten test dotyczy wyłącznie syntetycznej lokalnej bazy; nie dowodzi odzyskania offsite, klucza, mediów/Support, konfiguracji, płatności ani RPO/RTO. K32 pozostaje częściowe.

**Testy odbioru:**

- **K32-T1** — Przy założonej utracie pierwotnego hosta odzyskać na czystych własnych zasobach konto, kanał, uprawnienia i odtwarzalny film z samej kopii offsite oraz niezależnie dostępnego klucza. Zweryfikować role, schemat/historię Prisma i spójność DB/storage.
- **K32-T2** — Zmierzony czas i utrata danych mieszczą się w zatwierdzonych RTO/RPO. Brak klucza, uszkodzona kopia lub brak oryginału dają jawną odmowę/niekompletność, nie SUCCESS.
- **K32-T3** — Po cofnięciu snapshotu test-mode płatności uzgadniają późniejsze zdarzenia bez ponownego obciążania i fałszywej utraty praw; kolejki i sesje po restore mają opisaną bezpieczną politykę.

<a id="k33"></a>

#### K33. Minimum kontroli rzeczywistych kosztów i retencji

**Ustalenia:** R06. **Rodzaj:** OGRANICZENIE RYZYKA I POMIAR. **Trudność:** M. **Pozycja proponowanego wykonania:** 32.

**Moduły:** Quota aktywnych originals, storage inventory/cleanup, metryki encodera, Worker/R2/cache/egress i budżety usług.

**Zmiana / wynik:** Oddzielić limit produktu od kosztu: fizyczne bytes originals/HLS/starych wersji, pending purge, żądania, CPU kodowania i oglądanie. Przed ruchem ustalić budżet, alarm i sposób ograniczenia wydatków; potem uzgodnić model z pomiarem/cennikiem/fakturą. Nie kasować aktywnych danych jako automatycznej reakcji budżetowej.

**Zależności:** [K05](ROADMAPA-NAPRAW.md#k05), [K13](ROADMAPA-NAPRAW.md#k13), [K19](ROADMAPA-NAPRAW.md#k19), [K30](ROADMAPA-NAPRAW.md#k30). **Bramka:** Minimum przed otwarciem; pełny model przed 10 tys. widzów.

**Ryzyko regresji:** Średnie: niezamierzone odcięcie oglądania lub kosztowny inventory.

**Do weryfikacji przed zamknięciem:** Obecny model jest warunkowy, nie dowodzi rachunku. 15 twórców to przybliżenie kilkunastu, 10000 to widzowie jednocześni, nie request/s.

**Testy odbioru:**

- **K33-T1** — Fixture aktywny/stary oryginał, HLS i nieudany cleanup są rozliczone w oddzielnych metrykach; nieudane usunięcie nie obniża fikcyjnie fizycznego storage.
- **K33-T2** — Kontrolowany próg uruchamia własny alarm i zatwierdzoną reakcję bez utraty aktywnych plików; model pokazuje osobno koszt widza/godziny i twórcy/uploadu oraz margines przy 10000 widzów. Nie ma deklaracji zgodności z fakturą bez rzeczywistego uzgodnienia.

<a id="k34"></a>

#### K34. Fokus dialogu również podczas busy

**Ustalenia:** R35. **Rodzaj:** NAPRAWA UX. **Trudność:** S. **Pozycja proponowanego wykonania:** 29.

**Moduły:** ConfirmDialog, wspólny prymityw modalny, busy/inert/focus restore i użycia usuwania playlist. app/components/studio/ConfirmDialog.tsx; components/ui/dialog.tsx.

**Zmiana / wynik:** Dodać bezpieczny cel fokusu przy zerze aktywnych przycisków i izolację tła. Ustalić Escape/cancel w trakcie operacji oraz ogłaszanie busy. Zachować zamrożony wygląd/intro/logo/zoom; nie zastępować całości UI bez potrzeby.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03). **Bramka:** Przed publicznymi krytycznymi zadaniami klawiaturą.

**Ryzyko regresji:** Niskie/średnie: Escape, fokus po zamknięciu i izolacja tła.

**Weryfikacja lokalna 7 listopada 2026:** komponentowy eksperyment Chromium 149 przeszedł 16 obserwacji. Pełny lokalny Studio DELETE na disposable PostgreSQL 17 po 84 migracjach przeszedł 1/1: kontrolowany błąd/retry, rzeczywisty DELETE, soft delete, jeden wpis audytu, containment klawiatury i Escape przed/w trakcie busy, fokus na opener lub głównym nagłówku po jego usunięciu. [Dowód](program-audytu/evidence/k34-studio-delete-2026-11-07/result.json). **Pozostaje przed zamknięciem:** pozostałe ścieżki dialogów, screen reader i niezależny review.

**Uzupełnienie 7 listopada 2026:** pełny Studio DELETE przeszedł także w Firefox 151 (1/1; [dowód](program-audytu/evidence/k34-studio-delete-firefox-2026-11-07/result.json)). Izolowany eksperyment komponentów przeszedł 16 obserwacji w Firefox, obejmując `ConfirmDialog`, `ReportDialog` i `DeleteCommentDialog` ([dowód](program-audytu/evidence/ux-browser-experiment-firefox-2026-11-07.json)). Dialog importu/zamiany rozdziałów z rzeczywistego `VideoChaptersEditor` przeszedł w Chromium 149 i Firefox 151: Escape zachowuje oryginalną listę, focus wraca do triggera, a potwierdzenie podmienia rozdziały; [Firefox](program-audytu/evidence/k34-chapters-import-firefox-2026-11-07.json), [Chromium](program-audytu/evidence/k34-chapters-import-chromium-2026-11-07.json). Nadal wymagane: odbiór screen readera i niezależny review.

**Weryfikacja historycznego R35, 7 listopada 2026:** ponowiono komponent `ConfirmDialog`/Base UI w Chromium 149 i Firefox 151, odczytując busy focus natychmiast (bez dwuklatkowego helpera): pięć kolejnych Tabów pozostało w panelu, Enter nie uruchomił syntetycznej akcji tła; 16 obserwacji PASS w każdej przeglądarce, bez błędów JS i żądań zewnętrznych. Historyczne `ux-browser-focus-fast.json` zachowano, bo jego harness/timing nie zostały odtworzone. [Chromium](program-audytu/evidence/k34-r35-current-chromium-retest-2026-11-07.json), [Firefox](program-audytu/evidence/k34-r35-current-firefox-retest-2026-11-07.json). To nie obejmuje screen readera, pełnego Studio shell ani niezależnego review; K34 pozostaje częściowe.

**Testy odbioru:**

- **K34-T1** — Przed busy i podczas dowolnie długiego busy Tab/Shift+Tab pozostają w dialogu, Enter nie uruchamia tła. Screen reader otrzymuje nazwę i stan oczekiwania.
- **K34-T2** — Sukces, błąd/retry, Escape według polityki i usunięty opener przywracają poprawny fokus; inne dialogi i legalna klawiatura nadal działają w docelowych przeglądarkach.

<a id="k35"></a>

#### K35. Mały zestaw pełnych podróży i granic odmowy

**Ustalenia:** R08. **Rodzaj:** WERYFIKACJA INTEGRACYJNA I E2E. **Trudność:** L. **Pozycja proponowanego wykonania:** 34.

**Moduły:** tests/e2e, Playwright, integracje HTTP/Prisma/storage/FFmpeg/workera, fixture i komendy quality.

**Zmiana / wynik:** Rozwijać od jednego krótkiego własnego filmu do macierzy: login→upload/resume→encode→publish→play→replace/delete; odmowy cudzej roli/kanału i awarie. Osobne profile płatności OFF/ON oraz twórców OFF/ON. To pakiet kolejnych małych scenariuszy, nie jednorazowy wielki PR. Testy każdej naprawy powstają już od K03; nie czekają na koniec K35.

**Zależności:** [K06](ROADMAPA-NAPRAW.md#k06), [K07](ROADMAPA-NAPRAW.md#k07), [K10](ROADMAPA-NAPRAW.md#k10), [K20](ROADMAPA-NAPRAW.md#k20), [K30](ROADMAPA-NAPRAW.md#k30), [K34](ROADMAPA-NAPRAW.md#k34). **Bramka:** Obowiązkowy odbiór każdego aktywowanego profilu.

**Ryzyko regresji:** Średnie: flaky testy lub pozorny sukces przez nadmiar atrap.

**Do weryfikacji przed zamknięciem:** Komponenty/Map i liczba testów nie dowodzą pełnych granic. Profile ON wymagają odpowiednich pakietów: płatności K11/K12/K28/K29, prywatność K26/K27, resume K22, moderacja K24; pominięcie nie oznacza PASS.

**Testy odbioru:**

- **K35-T1** — Rzeczywisty browser/API/DB/encoder/storage odtwarza manifest i segmenty, wykazuje postęp klatek/czasu własnego filmu, a późniejsza wymiana/usunięcie ma zgodne skutki. Brak segmentu lub zła odpowiedź musi zepsuć wynik.
- **K35-T2** — Dwie osoby/kanały: cudze odczyty i mutacje odmawiają bez skutku, legalna kontrola własnego zasobu działa. Crash/retry w krytycznej granicy nie gubi/nie dubluje efektu.
- **K35-T3** — Profil płatny używa tylko provider test-mode, podpisanego webhooka, replay/refundu/sporu i sprawdza sumę oraz realny dostęp do filmu. Raport exact SHA/digest rozlicza executed/failed/skipped/blocked, fixture sprzątnięte.

**Postęp lokalny, 7 listopada 2026 (K35-T1 częściowo):** corrected S3 fixture dekoduje `aws-chunked` z AWS SDK przed zapisem obiektu. Po pełnym Studio multipart uploadzie i FFmpeg test pobiera przez rzeczywisty `workers/hls-edge/worker.mjs` poprawne master/variant playlisty, init MP4 i fMP4 segment. Chromium odtwarza własny syntetyczny film do `currentTime > 0.5 s`, `readyState > 1`; PostgreSQL 17.11/84 migracje integration **1/1 PASS**, typecheck, ESLint i diff check PASS. [Aktualny dowód](program-audytu/evidence/k35-browser-hls-local-2026-11-07.json). Wcześniejszy [dowód edge](program-audytu/evidence/k35-edge-hls-local-2026-11-07.json) jest superseded dla zawartości payloadu: poprzedni fixture zwracał framing `aws-chunked`, a asercje były za słabe. Brak prawdziwego Cloudflare R2/deployed Worker, pełnej macierzy kanałów/roli, profilu płatnego i niezależnego review; podmianę v2 później potwierdzono osobno poniżej, K35 pozostaje częściowe.

**Uzupełnienie K35-T2, 7 listopada 2026:** do lokalnej macierzy dodano dwie prawdziwe sesje i dwa kanały. Obie osoby otrzymują 404 dla cudzych odczytów i startu uploadu; druga osoba nie może presignować części cudzego in-progress uploadu. Asercje potwierdzają brak oryginału i wywołań storage po odmowach oraz zachowanie `UPLOADING` po obcej próbie presign. Pozytywna kontrola właściciela przechodzi dalej przez upload, worker i edge playback. Integration PostgreSQL 17/84 migracje **1/1 PASS**, typecheck/ESLint/diff check PASS. [Dowód](program-audytu/evidence/k35-cross-channel-upload-2026-11-07.json). To częściowa macierz API, nie pełny browser/role/replace/delete/crash/retry ani Cloudflare; K35-T2 pozostaje otwarte.

### E6 — Dostępność, duże dane i udowodniona pojemność

<a id="k36"></a>

#### K36. Pełne zadania dostępności i świadoma decyzja o zoom

**Ustalenia:** R20. **Rodzaj:** WERYFIKACJA I DECYZJA PRODUKTOWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 36.

**Moduły:** ZADANIA-UZYTKOWNIKA/WCAG-POKRYCIE, rzeczywisty routing/player/formularze, viewport/ZoomLock, katalogi językowe.

**Zmiana / wynik:** Sprawdzić klawiaturę, screen reader, mobile/touch, zoom/reflow, reduced motion i błędy podczas rzeczywistych zadań. Zoom/intro/logo są świadomą zamrożoną decyzją właściciela: pokazać dowód wpływu i warianty, nie zmieniać samodzielnie. Krytyczne bariery muszą mieć naprawę lub jawną decyzję właściciela przed otwarciem danego profilu. Szersze badanie języków z użytkownikami/native speakers zaplanować osobno.

**Zależności:** [K05](ROADMAPA-NAPRAW.md#k05), [K34](ROADMAPA-NAPRAW.md#k34), [K35](ROADMAPA-NAPRAW.md#k35). **Bramka:** Krytyczne zadania przed otwarciem; szeroki UX później.

**Ryzyko regresji:** Średnie produktowo: konflikt z zamrożoną decyzją wizualną.

**Do weryfikacji przed zamknięciem:** Brak pełnego produktu/SR/WCAG; statyczne klucze i pozytywne testy komponentów nie są certyfikacją. R35 jest osobnym potwierdzonym błędem.

**Testy odbioru:**

- **K36-T1** — Widz i twórca kończą login, odtwarzanie, upload i obsługę błędu w zadeklarowanych przeglądarkach z klawiaturą/SR; kryteria zoom/reflow mają konkretne obserwacje i decyzję, nie ogólne PASS.
- **K36-T2** — Docelowe języki nie gubią informacji o pieniądzach/błędach/akcji. Brak zweryfikowanej wersji językowej jest jawny; zmiana zamrożonego wyglądu/zoom wymaga oddzielnej decyzji właściciela.

<a id="k37"></a>

#### K37. Eksport dużej historii w ograniczonym budżecie zasobów

**Ustalenia:** R16. **Rodzaj:** OPTYMALIZACJA WARUNKOWA. **Trudność:** M. **Pozycja proponowanego wykonania:** 37.

**Moduły:** Privacy export queries, zadanie DurableJob, paginacja/streaming, własne storage i wygasające pobranie. lib/modules/users/application/export-own-data.use-case.ts.

**Zmiana / wynik:** Zachowując kompletność K27, ograniczyć pamięć przez paginację/streaming albo małe zadanie async; zaprojektować spójność snapshotu, TTL, retry, odwołanie pobrania i purge. Mała beta może mieć udowodniony limit bezpiecznego zbioru; wtedy R16 nie jest zamknięte w zakresie skali.

**Zależności:** [K27](ROADMAPA-NAPRAW.md#k27), [K33](ROADMAPA-NAPRAW.md#k33). **Bramka:** Przed przekroczeniem zmierzonego bezpiecznego rozmiaru.

**Ryzyko regresji:** Średnie: paginacja, retry i ochrona pliku eksportu.

**Do weryfikacji przed zamknięciem:** Materializowanie historii jest potwierdzone, wyczerpanie pamięci produkcji nie. Najpierw uzgodnić i zmierzyć próg.

**Syntetyczny punkt odniesienia, 7 listopada 2026:** rzeczywisty `ExportOwnDataUseCase` i route-equivalent `JSON.stringify(data, null, 2)` uruchomiono w czterech odrębnych procesach Node z syntetycznymi delegate'ami Prisma. Dla każdej z czterech dużych kategorii (komentarze, view history, playback sessions, playback events) użyto 0/10k/50k/100k wierszy. Przy 100k na kategorię (400k łącznie) JSON miał 143,934,427 B (~137 MiB), serializacja/use case 4.14 s, a peak RSS procesu ~641 MiB; 50k na kategorię dało ~68.6 MiB i ~395 MiB peak RSS. To syntetyczny app-side baseline bez DB/network/Next/produkcji, nie profil konta ani zaakceptowany próg. Wyniki i ograniczenia: [K37 baseline](program-audytu/evidence/k37-export-memory-baseline-2026-11-07.json); reprodukcja: [probe](program-audytu/tools/k37-export-memory-probe.mjs). Nie podejmować paginacji/async ani nie deklarować limitu przed pomiarem DB i decyzją o progu.

**Pomiar PostgreSQL, 8 listopada 2026:** świeża baza PostgreSQL 17 po 84 migracjach, po 50k syntetycznych rekordów w każdej z czterech kategorii (200k razem). Rzeczywisty `ExportOwnDataUseCase` oraz dokładne `JSON.stringify(data, null, 2)` route'u wygenerowały 75,340,297 B w 5,450 ms; proces osiągnął peak RSS 1,002,229,760 B (~956 MiB). Cleanup potwierdził zero syntetycznych rekordów właściciela, kontener usunięto. [Dowód](program-audytu/evidence/k37-postgres-export-2026-11-08/result.json), [probe](program-audytu/tools/k37-postgres-export-probe.mjs). To jeden syntetyczny przebieg bez HTTP/Next, współbieżności i reprezentatywnego profilu. Wynik wskazuje istotny koszt pamięci dla tego rozmiaru danych, ale sam nie ustala progu produkcyjnego ani konieczności konkretnej architektury; najpierw trzeba uzgodnić budżet i profil. K37 pozostaje otwarte.

**Testy odbioru:**

- **K37-T1** — Duża własna historia o uzgodnionym rozmiarze eksportuje wszystkie kategorie/rekordy bez pominięć i duplikatów, przy zmierzonym limicie RAM/czasu. Zmiany w trakcie eksportu mają wynik zgodny z polityką snapshotu.
- **K37-T2** — Cudzy/wygasły/cofnięty link odmawia, retry nie produkuje nieograniczonych kopii, po TTL plik jest sprzątnięty także po chwilowej awarii magazynu.

<a id="k38"></a>

#### K38. Poprawny generator i odbiór pomiaru obciążenia

**Ustalenia:** R11. **Rodzaj:** NAPRAWA NARZĘDZIA POMIARU. **Trudność:** M. **Pozycja proponowanego wykonania:** 38.

**Moduły:** scripts/loadtest — summarizer/k6/workloads/cleanup; aktualny HMAC sesji i katalog testowych mediów.

**Zmiana / wynik:** Wymagać poprawnych statusów i treści, nie tylko rate/p95/5xx. Sprzątać własne sesje po aktualnej tożsamości, ograniczyć blast radius fixture. Wersjonować mix open/play/refresh/heartbeat, cold/warm cache, ramp i soak oraz SHA/digest. Osobno mierzyć zapotrzebowanie na encoder.

**Zależności:** [K03](ROADMAPA-NAPRAW.md#k03), [K33](ROADMAPA-NAPRAW.md#k33), [K35](ROADMAPA-NAPRAW.md#k35). **Bramka:** Przed każdym nowym twierdzeniem o pojemności.

**Ryzyko regresji:** Średnie: błędne wnioski o skali i pozostałości testowych sesji.

**Do weryfikacji przed zamknięciem:** Rzeczywisty summarizer przyjął syntetyczne unexpected statuses; stary test gości nie dowodzi aktualnych 10000 widzów.

**Testy odbioru:**

- **K38-T1** — Szybkie 500 nieoczekiwanych statusów przy dobrym p95/rate oraz 200 z niewłaściwą treścią muszą odrzucić raport; legalne odpowiedzi przechodzą. Powolne/5xx nadal odmawiają.
- **K38-T2** — Przerwane i poprawne wykonanie usuwa tylko oznaczone fixture/sesje HMAC; kontrolna cudza sesja pozostaje. Raport jasno przelicza widzów na żądania/profil czasu i nie myli request/s z jednoczesnymi osobami.

**Postęp lokalny 6 listopada 2026 (częściowy):** summarizer odrzuca metrykę nieoczekiwanego statusu, zły MIME odpowiedzi 200 i brak wymaganej metryki; runner kończy się niezerowym statusem dla niepoprawnego lub niekompletnego raportu. Nie wykonywano obciążenia ani cleanup na serwerze. Semantyczna zawartość małych JSON API została uzupełniona 7 listopada poniżej. Nadal brakuje semantycznego odczytu HTML/obrazu (body pozostają odrzucone dla limitu pamięci), wersjonowania profilu/mix oraz odbioru na rzeczywistym k6 i non-production; K38 pozostaje częściowy. [Pierwszy etap i hashe](program-audytu/evidence/k38-loadtest-summary-2026-11-06/result.json).

**Aktualizacja 6 listopada:** usunięto rozjazd między HMAC-SHA256 zapisywanym przez aplikację i plain SHA szukanym przez cleanup. Runner tworzy UUID identity w `OUT_DIR`, przekazuje ją jako UA i wyklucza dwa równoległe przebiegi w tym samym katalogu. `cleanup.sh` liczy hash przez Node wewnątrz app kontenera, nigdy nie odczytując/drukując klucza; wymaga zgodnej identity, odmawia przy aktywnym runnerze lub błędzie HMAC/DB i zachowuje identity do retry. 20 syntetycznych testów w tym symulacja poleceń Docker/SQL PASS; nie wykonano serwerowego cleanupu ani testu prawdziwej bazy. Semantyka JSON/HTML, pełny profil/mix, HMAC fixture w środowisku non-production i odbiór niezależny wciąż otwarte; pakiet częściowy.

**Aktualizacja 7 listopada — semantyka małych JSON API:** k6 ustawia `responseType: "text"` tylko dla sidebar, comments i media-source, mimo globalnego `discardResponseBodies: true`. Walidator sprawdza wymagane kształty (viewer/sekcje, komentarze/uprawnienia, gotowy playback plan z dozwolonym dostępem i źródłem); HTTP 200 z invalid JSON, błędnym kształtem, obiektem błędu lub nieodtwarzalnym planem zwiększa `unexpected_content`, które zatrzymuje serię. HTML strony i miniatury nadal nie są materializowane. Test kontraktu **30/30 PASS**, node/shell syntax, ESLint i diff check PASS. Nie uruchomiono k6 ani endpointu. [Dowód i hashe](program-audytu/evidence/k38-json-body-contract-2026-11-07.json).

**Runtime k6, 7 listopada 2026:** przypięty k6 v1.3.0 uruchomiono na jednorazowym serwerze syntetycznym `127.0.0.1` (po jednym żądaniu, bez aplikacji/DB Polutka). Poprawne comments JSON dało summarizer exit 0; odpowiedź 200 z MIME JSON i HTML body dała `unexpected_content=1` i exit 13. Szybkie HTTP 500 z dobrym p95/rate dało unexpected status=1, k6 exit 99 i summarizer exit 13; poprawne JSON opóźnione 2,2 s dało p95 2202 ms i exit 10 przy limicie 2000 ms. Pierwszy przebieg ujawnił, że executor `per-vu-iterations` nie emituje `dropped_iterations`; summary hook dopisuje teraz zero tylko dla stałej liczby iteracji, bez zmiany danych stałego arrival rate. Po poprawce oba przypadki runtime przechodzą oczekiwany kontrakt; celowany plik testów **31/31 PASS**, ESLint i składnia PASS. Archiwum k6 zweryfikowano SHA-256. Nie jest to pomiar obciążenia ani odbiór bazy/cleanup; K38 pozostaje częściowe. [Dowód](program-audytu/evidence/k38-k6-runtime-contract-2026-11-07.json).

**Wersjonowanie profilu, 7 listopada 2026:** `run-steps.sh` i `count-queries.sh` zapisują dla każdej serii osobny JSON profilu ze schematem/profil ID, targetem, rate schedule, długością kroku/przerwy, endpoint mixem, referencją obrazu k6 i SHA-256 wszystkich skryptów generatora/cleanup. Każdy wiersz wyników TSV oraz wynik w `queries.tsv` wiąże serię z hashem profilu; pomiar stałej liczby zapytań zapisuje dokładne N jako `fixed_request_count`, bez deklaracji throughput; istniejącego labela nie można nadpisać profilem innym; niezgodny stary TSV jest odrzucany. Metadane oznaczają podróż jako nowych gości/s (5 żądań/iterację), endpointy jako żądania/s oraz jawnie zapisują, że pomiar nie jest współbieżnością widzów, a label nie dowodzi stanu cache. Testy kontraktu **35/35 PASS**, Python compile, bash syntax, ESLint i diff check PASS. Nie uruchamiano serii obciążeniowej ani Docker/server runnera. To wersjonuje aktualny read-only workload; nie obejmuje jeszcze aktywnych odtworzeń/heartbeatów ani odrębnych cold/warm dowodów. [Dowód profilu](program-audytu/evidence/k38-load-profile-metadata-2026-11-07.json).

**Ograniczona semantyka strony home, 7 listopada 2026:** jednorazowy bounded probe wymaga teraz `text/html` oraz tytułu `www.pawelperfect.com` w prefiksie ≤64 KiB. Prawidłowy MIME/HTML z tytułem `Gateway error` odmawia zamiast przejść preflight. Test całego `tests/unit/scripts/loadtest-contract.test.ts`: **36/36 PASS**, ESLint, Python compile i diff check PASS; fixture jest loopbackowa, bez k6/DB/serwera/obciążenia. Body home nadal pozostaje odrzucane w mierzonych żądaniach, więc wynik zabezpiecza preflight, nie każde żądanie k6. [Dowód](program-audytu/evidence/k38-home-title-contract-2026-11-07.json); [probe](../../../scripts/loadtest/response-probe.py).

<a id="k39"></a>

#### K39. Pomiar celu 10 tys. widzów i plan wąskich usprawnień

**Ustalenia:** R10. **Rodzaj:** WERYFIKACJA POJEMNOŚCI — ZMIANY WARUNKOWE. **Trudność:** L. **Pozycja proponowanego wykonania:** 39.

**Moduły:** Topologia app/admin/DB/Redis/encoder/Worker/R2, max_connections/pule, claimNext, kolejki i metryki SLO.

**Zmiana / wynik:** Najpierw zatwierdzone workload/SLO i koszt na własnych reprezentatywnych zasobach. Zmierzyć ograniczenia; jeżeli cel nie jest spełniony, zaproponować osobne małe pakiety tylko dla wskazanych wąskich gardeł (np. pula/indeks/cache/separacja procesu). Nie wdrażać spekulacyjnych replik i nie zwiększać encoderów przed K17. Ten pakiet nie upoważnia do nieograniczonego skalowania ani refaktoru.

**Zależności:** [K17](ROADMAPA-NAPRAW.md#k17), [K19](ROADMAPA-NAPRAW.md#k19), [K30](ROADMAPA-NAPRAW.md#k30), [K33](ROADMAPA-NAPRAW.md#k33), [K38](ROADMAPA-NAPRAW.md#k38). **Bramka:** Przed deklaracją/otwarciem na 10000 peak viewers.

**Ryzyko regresji:** Wysokie dla kosztu i dostępności testu; architektura zmieniana dopiero po dowodzie.

**Do weryfikacji przed zamknięciem:** Jedno RUNNING i wspólny host są świadomą ochroną małej maszyny. Nie dowiedziono ani niezdolności, ani zdolności do 10000. PeerTube nie ma lokalnego benchmarku porównawczego.

**Testy odbioru:**

- **K39-T1** — Aktualny artefakt: reprezentatywny katalog i mix kilkunastu twórców/10000 jednoczesnych widzów w ramp/soak, cold/warm cache; p95/p99/błędy/start/rebuffer/połączenia DB/kolejka i koszt spełniają uprzednio wpisane liczby SLO.
- **K39-T2** — Utrata procesu/encoder load i powrót nie łamią integralności ani zatwierdzonej degradacji. Jeśli cel nieosiągnięty: wynik FAIL z pomiarem granicy, bez deklaracji skalowalności; osobny plan usprawnień do zatwierdzenia.

### E7 — Przyszły marketplace — warunkowo

<a id="k40"></a>

#### K40. Przyszły marketplace: tożsamość refundu i uzgodnienie operatora

**Ustalenia:** R17. **Rodzaj:** WARUNKOWE — PRZYSZŁA FUNKCJA. **Trudność:** L. **Pozycja proponowanego wykonania:** 40.

**Moduły:** Marketplace refund-order, adapter operatora, klucz idempotencji, trwały stan operacji, ledger/reconciliation. lib/modules/sales/application/sales.use-cases.ts; lib/platform-gates.ts.

**Zmiana / wynik:** Przed integracją sprzedaży wielu twórców: trwałe ID operacji, provider idempotency key i obsługa nieznanego wyniku po timeout, rozdzielenie żądania i zaksięgowania. Zaprojektować kontrakt i test adaptera; pełne zamówienia/payout/podatki/spory marketplace wymagają osobnego zakresu. Nie włączać marketplace w ramach napraw obecnych pakietów.

**Zależności:** [K11](ROADMAPA-NAPRAW.md#k11), [K12](ROADMAPA-NAPRAW.md#k12), [K35](ROADMAPA-NAPRAW.md#k35). **Bramka:** Tylko przed przyszłą sprzedażą marketplace.

**Ryzyko regresji:** Wysokie finansowo; aktywacja poza bieżącym zakresem.

**Do weryfikacji przed zamknięciem:** Dowód na fake providerze bez deduplikacji i sztucznie otwartej bramce sprzedaży, nie rzeczywisty podwójny refund dzisiejszej platformy.

**Testy odbioru:**

- **K40-T1** — Dwa równoległe refundy tego samego zamówienia oraz timeout po przyjęciu przez test-mode operatora skutkują jednym rozliczonym refudem; retry/uzgodnienie rozstrzyga unknown bez drugiej operacji.
- **K40-T2** — Odmowa operatora, częściowy refund, replay webhooka i crash po akceptacji mają trwałe uzgodnione stany. Marketplace pozostaje wyłączony do odrębnego odbioru całej funkcji; obecne tips/passes nie zależą od K40.

## 6. Braki dowodowe i wymagania bezpieczeństwa — nadal w zakresie celu

Nie tworzymy nowych ustaleń z samych niewiadomych. Otwarty punkt ma właściciela weryfikacji, warstwę testu i warunek rozstrzygnięcia. [Plan wdrożenia](PLAN-WDROZENIA-NAPRAW.md) opisuje ścieżki W01–W07 i moment wznowienia po decyzji właściciela.

### Wspólne luki dowodowe

- **ENV / Prisma**: wspierane pobranie silnika/klienta, rzeczywista historia migracji, aplikacja i niezależne procesy. Dotychczasowe raw SQL oraz atrapy klienta nie zastępują tego dowodu (K01/K03).
- **Pełne granice**: rzeczywiste HTTP/Server Actions z cookies/CSRF, role i przynależność kanału, efekty DB/storage; dotąd izolowane odmowy nie potwierdzają wszystkich wejść. Dla każdej odmowy kontrola legalna i brak skutku ubocznego (K08–K10/K20/K24–K29/K35).
- **Wymagania bezpieczeństwa**: 345 pozycji ASVS wymaga dalszej kwalifikacji i uzasadnienia stosowalności; 55 rozpoczętych nie jest zaliczonych. Priorytet po wznowieniu: aktywne publiczne wejścia, auth/admin/płatności/upload, walidacja/encoding, upload/URL/FFmpeg, sesje/CSRF, podpisy webhooków i tokenów, role/tenant oraz ochrona konfiguracji/logów. Każde wymaganie może dać PASS dopiero po wymaganym dowodzie; uzasadnione NIE_DOTYCZY nie jest PASS. Nie wywodzić potwierdzonego XSS/SSRF/DoS z samego braku testu.
- **Mapa 286 wejść**: 79 częściowo rozpoczętych, 207 nierozpoczętych. Zachować aktualność po zmianie tras/actions/workerów/timerów; dodatkowe wejścia dopisywać, nie sztucznie utrzymywać liczbę. Profile nieaktywne muszą mieć dowód wyłączenia na granicy, a nie tylko flagę w dokumentacji.
- **Płatności**: pełne test-mode webhook/refund/dispute, odwrócone kolejności, odtworzenie po crash i po backupie, uzgodnienie praw/sum; nigdy rzeczywiste obciążenie jako test. R17 pozostaje warunkowy do czasu marketplace.
- **HLS**: prawdziwy SDK/store i encoder, dwie próby/procesy, opóźnione I/O i fault injection wokół COMMIT. Sprawdzać pliki, trasę i faktyczne odtwarzanie, a nie tylko SUCCESS w DB.
- **Operacje i aktywna konfiguracja**: brak dowodu aktualnych flag, limitów proxy/brzegu, polityk R2/retencji, required checks, offsite/key ownership i faktycznego odbioru alarmu. Późniejsza weryfikacja ma wskazywać uprawnione własne środowisko i nie publikować sekretów.
- **SLO, koszty i UX**: brak dowodu 10000 widzów, realnego RTF/pojemności, całego RPO/RTO i uzgodnienia kosztu; brak pełnego SR/mobile/języków. Pomiar i jawne decyzje są częścią celu jakości, nie dodatkiem uznanym za gotowy.

### Niezakończone obszary D01–D18

Poniższa lista przenosi istotne braki z istniejącego DOMKNIECIE-DOWODOW.csv. Wszystkie pozostają otwarte; naprawa powiązanego R nie zamyka automatycznie całego obszaru.

| Obszar | Brakujący dowód / zakres | Przyszła weryfikacja i odbiór |
|---|---|---|
| D01 | Obietnice produktu i rzeczywista konfiguracja: P01-P22/F01-F14, kanały/patron/prywatność, aktywne flagi | Rozdzielić obecny produkt, plan i aktywne ustawienia; zatwierdzić oczekiwane wyniki podróży. Odbiór: Uzgodniona specyfikacja i brak sprzecznych aktualnych opisów |
| D02 | Granice modułów i kontrakty: Importy bez niepotrzebnej inicjalizacji; realny JSON UI/API | Przeprowadzić kontrakt HTTP i minimalny import w docelowym bundlerze, odróżnić dług od awarii. Odbiór: Konkretny kontrakt działa po obu stronach i ma negatywną kontrolę |
| D03 | Tożsamość i cofanie sesji: Pełne auth cookies/CSRF/rola/expiry przy awarii cache | Realne HTTP kont/sesji z DB i polityką fresh; kontrola braku dostępu. Odbiór: Cofnięcie/zmiana uprawnień działa zgodnie z wybraną polityką w czasie i między procesami |
| D04 | Izolacja kanałów i zasobów: Każde wejście i rola, także cudzy zasób i kanał zadania | Przejść macierz ról przez rzeczywiste trasy/actions i skutki DB. Odbiór: Odmowa bez efektu oraz poprawna kontrola własnego zasobu dla każdej grupy |
| D05 | Wejścia i zależności: Wymagania ASVS, limity przed parserem, pliki/URL/binarne zależności | Kwalifikować wymagania V1/V2 i konkretne wejścia; testować realny proxy/FFmpeg i negatywne przypadki. Odbiór: Rozmiar/typ/URL/metadane odrzucone we właściwej granicy; wersje advisory rozpatrzone |
| D06 | Schema, transakcje i migracje: SQL migracji/constraint/trigger i model Prisma jako całość | Uruchomić rzeczywisty klient i kontrakty zapisu, błędy migracji oraz spójność DB/storage. Odbiór: Niezgodny zapis odrzucony, poprawny działa, rollback i historia migracji udokumentowane |
| D07 | Powtórzenia, wyścigi i outbox: Commit/rollback, stare zadanie, requeue, API retry, dostarczenie | Odnieść eksperymenty R02-R29 do rzeczywistych procesów/DB; wymusić granice awarii. Odbiór: Brak nieuprawnionej ponownej aktywacji, utraty/out-of-order side effect; cleanup kontrolowany |
| D08 | Własny film od uploadu do publikacji: Prawdziwe HTTP -> magazyn -> encoder -> finalizer, resume/cancel/delete | Krótki syntetyczny film, dwa kanały i wymiana oryginału; przerwane oraz stare wykonanie. Odbiór: Manifest/segmenty i stan zgodne, aktywny wynik nie znika, wznowienie i usunięcie kompletne |
| D09 | Dostęp i faktyczne odtwarzanie: Manifest/segment/cache/range/token po zmianie dostępu | Pełny Worker/API/browser na własnym filmie, cofnięcie uprawnień i premiera. Odbiór: Brak nieuprawnionej treści/metadanych; właściwa odmowa i postęp klatek/czasu |
| D10 | Płatności i pakiety: Test-mode webhook/retry/refund/dispute/nowy zakup/suma/grant | Test-mode provider i realne DB: wersje zdarzeń, przekroje zakupów, race i awaria audytu. Odbiór: Właściwa suma/uprawnienie, brak niepożądanej utraty/duplikatu, bez realnych obciążeń |
| D11 | Moderacja i nadużycia: Realne role, odwołanie po nowej decyzji i limity nadużyć | HTTP i DB zgłoszeń/banów/appeal z kontrolą starych decyzji i cudzych zasobów. Odbiór: Uprawnione działanie działa, opóźnione odwołanie nie cofa nowszej decyzji |
| D12 | Prywatność i cykl danych: Eksport/usunięcie/retencja wszystkich kategorii i usług | Pełny cykl syntetycznej osoby, DB i własne storage/provider sandbox, kontrola ponowień. Odbiór: Dane i publiczny profil zgodne ze specyfikacją, eksport kompletny i ograniczony |
| D13 | Wydajność i pojemność: Mieszany ruch, percentyle, nasycenie, awaria procesów | Aktualny artefakt i reprezentatywny katalog, ramp/soak, cold/warm cache, encoder osobno. Odbiór: Uzgodnione SLO i granice potwierdzone przy 10000 peak viewers lub mniejszym wybranym progu |
| D14 | Koszty i limity: Rzeczywiste CPU/egress/cache/retencja/faktury vs model | Zmierzyć jednostki kosztu prób reprezentatywnych i alarmy budżetu. Odbiór: Model zgodny z pomiarem i limitami usług; liczba widzów nie mylona z request/s |
| D15 | Pełne zadania i dostępność: Rzeczywisty routing/provider/player/mobile/SR/WCAG/języki | Zadania widza/twórcy z błędami, klawiaturą, screen readerem, zoom/reflow i docelowymi przeglądarkami. Odbiór: Każde kryterium w określonym zakresie ma dowód lub uzasadnione wyłączenie |
| D16 | Wykrycie i obsługa awarii: Cała ścieżka sygnał -> alarm -> odbiór -> recovery | Izolowane awarie DB/HLS/encoder/provider, świeżość QoE, logi, adresat i ćwiczenie reakcji. Odbiór: Zmierzony czas wykrycia/reakcji, ponowienia i brak zagubionego recovery |
| D17 | Wydanie i odzyskanie produktu: Gates/digest/schemat/offsite/role/klucz/media/RPO/RTO | Zweryfikować dokładny artefakt i izolowane odtworzenie z samej kopii poza hostem. Odbiór: Działający odzyskany produkt z własnymi mediami i bezpiecznym uzgodnieniem danych |
| D18 | Wiarygodne kryterium testów i domknięcie: Wykonane vs pominięte, oracles, regresje wszystkich ustaleń, pokrycie zakresu | Zdefiniować macierz dowodów, uzupełnić braki, niezależnie podważyć ważne ustalenia i retestować po naprawach. Odbiór: Wszystkie zakresy ocenione/wyłączone z powodem, wymagane próby wykonane; brak pustych pass |

## 7. Co musi być gotowe przed poszczególnymi uruchomieniami

To plan warunków, **nie zgoda na start ani certyfikat bezpieczeństwa**. Obowiązują istniejące [bramki gotowości](program-audytu/BRAMKI-GOTOWOSCI.csv), doprecyzowane poniżej. Brak liczbowego SLO lub wyniku obowiązkowego testu oznacza BLOCKED. Wyłączenie funkcji pozwala odroczyć jej specyficzny pakiet tylko przy dowodzie odmowy we wszystkich wejściach i odnotowaniu ryzyka. Nie wymaga się pełnego marketplace i wszystkich 345 ASVS do każdej ograniczonej bety.

| Profil / bramka | Warunki niezbędne | Co pozostaje osobno |
|---|---|---|
| **B — ograniczona beta bez płatności** | K01–K03/K05/K06; K02 usuwa pilne ryzyko zależności. Rzeczywiste testy wybranych ról/wejść i ścieżki wideo; K07/K10 oraz K13–K20 dla aktywnego uploadu/publikacji. Prywatność i uprawnienia aktywnego profilu, odzysk własnego filmu, monitoring i ograniczenie kosztów. Brak znanego ryzyka usunięcia aktywnych plików. | Płatności, otwarte kanały i marketplace mogą pozostać wyłączone. To nie deklaracja 10000 widzów. Lokalny eksperyment badawczy nie jest betą produktu. |
| **P — obecne darowizny/pakiety i refundy** | Wspólny bezpieczny fundament i wideo; K08/K11/K12, polityka i testy K28/K29, test-mode pełny zakup/webhook/refund/dispute K35, release K06, monitoring K30/K31, odzyskanie i uzgodnienie praw K32 oraz minimum kosztowe K33. Dla profilu tylko darowizn K11 może być odroczone wyłącznie po dowodzie, że nie ma żadnej aktywnej ścieżki płatnego uprawnienia; wspólna obsługa sum K12 nadal obowiązuje. | K40 nie jest wymagane. Historyczne prawa/sumy wymagają bezpiecznego planu migracji i osobno zatwierdzonej ewentualnej korekty. |
| **O — otwarcie dla wielu twórców i widzów** | Warunki aktywnych funkcji z B/P; K09 kontroluje awarię auth; K20 właściwy kanał, K24/K25 moderacja/limity, K26/K27 prywatność i kompletny eksport, K21/K22 obiecany odporny upload, K23 niezawodne ogłoszenia. K28/K29 mają zatwierdzone okna cofania. K30–K35 operacje i pełne podróże; K34 oraz krytyczne zadania K36 przed publicznym profilem. | Szerokie usprawnienia UX i native language review etapami, K37 po zmierzonym progu dużych danych. Zamrożony zoom wymaga decyzji właściciela, nie cichej zmiany. |
| **S — deklaracja 10000 jednoczesnych widzów** | Poprzednie warunki właściwego profilu oraz K38/K39: aktualny workload, poprawne statusy/treści, ramp/soak, liczby SLO, połączenia/kolejka, awaria/recovery i pomiar kosztu K33. K37 jeśli zbiór przekracza bezpieczny próg. | Bez pomiaru można zatwierdzić tylko odrębną mniejszą skalę z limitami; nie przedstawiać jej jako dowodu celu 10000. |
| **F — przyszły marketplace** | Oddzielna decyzja biznesowa; K40 i osobny zakres zamówień, wypłat, odpowiedzialności, podatków/sporów. Test-mode idempotencji i unknown reconciliation. | Gotowe tips/passes i naprawione R31/R32 nie certyfikują marketplace. |

Potwierdzone błędy aktywnego profilu trzeba naprawić albo bezpiecznie wyłączyć ich ścieżkę. Dla ryzyk i decyzji dopuszczalny jest udokumentowany wybór właściciela, poparty pomiarem i konkretnym zakresem. Nie wolno oznaczyć nieudanego obowiązkowego testu jako PASS przez taką decyzję.

## 8. Co zachować i czego nie przepisywać

Zachować modularny monolit, działające reguły autoryzacji, SQL/DurableJob i istniejące wzorce outbox, silnik multipart panelu, oddzielony encoder i dostawę HLS przez Worker/R2, tanie jednostkowe testy oraz prawdziwe testy PostgreSQL/FFmpeg. Zmiany mają wzmacniać atomowość i kontrakty istniejących elementów. Nie ma dowodu uzasadniającego migrację na stos PeerTube, mikroserwisy, P2P lub federację w ramach napraw.

PeerTube pozostaje użyteczną referencją testów pełnego filmu, wspólnego uploadu, obserwowalności i dyscypliny wydania, z ograniczeniami opisanymi w raportach. Porównywać konkretne gwarancje i testy. Własna implementacja wzorca nie wymaga kopiowania całego subsystemu; przed ewentualnym kopiowaniem kodu osobno sprawdzić licencję AGPL i obowiązki. Żadnego kodu PeerTube nie skopiowano w tym planie.

## 9. Wynik i następna decyzja

Następny krok to **zatwierdzenie roadmapy v1 oraz proponowanego harmonogramu W01–W07/H0–H6** z [PLAN-WDROZENIA-NAPRAW.md](PLAN-WDROZENIA-NAPRAW.md). Do tego czasu audyt jest tymczasowo wstrzymany i nie rozpoczynamy napraw. Zatwierdzenie planu nie oznacza zgody na produkcyjne migracje, zmiany danych, koszty zewnętrznych zasobów, wdrożenie ani scalanie.

**Uzupełnienie K35-T2 — granica complete, 7 listopada 2026:** test dwóch kanałów próbuje zakończyć multipart upload drugiego właściciela w obu kierunkach. Oba żądania zwracają 404 bez ujawnienia obcego `originalId` ani żądania do storage; oryginały pozostają `UPLOADING`. PostgreSQL 17.11/84 migracje: integration **1/1 PASS**, typecheck, celowany ESLint i diff check PASS. [Dowód i SHA](program-audytu/evidence/k35-cross-channel-complete-2026-11-07.json). K35-T2 pozostaje częściowe; pełna macierz ról/stanów, replace/delete, awarie, rzeczywiste R2 i niezależny review są otwarte.

**Uzupełnienie K35-T2 — retry complete, 7 listopada 2026:** acceptance powtarza identyczne żądanie Studio `complete` po zatwierdzeniu pierwszego. Powtórzenie zwraca ten sam job, nie wywołuje storage, utrzymuje `READY` i dokładnie jeden job kodowania. Disposable PostgreSQL 17.11/84 migracje: integration **1/1 PASS**, typecheck, celowany ESLint i diff check PASS. [Dowód i SHA](program-audytu/evidence/k35-complete-retry-2026-11-07.json). To dowodzi idempotencji retry po sukcesie, nie awarii w każdej pośredniej granicy; K35-T2 zostaje częściowe.

**Uzupełnienie K35-T1 — wymiana oryginału, 7 listopada 2026:** po pełnym upload/worker/browser playback v1 acceptance wykonuje drugi Studio multipart upload i kodowanie v2. `VideoOriginal` v1 przechodzi do `SUPERSEDED`, v2 do `READY`, wskaźnik aktywnego oryginału i jedyna aktywna trasa HLS wskazują v2 z właściwym `attemptId`; pipeline Studio zwraca wersję 2. PostgreSQL 17.11/84 migracje: integration **1/1 PASS**, typecheck, ESLint i diff check PASS. [Dowód i SHA](program-audytu/evidence/k35-original-replacement-local-2026-11-07.json). Późniejszy [odbiór Chromium v2 i delete cleanup](program-audytu/evidence/k35-browser-replacement-v2-2026-11-07.json) potwierdza playback po wymianie oraz usunięcie fixture; Cloudflare R2/deployed Worker, pełna macierz i niezależny review pozostają otwarte.

**Uzupełnienie K35-T1 — usunięcie filmu i cleanup, 7 listopada 2026:** Studio DELETE usuwa wiersze filmu/oryginałów/assetów/tras, a atomowo zapisany manifest STORAGE_CLEANUP zawiera dwa HLS assety i dwa oryginały. Lokalny durable runner kończy job jako `DONE`, po czym fixture nie ma już obiektów tych kluczy. PostgreSQL 17.11/84 migracje: integration **1/1 PASS**, typecheck, ESLint i diff check PASS. [Dowód i SHA](program-audytu/evidence/k35-studio-delete-cleanup-2026-11-07.json). R2/deployed Worker, odtworzenie v2 w przeglądarce, pełna macierz K35 i niezależny review pozostają otwarte.

**Uzupełnienie K35-T1 — Chromium po wymianie i cleanup, 7 listopada 2026:** browser odtwarza pierwszy upload, po podmianie odtwarza v2 ponad 0,5 s przez podpisaną trasę `v2~<attemptId>`, pobierając master i fMP4 segment przez lokalny HLS Worker. Następujący Studio DELETE usuwa manifest, oryginały i HLS obiekty z loopback fixture; durable job `STORAGE_CLEANUP` ma status `DONE`. PostgreSQL 17.11/84 migracje: integration **1/1 PASS**, repo typecheck, ESLint i diff check PASS. [Dowód i SHA](program-audytu/evidence/k35-browser-replacement-v2-2026-11-07.json). Rzeczywiste R2/deployed Worker, wszystkie role/stany, profile płatne, awarie i niezależny review pozostają otwarte.

**Uzupełnienie K35-T2 — recovery po utracie odpowiedzi storage, 7 listopada 2026:** stan fixture odwzorowuje sukces `CompleteMultipartUpload` po stronie storage przy utraconej odpowiedzi i braku zmiany DB. Ponowione Studio `complete` dostaje `NoSuchUpload`, ale odnajduje i weryfikuje istniejący obiekt; oryginał staje się `READY`, powstaje jeden job i prawdziwy lokalny worker kończy go `SUCCEEDED`. PostgreSQL 17.11/84 migracje, integration **1/1 PASS**, typecheck/ESLint/diff check PASS. [Dowód i SHA](program-audytu/evidence/k35-lost-complete-response-recovery-2026-11-07.json). To nie jest fault injection sieci R2; kolejne granice, role, R2/deployed Worker i review pozostają otwarte.

**Uzupełnienie K35-T2 — DB rollback po storage commit, 7 listopada 2026:** pełny multipart trafia do loopback storage; jednorazowy trigger PostgreSQL powoduje błąd w transakcji promocji. Pierwsza odpowiedź Studio to 500, baza cofa się do `UPLOADING`, job nie istnieje, ale oryginalny obiekt pozostał. Retry otrzymuje `NoSuchUpload`, weryfikuje istniejący obiekt, kończy upload i dodaje job; `scripts/video-worker.ts` koduje go do `SUCCEEDED`. PostgreSQL 17.11/84 migracje: integration **1/1 PASS**, typecheck, celowany ESLint i diff check PASS. [Dowód i SHA](program-audytu/evidence/k35-storage-commit-db-rollback-retry-2026-11-07.json). Kontrolowany rollback DB nie zastępuje awarii procesu, prawdziwego R2, pozostałych ról/stanów ani niezależnego review.

**Uzupełnienie K35-T2 — resume/abort odmowy, 7 listopada 2026:** właściciele A/B próbują w obie strony odczytać części uploadu (`GET`) i anulować (`DELETE`) cudzy in-progress original. Cztery odpowiedzi 404 nie ujawniają zasobu, nie wywołują storage i nie zmieniają `UPLOADING`. PostgreSQL 17.11/84 migracje: integration **1/1 PASS**, typecheck, ESLint i diff check PASS. [Dowód i SHA](program-audytu/evidence/k35-cross-channel-resume-abort-2026-11-07.json). Pozostałe role/stany, profile K35-T3, R2/deployed Worker i niezależny review nadal otwarte.
