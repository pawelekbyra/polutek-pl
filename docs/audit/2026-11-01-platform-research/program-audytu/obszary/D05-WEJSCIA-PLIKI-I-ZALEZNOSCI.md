# D05 — wejścia, pliki, FFmpeg, SSRF i zależności

Partia 08, 1 listopada 2026. Polutek `c397b9e548ca2c628e21457ac69d66e54b12ddbd`; PeerTube `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`. **W_TRAKCIE**, bez zmian aplikacji i produkcji. [Zakres/hash źródeł](../evidence/batch08-review.json), [25 scenariuszy komponentów](../SCENARIUSZE-WEJSCIA.csv), [kontrola artefaktów](../evidence/validation-batch08.json).

## Co to oznacza dla właściciela

Polutek ma konkretne zabezpieczenia plików i uruchamiania procesów, a ich część działa w wykonanych próbach. Nie ma podstaw, żeby nazywać ten kod bezwartościowym. Są też luki w kompletności ochrony: R15 potwierdzono dokładniej, a R01 pozostaje pilnym ryzykiem zależności. Te wyniki nie wystarczają do uznania całej platformy za bezpieczną lub gotową na dużą skalę.

Nie dodajemy nowego numeru problemu tylko dlatego, że zajrzeliśmy głębiej. Doprecyzowano istniejące **R01 i R15**. Cztery badane spreparowane pliki nie wykonały żądania sieciowego przez ffprobe. Przekierowania/DNS przy pobieraniu miniatur oraz budżet czasu całego kodowania pozostają otwartymi pytaniami, bez dowodu wykorzystania.

## Co rzeczywiście uruchomiono

| Próba | Wynik | Granica dowodu |
|---|---|---|
| Pięć istniejących plików Vitest | Cztery pliki przeszły, jeden zablokowany; 38 zarejestrowanych testów, 38 passed, zero failed/pending assertions; globalny exit 1 | Plik `admin-content/files.test.ts` nie zarejestrował testów przez niewygenerowane Prisma. Nie zaliczamy go. Testy napisów w `public/subtitles` dotyczą istniejących plików, nie walidatora uploadu |
| Rzeczywiste czytniki JSON/multipart | 14 obserwacji, exit 0 | Native Request/ReadableStream/FormData i Zod w procesie Node; importy tożsamości/kontekstu to jawne, niewywołane atrapy; brak HTTP/Next |
| Rzeczywiste run/probeSource i FFmpeg | 11 obserwacji, exit 0 | Pliki syntetyczne i własny serwer `127.0.0.1`; brak produkcji, R2 i pełnego kodowania |
| Zależności | Lokalny lockfile/metadane i dwa publiczne komunikaty pobrane online | Brak nowego pełnego `npm audit`, exploitów i inspekcji kontenera produkcji |

Źródła wyników: [Vitest JSON](../evidence/input-targeted-vitest.json), [log](../evidence/input-targeted-vitest.log), [JSON/multipart](../evidence/input-boundaries-experiment.json), [FFmpeg](../evidence/ffmpeg-input-experiment.json), [metadane zależności](../evidence/dependency-local-metadata-batch08.json). Nie sumujemy testów i obserwacji jako liczby niezależnych wymagań bezpieczeństwa.

Skrypty: [czytniki](../tools/input-boundaries-experiment.cjs), [FFmpeg](../tools/ffmpeg-input-experiment.mjs). Przed wykonaniem sprawdzają hashe rzeczywistych źródeł względem inwentarza bazowego. Pierwszy przebieg FFmpeg miał exit 0; zachowano jego [wynik](../evidence/ffmpeg-input-experiment-initial.json). Dodano kontrolę dodatnią dostępu **ffprobe** do własnego serwera i wykonano finalny przebieg. Po utracie sesji narzędzia przed odczytem kodu wyjścia potwierdzono exit 0 osobnym przebiegiem; JSON był identyczny bajt w bajt, log pusty. Początkowy prototyp tych czterech plików w `/tmp` nie jest osobnym niezależnym dowodem.

## R15 — limit pola nie ogranicza kosztu odczytu całego żądania

[`readStudioJson`](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/api/studio-route.ts#L53) i [`readJson` panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/api/panel-route.ts#L45) wykonują `request.json()` przed `schema.safeParse`. Rzeczywista trasa [ukończenia uploadu w Studiu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/studio/videos/%5Bid%5D/upload/complete/route.ts) używa tego czytnika po sprawdzeniu sesji. Zod ma limity pól/tablic, ale dostaje już sparsowany obiekt.

W badaniu podano JSON o 65 548 bajtach i schemat z limitem tytułu 32 znaki. Oba czytniki pobrały całość, a potem odmówiły statusem 400. Schemat eksperymentu jest syntetyczny: dowodzi kolejności wspólnego czytnika, nie konkretnego kontraktu tytułu w API Polutka. Prawidłowe małe wejścia zaakceptowano.

[`readUploadedFile`](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/api/panel-route.ts#L53) sprawdza zadeklarowany Content-Length, potem parsuje **całe** `formData()`, następnie rozmiar wybranego pliku. Limit nie obejmuje rzeczywistej sumy wszystkich pól przy braku nagłówka. Przy eksperymentalnym limicie pliku 1 KiB plik 128 B i nieużywane pole 96 KiB dały zaakceptowane 98 706 B całego body. Z poprawnie zadeklarowaną dużą długością ten sam formularz dostał 413 przed odczytem. Wybrany plik 2048 B został odrzucony, lecz dopiero po odczycie całego formularza. Brak pliku dał 400.

Rzeczywiste wejścia panelu używają większych limitów: okładka 5 MiB, napisy 1 MiB. [Okładka Studia](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/studio/videos/%5Bid%5D/cover/route.ts) ma analogiczną kolejność. Nie wykonano ich dispatchu HTTP ani sesji/Access/CSRF. Nie znamy skutecznego limitu całego żądania narzuconego przez aktywny proxy/serwer produkcji. Fałszywy niski Content-Length badano wyłącznie jako obiekt Web Request; nie jest to dowód zaakceptowania sprzecznego framingu przez serwer HTTP.

**Działająca kontrola:** [`readRequestJsonWithLimit`](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/utils/request-body.ts) odrzucił za duży nagłówek bez odczytu, a bez nagłówka lub z zaniżonym zatrzymał odczyt po 1280 B przy limicie 1024 B i porcjach 256 B. Błędny mały JSON dostał osobny MalformedJsonBodyError. Taki helper istnieje; nie jest konsekwentnie używany przez badane czytniki.

R15: **POTWIERDZONE w kodzie i komponentach**, P1/P2 zależnie od ekspozycji; brak pomiaru DoS. Przyszła poprawa: limit sumy rzeczywistych bajtów przed parserem, rozsądne limity liczby pól/części oraz zgodna polityka proxy/aplikacji. Osobno zachować limit pliku i walidację treści. Próba akceptacyjna ma obejmować legalne pliki blisko limitu, brak długości, wiele pól i współbieżność przez rzeczywisty stos HTTP.

## Pliki i procesy — co działa oraz czego nie sprawdzono

[Polityka oryginałów](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/domain/upload-policy.ts) zawiera allowlistę rozszerzeń, rozmiar minimum 64 KiB, domyślnie maksimum 10 GiB i twardy pułap konfiguracji 50 GiB. Weryfikuje też deklarowany typ. Początkowe bajty rozpoznają MP4, Matroska, AVI i TS. Nie jest to pełna walidacja pliku: kod sam opisuje ten etap jako wstępną bramkę, a późniejszy ffprobe ma sprawdzić strumień wideo. Przy complete następują HEAD/porównanie rozmiaru/sniff; ffprobe jest dopiero w workerze. Nie zaliczono tu end-to-end tej całej ścieżki.

Oryginalna nazwa pliku jest czyszczona do metadanych; klucz magazynu powstaje z ID filmu, czasu i sprawdzonego rozszerzenia. [Adapter encodera](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/infrastructure/encoder.adapter.ts) ogranicza preset i nice. [run/probeSource](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/hls/encode-hls.mjs#L346) uruchamia argumenty przez spawn, bez shella. W próbie nazwa z `; touch PWNED;` pozostała dosłowną nazwą i nie utworzyła znacznika. To jedna konkretna kontrola, nie audyt wszystkich wywołań systemowych projektu.

Prawidłowe wideo 64×64 zostało rozpoznane, plik audio bez wideo odrzucony. ffprobe ma domyślny timeout 60 s, ograniczenie stdout 4 000 000 i AbortSignal; stderr jest przycinany. Badanie run na krótkich, kontrolowanych procesach Node potwierdziło TimeoutError, OutputLimitError oraz przerwanie aktywnego procesu. Nie wywołano rzeczywistego zawieszenia dekodera. Limit stdout implementacja liczy długością stringa; nie badano wielobajtowej dokładności ani ścieżki postępu.

Loudness, główne kodowanie i poster przekazują signal, ale nie mają w tych wywołaniach twardego timeoutu. [Deklarowany worker](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/deploy/serwerek/docker-compose.yml#L41) ma osobny kontener, limit pamięci 1500m, niższy udział CPU, init i konfigurację środowiska. [Dockerfile](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/deploy/serwerek/Dockerfile#L55) deklaruje USER node i FFmpeg **8.0.1**, podczas gdy badano binaria hosta **7.1.5-0+deb13u1**. CPU shares oznacza wagę przy rywalizacji, nie twardy budżet CPU. Nie zweryfikowano produkcyjnych limitów, uprawnień DB ani izolacji egress. Otwarte: czas/zasoby na materiał, postęp a heartbeat, restart, rozdzielczość, liczba strumieni, uszkodzone kontenery i dokładnie docelowy build FFmpeg. Nie dopisano nowej usterki bez świadectwa blokady.

Okładki mają sygnatury JPG/PNG/WebP, napisy walidację UTF-8/WebVTT i rozmiaru w [domain/files](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/admin-content/domain/files.ts). Sygnatura obrazu nie oznacza pełnego dekodowania ani limitu pikseli. Test ich eksportu przez index został zablokowany przez Prisma; nie zamieniano importów w aplikacji ani nie podkładano fałszywego klienta. Pozostają próby pełnych dekoderów, ogromnych wymiarów, wyświetlania napisów i wszystkich innych uploadów, np. avatarów/bannerów.

## SSRF — wynik negatywny ma wąski zakres

Zbudowano cztery pliki 64 KiB: XML DASH z odwołaniem wyłącznie do własnego lokalnego filmu i początkowymi komentarzami `ftyp`, `free`, `skip`, `pnot`. Każdy przechodzi rzeczywiste pure `validateUploadRequest` oraz `sniffVideoContainer` jako MP4. Każdy został następnie **odrzucony przez rzeczywisty ffprobe**, z komunikatem `moov atom not found`; dla każdego licznik żądań do fixture wyniósł **zero**. Kontrola dodatnia: ffprobe odczytał prawidłowe MP4 bezpośrednio z tego samego endpointu, więc brak żądań nie wynikał z niedziałającego serwera.

Nie potwierdzono SSRF tymi czterema plikami. Nie jest to dowód odporności wszystkich demuxerów, wariantów metadanych i wersji FFmpeg. Nie przyjęto skrótu „brak format_whitelist = wykorzystana luka”; lokalny plik pobrany z R2 i zdalny URL podany FFmpeg mają inne granice protokołów.

Przy miniaturach [MediaPolicy](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/media/domain/media.policy.ts) wymaga HTTPS, odrzuca wybrane prywatne hosty literalne i stosuje dokładną listę hostów. [ThumbnailResponseService](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/media/infrastructure/thumbnail-response.service.ts) czyta własny prywatny R2 przez klienta magazynu; zewnętrzny URL przechodzi walidację przed fetch. Ten fetch ma domyślne podążanie za redirect; w tej funkcji nie ma ponownej walidacji celu/DNS ani jawnego timeoutu. **Otwarta hipoteza**: kontrola domeny/redirectu lub DNS mogłaby zmienić adres docelowy. Nie wykazano kontroli napastnika nad dozwolonym hostem, realnego redirectu do prywatnej sieci ani obejścia domyślnej allowlisty. Istniejące testy serwisu podmieniają MediaPolicy/fetch; nie dowodzą rzeczywistej izolacji sieciowej. Przyszła próba wymaga własnych kontrolowanych domen/transportu i jawnej granicy sieci, bez produkcji.

## R01 — potwierdzone wersje objęte ostrzeżeniami, bez dowodu RCE

Lockfile oraz lokalna instalacja wskazują **Next 16.3.8, sharp 0.35.4**. Lokalnie sharp zgłasza **librsvg 2.62.91**, libvips 8.18.6; host to Linux/glibc 2.41. Deklarowany runner aplikacji to node:22-bookworm-slim, także rodzina glibc; nie pobierano jego aktualnego obrazu ani nie odczytywano produkcji. [Osobna ocena i hashe](../evidence/dependency-review-batch08.json).

Pobrano publiczne, recenzowane przez GitHub komunikaty:

- [GHSA-2464-fhr4-w9xw](../sources/GHSA-2464-fhr4-w9xw.json): CRITICAL dla optymalizacji obrazów Next na glibc; gałąź 16 ma poprawkę 16.4.1, poprzednia 15.5.28. Wskazane obejście to rzeczywista wersja sharp co najmniej 0.35.5.
- [GHSA-wq5f-xc86-pv6w](../sources/GHSA-wq5f-xc86-pv6w.json): HIGH, upstream librsvg; sharp 0.35.5 dostarcza librsvg 2.63.2. Opis uzależnia możliwość RCE od warunków runtime, m.in. budowy Node PIE. Nie sprawdzano tych warunków na produkcji.

To dwa powiązane komunikaty dotyczące tego samego łańcucha, nie dwa niezależnie wykonane exploity. Następna poprawiona wersja nie oznacza automatycznie, że aktualizacja całego projektu nie wymaga testów. W osobnym etapie napraw potrzebne będzie odświeżenie zależności/lockfile, sprawdzenie rzeczywiście użytej kopii sharp i test ścieżek obrazów, builda oraz regresji.

Obecny kod Next ma odrzucenie rozpoznanego SVG, gdy dangerouslyAllowSVG jest wyłączone; konfiguracja Polutka go nie włącza i ogranicza zewnętrzne hosty. Ten sam Next dopuszcza loader SVG w sharp. Nie ustalono, czy i jak wejście kontrolowane przez napastnika osiąga podatny parser w pełnej aplikacji. Samo odrzucenie zwykłego SVG nie unieważnia oficjalnego ostrzeżenia, ale także nie wolno uznać każdej miniatury za dowiedzione RCE.

R01: **POTWIERDZONE dopasowanie wersji do publicznych advisory**, pilny przegląd/naprawa P0 z raportu bazowego, niezależny przegląd nadal PENDING. Brak wykorzystania i brak dowodu incydentu. Historyczna liczba alertów w raporcie bazowym pozostaje historyczna, nie jest nowym pomiarem.

Automatyczna kontrola zatwierdzeń odrzuciła nowe `npm audit`, ponieważ wysłałoby graf zależności prywatnego projektu do rejestru npm. Proces nie został uruchomiony; nie ponawiano go inną drogą. [Zapis blokady](../evidence/npm-audit-not-executed-batch08.json). Bez wysyłania grafu pobrano dwa już znane publiczne advisory metodą GET. [Log adresów/statusów/hashów](../sources/fetch-advisories-batch08.json) zachowuje również dwie odpowiedzi 404 przed poprawieniem publicznych ścieżek. Nie wykonano świeżego pełnego skanu zależności.

## Co PeerTube robi dojrzalej w tym zakresie

| Mechanizm w przypiętym PeerTube | Polutek / sens dla przyszłych prac |
|---|---|
| [ffmpeg-utils: buildRemoteInputOptions](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/ffmpeg/src/ffmpeg-utils.ts#L21) dodaje format_whitelist dla wejść HTTP(S); wyklucza demuxery otwierające zagnieżdżone URL | Dobry wzorzec przy przyszłym streamowaniu oryginału po signed URL. Dla lokalnego pliku funkcja PeerTube zwraca pustą listę; nie twierdzimy, że każda lokalna operacja PeerTube ma whitelistę |
| [ffprobe](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/ffmpeg/src/ffprobe.ts#L11) i [wrapper](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/ffmpeg/src/ffmpeg-command-wrapper.ts#L106) współdzielą tę politykę; błędy redagują signed URL, wrapper obsługuje abort | Warto utrzymywać wspólną politykę probe/encode/miniatur i nie ujawniać podpisów w logach. Sama obecność AbortSignal nie dowodzi pełnego limitu czasu |
| [buildSSRFSafeGot](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/helpers/requests.ts#L164): kontrola IP, lookup DNS oraz beforeRequest/beforeRedirect, zależnie od konfiguracji PREVENT_SSRF | Szerszy wzorzec niż jednorazowa kontrola początkowego hostname. Nie przypisujemy go każdemu połączeniu PeerTube ani nie uznajemy za dowód odporności na każdy wariant proxy/DNS |
| [Parser JSON](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/server.ts#L286) ma jawny limit 500kb przed handlerami | Przydatny wzorzec warstwy wspólnej. Polutek ma dobry helper strumieniowy, ale badane helpery Studia/panelu go nie używają. Nie kopiować liczby 500kb bez policzenia legalnego ukończenia 10 000 części |

PeerTube nie był uruchamiany ani testowany w tej partii. To porównanie wskazanych mechanizmów źródłowych, nie certyfikat jego bezpieczeństwa. Nie kopiowano implementacji. Publiczne advisory pochodzą z GitHub Advisory Database, GitHub i współtwórcy, CC BY 4.0; zachowano niezmienione JSON-y, [licencję](../sources/github-advisory-database-LICENSE.md) i atrybucję w [SOURCES](../SOURCES.md).

## Co pozostaje do zamknięcia D05

Nie oceniono całej obsługi XSS/SQL/NoSQL/template injection, nagłówków/CSP, wszystkich uploadów, API/CSRF, sekretów, konfiguracji sieci i dostawców ani całego łańcucha zależności. Wymagania ASVS powiązane z tą partią mają wyłącznie W_TRAKCIE. Żadne nie zostało zaliczone na podstawie kilku kontroli.

Potrzebne: rzeczywisty limit HTTP przez proxy/Next dla wszystkich parserów, formaty i fuzzing dokładnego obrazu encodera, zasoby/czas/dekodery obrazu, kontrolowane redirect/DNS, aktualizacja zależności w osobnym etapie oraz niezależna ocena. Znana blokada pobrania Prisma nadal uniemożliwia pełną walidację stosu. Kolejna partia programu powinna rozszerzyć zasięg na **D10: pieniądze, uprawnienia płatne i integracje zdarzeń**, zachowując otwarte pytania D05.


## Rozwinięcie z 2 listopada 2026 — partia 17

[Kwalifikacja ASVS V1/V2](ASVS-V1-V2-KWALIFIKACJA.md) obejmuje wszystkie 43 wymagania tych rozdziałów, 16 obserwacji czystych komponentów i 46 celowanych assertions passed. To osobny poziom przeglądu: 38 wymagań częściowo W_TRAKCIE, pięć warunkowych wyłączeń nieobecnych technologii, bez PASS. [Szczegóły](../ASVS-V1-V2.csv), [otwarte pytania](../PYTANIA-ASVS-V1-V2.csv). Nie dodano nowego ID, nie zmieniono dawnych dowodów R01/R15 ani aplikacji. Bieżący następny krok jest w STAN.md; opis kolejności partii 08 powyżej pozostaje historyczny.
