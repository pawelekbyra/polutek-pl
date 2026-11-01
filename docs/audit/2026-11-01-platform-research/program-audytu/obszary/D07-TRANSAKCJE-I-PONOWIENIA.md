# D07 — transakcje i ponowienia

1 listopada 2026, partia 05. **W_TRAKCIE.** SHA aplikacji: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. [Skrypt SQL](../tools/database-integrity-experiment.py) i [wynik](../evidence/database-integrity-experiment.json) wykonano na prawdziwym lokalnym PostgreSQL 17.11. Protokoły odpowiadają przejrzanej kolejności i warunkom kodu; nie wykonują TypeScript/Prisma ani żądań HTTP.

## Wniosek dla właściciela

Transakcja chroni przed zapisaniem połowy jednej operacji. Odrębnie trzeba zadbać o to, co dwie operacje mogą przeczytać i zmienić równocześnie oraz czy opóźnione ponowienie nadal odnosi się do aktualnej wersji danych.

W tej partii potwierdzono na odtworzonym protokole SQL **R26: przekroczenie limitu playlist** i **R27: cofnięcie wyboru oryginału przez spóźnione ponowienie uploadu**. R27 ma większy wpływ na poprawność pipeline: film może wskazywać oryginał SUPERSEDED, podczas gdy nowszy plik jest READY. Nie potwierdzono zdarzenia na produkcji ani nie wykonano poprawek.

Wcześniejsze R02–R05 dotyczą skutków workera i storage, a [R25](D11-MODERACJA-I-NADUZYCIA.md) to pomylenie aktualnej decyzji po cyklu statusu. Zachowują swoje ID i dowody; nie policzono ich ponownie jako nowych ustaleń.

## R26 — COUNT nie egzekwuje limitu przy dwóch transakcjach

[Stała limitu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playlists/domain/playlist-rules.ts) wynosi 100 aktywnych playlist kanału. [createPlaylist](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playlists/application/playlist-manage.use-cases.ts#L52) sprawdza uprawnienie, wchodzi w transakcję, wykonuje countActive i dopiero potem tworzy wiersz. Nie ma tam wspólnego locka kanału ani wymuszenia silniejszej izolacji. Unikalność slugów obsługuje inny problem.

[Kontekst DB](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/shared/app-context.ts) wywołuje `$transaction(fn)` bez ustawienia izolacji. [Singleton Prisma](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/prisma.ts) również nie ustawia jej jawnie. W lokalnej bazie jest READ COMMITTED. Izolacji produkcyjnej i ewentualnych zewnętrznych zabezpieczeń nie odczytano.

Eksperyment korzysta z dwóch prawdziwych połączeń. Oba dotyczą jednego sztucznego kanału mającego 99 playlist, ale używają różnych slugów:

| Krok | Transakcja A | Transakcja B |
|---|---|---|
| Odczyt limitu | COUNT=99, wolno utworzyć | COUNT=99, wolno utworzyć |
| Zapis A | INSERT i COMMIT | Nadal ma wynik poprzedniego odczytu |
| Zapis B | Zakończona | INSERT i COMMIT |
| Wynik | Łącznie **101** aktywnych playlist zamiast maksymalnie 100 | |

Kontrola sekwencyjna na nowym kanale: A widzi 99 i tworzy setną; B uruchomione po jej zatwierdzeniu widzi 100 i nie tworzy następnej. Końcowy stan wynosi 100. Różnica wynika z nakładania operacji, a nie złego limitu w fixture. Nie potrzeba niepoprawnych identyfikatorów ani omijania autoryzacji; dwa legalne żądania mogą odczytać tę samą dostępną pojemność.

**Zakres pewności:** wykonano realne COUNT/INSERT/COMMIT w przejrzanej kolejności i z tym samym filtrem `channelId + deletedAt IS NULL`. Pominięto wykonanie TypeScript, gate HTTP, generowanie sluga i insert audytu. Różne slugi wykluczają kolizję niezwiązanego unique; zapis audytu nie jest widocznym mechanizmem serializacji per kanał. Nie odtworzono dwóch faktycznych żądań Studia przez Prisma. Ustalenie dotyczy odczytanego protokołu przy READ COMMITTED.

**P2:** to nieskuteczna granica produktu w warunkach współbieżności. Eksperyment wykazał 101, nie nieograniczony wzrost, awarię finansową czy wyciek. Priorytet rośnie, jeżeli podobny wzorzec chroni droższy zasób; nie zakładamy automatycznie, że wszystkie inne quota mają ten błąd.

**Dobry wzorzec istnieje już w Polutku:** [start uploadu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/original-upload.use-cases.ts#L93) bierze `pg_advisory_xact_lock` per kanał przed powtórnym sprawdzeniem limitów. W playlistach można rozważyć spójne użycie locka per kanał, zablokowany licznik albo silniejszą izolację z właściwymi ponowieniami. Nie wdrożono żadnego wariantu.

Test odbioru: dwa i więcej legalnych żądań dla kanału przy 99 playlistach; najwyżej jedno tworzy nową, pozostałe dostają oczekiwaną odmowę. Różne slugi, role i procesy, także soft delete i kolizja sluga. Po błędzie/retry limit i audyt pozostają zgodne.

## R27 — spóźnione ukończenie starej wersji cofa aktywny oryginał

[completeOriginalMultipart](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/original-upload.use-cases.ts#L212) obsługuje ponowienie po sukcesie. Najpierw ładuje oryginał. Jeżeli w odczytanym obiekcie `status=READY`, „naprawia” wskaźnik Video.activeOriginalId, gdy jest pusty lub inny. Ten zapis nie sprawdza aktualnego statusu/wersji oryginału ani tego, czy w międzyczasie zakończyła się nowsza wersja.

Normalne ukończenie nowego uploadu atomowo oznacza nowy oryginał READY, poprzednie READY jako SUPERSEDED i przestawia activeOriginalId. To sensowna ochrona tej ścieżki. Odrębna gałąź ponowienia może jednak zapisać wskaźnik później, na podstawie wcześniejszego odczytu.

Odtworzony przeplot dwóch połączeń:

1. Film wskazuje oryginał v1 w stanie READY. Spóźnione ponowienie A odczytuje v1=READY i zatrzymuje się przed zapisem wskaźnika.
2. Nowszy upload B kończy się: w jednej transakcji v2 staje się READY, v1 SUPERSEDED, wskaźnik filmu przechodzi na v2. COMMIT.
3. A kontynuuje gałąź dla odczytanego wcześniej READY. Warunek widzi, że wskaźnik jest „inny”, więc przestawia go na v1.
4. Stan końcowy: **active_version=1, active_status=SUPERSEDED**. v2 pozostaje gotowe, ale nie jest aktywnym oryginałem.

Kontrole: zwykłe ponowienie bez nowszego ukończenia zachowuje v1 READY; samo ukończenie nowej wersji prawidłowo wskazuje v2 READY. Błędny stan powstaje po opóźnionym zapisie wskaźnika. Gdy stare żądanie dopiero po ukończeniu B wykona świeży pierwszy odczyt, zobaczy SUPERSEDED i nie wejdzie w tę gałąź; **nieaktualny wcześniejszy odczyt jest warunkiem problemu**.

Po zmianie wskaźnika aplikacja wywołuje [enqueueEncode](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/encode-queue.use-cases.ts#L89), które ponownie odczytuje oryginał i wymaga READY. W eksperymencie SQL odczyt w tym miejscu zwraca SUPERSEDED. Z przejrzanego kodu wynika odmowa `ORIGINAL_NOT_READY`; wcześniejsza zmiana wskaźnika jest już poza tą transakcją i ta odmowa jej nie cofa. Samej funkcji enqueue nie uruchomiono w tym eksperymencie.

**P1 przed szerszym użyciem pipeline.** Może zostać niespójny wybór źródła i odmowa kolejnego kodowania. Nie wykazano automatycznej awarii bieżącego odtwarzania: activePlaybackRouteId jest osobnym wskaźnikiem. Nie wykazano utraty pliku, przekroczenia uprawnień ani zdarzenia na produkcji. Warunkiem jest ponowienie starego ukończenia nakładające się na ukończenie nowej wersji tego samego filmu, np. między legalnymi kartami/żądaniami. Możliwe późniejsze ponowienie dla v2 może przywrócić poprawny wskaźnik, lecz kod nie gwarantuje automatycznego wykonania tej naprawy.

Kierunek poprawy: aktualność i wybór wersji muszą być rozstrzygane spójnie w normalnym ukończeniu i ponowieniu. Rozważyć wspólny lock/warunek wersji oraz CAS obejmujący status i tożsamość aktualnego źródła. Ponowienie dawnej, zakończonej operacji powinno zwrócić jej stan lub bezpieczną odmowę, zamiast reaktywować zastąpiony plik. Trzeba osobno zapewnić odtwarzalne kolejkowanie po sukcesie DB i awarii przed enqueue. Nie zmieniono implementacji.

Test odbioru: pełny stos i dwa żądania z kontrolowanym zatrzymaniem A po odczycie READY, ukończenie v2, wznowienie A. Wskaźnik pozostaje na v2 READY; stare żądanie nie odwraca wersji. Obejmować także zwykły retry, świeże żądanie dla SUPERSEDED, przerwanie/abandon, kolejkę aktywną i crash między zatwierdzeniem a enqueue.

## PostgreSQL i PeerTube jako punkty odniesienia

Oficjalną [dokumentację PostgreSQL 17](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/mvcc.sgml) sprawdzono online; zachowano [kopię](../sources/postgresql-17-mvcc.sgml), [notę licencyjną](../sources/postgresql-17-COPYRIGHT.txt) oraz [adresy i hashe](../sources/fetch-postgresql-batch05.json). Fragment Read Committed wyjaśnia widok danych z początku instrukcji, a rozdział o ponowieniach wymaga obsługi m.in. SQLSTATE 40001 przy silniejszej izolacji. Samo ustawienie SERIALIZABLE bez polityki ponowień nie jest kompletną poprawką. Źródło to gałąź dokumentacji 17, nie deklaracja identycznego commitu serwera 17.11.

W PeerTube [helpery DB](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/helpers/database-utils.ts) mają jawne narzędzia izolacji i ponowień; `saveInTransactionWithRetries` domyślnie wybiera SERIALIZABLE, a osobny helper READ COMMITTED pozostaje dostępny. [Tworzenie playlisty](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/controllers/api/video-playlist.ts#L219) używa wrappera ponowień. Nie wykazano, że odpowiada to limitowi 100 z Polutka ani że PeerTube jest odporny na identyczny przypadek. To wzorzec jawnej polityki transakcji, nie gotowy dowód przewagi ani fragment do bezpośredniego skopiowania.

Do zamknięcia D07 pozostają: rzeczywiste funkcje/Prisma/HTTP, aktualny stan produkcji, pozostałe retry i awarie po commit, wyścigi workerów i cleanup, unieważnianie uprawnień w trakcie operacji, blokady/deadlocki, priorytety kolejki i testy restartów. R26/R27 mają dowody protokołu SQL i propozycje odbioru; niezależny przegląd nadal PENDING.

Uzupełnienie partii 06: [D08](D08-UPLOAD-KODOWANIE-I-USUWANIE.md) opisuje R28 (awaria audytu po zatwierdzeniu aktywacji), R29 (aktywacja podczas usuwania) i rozszerzenie R02 na rzeczywisty finalizer/serwis tras. Wykonano 11 obserwacji komponentów z atrapami oraz osobno trzy protokoły PostgreSQL; pełnego stosu nie wykonano. Zakończona transakcja aktywacji nie zostaje cofnięta przez późniejszy błąd audytu, a poprawne odrzucenie statusu starego workera nie odwraca już aktywowanej trasy.
