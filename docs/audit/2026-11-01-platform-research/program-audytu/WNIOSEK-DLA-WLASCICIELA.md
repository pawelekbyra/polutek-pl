# Co już wiemy o Polutku

## Aktualizacja stanu pokrycia — 15 listopada 2026

Ta aktualizacja uzgadnia stan programu po lokalnych retestach z 6–12 listopada. Analiza jest przypisana do gałęzi `docs/polutek-platform-audit`, HEAD `c63a85015f4d9aca627989c406201197e25d16a3`; pojedyncze wyniki pochodzą jednak z różnych SHA i nie tworzą jednego pełnego przebiegu na HEAD.

**Wszystkie obszary audytu nie są gotowe.** W `POKRYCIE.csv` nadal wszystkie D01–D18 mają status `W_TRAKCIE`; `DOMKNIECIE-DOWODOW.csv` ma 18/18 pozycji otwartych; żaden z pięciu celów gotowości nie ma zatwierdzenia. Niezależnego przeglądu nie odnotowano.

Późniejsze testy wyraźnie rozszerzyły lokalne dowody: m.in. K01 przeszło pełny lokalny przepływ Studio → worker/FFmpeg → HLS w Chromium (1/1), K03 critical path przeszedł 37/37, lokalne testy K11 zwrotów Premium przeszły 23/23, a wybrane próby K20–K25, K27, K34 i K38 sprawdziły konkretne kontrakty, wyścigi lub trasy. Te wyniki dotyczą wskazanych SHA i syntetycznych danych/usług; nie zamykają całych obszarów ani nie potwierdzają produkcji. Szczegóły i ograniczenia: [STAN](STAN.md) i [POSTEP-NAPRAW](../POSTEP-NAPRAW.md).

**Istotna luka w ewidencji:** `ASVS-POKRYCIE.csv` i `POWIERZCHNIA-WEJSC.csv` nie były aktualizowane od 2 listopada. Nadal wykazują odpowiednio 86 wymagań w toku, 5 warunkowo wyłączonych, 254 niezbadane i 0 PASS oraz 84/286 powierzchni w toku i 202/286 niezbadanych. To ostatni zapis macierzy, **nie przeliczony wynik po późniejszych retestach**. Nie wiadomo jeszcze, które konkretne wymagania i powierzchnie zostały pokryte przez późniejsze próby; nie wolno ani utrzymywać tych liczb jako bieżącego pomiaru, ani automatycznie zaliczyć ich na podstawie podobnego tematu testu.

Pierwszy, ograniczony crosswalk późniejszych dowodów do metod tras zapisano w [KRYTYCZNE-TRASY-DOWODY.csv](KRYTYCZNE-TRASY-DOWODY.csv). Obejmuje wybrane trasy K01/K10/K27/K35 oraz dowody D03/K11/K12 z lokalnej bazy. Pokazuje również, że testy refundów nie obejmują tras checkout/intent, a test eksportu nie dowodzi usuwania konta. Test K27 odrzuca cofnięty token, ale nie odtwarza podpisanego cache sesji opisanego w R24. **Nie jest to pełny crosswalk, nie aktualizuje statusów całej mapy wejść i nie zamyka D03, D04, D08, D09, D10 ani D12.**

Nadal nie ma pełnego audytu penetracyjnego produkcji, odbioru wszystkich tras i ról przez pełne HTTP/DB, prawdziwego odbioru R2/Cloudflare i Stripe, odtworzenia całego produktu z kopii offsite, reprezentatywnego testu obciążenia ani badań użytkowników/czytników ekranu. Nie przeprowadzono również pełnego przeglądu prawnego. Najbliższy krok badania: zbudować jawne powiązanie **wymaganie/powierzchnia → asercja testu → SHA → ograniczenia**, zaczynając od krytycznych wejść i nie zmieniając statusu na zaliczony bez pełnego dowodu.

Stan na 2 listopada 2026, po partii 16 badania. Dotyczy kodu `c397b9e548ca2c628e21457ac69d66e54b12ddbd`, nie automatycznie późniejszego main ani aktywnej konfiguracji produkcji. [Punkt wznowienia](STAN.md), [program i warunki zakończenia](PROGRAM.md), [rejestr R01–R37](USTALENIA.json).

**Polutek ma poważne fundamenty, ale nie mamy jeszcze podstaw do uznania go za profesjonalnie zweryfikowaną dużą platformę.** To nie jest ocena „wszystko jest złe”. Mamy dowody dobrych zabezpieczeń, konkretne odtworzone błędy i duży zakres, którego jeszcze nie dowiedziono. Fakt użycia Codexa i Claude Code nie rozstrzyga żadnej z tych trzech rzeczy.

## Co zasługuje na zachowanie

- Własne kodowanie i odtwarzanie są rozdzielone od aplikacji WWW. Istnieją wersje materiałów, kolejki, kontrola dostępu, tokeny oraz telemetria startu i zacięć filmu.
- Role i zasoby mają wspólne mechanizmy autoryzacji. Badane kontrole poprawnie odmawiały m.in. części operacji na cudzym kanale i zasobie. To nie dowód sprawdzenia każdej trasy.
- Płatności mają idempotencję, granty, obsługę refundów i uzgadnianie. Testy i próby SQL obejmują także powtórzenia oraz współbieżność. Pozostają jednak ważne błędy opisane poniżej.
- Wdrożenie ma blokadę, zrzut przed migracją, zatrzymanie przy części błędów i powrót do poprzedniego obrazu. Próby tych granic z atrapami działały. Rzeczywisty lokalny restore syntetycznej bazy po 81 migracjach też się udał.
- Repo ma 547 plików testów, w tym osobne testy rzeczywistego Postgresa i FFmpeg. Sama ta liczba nie jest oceną skuteczności, ale pokazuje, że kontrola jakości została potraktowana jako część projektu.

To są wzorce, które warto rozwijać. Nie ma uzasadnienia do automatycznego przepisywania projektu na mikroserwisy, wymiany frameworka lub kopiowania całej infrastruktury PeerTube.

## Gdzie konkretne błędy mają największe znaczenie

| Grupa | Co może ucierpieć | Przykłady i poziom dowodu |
|---|---|---|
| Zadania i cykl filmu | Aktywny wynik może zostać zastąpiony lub usunięty w niewłaściwej chwili | R02, R27–R29: rzeczywiste komponenty z kontrolowanymi awariami; osobne protokoły PostgreSQL. Nie ogłoszono incydentu produkcyjnego |
| Płatności i dostęp | Refund starego zakupu może naruszyć późniejszy pakiet; suma wpłat może zostać zaniżona | R31/R32: komponenty i kontrolowane protokoły SQL, bez realnej transakcji finansowej |
| Izolacja i cykl danych | Operacja może dostać niewłaściwy kontekst kanału; usunięte konto może pozostawić widoczny profil | R23/R33: odtworzone granice use case'ów z atrapami; pełne HTTP nadal otwarte |
| Gotowość wydania | Obraz może się zbudować bez potwierdzenia typów/testów; testy nie obejmują pełnych podróży człowieka | R08/R09: źródła/konfiguracja i kontrolowane próby skuteczności testów |
| Odzyskiwanie i reakcja | Backup DB nie odzyskuje wszystkiego; alert powrotu może zniknąć; pomocniczy verifier może dać fałszywy sukces | R12/R36/R37: różne poziomy dowodu, rozdzielone w D16–D18 |

To wybrane grupy, nie pełna lista lub nowa zmiana priorytetów. R01–R37 obejmują również ryzyka, świadome kompromisy i dług architektury. **37 ustaleń nie oznacza 37 dowiedzionych awarii produkcji.** Rejestr zawiera warunki, dowody, kontrargumenty i test odbioru; niezależne przeglądy pozostają otwarte.

## Co daje porównanie z PeerTube

PeerTube jest użytecznym wzorcem konkretnych rozwiązań: testów upload → transkodowanie → segmenty, procesu runnera, prawdziwego playback w przeglądarce, eksportu metryk, checklisty wydania i podpisanych archiwów. Porównania wskazują pliki i przypiętą wersję, a także ograniczenia konkurenta.

Nie uruchomiliśmy PeerTube i nie wykonaliśmy wspólnego benchmarku. Nie można zatem uczciwie stwierdzić, że Polutek jest od niego szybszy, bezpieczniejszy albo tańszy przy tej samej pracy. Możemy przejmować sprawdzone wzorce i konkurować wybranym doświadczeniem użytkownika; ogólna deklaracja „jesteśmy lepsi pod każdym względem” nie wynika z obecnych dowodów.

## Co jeszcze musi zostać wykazane

Rozpoczęto wszystkie **18 obszarów**, lecz **zero zostało formalnie zamkniętych**. W ASVS 55 wymagań jest w częściowym przeglądzie, 290 nadal NIEZBADANE; żadnego nie uznano za zaliczone na podstawie samego przeglądu. Z 286 rekordów wejść rozpoczęto 79, pozostałe 207 wymagają oceny. Inwentarz plików i policzenie testów nie wypełniają tych luk.

Najważniejsze bramki przed deklaracjami gotowości:

1. Odtwarzalne środowisko z prawdziwym klientem Prisma i poprawnie rozróżnionymi błędami aplikacji/testów/środowiska. Obecna blokada pobierania binariów nie pozwala uznać pełnego runtime za sprawdzony. Nie należy jej obchodzić fikcyjnym klientem ani wyłączeniem kontroli.
2. Krótki własny film przez prawdziwe API, kodowanie, magazyn i przeglądarkę; kontrola postępu obrazu/czasu oraz odmów dostępu. Osobno zmiana oryginału, anulowanie, usuwanie i awaria starego workera.
3. Test-mode płatności z powtórzeniami, zmianą kolejności i późniejszym zakupem; sprawdzenie rzeczywistego skutku w bazie i prawach dostępu. Bez prawdziwych opłat i wiadomości.
4. Odtworzenie produktu z kopii poza hostem, razem z własnymi mediami, kluczami i konfiguracją. Sam lokalny restore SQL tego nie zastępuje.
5. Pomiar mieszanego ruchu przy uzgodnionych celach jakości i kosztu. **Kilkunastu twórców i 10000 widzów w szczycie to założenie scenariusza, nie potwierdzona pojemność.**
6. Kwalifikacja wszystkich wymagań i wejść, niezależne podważenie ważnych ustaleń oraz retesty po ewentualnych naprawach. Naprawy pozostają osobnym etapem; ta gałąź dokumentuje analizę.

[Plan dla każdego obszaru](DOMKNIECIE-DOWODOW.csv) określa brakujący dowód, proponowaną rolę wykonawcy, zależność i warunek odbioru. Role są propozycją organizacji pracy, nie przydzieleniem zadania konkretnej osobie. [Ramy gotowości](BRAMKI-GOTOWOSCI.csv) oddzielają wymagania dla próby lokalnej, bety, sprzedaży i docelowego ruchu; obecnie nie są certyfikatem żadnego z tych etapów.

W obecnym stanie potrafimy wskazać, co jest solidne i dlaczego część błędów mogła przejść mimo wielu testów. Do odpowiedzi „można na tym bezpiecznie oprzeć dużą platformę” potrzebne są jeszcze wyniki powyższych sprawdzeń, a nie następna liczba w ogólnej ocenie jakości.
