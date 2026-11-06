# Historia programu badania

## 6 listopada 2026 — K20/R23: właściwy kanał automatycznej publikacji

- Worker ponownie odczytuje aktualny job z tokenem próby i relację do filmu; `video.creatorId` jest źródłem kontekstu kanału, a rozbieżny `job.channelId` blokuje publikację. Auto-publish zwraca jawny wynik i worker go loguje; publikacja nadal idzie przez autoryzowane use case'y.
- Dwa celowane pliki testów: **24/24 PASS**, ESLint i repo typecheck PASS. Przygotowano siedmioprzypadkowy test PostgreSQL finalizera (typy i lint PASS), ale brak `DATABASE_URL`, więc nie wykonano go ani pełnego workera; K20 pozostaje częściowe. [Dowody](evidence/k20-channel-auto-publish-2026-11-06/).

## 6 listopada 2026 — K19/R29: rezerwacja aktywacji i cleanupu HLS

- Asset otrzymuje `cleanupPendingAt` pod blokadą wiersza filmu współdzieloną z aktywacją. Transakcja wyłącza aktywną trasę szkicu, zapisuje audyt i kolejkuje `VIDEO_ASSET_CLEANUP`; trigger DB blokuje też stare klienty. Runner wykonuje idempotentne DeleteObjects poza transakcją i kasuje wiersz dopiero po potwierdzeniu storage.
- PostgreSQL 17 + 83 migracje: K19 **4/4**, regresje K17/K18 **8/8 razem**; unit **48/48**, ESLint/typecheck/Prisma validate PASS. Fake R2, bez drainu i niezależnego przeglądu; K19 częściowe. Dowody: `evidence/k19-activation-cleanup-2026-11-06/`.
- Kod: `b8921135` (`fix(video): reserve HLS cleanup before deletion`).

## 6 listopada 2026 — K18/R28: bezpieczny wynik finalizacji HLS

- Obowiązkowy audyt zmiany trasy jest teraz w tej samej transakcji co jej aktywacja. Finalizer uzgadnia utracone potwierdzenie COMMIT; przy niedostępnej bazie proces zachowuje output HLS i przechodzi do retry. Ponowienie potwierdza obecność mastera, zagnieżdżonych playlist, URI z tagów i segmentów przed sukcesem.
- PostgreSQL 17 po 82 migracjach: integracja K18+K17 **4/4**; unit **52/52**; ESLint i typecheck PASS. Bez fizycznego R2 i dwóch niezależnych workerów; K18 częściowe. Dowody: `evidence/k18-finalizer-audit-2026-11-06/`.
- Kod: `dcfe8dde` (`fix(video): make HLS finalization recoverable`).

## 6 listopada 2026 — K17/R02: fencing po przejęciu próby

- Commit `f85504f3`: aktywacja route blokuje i weryfikuje aktualny token próby w transakcji; postęp, statusy terminalne/retry, anulowanie i release także porównują `attemptId`. Aktywne assety z prefiksu dowolnej próby tej generacji można odzyskać po przerwaniu.
- RED na PostgreSQL odtworzył, że A po finalizacji B podmienił trasę. Po poprawce K17 i repo PostgreSQL 17: **12/12 PASS**, unit **34/34**, ESLint i typecheck PASS.
- Odbiór używa kontrolowanej sekwencji, nie dwóch żywych workerów; brak fizycznego R2 i drugiego przeglądu. K17 częściowe; K18 sprawdza post-COMMIT i awarię audytu. Dowody: `evidence/k17-stale-worker-fencing-2026-11-06/`.

## 6 listopada 2026 — K16/R02: odrębne prefiksy prób kodowania

- Commit `6975a492`: claim nadaje UUID próby; proces, lokalny katalog roboczy, HLS output, finalizer, logi i cleanup przenoszą tę samą tożsamość. Dodatkowa migracja blokuje stare claimy bez `attemptId`, ale pozwala już działającemu legacy jobowi kontynuować heartbeat.
- PostgreSQL 17 z kompletem 82 migracji: stary claim odrzucony; dwie próby dostały rozłączne UUID/prefiksy; wygasły legacy job został odzyskany z nowym ID bez zmiany `activeOriginalId`. Integracja 1/1, testy unit 53/53, ESLint, Prisma validate i typecheck PASS.
- K16 pozostaje częściowe: nie wykonano kontrolowanego wygaszenia workerów w środowisku ani odbioru R2 i drugiego przeglądu; K17 musi jeszcze odgrodzić skutki starego ownera. Dowody: `evidence/k16-attempt-isolation-2026-11-06/`.

## 6 listopada 2026 — K15/R27: monotoniczne ukończenie wersji oryginału

- Commit `05c2b44d`: wspólna transakcyjna blokada per video, świeży odczyt statusu/wersji i CAS; aktywacja wskaźnika oraz utworzenie joba są atomowe. Spóźniony retry nie może reaktywować zastąpionej wersji; retry READY naprawia brakujący job tylko dla nadal zwycięskiej wersji.
- Regresja RED odtworzyła cofnięcie wskaźnika. Test endpointu Studio na PostgreSQL 17: **3/3 PASS**, testy jednostkowe **28/28 PASS**, ESLint i repo typecheck PASS.
- R2 i sesja były kontrolowane; brak sandboxa R2/S3, niezależnego przeglądu i pełnego buildu. K15 częściowe, otwarte. Dowody: `evidence/k15-monotonic-original-2026-11-06/`.

## 6 listopada 2026 — K14/R03: zakończenie rozpoczętych uploadów przed cleanup

- `e55f1f1c`: po pierwszym błędzie pula uploadów nie przydziela dalszych plików, sygnał anuluje rozpoczęte PUT, a proces czeka na ich ustanie przed cleanup. Sygnał transferu oddzielono od sygnału anulowania joba, zachowując retry po błędach sieciowych.
- Test regresyjny RED potwierdził wcześniejszy cleanup przed zakończeniem opóźnionego PUT. Po zmianie dwa pliki testów przeszły 23/23; ESLint i repo typecheck PASS.
- Brak sandboxa Cloudflare R2/S3, niezależnego przeglądu i pomiaru zachowania providerowego abort. K14 pozostaje częściowe, K16 wymaga osobnego odbioru. Dowody: `evidence/k14-upload-cleanup-2026-11-06/`.

## 6 listopada 2026 — K13/R04: per-object błędy usuwania R2

- RED: HTTP 200 z `AccessDenied` był ignorowany, a licznik zgłaszał wszystkie żądane klucze; `SlowDown` nie uruchamiał ponowienia.
- `HlsWriter.deletePrefix()` używa odpowiedzi per obiekt, liczy tylko potwierdzone `Deleted`, ponawia przejściowe błędy wyłącznie dla nieudanych kluczy (maks. 3 próby), uznaje `NoSuchKey` za idempotentne i rzuca `R2DeleteObjectsError` dla trwałych/wyczerpanych błędów. 2 pliki testów 14/14 PASS, ESLint i typecheck PASS.
- K13 pozostaje częściowe: nie wykonano Cloudflare R2/S3 sandbox ani drugiego przeglądu R04. [Dowody](evidence/k13-r2-delete-2026-11-06/result.json).

## 6 listopada 2026 — K10/R30: ukryta przyszła premiera

- Czerwony test odtworzył ujawnienie: gość dostawał `LOGIN_REQUIRED`, zalogowany obcy `COMING_SOON` dla filmu `REMOVED`; tytuł i termin przechodziły do planu.
- `PlaybackService` rozstrzyga teraz `NOT_FOUND` przed bramką premiery. Trzy celowane pliki testów 18/18 PASS; ESLint, typecheck repo i publiczny build PASS. Legalna premiera nadal przechodzi dotychczasową ścieżkę. [Dowody](evidence/k10-hidden-premiere-2026-11-06/result.json).
- Brak testu rzeczywistego HTTP z macierzą ról/sesji; K10 pozostaje częściowe.

## 6 listopada 2026 — K07: pamięć czytnika body

- Kontynuacja zapisana commitami `c3c2c6c1` i `1f467577`: kompletny multipart ma limit 6 MiB (10 000 części zajmuje 4 299 010 B w skrajnym legalnym payloadzie), a Next proxy ma jawny bufor 7 MiB. Powód: domyślny bufor Next 16.4.5 wynosi 10 MiB i przy nadmiarze może przekazać trasie obcięte body.
- Lokalny test regresyjny odtworzył błędne 303 dla 13 MiB+1 przy tymczasowym limicie aplikacji 13 MiB, następnie 413 przy limicie 6 MiB. Zoptymalizowany lokalny Next z konfiguracją 7 MiB również zwrócił 413. 9 plików testów 111/111 PASS, typecheck, ESLint i public/admin build PASS.
- Node-only benchmark 16 żądań 6 MiB+1: 16/16 413; pojedyncza para pomiarów RSS +137 420 800 → +127 262 720 B i czasu 578 → 286 ms. Zewnętrzny proxy i współbieżność przez pełny Next niezweryfikowane; K07 pozostaje otwarte.
- Lokalna zoptymalizowana instancja Next 16.4.5 z tymczasową fixture trasą odebrała 16 równoległych chunked body 6 MiB+1 B bez `Content-Length`: **16/16 odpowiedzi 413**, RSS procesu +136 695 808 B, 1 398 ms. [Surowy wynik](evidence/k07-body-limits-2026-11-06/next-concurrent-6mb.json). Fixture usunięto; zewnętrzny Cloudflare Tunnel pozostaje niezmierzony, więc K07 jest otwarte.

- Commit `3dc8fb29` zastępuje bufor z wielokrotnym realokowaniem porcjami stałych slabów 64 KiB; dodano regresję przekraczającą granicę slaba. 9 plików testów: 111/111 PASS; repo typecheck, lint zmienionych plików i `git diff --check` PASS.
- Odtwarzalny benchmark Node-only dla 16 równoległych chunked multipart żądań +1 byte powyżej limitu 13 MiB: 16/16 odpowiedzi 413. Jedna para pomiarów: przyrost RSS 261 791 744 → 246 124 544 B, czas 951 → 500 ms. Równoległy test HTTP lokalnego Next 16.4.5 na trasie 16 KiB zwrócił 16/16 odpowiedzi 413 w 1,091 ms. Build publiczny/admin PASS po zmianie. Pomiar HTTP nie obciąża trasy 13 MiB; Node-only benchmark nie obejmuje Next, Cloudflare ani proxy.
- K07 nadal otwarte. Konfiguracji Cloudflare Tunnel nie ma w repo; nie zmierzono dużych body przez Next/proxy. Harness i surowe wyniki: `program-audytu/tools/k07-body-memory-benchmark.mjs` oraz `program-audytu/evidence/k07-body-limits-2026-11-06/`.

## 6 listopada 2026 — wznowienie roadmapy i aktualizacja bazy

- Na polecenie właściciela wznowiono pełną roadmapę po wcześniejszym STOP. Gałąź audytu lokalnie scalono z `origin/main` (`e2d33e0e`) commitem `7e6f5335`, aby naprawy odnosiły się do aktualnego kodu.
- Pełne `npm run quality` na scalonym drzewie: architektura/typecheck PASS, Vitest 564 pliki PASS/1 skipped i 4980 testów PASS/2 skipped, exit 0. Nie jest to zamknięcie pakietu ani wydania.
- Następny zakres: wznowienie K06 i sprawdzenie wszystkich konsumentów wydania przed dalszymi pakietami. K02 ma poprawiony zakres Next, ale nadal wymaga świeżego dowodu zależności/obrazu.

## 6 listopada 2026 — K06: pierwsza ścieżka GHCR

- `images.yml` zastępuje bezpośrednie build/push pełnym producentem, weryfikacją przed logowaniem oraz publikacją pięciu ID i kontroli registry digestów. Dodano walidowany generator publicznych inputs oraz przypięte manifesty amd64.
- Testy helperów/workflow 6/6, typy, lint i parsowanie YAML PASS; digesty sprawdzone w registry. Nie uruchamiano Actions ani publikacji. Deploy, migrator, admin i rollback nadal wymagają proof verification.

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

## 1 listopada 2026 — partia 13: UX, dostępność i języki

Zapis domknięty 2 listopada: pierwszą walidację zatrzymał przed wykonaniem limit usługi approval review. Po odnowieniu i poleceniu kontynuacji zatwierdzona kontrola przeszła; nie powtarzano testów aplikacji/Chromium i nie obchodzono bramki.

- Rozpoczęto D15: częściowy zakres 59 plików (w tym zliczane katalogi), 12 zadań, 14 scenariuszy komponentów, 15 wybranych kryteriów WCAG bez pełnego werdyktu i osiem języków. Brak certyfikacji lub uznania pełnych zadań za wykonane.
- Prawdziwy Chromium na lokalnej stronie niezmienionych komponentów i CSS; 14 obserwacji finalnie exit 0. Bez rzeczywistego API/auth/Next/Prisma/Stripe/HLS, zewnętrznych żądań i danych osób.
- Nowy R35: podczas busy ConfirmDialog Tab trafia do tła, Enter aktywuje syntetyczną akcję przy otwartym modalu. Potwierdzono również poprawne kontrole normalnego fokusu/Escape/restore. P2 UX, nie auth bypass; niezależny przegląd PENDING.
- ReportDialog zachowuje notatkę po awarii i pokazuje alert; Base UI utrzymuje ustalony fokus i Escape. Radio ma rozbieżność APG, lecz Tab/Space działa. Języki wspierają Home/End/type-ahead/Enter/Escape; 320 px sprawdzono tylko dla komponentu.
- 62/62 istniejących assertions w siedmiu plikach passed, exit 0 podzbioru. Pomiar 1589 tx/txRich w 144 plikach, 1245 kluczy i kompletnych sześciu katalogów dla tego zakresu; 20 wielowariantowych PL/EN kluczy do kontekstowej oceny, nie nowe błędy. Bez native review.
- R20 doprecyzowane jako jawny kompromis zoom/viewport; zamrożony wygląd/intro/logo bez zmian. Osiem języków UI nie oznacza treści, napisów, e-maili i legal w ośmiu językach.
- Zachowano logi błędów własnego harnessu i szybkich pomiarów fokusu; finalny pomiar po dwóch klatkach, brak nowej podatności Base UI. Nie zmieniano aplikacji w celu uzyskania wyniku.
- PeerTube: osiem konkretnych źródeł dialogów, report/checkbox, języka treści i procesu tłumaczeń. keyboard:false i odmienny lifecycle są kontrargumentami; bez runtime i ogólnej przewagi. W3C APG i licencja pobrane HTTP 200/hash, kopie niezmienione.
- Rejestr R01–R35, R20 rozszerzony; 15 obszarów rozpoczętych/3 niezbadane, żaden zamknięty; ASVS 51/294 i wejścia 70/210 bez zaliczenia. Następnie D16.


## 2 listopada 2026 — partia 14: monitoring i incydenty

- Rozpoczęto D16. Mapa 14 obszarów sygnałów, dziewięciu źródeł logów i 22 scenariuszy; częściowy zakres/hash plików w batch14-review.json, nie suma nowych/w pełni zaudytowanych plików.
- Actual Worker.fetch z fake D1/fetch/zegarem: dziewięć obserwacji, exit 0. R36: po przyjętym DOWN recovery odrzucone HTTP/limitem nie jest ponawiane. DOWN retry oraz recovery network throw działają w kontrolach. Bez realnego provider/Cloudflare/e-maila.
- 13 obserwacji 15 rzeczywistych modułów TS, exit 0; wzmocniono R18 (public health bez DB, status-only panel, root zamiast manifestu/segmentu). Poprawne token/Redis/encoder kontrole; host health.sh nie wysyła diagnostycznego nagłówka. Raport bazowy zachowany.
- Istniejący Vitest: pięć plików i 22/22 zarejestrowanych assertions passed, jeden plik zablokowany przed rejestracją przez Prisma, global exit 1. Bez ponawiania pełnego CI/generowania lub obchodzenia blokady.
- Redakcja i requestId pozytywnie sprawdzone. Path marker bez ważnego tokenu/log-call witness i INFO=0/0 to ograniczenia/pytania, bez nowych znalezisk. Zachowano initial module-format failure harnessu, nie klasyfikowano go jako defektu aplikacji.
- Dziesięć źródeł PeerTube częściowo: metryki/kolejki/repliki/QoE/logger/tracing/config; bez runtime i benchmarku, z zastrzeżeniem default off/cardinality/privacy. OpenTelemetry Signals i CC BY 4.0 HTTP 200/hash, niezmienione kopie.
- Rejestr R01–R36, rozszerzony R18 bez zmiany historycznego priorytetu. ASVS 53/292, wejścia 73/207, 16 obszarów rozpoczętych/dwa niezbadane, zero zamkniętych. Pełne stosy i niezależne przeglądy nadal otwarte. Następnie D17: dostarczanie i odtwarzanie.


## 2 listopada 2026 — partia 15: wdrożenia i odtwarzanie

- Rozpoczęto D17: częściowy zakres źródeł, mapa 13 zadań CI i czterech obrazów, 14 zasobów odzyskiwania i 29 scenariuszy. Nie uruchomiono CI/build/realnego deploy/produkcyjnego restore.
- Siedem kontroli actual backup.sh z total command stubs: normalny wariant i sześć poprawnych odmów. Podejrzenie pipefail odrzucone; część danych przed błędem nie daje sukcesu. Osiem kontroli actual deploy.sh: blokada, dump/migration gating, rollback i jawne warnings; brak zmian hosta.
- Nowy R37: false-success w manual helperze verify-restored-database.ts, cztery warianty i siedem kontroli w 11 prawdziwych procesach z TS VM/query fixtures. Weekly restore to odrębny skrypt. Błędny initial exit mock i oczekiwanie backupu zachowane w diagnostyce, bez dwóch pozornych znalezisk.
- Realny lokalny PostgreSQL 17.11: wszystkie 81 migracji SQL, syntetyczne konto/kanał/film/asset/payment/grant, pg_dump/gzip/psql i zgodny wybrany snapshot. FK/unique po restore odmawiają; obie własne bazy usunięte, dump niezapisany. Bez Prisma history/roles/offsite/media/aplikacji/RPO/RTO.
- Istniejący Vitest local-ci 28/28 i static 7/7 passed, oba exit 0; 17 celowo pominiętych nie zaliczono. Bez całego pipeline/generate/npm audit. Rozszerzono R09 i R12, bez zmiany priorytetów i starego raportu.
- PeerTube: dziewięć wybranych źródeł, GPG podpisy i staged release/migration/rollback; brak pg_dump fallback i nieweryfikowane podpisy downloadera jako kontrargumenty. Brak runtime/benchmarku. SLSA v1.2 i Community Specification License 1.0 z przypiętego SHA, trzy HTTP 200; initial network i dwa 404 zachowane.
- Sześć pominiętych źródeł operatora dodano do powierzchni: 286 rekordów, 79/207. ASVS 55/290, rejestr R01–R37, 17 obszarów rozpoczętych/jeden niezbadany, zero zamkniętych. Następnie D18.


## 2 listopada 2026 — partia 16: testy i plan domknięcia

- Rozpoczęto D18: wszystkie 18 obszarów W_TRAKCIE, zero zamkniętych. Dodano wniosek dla właściciela, plan brakujących dowodów dla każdego obszaru, pięć bramek gotowości i 12 warstw testów.
- AST 547 plików (533 unit/2 integration/12 postgres), 4214 literalne deklaracje, zero diagnostics. Markery mocków/filesystem i coverage globs są mechaniczne, nie manual review/wykonanie/procent pokrycia.
- Osiem rzeczywistych prób Vitest 4.1.10 na temp kopiach i niezmienionych testach; trzy baseline 17 assertions passed. Dwa wrong-accept mutanty wykryte, trzy przeżyły wybrany zakres. Brak globalnego mutation score i błędnego sumowania powtarzanych testów. 17 ops behavior tests celowo filtrowanych.
- Rozszerzono R08 i R37: brak E2E i jeden brakujący critical-path file; four verifier tests pass with DB body disabled. Rzeczywiste PG/FFmpeg/authz i komponenty mają wartość; nie zdeprecjonowano ich wszystkich. Nie dodano R38 i nie zmieniono dawnych priorytetów.
- Zinterpretowano stary pełny JSON bez rerun: 535 rekordów plików, 219 failed bez assertions, 2602 registered/2556 pass/35 failed/11 pending. To nie liczba błędów produkcji. Full suite/generate/npm audit/build/browser/SQL nie powtarzane.
- Dziesięć źródeł PeerTube częściowo; pełniejsze API/process/browser wzorce, z ograniczeniami object-storage i currentTime, bez runtime/benchmarku. Playwright best practices v1.61.1 i Apache 2.0 HTTP 200/hash. Zachowano initial AST EPERM oraz korektę metadanych wersji runnera; aplikacja i testy bez zmian.
- R01–R37 pozostają stabilne; ASVS 55/290, wejścia 79/207 z 286, bez zaliczeń. Następnie systematyczna kwalifikacja ASVS V1/V2 i wejść według planu domknięcia, pełny runtime nadal zależy od wspieranej konfiguracji środowiska.

## 2 listopada 2026 — ROADMAPA NAPRAW v1; tymczasowa pauza audytu

- Na wyraźne polecenie właściciela wstrzymano dalsze pogłębianie audytu, kwalifikację ASVS i nowe przeglądy aplikacji na czas przygotowania i zatwierdzenia planu. Doprecyzowanie właściciela zachowuje cel dalszego pogłębionego badania; pauza nie oznacza zamknięcia programu.
- Zapisano ROADMAPA-NAPRAW.md, KOLEJNOSC-NAPRAW.csv i PLAN-WDROZENIA-NAPRAW.md: 40 pakietów/8 etapów, wszystkie R01–R37, klasyfikacja błędów/ryzyk/decyzji/długu, konkretne moduły, zależności, trudność, ryzyko i wymagania testów odbioru.
- Zaplanowano Prisma i inne blokady, dalsze ASVS/mapę wejść, pełne integracje, odzyskanie/koszt/skalę i zadania UX; osobno bramki obecnych płatności, otwartej platformy, 10000 widzów i przyszłego marketplace. Nie wymagano zamknięcia 18 obszarów/345 kontroli do opracowania roadmapy.
- Nie zmieniono USTALENIA.json ani kanonicznych wyników: 18 obszarów W_TRAKCIE/0 zamkniętych, ASVS 55/290/0 PASS, wejścia 79/207 z 286. Priorytety źródłowe zachowano; priorytety realizacji są osobną oceną.
- Przerwaną, niezwalidowaną partię 17 zachowano w provenance/paused-batch17-before-roadmap-v1.tar.gz i JSON z hashami. Aktywne materiały przywrócono do commitu partii 16, bez adopcji roboczych kwalifikacji i bez dalszej oceny archiwum.
- Dodano maszynowy indeks planu i walidację spójności; odświeżono indeks, PROGRAM i STAN. Następny krok: oczekiwanie na zatwierdzenie roadmapy/harmonogramu przez właściciela. Bez napraw, nowych prób aplikacji, wdrożenia i scalenia.

## 2 listopada 2026 — wznowienie po decyzji właściciela

- Właściciel polecił wznowić audyt; pauza z roadmapy v1 zdjęta. Nie rozpoczęto napraw, nie zmieniono aplikacji, nie wdrożono.
- Próba K01: `npm ci` i `prisma generate` (Prisma 6.19.3, prawdziwy klient) udane na lokalnym komputerze; wcześniej blokowało to środowisko chmurowe. Node 24 zamiast wymaganego 22.x.
- Nowy baseline Vitest: 535 plików, 4596 testów, 4573 pass, 1 fail, 22 pending ([dowód](evidence/baseline-real-prisma-2026-11-02.json)). Poprzednie 219 porażek przed rejestracją wynikało z braku klienta (potwierdza środowiskowy charakter R08).
- Jedyna porażka (migracja video_chapters_search, znak `\r`) to artefakt CRLF z `core.autocrlf=true`; do potwierdzenia na checkoucie LF.
- Brak Postgresa/Dockera: testy DB i integracyjne nadal NIEWYKONANE. Baseline nie jest dowodem zgodności produktu.
- Zamrożona partia 17 (ASVS V1–V2, kodowanie) rozpakowana tylko do porównania; NIE przyjęta do aktywnych dokumentów, wymaga walidacji.

## 2 listopada 2026 — walidacja i przyjęcie partii 17

- Zamrożoną partię 17 (ASVS V1/V2, kodowanie) zwalidowano: kod aplikacji bez zmian względem c397b9e, eksperyment i inwentarz powtórzone bez różnic, 51/51 testów celowanych ([walidacja](evidence/batch17-validation-2026-11-02.json)).
- Przyjęto 43 kwalifikacje ASVS V1/V2 (38 W_TRAKCIE, 5 warunkowych NA, 0 PASS) oraz powiązane rejestry. Bez niezależnego przeglądu.
- Wykryto: na checkoucie CRLF hashe inwentarza nie zgadzają się; po `autocrlf=false` 1701/1701 zgodnych.

## 2 listopada 2026 — zgoda na realizację, start H1

- Właściciel zatwierdził roadmapę i start prac słowami „ok droga wolna dzialaj”. Rozpoczęto K01/K02/K05, następnie K03/K06 zgodnie z zależnościami. Bez zgody na wdrożenie, scalenie i koszty.
- Zapisano stan runtime vs szkic: domena Prisma jest w szkicu rev. 3, ale nie w aktywnej regule instancji. Nie obchodzono ograniczenia ani nie powtarzano tej samej instalacji.
- Dodano POSTEP-NAPRAW.md; ten wpis dokumentuje start, nie ukończenie napraw lub nowy PASS ASVS.

- Podczas push wykryto nowsze commity audytu z Windows (b3a19a64/f7e288bd). Zachowano je przez rebase naszego lokalnego zapisu, bez force push i bez cofnięcia przyjętej partii 17. K02 oparto na aktualnym main; raporty nadal odnoszą się do historycznego baseline.

## 2 listopada 2026 — K02: kandydat aktualizacji zależności

- Osobna gałąź fix/polutek-k02-security-dependencies, commit e582ead4e1a20ec1e4080c1d1f6a899650304a09, baza aktualny main 5f848a93. Dwa pliki zależności, bez cofania nowszych zmian UI/kodu.
- 46/46 istniejących testów, architektura i fixture Next HTTP/natywne librsvg 2.63.2 przeszły. Typecheck exit 2 z 515 diagnostykami; pełny odbiór pozostaje zablokowany Prisma. Nie scalono, nie wdrożono, R01 nie zamknięto.
- Szkic PR nie powstał (GraphQL Forbidden). Wspieranym szkicem dodano api.github.com, zachowano binaries.prisma.sh; requires_publish=true, bez twierdzenia o aktywacji reguł.

## 2 listopada 2026 — K03/R37: wiarygodny wynik procesu weryfikacji

- Osobny kandydat 5d78380dfe659eedd0ef776cccb0ccb81566fa84 na fix/polutek-k03-restore-verifier, rodzic K02 e582ead4. Naprawiono obowiązkowe odczyty, stan migracji, oczekiwane agregaty/kształt manifestu i zamykanie klienta przy obsłużonych błędach.
- 29 przypadków RED (24 fail); dodatkowy RED manifestu: 31 przypadków/2 fail; końcowe 31/31 PASS. Lint, typy nowego testu i architektura PASS. Granica DB syntetyczna; realny proces, bez zainstalowanej atrapy Prisma.
- Pełne K03 i odbiór prawdziwego PostgreSQL pozostają otwarte. Bez merge/deploy, bez nowego PASS ASVS.

## 2 listopada 2026 — H1: profil, build types, selekcja testów i świeża baza

- K05 `e3801c27`: dokumentacyjny profil trzech przepływów i rejestr 9 otwartych decyzji, bez aktywacji lub wyboru polityk za właściciela.
- K06 `2f8ff906`: oba configi `ignoreBuildErrors=false`; przed zmianą dwa małe buildy przyjęły celowy zły typ, po zmianie dwa odmawiają i dwa legalne przechodzą. To nie pełne buildy produktu ani gotowy protokół artefaktu.
- K03 `f5e06154`: komenda krytyczna wskazuje dwa istniejące pliki. 31 testów procesu PASS, plik integracyjny zablokowany przed rejestracją przez niewygenerowane Prisma; cała komenda exit 1. Gałąź zbiorcza `fix/polutek-h1-foundations` zawiera małe commity przez ich rodziców, bez merge/deploy.
- K01: nowa pusta lokalna baza PostgreSQL 17.11, konfiguracja poza repo 0600, sprawdzona powtarzalność bez resetu. Nie wykonano migracji lub sztucznego bazowania starych danych.
- Szkic środowiska rev. 6 zapisany (dwie domeny + start_skill); `requires_publish=true`, runtime spec. 1 nadal bez hostów. Nie obchodzono proxy/TLS/checksum i nie ponawiano npm audit/GraphQL przy niezmienionej blokadzie.
- Uporządkowano bieżący punkt przejęcia w STAN/POSTEP i maszynowym h1-status.json. H1 częściowe, wszystkie pełne obszary nadal otwarte; brak nowego PASS ASVS. USTALENIA.json i przyjęte materiały zewnętrznego przebiegu Windows bez zmian.

## 2 listopada 2026 — kontrola po zgłoszeniu Full Access

- Jednorazowe odczyty po zgłoszonej zmianie: Prisma nadal CONNECT 403 / curl 56, API GitHub Forbidden / gh 1. Aktywna polityka nadal restricted/spec. 1.
- Nie uruchamiano niezmienionej instalacji/testów ani obejść. H1 pozostaje częściowe; zapisano potrzebę rozpoznania rzeczywistego widoku UI zamiast ponawiania niejasnej instrukcji publikacji.

## 2 listopada 2026 — środowisko i sieć odzyskane

- Runtime spec. 2 connected/enforced/unrestricted. Suma Prisma HTTP 200 i odczyt API prywatnego repo udane. Przejście do normalnej instalacji oraz realnego odbioru H1; nie oznacza jeszcze PASS testów/buildu.

## 2 listopada 2026 — rzeczywisty baseline H1 i szkic PR

- Prawdziwy postinstall Prisma 6.19.3 na Node 22.23.4, 81 migracji na własnym PG 17.11, smoke i status up-to-date. Po odświeżeniu uruchomiono istniejący zatrzymany kontener, bez resetu.
- Nowy kandydat `fix/polutek-h1-acceptance` na nowszym main c80ef652: pięć wcześniejszych małych zmian przez cherry-pick i osobny commit naprawy fixtures PG `8dce5f94`. Stare opublikowane gałęzie zachowane, bez merge/force push.
- Unit lokalny: 4686 PASS/0 FAIL/3 pominięte w 541 plikach; PG 75/75 w 12 plikach; critical-path 36/36. R37: 31 procesowych regresji i 11/11 rzeczywistych prób syntetycznego pg_dump/pg_restore z rolą tylko do odczytu. Lokalne HTTP 4/4, własne dane/procesy posprzątane.
- Typy aplikacji/architektura/env i build panelu PASS. Typy całego repo: 81 diagnostyk w 41 plikach testów; build strony FAIL. Lint zatrzymany konfiguracją, hotspots 4 przekroczenia, strict-escapes 5 dopasowań. Pełny odbiór H1 i protokół artefaktu nadal otwarte; nie obniżono bramek.
- Nieudane przebiegi i dokładna atrybucja zachowane w `evidence/h1-cloud-2026-11-02`. Utworzono szkic PR #2065 na dokładnym SHA. Zaktualizowano POSTEP/STAN/CSV/status; 37/37 ustaleń pozostaje w rejestrze, zero zamkniętych i zero nowych PASS ASVS.
- Instrukcje startowe zapisane i odczytane ze szkicu środowiska rev. 8; instalacja i aktywna sieć bez zmian. Publikacja instrukcji jest osobnym krokiem ustawień, nie blokadą bieżącej pracy.

## 2 listopada 2026 — usunięcie blokad typów/lint i oba buildy H1

- Sześć małych commitów od 76ba1ff4 do de69f521: bieżące/legacy poziomy dostępu w testach, kompletne fixtures/props/mocki i JSDoc CLI, poprawny zakres ESLint, izolowany BOLA unit, fixtures lint i rzeczywista poprawka callbacków powiadomień przy zawieszonym renderze.
- 81 diagnostyk typów→0. Pełny lint0; bez wyłączenia reguł i bez zmiany tsconfig. Nowa regresja Suspense RED 8/9 → GREEN 9/9, 65/65 celowanych follow-up; wcześniejsze 158/158 i 269/269 zachowane.
- Finalny czysty SHA de69f521: unit 4687 PASS/0 FAIL/3 pominięte w 541 plikach, PG 75/75 w 12 plikach, oba typecheck/architektura/env/lint PASS, public i admin build PASS. Hotspots 4 i strict-escapes 5 nadal FAIL; zbiorczy exit 1. Obraz/protokół artefaktu/full HLS i decyzje K05 otwarte.
- Dowody w evidence/h1-quality-2026-11-02, aktualizacja PR #2065 i przekazania. Zero zamkniętych całych pakietów/ustaleń, brak nowych kwalifikacji ASVS, merge, deploy, produkcji i kosztów. Na polecenie właściciela raportujemy szacunek: H1 około 65%, całość 5–10%, pozostało 35% i 90–95%. Bieżące działające środowisko bez kolejnej publikacji.

## 2 listopada 2026 — H1: brakujące bramki jakości i strażnik testów krytycznych

- Pięć małych commitów na `fix/polutek-h1-acceptance`, finalny `03115f0fefe47baf91622b3272b966344981beaf`, szkic PR #2065. Budżety, baseline, lockfile, schemat/migracje i tsconfig bez zmian.
- Wydzielono widoki/kontrakty czterech hotspotów, usunięto zbędne obejścia typów; widoczność używa istniejącej transakcji z kontekstu. Dodano dwie regresje transakcyjne.
- Strażnik obu krytycznych plików i 13 regresji na prawdziwym Vitest; właściwe krytyczne 36/36.
- Dokładny czysty SHA: unit 4702/0/3 pominięte, PG75/75, typy/lint/hotspots/escapes/architektura/env i oba pełne buildy PASS. Zbiorczy exit0; `release_ready=false`, pełne HLS/obraz/wiązanie artefaktu/K05 nadal otwarte.
- Dowody `evidence/h1-gates-2026-11-02`; starsze czerwone wyniki i Windows/batch17 zachowane. H1 około75%, całość5–10%; 0 zamkniętych pakietów/ustaleń, bez nowych ASVS PASS, merge/deploy/produkcji/kosztów.

## 2 listopada 2026 — H1: rzeczywiste obrazy i wykonane HDR

- Trzy małe commity, finalny `9824bb0abba7ed3672935845dedc328ae94ad8ff` na PR #2065. Obrazy public/admin/worker rzeczywiście ładują poprawione Next/sharp/vips/rsvg; formaty15 prób, HTTP 9/9 i worker 3/3 z HDR.
- Początkowy HDR2/3 z jednym skip zachowany jako brak dowodu/strict exit 1; poprawiono fixture VUI i niezależne sprawdzenie tagów, kod enkodera bez zmian.
- Końcowo unit 4703/0/2skip,PG 75/75,krytyczne 36/36,typy/lint/pozostałe wykonane bramki i oba buildy PASS. Źródła i lokalne imageID zapisane, lecz protokół publikacji nie jest jeszcze wymuszony; migrator/collector i pełny stos/K05 otwarte.
- H1 ~80%,całość 5–10%;0 zamkniętych ustaleń/pakietów. Kanoniczne pokrycia, Windows i stare dowody zachowane. Bez ASVS PASS,merge/deploy/produkcji/kosztów.

## 3 listopada 2026 — H1: wspólny rdzeń K06 i pochodzenie CI

- Cztery commity, finalny `f9edc23ae278fbd2764b39c7bcd0c71810ba78b2`; walidator źródeł/17 bramek/wejść/pięciu obrazów, zewnętrzny hash dowodu, stable source snapshots i realne podsumowania testów. Publikatory/konsumenci jeszcze niepodłączone.
- 128/128 celowanych,15 oczekiwanych kontroli z prawdziwym Dockerem i sześcioma syntetycznymi obrazami, prawdziwy TS2322: baseline exit 0/PASS → finalny exit 1/FAIL. Brak danych produktowego release-proof.
- Końcowy unit 4779/0/2skip przez częściowy local-CI,PG 75/75,krytyczne 36/36,encoder 3/3,pozostałe wykonane lokalne bramki/budowy PASS. Rzeczywiste archiwum zgodne; częściowy raport prawidłowo odrzucony do wydania. Wymóg audit zachowany, brak retry starej odmowy.
- Dowody h1-release-core-2026-11-02; stare obrazy na9824 i wszystkie wcześniejsze dane zachowane. H1 ~80%,całość 5–10%;0 zamkniętych ustaleń/pakietów,bez ASVS PASS/merge/deploy/produkcji/kosztów.

- Uzupełnienie weryfikacji: bezpośrednie Git/REST potwierdziły remote i draft PR; alternatywny odczyt przez pomocniczy proces/GraphQL zwracał401. Bez zmian poświadczeń i konfiguracji; działające metody zapisane w STAN.

## 3 listopada 2026 — lokalne przejęcie K06: budowanie przypiętych obrazów

- Rdzeń K06 przeniesiony czterema cherry-pickami do gałęzi audytu, bez nowszych zmian wyglądu. Historyczne dowody pozostają przypisane do wcześniejszych SHA.
- Dodano `build`: kolejno pięć obrazów z przypiętych baz, pełnych argumentów i etykiet, ID z `--iidfile`, kontrola źródeł i seal. Bez publikacji.
- 82/82 celowane, lint PASS, whole tsc exit 2 poza zmienionymi ścieżkami; bez zielonego całego repo i bez realnego Dockera w tej partii. Dowody `k06-local-producer-2026-11-03`.
- Dalej producent pełnych kontroli i wszyscy konsumenci. H1 historycznie ~80%, całość 5–10%; bez zamknięcia K06/ustaleń/ASVS, PR, merge, deploy ani produkcji.

## 3 listopada 2026 — K06: producent pełnych kontroli

- Nowy producent wymaga czystego dokładnego SHA, sam uruchamia pełne ścisłe CI z jednym slotem, odrzuca stary raport przez losowy runId, archiwizuje Git i sprawdza źródła przed budową.
- 121/121 testów (w tym local-ci-lib), lint i skupione strict types PASS; rzeczywisty Git/tar i jawne porty CI/Dockera. Nie uruchomiono pełnej bramki audit ani produktu. H1 nadal ~80%, całość 5–10%, K06 otwarte.
- Następne: granica faktycznego użycia przypiętych baz w Dockerfile, brakujące zależności H1 i wszyscy konsumenci. Bez publikacji i produkcji.

## 3 listopada 2026 — K06: Dockerfile musi używać zadeklarowanych baz

- Dwie rzeczywiście czerwone próby akceptacji ruchomego FROM i zewnętrznego COPY; preflight teraz odrzuca oba przed wywołaniem Dockera. Przejrzany ograniczony kontrakt, bez ogólnej deklaracji powtarzalności buildów.
- 124/124 celowane, lint i skupione strict types PASS; aktualne oba Dockerfile akceptowane. Nie wykonano prawdziwego builda ani odbioru produktu.
- K06/H1 otwarte, szacunki ~80% / 5–10% bez zmiany. Dalej brakujące zależności H1 i konsumenci.

## 3 listopada 2026 — zależności K03 w lokalnym worktree

- Weryfikator i strażnik critical przeniesione z historycznych commitów. Ponowiony rzeczywisty RED: 26/31 błędów; GREEN: 31/31. Strażnik 13/13 na prawdziwym Vitest, właściwe critical 36/36 w obu plikach, bez skip.
- Lint i focused types PASS, DB/providerzy nadal syntetyczni; brak dowodu prawdziwego restore i dostarczenia powiadomień. K03/K06 otwarte. Bez zmian produkcji/schematu/danych/polityki.

## 3 listopada 2026 — K06: rzeczywiste bramkowanie typów przy budowie

- Przywrócono `ignoreBuildErrors=false` obu aplikacji z wcześniejszego H1. Sześć nowych izolowanych buildów rzeczywistego Next 16.3.8: baseline akceptował dwa celowe błędy, poprawka oba odrzuca i oba legalne warianty przyjmuje. Dokładny komunikat TypeScript sprawdzony, lint PASS.
- To nie są buildy całego produktu ani dowód patched runtime K02. H1/K06 otwarte, ~80% / 5–10% bez zmiany, bez produkcji/publikacji.

## 3 listopada 2026 — K02: patched runtime na lokalnej gałęzi

- Przeniesiono patch `989682ff`, Next/eslint-config-next16.4.1, sharp0.35.5. Normalne npm ci i prawdziwe Prisma generate, bez npm audit. Nodemailer/zod major bez zmian.
- RED wersji sharp0.35.4 → GREEN0.35.5/librsvg2.63.2/vips8.18.7, rzeczywisty loopback HTTP (PNG200, pozostałe trzy400),170/170 testów, lint PASS. Cztery dodatkowe rzeczywiste małe buildy aktualnego Next sprawdzają odmowy i legalne warianty.
- Bez nowych obrazów aplikacji/produkcji/świeżego npm audit, K02/H1 nadal otwarte; szacunki bez zmiany.

## 3 listopada 2026 — baseline K03: pełne typy, unit i lint lokalnej gałęzi

- Przeniesiono pięć poprzednich poprawek fixture/typów/lint, zachowując obecny UI przy konfliktach. Bez zmiany wykonywanej autoryzacji, ról i ustawień użytkownika.
- Typecheck całego repo 82 wcześniejsze diagnostyki → 0; full unit przez partial local-CI 4729 PASS/0 FAIL/3skip w540 plikach, sourceStable=true. Lint po trzech leksykalnych poprawkach helperów:0 błędów/100 ostrzeżeń.
- Dwa pominięte e-mail DB i jeden HDR nadal otwarte. Jawnie częściowe CI, bez grafu audit i gotowości do wydania; źródła/dowody z atrybucją. Mapa zakończonych części w MAPA-COMMITOW.csv.
- Następne: własny PG/e-mail i HDR, pozostałe H1 i konsumenci K06. Zero formalnych zamknięć, H1 historycznie~80%, całość5–10%.

## 3 listopada 2026 — HDR: brak pominięć w obowiązkowym encoder smoke

- Strict gate potwierdził RED przy 2 PASS/1 skip mimo Vitest exit0. Przywrócono fixture z `a2708f00`, jawne VUI HLG i niezależne ffprobe zamiast dynamicznego skip.
- GREEN:3/3 rzeczywistych encode, brak skip, lint i focused types PASS. Enkoder i polityka dostępu bez zmian. Pełny pipeline/obrazy K01 nadal otwarte.
- Następne własny PG i oba e-mail DB; dostępny obraz17-alpine, bez pobierania/produkcji. H1~80%, całość5–10%, bez formalnego zamknięcia całych pakietów.

## 3 listopada 2026 — realny PostgreSQL i oba przypadki e-mail DB

- Nowe własne kontenery na niezmiennym ID lokalnego obrazu17-alpine; PostgreSQL17.11, autentyczny Prisma i81 migracji. RED64/75+11fail w dwóch starych fixture → GREEN77/77 w13 plikach, bez skip, z oboma e-mail DB.
- Fixture z8dce5f94 nie zmieniają migracji/retencji. Guard wszystkich plików PG/e-mail:9RED→48/48 z istniejącymi procesowymi regresjami kompilatora. Lint i focused types PASS, oba własne kontenery po testach nie istnieją.
- Providerzy częściowo kontrolowani, pełny produkt nadal otwarty. Nie podmieniono raw unit, trzy jego pominięcia mają osobne dowody. Dalej pozostałe H1 i konsumenci K06. Bez produkcji/publikacji/nowych ASVS PASS; szacunki bez zmiany.

## 4 listopada2026 — końcowy zielony pakiet i STOP właściciela

- `2d081d7f`:61/61 transakcji/powiązanych,253/253 komponentów/Studia/i18n, typy aplikacji/architektura/hotspots/strict-escapes PASS, lint0/12ostrzeżeń. Cztery wcześniejsze refaktory H1 przywrócone bez zmiany budżetów i wyglądu. Starsze pełne wyniki zachowują własną atrybucję.
- Po poleceniu STOP przy1% limitu dokończono wyłącznie bieżący lint i zapis. Osobny checkpoint WIP opisuje nieukończone K06/H1 i komendę wznowienia. Publikator rejestru nie rozpoczęty. Nie pozostawiono niezapisanych zmian kodu, własnych kontenerów ani działających testów.
- Nie wznawiać automatycznie. Bez nowych pakietów/heavy tests, PR/push/merge/deploy/produkcji. Całość5–10%, bez formalnego zamknięcia całych pakietów i bez release_ready.

## 6 listopada 2026 — wznowienie K06 i proof-aware konsumenci

- Właściciel wznowił roadmapę. Ukończono lokalnie integrację producer/publisher z deploy/app/admin/rollback i transferem proof bundle; preflight release inputs biegnie przed GitHub CLI, compose nie ma fallbacków `:current`, a jednorazowe akcje operatora sprawdzają proof aktywnego release.
- Hermetyczne testy transferu obejmują wariant lokalny i Actions, poprawne przekazanie do atrapowego SSH oraz odmowę błędnego proofu, rewizji, workflow run/head i brakującego artifactu. Konsument wykorzystuje cache tylko przy zgodnym ID obrazu.
- Wyniki: handoff 6/6, release consumers/artifact 9/9, skrypty serwera 29/29, actions-lib 48/48; lint, `bash -n`, YAML parser i diff check PASS. Brak rzeczywistego Actions/GHCR/SSH, pięciu obrazów produktu, pełnej bramki audit, serwera lub runtime odbioru.
- K06 pozostaje otwarte. Runbooki opisują granicę między starym stanem produkcji i niewdrożonym kandydatem. Szczegóły commitów są w `MAPA-COMMITOW.csv`; punkt wznowienia w `STAN.md` i `POSTEP-NAPRAW.md`.

## 6 listopada 2026 — rollback i aktywny proof K06

- Dodano zachowanie testów rollbacku dla app/admin: stary proof jest ponownie weryfikowany przed aktywacją, a niezgodny zewnętrzny hash odmawia bez uruchomienia obrazu. Active-proof preflight jest sprawdzony dla rewizji aplikacji i panelu.
- Telemetria: błędny zachowany proof lub błąd `verify-active-release.sh` nie przechodzi do Docker/DB i nie zmienia `app.env`/`collector.env`.
- Pięć skupionych pakietów testów: **95/95 PASS**; skrypty serwera **38/38**, release artifact/consumer **9/9**, handoff jest wliczony, operator actions **48/48**. To testy z atrapami/integracyjne lokalnie, nie odbiór prawdziwego serwera.
- K06 nadal blokuje brak pełnego producer gate `audit`, prawdziwych pięciu obrazów i całego runtime. Nie uruchomiono workflow, GHCR, SSH ani produkcji.

## 6 listopada 2026 — osobny deploy panelu admina

- `6aacd4b5`: dwa testy integracyjne atrapowego deployera potwierdzają, że poprawny proof pozwala uruchomić wyłącznie panel admina, a błąd weryfikacji odmawia przed wywołaniem Dockera.
- Pięć skupionych zestawów przeszło **100/100**; same skrypty serwera **43/43**. ESLint, `bash -n` i `git diff --check` PASS. Pełny zestaw: komenda z `POSTEP-NAPRAW.md`; bez ciężkiego quality.
- To dowód ścieżki w sandboxie, nie wdrożenie ani odbiór na serwerze. K06 pozostaje otwarte.

## 6 listopada 2026 — pozytywna ścieżka włączenia telemetrii

- `c58586d8`: test atrapowego `telemetry-enable.sh` przechodzi przez aktywną weryfikację proofu, symuluje istniejącą rolę telemetryczną i potwierdza ograniczone uruchomienie collectora oraz app, a także zmianę konfiguracji dopiero w tej ścieżce.
- Pięć skupionych zestawów przeszło **101/101**; skrypty serwera **44/44**. ESLint, `bash -n` i `git diff --check` PASS.
- Odmowę złego hash i odmowę aktywnego proofu obejmują istniejące testy. Dowody pozostają sandboxowe; bez GHCR, prawdziwego serwera i produkcji.

## 6 listopada 2026 — odrzucenie cache obrazu o innym ID

- `8224f010`: test `deploy-release` potwierdza, że przy różnym lokalnym ID pobierane są wszystkie pięć dokładnych, zatwierdzonych digestów przed retagowaniem obrazów do wdrożenia. Poprzedni test pokrywa reuse wyłącznie zgodnego cache'u.
- Pięć skupionych zestawów przeszło **102/102**; `deploy-release`/artifact/handoff **10/10**. ESLint i `git diff --check` PASS.
- Test używa atrapowego Dockera; nie pobierano obrazów z GHCR. K06 nadal wymaga rzeczywistego odbioru i pełnej bramki wydania.

## 6 listopada 2026 — odświeżony lokalny runtime K02 na Next 16.4.4

- Po wykryciu niezgodności starego `node_modules` z lockfile przywrócono instalację i zweryfikowano aktualne pakiety oraz obrazy natywne. Rzeczywisty izolowany Next dev: **PASS**, PNG 200; SVG, błędne wejście i obcy host 400. [Wynik i granice](evidence/k02-runtime-2026-11-06/result.json).
- `npm ci` domyślnie wykonało automatyczne żądanie audit i wyświetliło podsumowanie. Nie jest ono reviewed, nie zaliczono nim R01/K02 i nie powtarzać takiej operacji. Przyszłe instalacje wymagają `npm_config_audit=false`, aż polityka grafu będzie jawnie rozwiązana.
- K02 pozostaje częściowe: brak reviewed audit oraz obrazu aplikacji zawierającego poprawione zależności. Nie uruchamiano pełnego quality, Docker build ani GHCR.
- Uzupełnienie po tej partii: na SHA `d6f0d33c` dziewięć plików testów K02 zaliczyło 179/179, typecheck i oba buildy aplikacji zakończyły się exit 0. Build ujawnił cztery błędne typy fixture’ów, poprawione w `d6f0d33c`, a następne buildy przeszły. Szczegóły i pełne logi: [build-result](evidence/k02-runtime-2026-11-06/build-result.json).
- Pierwszy build admina zgłosił dynamiczne śledzenie repo. W `7d97d067` dodano komentarz `turbopackIgnore` dla ścieżki host mount; standalone build przeszedł bez warningu i `apps/admin` tree w artefakcie nie zawiera `.ts/.tsx/.md`. [Porównanie/logi](evidence/admin-standalone-trace-2026-11-06/result.json). Nadal nie jest to build obrazu Docker ani GHCR.
- K02 pozostaje otwarte: brak reviewed audit i dowodu zależności w docelowym obrazie. `npm ci` automatycznie wywołało audit, który jest nieprzejrzany; nie powtarzać go i używać `npm_config_audit=false` przy przyszłej instalacji.


## 6 listopada 2026 — K02: aktualizacja i pełne lokalne bramki na Next 16.4.5

- Oficjalne [wydanie Next.js 16.4.5](https://github.com/vercel/next.js/releases/tag/v16.4.5) zawiera poprawki bezpieczeństwa opublikowane 3 listopada. Podniesiono `next` oraz `eslint-config-next` z 16.4.4 do 16.4.5 w `e2cb87d9`; `npm install` uruchomiono jawnie z `npm_config_audit=false`. sharp 0.35.5, librsvg 2.63.2 i vips 8.18.7 pozostały bez zmian.
- Izolowany Next image runtime: **PASS** (PNG 200; SVG, niepoprawny obraz i niezatwierdzony host 400). Dziewięć celowanych plików: **179/179 PASS**, zero pominięć. Repo typecheck, public build i admin standalone build: PASS. Build admina nie zgłosił wcześniejszego whole-project tracing warningu.
- Surowe wyniki i logi: [dowody](evidence/k02-runtime-2026-11-06-next-16.4.5/result.json). Nie wykonano reviewed `npm audit`, obrazu Docker aplikacji ani GHCR. K02 pozostaje otwarte do czasu przeglądu zależności i potwierdzenia wersji w docelowym obrazie. Poprzednie dowody 16.4.4 zachowano.

## 6 listopada 2026 — K07: limity rzeczywistego body przed parserem

- Commit `b8b5d4dd`: dodano bounded byte reader dla JSON/FormData, enforcement rzeczywistych bajtów streamu niezależnie od `Content-Length`, limit części multipart przed natywnym parserem, mapowanie błędów na 400/413 i zastosowanie do tras Studio, panelu admina oraz wskazanych tras API. Limit complete to 13 MiB, zachowujący legalne complete z 10 000 części; limity zwykłego JSON zachowują opisane duże wejście avatara.
- Na finalnym kodzie 9 plików testów, **110/110 PASS**, typecheck, ESLint zmienionych plików i `git diff --check` PASS. Lokalny produkcyjny Next 16.4.5 potwierdził 413 dla za dużego multipart z `Content-Length` i bez niego oraz dla nadmiaru części. [Surowe wyniki](evidence/k07-body-limits-2026-11-06/).
- To weryfikacja bez reverse proxy. Repozytorium nie zawiera Cloudflare Tunnel ingressu; dokumentacja mówi, że jest zarządzany zdalnie. Cloudflare/ingress i pamięć/czas przy równoległych odrzuceniach niezmierzone. Buildy public/admin na wcześniejszym kodzie pakietu nie zostały powtórzone po końcowej korekcie walidacji duplikatu pliku. K07 pozostaje częściowe i otwarte; nie ogłaszać ochrony DoS ani pełnego acceptance.

## 6 listopada 2026 — K06: awarie deployera w sandboxie

- W fake-Docker harness dodano sterowaną awarię dumpu przed wdrożeniem i regresję: częściowy zrzut usunięty, bieżący obraz zachowany, migracja i aktywacja pominięte.
- Pełny `tests/unit/ops/serwerek-scripts.test.ts` przeszedł **45/45 PASS, zero skip**. Cztery scenariusze przeszły **4/4 PASS**: błąd dumpu, błąd migracji, błąd uruchomienia aplikacji i rollback, błąd panelu i rollback po sprawdzeniu zachowanego proofu. [Wynik](evidence/k06-deployer-failures-2026-11-06/).
- Adapter symuluje Docker, dump/migrator i filesystem; nie użyto prawdziwej bazy, obrazów, GHCR, SSH ani serwera. To weryfikacja częściowa; K06 pozostaje otwarte.

## 6 listopada 2026 — K27: podpisana sesja eksportu danych

- Dodano test PostgreSQL z rzeczywistą konfiguracją Better Auth: aktywny podpisany cookie, mapowanie aktora z DB, błędny podpis i cofnięta sesja. PostgreSQL 17 po 84 migracjach; 1/1 PASS, typecheck, ESLint i diff check PASS.
- Test jest bezpośrednim wywołaniem granicy auth, nie Next HTTP; route test eksportu nadal ma atrapę auth/rate limitera. K27 pozostaje otwarte. Dowód: `evidence/k27-session-postgres-2026-11-06/result.json`.

## 6 listopada 2026 — K27: rzeczywiste Next HTTP z cofnięciem sesji

- Test PostgreSQL uruchomił lokalny Next dev na loopback i wywołał pełny route HTTP z rzeczywistym Better Auth: gość 401, podpisany właściciel 200/no-store z tylko własnym komentarzem, cofnięta sesja 401. 1/1 PASS po 84 migracjach; typecheck, ESLint i diff check PASS.
- Store limitów był rzeczywistym in-memory store development; brak proxy, Redis/Cloudflare i produkcji. Kontener jednorazowy usunięty, fixture User count 0. K27 częściowe; K37 oraz zależności polityki/review otwarte. [Dowód](evidence/k27-http-postgres-2026-11-06/result.json).

## 6 listopada 2026 — K17/R02: przejęcie joba w rzeczywistym wyścigu PostgreSQL

- Dwa niezależne połączenia DB wymusiły blokadę: finalizer A czekał na job row lock, gdy B trzymał niezatwierdzone przejęcie. Po COMMIT A został odrzucony, a tylko B aktywował asset. 1/1 PASS po 84 migracjach; typecheck, ESLint i diff check PASS.
- To dwa połączenia w jednym procesie, nie dwa worker procesy; brak prawdziwego R2/S3 i niezależnego review. R02/K17 częściowe. [Dowód](evidence/k17-two-session-race-2026-11-06/result.json).

## 6 listopada 2026 — K23/R05: procesowy odzysk trwałego intentu

- Rzeczywisty `publishAdminVideo` utworzył atomowy intent na PostgreSQL. Post-commit kick zasymulowano jako utracony; świeży proces OS uruchomił durable worker i dostarczył subskrybentowi jedno powiadomienie. Retry/reopen i drugi run nie dublują wpisu. 1/1 PASS po 84 migracjach; typecheck, ESLint i diff check PASS.
- Nie zabito HTTP procesu po commitcie ani nie wywołano cron HTTP; HLS syntetyczne, bez R2/S3 i niezależnego review. K23/R05 pozostają częściowe. [Dowód](evidence/k23-process-recovery-2026-11-06/result.json).
