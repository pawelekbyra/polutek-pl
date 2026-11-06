# Decyzja: własny HLS, bez zewnętrznych dostawców wideo

Status: **własny HLS jest jedynym źródłem wideo** (decyzja właściciela 2026-10-02). Mux, Cloudflare Stream, YouTube, Vimeo i zewnętrzne URL-e zostały usunięte z kodu; zapasowego źródła nie ma. Procedury: `docs/operations/HLS-SELF-HOSTED.md` (kodowanie, dostarczanie, odtwarzacz) i `docs/operations/VIDEO-PIPELINE.md` (upload, kolejka, worker).

## Decyzja

Oryginał trafia z przeglądarki admina do prywatnego R2 `polutek`, kolejka w Postgresie (`VideoEncodeJob`) zleca kodowanie FFmpeg-iem w kontenerze `encoder` na serwerku, wynik ląduje w prywatnym R2 `polutek-hls` i jest dostarczany przez Worker na `video.pawelperfect.com` (Cloudflare Free) z tokenem HMAC wydawanym tylko po kontroli dostępu.

## Dlaczego tak, a nie inaczej

| Wybór | Uzasadnienie | Odrzucone |
|---|---|---|
| fMP4/CMAF, H.264 High, IDR co 2 s, segmenty 6 s | działa w hls.js i natywnym Safari; zgodne ze specyfikacją Apple (IDR co 2 s, segmenty 6 s, start od ~2 Mb/s) | HEVC/AV1 (zależne od sprzętu), TS |
| Drabinka 1080/720/540/360/234 w prostokątach 16:9 obróconych do źródła | pion i ultrawide nie tracą rozdzielczości; 234p dla słabych łączy | drabinka po wysokości (pion 1080×1920 dostawał 608×1080) |
| Jedno dekodowanie (`split`) na wszystkie rendycje | CPU serwerka (2 vCPU) idzie na kodowanie, nie na wielokrotne dekodowanie | proces ffmpeg na rendycję |
| HDR -> SDR (`zscale` + `tonemap=hable`) | domyślne nagrania iPhone'a (HLG/Dolby Vision 8.4) działają; jedna drabinka SDR | odrzucanie HDR; druga drabinka HEVC HDR (dopiero przy dużej publiczności z iPhone'ów) |
| Audio w każdej rendycji | jedna ścieżka: o połowę mniej żądań niż osobne `EXT-X-MEDIA` | osobne audio (sens dopiero przy wielu językach) |
| Własny master | ffmpeg nie pisze `FRAME-RATE` i nie dolicza audio do `BANDWIDTH` | muxer ffmpeg bez poprawek |
| Kolejka w Postgresie (`FOR UPDATE SKIP LOCKED`) | jeden typ zadania, jeden worker, ta sama baza i kopie | pg-boss, Redis |
| Worker + token HMAC w ścieżce | działa na planie Free; dla hls.js i Safari identycznie (względne URI); cache bez tokenu | WAF `is_timed_hmac_valid_v0` (plan Pro, 20-25 USD/mies.), signed cookies |
| R2 przez binding Workera | bucket nieosiągalny z zewnątrz | publiczny bucket |
| hls.js z własnego bundla, przypięty | zero zewnętrznych CDN, deterministyczna wersja, bez wyjątku w CSP | domyślny Vidstack: jsDelivr `hls.js@^1.x` |

## Ochrona: uczciwie

- Token (HMAC-SHA256, TTL: 30 min dla filmów chronionych, 6 h dla publicznych; szczegóły i nagłówki cache: docs/operations/HLS-SELF-HOSTED.md) wydawany wyłącznie po `checkVideoAccess()` i bramce premiery (CLAUDE.md §4.3/§4.15); odmowa nie niesie żadnego URL. Odnowienie tokenu przechodzi tę samą pełną kontrolę. Worker odrzuca brak/zły/wygasły token (403) przed cache i R2; ścieżki i rozszerzenia to biała lista.
- Napisy (WebVTT) są w tym samym prywatnym buckecie (`videos/<id>/captions/`) i idą przez Workera pod tym samym tokenem co film; nie ma publicznej kopii (transkrypt płatnego filmu nie może być czytelny bez dostępu). Jedno miejsce zapisu dla wszystkich poziomów, bo poziom, publikacja i moderacja mogą się zmienić po wgraniu, a plik publiczny nie da się wtedy „cofnąć”.
- Token nie jest związany z widzem: zalogowany widz może skopiować URL i pobrać pliki na czas TTL. To kontrola dostępu, nie DRM. Przy treściach darmowych po zalogowaniu (§4.4) akceptowalne.
- Jeden sekret `HLS_TOKEN_SECRET` (Worker, `app.env`, `.ai-secrets`); rotacja unieważnia naraz wszystkie trwające odtworzenia (odtwarzacz odnowi token sam przy 403).

## Monotoniczna aktywacja oryginału

`completeOriginalMultipart()` oraz retry dla wiersza `READY` używają tej samej blokady transakcyjnej per video. W transakcji ponownie odczytywany jest status i wersja; starszy `READY` nie może zastąpić nowszego aktywnego oryginału. Ukończenie zapisuje `READY`, `SUPERSEDED`, `Video.activeOriginalId` i `VideoEncodeJob` atomowo. Retry `READY` naprawia historyczny brak zadania, ale najpierw sprawdza, czy ta wersja nadal wygrywa. Testy HTTP z dwiema równoległymi ścieżkami na PostgreSQL są udokumentowane w K15 w roadmapie audytu.

## Prefiksy prób kodowania

Każdy nowy claim dostaje UUID zapisany w `VideoEncodeJob.attemptId`. Pliki, wpis `VideoAsset`, finalizer, logi i cleanup używają tego samego prefiksu `videos/<videoId>/v/v<version>/attempts/<attemptId>/`; katalog roboczy także zawiera ID próby. Proces usuwa wyłącznie swój prefiks. Starsze aktywne rekordy z `attemptId = NULL` pozostają mapowane na historyczny `videos/<videoId>/v/v<version>` aż do ich wygaszenia.

Migracja blokuje przejście zadania do `RUNNING`, jeśli claim nie wpisał `attemptId`, więc binarny stary worker nie może pobrać nowego zadania. Heartbeat już działającego legacy zadania jest dozwolony. Przed migracją i startem nowych workerów wdrożenie musi kontrolowanie wygasić stare workery; lokalny test nie zastępuje tej procedury ani fencing skutków starego workera, które jest osobnym K17.

Przed aktywacją finalizer blokuje w transakcji wiersz joba i potwierdza `RUNNING`, `workerId` oraz `attemptId`; równocześnie odświeża heartbeat. Wszystkie zapisy postępu/końcowego statusu/retry/anulowania/zwolnienia claimu używają tego samego tokenu. Aktywacja trasy, wybór primary assetu i obowiązkowy wpis audytu są jedną transakcją. Po utracie potwierdzenia COMMIT finalizer uzgadnia aktywną trasę; gdy baza nie pozwala rozstrzygnąć wyniku, worker zachowuje prefiks HLS do retry. Retry potwierdza cały graf playlist i segmentów przed uznaniem aktywnego wyniku; niekompletny graf nie jest sukcesem. Lokalna weryfikacja K17/K18 nie dowodzi zachowania dwóch realnych workerów ani fizycznego R2; odbiór pozostaje otwarty.

## Sprzątanie obiektów

`HlsWriter.deletePrefix()` odczytuje odpowiedź `DeleteObjects` per obiekt (`Quiet: false`), liczy tylko potwierdzone `Deleted` i ponawia wyłącznie przejściowe błędy do trzech prób. `NoSuchKey`/`NotFound` jest idempotentne i nie zwiększa licznika. Trwałe błędy lub wyczerpane próby rzucają `R2DeleteObjectsError`, więc strict purge/durable job nie może oznaczyć częściowego usunięcia jako sukcesu. Testy komponentów są zielone, ale brak jeszcze odbioru na sandboxie Cloudflare R2/S3; zachowanie dostawcy i cały przebieg purge pozostają niepotwierdzone.

## Koszt i limity

Każdy plik HLS to jedno wywołanie Workera, także trafienie w cache. Plan Free: **twarde 100 000 żądań na dobę**, potem do 00:00 UTC wideo nie gra. Odtworzenie 3 min ≈ 35 żądań, godzina ≈ 600; każde wejście na stronę główną z autoodtwarzaniem hero ≈ 6-10 żądań, więc limit wyczerpuje już ok. 10-15 tys. wejść dziennie. Workers Paid: 5 USD/mies. z 10 mln żądań w cenie. R2: kilkadziesiąt filmów to 1-3 GB (w darmowych 10 GB), transfer 0 USD. `caches.default` działa per centrum danych (bez Tiered Cache): każde PoP przy pierwszym chybieniu czyta R2 (klasa B, pomijalne przy obecnym ruchu).

## Otwarte decyzje właściciela

1. **Workers Paid (5 USD/mies.)** przed większym ruchem (premiera); alternatywa bez wydatku: hero bez wstępnego buforowania przed kliknięciem bramki.
2. **Monitoring:** powiadomienie Cloudflare o zużyciu Workers, sonda syntetyczna (master + segment co 5 min z serwerka) z alertem.
3. **Retencja:** stare oryginały (SUPERSEDED) i nieaktywne wersje HLS zostają w R2 do ręcznego usunięcia.
4. **DRM** tylko przy treściach płatnych/ekskluzywnych (packager + licencje).
5. **Napisy w HLS** (`EXT-X-MEDIA TYPE=SUBTITLES`, pliki w `polutek-hls` za tym samym tokenem) zamiast zewnętrznych URL-i WebVTT; wymagają pełnego buildu hls.js zamiast `light`. Trick play: storyboard (sprite + WebVTT) i playlisty I-frame niezrobione.
