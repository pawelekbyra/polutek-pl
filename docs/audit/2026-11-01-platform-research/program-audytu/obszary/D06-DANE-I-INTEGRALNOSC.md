# D06 — dane i integralność

1 listopada 2026, partia 05. **W_TRAKCIE.** Kod: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. Wykonano bezpośrednie SQL na istniejącej lokalnej bazie badawczej PostgreSQL 17.11, zbudowanej we wcześniejszej partii przez 81 migracji SQL. Nie użyto Prisma, aplikacji Next ani produkcji.

## Wniosek dla właściciela

Baza Polutka ma działające zabezpieczenia: odrzuca wskazanie nieistniejącego filmu, powtórzoną wersję oryginału, powtórzony klucz zadania i duplikat filmu na playliście. Triggery odrzucają zmianę/usunięcie decyzji moderacyjnej oraz niedozwoloną zmianę/niedawną kasację audytu. To sprawdzono na prawdziwym PostgreSQL, nie na atrapie.

Są też granice tych zabezpieczeń. Część kluczy obcych potwierdza istnienie wiersza, ale nie to, że wskazany oryginał/asset/trasa należy do tego samego filmu. Tego pilnują wybrane sprawdzenia w kodzie. Nie oznacza to automatycznie dostępnego ataku przez HTTP; pokazuje, jakich błędów aplikacji sama baza nie zatrzyma.

W [D07](D07-TRANSAKCJE-I-PONOWIENIA.md) opisano dwa konkretne problemy z protokołami zapisu: R26 pozwala przekroczyć limit playlist przy nakładających się transakcjach, a R27 pozwala opóźnionemu ponowieniu ukończenia uploadu wskazać zastąpiony już oryginał. Oba odtworzono przez SQL zgodny z przejrzaną kolejnością/warunkami kodu; samych funkcji TypeScript i Prisma nie wykonano.

## Środowisko i zakres dowodu

[Skrypt](../tools/database-integrity-experiment.py), [wynik](../evidence/database-integrity-experiment.json) i [katalog bazy](../evidence/database-catalog-batch05.json). Dostęp wyłącznie przez lokalny socket Dockera do `polutek-cloud-db`. Skrypt wymaga nazwy bazy `polutek_research_*` z wcześniejszego manifestu. Nie czyta sekretów aplikacji i nie łączy się z serwerem produkcyjnym.

- Serwer: PostgreSQL `17.11 (Debian 17.11-1.pgdg13+2)`; obserwowana izolacja domyślna READ COMMITTED.
- Katalog **13 wybranych tabel**: 30 ograniczeń, 66 indeksów i 5 jawnych triggerów. To nie katalog całych 71 modeli ani pełna ocena wszystkich indeksów.
- 15 prób integralności: każda udana mutacja próbna jest cofana wewnątrz funkcji tymczasowej; cały zestaw danych testowych dodatkowo kończy się ROLLBACK.
- Osobne próby transakcyjne używają losowych fixture; po pomiarze usunięto dokładnie ich kanały/użytkowników i dane zależne. Nie zmieniono schematu publicznego, triggerów ani poziomu ochrony.
- Sprawdzono konkretny SQLSTATE i nazwę ograniczenia tam, gdzie dotyczy. Błąd innego rodzaju nie jest uznawany za potwierdzenie oczekiwanego zabezpieczenia.

Badana baza nie ma historii migracji Prisma i nie jest kopią produkcji. Poprzedni wynik 81/81 potwierdza wykonanie SQL w kolejności na pustej bazie; nie potwierdza aktualizacji istniejących danych, rollbacku wdrożenia, braku driftu produkcji ani zgodności wygenerowanego klienta Prisma.

## Wyniki 15 prób

| ID | Sprawdzenie | Wynik rzeczywistej bazy |
|---|---|---|
| D06-01 | Asset wskazuje nieistniejący film | Odrzucony: 23503, VideoAsset_videoId_fkey |
| D06-02 | Drugi oryginał z tym samym videoId i version | Odrzucony: 23505, VideoOriginal_videoId_version_key |
| D06-03 | Drugie zadanie z tym samym idempotencyKey | Odrzucone: 23505, VideoEncodeJob_idempotencyKey_key |
| D06-04 | Ten sam film drugi raz w tej samej playliście | Odrzucony: 23505, PlaylistItem_playlistId_videoId_key |
| D06-05 | Aktywny oryginał filmu A należy do B | SQL zaakceptowany; brak pełnego sprawdzenia przynależności w tej relacji DB |
| D06-06 | Aktywna trasa filmu A należy do B | SQL zaakceptowany |
| D06-07 | Trasa filmu A wskazuje asset filmu B | SQL zaakceptowany |
| D06-08 | Zadanie filmu A wskazuje oryginał filmu B | SQL zaakceptowany |
| D06-09 | Playlista kanału A zawiera film kanału B | SQL zaakceptowany |
| D06-10 | Druga trasa ACTIVE dla jednego filmu | SQL zaakceptowany |
| D06-11/12 | UPDATE / DELETE decyzji moderacyjnej | Odrzucone przez trigger, P0001 |
| D06-13/14 | Zmiana treści audytu / usunięcie świeżego wpisu | Odrzucone przez trigger, P0001 |
| D06-15 | Wyzerowanie ip/userAgent audytu | Dozwolone zgodnie z udokumentowanym wyjątkiem anonimizacji |

Sześć zaakceptowanych niepoprawnych powiązań/stanów to **obserwacje granicy DB**, nie sześć nowych dowiedzionych luk aplikacji. W przykładach spełnione są pozostałe ograniczenia, w tym unikalność wskaźników. Przykładowo unique activeOriginalId blokuje jednoczesne wskazanie tego samego oryginału przez dwa filmy, ale nie wymusza zgodności `Video.id=VideoOriginal.videoId`.

## Gdzie odpowiedzialność przejmuje aplikacja

| Niezmiennik | Ochrona w bazie | Przejrzana kontrola aplikacyjna / niewiadoma |
|---|---|---|
| Oryginał należy do wskazanego filmu | Oddzielny FK po videoId; wskaźnik aktywnego oryginału ma własny FK/unique | `loadUploadingOriginal` i enqueue filtrują id+videoId. Aktualność aktywnego oryginału podczas retry: R27 |
| Asset i trasa dotyczą tego samego filmu | Oddzielne FK; brak złożonego warunku przynależności | `activateRoute` jawnie sprawdza asset.videoId. Nie zamknięto całej współbieżności finalizera i usuwania |
| Zadanie ma właściwy oryginał i kanał | Osobne FK do filmu i oryginału; channelId to denormalizacja | enqueue sprawdza originalId+videoId i zapisuje kanał z filmu. Worker działa z silnym aktorem system, więc przekazanie kontekstu i fencing są istotne: R02/R23 |
| Film playlisty należy do kanału playlisty | Dwa oddzielne FK; unique para playlistId+videoId | `findInChannel` i `findChannelVideo` oraz wcześniejszy eksperyment odmów między kanałami |
| Jedna aktywna trasa/wybrany asset | Unikalny wskaźnik na Video; brak wymuszenia pojedynczego wiersza ACTIVE | Kod utrzymuje wskaźnik i stany; nie odtworzono w tej partii wyścigu rzeczywistych finalizerów |
| Decyzja i audyt zachowują historię | Sprawdzone triggery wybranych mutacji | Zapis wyniku odwołania jako nowej decyzji jest dobry; nie eliminuje R25, który dotyczy aktualnego skutku |

Źródła: [schema](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/prisma/schema.prisma), [oryginały](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/original-upload.use-cases.ts), [enqueue](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/encode-queue.use-cases.ts), [aktywacja trasy](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/application/video-playback-route.service.ts), [repozytorium playlist](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playlists/infrastructure/playlist.repository.ts).

## Ocena i dalsze badanie

Warto rozważyć silniejsze ograniczenia tam, gdzie pomylenie relacji miałoby duży wpływ. Złożony FK, constraint lub trigger muszą pasować do cyklu życia danych, kasowania i istniejących rekordów. Brak złożonego FK sam w sobie nie dowodzi BOLA, a jego dodanie nie naprawi każdej pomyłki wersji stanu. R27 dotyczy dwóch oryginałów tego samego filmu, więc samo wymuszenie przynależności do filmu nie rozwiąże problemu.

Nie wyłączano triggerów dla wygody testu. Pozytywne wyniki chronią przed badanymi zwykłymi instrukcjami SQL; nie dowodzą odporności na administratora DB, który może zmienić schemat, uprawnienia albo sam trigger. Nie zweryfikowano uprawnień ról produkcyjnych. Dla LedgerEntry odczytano definicję triggera w katalogu, ale nie wykonano prób na księdze finansowej w tej partii.

Do zamknięcia D06: pozostałe tabele i CHECK/FK, soft/hard delete i kaskady, indeksy według realnych zapytań, migracje na danych i rollback wdrożenia, drift/Prisma, blokady i izolacja, pieniądze/księga, eksport/retencja oraz odtworzenie z backupu. Wyniki SQL w tej partii rozszerzają dowody; nie zamykają audytu bazy.

Uzupełnienie partii 06: [trzy protokoły PostgreSQL](../evidence/playback-cascade-experiment.json) potwierdziły COMMIT aktywacji oraz kaskadowe usunięcie trasy po DELETE jej assetu, z wyzerowaniem wskaźnika i bez przywrócenia poprzedniego isPrimary. Są dowodem skutku FK dla [R28/R29 w D08](D08-UPLOAD-KODOWANIE-I-USUWANIE.md), a nie wykonaniem całych funkcji Prisma ani awarii audytu na prawdziwej DB.
