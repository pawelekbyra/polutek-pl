# Stan badania — punkt wznowienia

Aktualizacja: 1 listopada 2026. Program v1.0, partia 01: mapa systemu i D01. Tryb: analiza, bez zmian aplikacji i produkcji.

## Cel i decyzje właściciela

- Docelowo duża platforma konkurująca z PeerTube funkcjami i skalą.
- Badanie ma być pogłębione i wieloobszarowe. Właściciel nie programuje; wnioski mają objaśniać wpływ na produkt i biznes.
- Dotychczasowe porównanie jest bazą i próbą metody, a nie zamkniętym pełnym audytem.
- Program i źródła są przygotowane. Rozpoczęto D01 i mapę systemu; nie wykonano pełnej oceny 345 wymagań.
- Następnie właściciel polecił zachować poprzednie badanie i rozwijać całość na jednej gałęzi GitHub: `docs/polutek-platform-audit`. Katalog w repo: `docs/audit/2026-11-01-platform-research/`. Po każdej partii commit i push; bez automatycznego scalenia ani wdrożenia.

## Wersje

- Polutek: `/workspace/polutek-pl`, `c397b9e548ca2c628e21457ac69d66e54b12ddbd`.
- PeerTube: `/workspace/PeerTube`, `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`.
- Program: [PROGRAM.md](PROGRAM.md).
- Rodzic commitu tej partii: `eb0da3fe8f7bc2d573abacddf474da2c552e8c42`. Dowód braku zmian aplikacji: [source-scope.json](evidence/source-scope.json). Dodatkowe commity dokumentacyjne nie są automatycznie zmianą badanej implementacji.

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

Rozpocząć D03/D04: prześledzić F01/F02 (tożsamość i kontekst kanału), potem F03/F06 (upload i dostęp do filmu). Korzystać z listy tras i Server Actions, ale nie uznawać obecności nazw guardów za dowód ochrony. Sprawdzić rozróżnienie konta WWW, legacy ADMIN, konta panelu i ról kanału; następnie zbudować macierz negatywnych scenariuszy HTTP. D01 pozostaje W_TRAKCIE do weryfikacji aktywnych możliwości i doprecyzowania profilu dużej platformy. Nie zmieniać implementacji.

Przed rozpoczęciem: odczytać ten plik, PROGRAM.md i właściwe instrukcje repo; porównać bieżący HEAD z podanym wyżej. Nie powtarzać wykonanych testów bez zmiany wersji, diagnozy lub warunków.

## Zapis po każdej partii

Uaktualnić STAN.md, POKRYCIE.csv, odpowiednie wymagania ASVS i USTALENIA.json. Zapisać dowody i krótki raport obszaru. Dopisać wpis do ZMIANY.md i odświeżyć GITHUB-MANIFEST.json. Wykonać commit i push na `docs/polutek-platform-audit`, a następnie sprawdzić zgodność zdalnego HEAD. Archiwum pozostaje dodatkową kopią.
