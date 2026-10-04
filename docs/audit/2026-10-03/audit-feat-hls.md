# Audyt podsystemu wideo / własny HLS (pawelperfect.com), 2026-10-03

Zakres: kod na `origin/main` (HEAD `88c787d0`) plus porównanie z gałęzią `origin/chore/remove-third-party-video` (PR #1614), tam gdzie ta gałąź zmienia ścieżkę SELF_HLS. Audyt tylko do odczytu. Na żywo sprawdziłem wyłącznie GET-y: `https://video.pawelperfect.com/...` (404/403/204, nagłówki cache) i jedno `GET /api/media-source/c52f0407-…` jako gość. To jedno żądanie utworzyło jeden wiersz `VideoPlaybackSession` w produkcji, tak samo jak każde wejście widza.

## 1. Podsumowanie i ocena ogólna

**Ocena: 7/10. Rdzeń jest dobry, ale wokół niego są luki operacyjne i kosztowe.**

Rdzeń jest zrobiony porządnie i zgodnie z dobrą praktyką self-hosted VOD:
- CMAF/fMP4, IDR co 2 s, zamknięty GOP, segmenty 6 s, granice segmentów sprawdzane między wariantami;
- własny master z `FRAME-RATE`, `CODECS` z prawdziwego SPS, `BANDWIDTH` liczony ze szczytu segmentów;
- token HMAC w ścieżce: względne URI działają w hls.js i w natywnym Safari, a klucz cache na brzegu nie zawiera tokenu;
- kolejka w Postgresie z `SKIP LOCKED`, heartbeat, backoff i anulowanie;
- `master.m3u8` wgrywany na końcu, asset tworzony dopiero po weryfikacji obiektów w R2;
- odmowa nigdy nie niesie URL-a.

Na produkcji działa: master `HIT`, segment `immutable`, `Range` daje 206, `meta.json` daje 404, cudza wersja daje 403.

Najpoważniejsze problemy nie siedzą w enkoderze. Są cztery:
1. **Twardy dzienny limit Workera Free (100 tys. żądań).** Po PR #1614 nie ma już fallbacku, a autoplay hero pobiera segmenty przy każdym wejściu na stronę. Przekroczenie limitu oznacza brak wideo do północy UTC.
2. **Każdy deploy restartuje kodowanie od zera.** Nowy obraz workera powstaje przy każdym commicie, a właściciel deployuje kilka razy dziennie.
3. **Materiał HDR jest odrzucany trwale.** Dotyczy to domyślnego nagrania z iPhone'a (HLG / Dolby Vision).
4. **hls.js jest ładowany w runtime z jsDelivr w wersji `^1.0.0`.** To domyślne zachowanie Vidstacka. Jest to zewnętrzny CDN z ruchomą wersją, a CSP dopuszcza cały `cdn.jsdelivr.net`.

Do tego jest kilka cichych błędów:
- napisy nigdy nie trafiają do odtwarzacza;
- `totalWatchMs` jest zawsze 0;
- odświeżenie tokenu przemontowuje odtwarzacz i gubi pozycję.

Brakuje retencji: stare wersje HLS i oryginały zostają na zawsze. Model danych po usunięciu dostawców jest w dużej części martwy.

**Liczba znalezisk:** P0: 0, P1: 4, P2: 10, P3: 22 (razem 36).

## 2. Faktyczny przepływ

```
[Admin UI VideoPipelinePanel / useOriginalUpload]
   | lib/video-upload/multipart-uploader.ts (4 równoległe PUT-y XHR, presign partiami po 50, resume z localStorage)
   v
POST /api/admin/videos/[id]/original-upload/multipart        -> startOriginalUpload (CreateMultipartUpload, VideoOriginal UPLOADING)
POST .../multipart/parts                                      -> presignOriginalParts (UploadPart, TTL 2 h)
PUT  https://<acct>.r2.cloudflarestorage.com/polutek/originals/<videoId>/<ts>.<ext>?partNumber=..  (przeglądarka -> R2)
POST .../multipart/complete                                   -> completeOriginalMultipart: Complete, HEAD (rozmiar), GET 1 KiB (magic bytes),
                                                                  VideoOriginal READY, poprzedni READY -> SUPERSEDED, Video.activeOriginalId,
                                                                  enqueueEncode -> VideoEncodeJob QUEUED (versionNumber = max+1)
   v
[kontener encoder: scripts/video-worker.ts -> runWorkerLoop]
   beat (AppSetting) -> requeueStale -> claimNext (UPDATE ... FOR UPDATE SKIP LOCKED + advisory lock + NOT EXISTS RUNNING)
   processEncodeJob: download do /work/<jobId> -> ffprobe (limity, HDR=FAIL) -> encodeHls():
        loudnorm pass (1 dekodowanie) + po 1 procesie ffmpeg na rendycję (N dekodowań) -> master -> poster (t=1 s) -> validateOutput
     -> deletePrefix -> PutObject x4 równolegle, master na końcu -> HEAD master + LIST count
     -> finalize: VideoAsset(SELF_HLS, READY) -> activateRoute (VideoPlaybackRoute ACTIVE, isPrimary) -> miniatura/czas -> auto-publish
     -> markSucceeded
   v
[Widz] PremiumWrapper -> GET /api/media-source/<id> -> PlaybackService: checkVideoAccess -> bramka premiery -> asset SELF_HLS
     -> buildSelfHlsPlan: SelfHlsTokenService.sign (HMAC, TTL 6 h) + VideoPlaybackSession.create
     -> URL https://video.pawelperfect.com/h/<exp>.<sig>/<videoId>/v<N>/master.m3u8
   VideoPlayer (Vidstack + hls.js z jsDelivr) -> Worker hls-edge: verifyToken -> caches.default (klucz /c/<id>/<ver>/<plik>) -> R2 binding polutek-hls
   telemetria: POST /api/videos/<id>/playback-event (HEARTBEAT co 60 s, WATCHED_10_SECONDS -> view)
   odświeżenie: PremiumWrapper 2 min przed exp -> nowy plan -> nowy URL -> remount playera
```

## 3. Znaleziska

Legenda: waga P0-P3, nakład S/M/L, pewność W(ysoka)/Ś(rednia)/N(iska).

### P1

**HLS-01 · P1 · koszt / dostępność · `workers/hls-edge/worker.mjs:102-156`, `app/components/VideoPlayer.tsx:141,252-253`, `lib/modules/playback/application/self-hls-plan.ts:158-160` (fallback usuwany w #1614)**

Problem:
- Każdy plik HLS to jedno wywołanie Workera, także trafienie w cache, bo cache siedzi wewnątrz Workera. Plan Free ma twardo 100 000 żądań na dobę, a po przekroczeniu zwraca błąd 1027. Domena Workera nie ma trybu „fail open”.
- Obejrzenie 3 minut to około 35 żądań, a 1 godziny około 600+. Oznacza to około 160 godzin oglądania na dobę dla całego serwisu.
- Hero ma `autoplay` i `preload="auto"`, a bramka odsłonięcia czeka na 3 s bufora. Każde wejście na stronę główną kosztuje więc około 6-10 żądań (master, wariant, init, segmenty do `maxBufferLength` 30 s), nawet gdy nikt nie ogląda.
- Około 10-15 tys. wejść dziennie wyczerpuje limit.
- Na `main` ratuje to `source.fallback` (Cloudflare Stream). PR #1614 go usuwa (`self-hls-plan.ts` na gałęzi), więc po scaleniu przekroczenie oznacza zero wideo do 00:00 UTC.
- Dokument kosztów (`docs/architecture/self-hosted-hls.md`, tabela) nie uwzględnia autoplay ani samego hero.

Naprawa:
- Przed scaleniem #1614 decyzja właściciela: Workers Paid za 5 USD/mies. (10 mln żądań w cenie). Wymaga zgody, bo to wydatek.
- Powiadomienie Cloudflare o zbliżaniu się do limitu.
- Syntetyczna sonda: GET mastera co 5 min z alertem.
- Opcjonalnie mniej żądań: hero bez `preload="auto"` przed kliknięciem bramki („Follow the white rabbit” i tak wymaga kliknięcia) albo `maxBufferLength` 10 s do pierwszej interakcji.

Nakład S. Pewność W.

**HLS-02 · P1 · błąd operacyjny · `deploy/serwerek/deploy.sh:28,79,105`, `deploy/serwerek/docker-compose.yml:42-51`, `lib/modules/video-pipeline/application/process-encode-job.ts:330-334`, `lib/modules/video-pipeline/infrastructure/encode-job.repository.ts:131-139`**

Problem:
- Obraz workera ma tag `polutek-worker:<sha>` i jest budowany przy każdym deployu.
- `start_encoder` robi `docker compose up -d --no-deps encoder`, co odtwarza kontener.
- SIGTERM powoduje `release()`, czyli powrót do QUEUED bez zużycia próby. Kodowanie startuje od zera, bo `/work/<jobId>` jest kasowany w `finally`.
- Godzinny film 1080p na 2 vCPU koduje się kilka godzin, a właściciel deployuje kilka razy dziennie (`mergedeploy`). Takie zadanie może nigdy się nie skończyć i nikt tego nie zauważy, bo próby nie są liczone.

Naprawa:
1. Tag workera jako hash treści (`lib/modules/video-pipeline/**`, `scripts/hls/**`, `scripts/video-worker.ts`, `prisma/schema.prisma`, lockfile). Ten sam hash oznacza brak przebudowy i brak restartu.
2. `deploy.sh` odkłada restart encodera, gdy w bazie jest zadanie `RUNNING` ze świeżym heartbeatem, i loguje, że restart odłożono. Worker sam przechodzi na nowy obraz w stanie bezczynności, na przykład przez timer systemd albo flagę.
3. Opcjonalnie checkpoint na poziomie rendycji: gotowe rendycje zostają w `/work` z markerem i są pomijane.

Nakład S/M. Pewność W.

**HLS-03 · P1 · UX · `scripts/hls/encode-hls.mjs:274,406`, `lib/modules/video-pipeline/application/process-encode-job.ts:236`, `lib/modules/video-pipeline/domain/encode-job.state.ts:68-75`**

Problem:
- Źródła z `color_transfer` `arib-std-b67` (HLG) albo `smpte2084` (PQ) kończą się trwałym `HDR_UNSUPPORTED`.
- iPhone nagrywa domyślnie HDR HLG (Dolby Vision 8.4) od modelu 12.
- Błąd wychodzi dopiero po pełnym uploadzie (do 10 GiB) i pobraniu pliku przez worker.

Naprawa:
- Tone-mapping do SDR BT.709 w filtrze, na przykład `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`. Trzeba sprawdzić, czy `mwader/static-ffmpeg:8.0.1` ma `libzimg`. Alternatywa to `libplacebo`, ale wymaga GPU/Vulkan, więc odpada.
- Test złoty z klipem HLG.
- Szybkie odrzucenie innych twardych błędów już przy `complete`, tak żeby admin dowiedział się po minucie, a nie po godzinie.

Nakład M. Pewność W.

**HLS-04 · P1 · bezpieczeństwo / niezawodność · `node_modules/@vidstack/react/prod/chunks/vidstack-DiaLSJYx.js:344` (domyślne `library`), `app/components/VideoPlayer.tsx:333-338`, `lib/utils/security.ts:87`**

Problem:
- Vidstack ładuje hls.js z `https://cdn.jsdelivr.net/npm/hls.js@^1.0.0/dist/hls.min.js`. W projekcie nie ma pakietu `hls.js` ani ustawionego `library`.
- Wersja jest ruchoma: dowolne 1.x w chwili wejścia widza, nietestowane.
- Zależność od zewnętrznego CDN stoi w sprzeczności z decyzją „zero zewnętrznych dostawców”.
- Dodatkowy DNS/TLS i pobranie około 400 KB przed pierwszą klatką.
- `script-src` dopuszcza cały `cdn.jsdelivr.net`, czyli każdy pakiet npm. To gotowy gadżet do obejścia CSP. Dziś i tak jest `'unsafe-inline'`, ale to osobny dług.

Naprawa:
- `npm i hls.js@<dokładna wersja>`.
- W `onProviderChange`: `provider.library = () => import('hls.js')`.
- Usunąć `cdn.jsdelivr.net` z CSP, jeśli nic innego go nie używa (do sprawdzenia).

Nakład S. Pewność W.

### P2

**HLS-05 · P2 · błąd (cichy) · `lib/modules/playback/application/playback.service.ts:62-73,272` (main), na #1614 `playback.service.ts:53-65,276`; `app/components/VideoPlayer.tsx:57`**

Problem:
- `playerFor()` buduje `textTracks` z `subtitleUrlPl/En`, ale ścieżka SELF_HLS (i wszystkie inne) woła `playerFor({ thumbnailUrl, title }, true)` bez tych pól.
- `PublicVideoDTO.textTracks` nigdzie nie jest wypełniane.
- Napisy ustawione w adminie nigdy nie trafiają do widza. CLAUDE.md §4.7 twierdzi coś przeciwnego.
- Test `playback-denied-subtitle-leak.test.ts` sprawdza tylko brak napisów w odmowie, nie ich obecność w zgodzie.
- Napisy z obcych hostów i tak zatrzymałby CSP `media-src`.

Naprawa:
- Przekazać `subtitleUrlPl/En` w `playerFor` i dodać test pozytywny.
- Docelowo napisy WebVTT w tym samym buckecie i Workerze (`EXT-X-MEDIA TYPE=SUBTITLES` w masterze albo `<track>` z URL-em podpisanym tym samym tokenem).

Nakład S. Pewność W.

**HLS-06 · P2 · UX / błąd · `app/components/PremiumWrapper.tsx:246-264`, `app/components/VideoPlayer.tsx:112-125,339-349`**

Problem:
- 2 minuty przed `exp` (TTL 6 h) plan jest pobierany ponownie i przychodzi z nowym URL-em i nowym `playbackSessionId`.
- Efekt w `VideoPlayer` ma te wartości w zależnościach, robi `setPlayerKey(+1)` i przemontowuje player. Pozycja i stan przepadają, powstaje nowa sesja, a progi 25/50/75% liczą się od nowa.
- Karta uśpiona dłużej niż TTL dostaje 403 na segmencie. Vidstack zgłasza błąd krytyczny i widz widzi nakładkę „Spróbuj ponownie” zamiast cichego odnowienia.

Naprawa:
- Odświeżenie tokenu bez remountu: zapamiętać `currentTime` i stan pauzy, podmienić `src` i przywrócić pozycję. Przy hls.js można zrobić `hls.loadSource(newUrl)` i `startPosition`.
- Nie tworzyć nowej sesji przy odświeżeniu: endpoint „refresh token” dla istniejącej sesji.
- Na błąd krytyczny HTTP 403 jedno automatyczne odświeżenie planu ze wznowieniem.

Nakład M. Pewność W.

**HLS-07 · P2 · błąd (telemetria) · `lib/modules/video/application/record-playback-event.use-case.ts:180`, `lib/modules/playback/application/self-hls-plan.ts:135` (main), `app/components/VideoPlayer.tsx:133-139`**

Problem: heartbeat co 60 s (`heartbeatIntervalSeconds: 60`), a przyrost liczony jest tylko wtedy, gdy `timeSinceLastHeartbeat < 30000`. Zdarzenia krytyczne mają przyrost 0. W efekcie `VideoPlaybackSession.totalWatchMs` jest zawsze 0.

Naprawa: limit = 2 × interwał (120 s) albo liczenie z różnicy `positionMs` ograniczonej czasem rzeczywistym. Do tego test.

Nakład S. Pewność W.

**HLS-08 · P2 · wydajność · `scripts/hls/encode-hls.mjs:289-294,435-477,197-224`**

Problem:
- Źródło jest dekodowane 1 + N razy: pomiar głośności plus osobny proces ffmpeg na każdą rendycję, więc przy 4 rendycjach 5 pełnych dekodowań.
- Przy źródłach 4K HEVC dekodowanie to istotna część CPU na 2 vCPU.
- Preset `slow` dla 1080p na 2 vCPU daje około 3-5× czasu rzeczywistego dla całej drabinki. Nikt tego nie zmierzył: dokument podaje tylko 10 s klipu 720p.

Naprawa:
- Jedno wywołanie ffmpeg: `-filter_complex "[0:v]bwdif?,fps,split=N[...]; [..]scale=…"` z N wyjściami HLS albo z `-var_stream_map`. Dekodowanie odbywa się raz, a audio z loudnorm jest kodowane raz i mapowane do wszystkich wyjść.
- Zmierzyć RAM przy `mem_limit 1500m`.
- Rozważyć `-preset medium` dla 1080p/720p. Strata jakości przy capped CRF jest mała, zysk to około 1,5-2×. Zysk szacunkowy całości: 20-40% czasu przy źródłach wysokiej rozdzielczości (do zmierzenia).

Nakład M. Pewność Ś.

**HLS-09 · P2 · jakość · `scripts/hls/encode-hls.mjs:83-96`**

Problem:
- Drabinka jest wybierana i skalowana po wysokości. Pionowe 1080×1920 daje górną rendycję 608×1080, czyli tracimy 44% szerokości.
- Kino 1920×804 dostaje szczyt 720p (1720×720), bo 1080 > 806.
- Brak `setsar=1`: anamorfik i źródła DV dostają złą deklarację `RESOLUTION`.

Naprawa: drabinka po krótszym boku (albo po liczbie pikseli 1080p ≈ 2,07 MP), wpisywanie w prostokąt, `setsar=1`. Do tego testy dla portretu i ultrawide.

Nakład S. Pewność W.

**HLS-10 · P2 · UX (słabe łącza) · `scripts/hls/encode-hls.mjs:34-39`, `app/components/VideoPlayer.tsx:336`**

Problem:
- Najniższa rendycja to 360p z maxrate 1,1 Mb/s (na produkcji `BANDWIDTH=756042` dla filmu 720p).
- Apple zaczyna drabinkę od około 145 kb/s (416×234).
- `abrEwmaDefaultEstimate: 4_000_000` zakłada łącze 4 Mb/s. Przy słabym LTE start stoi, a bramka odsłonięcia czeka do 6 s.

Naprawa:
- Dodać rendycję 234p/270p przy około 300-400 kb/s.
- Szacunek startowy 1-1,5 Mb/s albo `startLevel` = pierwszy wariant mastera (już ustawiony na najbliższy 2 Mb/s).
- `testBandwidth` w hls.js zostawić włączony.

Nakład S. Pewność Ś.

**HLS-11 · P2 · śmieć / koszt · `lib/modules/video-pipeline/application/original-upload.use-cases.ts:84-88,238`, `output-cleanup.use-cases.ts:136-164`, `app/api/cron/*` (brak)**

Problem:
- Retencji nie ma.
- Oryginały `SUPERSEDED` (do 10 GiB każdy) zostają w R2 na zawsze.
- Poprzednie wersje HLS zostają do ręcznego usunięcia w adminie.
- Wiersze `VideoOriginal` w stanie `UPLOADING` żyją wiecznie, chociaż R2 sam abortuje multipart po 7 dniach. Późniejsze wznowienie dostaje pustą listę części i... `complete` zwraca błąd. Panel pokazuje „UPLOADING” w nieskończoność, jeśli nie było nowego uploadu.
- `VideoPlaybackEvent` nie ma żadnego przycinania. Cron tnie tylko sesje, a zdarzenia dostają `SetNull`.

Naprawa: jeden cron `video-retention` (systemd timer):
- `UPLOADING` starsze niż 7 dni → `ABANDONED` plus abort;
- `SUPERSEDED`/`FAILED`/`ABANDONED` starsze niż 30 dni → skasuj obiekt;
- nieaktywne wersje HLS starsze niż 14 dni → `deleteSelfHlsAsset`;
- zdarzenia odtwarzania starsze niż 90 dni → usuń.

Każdy krok osobno, z `dryRun`.

Nakład M. Pewność W.

**HLS-12 · P2 · śmieć (model danych) · `prisma/schema.prisma:342-807`**

Problem:
- Przy jednym źródle `VideoAsset` ma około 12 martwych pól dostawców i mirrora: `providerAssetId`, `providerPlaybackId`, `externalVideoId`, `externalUrl`, `muxUploadId`, `distributionTargetId`, `mirror*`, `pendingPrimaryIntent`, `fallbackPriority`, `providerSyncedAt`.
- Martwe są też całe tabele `VideoDistributionPlan`, `VideoDistributionTarget`, `VideoProviderJob`, `VideoProviderWebhookEvent`, pole `Video.videoUrl`, `publishAfterAssetReadyProvider` i `VideoOriginal.checksumSha256`, którego nikt nie wypełnia.
- `isPrimary` dubluje `activePlaybackRoute`, a `VideoPlaybackRoute` dubluje to, co w praktyce jest wskaźnikiem „aktywna wersja” (zob. HLS-31).

Naprawa: model z sekcji 6, po scaleniu #1614, migracją addytywną, potem destrukcyjną.

Nakład L. Pewność W.

**HLS-13 · P2 · brak testu**

Problem: brakuje kilku testów.
- Surowy SQL `claimNext`/`requeueStale` (`encode-job.repository.ts:44-79,155-194`) nie ma testu na prawdziwym Postgresie. Testy używają atrap, a SQL zawiera arytmetykę czasu, rzutowanie enumów i blokadę doradczą.
- `encode-hls.mjs` ma tylko testy czystych funkcji. Nie ma testu złotego z prawdziwym ffmpeg na 2-sekundowym `lavfi testsrc` (portret, brak audio, VFR, przeplot, rotacja, HLG, cisza).
- Brak testu pozytywnego napisów (HLS-05), odświeżenia tokenu bez remountu (HLS-06), `totalWatchMs` (HLS-07) i zachowania deploy/encoder (HLS-02).

Naprawa: dodać do joba `integration-postgres` test repozytorium, a w CI job „encode smoke” z ffmpeg (obraz `mwader/static-ffmpeg`, około 30 s).

Nakład M. Pewność W.

**HLS-14 · P2 · dostępność / operacje · brak w kodzie i dokumentacji**

Problem:
- Nikt nie monitoruje dostarczania: zdrowia Workera, zużycia limitu, błędów 403/5xx, odsetka zdarzeń `PLAYER_ERROR`.
- Po #1614 Worker i R2 są pojedynczym punktem awarii bez zapasu. Jedyny sygnał to skarga widza.

Naprawa:
- Sonda syntetyczna z serwerka co 5 min: podpis tokenu, GET mastera i jednego segmentu, alert przez `ai-log` lub mail.
- Licznik `PLAYER_ERROR` na godzinę w adminie.
- Powiadomienia Cloudflare o wykorzystaniu Workers.

Nakład S. Pewność W.

### P3

**HLS-15 · P3 · błąd (ryzyko) · `scripts/hls/encode-hls.mjs:279,348`.** Porównanie sumy `EXTINF` z `format.duration` z tolerancją ±0,6 s. `format.duration` to maksimum strumieni, łącznie z dłuższym audio i offsetem startu, więc może dać fałszywy, trwały `VALIDATION_FAILED`. Naprawa: porównywać z czasem strumienia wideo. S, Ś.

**HLS-16 · P3 · wydajność · `scripts/hls/encode-hls.mjs:314-326`.** Sprawdzenie klatki kluczowej uruchamia `ffprobe` na każdy segment i za każdym razem zapisuje na dysk `init+segment`. Film 6 h ma około 14 tys. procesów i dodatkowy zapis całego wyniku. Naprawa: jedno `ffprobe -show_packets -show_entries packet=pts_time,flags` na `index.m3u8` albo odczyt flag pierwszej próbki z `trun`/`tfhd`. S, W.

**HLS-17 · P3 · UX · `scripts/hls/encode-hls.mjs:481-482`.** Plakat jest robiony z klatki w 1. sekundzie, często czarnej lub w trakcie przejścia, a trafia jako miniatura filmu (`finalize-self-hls.ts:96-106`). Naprawa: filtr `thumbnail` na około 10% filmu albo klatka w 10% czasu. S, W.

**HLS-18 · P3 · wydajność · `workers/hls-edge/worker.mjs:66,139-148`.** Trzy rzeczy:
- `importKey` przy każdym żądaniu;
- `HEAD` przy chybieniu cache czyta całe ciało z R2;
- `Range` przy chybieniu czeka na pełne `cache.put` przed odpowiedzią, co daje gorszy TTFB dla segmentu 1080p o wielkości około 5 MB.

Naprawa: klucz w zmiennej modułu (zależnej od sekretu); `env.HLS.head()` dla HEAD; przy `Range` odpowiedź z `env.HLS.get(key, {range})` i równoległe `ctx.waitUntil(cache.put(pełny))`. S, W.

**HLS-19 · P3 · koszt (skala) · `workers/hls-edge/worker.mjs:123`.** `caches.default` działa per centrum danych i nie korzysta z Tiered Cache. Każde PoP przy pierwszym chybieniu czyta z R2 (operacja klasy B). Przy obecnym ruchu to pomijalne, przy dużym warto to wiedzieć (sekcja 5). Pewność W.

**HLS-20 · P3 · bezpieczeństwo (operacje) · `workers/hls-edge/worker.mjs:57-68`, `lib/modules/playback/infrastructure/self-hls-token.service.ts:39-42`.** Jest jeden sekret i nie ma identyfikatora klucza. Rotacja unieważnia naraz wszystkie trwające odtworzenia. Naprawa: `HLS_TOKEN_SECRET_PREVIOUS` akceptowany przez Workera w oknie rotacji. S, W.

**HLS-21 · P3 · bezpieczeństwo (świadome) · `self-hls-token.service.ts:14,58`.** Token nie jest powiązany z widzem ani sesją. Link działa dla każdego przez 6 h. Przy darmowych treściach po zalogowaniu (§4.4) jest to akceptowalne, ale warto to zapisać jako decyzję. Opcja: TTL 30-60 min z odświeżaniem bez remountu (HLS-06). S, W.

**HLS-22 · P3 · śmieć / wydajność · `deploy/serwerek/Dockerfile:54-69`.** Obraz workera zawiera całe `node_modules` (z deps deweloperskimi i Next), `app/` i `components/`, a uruchamia `tsx` w runtime. Jest duży, wolno startuje i jest budowany przy każdym deployu. Naprawa: bundel esbuild `scripts/video-worker.ts`, potem `node dist/worker.mjs` plus Prisma client i ffmpeg. Obraz około 250 MB. M, W.

**HLS-23 · P3 · prywatność · `app/api/media-source/[videoId]/route.ts:52-55`, `app/api/videos/[id]/playback-event/route.ts:31-32`.** `ipHash` to SHA-256 IP bez soli, więc przestrzeń IPv4 (2^32) da się odwrócić w minuty. Naprawa: HMAC z sekretem, rotowanym okresowo. S, W.

**HLS-24 · P3 · wydajność / śmieć · `app/components/preload/AppPreloadProvider.tsx:146,269-277`, `self-hls-plan.ts:163-173`.** Każdy podgląd planu (hover albo 3 „nearby” na wejście) tworzy wiersz `VideoPlaybackSession`. Naprawa: plan bez sesji, sesja tworzona przy `PLAY_STARTED`. To też upraszcza HLS-06. M, W.

**HLS-25 · P3 · bezpieczeństwo (higiena) · `scripts/hls/originals-cors.json`.** CORS bucketa oryginałów dopuszcza `GET`/`HEAD` i `headers: *`, a przeglądarka potrzebuje tylko `PUT` i odczytu `ETag`. Naprawa: `PUT` + `Content-Type`. S, W.

**HLS-26 · P3 · dokumentacja / konfiguracja · `.env.example:103-122`.** Brakuje `CLOUDFLARE_R2_BUCKET_HLS`, `HLS_PRESET`, `HLS_NICE`, `VIDEO_WORKER_WORK_DIR` i `VIDEO_UPLOAD_MAX_BYTES`. S, W.

**HLS-27 · P3 · śmieć.** Elementy do usunięcia:
- ręczna ścieżka `scripts/hls/upload-hls.sh` (rclone), `activate-self-hls.sql`, `run-sql-on-server.sh` (gałąź #1614 usuwa tylko `rollback-self-hls.sql`);
- przepisywanie „surowych URL-i” na `/api/media/<id>` w `app/api/media-source/[videoId]/route.ts:65-74` (dla SELF_HLS martwe);
- `CUSTOM_PLAYER_KINDS` z `mux`/`vercel_blob`/`blob`/`dash` w `app/components/playback-source.ts:24`;
- wariant `thumbnail` z „Access Restricted” w `VideoPlayer.tsx:193-209` (sprawdzić, czy używany).

S, Ś.

**HLS-28 · P3 · UX / operacje · `lib/modules/video-pipeline/application/finalize-self-hls.ts:67-71`.** Ponowne kodowanie opublikowanego filmu przełącza trasę od razu, bez podglądu. Zła drabinka trafia do widzów natychmiast. Naprawa: opcja „aktywuj po akceptacji” (asset READY bez trasy i przycisk „przełącz”). S, W.

**HLS-29 · P3 · błąd (brzegowy) · `origin/chore/remove-third-party-video: lib/modules/playback/application/playback.service.ts:132-137,239`.** Po usunięciu aktywnej wersji szkicu pozostałe wersje READY mają `isPrimary=false`, więc `getPrimaryPlayableAsset` zwraca `NO_PRIMARY_ASSET`, mimo że jest gotowa wersja. Naprawa: wybierać najnowszą READY i zrezygnować z `isPrimary` (sekcja 6). S, W.

**HLS-30 · P3 · UX · `original-upload.use-cases.ts:238-246`.** Nowy oryginał od razu przestawia poprzedni READY na `SUPERSEDED` i ustawia `activeOriginalId`, zanim wiadomo, czy da się go zakodować. Przy trwałym błędzie (HDR) „Zakoduj ponownie” bierze zły plik i nie ma jak wrócić do poprzedniego. Naprawa: zmieniać `SUPERSEDED`/`activeOriginalId` dopiero przy sukcesie kodowania. S, W.

**HLS-31 · P3 · wyścig (tylko przy więcej niż 1 workerze) · `process-encode-job.ts:276,329`.** Przy ponownej próbie wersja jest ta sama, a więc prefiks też. Worker, który „stracił” zadanie, w `handleFailure` kasuje prefiks, do którego może już pisać nowy właściciel. Dziś jest jeden worker, więc ryzyko jest teoretyczne. Naprawa: prefiks z `attempt` albo kasowanie tylko przy posiadaniu zadania. S, Ś.

**HLS-32 · P3 · spójność czasu · `encode-job.repository.ts:89` vs `:54,69`.** Heartbeat pisany jest zegarem workera, a `claimNext` porównuje go z `now()` bazy. Teraz to jeden host, ale komentarz obiecuje odporność na rozjazd zegarów, której nie ma. Naprawa: `heartbeatAt` przez `now()` w SQL. S, W.

**HLS-33 · P3 · limity · `encode-job.state.ts:78-82` vs `docker-compose.yml:52`.** `ENCODE_LIMITS` dopuszcza 8K, a `mem_limit` wynosi 1500m. Dekodowanie 8K HEVC i x264 `slow` mogą wyjść z pamięci, co daje 3 × `WORKER_LOST` po kilka godzin. Naprawa: limit 4K (3840×2160) albo pomiar. S, Ś.

**HLS-34 · P3 · zgodność ze specyfikacją · `scripts/hls/encode-hls.mjs:151-164`.** Master nie ma `CLOSED-CAPTIONS=NONE` (Apple każe to zadeklarować, gdy brak CC) ani playlist I-frame (`EXT-X-I-FRAME-STREAM-INF`, wymagane przez Apple dla przewijania), a odtwarzacz nie ma storyboardu miniatur. Naprawa: `CLOSED-CAPTIONS=NONE` (S); storyboard: sprite JPEG plus WebVTT `thumbnails` (Vidstack obsługuje go natywnie) generowany w workerze (M). I-frame playlisty są potrzebne głównie natywnie na Apple TV/iOS. M, W.

**HLS-35 · P3 · UX · `app/admin/videos/components/pipeline/PipelineStatusCard.tsx:34`, `scripts/video-worker.ts:389-392`.** `AppSetting video_worker_heartbeat` jest odświeżany tylko między zadaniami, a nie co około 30 s, jak twierdzi komentarz w `encode-queue.use-cases.ts:13`. UI używa go tylko dla `QUEUED`, więc dziś nie szkodzi, ale wskaźnik „worker żyje” kłamie w trakcie długiego zadania. Naprawa: `beat()` także z interwału heartbeatu zadania. S, W.

**HLS-36 · P3 · integralność · `lib/video-upload/multipart-uploader.ts:179-189`, `VideoOriginal.checksumSha256`.** Części nie mają sumy kontrolnej (`x-amz-checksum-*`), a SHA-256 całości nie jest liczony, choć pole istnieje. Wznowienie ufa nazwie, rozmiarowi i mtime pliku. Naprawa: CRC32C na części (R2 obsługuje) i SHA-256 liczony przez workera przy pobieraniu, zapisany w wierszu. S/M, Ś.

## 4. Rozbieżności: dokumentacja a kod

| # | Dokument | Twierdzi | Kod / stan |
|---|---|---|---|
| D1 | CLAUDE.md §4.7 | „The playback service builds `textTracks` … automatically” | Nigdy: HLS-05 |
| D2 | CLAUDE.md §4.17, `HLS-SELF-HOSTED.md` (Aplikacja, Rollback, limit Free), `self-hosted-hls.md` (Decyzja, tabela, pyt. 6-7) | `source.fallback` na Stream/Mux; „po przekroczeniu limitu odtwarzacz przełącza się na fallback”; rollback per film na Stream | Na `main` prawda; #1614 usuwa fallback, `rollback-self-hls.sql`, `pickFallbackAsset`. Dokumenty trzeba przepisać w tym samym PR, a stwierdzenie o fallbacku przy limicie stanie się fałszywe (HLS-01) |
| D3 | `self-hosted-hls.md` (Koszt) | ~35 żądań na odtworzenie 3 min, około 2,8 tys. odtworzeń/dobę | Pomija autoplay hero i preload przy każdym wejściu (HLS-01); filmy dłuższe niż 3 min skalują się liniowo |
| D4 | `self-hosted-hls.md` pyt. 3 („Automatyzacja: dziś ręcznie… pg-boss?”), Status „kod w PR” | Ręczny proces | Pipeline z kolejką w Postgresie istnieje (VIDEO-PIPELINE.md) |
| D5 | `VIDEO-PIPELINE.md` §1 | Ponowienia 1 / 5 / 15 min | `DEFAULT_MAX_ATTEMPTS=3`: używane są tylko 1 i 5 min, trzecia nieudana próba kończy zadanie (`encode-job.state.ts:22,126-144`) |
| D6 | `encode-queue.use-cases.ts:13` (komentarz) | Worker odświeża heartbeat co około 30 s | Tylko między zadaniami (HLS-35) |
| D7 | `VIDEO-PIPELINE.md` §5 | „stare providery zostają w kodzie do osobnego sprzątania” | Sprzątanie to PR #1614 |
| D8 | `VIDEO-PIPELINE.md` §0 | „Niedokończone multiparty R2 sprząta sam po 7 dniach” | R2 tak (domyślna reguła), ale wiersz `UPLOADING` zostaje na zawsze (HLS-11) |
| D9 | `VIDEO-PIPELINE.md` §2 p.3 / `HLS-SELF-HOSTED.md` | „Drabinka do rozdzielczości źródła”, „obsługuje obrót” | Prawda, ale drabinka liczona jest po wysokości, więc pion i ultrawide tracą jakość (HLS-09) |
| D10 | `HLS-SELF-HOSTED.md` (Kodowanie) | „Dla 1080p i długich filmów: niezmierzone” | Nadal niezmierzone; a od tego zależy HLS-02 i HLS-08 |
| D11 | CLAUDE.md §2 (Stack) | „Cloudflare Stream primary; Mux/YouTube/Vimeo”, „Neon”, „Vercel Crons” | Własny HLS, lokalny Postgres, timery systemd |
| D12 | CLAUDE.md §5/§6/§7/§8 | `/admin/videos/new` „Cloudflare upload or existing UID”, cron `video-provider-jobs`, webhook Cloudflare jako kluczowy plik, zmienne `CLOUDFLARE_ACCOUNT_ID/API_TOKEN/WEBHOOK_SECRET` | Nieaktualne po #1614; brak `HLS_TOKEN_SECRET`, `HLS_DELIVERY_BASE_URL`, `CLOUDFLARE_R2_BUCKET_HLS`, `VIDEO_UPLOAD_MAX_BYTES` w tabeli zmiennych |
| D13 | CLAUDE.md §4.3 | „`/api/media/[...path]` is the only public playback path for blob/legacy videos” | Martwe przy jednym źródle |
| D14 | `HLS-SELF-HOSTED.md` / CSP | Wymienia tylko `video.pawelperfect.com` w CSP | Odtwarzanie zależy też od `cdn.jsdelivr.net` (hls.js, HLS-04); żaden dokument tego nie mówi |
| D15 | CLAUDE.md §4.17 | „do not create `SELF_HLS` rows before the app that knows the enum value is deployed” | Już nieistotne (enum wdrożony) |

## 5. Lepsze rozwiązania (z uzasadnieniem)

1. **Format i drabinka: utrzymać, z poprawkami.** CMAF/fMP4 H.264, IDR co 2 s i segmenty 6 s to dokładnie to, co zaleca Apple („key frames SHOULD be present every two seconds”, segmenty 6 s, każdy segment MUST zaczynać się od IDR). Do zmiany:
   - drabinka po krótszym boku (HLS-09);
   - rendycja około 300-400 kb/s na dole, bo Apple zaczyna od 145 kb/s 416×234 (HLS-10);
   - `CLOSED-CAPTIONS=NONE`;
   - jedno dekodowanie na wszystkie rendycje (HLS-08).

   Per-title encoding (pełne krzywe convex hull) jest na 2 vCPU nieopłacalne. Rozsądny zamiennik to obecny capped CRF, który już adaptuje bitrate do treści.
2. **Trick play.** Apple wymaga playlist I-frame do przewijania na swoich urządzeniach. W przeglądarce lepszy stosunek zysku do pracy daje storyboard (sprite JPEG plus WebVTT `thumbnails`, natywnie w Vidstacku), generowany jednym przebiegiem `fps=1/5,scale=160:-2,tile=10x10`.
3. **Dostarczanie:**
   - Token HMAC w ścieżce z względnymi URI to najlepszy wybór bez planu Pro. Signed cookies wymagałyby `withCredentials`, a Safari natywnie i tak by działał, bo to ta sama witryna. Atutem cookies byłby stały URL i lepszy cache przeglądarki po odświeżeniu tokenu, ale komplikacja nie jest tego warta.
   - Najtańsza i najpewniejsza poprawa to Workers Paid (koniec twardego limitu, CPU 30 s zamiast 10 ms).
   - Alternatywa bez Workera na segmentach: WAF `is_timed_hmac_valid_v0` (plan Pro) przed publiczną domeną R2. Daje Tiered Cache i brak opłat za żądania Workera, ale kosztuje 20-25 USD/mies.
   - Cache API jest per centrum danych, bez Tiered Cache. To nieistotne przy obecnym ruchu.
4. **Odtwarzacz:**
   - hls.js przypięty w bundlu, nie z jsDelivr (HLS-04).
   - Odnawianie tokenu bez remountu (HLS-06): `hls.loadSource()` z zachowaniem `currentTime`, a przy 403 jedna automatyczna próba.
   - Sesja telemetryczna tworzona przy pierwszym odtworzeniu, nie przy hoverze (HLS-24).
5. **Kolejka:**
   - Tabela z `SKIP LOCKED` to dobry wybór; pg-boss nic tu nie wnosi.
   - Brakuje odporności na deploy (HLS-02) i testu SQL na prawdziwej bazie (HLS-13).
   - Checkpoint per rendycja zamienia „restart = od zera” na „restart = dokończ bieżącą rendycję”.
6. **Przechowywanie:**
   - Oryginał w prywatnym R2 to słuszna praktyka: wymiana kodeka albo drabinki bez utraty jakości.
   - Brakuje retencji (HLS-11) i sumy SHA-256 (HLS-36).
   - Wersjonowanie `v<N>` (nigdy nie nadpisywać) jest dobre, bo pozwala trzymać segmenty z `immutable` na brzegu.
7. **HDR:** tone-mapping zscale/tonemap do BT.709 SDR to standard w pipeline’ach SDR-only. Pełne HDR (HEVC Main10 + HLG/PQ jako druga drabinka) dopiero przy dużej publiczności z iPhone'ów.

**Źródła:**
- [Validating HTTP Live Streams (Apple WWDC 2016, PDF), wymagania I-frame, IDR co 2 s, segment od IDR](https://devstreaming-cdn.apple.com/videos/wwdc/2016/510ndmh9wkcvzneegv2/510/510_validating_http_live_streams.pdf)
- [HLS authoring specification for Apple devices](https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices) (treść strony nie pobrała się automatycznie; wartości 145 kb/s 416×234 i CLOSED-CAPTIONS pochodzą z mojej wiedzy o tej specyfikacji i wymagają ręcznego sprawdzenia)
- [Streaming Learning Center: Apple Makes Sweeping Changes to HLS Encoding Recommendations](https://streaminglearningcenter.com/articles/apple-makes-sweeping-changes-to-hls-encoding-recommendations.html)
- [draft-pantos-hls-rfc8216bis](https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis)
- [Cloudflare Workers limits: Free 100 000 żądań/dobę, błąd 1027, CPU 10 ms](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers Cache: żądania liczone także przy trafieniu](https://developers.cloudflare.com/workers/cache/)
- [Cloudflare: Cache API per centrum danych, bez Tiered Cache](https://developers.cloudflare.com/workers/examples/cache-api/)
- [Cloudflare: Enable cache in an R2 bucket](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)
- [R2 object lifecycles: domyślne przerwanie multipartu po 7 dniach](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Wowza: I-frame only playlists for Apple HLS](https://www.wowza.com/docs/how-to-create-i-frame-only-playlists-for-apple-hls-streams)
- Domyślna biblioteka hls.js w Vidstacku: `node_modules/@vidstack/react/prod/chunks/vidstack-DiaLSJYx.js:344` (`https://cdn.jsdelivr.net/npm/hls.js@^1.0.0/dist/hls.min.js`).

## 6. Minimalny model docelowy (po #1614)

```prisma
model Video {
  // … pola treści, tier, status, premiere, fundraising bez zmian …
  activeOriginalId   String?  @unique   // oryginał, z którego powstała aktywna wersja (zmieniany przy SUKCESIE kodowania)
  activeRenditionId  String?  @unique   // jedyny wskaźnik "co gra"
  publishAfterEncode Boolean  @default(false)
  // usunąć: videoUrl, activePlaybackRouteId, publishAfterAssetReadyProvider, publishAfterAssetReady* (-> 1 flaga + audit)
}

model VideoOriginal {            // bez storageProvider (zawsze R2 "polutek")
  id, videoId, version, objectKey, sizeBytes BigInt, sha256 String?, container String?, probe Json?,
  status (UPLOADING | READY | FAILED | DELETED), failureReason,
  uploadId?, uploadPartSize?, uploadPartCount?, createdAt, uploadCompletedAt?, deletedAt?
  @@unique([videoId, version])
}

model VideoEncodeJob { /* bez zmian, + renditionId zamiast assetId */ }

model VideoRendition {           // zastępuje VideoAsset + VideoPlaybackRoute
  id, videoId, originalId, jobId?, version Int,          // klucz R2 = videos/<videoId>/v/v<version>
  ladder Json, durationMs Int, totalBytes BigInt, hasAudio Boolean, hasStoryboard Boolean,
  createdAt, activatedAt?, deletedAt?
  @@unique([videoId, version])
}

model VideoTextTrack { id, videoId, language, label, objectKey /* w polutek-hls, serwowane przez Worker */, isDefault }

model VideoPlaybackSession { /* tworzona przy PLAY_STARTED; ipHash = HMAC */ }
model VideoPlaybackEvent   { /* + retencja 90 dni */ }
```

Do usunięcia:
- tabele: `VideoAsset`, `VideoPlaybackRoute`, `VideoDistributionPlan`, `VideoDistributionTarget`, `VideoProviderJob`, `VideoProviderWebhookEvent`;
- enumy `StorageProvider` (wszystkie wartości), `VideoDistribution*`, `VideoProviderJob*`, `VideoPlaybackRoute*`, `VideoAssetProcessingState`.

Historia aktywacji, czyli to, co dawał `PREVIOUS` w trasach, idzie do `AuditLog` (`VIDEO_RENDITION_ACTIVATED`). Kolejność: addytywna migracja z backfillem `VideoRendition` z `VideoAsset(SELF_HLS)` i aktywnej trasy, przełączenie odczytów, potem w osobnym PR `DROP`.

## 7. Kolejność małych PR-ów

1. **hls.js lokalnie i przypięty**, `jsdelivr` poza CSP (HLS-04). S
2. **Napisy do playera** plus test pozytywny (HLS-05) oraz **`totalWatchMs`** (HLS-07). S
3. **deploy.sh:** tag workera z hasha treści i odkładanie restartu przy zadaniu `RUNNING` (HLS-02). S/M
4. **Decyzja właściciela: Workers Paid** oraz powiadomienia Cloudflare i sonda syntetyczna (HLS-01, HLS-14). Obowiązkowo przed scaleniem #1614. S
5. **Scalenie #1614** z przepisaniem dokumentów D2-D4, D7, D11-D15. S (dokumenty)
6. **Token bez remountu** i automatyczne wznowienie po 403; sesja przy `PLAY_STARTED` (HLS-06, HLS-24). M
7. **Drabinka:** krótszy bok, `setsar`, rendycja 270p około 350 kb/s, `CLOSED-CAPTIONS=NONE`, szacunek ABR (HLS-09, HLS-10, HLS-34 część). S/M
8. **Jedno dekodowanie,** szybsza walidacja keyframe'ów, lepszy plakat, walidacja czasu po strumieniu wideo (HLS-08, 15, 16, 17), z pomiarem 1080p/60 min na serwerku. M
9. **Tone-mapping HDR** plus testy złote ffmpeg w CI (HLS-03, HLS-13). M
10. **Test `claimNext`/`requeueStale` na Postgresie** (HLS-13), heartbeat przez `now()` w SQL (HLS-32), `beat()` w trakcie zadania (HLS-35). S
11. **Cron retencji** (HLS-11), supersede przy sukcesie (HLS-30), SHA-256 oryginału (HLS-36). M
12. **Worker:** klucz w module, HEAD/Range bez pełnego pobrania, drugi sekret do rotacji, CORS bucketa (HLS-18, 20, 25). S
13. **Obraz workera jako bundel** (HLS-22) i `.env.example` (HLS-26). S/M
14. **Model danych `VideoRendition`:** migracja addytywna, przełączenie odczytów, `DROP` (HLS-12, HLS-29, HLS-27). L
15. **Storyboard miniatur** i (opcjonalnie) playlisty I-frame (HLS-34). M
16. **Opcja „aktywuj po akceptacji”** dla ponownego kodowania (HLS-28) oraz HMAC dla `ipHash` (HLS-23). S
