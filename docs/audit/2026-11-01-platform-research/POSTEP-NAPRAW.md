# Postęp realizacji roadmapy — H1

Stan: 2 listopada 2026. Właściciel zatwierdził roadmapę i H1. **Sieć odblokowana; prawdziwe Prisma, migracje, testy DB i lokalne HTTP działają. H1 pozostaje otwarte: część wymaganych bramek wydania jest czerwona.** Bez scalenia i wdrożenia.

**Kod:** [`fix/polutek-h1-acceptance`](https://github.com/pawelekbyra/polutek-pl/tree/fix/polutek-h1-acceptance), `8dce5f94016325c12a3ae82fd1c84d144a055efe`. **Przegląd:** [szkic PR #2065](https://github.com/pawelekbyra/polutek-pl/pull/2065), baza `c80ef652d6b3fa3be7b357e7b53ce562ca1eceb3`. **Historia i punkt przejęcia:** `docs/polutek-platform-audit`, [STAN.md](program-audytu/STAN.md), [h1-status.json](program-audytu/evidence/h1-status.json). Historyczny `roadmap-v1-plan.json` nie jest aktualnym statusem wykonania.

## Wyniki i ograniczenia

| Kontrola | Rzeczywisty wynik | Granica dowodu |
|---|---|---|
| Normalne npm ci + postinstall | exit 0, autentyczny Prisma 6.19.3 | Node 22.23.4, zachowano TLS/checksum; bez ignore-scripts i bez atrapy klienta. Lock/schema identyczne z końcowym kandydatem. |
| Prisma validate / migrate / smoke | 81 migracji, exit 0, status up-to-date | Nowa własna baza PostgreSQL 17.11; starszych baz raw SQL nie przebazowano. Po testach 103 tabele wraz z telemetry i autentyczna historia migracji. |
| Unit / komponenty | **4686 PASS / 0 FAIL / 3 pominięte**, 541 plików | Jawny wariant lokalny: ADMIN_DEV_* off, limiter pamięciowy; to nie Redis ani E2E. Licznik suite Vitest obejmuje describe, nie liczbę plików. |
| PostgreSQL | **75/75 PASS**, 12 plików, exit 0 | Rzeczywiste blokady/transakcje/triggery; Stripe i e-mail to jawne atrapy. |
| Komenda krytyczna | **36/36 PASS**, dwa pliki | Nadal komponentowa. Nie dodano jeszcze kompletnego zabezpieczenia przed przyszłym usunięciem jednego wskazanego pliku. |
| R37 — proces / restore | 31 testów procesowych + **11/11 realnych prób restore** | Własny pg_dump/pg_restore i niepuste dane syntetyczne, rola tylko do odczytu; verifier nie zmienił się między e79ec89c i końcowym SHA. Nie jest to odzysk offsite całego produktu. |
| Architektura / typy aplikacji / env CI | PASS | Fikcyjne wartości CI i własna DB; nie jest to odczyt aktywnej konfiguracji produkcji. |
| Typy całego repo | **exit 2: 81 diagnostyk w 41 plikach testów** | 25 dopasowań dotyczy legacy PATRON. Reszta m.in. niepełne fixtures i sygnatury mocków. To nie 81 błędów produktu; pełna atrybucja wymaga oddzielnych małych poprawek i porównania baseline. |
| Build strony | **exit 1**, te same 81 błędów typów | Kompilacja dochodzi do sprawdzania typów; nie przywrócono ignoreBuildErrors. |
| Build panelu | **exit 0**, rzeczywista aplikacja standalone | Lokalny build; digest Docker i gotowość produkcji niezweryfikowane. |
| Pełny lint | **exit 2**, konfiguracja react-hooks | Reguły odwołują się do niewidocznego w danym zakresie pluginu. Brak pełnego wyniku reguł; nie obniżono ich. |
| Hotspots / strict-escapes | **exit 1 / exit 1** | Cztery przekroczenia rozmiaru; pięć nowych dopasowań, w tym komentarz VideoPlayer z tekstem `: any`, wymagają osobnego rozstrzygnięcia. Bez podnoszenia limitów lub automatycznego odświeżenia baseline. |
| Rzeczywiste lokalne HTTP | **4/4 PASS** | Publiczne API pokazuje własny PUBLISHED i ukrywa DRAFT, private/no-store; built admin odmawia 503 bez CF Access. Publiczne dev, nie produkcyjny build/HLS. Własne fixtures i procesy posprzątane. |

Trzy pominięcia: dwa przypadki EmailEventLockService oznaczone jako real-DB w zwykłej konfiguracji oraz HLG/HDR z powodu możliwości lokalnego FFmpeg. Testy PostgreSQL są osobnym zestawem; nie zaliczono tych dwóch pominiętych przypadków automatycznie jako pokrytych. ENCODE_SMOKE na docelowym FFmpeg/workerze pozostaje otwarte.

**Cały odbiór wymagany do wydania nie przeszedł.** Same składowe `quality` (architektura, typy aplikacji, unit) przeszły w opisanym lokalnym wariancie. Zbiorczy przebieg CI ma exit 1, a późniejszy zielony unit nie zmienia porażek typów/lint/build strony. Żadnego całego pakietu H1 ani R01–R37 nie zamknięto; brak niezależnego przeglądu i scalenia.

## Przygotowane małe commity

Pięć wcześniejszych zmian przeniesiono przez cherry-pick na nowszy main, zachowując jego 11 zmian plików i regułę scroll-lock. Opublikowane stare gałęzie nie zostały przepisane; brak force push i merge.

| Krok | Commit na nowej bazie | Zakres |
|---|---|---|
| K02 | `989682ffd1b375214b22f8125e4cc0c28890c900` | Next/ESLint 16.4.1, sharp 0.35.5; lokalnie rzeczywiste librsvg 2.63.2/libvips 8.18.7. |
| K03/R37 | `7b2b341bd207a3ee1c3f669ca7b0138c32705719` | Obowiązkowe błędy odczytów/migracji/manifestu blokują SUCCESS; procesowe regresje. |
| K05 | `d3483af674ee0a2c2f295964de91d118e8c6fea8` | Darmowe VOD/napiwki, obecne Premium, przyszły marketplace i 9 otwartych decyzji. |
| K06 | `f7ff10b5f1b87b2b58ebeec978065ada9b09c305` | Obie konfiguracje sprawdzają typy. Pełny protokół artefaktu nadal otwarty. |
| K03 — targety | `e79ec89c7936248f1ef447f972a97cb0b9eaa26b` | Komenda krytyczna wskazuje dwa istniejące pliki. |
| K03 — fixtures DB | `8dce5f94016325c12a3ae82fd1c84d144a055efe` | Historyczny prefix migracji → cleanup → późniejsze migracje; main kanał fixture; świeża granica doby zamiast daty poza retencją. 16/16 celowanych i 75/75 pełnych PG. |

Starszy zbiorczy kandydat `fix/polutek-h1-foundations` (`f5e06154`), jego cztery gałęzie rodziców i baza `5f848a93` pozostają historyczne. Dokładne rodzice/pliki i pochodzenie dowodów: [source-map.json](program-audytu/evidence/h1-cloud-2026-11-02/source-map.json).

## Co jeszcze blokuje H1

1. **K03/K06:** 81 błędów typów testów, konfiguracja lint, cztery hotspots i pięć dopasowań strict-escapes. Naprawiać w małych pakietach z zachowaniem semantyki, bez odwracania polityk dostępu i bez wyłączania bramek. Następnie build strony i wymagane kontrole na końcowym SHA.
2. **K06/K02:** wymuszony związek źródeł, wejść, wyników i digest obrazu we wszystkich wspieranych ścieżkach; obraz z rzeczywiście ładowanymi poprawionymi bibliotekami. Lokalna wersja sharp i udany panel tego nie zastępują.
3. **K01/K03:** pełny API/worker/HLS/Redis/storage na własnym krótkim filmie, brakujące wymagane przypadki, autentyczny świeży start według zapisanych instrukcji oraz guard na zniknięcie każdego wymaganego targetu.
4. **K05:** aktualne flagi produkcji i DP01–DP09 pozostają niepotwierdzone/nieuzgodnione. Dokumentacja nie podejmuje za właściciela decyzji refundów, retencji, świeżości, cofania dostępu, SLO, RPO/RTO i budżetu.

Znane krytyczne pieniądze/uprawnienia, współbieżność pipeline/storage i usunięcie twórcy z R02–R36 nie zostały tą partią naprawione. Otwarte są też niezakończony audyt i odpowiednie bramki płatności/otwarcia platformy. Brak zgody na merge, deploy, produkcyjne korekty lub koszty.

## Dowody i odtworzenie

Nowa partia: [katalog dowodów](program-audytu/evidence/h1-cloud-2026-11-02/source-map.json), [zbiorczy przebieg](program-audytu/evidence/h1-cloud-2026-11-02/acceptance-run.json), [końcowy unit](program-audytu/evidence/h1-cloud-2026-11-02/unit-local-metadata.json), [typy — kolejka diagnostyk](program-audytu/evidence/h1-cloud-2026-11-02/typecheck-all-summary.json), [realny restore](program-audytu/evidence/h1-cloud-2026-11-02/real-restore-summary.json), [HTTP](program-audytu/evidence/h1-cloud-2026-11-02/http-smoke.json). Prywatne pliki env i binarny dump nie trafiają do repo.

Zachowano początkowe niepowodzenia: unit 4 błędy z ADMIN_DEV_FIXTURES=1; unit CI 1 błąd przez niemockowany limiter i fikcyjny Redis; PG 11 błędów z dwóch wadliwych fixtures; pierwsza korekta PG 15/16 — fixture nie miał flagi main dla późniejszej migracji. Końcowe wyniki wynikają z opisanych zmian warunków/testów, nie usunięcia asercji. `next dev` dopisał blok do AGENTS.md i zmienił next-env.d.ts; po zatrzymaniu procesu cofnięto wyłącznie te dwie własne generowane zmiany. Patch zachowany.

Harnessy w `program-audytu/tools/`: `run-h1-acceptance.mjs`, `verify-h1-real-restore.py`, `h1-http-smoke.mjs`. Przed przełączeniem gałęzi kopiować je poza checkout. Pierwszy odtwarza także czerwony wariant CI unit; końcowy unit używa jawnie pustych UPSTASH_REDIS_REST_* i KV_REST_API_* oraz ADMIN_DEV_* = 0. `h1-http-smoke.mjs` wymaga wcześniej zbudowanego panelu. Nie uruchamiać prób z gałęzi audytu z historycznym package.json; wybrać czystą gałąź kodu i Node 22. Zmiany package/lock wymagają normalnego npm ci bez audit; nigdy fake Prisma/TLS/checksum bypass.

Po odświeżeniu procesy mogą być zatrzymane: sprawdzić lokalny Docker według runtime skill, uruchomić tylko istniejący `polutek-cloud-db`, zaczekać na pg_isready. Własna konfiguracja `/workspace/.cloud-setup/h1.env` ma tryb 0600; helper `prepare-h1-db.py` zachowuje bazę i potwierdza historię, niczego nie resetuje.

Sieć runtime jest już connected/enforced/unrestricted/spec. 2; Prisma HTTP 200 i API GitHub działają. Nie trzeba ponownie odblokowywać dostępu ani prosić o token. Dawna odmowa uploadu grafu npm audit nadal obowiązuje; nie uruchamiać audit-high ani automatycznej bramki audit. Nowe instrukcje startowe zapisano i odczytano w szkicu rev. 8; skrypt instalacji i sieć pozostały bez zmian. Przegląd/zapis i publikacja w ustawieniach utrwalą instrukcje dla kolejnych środowisk; bieżąca praca nie jest od tego zależna.

Kanoniczne D01–D18 pozostają otwarte. ASVS: 86 W_TRAKCIE / 254 NIEZBADANE / 5 warunkowych NA / 0 PASS; wejścia 84/202 z 286. Odrębne Windows/batch17 zachowane. Nie rozpoczynać ogólnego V3+ zamiast domykania H1; pełny audyt pozostaje celem kolejnych kamieni.
