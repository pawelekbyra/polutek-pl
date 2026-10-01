# Serwerek — HLS „pro” z FFmpeg (research, skrót)

Stan: **2026-10-01, research przerwany decyzją właściciela** (HLS nie jest teraz priorytetem; filmy testowe zostają na Mux). Dokument zbiera to, co zdążyliśmy ustalić, żeby nie zaczynać od zera, gdy temat wróci. Kontekst: plan `docs/architecture/serwerek.md`, pomiary serwera `docs/operations/SERWEREK.md` §14 (Hetzner CPX22, 2 vCPU, 4 GB RAM, FFmpeg 8.0.1; 60 s 1080p → HLS 720+480 `veryfast` w 19 s).

> **Rekomendacja dla nas**
> - **Kodek i kontener:** H.264 High (≤ Level 4.1 dla 1080p30), segmenty **CMAF/fMP4** (`-hls_segment_type fmp4`), audio AAC-LC stereo 128 kb/s jako **osobna rendycja** (`EXT-X-MEDIA`). HEVC/AV1 teraz nie: wsparcie w przeglądarkach zależy od sprzętu (§3), a przy HEVC/AV1 i tak trzeba zostawić drabinkę H.264.
> - **Segmenty:** 6 s, IDR co 2 s, zamknięty GOP, bez keyframe'ów ze scenecut (`-force_key_frames "expr:gte(t,n_forced*2)" -sc_threshold 0`, x264 `open-gop=0`). Wszystkie rendycje cięte w tych samych punktach.
> - **Drabinka (punkt startowy, wg tabeli Apple):** 1080p 6000k, 720p 3000k, 540p 2000k, 360p 730k (+ opcjonalnie 1080p 7800k). Kodowanie **capped CRF** (CRF ok. 21-23, `maxrate` ≈ 1,5× celu, `bufsize` ≈ 2× maxrate) jednym przebiegiem; 2-pass daje zauważalny zysk dopiero przy materiale pełnometrażowym.
> - **Pakowanie:** muxer HLS w FFmpeg wystarcza do odtwarzania, ale jego master playlist **nie spełnia** w pełni specyfikacji Apple (brak `FRAME-RATE`, brak I-frame playlist, `BANDWIDTH` bez audio przy osobnej rendycji). Rekomendacja: FFmpeg koduje (jeden przebieg, `split`), **Shaka Packager** pakuje (I-frame playlist, pełny master, później DRM). Wariant minimalny: muxer FFmpeg + poprawka mastera skryptem.
> - **Dźwięk:** `loudnorm` dwuprzebiegowo do **-16…-18 LUFS, TP -1 dBTP** (AES TD1008 dla streamingu), nie -23/-24 (broadcast; -24 to domyślna wartość filtra).
> - **Serwer:** jedno zadanie naraz, `nice -n 19` + `MemoryMax=1500M`, bez `CPUQuota` (pomiar §14). Szacunek dla 3 min pełnej drabinki 1080/720/540/360 na CPX22: **ok. 10-30 min** przy `preset slow` (ekstrapolacja, **nie zmierzone**, §5).
> - **Publikacja:** wersjonowane ścieżki `videos/{id}/v/{version}/`, master wgrywany **na końcu**, segmenty `immutable`.

## 1. Specyfikacja Apple (HLS Authoring Specification, rewizja 2025-06-26)

Najważniejsze reguły (numeracja jak w dokumencie Apple):

- **Wideo:** H.264 w fMP4 albo TS (1.2); H.264 ≤ High@5.2, „część wariantów” ≤ High@4.1 (1.3a/b); preferuj High Profile (1.4); `avc1`/`hvc1` zamiast `avc3`/`hev1` (1.10); IDR co 2 s (1.13); przeplot zawsze usuwać, 30i → 60p (1.14-1.15); VOD w naturalnym fps źródła, max 60 fps (1.18-1.19); jedna przestrzeń barw, dla VOD oryginalna (1.21-1.22); SDR zawsze obowiązkowe (1.24).
- **Bitrate (VOD):** średni bitrate segmentów w ±10% `AVERAGE-BANDWIDTH`, szczyt w ±10% `BANDWIDTH` (1.26-1.27); szczyt ≤ 200% średniej (1.30); domyślny (pierwszy) wariant ok. 2000 kb/s (1.32), na komórce 730 kb/s (iOS 1.32b); identyczne proporcje obrazu (1.33).
- **Tabela H.264 16:9 (kb/s, średnio):** 416×234 145 · 640×360 365 · 768×432 730 / 1100 · 960×540 2000 · 1280×720 3000 / 4500 · 1920×1080 6000 / 7800. Apple nazywa to punktem startowym do dopasowania pod treść.
- **Audio:** stereo AAC (LC/HE) obowiązkowe (2.3); HE-AAC nie powyżej 64 kb/s (2.4); AAC stereo 32-160 kb/s (2.9); audio i wideo **osobno** zalecane (9.5).
- **Napisy:** WebVTT jako pliki tekstowe z `X-TIMESTAMP-MAP` (5.2-5.3); playlista napisów na całą długość (5.5); `LANGUAGE` obowiązkowe (4.7).
- **Trick play:** I-frame playlisty (`EXT-X-I-FRAME-STREAM-INF`) **MUST** (6.1), najlepiej gęste 1 kl./s (6.2).
- **Segmentacja:** segment zaczyna się od IDR (7.4); docelowo **6 s** (7.5-7.6); max +0,5 s ponad target (7.7).
- **Playlisty:** `EXT-X-PLAYLIST-TYPE:VOD` (8.6); te same granice segmentów we wszystkich rendycjach (8.22); bez przekierowań HTTP dla mediów (8.18); `EXT-X-MAP` przy fMP4 (8.20).
- **Master:** zawsze `CODECS` i `RESOLUTION` (9.1-9.2), `AVERAGE-BANDWIDTH` (9.14), `FRAME-RATE` (9.15); `BANDWIDTH` = największa suma szczytów dowolnej grywalnej kombinacji, czyli **wideo + audio** (9.13); `EXT-X-INDEPENDENT-SEGMENTS`, gdy segmenty zaczynają się od IDR (9.11); co najmniej 2 warianty w najwyższej rozdzielczości dla HD (9.10).
- **Dostarczanie:** playlisty z `gzip` (10.1); MIME: `application/vnd.apple.mpegurl` (m3u8), `video/mp4` (init), `video/iso.segment` (m4s), `text/vtt`; TLS ≥ 1.2 (12.1).

## 2. FFmpeg 8.0 — muxer HLS: co umie, czego nie

Z dokumentacji (`ffmpeg-formats`) i ze źródła `libavformat/hlsenc.c` / `hlsplaylist.c` (gałąź `release/8.0`):

- Umie: `-hls_segment_type fmp4`, `-hls_playlist_type vod`, `-hls_time`, `-var_stream_map` (warianty, grupy audio `agroup`, napisy `sgroup`), `-master_pl_name`, `-hls_flags independent_segments`, `-hls_fmp4_init_filename`. Dokumentacja sama każe wymusić zamknięty GOP i dopasować GOP do długości segmentu.
- Master na końcu kodowania dostaje **zmierzone** wartości: `BANDWIDTH` = najwyższy bitrate segmentu danego wariantu, `AVERAGE-BANDWIDTH` = średnia (hlsenc.c ok. l. 1151-1161 i 1564-1566). Gdy audio jest w osobnej grupie, wariant wideo **nie dolicza audio** do `BANDWIDTH` (niezgodne z Apple 9.13).
- **Nie pisze `FRAME-RATE`** (brak w `ff_hls_write_stream_info`) i **nie generuje I-frame playlist**; flaga `iframes_only` to coś innego (tag w trybie byterange).
- `CODECS` generuje sam (`avc1.PPCCLL`, `mp4a.40.2`).

Wniosek: dla hls.js i Safari wystarczy do odtwarzania; do pełnej zgodności ze specyfikacją potrzebny packager albo poprawka mastera.

## 3. Kompatybilność (caniuse, dane z 2026-09-30)

- **HLS natywnie:** Safari/iOS od zawsze; Chrome desktop od 142; Firefox nie. Reszta przez MSE (hls.js). iOS Safari ma MSE tylko częściowo; hls.js używa tam `ManagedMediaSource` (opcja `preferManagedMediaSource`).
- **hls.js 1.7.3** (2026-09-11): TS (transmux) i fMP4/CMAF, WebVTT i IMSC1, I-frame trick play, alternatywne audio; `EXT-X-INDEPENDENT-SEGMENTS` ignorowany (bez szkody).
- **HEVC:** pełne tylko Safari/iOS; Chrome/Edge/Firefox „częściowo” (zależnie od dekodera sprzętowego). **AV1:** Chrome/Firefox tak; Safari/iOS tylko z dekoderem sprzętowym (iPhone 15 Pro, M3+). ⇒ H.264 jako jedyny kodek; HEVC/AV1 dopiero jako dodatkowa drabinka, gdy transfer zacznie kosztować (R2 egress = 0, więc dziś nie).
- **fMP4 vs TS:** fMP4 działa w Safari (od iOS 10) i w hls.js; to też jedyna droga do HEVC/AV1 i DRM (CMAF). TS tylko dla bardzo starych TV/STB. Listy Smart TV nie weryfikowano.

## 4. Jakość kodowania

- **Capped CRF** (Streaming Learning Center, 2018): CRF 23 jako start, `maxrate`/`bufsize` ok. 1,5× docelowego bitrate; jeden przebieg; w teście pierwszy w „net impact on VMAF”; ostrożnie z materiałem syntetycznym (screencast).
- **2-pass vs 1-pass** (SLC, 2023-12): dla klipów do kilkunastu minut praktycznie bez różnicy; ok. 3 pkt „low-frame” VMAF zysku dopiero przy filmach 2 h, kosztem ok. 24% czasu.
- **Per-title:** Netflix (2015) liczy brute-force „convex hull” z setek kodowań (rozdzielczość × bitrate) z VMAF; Mux (2018) przewiduje drabinkę modelem ML bez kodowań testowych. **Wersja na naszą skalę:** dla filmu 3-4 próbne kodowania CRF na 2-3 rozdzielczościach z 30-60 s wycinków, VMAF (`libvmaf`) względem źródła, wybór punktów najbliżej obwiedni. Przy kilku filmach rocznie można to robić ręcznie.
- **HDR:** Apple wymaga SDR (1.24). Źródło HDR (np. iPhone HLG) → tone-map do SDR BT.709, np. `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p` (wymaga FFmpeg z `libzimg`; nie sprawdzone na serwerku).
- **Przeplot/fps:** `bwdif=mode=send_field` (30i → 60p, Apple 1.15); poza tym natywny fps (Apple 1.18).
- **Głośność:** `loudnorm` pass 1 z `print_format=json`, pass 2 z `measured_*` i `linear=true`; cel -16…-18 LUFS, TP -1 dBTP (AES TD1008).

## 5. Przepis (szkic, NIE uruchamiany)

Jeden przebieg kodowania, 4 rendycje + osobne audio, fMP4, VOD:

```bash
# 0) pomiar głośności (pass 1)
ffmpeg -hide_banner -i in.mov -map 0:a:0 \
  -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 2> loud.json

# 1) kodowanie + HLS (measured_* z loud.json)
nice -n 19 ffmpeg -hide_banner -y -i in.mov -filter_complex "
[0:v]format=yuv420p,split=4[v1][v2][v3][v4];
[v1]scale=-2:1080:flags=lanczos[o1];[v2]scale=-2:720:flags=lanczos[o2];
[v3]scale=-2:540:flags=lanczos[o3];[v4]scale=-2:360:flags=lanczos[o4];
[0:a:0]loudnorm=I=-16:TP=-1:LRA=11:measured_I=X:measured_TP=X:measured_LRA=X:measured_thresh=X:linear=true,aresample=48000[a]" \
  -map "[o1]" -map "[o2]" -map "[o3]" -map "[o4]" -map "[a]" \
  -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p \
  -x264-params "open-gop=0:scenecut=0" -sc_threshold 0 \
  -force_key_frames "expr:gte(t,n_forced*2)" \
  -crf:v:0 21 -maxrate:v:0 7800k -bufsize:v:0 15600k -level:v:0 4.1 \
  -crf:v:1 22 -maxrate:v:1 4500k -bufsize:v:1 9000k  -level:v:1 4.0 \
  -crf:v:2 23 -maxrate:v:2 3000k -bufsize:v:2 6000k  -level:v:2 3.1 \
  -crf:v:3 23 -maxrate:v:3 1100k -bufsize:v:3 2200k  -level:v:3 3.0 \
  -c:a aac -b:a 128k -ac 2 \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_type fmp4 \
  -hls_flags independent_segments -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "v%v/seg_%05d.m4s" \
  -var_stream_map "a:0,agroup:aud,default:yes,language:pl,name:audio v:0,agroup:aud,name:1080 v:1,agroup:aud,name:720 v:2,agroup:aud,name:540 v:3,agroup:aud,name:360" \
  -master_pl_name master.m3u8 "v%v/index.m3u8"
```

Po kodowaniu poprawić master (dopisać `FRAME-RATE`, doliczyć audio do `BANDWIDTH`) albo zamiast muxera HLS zapisać rendycje jako MP4 i przepakować Shaka Packagerem.

**Miniatury:** poster `ffmpeg -ss 5 -i in.mov -frames:v 1 -vf scale=1280:-2 poster.jpg`; sprite do podglądu na pasku `-vf fps=1/5,scale=160:-2,tile=10x10` + plik WebVTT z `sprite.jpg#xywh=x,y,w,h` generowany skryptem (format obsługiwany przez Vidstack). Nie testowano.

**Walidacja:** Apple `mediastreamvalidator`/`hlsreport` są w pakiecie HTTP Live Streaming Tools na macOS (wersji na Linuksa nie znaleziono, niezweryfikowane). Na serwerku: `ffprobe -show_frames` (IDR na początku każdego segmentu, rozstaw kluczy), suma `EXTINF` vs długość, odtworzenie w demo hls.js, VMAF próbki.

**Wydajność:** zmierzone tylko `veryfast` 720+480 (3,2× czasu rzeczywistego, §14 SERWEREK.md). Pełna drabinka z 1080p na `slow` jest wielokrotnie cięższa (rząd 5-10× wolniej od `veryfast`; ogólna wiedza o x264, **niezmierzone**), więc 3-minutowy film to prawdopodobnie 10-30 min na 2 vCPU. Przy rzadkich uploadach to akceptowalne; osobna maszyna (godzinowa/spot) dopiero gdy film ma być gotowy „od ręki” lub kodowania mają iść równolegle. **Do zmierzenia** przed decyzją.

## 6. Packagery

| | Muxer HLS w FFmpeg | Shaka Packager (v3.9.3, 2026-07-27) | GPAC (v26.07.0, 2026-07-24) / Bento4 |
|---|---|---|---|
| fMP4/CMAF, VOD | tak | tak | tak |
| I-frame playlist | nie | tak (`iframe_playlist_name`) | tak |
| Pełny master (FRAME-RATE, audio w BANDWIDTH) | nie | tak (nie sprawdzone w praktyce) | tak (nie sprawdzone) |
| DRM (Widevine/FairPlay/PlayReady) | tylko AES-128 | tak | tak |
| Dodatkowe narzędzie | nie | +1 binarka | +1 binarka |

Rekomendacja: FFmpeg koduje (rendycje z tymi samymi punktami IDR), Shaka Packager pakuje do HLS. Gdy kiedyś DRM: ten sam packager.

## 7. Pipeline (zarys)

- **Stany zadania:** `QUEUED → PROBING → ENCODING → PACKAGING → VALIDATING → UPLOADING → PUBLISHED`, plus `FAILED` (z powodem) i `CANCELLED`. Każdy krok idempotentny: wynik w `work/{jobId}/`, krok pomijany, jeśli artefakt jest kompletny.
- **Wejście:** `ffprobe` przed kodowaniem (czas, kodeki, rozdzielczość, HDR, przeplot); test dekodowania `ffmpeg -v error -i in -f null -` z limitem czasu; `MemoryMax`, timeout zależny od długości filmu, max 2 ponowienia z backoffem.
- **R2:** `videos/{videoId}/v/{version}/master.m3u8`, `.../{rendycja}/init.mp4`, `seg_*.m4s`, `thumbs/…`. Nowa wersja = nowy katalog; segmenty najpierw, **master na końcu**, potem zmiana wskaźnika w bazie (atomowa publikacja). Stare wersje kasowane po okresie karencji.
- **Nagłówki:** segmenty/init/sprite `Cache-Control: public, max-age=31536000, immutable`; playlisty w wersjonowanej ścieżce też mogą być długie (VOD się nie zmienia); ewentualny niewersjonowany wskaźnik krótko (`max-age=60`). MIME jak w §1, gzip dla `.m3u8`.
- **CORS dla hls.js:** reguła CORS bucketu R2: `AllowedOrigins: https://www.pawelperfect.com`, metody `GET, HEAD`, nagłówek `Range`. Token dostępu do segmentów (WAF HMAC vs Worker) opisuje `docs/architecture/serwerek.md`.

## Otwarte pytania

1. Rzeczywisty czas pełnej drabinki (1080p, `slow`/`medium`) na CPX22 na prawdziwym materiale z kamery.
2. Muxer FFmpeg + poprawka mastera czy od razu Shaka Packager (I-frame playlisty to w specyfikacji Apple MUST, ale Safari i hls.js grają bez nich).
3. Czy nasze źródła bywają HDR (iPhone HLG): wtedy FFmpeg z `libzimg` i test tone-mappingu.
4. Docelowa głośność (-16 czy -18 LUFS), do odsłuchu.
5. Token na segmentach (WAF HMAC vs Worker), nadal nierozstrzygnięty w dokumencie architektury.
6. Czy wspieramy stare Smart TV / AirPlay (TS jako zapas).
7. Gdzie walidować (`mediastreamvalidator` wymaga macOS).

## Źródła (pobrane 2026-10-01)

- Apple, HLS Authoring Specification for Apple Devices (rewizja 2025-06-26): https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices (tekst z `https://developer.apple.com/tutorials/data/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices.json`)
- FFmpeg Formats Documentation, muxer `hls`: https://ffmpeg.org/ffmpeg-formats.html
- FFmpeg 8.0 źródło: https://github.com/FFmpeg/FFmpeg/blob/release/8.0/libavformat/hlsenc.c , https://github.com/FFmpeg/FFmpeg/blob/release/8.0/libavformat/hlsplaylist.c
- FFmpeg Filters (`loudnorm`, `tonemap`, `zscale`, `libvmaf`, `bwdif`): https://ffmpeg.org/ffmpeg-filters.html
- hls.js README i API (v1.7.3, 2026-09-11): https://github.com/video-dev/hls.js , https://github.com/video-dev/hls.js/blob/master/docs/API.md
- Shaka Packager: https://shaka-project.github.io/shaka-packager/html/tutorials/hls.html , https://shaka-project.github.io/shaka-packager/html/options/hls_options.html , https://github.com/shaka-project/shaka-packager/releases
- GPAC: https://github.com/gpac/gpac/releases ; VMAF (v3.2.1): https://github.com/Netflix/vmaf
- caniuse (dane z 2026-09-30): https://caniuse.com/hevc , https://caniuse.com/av1 , https://caniuse.com/http-live-streaming , https://caniuse.com/mediasource
- Netflix, Per-Title Encode Optimization (2015-12): http://techblog.netflix.com/2015/12/per-title-encode-optimization.html (strona zwróciła 403; treść potwierdzona przez https://streaminglearningcenter.com/encoding/the-past-present-and-future-of-per-title-encoding.html, z wyników wyszukiwania)
- Mux, Instant Per-Title Encoding (2018-04-17): https://www.mux.com/blog/instant-per-title-encoding
- Streaming Learning Center, Capped CRF (2018-08-06): https://streaminglearningcenter.com/encoding/saving-encoding-streaming-deploy-capped-crf.html
- Streaming Learning Center, Single- vs Two-Pass VBR (2023-12-16): https://streaminglearningcenter.com/encoding/single-two-pass-vbr.html
- AES TD1008 (2021): https://aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf (cytowane za wynikami wyszukiwania; PDF nieczytany w całości)

Niezweryfikowane: przepis z §5 (nie uruchamiany), czasy kodowania 1080p/`slow`, filtr tone-mappingu na FFmpeg z serwerka, narzędzia Apple na Linuksie, zachowanie Shaka Packager (FRAME-RATE/BANDWIDTH) w praktyce.
