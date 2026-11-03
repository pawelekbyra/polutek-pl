# D09 — odtwarzanie, tokeny i cache

1 listopada 2026, partia 07. **W_TRAKCIE.** Polutek: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. Zakres: decyzja dostępu → pełny PlaybackService → podpis → plan publiczny, funkcja fetch Workera, napisy, ponowne użycie sesji i wybrane zabezpieczenia klienta. Nie uruchomiono całej aplikacji, przeglądarki z filmem ani platformy Cloudflare.

## Wniosek dla właściciela

Ta część ma konkretne mocne strony: podpis obejmuje film, wersję, termin i rodzaj tokenu; Worker sprawdza go przed cache. Wspólny cache nie daje dostępu bez ważnego podpisu. Chronione odpowiedzi zachowują private także po trafieniu we wspólną kopię. Klient odrzuca plan poprzedniego użytkownika, a serwer nie przypisuje cudzej sesji odtwarzania nowemu widzowi. Celowane istniejące testy dały **33/33**.

Znaleziono **R30, P2:** film usunięty moderacyjnie lub należący do ukrytego kanału może ujawnić tytuł, adres miniatury, a zalogowanemu obcemu widzowi także termin przyszłej premiery. Decyzja dostępu już poprawnie zwraca NOT_FOUND, lecz późniejsza obsługa premiery wykonuje się przed ukryciem metadanych. Nie wydaje tokenu ani źródła filmu.

Istniejący **R07** ma teraz dowód wykonania: nowy plan odmawia, a wcześniej wydany link nadal przechodzi przez Worker do wygaśnięcia. To znany, opisany kompromis stateless bearer links, nie nowe obejście podpisu. Docelowa polityka platformy musi określić czas egzekwowania blokady i cofnięcia sprzedaży.

## Wykonanie i granice dowodu

| Materiał | Wynik i znaczenie |
|---|---|
| [Celowany Vitest JSON](../evidence/playback-targeted-vitest.json), [log](../evidence/playback-targeted-vitest.log) | Cztery rzeczywiste pliki, 33 zarejestrowane testy, wszystkie przeszły; 10 suites w JSON to zagnieżdżone grupy, nie 10 plików |
| [Skrypt badawczy](../tools/playback-access-experiment.cjs), [38 obserwacji](../evidence/playback-access-experiment.json) | Niezmieniony checkVideoAccess, PlaybackService, signer, sanitizer i funkcja Workera; rzeczywiste Node/WebCrypto/Request/Response, jawne atrapy DB/R2/cache |
| [Zakres i hashe](../evidence/batch07-review.json) | Częściowo przejrzane/wykonane moduły i wybrane zależności/wiring; bez zaliczenia całych plików |
| [Scenariusze odtwarzania](../SCENARIUSZE-ODTWARZANIE.csv) | Osobny wynik komponentów i status pełnego stosu NIEWYKONANE |

Skrypt wykonuje 31 modułów TypeScript i bezpośrednio importuje niezmieniony moduł Workera. Obserwator decyzji deleguje do rzeczywistego checkVideoAccess i zapisuje jego wynik; nie podmienia allow/deny. Wartości enumów pochodzą z przypiętego schema. Nie instalowano ani nie podstawiano klienta Prisma.

Z 38 obserwacji: 15 planów dostępu (w tym trzy warianty R30), pięć granic ponownego użycia sesji, 14 zachowań Workera i cztery pary nowa odmowa/stary token. Łącznie 30 kontroli poprawnego zachowania, trzy warianty R30 i pięć obserwacji właściwości R07, wliczając cache po usunięciu obiektu z atrapy origin. Nie sumować ich z 33 testami jako liczby niezależnych wymagań bezpieczeństwa.

Zegar skryptu jest **symulowany**. Migawki po „logout”, zawieszeniu kanału, cofnięciu publikacji i usunięciu moderacyjnym są danymi wejściowymi; nie wywołano rzeczywistych endpointów tych operacji. Patron gate jest jawnie off, entitlement i użytkownicy są sztuczni. Test PAID sprawdza gałąź decyzji, nie uruchomioną sprzedaż. Nie używano prawdziwych danych ani sekretów, a tokenów i podpisanych URL-i nie zapisano do wyników.

Cache w skrypcie przechowuje wyłącznie badane pełne odpowiedzi GET. Nie odwzorowuje rzeczywistych czasów eviction, globalnego purge, Range ani cache przeglądarki. Istniejący test Range też używa atrapy; wymaga osobnego potwierdzenia na runtime Cloudflare. Pełne video playback, Safari, CDN, R2 i HTTP aplikacji pozostają otwarte.

## R30 — bramka premiery wyprzedza odmowę ujawnienia metadanych

[checkVideoAccess](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/access/application/check-video-access.use-case.ts) odrzuca film z moderationStatus=REMOVED albo kanałem SUSPENDED dla obcego widza. Zwraca hasAccess=false i NOT_FOUND. Ten fragment działa zgodnie z intencją.

[PlaybackService](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playback/application/playback.service.ts#L194) odczytuje następnie wiersz po ID i sprawdza przyszłą premierę. Jeżeli status nadal jest PUBLISHED i premiereAt w przyszłości, buduje LOGIN_REQUIRED dla gościa lub COMING_SOON dla użytkownika, z player.title i player.poster. Właściwa gałąź NOT_FOUND, która usuwa te pola, znajduje się później. [toPublicPlaybackPlan](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playback/application/public-playback-plan.ts) usuwa źródło i tracking planu odmownego, lecz zachowuje title/poster/premiereAt.

| Przypadek zwykłego obcego widza | Centralna decyzja | Plan po sanitizerze |
|---|---|---|
| Nieistniejący film | NOT_FOUND | UNAVAILABLE, bez tytułu/postera |
| REMOVED bez przyszłej premiery | NOT_FOUND | UNAVAILABLE, bez tytułu/postera |
| Ukryty kanał bez przyszłej premiery | NOT_FOUND | UNAVAILABLE, bez tytułu/postera |
| REMOVED i przyszła premiera, gość | NOT_FOUND | LOGIN_REQUIRED, tytuł i adres miniatury |
| Ukryty kanał i przyszła premiera, gość | NOT_FOUND | LOGIN_REQUIRED, tytuł i adres miniatury |
| Ukryty kanał i przyszła premiera, zalogowany obcy | NOT_FOUND | COMING_SOON, tytuł, adres miniatury i termin premiery |

We wszystkich trzech wariantach R30 źródło, token, napisy i sesja są nieobecne; sesja nie jest tworzona. Nie wykazano odtworzenia ukrytego filmu. Adres miniatury w fixture jest adresem proxy, **nie dowodem pobrania prywatnego obrazka**.

Warunek obejmuje znany identyfikator filmu, stan PUBLISHED, przyszłe premiereAt oraz odmowę z powodu moderacji lub widoczności kanału. Nie wymaga wyścigu, bycia członkiem kanału ani personelu. Nie dotyczy każdego ukrytego filmu: ARCHIVED/DRAFT nie spełniają reguły isUpcomingPremiere. Kontrole z normalną publiczną premierą nadal prawidłowo odmawiają odtworzenia.

[Middleware](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/middleware.ts#L103) dopuszcza publiczne wywołanie media-source; [handler](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/media-source/%5BvideoId%5D/route.ts#L84) zwraca cały zsanityzowany plan przy statusie 403. Odczytano to źródłowo, nie wykonano dispatchu Next/HTTP. Znajomość ID i limit zapytań ograniczają praktyczne odkrywanie zasobów; nie eliminują ujawnienia dla znanego ID.

**P2:** niespójność prywatności metadanych i rozróżnienie ukrytego zasobu od nieistniejącego. Kierunek naprawy: uszanować odmowę NOT_FOUND przed budowaniem informacji o premierze, zachowując ochronę przed wcześniejszym wydaniem tokenu. Odbiór: te same scenariusze przez prawdziwe HTTP, dla gościa, obcego użytkownika, członka i personelu, po ID/obsługiwanym aliasie; ukryta odmowa bez tytułu, postera i terminu, normalna publiczna premiera i legalny podgląd działają. Nie zmieniono implementacji; niezależny przegląd PENDING.

## R07 — odmowa nowego planu i życie wcześniej wydanego linku

W czterech przebiegach najpierw rzeczywisty PlaybackService wydał plan, a Worker wypełnił atrapę cache. Następnie przekazano nową migawkę aktora/stanu i zbudowano nowy plan. Nowy plan odmawia bez źródła, lecz stary podpisany link daje 200 HIT. Po symulowanym przekroczeniu exp Worker daje 403 **przed odczytem cache**.

| Nowa migawka | Nowy plan | TTL wydanego wcześniej tokenu przy badanych ustawieniach |
|---|---|---|
| Gość zamiast zalogowanego przy LOGGED_IN | LOGIN_REQUIRED | 1800 s |
| Kanał SUSPENDED | UNAVAILABLE | 1800 s |
| Film DRAFT | UNAVAILABLE | 1800 s |
| Publiczny film REMOVED | UNAVAILABLE | 21600 s |

Token nie zawiera użytkownika ani identyfikatora sesji. Sprawdzenie aktualnego konta/filmu przy żądaniu segmentu nie występuje w Workerze. Sesja odtwarzania służy osobnej ewidencji, a jej ponowne użycie nie unieważnia bearer linku. To różne mechanizmy od wcześniej zmierzonego cache sesji Better Auth (R24).

Wynik R07 nie oznacza, że Worker akceptuje wygasły token: odrzuca go także przy ciepłym cache. Nie ustalono faktycznych TTL produkcyjnych. 30 min/6 h to jawne wartości badanego przebiegu zgodne z domyślnymi w kodzie. Dla publicznego segmentu odpowiedź ma też rok max-age po stronie klienta; po exp żądanie docierające do Workera odmawia, ale już zachowanych kopii nie obejmuje ten test.

Osobna obserwacja: po wyczyszczeniu atrapy origin ciepły cache nadal zwraca obiekt bez ponownego R2 GET. Nie ustala to czasu retencji rzeczywistego Cloudflare ani skuteczności globalnego usuwania. Oficjalna dokumentacja [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), pobrana online do [kopii](../sources/cloudflare-workers-cache.mdx), opisuje brak subrequestu do origin przy cache.match i lokalny zasięg cache.delete; globalne usuwanie wymaga właściwego mechanizmu purge. [Pochodzenie, hashe i licencja](../sources/fetch-cloudflare-batch07.json).

[Dokumentacja Polutka](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/docs/architecture/self-hosted-hls.md#L28) już opisuje możliwość kopiowania URL na czas TTL jako akceptowalny kompromis dla darmowych filmów po zalogowaniu. Dla docelowej platformy i sprzedaży trzeba ustalić wymagany czas cofnięcia oraz spójność purge/cache. Nie wpisujemy nowej usterki za znane R07 ani nie zmieniamy polityki bez decyzji właściciela.

## Potwierdzone poprawne granice

- Zmiana filmu, wersji, podpisu lub dopisanie .pub do chronionego tokenu daje 403 przed cache; bezpośrednia ścieżka /c nie jest publicznym obejściem.
- Publiczny i chroniony token mogą korzystać z tej samej kopii edge; odpowiedź chroniona nadal ma private. CORS dla obcej strony nie jest udzielany, ale CORS sam nie stanowi tożsamości ani zabezpieczenia bearer linku.
- Chroniony plan umieszcza napisy pod tym samym tokenem; Worker mapuje tylko prawidłowy kształt nazwy na klucz napisów tego filmu. Odmowa planu nie ujawnia ścieżki napisów; legacy zewnętrzne URL-e napisów pozostają osobnym zakresem migracji.
- Serwer zachowuje własną sesję użytkownika lub gościa z tym samym fingerprintem. Cudza sesja, inny film albo inny fingerprint gościa powodują utworzenie nowej sesji zamiast przypisania cudzej. Fingerprint nie jest podpisem tokenu dostarczania.
- Istniejące testy React sprawdziły usunięcie starego planu przy zmianie użytkownika, odrzucenie spóźnionej odpowiedzi, odnawianie przez dwie symulowane godziny i ograniczenie częstotliwości dla krótkiego tokenu. Są testami komponentów/jsdom, nie pomiarem dwugodzinnego filmu na urządzeniu.

## PeerTube jako odniesienie

W przypiętym PeerTube [VideoTokensManager](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/video-tokens-manager.ts) używa Redis, lokalnego LRU, danych użytkownika i licznika unieważnień podczas równoległego ładowania. [Walidatory plików](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/middlewares/validators/shared/videos.ts#L250) łączą token z kontrolą widoczności/blacklist. To inny koszt dostępności, zapytań i synchronizacji niż stateless edge.

Tokeny plików PeerTube mają w badanym [constants](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/initializers/constants.ts#L1312) **8 godzin**. Sam dłuższy lub krótszy TTL nie rozstrzyga profesjonalizmu. Lokalny cache jest czyszczony przy unieważnieniu użytkownika, lecz nie wykazano, że każdy logout usuwa każdy wcześniej wydany token wideo z Redis. Ponowne ładowanie tokenu i pozostałe kontrole też mają znaczenie. Nie uruchomiono PeerTube ani awarii jego Redis i nie potwierdzono identycznego scenariusza R30. [Pięć źródeł i zakres](../evidence/batch07-review.json).

## Co pozostaje otwarte

Pełne HTTP i autoryzacja po zmianach stanu, rzeczywiste Cloudflare Cache API/Range/HEAD, globalny purge i usunięcie filmu/napisów, cache przeglądarek, Safari/iOS i utrata sieci, wygaśnięcie przepustki oraz finansowe cofnięcie grantu, mutacje między odczytami decyzji/planu, wydajność i metryki odtwarzania. Model odmowy i tokenu z tej partii nie zamyka tych zakresów. Szczególnie test cache Range w repo sam wytwarza 206; nie dowodzi zgodności nagłówków z wymaganiem Content-Length w oficjalnym Cache API.
