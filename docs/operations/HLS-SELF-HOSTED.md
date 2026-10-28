# Własny HLS: kodowanie, dostarczanie, odtwarzacz (jedyne źródło wideo)

Decyzja i uzasadnienie: `docs/architecture/self-hosted-hls.md`. Upload, kolejka i worker kodowania: `docs/operations/VIDEO-PIPELINE.md`.

Własny HLS jest jedynym źródłem wideo (decyzja właściciela 2026-10-02: żadnych zewnętrznych dostawców). Nie ma zapasowego źródła: gdy własny HLS nie działa, film nie gra (plan `ERROR`/`NO_PRIMARY_ASSET`, w odtwarzaczu komunikat z ponowieniem).

## Elementy

| Element | Gdzie |
|---|---|
| Bucket R2 `polutek-hls` (prywatny, bez `r2.dev`) | `videos/<videoId>/v/v<N>/` (master, rendycje, plakat, `meta.json`); napisy: `videos/<videoId>/captions/<język>-<sha256>.vtt` (zapisuje panel, poza folderami wersji) |
| Worker `polutek-hls-edge` na `video.pawelperfect.com` (plan Free) | `workers/hls-edge/worker.mjs`, wdrożenie `node workers/hls-edge/deploy.mjs` |
| Sekret `HLS_TOKEN_SECRET` (>= 32 znaki) | Worker + `app.env` (ten sam); `HLS_DELIVERY_BASE_URL` (domyślnie `https://video.pawelperfect.com`) |
| Koder | kontener `encoder` (VIDEO-PIPELINE.md), biblioteka `scripts/hls/encode-hls.mjs` |
| Wiersze w bazie | `VideoAsset(provider=SELF_HLS, objectKey=videos/<id>/v/v<N>, bucket=polutek-hls)` + aktywna `VideoPlaybackRoute`; tworzy je worker |

Filmy na produkcji (3) kodowano ręcznie z `downloads/default.mp4` dawnego Cloudflare Stream (720p, skompresowane); oryginałów w R2 nie mają, więc do przekodowania trzeba wgrać plik źródłowy w panelu (VIDEO-PIPELINE.md §8).

## Kodowanie (`scripts/hls/encode-hls.mjs`)

Bez zależności npm: Node >= 18 + ffmpeg/ffprobe (obraz workera: statyczny ffmpeg 8.0.1 z `mwader/static-ffmpeg`, zawiera `libzimg`).

```bash
nice -n 10 node encode-hls.mjs --input src.mp4 --out out-v1   # --preset slow --segment 6 --keyframe 2 --lufs -16 --max-height 1080 (krótszy bok) --dry-run
```

- **Jeden proces ffmpeg**: źródło dekodowane raz (przeplot `bwdif`, HDR -> SDR, stała liczba klatek), `split` na wszystkie rendycje; audio: loudnorm 2-przebiegowy do -16 LUFS / -1 dBTP raz, `asplit`, AAC-LC 128k stereo 48 kHz w każdej rendycji.
- **Drabinka**: prostokąty 16:9 obrócone do orientacji źródła, źródło wpisane bez powiększania, `setsar=1`, wymiary parzyste. Capped CRF: 1080 (CRF 21, max 7,8 Mb/s), 720 (22 / 4,5), 540 (23 / 3), 360 (23 / 1,1, <= 30 kl./s), 234 (24 / 0,35, <= 30 kl./s; słabe łącza, Apple zaczyna drabinkę od 416×234). Pion 1080×1920 -> 1080×1920, 720×1280, …; kino 1920×804 -> 1920×804, 1280×536, …; rendycja z > 80% pikseli wyższej jest pomijana. Ustawienia z najmniejszego prostokąta, który mieści rendycję.
- **HDR** (HLG `arib-std-b67`, PQ `smpte2084`, np. iPhone HDR / Dolby Vision 8.4): `zscale` do liniowego światła w rozmiarze górnej rendycji, BT.2020 -> BT.709 w float, `tonemap=hable`, BT.709 limited 4:2:0; wynik oznaczony jako BT.709.
- H.264 High, poziom liczony z rozmiaru i kl./s (1080p60 = 4.2), IDR co 2 s w każdej rendycji (GOP w klatkach tej rendycji), GOP zamknięty, bez scenecut, segmenty 6 s fMP4/CMAF: **wszystkie rendycje cięte w tych samych punktach** (sprawdzane).
- Master piszemy sami z rozmiarów segmentów: `BANDWIDTH` = szczyt, `AVERAGE-BANDWIDTH`, `RESOLUTION`, `FRAME-RATE`, `CODECS` z prawdziwego SPS, `CLOSED-CAPTIONS=NONE`; pierwszy wariant = najbliższy 2 Mb/s (start według Apple).
- Plakat z górnej rendycji (już SDR, obrócony) w 10% filmu.
- Samokontrola: playlisty VOD zamknięte, init, suma EXTINF = długość strumienia wideo albo kontenera (±0,6 s), każdy segment od klatki kluczowej, te same granice segmentów. Wynik w `meta.json`.
- Testy: `tests/unit/hls/encode-hls.test.ts` (argumenty, drabinka), `tests/unit/hls/encode-hls.ffmpeg.test.ts` (prawdziwy ffmpeg: poziom z audio, pion 60 kl./s bez audio, HLG; job CI `encode-smoke`).
- Nie ma: playlist I-frame, storyboardu miniatur, napisów i wielu ścieżek audio wewnątrz HLS.
- Czas: pilot 720p 10 s = 13,5 s na CPX22 (1,3× czasu rzeczywistego, przed jednym dekodowaniem); 1080p i długie filmy niezmierzone.

## Dostarczanie (`workers/hls-edge`)

URL: `https://video.pawelperfect.com/h/<exp>.<sig>/<videoId>/<wersja>/<plik>`; `sig` = base64url(HMAC-SHA256(`HLS_TOKEN_SECRET`, `<videoId>/<wersja>/<exp>`)). Jeden token obejmuje wszystkie pliki jednej wersji (playlisty mają względne URI). Token wydaje tylko `PlaybackService` po `checkVideoAccess()` i bramce premiery. **TTL:** film chroniony (tier inny niż `PUBLIC`, strefa patrona, podgląd/wersja robocza, 18+) dostaje token 30 min (`HLS_TOKEN_TTL_PROTECTED_SECONDS`, 5 min..6 h), skrócony do końca przepustki, jeśli kończy się wcześniej (min. 30 s); film publiczny 6 h (`HLS_TOKEN_TTL_PUBLIC_SECONDS`). Odtwarzacz odnawia token 2 min przed końcem przez `/api/media-source` (pełne sprawdzenie dostępu przy każdym odnowieniu). **Rodzaj tokenu:** token filmu publicznego ma przyrostek `.pub` (`<exp>.<sig>.pub`, podpis z `/pub` na końcu wiadomości, więc nie da się go dopisać do tokenu chronionego); token bez `.pub` (chronione i wszystkie wydane wcześniej) dostaje od Workera `Cache-Control: private, max-age=<pozostały czas tokenu>` (playlisty max 60 s), a tylko `.pub` długie publiczne cache'owanie. Wewnętrzny cache brzegowy Workera (klucz bez tokenu, token sprawdzany przed nim) działa jak dotąd. `HLS_PUBLIC_TOKEN_MARKER=off` w `app.env` wraca do starego formatu dla filmów publicznych (cofnięcie Workera). Odpowiedź `/api/media-source` jest per widz: `private, no-store`.

**Napisy (WebVTT) idą tym samym torem i tym samym tokenem:** `.../<wersja>/captions/<język>-<sha256>.vtt` czyta prywatny obiekt `videos/<videoId>/captions/<plik>` (nazwa musi mieć dokładnie ten kształt, inne ścieżki pod `captions/` to 404; wersja w URL musi tylko pasować do tokenu, więc ponowne kodowanie nie gubi napisów). Nagłówki jak dla reszty: token chroniony `private, max-age=<pozostały czas>`, `.pub` długie publiczne cache; klucz cache brzegowego Workera bez tokenu i bez wersji.

- Token sprawdzany przy KAŻDYM żądaniu przed cache (klucz HMAC importowany raz na izolat); klucz cache bez tokenu (jedna kopia dla wszystkich). Segmenty i init: `public, max-age=31536000, immutable`; playlisty `public, max-age=300`; błędy `no-store`.
- Kody: 403 zły/wygasły token, 404 nieznana ścieżka lub obiekt (np. `meta.json`), 405 inna metoda, 416 zły `Range`.
- `Range` przy chybieniu: odpowiedź 206 prosto z R2 (`get` z zakresem), pełny obiekt trafia do cache w tle. `HEAD`: tylko metadane R2 (bez czytania i cache'owania treści).
- CORS tylko dla `ALLOWED_ORIGINS` (`https://www.pawelperfect.com`, `https://pawelperfect.com`); GET/HEAD/OPTIONS.
- To kontrola dostępu, nie DRM: zalogowany widz może skopiować URL na czas TTL.
- **Plan Free: twarde 100 000 żądań Workera na dobę** (każdy plik, także z cache). Odtworzenie 3 min ≈ 35 żądań, a każde wejście na stronę główną z autoodtwarzaniem hero ≈ 6-10. Po przekroczeniu wideo nie gra do 00:00 UTC (nie ma zapasu). Workers Paid (5 USD/mies.) to decyzja właściciela.

## Odtwarzacz (`app/components/VideoPlayer.tsx`, `app/components/player/self-hls.ts`)

- hls.js (wersja przypięta w `package-lock.json`, build `hls.js/light`) z własnego bundla jako osobny chunk, ładowany od razu przy starcie strony (`loadHlsLibrary`); Vidstack dostaje go przez `provider.library`. Żadnego CDN: `cdn.jsdelivr.net` nie ma w CSP.
- Szybki start: `testBandwidth: false` (bez pobierania pierwszego segmentu najniższej rendycji, a potem tego samego w wyższej), rendycja startowa z szacunku przepustowości przeglądarki (`navigator.connection`, Chromium; `saveData`/2G = najniższa), a bez niego pierwszy wariant mastera (~2 Mb/s); `startFragPrefetch`, `capLevelToPlayerSize`, bufor 30 s.
- Odnowienie tokenu bez przemontowania: `PremiumWrapper` 2 min przed wygaśnięciem (i od razu po powrocie do uśpionej karty) pobiera `/api/media-source/<id>?session=<id>` (pełna kontrola dostępu; serwer zostawia tę samą sesję odtwarzania, gdy należy do widza, filmu i ma < 24 h) i podmienia plan. Każde żądanie hls.js dostaje najnowszy token (`xhrSetup`), więc pozycja, bufor i jakość zostają. 401/403 z Workera: odnowienie i do 3 ponowień tego samego żądania. Gdy mimo to błąd jest krytyczny (albo natywny HLS Safari), odtwarzacz raz przeładowuje strumień ze świeżym tokenem i wraca do tej samej pozycji.
- Napisy: panel zapisuje WebVTT **prywatnie** w `polutek-hls` (`videos/<id>/captions/<język>-<sha256>.vtt`), a w `Video.subtitleUrlPl/En` (i `VideoTranslation.subtitleUrl`) trzyma **odnośnik** `hlscap:<język>-<sha256>.vtt`, nie adres. Plan odtwarzania zamienia go na `<baza>/h/<token>/<id>/<wersja>/captions/<plik>` z TYM SAMYM tokenem co film, tylko w grywalnym planie (plan odmowy i premiera przed czasem nie mają ani odnośnika, ani adresu); odnowienie tokenu (`/api/media-source`) wystawia świeże adresy napisów razem z nowym źródłem. Wartość, która nie jest odnośnikiem (`https://` starego publicznego bucketa, `/...`), działa po staremu do czasu migracji. Odtwarzacz montuje jako `<Track>` Vidstacka tylko ścieżkę w języku strony, a przycisk CC ją włącza i wyłącza (preferencja widza w localStorage); po odnowieniu planu ścieżka dostaje nowy adres (nowy `TextTrack`, `CaptionsSync` przywraca włączenie). Host Workera jest już w CSP `connect-src`, odpowiedź ma CORS dla `ALLOWED_ORIGINS`. Film publiczny też czyta napisy przez Worker (token `.pub`, +1 żądanie Workera na odtworzenie): miejsce zapisu nie zależy od poziomu, publikacji, moderacji ani premiery, więc zmiana któregokolwiek nie wymaga przenoszenia plików.
- Telemetria: `PLAY_STARTED`, `PLAY_RESUMED`, `PLAY_PAUSED`, `HEARTBEAT` co 60 s, `ENDED`; `totalWatchMs` = czas między startem/wznowieniem a kolejnym zdarzeniem, najwyżej 90 s na odcinek (pauza i uśpiona karta się nie liczą).

## Aplikacja

- `PlaybackService`: po decyzji dostępu i bramce premiery asset `SELF_HLS` daje podpisany `master.m3u8` (`source.kind=self_hls`); odmowa nie ma żadnego URL (test). Brak `HLS_TOKEN_SECRET` albo zły klucz obiektu = plan `ERROR` bez URL, tokenu i sesji (fail closed). Wiersze innych dostawców są ignorowane.
- CSP: host z `HLS_DELIVERY_BASE_URL` / `video.pawelperfect.com` w `connect-src` i `media-src`; `worker-src blob:` dla wątku hls.js.

## Napisy prywatne: wdrożenie, migracja, cofanie

**Kolejność (ważna):**

1. **Worker** (`node workers/hls-edge/deploy.mjs`): zna ścieżkę `captions/`; stare tokeny i adresy HLS działają bez zmian. Wdrożony sam nic nie zmienia dla widzów.
2. **Migracja w trybie próbnym** (na serwerku, `npx tsx scripts/migrate-captions-to-private.ts`; domyślnie nic nie zmienia, raport do pliku). Sprawdzić: token R2 ma Object Read & Write na `polutek-hls` i publicznym buckecie miniatur; liczby `would-copy` / `invalid` / `public-missing` / `foreign` zgadzają się z oczekiwaniem.
3. **Aplikacja** (`./deploy.sh <tag>`): nowe wgrania napisów idą od razu do prywatnego miejsca; plan rozumie odnośniki i stare adresy.
4. **Migracja `--apply`**: kopiuje pliki do `videos/<id>/captions/`, sprawdza rozmiar kopii i dopiero wtedy przepisuje kolumny (`hlscap:...`); niczego nie usuwa, zapisuje dziennik do cofnięcia (`--journal`). Idempotentna (drugi bieg nic nie robi), kolumna zmieniona w międzyczasie jest pomijana. **Nie uruchamiać `--apply` przed krokiem 3:** stara aplikacja nie zna odnośnika i pokazałaby film bez napisów.
5. **Sprawdzić odtwarzanie** napisów (film chroniony: w Network `captions/...vtt` z `Cache-Control: private`, 200; ten sam adres bez tokenu: 403; film publiczny: napisy są).
6. **Usunięcie starych publicznych plików**, dopiero po kroku 5: `--apply --delete-legacy` (najpierw samo `--delete-legacy` = lista bez usuwania). Usuwa tylko plik, dla którego istnieje prywatna kopia o identycznej treści i rozmiarze; odmawia, gdy jakakolwiek kolumna nadal wskazuje publiczny host; pliki bez odnośnika (sieroty) zostają, chyba że `--include-orphans`. **R2 nie czyści cache CDN domeny publicznej:** adresy z raportu trzeba usunąć z cache Cloudflare (Purge by URL), inaczej stary plik może być jeszcze serwowany do wygaśnięcia cache (do roku, `immutable`).

**Cofanie:** przed krokiem 6 wszystko jest odwracalne: `--rollback=<dziennik.json> --apply` przywraca poprzednie adresy w bazie (publiczne pliki nadal istnieją), albo cofnięcie aplikacji (`--rollback` deploy.sh) i migracji; Worker można zostawić (nowa ścieżka jest dodatkowa). Po kroku 6 powrót do publicznych napisów wymaga ponownego wgrania plików; prywatne kopie zostają w `polutek-hls`.

**Trwające seanse:** tokeny HLS wydane przed wdrożeniem działają bez zmian (format tokenu się nie zmienia). Otwarty odtwarzacz trzyma plan sprzed wdrożenia: jego napisy mają stary publiczny adres, który działa do kroku 6; plik już pobrany (CC włączone) gra dalej do końca seansu. Po kroku 6 napisy, których ten odtwarzacz jeszcze nie pobrał (CC włączone dopiero później), nie wczytają się do najbliższego odnowienia planu (co ~28 min dla filmów chronionych, 6 h dla publicznych); obraz i dźwięk nie są dotknięte. Dlatego krok 6 najlepiej poza godzinami szczytu i najwcześniej po jednym pełnym oknie TTL od kroku 4.

## Rollback

- **Jednego filmu:** wcześniejsza wersja HLS (stare wersje zostają w R2) przez `scripts/hls/activate-self-hls.sql -v version=v<N>` (`-v finish=ROLLBACK` = próba na sucho) albo nowa wersja przez „Zakoduj ponownie”.
- **Awaria Workera / limit:** wideo nie gra do naprawy. Brak `HLS_TOKEN_SECRET` w `app.env` = `ERROR` dla wszystkich filmów.
- **Aplikacja:** `./deploy.sh <tag> --rollback` (aktywne trasy wskazują własny HLS, poprzedni obraz też go gra). Napisy: patrz „Napisy prywatne” powyżej (po migracji poprzedni obraz nie zna odnośnika `hlscap:` i gra film bez napisów, bez błędu).

## Utrzymanie

- Nowy film / przekodowanie: panel admina (VIDEO-PIPELINE.md). Ręczna ścieżka awaryjna: `encode-hls.mjs` + `scripts/hls/upload-hls.sh` (rclone; master na końcu) + `activate-self-hls.sql`.
- Stare wersje HLS: usuwanie w panelu po okresie karencji.
- Logi Workera: Cloudflare Dashboard (observability włączone). Monitoringu dostępności i zużycia limitu na razie nie ma (decyzja właściciela).
