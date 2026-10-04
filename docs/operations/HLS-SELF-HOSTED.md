# Własny HLS: kodowanie, dostarczanie, odtwarzacz (jedyne źródło wideo)

Decyzja i uzasadnienie: `docs/architecture/self-hosted-hls.md`. Upload, kolejka i worker kodowania: `docs/operations/VIDEO-PIPELINE.md`.

Własny HLS jest jedynym źródłem wideo (decyzja właściciela 2026-10-02: żadnych zewnętrznych dostawców). Nie ma zapasowego źródła: gdy własny HLS nie działa, film nie gra (plan `ERROR`/`NO_PRIMARY_ASSET`, w odtwarzaczu komunikat z ponowieniem).

## Elementy

| Element | Gdzie |
|---|---|
| Bucket R2 `polutek-hls` (prywatny, bez `r2.dev`) | `videos/<videoId>/v/v<N>/` (master, rendycje, plakat, `meta.json`) |
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

URL: `https://video.pawelperfect.com/h/<exp>.<sig>/<videoId>/<wersja>/<plik>`; `sig` = base64url(HMAC-SHA256(`HLS_TOKEN_SECRET`, `<videoId>/<wersja>/<exp>`)). Jeden token obejmuje wszystkie pliki jednej wersji (playlisty mają względne URI). Token wydaje tylko `PlaybackService` po `checkVideoAccess()` i bramce premiery; TTL 6 h. Odpowiedź `/api/media-source` jest per widz: `private, no-store`.

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
- Napisy: `subtitleUrlPl/En` (WebVTT, `https://` albo `/...`) tylko w grywalnym planie; odtwarzacz montuje jako `<Track>` Vidstacka tylko ścieżkę w języku strony, a przycisk CC ją włącza i wyłącza (preferencja widza w localStorage). Host pliku musi być w CSP `connect-src`; pliki tej samej domeny leżą w `public/subtitles/<slug>/<język>.vtt`.
- Telemetria: `PLAY_STARTED`, `PLAY_RESUMED`, `PLAY_PAUSED`, `HEARTBEAT` co 60 s, `ENDED`; `totalWatchMs` = czas między startem/wznowieniem a kolejnym zdarzeniem, najwyżej 90 s na odcinek (pauza i uśpiona karta się nie liczą).

## Aplikacja

- `PlaybackService`: po decyzji dostępu i bramce premiery asset `SELF_HLS` daje podpisany `master.m3u8` (`source.kind=self_hls`); odmowa nie ma żadnego URL (test). Brak `HLS_TOKEN_SECRET` albo zły klucz obiektu = plan `ERROR` bez URL, tokenu i sesji (fail closed). Wiersze innych dostawców są ignorowane.
- CSP: host z `HLS_DELIVERY_BASE_URL` / `video.pawelperfect.com` w `connect-src` i `media-src`; `worker-src blob:` dla wątku hls.js.

## Rollback

- **Jednego filmu:** wcześniejsza wersja HLS (stare wersje zostają w R2) przez `scripts/hls/activate-self-hls.sql -v version=v<N>` (`-v finish=ROLLBACK` = próba na sucho) albo nowa wersja przez „Zakoduj ponownie”.
- **Awaria Workera / limit:** wideo nie gra do naprawy. Brak `HLS_TOKEN_SECRET` w `app.env` = `ERROR` dla wszystkich filmów.
- **Aplikacja:** `./deploy.sh <tag> --rollback` (aktywne trasy wskazują własny HLS, poprzedni obraz też go gra).

## Utrzymanie

- Nowy film / przekodowanie: panel admina (VIDEO-PIPELINE.md). Ręczna ścieżka awaryjna: `encode-hls.mjs` + `scripts/hls/upload-hls.sh` (rclone; master na końcu) + `activate-self-hls.sql`.
- Stare wersje HLS: usuwanie w panelu po okresie karencji.
- Logi Workera: Cloudflare Dashboard (observability włączone). Monitoringu dostępności i zużycia limitu na razie nie ma (decyzja właściciela).
