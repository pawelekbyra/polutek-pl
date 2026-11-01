# Program pełnego badania Polutka

Wersja 1.0, 1 listopada 2026. Cel właściciela: duża platforma konkurująca z PeerTube funkcjami i skalą. Bieżący tryb: **analiza i zapisywanie dowodów; bez napraw aplikacji i bez zmian na produkcji**.

## Co chcemy wiedzieć

Czy Polutek poprawnie realizuje obietnice wobec widzów, twórców i operatora; czy chroni dane i pieniądze; czy zachowuje poprawność podczas awarii i nadużyć; jaką skalę obsługuje przy określonym koszcie; czy da się go utrzymywać i bezpiecznie rozwijać.

Fakt, że kod powstał z Codexem i Claude Code, nie jest ani certyfikatem jakości, ani dowodem złej jakości. Ocenie podlega konkretna wersja kodu i działanie systemu. Drugi model może powtórzyć błąd pierwszego. Niezależność oceny wymaga próby podważenia wniosku i dowodów, nie samej zgodnej opinii dwóch modeli.

Nie da się uczciwie zagwarantować „nie istnieje żaden błąd pod żadnym względem”. Można natomiast osiągnąć **pełne rozliczenie uzgodnionego zakresu**: każdy obszar i istotny scenariusz ma wynik albo jawną niewiadomą. Pokrycie checklisty nie jest prawdopodobieństwem bezpieczeństwa ani certyfikacją.

## Punkt startowy

- [Dotychczasowy raport](../RAPORT.md): przegląd wybranych krytycznych przepływów i 22 obszary ustaleń. Zachowujemy jako wersję bazową, nie zamieniamy w „audyt wszystkiego”.
- [Inwentarz](INWENTARZ.json): 2172 śledzone pliki, w tym 1861 plików zakwalifikowanych rozszerzeniem jako kod/skrypty/SQL. To liczby inwentarza, nie liczby przeczytanych plików ani modułów aplikacji. Bez nieczytelnych plików w tym przebiegu.
- SHA Polutka: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. PeerTube: `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`.
- Blokada pełnej walidacji runtime: HTTP proxy 403 dla binariów/checksum Prisma. Nie omijamy weryfikacji. Testy wymagające tego klienta pozostają zablokowane, nie zaliczone.

## Zewnętrzne punkty odniesienia

1. **PeerTube:** porównanie implementacji i zachowań produktu. Szczególnie upload, kodowanie, runnery, tokeny, moderacja, eksporty, testy usług i wielu procesów. Nie traktować go jako bezbłędnego wzorca ani automatycznie wymagać federacji/P2P.
2. **OWASP ASVS 5.0.0:** wymagania bezpieczeństwa. Pobranie oficjalnej wersji wykazało 345 pozycji: 70 L1, 183 L2, 92 L3. Proponowany profil bazowy to wymagania L1+L2, z doborem L3 dla wrażliwych elementów. Najpierw kwalifikujemy wszystkie pozycje do zakresu; nie ogłaszamy zgodności. [Wersja 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0).
3. **OWASP WSTG 4.2:** metody badania i scenariusze testów. Według odczytanego oficjalnego README 4.2 jest stabilnym wydaniem, a 5.0 pracą rozwojową. Używać wersjonowanych identyfikatorów. [WSTG 4.2](https://github.com/OWASP/wstg/tree/v4.2).
4. **WCAG 2.2, proponowany zakres AA:** dostępność strony i odtwarzacza, z testami ręcznymi. Oficjalne repo zawiera materiały robocze i techniki; nie mylić gałęzi main z opublikowaną normą. [Publikacja W3C](https://www.w3.org/TR/WCAG22/), [źródła W3C sprawdzone online](https://github.com/w3c/wcag).
5. **Web Vitals:** LCP, INP i CLS, ale obok nich własne pomiary filmu: pierwsza klatka, rebuffering, błędy startu, zmiany jakości. Wydajność witryny nie jest tym samym co jakość odtwarzania. [Oficjalna biblioteka](https://github.com/GoogleChrome/web-vitals).
6. **SLSA:** źródło artefaktu, integralność i zaufanie do procesu budowy. Nie deklarujemy osiągnięcia poziomu SLSA przez samą checklistę. [Oficjalny projekt](https://github.com/slsa-framework/slsa).

Źródła pobrano z internetu do `sources/`; adresy, daty pobrania i wyniki są w rejestrze źródeł. To selektywny research oficjalnych materiałów, nie przeszukanie całego internetu ani certyfikacja według tych standardów.

## Etap 0 — zamrożenie zakresu i reguł dowodu

Ustalić aktualne obietnice produktu, role i aktywne funkcje. Oddzielić działające dziś od budowanych za przełącznikami i przyszłych. Określić profil dużej platformy scenariuszami: katalog, liczba twórców, nowe sesje/s, równoległe oglądanie, uploady, liczba subskrybentów kanału, wymagany czas odtworzenia i budżet. Brak liczb zapisujemy jako pytanie; nie wyciągamy z niego fikcyjnej deklaracji pojemności.

Każdy dowód ma SHA, środowisko i datę. Zmiana kodu unieważnia odpowiednie wyniki, niekoniecznie cały audyt. Badanie ma odpowiadać zarówno „co jest słabe?”, jak i „co jest poprawne i warto zachować?”.

**Wynik etapu:** lista obietnic produktu, krytycznych zasobów i ról; uzgodnione granice audytu; wzorzec wpisu i statusy. Program jest propozycją wykonawczą, nie dowodem realizacji etapów.

## Etap 1 — mapa całego systemu i śledzenie pokrycia

Przejść od inwentarza do mapy: strony i akcje, publiczne i chronione API, moduły domenowe, schemat i migracje, crony, kolejki, workery, poczta, płatności, magazyny, Cloudflare, deployment i narzędzia operatora. Dla każdego wejścia zapisać tożsamość aktora, walidację, autoryzację, efekty, zależności i sposób testowania.

Każdy śledzony plik dostaje zakres przeglądu lub uzasadnione wyłączenie. Nie wszystkie obrazy, pliki flag i zablokowane zależności wymagają ręcznego czytania jak use case płatności. Plik wygenerowany ma wskazane źródło/generator. Zależności zewnętrzne mają osobny rejestr ryzyka, a nie fikcyjny status „przeczytane”.

Powstaje mapa przepływów oraz model zagrożeń: co chronimy, przed kim, gdzie zmienia się poziom zaufania i jak może zostać nadużyty koszt platformy. Wszystkie pozycje ASVS dostają zakres: dotyczy / nie dotyczy z uzasadnieniem / do ustalenia.

**Wynik:** pełna mapa odpowiedzialności i kolejność pogłębionych przeglądów według ryzyka. Inwentarz sam w sobie nie jest audytem.

## Etap 2 — przeglądy obszarów

Każdy obszar badamy według schematu: **obietnica → implementacja → przypadki błędne i nadużycia → testy → PeerTube/standard → dowód → wniosek → warunek poprawy**.

| ID | Obszar | Główne pytania |
|---|---|---|
| D01 | Produkt i kompletność | Co faktycznie działa? Czy UI, dokumentacja, konfiguracja i backend obiecują to samo? |
| D02 | Architektura i utrzymywalność | Czy odpowiedzialności są czytelne, logika nie jest zdublowana i zmiana nie wymaga poprawek w wielu niespójnych miejscach? |
| D03 | Tożsamość i sesje | Hasła, OAuth, MFA, odzyskiwanie, przejęcie konta, unieważnianie sesji, awarie usług auth. |
| D04 | Role i izolacja twórców | Czy użytkownik kanału A może zobaczyć/zmienić zasób B? Jak działają role moderatora, staff i system? |
| D05 | Bezpieczeństwo wejść i infrastruktury | XSS, SQL/command injection, SSRF, CSRF, limity body, pliki wrogie, FFmpeg, proxy, sekrety, uprawnienia usług. |
| D06 | Dane, schema, migracje | Integralność, unikalności, relacje, indeksy, transakcje, zmiany schematu, upgrade istniejącej bazy, rollback. |
| D07 | Współbieżność i zadania | Powtórzenia, podwójne kliknięcia, retry, utrata dzierżawy, opóźnione odpowiedzi i stare workery. |
| D08 | Upload i kodowanie | Wznawianie, formaty, proporcje/FPS/HDR/audio, limity, jakość wyjścia, koszty, retencja i usuwanie. |
| D09 | Odtwarzanie i ochrona treści | Pierwsza klatka, Safari/mobile, słaba sieć, tokeny, cofanie dostępu, cache, napisy i wycieki metadanych. |
| D10 | Płatności i rozliczenia | Intenty, webhooki, refundy, spory, księga, granty, podatki i wypłaty — osobno stan obecny i planowany. |
| D11 | Moderacja i nadużycia | Zgłoszenia, bany, odwołania, spam, limity i koszt ataku, narzędzia operatora, ślad audytowy. |
| D12 | Prywatność i cykl danych | Zbieranie, uprawnienia, retencja, eksport, usuwanie, backupy, telemetria i zgody. |
| D13 | Wydajność i skala | Duży katalog, równoległy ruch, wyszukiwanie, zapytania DB, cache, limity połączeń, nasycenie i powrót po nim. |
| D14 | Koszt i pojemność | Koszt oglądania/kodowania/twórcy, quota kontra rzeczywiste kopie, egress/operacje magazynu, poczta i obsługa. |
| D15 | UX, dostępność i języki | Całe zadania użytkownika, keyboard/screen reader, zoom, reduced motion, komunikaty błędów i tłumaczenia. |
| D16 | Monitoring i incydenty | Czy monitor wykrywa niesprawną usługę, czy tylko żywy proces? Alarmy, korelacja, diagnostyka bez sekretów. |
| D17 | Wdrożenia i odtwarzanie | Powtarzalny build, pochodzenie artefaktu, aktualizacje, rollout/rollback, izolacja, backup i restore od zera. |
| D18 | Testy i proces jakości | Czy testy sprawdzają obietnice i granice usług? Czy build wymusza sprawdzenia dokładnie tej wersji, którą wydajemy? |

Kwestie prawne i podatkowe oznaczamy jako wymagania i pytania do właściwego specjalisty. Przegląd kodu nie ustala sam legalności modelu biznesowego. System live/federacja/pluginy, których dziś nie ma, to luka strategiczna lub zakres przyszły, a nie „zaliczona funkcja”.

## Etap 3 — próby podważenia wniosków

Każde istotne znalezisko przechodzi drugi przegląd: czy warunek jest osiągalny, czy istnieje inne zabezpieczenie, czy test/atrapa nie zakłada z góry wyniku, czy problem jest aktywny dziś, czy dotyczy wyłączonej funkcji. Przechowujemy także obalone podejrzenia i powód ich odrzucenia.

Może to wykonać niezależny człowiek lub osobny przebieg/model; zgoda drugiego AI sama nie podnosi statusu do „potwierdzone”. Przed szerokim uruchomieniem funkcji finansowych i dużej platformy warto przewidzieć niezależny przegląd bezpieczeństwa i procedur operacyjnych.

**Wynik:** mniej fałszywych alarmów i mocniejsze dowody dla realnych problemów. Nie wdrażamy poprawki tylko dlatego, że brzmi rozsądnie w raporcie.

## Etap 4 — działający system i eksperymenty

Odblokować standardowe przygotowanie środowiska; nie podstawiać atrap zamiast Prisma po to, żeby raport stał się zielony. Uruchomić Polutka i reprezentatywny zakres PeerTube na izolowanych danych. Weryfikować kluczowe zadania przez prawdziwe HTTP i przeglądarkę.

Eksperymenty: utrata odpowiedzi po sukcesie usługi, restart w każdej granicy, dwa workery, awaria Redis/R2/bazy, częściowy DELETE, brak miejsca i nieprawidłowe multimedia. Użyć [istniejącej macierzy awarii](../PLAN-WERYFIKACJI.md). Najpierw wywołania kontrolowane, następnie rzeczywiste lokalne usługi. Zestaw jednostkowy nie zastępuje tego etapu.

**Wynik:** poprawność normalnego działania i kontrolowane zachowanie przy awarii. Nie generować ruchu na cudzych instancjach ani na produkcji w ramach tego programu analitycznego.

## Etap 5 — uczciwe pomiary i koszty

Ten sam scenariusz VOD, ustalone zasoby, wersje, urządzenia, sieć i katalog. Porównywać oddzielnie control plane i dostarczanie segmentów przez CDN/P2P. Nie utożsamiać liczby nowych wizyt/s z liczbą oglądających. Zdefiniować progi akceptacji przed interpretacją wykresów.

Mierzyć pierwszą klatkę, rebuffering, skuteczność uploadu, kolejkę encode, p95/p99, błędy, CPU/RAM/DB, koszt i czas odtworzenia. Web Vitals uzupełniają, nie zastępują pomiarów filmu. Przeprowadzić też zadania z użytkownikami: czy umieją obejrzeć, znaleźć, wgrać i opublikować film oraz zrozumieć błąd.

**Wynik:** zdanie „Polutek jest lepszy w X” ma określoną metrykę, warunki i powtarzalny wynik. Bez tego jest hipotezą.

## Etap 6 — ocena gotowości i plan napraw

Ocenić osobno gotowość do zamkniętych testów, małej bety, otwartej platformy twórców, sprzedaży i większego ruchu. Nie wystawiać jednej średniej „8/10”, która ukryje krytyczny problem pieniędzy lub usuwania danych za dobrym wyglądem strony.

Każdy problem ma proponowaną zmianę, koszt względny/zakres, zależności i test odbioru. Naprawy są osobnym etapem po analizie. Po naprawie wpis pozostaje w historii z dowodem retestu; nie zmieniamy starego wyniku w taki sposób, żeby wyglądał na od początku poprawny.

**Warunki zamknięcia audytu danego zakresu:**

- Wszystkie zidentyfikowane elementy i krytyczne przepływy mają właściciela obszaru oraz ocenę lub uzasadnione wyłączenie.
- Brak pustych statusów i nieuzasadnionego „nie dotyczy”; blokady i niewiadome są jawne.
- Wymagane testy faktycznie wykonały się na wskazanej wersji; skipped/unrun nie są pass.
- Wrażliwe operacje mają testy uprawnień, powtórzeń, współbieżności i awarii.
- Poważne ustalenia przeszły próbę obalenia; naprawione mają retest.
- Gotowość skali i kosztu wynika z pomiarów, a odtwarzanie z ćwiczenia restore.
- Pozostałe ryzyka mają opis wpływu i decyzję. Samo zaakceptowanie ryzyka nie oznacza, że zniknęło albo że platforma spełnia wszystkie progi gotowości.

## Jak zapisujemy ustalenia

Katalog główny badania: `docs/audit/2026-11-01-platform-research`. Program i rejestry: `program-audytu/`. Dotychczasowe dowody pozostają nienaruszonym punktem odniesienia.

```text
research-polutek/
  RAPORT.md, BACKLOG.csv                 wcześniejszy raport i lista 22 obszarów
  ...                                   wcześniejsze logi, wyniki i eksperymenty
  program-audytu/
    PROGRAM.md                          ten plan i kryteria ukończenia
    STAN.md                             co zrobiono, blokady, następny krok
    POKRYCIE.csv                         18 obszarów; status i dowody
    INWENTARZ-PLIKOW.csv, INWENTARZ.json  mapa wejściowa wszystkich śledzonych plików
    ASVS-POKRYCIE.csv                    345 pozycji, każda z zakresem i wynikiem
    USTALENIA.json                       stabilne ID; problemy, zalety, decyzje i hipotezy
    ZMIANY.md                           historia aktualizacji materiału badawczego
    sources/                            oficjalne źródła i wyniki pobrania
    obszary/                            raporty D01–D18, gdy zostaną wykonane
    evidence/                           wyniki poleceń/eksperymentów z konkretnych przebiegów
```

Nie mnożymy raportów „sesja 1, sesja 2” z konkurującymi listami problemów. Jeden ID ustalenia ma jedną historię i może być wskazany w kilku obszarach. Istniejące R01–R22 zachowują identyfikatory; są wpisami bazowymi, które trzeba przypisać, doprecyzować i poddać drugiemu przeglądowi, nie automatycznie ostatecznymi wyrokami.

**Wpis ustalenia:** ID, typ (usterka/ryzyko/zaleta/hipoteza/decyzja), opis zwykłym językiem, wpływ na widza/twórcę/operatora, warunki wystąpienia, komponent i pliki, SHA i data, dowód i sposób odtworzenia, poziom pewności, zakres obecny/przyszły, priorytet, odniesienie PeerTube/standard, kontrargumenty, propozycja, test odbioru i wynik retestu.

**Status wymagania:** NIEZBADANE, W_TRAKCIE, ZGODNE_W_ZBADANYM_ZAKRESIE, PROBLEM, ZABLOKOWANE, NIE_DOTYCZY_Z_UZASADNIENIEM. **Status ustalenia:** DO_WERYFIKACJI, POTWIERDZONE, ODRZUCONE_Z_POWODEM, ZAPLANOWANE, NAPRAWIONE_DO_RETESTU, ZAMKNIETE_PO_RETESCIE, RYZYKO_PRZYJETE. Oddzielamy status od priorytetu.

Raport dla właściciela zaczyna się od: co działa dobrze, co zagraża użytkownikowi lub biznesowi, czego nie wiemy i co zmienia kolejność prac. Szczegóły techniczne i logi są podlinkowane. Właściciel nie musi rozumieć TypeScript, żeby zrozumieć znaczenie znaleziska.

## Reguły długiej sesji i wznowienia

Po każdym zamkniętym obszarze, istotnym eksperymencie i przed zakończeniem pracy: aktualizacja STAN.md, rejestrów, raportu obszaru i historii zmian. Zapisywać od razu wyniki ważnego eksperymentu, nie odkładać całej dokumentacji na koniec dnia.

STAN.md przechowuje ostatni sprawdzony SHA, ukończone podzadania, otwarte pytania, działające procesy i lokalne zasoby, blokady, ścieżki dowodów i jeden konkretny następny krok. Nie zawiera sekretów. Przy wznowieniu czytamy go i sprawdzamy HEAD; nie odtwarzamy planu z pamięci czatu i nie powtarzamy bez potrzeby zakończonych kontroli.

Na wyraźne polecenie właściciela program i dowody przechowujemy w repozytorium, w `docs/audit/2026-11-01-platform-research/`, na jednej gałęzi `docs/polutek-platform-audit`. Jest to wyjątek opisany w AGENTS.md i CLAUDE.md. Nie zmieniamy istniejącego raportu tylko dlatego, że po nowej wersji kodu przestał być aktualny — dopisujemy datę/rewizję i ponawiamy dotknięte sprawdzenia.

**Trwałość:** po każdej zakończonej partii badania wykonujemy commit i push na tę samą gałąź GitHub. Sprawdzamy, czy zdalny HEAD odpowiada lokalnemu commitowi; sam lokalny commit nie potwierdza zapisu na GitHubie. Archiwum ZIP z manifestem pozostaje dodatkową kopią. Nie scalamy automatycznie do `main` ani nie wdrażamy aplikacji z gałęzi badawczej.

## Następny krok

Kolejność programu: mapa obietnic produktu, wejść systemu i granic zaufania; następnie pogłębione przepływy konta, uprawnień, uploadu, kodowania, publikacji i odtwarzania. Równolegle klasyfikacja 345 pozycji ASVS według rzeczywistego zakresu. Bieżący punkt kontynuacji i ukończone partie opisuje [STAN.md](STAN.md), a stabilny rejestr zachowuje R01–R27 i kolejne ustalenia. Blokada Prisma nie zatrzymuje mapowania, przeglądu źródeł ani odpowiednio opisanych prób SQL, lecz zatrzymuje uznanie pełnego runtime aplikacji za zweryfikowany.
