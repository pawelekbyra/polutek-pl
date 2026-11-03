# D01 — produkt, obietnice i zakres badania

Data: 1 listopada 2026. Baza aplikacji: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. **Status D01: W_TRAKCIE.** Ukończono pierwszą mapę źródeł, nie weryfikację produktu w działaniu.

## Wniosek dla właściciela

Polutek ma kod platformy wielu twórców, ale jego publiczna powłoka nadal ma istotny model kanału głównego. Ma także trzy różne pojęcia finansowe, których nie można traktować zamiennie: napiwek, dostęp do strefy patrona oraz przyszłe zamówienia/rozliczenia wielu twórców. Słowa „kanały są”, „płatności są” lub „admin” są za mało precyzyjne do uznania gotowości platformy.

To nie jest stwierdzenie, że funkcje są źle zrobione. To ustalenie granic, które muszą być osobno sprawdzone. Żadna wartość domyślna z kodu nie dowodzi aktualnej konfiguracji produkcji.

## Jak opisujemy stan funkcji

- **Kod jest:** istnieje implementacja; nie oznacza zaliczonego runtime.
- **Warunkowa:** zachowanie zależy od przełącznika, danych lub dostawcy.
- **Wyłączona w UI:** kod pozostaje, ale wejście do funkcji jest świadomie ukryte.
- **Częściowa/docelowa:** istnieją elementy domeny, nie kompletny produkt.
- **Niepotwierdzona w działaniu:** wymagane testy nie zostały wykonane albo są zablokowane.

Każda z tych etykiet opisuje inną oś. Funkcja może mieć kod i równocześnie być warunkowa oraz niepotwierdzona w działaniu.

## Katalog obietnic

| ID | Obietnica / możliwość | Stan wynikający ze źródeł | Miejsce do sprawdzenia |
|---|---|---|---|
| P01 | Oglądanie publicznego filmu bez konta | Kod jest; status filmu, kanału, moderacja i premiera ograniczają dostęp | `access`, `playback`, media-source, Worker HLS |
| P02 | Film wymagający konta nie jest udostępniany gościowi | Kod jest; wymaga testu planu, podpisów i wszystkich źródeł metadanych | `check-video-access`, prywatne napisy, oEmbed/RSS/search |
| P03 | Konta e-mail/hasło, Google, MFA i passkeys | Implementacje są; Google/captcha i poczta wymagają konfiguracji | `lib/auth`, catch-all Better Auth, recovery |
| P04 | Zalogowany użytkownik może tworzyć kanał | Warunkowa; `PLATFORM_GATE_CHANNEL_CREATION` domyślnie off, invite/on to różne tryby | `platform-gates`, `channel-lifecycle` |
| P05 | Twórca i członkowie zarządzają własnym kanałem | Kod jest; model OWNER/MANAGER/EDITOR/MODERATOR/TRANSLATOR | Studio session, macierz policy i wszystkie use case'y |
| P06 | Studio pozwala tworzyć, wgrywać i publikować filmy | Kod jest; uprawnienia, limity i gotowość źródła są częścią obietnicy | Trasy Studio, upload, kodowanie, publikacja |
| P07 | Upload dużego filmu można wznowić | Backend i uploader panelu mają mechanizm; klient Studia ma inną ścieżkę | R22 — nie uznawać funkcji za jednolitą |
| P08 | Po kodowaniu widz dostaje poprawny HLS | Kod jest; liczba prób, awarie uploadu i finalizacja wymagają kontroli | R02–R04, FFmpeg, aktywna trasa |
| P09 | Wymiana źródła nie przerywa starego filmu przed gotowością nowego | Intencja pipeline; do sprawdzenia przy awarii i dwóch workerach | original/asset/route, F03/F04 |
| P10 | Premiera, UNLISTED, ograniczenia 18+ i moderacja są respektowane wszędzie | Kod jest; to wiele oddzielnych list i dróg odczytu | access, search, lists, notification, RSS/embed |
| P11 | Wyszukiwarka działa ponad kanałami | Implementacja jest, mimo starszych wpisów o funkcji „do zrobienia” | `public-search.service`, `/api/search` |
| P12 | Publiczna strona główna reprezentuje całą platformę wielu twórców | Nie należy tego zakładać: loader i wybór home wciąż opierają się na kanale głównym | `home-content.loader`, `main-channel.service` |
| P13 | Subskrypcje, ulubione, postęp, playlisty, komentarze i powiadomienia | Są osobne moduły i trasy; wymagają testów zakresu i stanów | F10, D04/D11/D12 |
| P14 | Napiwek niczego nie odblokowuje | Dotyczy legacy modelu napiwku, nie każdej płatności; wejście tip gate w UI wyłączone | `patron`, `payments`, `TIP_GATE_ENABLED=false` |
| P15 | Zakup strefy patrona daje dostęp | Inny model: ACCESS_30D / ACCESS_LIFETIME; domyślny tryb płatności demo nie pobiera pieniędzy | `patron-zone`, `PREMIUM_PASS_*`, fulfillment |
| P16 | Twórca sprzedaje film, ma księgę i otrzymuje wypłatę | Częściowa/docelowa; schema i use case'y nie są kompletnym marketplace | `sales`, gate sales/payouts, R17 |
| P17 | Panel bezpiecznie zarządza wszystkimi kanałami | Osobna aplikacja i tożsamość; nie wystarczy zwykłe konto WWW | Access JWT, admin role, Server Actions, audyt |
| P18 | Interfejs działa w 8 językach | 8 locale UI; pełne treści i e-maile są zasadniczo PL/EN, nie 8 pełnych katalogów treści | `lib/i18n/routing.ts`, katalogi, szablony |
| P19 | Telemetria pomaga mierzyć jakość bez naruszania deklaracji prywatności | Kolektor i QoE istnieją; wymaga sprawdzenia treści zdarzeń i cyklu danych | `/api/t`, collector, telemetry SQL, polityka prywatności |
| P20 | Dane można wyeksportować/usunąć, a platformę odtworzyć | Implementacje istnieją; zakres i skuteczność muszą być zmierzone | R04/R12/R16, backup/restore |
| P21 | Live, P2P, federacja i pluginy mają parytet z PeerTube | Nie odnaleziono równoważnych implementacji; to zakres strategiczny, nie zaliczone funkcje | D02/D09/D13 i decyzje produktu |
| P22 | Wersja jest gotowa do publicznego indeksowania | Beta jest domyślna i steruje noindex; aktywnej wartości produkcyjnej nie ustalono | `site-stage`, metadata, sitemap/robots |

Nazwy też wymagają ostrożności: `apps/admin/app/api/live/route.ts` serwuje SSE trybu premiery panelu, nie wejście wideo RTMP/WebRTC. Sama nazwa `/api/live` nie dowodzi obecności transmisji na żywo porównywalnej z PeerTube.

Dowody źródłowe: [platform gates](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/platform-gates.ts), [patron config](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/patron-zone/domain/config.ts), [tryb płatności](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/patron-zone/domain/payments-mode.ts), [home loader](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/channel/application/home-content.loader.ts), [języki](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/i18n/routing.ts), [schema](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/prisma/schema.prisma). To dowody obecności i intencji kodu, nie wykonanych scenariuszy P01–P22.

## Trzy modele pieniędzy

| Model | Co oznacza | Czego nie dowodzi |
|---|---|---|
| Napiwek / PatronGrant | Ewidencja wsparcia; sama nie steruje dostępem do filmu | Że żadna inna płatność w produkcie niczego nie odblokowuje |
| Strefa patrona / patron-zone | Własny produkt dostępu na czas lub bez limitu; osobne przełączniki i zgody | Że gotowa jest sprzedaż per film i wypłata udziału dowolnemu twórcy |
| Sales / Order / Entitlement / LedgerEntry | Rdzeń przyszłego marketplace i księgi, za bramkami | Że istnieje kompletne checkout/refund/payout i proces finansowy |

Wniosek: przed oceną płatności D10 trzeba wskazać model i konkretny tryb. „Stripe działa” nie rozstrzyga poprawności wszystkich trzech.

## Rozbieżności dokumentacji — doprecyzowanie R19

- README nadal opisuje jeden niekomercyjny kanał i brak odblokowania treści przez wsparcie. Aktualniejsza domena zawiera wiele kanałów i płatny produkt patrona.
- Dokument etapów multi-creator wskazuje część odkrywania jako przyszłą, choć jest już implementacja wyszukiwarki ponad kanałami. Nie należy traktować całej tabeli etapów jako jedynego dowodu stanu kodu.
- Komentarz `authz/domain/resources.ts` mówi o MVP wyłącznie OWNER, a macierz i wczytywanie członkostw uwzględniają inne role. To opis wymagający aktualizacji, nie dowód, że role nie działają.
- Reguła „ADMIN nie ma kanału” w opisie kierunku wymaga rozróżnienia nowej tożsamości panelu i legacy `User.role=ADMIN`, który może wejść do Studia jako zwykły użytkownik.

**Kontrargument:** część zapisów była prawidłowa dla wcześniejszego modelu albo opisuje kierunek, nie stan runtime. Problemem jest brak czytelnego oznaczenia, które twierdzenie obowiązuje dziś. R19 pozostaje otwarte i otrzymuje dodatkowe źródła; nie tworzymy czterech duplikatów ustalenia.

## Co już zachowujemy jako zaletę

- Przełączniki domyślnie odmawiają nowych możliwości platformy, zamiast przypadkowo otwierać je po deployu.
- Kontrola własności nie jest wyłącznie w interfejsie; są centralna policy i use case'y.
- Panel ma odrębną tożsamość, a Studio jawnie rozdziela twórcę od staff.
- Stan beta i tryb demo są modelowane osobno od właściwej sprzedaży.

To zalety konstrukcji widoczne w źródłach. Ich użycie na wszystkich ścieżkach należy dopiero zweryfikować.

## Wynik etapu i bramka D01

Utworzono katalog P01–P22, mapę ról, F01–F14 i granice zaufania. Przypisano 345 wymagań ASVS do obszarów przeglądu na podstawie rozdziałów, bez uznania ich stosowalności/zadeklarowania zgodności. Dziewięć przeczytanych wymagań dotyczących dokumentacji/inwentarzy ma status W_TRAKCIE.

**D01 nie jest zakończone.** Do zamknięcia potrzebne są: potwierdzenie aktywnych funkcji w izolowanym runtime, doprecyzowanie docelowego profilu dużej platformy, rozliczenie rozbieżności opisów i przypisanie scenariuszy odbioru do krytycznych obietnic. Bez odczytu konfiguracji nie twierdzimy, że konkretny gate jest obecnie włączony/wyłączony na produkcji.

**Następna partia:** D03/D04, czyli konta, sesje, kanały i role w rzeczywistych handlerach i Server Actions. Kolejność zaczyna się od F01/F02, a potem F03/F06. Kontynuujemy bez zmian implementacji.
