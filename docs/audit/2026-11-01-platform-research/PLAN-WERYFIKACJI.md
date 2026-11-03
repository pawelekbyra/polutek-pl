# Kolejne badania: jak rozstrzygnąć niewiadome

Ten plan uzupełnia RAPORT.md. Nie jest deklaracją, że poniższe testy zostały wykonane, ani zgodą na obciążanie produkcji.

## 1. Odzyskać wiarygodny punkt bazowy Polutka

Po zastosowaniu reguły sieciowej dla `binaries.prisma.sh` wykonać standardowe `npm ci` i `prisma generate`, bez ignorowania checksum. Uruchomić typecheck, pełny Vitest, istniejące testy PG i build obu aplikacji. Zapisać SHA, wersje Node/Postgres/FFmpeg, komendy, kody wyjścia, pominięcia i logi. Oddzielić niepowodzenia środowiska od niepowodzeń testów. Migracje uruchomić także przez właściwy silnik Prisma na kolejnej pustej bazie — badawcza baza SQL nie ma historii Prisma.

## 2. Zbudować wspólny scenariusz funkcjonalny

Każdy projekt na izolowanych danych i własnej konfiguracji testowej. PeerTube instalować przez przypięte pnpm i frozen lockfile, zgodnie z jego instrukcjami. Porównywać rdzeń VOD; nie wymagać od Polutka federacji ani od PeerTube własnej kasy Stripe.

Scenariusz: konto twórcy → kanał → upload → wznowienie → kodowanie → publikacja → oglądanie → komentarz → ukrycie → usunięcie → weryfikacja magazynu. Osobno: publiczny film i chroniony film zgodnie z modelem dostępu każdego produktu. Wynik testu opisuje wymagane zachowanie, a nie zgodność nazw endpointów.

## 3. Macierz awarii

| Miejsce przerwania | Oczekiwana własność |
|---|---|
| Upload części: timeout, błąd, utrata odpowiedzi po sukcesie | Brak ponownego wysyłania ukończonych części; znany stan sesji |
| Wygaśnięcie adresu PUT | Odświeżenie podpisu; brak obchodzenia autoryzacji |
| Po complete S3, przed zapisem READY | Ponowienie uzgadnia obiekt i stan bazy |
| Po READY, przed enqueue kodowania | Naprawa nie wymaga ręcznej edycji bazy |
| Worker zabity podczas download/encode/upload | Ograniczone ponowienia; brak równoległych właścicieli skutków |
| Stary worker wznawia po przejęciu zadania | Nie usuwa i nie aktywuje wyniku nowego właściciela |
| Jeden PUT zawodzi, inne kończą się później | Sprzątanie czeka na zakończenie operacji; brak osieroconych plików |
| Publikacja zatwierdzona, proces ginie przed powiadomieniem | Trwały zamiar zostaje dostarczony później |
| Batch DELETE zwraca częściowy błąd | Zadanie nie zgłasza pełnego sukcesu |
| Film usunięty równolegle z finalizacją kodowania | Nie powstaje dostępny film ani nieodnotowany zasób |
| Redis niedostępny | Znany tryb degradacji auth, limitów i kolejek |
| Cofnięcie dostępu / blokada filmu | Znany i dotrzymany czas unieważnienia nowych pobrań |
| Sukces operatora płatności, utrata odpowiedzi / awaria bazy | Jedna operacja pieniędzy, późniejsze uzgodnienie księgi |
| Brak miejsca, OOM, timeout FFmpeg | Kontrolowane zakończenie i czytelny komunikat twórcy |

Eksperymenty obecnego raportu potwierdziły wybrane ścieżki z atrapami. Tę macierz trzeba następnie wykonać z prawdziwymi lokalnymi usługami i kontrolowanymi awariami procesów/sieci.

## 4. Test izolacji twórców

Zestaw aktorów: gość; widz; właściciel kanału A; członek A z ograniczoną rolą; właściciel B; zawieszony użytkownik/kanał; moderator; administrator. Każdy próbuje odczytu i zmiany tych samych zasobów przez HTTP, a nie wyłącznie przez wywołanie funkcji policy.

Zasoby: film/szkic, upload i podpis części, zadanie encode, aktywny oryginał, miniatura, prywatne napisy, komentarz/moderacja, lista członków, statystyki, eksport, saldo i zwrot. Kontrola obejmuje odpowiedź, efekty w bazie/magazynie i informacje ujawnione w błędzie. Testy należy generować z macierzy uprawnień tam, gdzie to ogranicza ręczne pomyłki.

## 5. Uczciwy benchmark

Zapisać zasoby, konfigurację cache i baz, wersje i SHA. Generator ruchu nie powinien zabierać znaczącej części CPU testowanej aplikacji. Jeżeli działa na tej samej maszynie, wynik musi to uwzględniać.

Zestawy danych: mały katalog do smoke, następnie np. 10 tys. i 100 tys. filmów z kontrolowanym rozkładem kanałów i komentarzy. To proponowane wielkości testu, nie aktualna pojemność ani wymagania biznesowe. Liczba wierszy musi być realistyczna również dla sesji, subskrypcji i historii, nie tylko tabeli Video.

Mierzyć osobno:

- cold/warm home, search i listy kanałów;
- nowe sesje odtwarzania na sekundę, odnowienia tokenów i sygnały oglądania;
- równoległe oglądanie na edge i obciążenie control plane;
- uploady i długość kolejki kodowania pod ruchem widzów;
- opóźnienie fan-out przy rosnącej liczbie subskrybentów;
- czas eksportu, retencji i usuwania dużego konta;
- czas pierwszej klatki, rebuffering i zmianę jakości w rzeczywistej przeglądarce;
- opóźnienia p50/p95/p99, błędy, CPU, pamięć, połączenia DB, I/O i koszt.

Nie utożsamiać transferu segmentów w CDN z liczbą zapytań obsługiwanych przez Next/Express. Nie porównywać PeerTube z włączonym P2P do Polutka za Cloudflare bez opisania różnicy ścieżek i kosztów. Dwa uczciwe badania to: wspólny control plane VOD oraz osobne realistyczne topologie dostarczania filmu.

Stopniowo zwiększać ruch, wykonać dłuższy przebieg przy ustalonym poziomie i obserwować powrót po przeciążeniu. Progi SLO ustalić przed interpretacją wyników; nie wybierać ich po obejrzeniu wykresu.

## 6. Model kosztów

Osobne koszty: oryginały, HLS, stare wersje i backup; CPU kodowania i transkrypcji; transfer i operacje magazynu; API/baza/Redis; monitoring; poczta; prowizje i obsługa płatności; moderacja i wsparcie. Brak opłat za egress w jednym magazynie nie oznacza zerowego kosztu dostarczania całej platformy.

Raportować koszt na godzinę zakodowaną, godzinę obejrzaną, GB aktywnych danych i aktywnego twórcę. Oddzielić koszt stały od kosztu rosnącego z ruchem. Dopiero wtedy wybierać retencję, limity quota, profile kodowania i funkcje AI.

## 7. Weryfikacja odtwarzania i bezpieczeństwa operacyjnego

Odtworzyć platformę na pustej maszynie wyłącznie z kopii offsite i procedury. Zweryfikować bazę, klucze/konfigurację bez ich ujawniania, przykładowe oryginały, odtwarzanie, rozliczenia i działanie schedulerów. Zmierzyć rzeczywisty RPO/RTO. Osobno testować odbudowę HLS z oryginałów.

Przejrzeć uprawnienia infrastruktury według ról: web, encoder, cleanup, migrator, backup i analityka. Każda rola powinna mieć uzasadniony zakres. Środowisko testowe ma sprawdzać także odmowy, nie tylko możliwość wykonania operacji.

## 8. Badanie produktu

Zadania dla nowych widzów i twórców: wejście i start filmu; odnalezienie fragmentu; zmiana języka/napisów; założenie konta; upload przy zerwaniu; zrozumienie statusu przetwarzania; publikacja; odwołanie od moderacji; zakup i zwrot w trybie testowym. Mierzyć ukończenie, czas, liczbę błędów i powody rezygnacji. Uwzględnić klawiaturę, czytnik ekranu, powiększenie, reduced motion i słaby telefon.

To badanie może potwierdzić przewagę Polutka w prostocie. Sam przegląd kodu ani wygląd na komputerze autora jej nie potwierdza.
