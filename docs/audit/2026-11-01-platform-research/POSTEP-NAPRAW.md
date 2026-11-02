# Postęp realizacji roadmapy — H1

Stan: 2 listopada 2026. **Wszystkie wykonane lokalne kontrole tej partii przeszły na dokładnym commicie. Usunięto cztery przekroczenia rozmiaru komponentów i pięć dopasowań strict-escapes; każdy wymagany zestaw testów krytycznych musi teraz faktycznie się wykonać. H1 pozostaje otwarte.**

**Szacunkowo H1: 75% gotowe / 25% pozostało. Cała roadmapa: 5–10% / 90–95% pozostało.** To orientacyjny nakład pracy, nie wynik liczby testów ani gwarancja bezpieczeństwa. Żadnego z 40 całych pakietów i żadnego R01–R37 formalnie nie zamknięto.

**Kod:** [`fix/polutek-h1-acceptance`](https://github.com/pawelekbyra/polutek-pl/tree/fix/polutek-h1-acceptance), `03115f0fefe47baf91622b3272b966344981beaf`. [Szkic PR #2065](https://github.com/pawelekbyra/polutek-pl/pull/2065), baza `c80ef652d6b3fa3be7b357e7b53ce562ca1eceb3`. **Punkt przejęcia:** [STAN.md](program-audytu/STAN.md), [h1-status.json](program-audytu/evidence/h1-status.json), gałąź dokumentacyjna `docs/polutek-platform-audit`. Bez merge/deploy.

## Wyniki na dokładnym SHA

| Kontrola | Wynik | Granica dowodu |
|---|---|---|
| Unit/komponenty | **4702 PASS / 0 FAIL / 3 pominięte**, 542 pliki | Syntetyczne wartości CI i własna lokalna DB; nie pełne integracje providerów. |
| PostgreSQL | **75/75 PASS**, 12 plików | Prawdziwa lokalna DB, blokady/transakcje; Stripe i e-mail są atrapami. |
| Polecenie krytyczne | **36/36 PASS**, oba wymagane pliki | Strażnik kontroluje istnienie, wynik procesu i wykonanie testów w każdym pliku. Nie zastępuje pełnego E2E. |
| Regresje strażnika | **13/13 PASS** w pełnym unit | Rzeczywisty Vitest na małych kontrolnych projektach; wykrywa brak, katalog, wykluczenie, pustkę, skip/todo, fail i niedozwolone filtry. |
| Typy aplikacji / całego repo | **PASS / PASS** | Brak nowych diagnostyk, tsconfig i kontrola typów zachowane. |
| Pełny lint | **0 błędów / 100 ostrzeżeń**, exit 0 | Istniejące ostrzeżenia pozostają. |
| Hotspots / strict-escapes | **PASS / PASS** | Budżety, historyczne wyjątki i baseline bez zmian; stare dopuszczone obejścia typów nadal istnieją. |
| Architektura / env produkcyjne | **PASS / PASS** | Env syntetyczny, nie sprawdzenie konfiguracji aktywnej produkcji. |
| Build strony / panelu | **PASS / PASS** | Pełne lokalne standalone, kontrola typów włączona. Obraz Docker/digest wydania pozostaje do sprawdzenia. |

Zbiorczy proces tej partii zakończył się exit 0; `release_ready=false`. Pominięcia zwykłego zestawu: dwa przypadki EmailEventLockService i jeden HLG/HDR zależny od lokalnego FFmpeg. Żaden test krytyczny nie jest pominięty. Nie wykonano `npm audit`/audit-high: wcześniejsza automatyczna kontrola odrzuciła wysłanie grafu zależności i nie obchodzono tej odmowy.

## Zmiany — pięć osobnych commitów

| Commit | Zakres |
|---|---|
| `a3874d49` | Publikacja/widoczność korzysta z istniejącego typowanego `ctx.db.writeTransaction`. Dwie regresje sprawdzają pracę wewnątrz już otwartej transakcji. Dwa zbędne `as any` usunięte z odczytów widoczności. Piąte dopasowanie było komentarzem odtwarzacza — doprecyzowano jego tekst. |
| `3417985b` | Kontrakt props strony kanału w `channel/home-props.ts`; bez zmiany renderowania lub historii nawigacji. |
| `89e8e31d` | Typy i pomocnicze funkcje przeglądarki kasy w `pass-checkout-state.ts`; dotychczasowe eksporty zachowane. Żądania, płatności, efekty i kolejność ich wykonania pozostają w komponencie. |
| `466d75f1` | Studio: osobne widoki statusu przesyłania, informacji o pliku i podglądu filmu. JSX, klasy i napisy zachowane; żądania, polling, anulowanie i ponawianie pozostają u dotychczasowego właściciela stanu. |
| `03115f0f` | Polecenie krytyczne wymaga obu plików i niepustych, wyłącznie zaliczonych testów. Regresje uruchamiają rzeczywisty Vitest. Konwencja zapisana w CLAUDE i LOCAL-CI. |

Rozmiary według tego samego strażnika: ChannelHome 428, PassCheckoutSheet 450, StudioUploadWizard 434, StudioVideoEditor 416 linii. Nie zwiększono limitów, nie dodano wyjątków, nie zmieniono reguł/baseline. Lockfile, schema/migracje, verifier restore, oba Next configi i oba tsconfigi identyczne jak w poprzedniej partii. Nie wykonywano nowej kontroli wizualnej w docelowej przeglądarce; zachowanie kasy/nawigacji pokrywają istniejące testy komponentowe i pełny przebieg.

## Co nadal blokuje odbiór H1 i wydanie

1. **K02/K06:** rzeczywisty obraz Docker i biblioteki natywne w nim; wymuszony związek dokładnych źródeł, wejść, testów i digest we wszystkich wspieranych ścieżkach wydania. Same lokalne buildy tego nie dowodzą.
2. **K01/K03:** pełny własny stos API/worker/HLS/Redis/storage, brakujące testy integracyjne oraz trzy jawne pominięcia; możliwości docelowego FFmpeg/HDR do sprawdzenia. Zewnętrznych providerów nie badano w tej partii.
3. **K05:** aktywna konfiguracja i dziewięć decyzji [DP01–DP09](https://github.com/pawelekbyra/polutek-pl/blob/03115f0fefe47baf91622b3272b966344981beaf/docs/architecture/product-profile.md) nadal otwarte: m.in. refundy, retencja, świeżość sesji, cofanie dostępu, SLO/RPO/RTO i budżet.
4. **Cała platforma:** dalsze etapy pieniędzy/uprawnień, pipeline/storage/usuwania i pozostałych R02–R36 nie zostały tą partią naprawione. Brak podstaw do ogłoszenia gotowości platformy do płatności/otwarcia.

## Dowody i przejęcie

[Bieżąca atrybucja i commity](program-audytu/evidence/h1-gates-2026-11-02/source-map.json), [dokładny przebieg](program-audytu/evidence/h1-gates-2026-11-02/final/acceptance-run.json). [Poprzednia partia](program-audytu/evidence/h1-quality-2026-11-02/source-map.json) i wszystkie czerwone wyniki zachowane. [Starsza partia cloud](program-audytu/evidence/h1-cloud-2026-11-02/source-map.json): autentyczne Prisma 6.19.3, 81 migracji na PG 17.11, 11 prób restore i 4 próby lokalnego HTTP; nie powtarzano niezmienionych kontroli. To dowody historyczne o opisanym zakresie, nie odzysk całego produktu ani pełne wideo E2E.

Wznawiać z czystej gałęzi kodu i Node 22.23.4. Helper `program-audytu/tools/run-h1-gates-acceptance.mjs` skopiować poza checkout; przed powtórzeniem wybrać nowy katalog wynikowy i utworzyć go, aby zachować wcześniejsze dowody. Uruchamiać z prywatnym `/workspace/.cloud-setup/h1.env` (0600), zachować własną bazę `polutek_h1_6b21d176e3`; jedno ciężkie polecenie naraz, Vitest maxWorkers 2, PG 1. Nie przełączać gałęzi podczas testów/buildów. Środowisko działa; bez dalszych zmian/publikacji konfiguracji w tej turze.

Kanoniczny audyt bez zmian: ASVS 86 częściowych / 254 NIEZBADANE / 5 warunkowych NA / 0 PASS; wejścia 84/202 z 286; wszystkie 18 obszarów otwarte. Zachować wyniki Windows/batch17. Pogłębiony audyt jest czasowo odłożony na rzecz H1, nie anulowany. Po partii aktualizować punkt przejęcia, dowody, CSV i manifest, commit/push i sprawdzić zdalne SHA. Nie scalać, nie wdrażać, nie korzystać z produkcji ani płatnych zasobów bez osobnej zgody właściciela.
