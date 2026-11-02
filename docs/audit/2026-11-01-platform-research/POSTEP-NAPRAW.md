# Postęp realizacji roadmapy — H1

Stan: 2 listopada 2026. **Zbudowano i sprawdzono prawdziwe obrazy strony, panelu i workera. Biblioteki poprawione; optymalizator HTTP 9/9 i worker HLS 3/3 bez pominięć. Wszystkie wykonane końcowe kontrole lokalne PASS. H1 i protokół wydania nadal otwarte.**

**Szacunkowo H1 80% / 20% pozostało; cała roadmapa 5–10% / 90–95% pozostało.** Wartość 90–95% oznacza pozostałą pracę całej misji. To orientacyjny nakład pracy, nie gwarancja bezpieczeństwa ani gotowość wdrożenia. Zero całych pakietów i ustaleń formalnie zamkniętych.

Kod [`fix/polutek-h1-acceptance`](https://github.com/pawelekbyra/polutek-pl/tree/fix/polutek-h1-acceptance), `9824bb0abba7ed3672935845dedc328ae94ad8ff`; [szkic PR #2065](https://github.com/pawelekbyra/polutek-pl/pull/2065), baza c80ef652. Handoff: [STAN](program-audytu/STAN.md), [h1-status](program-audytu/evidence/h1-status.json). Dokumentacja i dowody na `docs/polutek-platform-audit`. Bez merge/deploy.

## Końcowa weryfikacja na dokładnym SHA

| Kontrola | Wynik | Granica dowodu |
|---|---|---|
| Unit / komponenty | **4703 PASS, 0 FAIL, 2 pominięte**, 542 pliki | Pozostały dwa EmailEventLockService. Wartości CI są syntetyczne; pełnych integracji nie dowiedziono. |
| PostgreSQL | **75/75 PASS**, 12 plików | Własna prawdziwa DB; Stripe/e-mail to atrapy. |
| Testy krytyczne | **36/36 PASS** | Oba wymagane zestawy faktycznie wykonane; regresje strażnika nadal w pełnym unit. |
| Typy, lint, architektura, hotspots, strict-escapes, env | **PASS** | Lint 0 błędów / 100 ostrzeżeń. Env syntetyczny; budżety/baseline niezmienione. |
| Lokalne buildy strony i panelu | **PASS / PASS** | Kontrola typów włączona. |
| Docker: public / admin / worker | **3 zbudowane i uruchomione** | Archiwum konkretnego commita, bez lokalnych env; własne lokalne obrazy, bez publikacji do registry. |
| Faktycznie ładowane biblioteki | **Next 16.4.1, sharp 0.35.5, libvips 8.18.7, librsvg 2.63.2** we wszystkich trzech | 15 prób formatów/dekodowania, proces UID1000, brak sekretu CA w runtime, sieć wyłączona. |
| HTTP obrazów | **9/9 PASS** | Strona: prawdziwy optimizer logo i odmowy niedozwolonych hostów/SVG/parametru; panel: health procesu i 503 bez CF Access. Bez DB i portów publicznych. |
| Kodowanie we własnym obrazie workera | **3/3 PASS, zero pominięć** | FFmpeg 8.0.1, krajobraz/audio, pion 60 fps i syntetyczny HLG→SDR BT.709. Bez API/kolejki/storage; nie ocena wizualna prawdziwego HDR. |

Cały wykonany proces lokalny exit 0; `release_ready=false`. **Nie wymuszono jeszcze protokołu zatwierdzania obrazów we wszystkich ścieżkach publikacji/aktywacji.**

## Zmiany tej partii

- `835348d7`: opcjonalny certyfikat proxy przez sekret BuildKit w obu Dockerfile, TLS nadal weryfikowany, CA niekopiowany do warstw. Zadeklarowano już używany publiczny argument `NEXT_PUBLIC_BLOB_PUBLIC_HOST`.
- `a2708f00`: klip HLG jawnie zapisuje VUI; niezależny ffprobe potwierdza tagi przed wywołaniem kodu enkodera. Wadliwy fixture przestaje ukrywać test przez `skip`.
- `9824bb0a`: instrukcja bezpiecznej obsługi CA w lokalnych buildach.

Początkowy worker na `835348d7` miał wynik 2 PASS/1 pominięty; wrapper prawidłowo zwrócił exit 1. Kontrolne klipy wykazały utratę transfer/primaries przy samych opcjach kodeka, przy zachowaniu ich przez jawne VUI/setparams. Zachowano pierwsze wyniki i zapisane powtórzenie eksperymentu. Po zmianie fixture docelowy worker wykonał 3/3, a zwykły zestaw także wykonał HDR. Kod enkodera nie został zmieniony.

## Identyfikatory i granice artefaktu

Dokładne lokalne identyfikatory obrazów, tagi, hash archiwum, jawne argumenty budowy, obserwowane bazy i zgodność warstw są w [images-run.json](program-audytu/evidence/h1-images-2026-11-02/final/images-run.json). Każdy runtime był uruchamiany po niezmiennym ID. Te ID są digestami konfiguracji lokalnego Dockera; nie są manifestami opublikowanymi w registry. Lokalne etykiety SHA/hash wejść nadaje helper badawczy, nie stanowią attestation.

Hash wejść obejmuje wymienione pliki, archiwum i jawne argumenty. Bazowy tag Node pozostaje zmienny; jego faktyczne ID/digests i zgodność początkowych warstw zapisano osobno. Nie jest to kompletna deklaracja wszystkich wejść budowy. Migrator i collector nie zostały w tej partii zbudowane. Nie uznawać tego materiału za zamknięte K06.

## Pozostałe warunki

1. **K06:** obowiązkowy związek źródeł/wejść/wymaganych testów i tożsamości obrazu we wszystkich wspieranych ścieżkach: lokalna budowa/istniejące tagi, GHCR/manual/tag workflow, panel, migrator, worker i collector. Próby ujemne mają zatrzymywać publikację/aktywację przy błędnym typie/teście/SHA/digest/zmienionych wejściach. Same etykiety i raport nie wystarczą.
2. **K01/K03:** pełne własne API/kolejka/worker/HLS/Redis/storage i dwa pozostałe przypadki e-mail DB. Trzy syntetyczne encody nie zastępują tego cyklu.
3. **K05:** aktywna konfiguracja i DP01–DP09 nadal otwarte. Późniejsze naprawy finansów, uprawnień, pipeline/usuwania i dalszy pogłębiony audyt pozostają w roadmapie.
4. `npm audit`/audit-high nie ponawiano po wcześniejszej automatycznej odmowie wysłania grafu zależności. Nie ogłaszać tej niewykonanej kontroli jako PASS.

## Dowody i przejęcie

[Bieżąca atrybucja](program-audytu/evidence/h1-images-2026-11-02/source-map.json), [pełny odbiór](program-audytu/evidence/h1-images-2026-11-02/final/acceptance/acceptance-run.json), [worker HDR](program-audytu/evidence/h1-images-2026-11-02/final/worker-ffmpeg-run.json). Starsze dowody i czerwone wyniki zachowane: [poprzednia partia](program-audytu/evidence/h1-gates-2026-11-02/source-map.json), [Prisma/restore/HTTP](program-audytu/evidence/h1-cloud-2026-11-02/source-map.json). Schema, migracje, Next configi, lockfile, oba tsconfigi, guards i kod enkodera bez zmian.

W `program-audytu/tools/` zapisano użyte helpery. Skopiować je poza checkout, wybrać czystą gałąź kodu i Node 22.23.4. Przed powtórzeniem zmienić katalogi wyjściowe, by nie nadpisać dowodów; skopiować `h1-image-runtime-probe.cjs` jako `runtime-probe.cjs` do katalogu oczekiwanego przez builder. Builder wymaga dostępnego BuildKit i dostarczonego CA, sam archiwizuje HEAD i odmawia użycia istniejącego katalogu kontekstu. Pełna akceptacja używa prywatnego h1.env (0600) i własnej bazy. Nie przełączać checkoutu w trakcie testów/buildów; jedno ciężkie polecenie naraz. Kontenery prób są usuwane; lokalne obrazy/cache zachowano do następnej partii.

ASVS 86 częściowych/254 NIEZBADANE/5 warunkowych NA/0 PASS; wejścia 84/202 z 286; wszystkie 18 obszarów otwarte. R01–R37 i Windows/batch17 zachowane. Nie zmieniano ani nie publikowano konfiguracji środowiska. Dalszy pogłębiony audyt czasowo odłożony na rzecz H1, nie anulowany. Po partii commit/push obu gałęzi i weryfikacja zdalnych SHA; bez scalenia, wdrożenia, produkcji i kosztów.
