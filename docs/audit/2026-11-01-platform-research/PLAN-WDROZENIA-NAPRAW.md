# PLAN WDROŻENIA NAPRAW v1 — propozycja do zatwierdzenia

2 listopada 2026. Ten dokument określa przyszłą kolejność realizacji, weryfikacji i odbioru. **Obecnie wykonujemy wyłącznie zapis roadmapy. Nie ma zgody na rozpoczęcie napraw, wznowienie audytu, migracje, wdrożenie lub scalenie.** Pauza badań jest tymczasowa; pełny cel bezpieczeństwa, niezawodności i jakości pozostaje w mocy.

Karty i testy: [ROADMAPA-NAPRAW.md](ROADMAPA-NAPRAW.md). Wszystkie 37 ustaleń: [KOLEJNOSC-NAPRAW.csv](KOLEJNOSC-NAPRAW.csv). Rejestr źródłowy nie został przepisany. Maszynowy indeks 40 pakietów i zależności: [roadmap-v1-plan.json](program-audytu/evidence/roadmap-v1-plan.json).

## 1. Proponowany harmonogram dalszej pracy

Harmonogram jest oparty na wynikach, a nie obietnicy dat bez działającego runtime. Trudność S/M/L z kart służy do porównania. Po K01/K03 i pierwszych dwóch poprawkach można oszacować rzeczywiste tempo i przedstawić właścicielowi budżet/kalendarz kolejnych partii. Każdy kamień kończy się krótkim raportem: co działa, co jest nadal zablokowane, jakie ryzyko pozostaje i na jaką decyzję czekamy.

| Kamień | Proponowana praca po zatwierdzeniu | Weryfikacja równoległa w sensie harmonogramu | Warunek odbioru |
|---|---|---|---|
| **H0 — teraz** | Tylko roadmapa v1, CSV, ten plan i stan; commit/push obecnej gałęzi | Mechaniczna spójność dokumentów, 37/37 i DAG 40 pakietów; bez nowych prób aplikacji | Właściciel zatwierdza zakres kolejnego kamienia; do tego czasu STOP |
| **H1 — fundament** | K02 pilny kandydat aktualizacji, K01 prawdziwe środowisko, K05 bieżący profil; potem K03/K06 | W01 usuwa blokady; W02 podważa ważne świadki przed poprawkami; decyzje pieniędzy/retencji/TTL | Prawdziwy klient/migracje, baseline bez ukrytych wyników, poprawiony artefakt i wymuszona bramka wydania |
| **H2 — skutki krytyczne** | K07/K08/K10; K11/K12 oraz K13–K20 w małych pakietach | W02/W04 realne DB/HTTP/provider test-mode/worker/storage; odmowy i crash/retry | Pieniądze i aktywne pliki mają jednoznaczne gwarancje; brak publikacji płatnej platformy na podstawie samych atrap |
| **H3 — platforma wielu twórców** | K24/K25/K26; ograniczony K04, kontrakt K21, resume K22, outbox K23; K28/K29/K27 | W03 stopniowo wznawia ASVS/mapę wejść według zatwierdzonego zakresu; W04 role, moderacja i prywatność | Odmowy bez skutków między kanałami, legalne podróże, zgodny eksport/usunięcie i decyzje cofania dostępu |
| **H4 — gotowość operacyjna i ograniczony start** | K34/K30/K31/K33/K09; K35 kolejne pełne scenariusze; K32 offsite drill; krytyczny zakres K36 | W05 odzysk/monitoring/koszt; W06 pełne zadania; W07 niezależnie sprawdza ważne zamknięcia | Osobno B/P/O: aktywny profil przechodzi wymagane testy, restore i alarm; właściciel podejmuje odrębną decyzję o ewentualnym starcie |
| **H5 — skala i dalsza jakość** | K37 gdy rozmiar wymaga, K38/K39 pomiar i ewentualny osobny plan wąskich usprawnień; pozostały K36 | W03 i W07 kontynuują pozostałe ASVS/wejścia/D01–D18; W05 mierzy SLO/koszt przy docelowym ruchu | Tylko osiągnięte pomiarem progi; nieosiągnięty cel ma wynik FAIL i nowy plan, nie marketingowe PASS |
| **H6 — opcjonalny marketplace** | K40 wyłącznie po nowej decyzji o funkcji oraz osobnej specyfikacji całych rozliczeń | Test-mode operatora, idempotencja, reconciliation; dodatkowy przegląd finansowy | Oddzielny odbiór sprzedaży wielu twórców; nie jest potrzebny do zamknięcia dzisiejszych pakietów |

W03 nie musi poprzedzać pilnej poprawki K02 ani znanych błędów integralności. K35 rośnie już od H1/H2: każdy pakiet dodaje swój wartościowy test, a H4 łączy je w odbiór produktu. Nie wolno odłożyć całego testowania do końca napraw. Jeżeli wybrany profil wymaga jeszcze niezweryfikowanego krytycznego wymagania bezpieczeństwa, wskazać je jako jego blokadę; liczba ukończonych kontroli sama nie wydaje zgody na start.

## 2. Rekomendowana kolejność pakietów

To poprawne uporządkowanie zależności i wariant pracy jednego agenta. Numery K identyfikują pakiety według tematu, a poniższa pozycja określa wykonanie. Różne ścieżki wolno prowadzić niezależnie dopiero po zatwierdzeniu harmonogramu i ustaleniu odpowiedzialności za wspólny schemat/kontrakty. Sam ten plan nie uruchamia agentów ani zadań.

| Pozycja | Pakiet | Zależności | Trudność | Odbiór |
|---|---|---|---|---|
| 1 | [K02](ROADMAPA-NAPRAW.md#k02) — Pilna aktualizacja zależności objętych advisory | brak | M | K02-T1, K02-T2 |
| 2 | [K01](ROADMAPA-NAPRAW.md#k01) — Prawdziwe środowisko testowe i klient Prisma | brak | M | K01-T1, K01-T2, K01-T3 |
| 3 | [K05](ROADMAPA-NAPRAW.md#k05) — Jednoznaczny profil produktu i decyzje właściciela | brak | S | K05-T1, K05-T2 |
| 4 | [K03](ROADMAPA-NAPRAW.md#k03) — Wiarygodny baseline testów i wynik weryfikatora restore | K01 | M | K03-T1, K03-T2, K03-T3 |
| 5 | [K06](ROADMAPA-NAPRAW.md#k06) — Wydanie związane z dokładnie sprawdzonym artefaktem | K01, K02, K03 | M | K06-T1, K06-T2 |
| 6 | [K07](ROADMAPA-NAPRAW.md#k07) — Limit rzeczywistych bajtów przed parserem | K03, K06 | M | K07-T1, K07-T2 |
| 7 | [K08](ROADMAPA-NAPRAW.md#k08) — Świeże potwierdzanie wrażliwych operacji panelu | K05, K06 | M | K08-T1, K08-T2 |
| 8 | [K10](ROADMAPA-NAPRAW.md#k10) — Odmowa dostępu przed metadanymi premiery | K03, K06 | S | K10-T1, K10-T2 |
| 9 | [K11](ROADMAPA-NAPRAW.md#k11) — Uprawnienie liczone z wkładów poszczególnych wpłat | K01, K03, K05, K06 | L | K11-T1, K11-T2, K11-T3 |
| 10 | [K12](ROADMAPA-NAPRAW.md#k12) — Agregat wpłat niezależny od kolejności refund/dispute | K11 | M | K12-T1, K12-T2 |
| 11 | [K13](ROADMAPA-NAPRAW.md#k13) — Błędy usuwania S3 per obiekt | K03, K06 | S | K13-T1, K13-T2 |
| 12 | [K14](ROADMAPA-NAPRAW.md#k14) — Zatrzymanie i zakończenie transferów przed cleanup | K13 | M | K14-T1, K14-T2 |
| 13 | [K15](ROADMAPA-NAPRAW.md#k15) — Monotoniczne ukończenie wersji oryginału | K03, K06 | M | K15-T1, K15-T2 |
| 14 | [K16](ROADMAPA-NAPRAW.md#k16) — Tożsamość próby i odrębne prefiksy kodowania | K14, K15 | M | K16-T1, K16-T2 |
| 15 | [K17](ROADMAPA-NAPRAW.md#k17) — Atomowe odcięcie skutków starego workera | K16 | L | K17-T1, K17-T2 |
| 16 | [K18](ROADMAPA-NAPRAW.md#k18) — Granica COMMIT i ochrona już aktywowanego HLS | K17 | M | K18-T1, K18-T2 |
| 17 | [K19](ROADMAPA-NAPRAW.md#k19) — Wspólny protokół aktywacji i wycofywania HLS | K13, K17, K18 | L | K19-T1, K19-T2 |
| 18 | [K20](ROADMAPA-NAPRAW.md#k20) — Kontekst właściwego kanału podczas auto-publish | K17, K18, K19 | M | K20-T1, K20-T2 |
| 19 | [K24](ROADMAPA-NAPRAW.md#k24) — Odwołanie powiązane z tożsamością decyzji | K03, K05, K06 | M | K24-T1, K24-T2 |
| 20 | [K25](ROADMAPA-NAPRAW.md#k25) — Limit playlist odporny na współbieżność | K03, K06 | S | K25-T1, K25-T2 |
| 21 | [K26](ROADMAPA-NAPRAW.md#k26) — Usunięcie konta a własność i publiczny profil kanału | K05, K19, K24 | L | K26-T1, K26-T2 |
| 22 | [K04](ROADMAPA-NAPRAW.md#k04) — Wąskie importy i jawne składanie infrastruktury | K03 | M | K04-T1, K04-T2 |
| 23 | [K21](ROADMAPA-NAPRAW.md#k21) — Wąski wspólny kontrakt upload/job/playback | K03, K04, K05 | M | K21-T1, K21-T2 |
| 24 | [K22](ROADMAPA-NAPRAW.md#k22) — Wznowienie uploadu w Studio z istniejącego silnika | K14, K15, K20, K21 | M | K22-T1, K22-T2 |
| 25 | [K23](ROADMAPA-NAPRAW.md#k23) — Trwały zamiar powiadomienia razem z publikacją | K20 | M | K23-T1, K23-T2 |
| 26 | [K28](ROADMAPA-NAPRAW.md#k28) — Polityka cofania sesji WWW i krytyczne operacje | K05, K08 | M | K28-T1, K28-T2 |
| 27 | [K29](ROADMAPA-NAPRAW.md#k29) — Polityka cofania HLS obejmująca token i cache | K05, K10, K11, K19, K28 | M | K29-T1, K29-T2 |
| 28 | [K27](ROADMAPA-NAPRAW.md#k27) — Kompletność eksportu danych i wersja kontraktu | K05, K11, K26 | M | K27-T1, K27-T2 |
| 29 | [K34](ROADMAPA-NAPRAW.md#k34) — Fokus dialogu również podczas busy | K03 | S | K34-T1, K34-T2 |
| 30 | [K30](ROADMAPA-NAPRAW.md#k30) — Funkcjonalny monitoring własnego filmu | K06, K17, K19, K20 | M | K30-T1, K30-T2 |
| 31 | [K31](ROADMAPA-NAPRAW.md#k31) — Trwałe ponowienie powiadomienia recovery watchdog | K03, K30 | M | K31-T1, K31-T2 |
| 32 | [K33](ROADMAPA-NAPRAW.md#k33) — Minimum kontroli rzeczywistych kosztów i retencji | K05, K13, K19, K30 | M | K33-T1, K33-T2 |
| 33 | [K09](ROADMAPA-NAPRAW.md#k09) — Kontrolowana degradacja ochrony auth przy awarii Redis | K05, K06 | M | K09-T1, K09-T2 |
| 34 | [K35](ROADMAPA-NAPRAW.md#k35) — Mały zestaw pełnych podróży i granic odmowy | K06, K07, K10, K20, K30, K34 | L | K35-T1, K35-T2, K35-T3 |
| 35 | [K32](ROADMAPA-NAPRAW.md#k32) — Odtworzenie całego produktu wyłącznie z kopii poza hostem | K03, K11, K12, K19, K26, K27 | L | K32-T1, K32-T2, K32-T3 |
| 36 | [K36](ROADMAPA-NAPRAW.md#k36) — Pełne zadania dostępności i świadoma decyzja o zoom | K05, K34, K35 | M | K36-T1, K36-T2 |
| 37 | [K37](ROADMAPA-NAPRAW.md#k37) — Eksport dużej historii w ograniczonym budżecie zasobów | K27, K33 | M | K37-T1, K37-T2 |
| 38 | [K38](ROADMAPA-NAPRAW.md#k38) — Poprawny generator i odbiór pomiaru obciążenia | K03, K33, K35 | M | K38-T1, K38-T2 |
| 39 | [K39](ROADMAPA-NAPRAW.md#k39) — Pomiar celu 10 tys. widzów i plan wąskich usprawnień | K17, K19, K30, K33, K38 | L | K39-T1, K39-T2 |
| 40 | [K40](ROADMAPA-NAPRAW.md#k40) — Przyszły marketplace: tożsamość refundu i uzgodnienie operatora | K11, K12, K35 | L | K40-T1, K40-T2 |

K02 i K01 można rozpocząć równolegle; K05 nie musi czekać na narzędzia. Ścieżka finansowa K11→K12 jest niezależna od napraw procesora K13→K14 i K15→K16→K17→K18→K19→K20, ale oba odbiory spotykają się w K35 i K32. K34 można przesunąć wcześniej po K03. K04 jest zależnością kontraktów, którą można odroczyć tylko z uzasadnieniem, jeśli nie blokuje ich izolacji. R34 nie opóźnia pilnej poprawki R01.

Zależności dotyczą pełnego profilu docelowego. W profilu z płatnościami OFF dopuszczalne odroczenie K11/K12 przy K27/K29/K32 wymaga dowodu wyłączenia wszystkich wejść i zapisania zakresu. Późniejsze ON automatycznie wymaga brakujących testów i ponownego odbioru. Odroczenie oznacza ODROCZONE_DLA_PROFILU, nie PASS ani pełne zamknięcie ustalenia.

## 3. Siedem ścieżek pogłębionej weryfikacji do zatwierdzenia

### W01 — środowisko i blokady testowe (H1)

Odpowiedzialność: maintainer środowiska/testów. K01/K03; dane wyłącznie syntetyczne. Przejść wspieraną konfigurację dostępu do binaries.prisma.sh i sprawdzić jej faktyczne zastosowanie. Poprzednia odmowa CONNECT 403 nie znika od samego zapisu draftu. Nie używać dummy client, nie wyłączać TLS/checksum. Dotychczasowe odrzucenie wysłania grafu npm audit pozostaje ograniczeniem; nie omijać go innym klientem/registry. Publiczne advisory i lokalne wersje można analizować w zatwierdzonym zakresie bez takiego wysyłania.

Na świeżej bazie uruchomić silnik migracji i prawdziwy klient; istniejącej badawczej bazy raw SQL nie przedstawiać jako prawidłowej historii Prisma. Zinwentaryzować zależności runtime i fixture, uruchomić wymagane testy z kontrolą, że naprawdę się zarejestrowały. Odbiór: K01-T1–T3, K03-T1–T3 i rozliczenie każdego wyniku baseline. Jeżeli blokada pozostaje, kontynuować niezależne przygotowanie kandydata K02, ale nie nazywać wydania sprawdzonym.

### W02 — potwierdzenie i podważanie R01–R37 (H1–H4)

Odpowiedzialność: autor naprawy i oddzielny recenzent techniczny przy ważnych protokołach. Przy każdym pakiecie przejrzeć źródłowy dowód i kontrargumenty, wykonać najtańszą próbę rozstrzygającą, następnie pełną właściwą granicę. Najpierw ważne pieniądze/wideo, potem reszta aktywnego profilu. Import DO_WERYFIKACJI wymaga drugiego przeglądu, nie automatycznego nowego błędu.

Dla potwierdzonego błędu uzyskać RED odtwarzający niepożądany efekt i działającą kontrolę dodatnią, potem GREEN po poprawce. Dla ryzyka najpierw zweryfikować ekspozycję/pomiar, dla decyzji uzgodnić oczekiwany wynik. Jeżeli świadek nie odtwarza się, zachować wynik i rozstrzygnąć rozbieżność, zamiast dopasować kod/test do tezy. Odbiór: macierz 37 ustaleń rozliczona jako naprawione w określonym zakresie, obalone dowodem, świadomie przyjęte ryzyko, odroczone warunkowo lub nadal zablokowane — nie sztucznie wszystko CLOSED.

### W03 — ASVS i kompletność powierzchni wejść (od H3, etapami)

Odpowiedzialność: reviewer bezpieczeństwa. Wznowienie wyłącznie po odrębnej decyzji właściciela. Punkt startu: 55 rozpoczętych i 290 niezbadanych pozycji, 79 rozpoczętych i 207 niezbadanych wejść. Najpierw sprawdzić zamrożoną, niezwalidowaną partię 17 względem aktualnych plików i dowodów; nie rozpakowywać jej automatycznie nad nowym stanem i nie adoptować statusów bez przeglądu.

Podzielić kolejne kontrole według aktywnych przepływów: encoding/walidacja i pliki/URL, tożsamość/CSRF/cache, autoryzacja/tenant, pieniądze/administracja, tokeny/Worker, dane/logi/sekrety i konfiguracja. Dla każdej pozycji zapisać stosowalność, granicę, źródło, wykonaną próbę, ograniczenie i uzasadnienie wyniku. Dla każdego wejścia legalna kontrola, odmowa i brak skutku. Nowe ryzyko krytyczne może zmienić kolejność, ale wymaga jawnej aktualizacji roadmapy. Odbiór: brak nieopisanej luki w zatwierdzonym zakresie; pełne domknięcie programu jest późniejszym celem, nie warunkiem napisania v1.

### W04 — pełne integracje produktu i awarie (H2–H4)

Odpowiedzialność: backend/video/QA. Z rzeczywistym Prisma/PostgreSQL przejść API i Server Actions, browser, storage SDK, encoder oraz procesy. Osobno provider wyłącznie test-mode. Wymuszać bariery współbieżności, kill/restart, opóźniony PUT/delete, odrzucenie audytu, przerwę commit→enqueue, replay webhooka, spóźniony refund i cofnięte role/sesje. Zachować kontrolę normalnego przebiegu i odmowy cudzych zasobów.

S3-emulator nie rozstrzyga wszystkich zachowań R2/edge; wymagające ich próby oznaczyć i później wykonać na autoryzowanym własnym sandboxie. Nie wysyłać prawdziwych maili/płatności. Odbiór: K11–K29/K35 według aktywnego profilu, pliki + DB + odtwarzanie zgodne, zebrane logi/redakcja i usunięte własne fixture.

### W05 — odzyskanie, monitoring, koszty i pojemność (H4–H5)

Odpowiedzialność: operations i właściciel budżetu. Najpierw liczby RPO/RTO/SLO i zakres zasobów; potem offsite-only drill K32, sygnał→własny odbiornik→recovery K30/K31, inventory/koszt K33. Naprawiony verifier nie zastępuje restore całego produktu. Monitoring musi wykrywać brak mediów i stale dane, nie tylko HTTP 200.

K38 poprzedza nowy pomiar K39. Własne reprezentatywne środowisko, ramp/soak, hard stop kosztu/obciążenia, cold/warm cache, mix widzów i kodowania. Bez testów obciążenia cudzej infrastruktury lub produkcji w ramach ogólnej zgody na audyt. Potrzebne zewnętrzne zasoby i koszty przedstawić jako konkretny plan do odrębnej zgody. Odbiór: pomiar progu, koszt i awarie z rzeczywistym artefaktem; wynik mniejszej skali nie jest PASS dla 10000.

### W06 — dostępność i jakość pełnych zadań (H4–H5)

Odpowiedzialność: UX/a11y i osoby weryfikujące języki. K34/K36 oraz zakres D15. Prawdziwy routing, konta, błędy, mobile, klawiatura i screen reader, zoom/reflow i reduced motion; osobno krytyczne teksty pieniędzy/dostępu. Wczesny komponentowy test nie zamyka WCAG ani całego produktu. Zachować zamrożone intro/logo/zoom do oddzielnej decyzji właściciela. Odbiór: lista konkretnych ukończonych zadań, barier i przyjętych decyzji; nie arbitralna ocena w punktach.

### W07 — niezależny odbiór, regresje i domykanie D01–D18 (H2–H5+)

Odpowiedzialność: recenzent niezależny od autora ważnej zmiany, wskazany w zatwierdzonym harmonogramie. [DOMKNIECIE-DOWODOW.csv](program-audytu/DOMKNIECIE-DOWODOW.csv) pozostaje listą otwartych zakresów; mapa z sekcji 6 roadmapy obejmuje wszystkie 18. Oddzielać poprawienie konkretnego R od domknięcia obszaru. Sprawdzić, czy test naprawdę wykrywa zły efekt, zwłaszcza pieniądze, aktywację i restore; nie uruchamiać kosztownego ogólnego mutation testing bez potrzeby.

Odbiór pakietu nie wymaga recertyfikacji całego systemu. Odbiór uruchomienia wymaga kompletnych dowodów jego aktywnego profilu oraz jawnej listy ryzyk/niezbadanych wymagań; pełny audyt wymaga późniejszego domknięcia całego uzgodnionego zakresu. Każdy ma osobną decyzję i nie może być zamieniony samą liczbą testów.

## 4. Protokół wykonania jednego pakietu przez przyszłego agenta

1. **Wejście**: przeczytać aktualny STAN, instrukcje repo i kartę K; potwierdzić zatwierdzony zakres, SHA aplikacji, zależności i aktywne flagi. Uzgodnienia właściciela zapisać jako konkretne oczekiwane zachowanie. Sama roadmapa v1 nie daje zgody na naprawy.
2. **Izolacja**: mała gałąź naprawy/PR zgodna z instrukcjami repo; główna gałąź audytu przechowuje ustalenia i linki do wyników. Nie mieszać niepowiązanych zmian. Jedna odpowiedzialność za pliki schematu i wspólne kontrakty. Nie scalać nic automatycznie.
3. **Dowód przed zmianą**: odtworzyć właściwy przypadek i legalną kontrolę. Jeśli zablokowany, oznaczyć BLOCKED i usunąć konkretną blokadę; nie zastępować pełnego testu atrapą bez ujawnienia ograniczenia.
4. **Minimalna implementacja**: istniejące rozwiązanie rozszerzyć w określonych modułach. Dla L najpierw kontrakt/migracja, potem kompatybilny kod, następnie kontrolowane włączenie; nie oddzielać krytycznej atomowości na niezgodne części. Nowy szerszy problem dopisać do rejestru i przedstawić wpływ na plan.
5. **Weryfikacja**: wszystkie Kxx-Tn, odpowiednie istniejące testy, typy/build/lint/quality wymagane przez repo. Najpierw tanie celowane próby, potem właściwa integracja i pełna wymagana bramka przed wydaniem. Nie powtarzać kosztownych prób bez zmiany lub konkretnej niewiadomej.
6. **Odbiór techniczny**: recenzent ważnych pieniędzy/wideo/migracji sprawdza kod, dowód RED→GREEN, kontrargumenty, odmowę bez skutku, rollback i zgodność wersji. Wynik jednoznaczny: ACCEPTED_TECHNICALLY, BLOCKED albo CHANGES_REQUIRED, z zakresem dowodu.
7. **Zapis**: commit, raport testów z SHA/digest i wersjami usług, wynik kontrolny, jawne skip/blockers, plan cofnięcia. Ustalenie zamknąć dopiero w sprawdzonym zakresie; zaktualizować CSV/stan/historię i powiązać PR. PeerTube/reference nie jest dowodem własnego działania.
8. **Decyzja właściciela**: krótko objaśnić efekt i pozostałe ryzyko. Zatwierdzenie techniczne nie jest wdrożeniem. Produkcyjne migracje/korekta danych, scalenie, publikacja, koszty i otwarcie profilu mają późniejszą osobną konkretną decyzję.

Zalecane stany planu: PLAN_DO_ZATWIERDZENIA → ZATWIERDZONO_ZAKRES → W_REALIZACJI → WERYFIKACJA → ODEBRANO_TECHNICZNIE → GOTOWE_DO_ODRĘBNEJ_DECYZJI_O_WYDANIU. Równoległe etykiety: BLOCKED, ODROCZONE_DLA_PROFILU, WYMAGA_DECYZJI. Wdrożenie i pełne zamknięcie audytowe mają własny dowód. Obecnie **wszystkie pakiety są w pierwszym stanie**.

## 5. Migracje, backfill i bezpieczne cofanie

- **K11/K12**: najpierw jawny model wkładów i polityka, potem addytywny schemat i kod czytający zgodne wersje. Read-only backfill dry-run porównuje stare/nowe prawa i sumy, oznacza niejednoznaczności. Wykonanie korekty na prawdziwych danych dopiero po osobnym zatwierdzeniu zakresu i planu odzyskania; żadnych automatycznych refundów, obciążeń ani odebrań na podstawie zgadywania.
- **K15–K19/K24**: nowy stan/wersja próby lub decyzji musi mieć kontrakt dla starych rekordów. Przed wymuszeniem fencing/retirement kontrolowanie wygasić niezgodne workery i stare procesy. Sprawdzić restart i rollout mieszanych wersji; stary worker nie może obejść nowego protokołu. Nie wykonywać zewnętrznego długiego I/O w transakcji trzymającej lock.
- **K26/K27**: najpierw zatwierdzona retencja/transfer; raport wpływu na kanały, role i media. Usuwanie danych osobowych nie może zniszczyć cudzej własności. Nowe kategorie i model wkładów muszą wejść do eksportu.
- **K32**: odtworzenie schematu i danych nie kończy się na db up. Potrzebne role, klucze, media, kolejki, sesje i test-mode reconciliation zdarzeń po snapshot. Lokalny backup na tym samym utraconym hoście nie jest ścieżką offsite.

Preferowany rollout: expand → kompatybilny kod → zweryfikowany backfill → kontrola niezgodnych procesów → włączenie → obserwacja → dopiero później ewentualny contract. Każdy krok ma zapisany punkt zatrzymania. Cofnięcie kodu nie odwraca automatycznie migracji lub usunięcia plików. Jeżeli rollback nie jest bezpieczny, plan określa roll-forward/restore i koszt utraty danych. Wszystko to jest planem przyszłych działań, nie ich wykonaniem.

## 6. Zatwierdzanie i zmiana kolejności

Właściciel może zatwierdzić H1 i zakres dalszej weryfikacji, pozostawiając późniejsze kamienie do ponownego przeglądu po dowodach. Proponowane pierwsze zlecenie po zatwierdzeniu: **K01 + K02 + niezbędne decyzje K05, potem K03 i K06**, z raportem gotowości do H2. Nie uruchamiać teraz żadnego z tych zadań.

Nowy potwierdzony krytyczny błąd, ujawniona aktywna ekspozycja lub niebezpieczna migracja zatrzymują zależną ścieżkę i wymagają jawnej rewizji kolejności. Opóźnienie dowodu nie usuwa go z planu. Zmiany priorytetu, zakresu lub przyjęcie ryzyka zapisywać w historii, bez nadpisywania historycznych wyników i bez zamiany BLOCKED na PASS.

Po publikacji roadmapy bieżące następne działanie brzmi: **oczekiwać na decyzję właściciela o roadmapie v1 i proponowanym harmonogramie**. Dalszy pogłębiony audyt pozostaje zaplanowany i tymczasowo wstrzymany. Nie podejmować samodzielnie następnej partii ASVS ani napraw.
