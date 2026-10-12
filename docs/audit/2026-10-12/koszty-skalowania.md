# Koszty skalowania platformy wideo pawelperfect.com (single-creator -> multi-channel UGC), stan na 2026-10-12

Pliki obok: `cost_model.py` (skrypt, `python -I cost_model.py`), `cost_model_output.md` (jego wynik). Ceny pobrane 2026-10-12. Repo = worktree `dns-migration-cloudflare-bcfaf0` (docs ze stanem na 2026-10-05..07).
Waluta: ceny Cloudflare w USD, Hetzner w EUR (netto, bez VAT); przelicznik w modelu 1 EUR = 1,16 USD (założenie, niezweryfikowane).

## 1. Jakie są RZECZYWISTE parametry obecnego potoku wideo i serwera (repo)?

### Takeaway
Potok to: upload oryginału do prywatnego R2 -> kolejka w Postgresie -> JEDEN kontener `encoder` (ffmpeg, 1 zadanie naraz, `nice 10`, `mem_limit 1500m`) -> 5 renditions H.264 CMAF/fMP4, segmenty 6 s -> prywatny R2 `polutek-hls` -> Worker `video.pawelperfect.com` z tokenem HMAC (na planie Free). Oryginały zostają w R2 po kodowaniu; czas kodowania 1080p/długich filmów na CPX22 NIE jest zmierzony (tylko pilot 720p/10 s = 1,3x czasu rzeczywistego).

### Cited Findings
- Drabinka: 1080p (CRF 21, max 7,8 Mb/s), 720p (CRF 22, 4,5), 540p (CRF 23, 3,0), 360p (CRF 23, 1,1, <= 30 kl./s), 234p (CRF 24, 0,35, <= 30 kl./s); rendycja >80% pikseli wyższej jest pomijana; nigdy nie powiększa — [scripts/hls/encode-hls.mjs, LADDER_RUNGS](../../../scripts/hls/encode-hls.mjs) i [docs/operations/HLS-SELF-HOSTED.md](../../operations/HLS-SELF-HOSTED.md)
- Kodeki/format: H.264 High, preset domyślnie `slow` (`HLS_PRESET=medium` ~1,5-2x szybciej), IDR co 2 s, closed GOP, segmenty fMP4/CMAF 6 s, audio AAC-LC 128k stereo w KAŻDEJ rendycji (loudnorm -16 LUFS), plakat JPEG z 10% filmu; jeden proces ffmpeg dekoduje raz i `split` na rendycje — [docs/operations/VIDEO-PIPELINE.md §2](../../operations/VIDEO-PIPELINE.md), [encode-hls.mjs](../../../scripts/hls/encode-hls.mjs)
- Suma limitów pasma drabinki: 7,8+4,5+3,0+1,1+0,35 Mb/s wideo + 5x0,128 audio = ~17,4 Mb/s (sufit) — obliczone z `LADDER_RUNGS`
- Zadania: jedno kodowanie naraz (`claimNext` odmawia, gdy inne zadanie ma świeży heartbeat), 3 próby, heartbeat 5 s, stale po 3 min; wynik wgrywany po 4 pliki równolegle, `master.m3u8` ostatni — [VIDEO-PIPELINE.md §1-2](../../operations/VIDEO-PIPELINE.md), [worker-loop.ts](../../../lib/modules/video-pipeline/application/worker-loop.ts)
- Szybkość kodowania: pilot 720p 10 s = 13,5 s na CPX22 (1,3x czasu rzeczywistego, przed optymalizacją jednego dekodowania); „normalne tempo ok. 1-3x czasu rzeczywistego, 2 vCPU”; 1080p i długie filmy „niezmierzone” — [HLS-SELF-HOSTED.md](../../operations/HLS-SELF-HOSTED.md), [VIDEO-PIPELINE.md §4, §7](../../operations/VIDEO-PIPELINE.md)
- Benchmark 2026-10-01: syntetyczne 1080p30 60 s, drabinka tylko 720p+480p, `veryfast`: 19 s sam (3,2x real time, 189% CPU, 295 MB RAM), 37-43 s przy ruchu; aplikacja traci 20-28% przepustowości SSR w trakcie kodowania — [docs/operations/BENCHMARK-2026-10-01.md](../../operations/BENCHMARK-2026-10-01.md)
- Oryginały: prywatny bucket `polutek`, presigned multipart 16 MiB, limit 10 GiB (sufit 50 GiB), po kodowaniu ZOSTAJĄ (aktywny oryginał potrzebny do „Zakoduj ponownie”; SUPERSEDED do ręcznego sprzątania); nieaktywne wersje HLS też do ręcznego usunięcia — [VIDEO-PIPELINE.md §0, §7](../../operations/VIDEO-PIPELINE.md)
- Miniatury: tylko jeden plakat JPEG (<= 1280 px) na wersję HLS; brak storyboardu i playlist I-frame — [encode-hls.mjs](../../../scripts/hls/encode-hls.mjs), [HLS-SELF-HOSTED.md](../../operations/HLS-SELF-HOSTED.md)
- Worker `hls-edge`: token HMAC weryfikowany przy KAŻDYM żądaniu przed cache; klucz cache bez tokenu; `caches.default` (per centrum danych, bez Tiered Cache); segmenty `public, max-age=31536000, immutable`, playlisty `max-age=300`; Range przy chybieniu = odpowiedź prosto z R2 + wypełnienie cache w tle (czyli do 2 odczytów R2); każdy plik HLS = jedno wywołanie Workera, także trafienie w cache — [workers/hls-edge/worker.mjs](../../../workers/hls-edge/worker.mjs), [docs/architecture/self-hosted-hls.md](../../architecture/self-hosted-hls.md)
- Zmierzone/udokumentowane żądania: odtworzenie 3 min ~35 żądań, godzina ~600; wejście na stronę główną z autoplay hero 6-10 żądań; Free = twarde 100 000 żądań/dobę (Error 1027, wideo nie gra do 00:00 UTC), więc ok. 10-15 tys. wejść dziennie wyczerpuje limit — [self-hosted-hls.md „Koszt i limity”](../../architecture/self-hosted-hls.md), [docs/audit/2026-10-03/audit-feat-hls.md HLS-01](../../audit/2026-10-03/audit-feat-hls.md)
- Serwer: Hetzner CPX22 (2 vCPU AMD, 4 GB RAM, 75 GB dysku), ok. 24,59 EUR/mies. z VAT (konsola 2026-10-01), swap 4 GB w użyciu ~1,5 GB; limity RAM: app 1 GiB, db 512 MiB (`shared_buffers=128MB`, `max_connections=60`), redis 192 MiB, encoder 1500 MiB; jeden serwer, jeden `cloudflared` — [docs/operations/SERWEREK.md §3, §5](../../operations/SERWEREK.md)
- Test obciążenia 2026-10-04: komfortowo ~8 nowych odwiedzin/s, granica ~16-17/s (CPU procesu Node, nie baza); wizyta = ~100 ms CPU i 66 zapytań (strona główna 44 zapytania, ~45 ms); pamięć aplikacji rośnie do ~830 MiB przy przeciążeniu; baza 10-20% jednego rdzenia — [docs/operations/LOAD-TEST.md](../../operations/LOAD-TEST.md)
- Zapisy per widz: `/api/media-source` tworzy wiersz `VideoPlaybackSession` (tworzone też przez prefetch hover/idle, więc tabela rośnie z ruchem strony), `HEARTBEAT` co 60 s zapisuje wiersz `VideoPlaybackEvent` (duplikaty < 10 s odrzucane); cron kasuje po 30 dniach tylko sesje niezaliczone jako wyświetlenie, zdarzeń (`VideoPlaybackEvent`, FK `onDelete: SetNull`) żaden cron nie przycina; 1000 oglądających naraz ~ 17 heartbeatów/s ~ 8% mocy aplikacji — [prisma/schema.prisma VideoPlaybackSession/Event](../../../prisma/schema.prisma), [prune-stale-playback-sessions.use-case.ts](../../../lib/modules/video/application/prune-stale-playback-sessions.use-case.ts), [record-playback-event.use-case.ts](../../../lib/modules/video/application/record-playback-event.use-case.ts), [LOAD-TEST.md](../../operations/LOAD-TEST.md)
- Telemetria: beacon 1-3 żądania/odsłonę -> `/api/t` (przez aplikację) -> kolektor (96 MiB) -> schemat `telemetry`; ~3 wiersze/beacon (test: 2000 beaconów = 6000 wierszy w 1,8 s), surowe 90 dni, agregaty 25 mies. — [docs/architecture/admin-telemetry.md §2, §6](../../architecture/admin-telemetry.md)
- Kopie: `pg_dumpall` raz na dobę (RPO do 24 h, bez WAL/PITR), 7 dni lokalnie + szyfrowane `age` do R2 (blokada 14 dni, lifecycle 15 dni); oryginały i HLS w R2 BEZ kopii i bez blokady usuwania; jeden token R2 w `app.env` i `worker.env` może je skasować — [SERWEREK.md §9, §15](../../operations/SERWEREK.md)
- Redis: lokalny, 128 MB AOF `allkeys-lru`, tylko limity zapytań i liczniki logowania (nie kolejka; kolejka kodowania jest w Postgresie) — [SERWEREK.md §5](../../operations/SERWEREK.md), [VIDEO-PIPELINE.md §1](../../operations/VIDEO-PIPELINE.md)
- Znane braki skali: deploy przerywa trwające kodowanie i buduje obrazy na produkcyjnym serwerze; brak monitoringu zużycia limitu Workera; cache w Workerze nie korzysta z Tiered Cache — [VIDEO-PIPELINE.md §7](../../operations/VIDEO-PIPELINE.md), [audit-feat-hls.md HLS-19](../../audit/2026-10-03/audit-feat-hls.md)

### Inferences
- Obecny serwer wystarcza dla S0, ale pierwszym twardym limitem jest plan Workers Free (100 tys. żądań/dobę ~ 2,2 tys. odtworzeń/dobę przy ~46 żądań/odtworzenie), nie serwer.
- Oryginał + HLS na film to ~1,3 GB (zał. 12 Mb/s źródło, ~10 Mb/s średnio dla całej drabinki); drabinka ma 5 rendycji i audio w każdej, więc koszt składowania jest ~dużo wyższy niż w jednopasmowym wyjściu.
- Zapisy do bazy per wyświetlenie (~2 sesje + ~6 zdarzeń) i brak retencji zdarzeń to bomba czasowa przy skali (zob. §3).

### Gaps
- Czas kodowania pełnej drabinki 1080p 8-min na CPX22 i na dedykowanym serwerze: brak pomiaru w repo (zadanie do wykonania benchmarkiem; model używa 4 vCPU-s / s materiału dla `slow` z zakresem 2-6).
- Realne średnie bitrate'y wyjścia przy CRF z limitem (zał. ~55-60% limitu) i realny miss ratio cache: niezmierzone.
- Czy 3 filmy produkcyjne mają zapisane oryginały: nie (dokument: „oryginałów w R2 nie mają”).

## 2. Aktualne oficjalne ceny (dostęp 2026-10-12)

### Takeaway
Cloudflare R2: 0,015 USD/GB-mies., egress 0, Class A 4,50 USD/M, Class B 0,36 USD/M. Workers Paid: 5 USD/mies. + 10 M żądań, potem 0,30 USD/M (także trafienia w cache); CPU 30 M ms w cenie, potem 0,02 USD/M ms. Hetzner podniósł ceny 15.06.2026 (CPX22 7,99 -> 19,49 EUR, CCX13 15,99 -> 42,99 EUR), więc dedykowane serwery (EX44 LTD ~57 EUR) są teraz dużo tańsze na vCPU niż chmura dedykowana (CCX).

### Cited Findings
- R2 Standard: 0,015 USD/GB-mies.; IA 0,01 USD/GB-mies. (min. 30 dni, odczyt 0,01 USD/GB); Class A 4,50 USD/M (IA 9,00); Class B 0,36 USD/M (IA 0,90); free tier 10 GB, 1 M Class A, 10 M Class B; egress do internetu 0; DeleteObject i AbortMultipartUpload bez opłat; storage liczony jako średni dobowy szczyt w 30-dniowym miesiącu — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) (strona „last updated Oct 1, 2026”, dostęp 2026-10-12)
- Workers: Free 100 000 żądań/dobę, CPU 10 ms; Paid min. 5 USD/mies., 10 M żądań w cenie, +0,30 USD/M; 30 M CPU-ms w cenie, +0,02 USD/M CPU-ms; „requests served from the Worker's cache are billed at the same per-request rate”, a Worker działa przed cache Cloudflare, więc cache'owanie też kosztuje żądanie — [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (dostęp 2026-10-12)
- Workers limity: Free 100 000/dobę, po przekroczeniu Error 1027; Paid CPU domyślnie 30 s; brak ogólnego limitu żądań/s — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (dostęp 2026-10-12)
- Workers Cache API (`caches.default`): zawartość nie replikuje się poza centrum danych, `cache.put` nie jest zgodne z Tiered Cache (trzeba `fetch`), `put` nie przyjmuje 206 — [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) (dostęp 2026-10-12)
- Tiered Cache dostępny na planach Free/Pro/Business/Enterprise; strona nie podaje ceny Smart Tiered Cache — [Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/) (dostęp 2026-10-12)
- Warunki Cloudflare (aktualizacja 2026-09-28): w sekcji CDN (Free/Pro/Business) wideo i duże pliki przez CDN wymagają płatnych usług (Developer Platform, Images, Stream); w warunkach Developer Platform brak odpowiednika zakazu serwowania wideo dla R2/Workers, jest zapis „Developer Platform can be used to host content”, odpowiedzialność za użytkowników końcowych jest po stronie klienta, Cloudflare może ograniczyć liczbę żądań/pamięć przy obciążeniu sieci. Numeru „2.8” strona nie podaje — [Application Services terms](https://www.cloudflare.com/service-specific-terms-application-services/), [Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/) (dostęp 2026-10-12)
- Cloudflare Stream: 5 USD / 1000 min składowania (prepaid), 1 USD / 1000 min dostarczonych, kodowanie i ingress bezpłatne, brak darmowych minut w cenie, upload do 30 GB, domyślnie 120 filmów w kolejce — [Stream pricing](https://developers.cloudflare.com/stream/pricing/), [Stream FAQ](https://developers.cloudflare.com/stream/faq/) (dostęp 2026-10-12)
- Mux (on-demand, basic quality): kodowanie basic za darmo; 1080p: storage 0,0030 USD/min/mies. (tiery do 0,0028), delivery 0,0010 USD/min (tiery do 0,0007), 100 000 min dostarczonych/mies. gratis; 720p: storage 0,0024, delivery 0,0008; plan Pay-as-you-go z kredytem 20 USD, Launch 20 USD/mies. (kredyt 100 USD), Scale 500 USD/mies. (kredyt 1000 USD); rabaty za chłodny storage 40% po 30 dniach i 60% po 90 dniach bez odtworzeń — [Mux pricing](https://www.mux.com/pricing), [Mux video pricing docs](https://www.mux.com/docs/pricing/video) (dostęp 2026-10-12)
- Bunny Stream: storage 0,01 USD/GB (region domyślny, +0,01 za 2. region, +0,005 za kolejne), CDN Standard 0,010 USD/GB (EU/NA), Volume network 0,005 USD/GB do 500 TB, 0,004 do 1000 TB, 0,002 do 2000 TB; kodowanie standardowe w cenie, Premium Encoding 0,025-0,15 USD/min wyjścia; min. 1 USD/mies. — [Bunny Stream pricing](https://bunny.net/pricing/stream/), [Bunny Stream pricing docs](https://bunny.net/docs/stream-pricing) (dostęp 2026-10-12)
- api.video: kodowanie bezpłatne, hosting od 0,00285 USD/min/mies., delivery od 0,0017 USD/dostarczoną minutę; custom domain od 60 USD/mies. — [api.video pricing](https://api.video/pricing/) (dostęp 2026-10-12)
- Hetzner Cloud (podwyżka od 15.06.2026, EUR/mies. netto, bez IPv4, FSN/NBG/HEL): CPX22 7,99 -> 19,49; CPX32 13,99 -> 35,49; CPX42 25,49 -> 69,49; CPX52 36,49 -> 100,49; CCX13 15,99 -> 42,99; CCX23 31,49 -> 85,99; CCX33 62,49 -> 138,49; CCX43 124,99 -> 275,99; CX23 3,99 -> 5,49; ceny netto; dotyczy nowych zamówień i rescale (starsze serwery zachowują dotychczasowe warunki) — [Hetzner price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) (dostęp 2026-10-12)
- Hetzner: CCX13/23/33/43 zawierają 20/20/30/40 TB ruchu w EU; CPX22 EU 20 TB; ruch liczony tylko wychodzący, nadwyżka w blokach 100 MB; backupy 20% ceny serwera — [Hetzner General Purpose](https://www.hetzner.com/cloud/general-purpose/), [Hetzner Regular Performance](https://www.hetzner.com/cloud/regular-performance/), [Hetzner Cloud billing FAQ](https://docs.hetzner.com/cloud/billing/faq/) (dostęp 2026-10-12)
- Hetzner dedykowane (lustro cennika, netto, bez IPv4): EX44-1-LTD 57,30 EUR/mies. (setup 0, „limited offering”, do wyczerpania zapasów), AX42-1 187,30, AX102-1 452,30, AX162-1 612,30, EX63-1-LTD 97,30; EX44 = i5-13500 (6P+8E), 64 GB, 2x512 GB NVMe, 1 Gb/s „unlimited” traffic — [lustro cennika Hetzner](https://prismix.dev/news/e099eaeb0874) (wtórne), [Hetzner EX44](https://www.hetzner.com/dedicated-rootserver/ex44/) (dostęp 2026-10-12)
- Nadwyżka ruchu Hetznera w EU: 1 EUR/TB (źródło wtórne) — [egresscost.com/hetzner](https://egresscost.com/hetzner) (wtórne, brak potwierdzenia na stronie Hetznera)
- Hetzner Object Storage: 6,49 EUR/mies. za 1 TB + 1 TB egress, dodatkowo 8,70 EUR/TB, egress 1 EUR/TB (źródło wtórne, lipiec 2026) — [Sliplane](https://sliplane.io/blog/cheap-object-storage-providers-europe) (wtórne)
- Hetzner Storage Box: BX21 5 TB ~10,90 EUR, BX31 10 TB ~20,80 EUR netto (źródło wtórne, luty 2026), ruch bez limitu — [whtop.com BX31](https://www.whtop.com/plans/hetzner.com/128271) (wtórne)

### Inferences
- Przy cenach R2 dostarczanie (egress) jest w praktyce darmowe; koszt dostarczania przesuwa się na (a) opłaty za żądania Workera (46 żądań/odtworzenie) i (b) składowanie.
- Po podwyżce z 06.2026 chmura „dedykowana” (CCX) kosztuje ~21 EUR/vCPU/mies., a EX44-LTD (20 wątków) ~2,9 EUR/wątek: do kodowania i bazy dedykowane serwery są ~7x tańsze za rdzeń (zastrzeżenie: „LTD” = ograniczona dostępność).
- Mux i Cloudflare Stream liczą za minutę, Bunny za GB: przy mojej dystrybucji (60 MB/odtworzenie ~ 3,2 min) Bunny wychodzi 7-10x taniej niż Stream/Mux, ale to zależy od założonego bitrate'u.

### Gaps
- Cennik Hetznera dla Volumes, Storage Box, aukcji serwerów i nadwyżki ruchu: strony JS bez cen w pobranej treści; podane liczby pochodzą ze źródeł wtórnych lub są niezweryfikowane.
- Cena „Cloudflare Tunnel”: strony dokumentacji nie podają ceny w pobranej treści; repo uruchamia tunel na planie Free (SERWEREK.md §6), więc zakładam 0, ale nie zweryfikowano oficjalnie.
- Cena Cloudflare CSAM Scanning Tool: strona nie podaje (nie wiadomo, czy bezpłatne).
- Wymaganie, by token HMAC w WAF (`is_timed_hmac_valid_v0`) był dostępny na planie Pro i działał z tokenem w ścieżce: przytoczone z audytu repo (20-25 USD/mies.), nie sprawdzone na oficjalnej stronie.
- Kurs EUR/USD z 2026-10: niezweryfikowany (model: 1,16).
- Cennik Enterprise Cloudflare (gdy ruch dochodzi do petabajtów): niedostępny publicznie.

## 3. Model kosztów i wyniki scenariuszy (formuły, założenia, co się psuje)

### Takeaway
Przy obecnej architekturze koszt na 1000 odtworzeń spada z ~2,3 USD (S0, koszt stały serwera) do ~0,25 USD (S3-S4), a od S2 dominuje SKŁADOWANIE w R2 (oryginał + 5 rendycji ~1,3 GB/film), nie dostarczanie. Pierwsze, co pęka: limit 100 tys. żądań/dobę Workera Free (już w S1), potem pojedynczy encoder i niepodcinane tabele odtwarzania w bazie (S2-S3); w S4 pęka jednowęzłowy Postgres i limit „uczciwego użytku” Cloudflare (18 PB/mies.).

### Cited Findings
(parametry z repo i cenników jak w sekcjach 1-2; poniżej definicje modelu — wszystko jest w `cost_model.py`)
- Wejścia: film 8 min, oglądane 40% = 192 s = 3,2 min/odtworzenie; segment 6 s [repo] => 32 segmenty + ~6 playlist/init + 20% prefetchu = **46 żądań Workera/odtworzenie** (repo mierzy ~35 dla 3 min i 600/godz. = 10/min; model daje 14/min, bo prefetch)
- 60 MB dostarczone/odtworzenie (192 s x 2,5 Mb/s średni bitrate widza, założenie)
- Oryginał 12 Mb/s => 0,72 GB; drabinka średnio 10 Mb/s (sufit 17,4) => 0,60 GB; razem 1,32 GB/film => 0,0198 USD/film/mies. w R2 Standard
- Class A / upload: 5x80 segmentów + init/playlisty/plakat + ~45 części multipart + kilka list = ~472 PUT; kasowanie za darmo
- Class B: żądania x miss ratio (50% bazowo; 20-80% w czułości); Range na chybieniu może dać 2 odczyty
- Worker: 0 USD na Free tylko gdy < 100 tys. żądań/dobę; inaczej 5 USD + 0,30 USD/M ponad 10 M + CPU (2 ms/żądanie, ZAŁOŻENIE, niezmierzone)
- Kodowanie: 4 vCPU-s na sekundę materiału (`slow`; zakres 2-6; `medium` 2,4; `veryfast` 1,2); 1 EX44 ~ 12 vCPU-ekwiwalentów (ZAŁOŻENIE do zbenchmarkowania) => 160 s na film 8 min, ~11 300 filmów/mies. przy 70% użyciu; flota liczona na godzinę szczytu (3x średnia)
- Aplikacja: 80 odwiedzin/s na EX44 bez cache strony głównej (z LOAD-TEST: 16/s na 2 vCPU); odwiedziny = 1,3 x odtworzenia; szczyt = 8x średnia
- Baza: ~2 wiersze sesji (400 B) + ~6 zdarzeń (500 B) = ~3,8 KB/odtworzenie bez retencji; 12 zapisów/odtworzenie; telemetria 3 wiersze x 150 B x 90 dni

Wyniki bazowe (USD/mies., pełna tabela w `cost_model_output.md`):

| Scen. | kanały / filmy / odtw./mies. / uploady/mies. | Żądania Workera | R2 TB | Razem USD | USD/1000 odtw. | USD/godz. obejrzana | Dominuje |
|---|---|---|---|---|---|---|---|
| S0 | 1 / 10 / 10k / 2 | 0,5 M | 0,0 | 23 | 2,33 | 0,044 | serwer |
| S1 | 50 / 2k / 100k / 400 | 4,6 M (Free pęka: 154 tys./dobę) | 2,6 | 111 | 1,11 | 0,021 | serwer + backup oryginałów |
| S2 | 500 / 20k / 2M / 4k | 91 M | 26 | 845 | 0,42 | 0,008 | storage R2 (396) + backup (149) + encoder (134) |
| S3 | 5k / 200k / 30M / 40k | 1,37 mld | 264 | 7 642 | 0,25 | 0,005 | storage R2 (3 960) + backup oryginałów (1 440) + Worker (467) + encoder (738) |
| S4 | 50k / 2M / 300M / 400k | 13,7 mld | 2 640 | 76 528 | 0,26 | 0,005 | storage R2 (39 600) + backup (15 200) + encoder (7 107) + Worker (4 653) |

Warianty (S2 / S3 / S4, USD/mies.): zoptymalizowany (oryginały w R2-IA, segmenty 10 s, segmenty przez własną domenę R2 + cache CDN z WAF HMAC na Pro, preset medium) = 693 / 6 092 / 60 673; „lean” (oryginały kasowane po kodowaniu, średnia drabinka 6 Mb/s, reszta jak wyżej) = 333 / 2 492 / 24 673.

Wskaźniki pęknięć (z `cost_model.py`):
- Encoder: 160 s/film na EX44 (`slow`); flota szczytowa: S2 ~1,1, S3 ~10,6, S4 ~106 maszyn (przy `medium` ~64); na CPX22 (~2 vCPU, współdzielone) jeden 8-min film to ~16 min+ (1,3-3x real-time z dokumentacji => 10-24 min), kolejka 50 filmów = 8-13 godz.
- Odtwarzanie/baza: wzrost samych tabel odtwarzania bez retencji: S2 7,6 GB/mies. (95 GB w rok > dysk 75 GB serwerka), S3 114 GB/mies. (1,4 TB/rok), S4 1,1 TB/mies.; zapisy: S3 ~139/s średnio, ~1100/s szczyt; S4 ~1390/s średnio, ~11 100/s szczyt
- Aplikacja: szczyt odwiedzin S2 ~8/s (granica CPX22 ~8 komfortowo, 16 max), S3 ~120/s, S4 ~1200/s
- Dostarczone bajty: S2 120 TB, S3 1,8 PB, S4 18 PB miesięcznie (Cloudflare nie nalicza egressu R2, ale warunki dopuszczają ograniczenie „gdy obciąża sieć” — brak oficjalnego progu)

### Inferences
- **Co psuje się pierwsze:** (1) S1: limit 100 tys. żądań/dobę Workera Free (4,6 M/mies. = 154 tys./dobę); naprawa: Workers Paid 5 USD. (2) S2: pojedynczy encoder na serwerze produkcyjnym (kolejka, spowalnia stronę o ~25%; deploy przerywa kodowanie od zera) + bomba tabel odtwarzania (brak retencji `VideoPlaybackEvent`) + dysk 75 GB; naprawa: osobna maszyna kodująca, retencja 30 dni/partycje, przeniesienie heartbeatów do telemetrii. (3) S3: jedna instancja Node (limit ~16 odwiedzin/s), Postgres jako jeden węzeł (>1000 zapisów/s w szczycie), `pg_dumpall` raz na dobę nie skaluje (RPO 24 h, godziny zrzutu przy >1 TB), brak kopii mediów. (4) S4: nic z DIY nie jest liniowe: potrzebny klaster PG/sharding, flota ~100 koderów, umowa Enterprise z Cloudflare (18 PB/mies.), zespół on-call.
- **Co zmienić (kolejność zysku):** retencja oryginałów (usuń lub IA po N dniach) i dopasowanie drabiny (-40-70% kosztu składowania, który dominuje od S2); segmenty 10 s i/lub segmenty przez CDN-cache bez Workera (-ok. 90% opłat za żądania; wymaga WAF HMAC lub podpisów w playliście — niezweryfikowane); `HLS_PRESET=medium`; osobna flota koderów (EX44-class, kolejka w Postgresie już działa z `SKIP LOCKED`, więc wiele workerów wymaga tylko zdjęcia blokady „jedno zadanie naraz”); retencja zdarzeń + partycjonowanie; cache strony głównej (-45% CPU wizyty wg LOAD-TEST); repliki Postgresa.
- Koszt DIY jest dla S2-S3 nieliniowo „tani” (0,25-0,42 USD/1000 odtw.), ale NIE zawiera pracy ludzi: on-call, moderacja, wsparcie — to w S3+ przewyższa infrastrukturę (zob. §5).
- Wynik jest bardzo wrażliwy na dwa niezmierzone parametry: bitrate drabinki (storage) i liczba żądań/odtworzenie (Worker); czułość: miss ratio 20-80% zmienia S3 tylko o ~±2%; zmiana średniej drabinki 10 -> 6 Mb/s oraz skasowanie oryginałów obniża S3 o ~2/3.

### Gaps
- Brak zmierzonych: realnej prędkości kodowania, średniego rozmiaru wyjścia, miss ratio cache, CPU Workera/żądanie, ile heartbeatów/odtworzenie w produkcji (model: 6 wierszy zdarzeń/odtw.); wszystkie są jawnymi założeniami w skrypcie.
- Skala S4 nie została zaprojektowana (tylko oszacowana rzędem wielkości).
- Koszt pracy inżynierskiej (utrzymanie floty, on-call) nie jest wliczony do liczb infrastruktury.

## 4. Porównanie z rozwiązaniami zarządzanymi (S1-S3; wideo + ta sama warstwa app/DB)

### Takeaway
Przy S1-S3 (wideo + ta sama warstwa app/DB) DIY na R2 jest ok. 4-14x tańsze niż Cloudflare Stream, ok. 3-10x niż Mux 1080p, a Bunny Stream (storage + CDN liczone w GB) jest najtańszą gotową opcją: w S1 praktycznie równa DIY (98-128 vs 111 USD), w S2-S3 DIY jest ~1,1-2,7x tańsze (DIY zawiera kopię oryginałów i monitoring, których w kolumnach zarządzanych nie liczono). Stream, Mux i api.video skalują się liniowo z minutami dostarczonymi i są nieopłacalne przy darmowym, niekomercyjnym serwisie.

### Cited Findings
- Dane wejściowe: min przechowywane = filmy x 8; min dostarczone = odtworzenia x 3,2; GB dostarczone = odtworzenia x 0,06; GB zapisane (Bunny) = filmy x 1,32 — `cost_model.py`
- Wyniki (USD/mies., samo wideo, bez warstwy app/DB):

| Scen. | Cloudflare Stream | Mux 1080p basic | Mux 720p basic | Bunny Stream (Volume / Standard) | api.video | DIY bazowo (całość) |
|---|---|---|---|---|---|---|
| S0 | 32 | 0 (100k min gratis) | 0 | 3 / 6 | 55 | 23 |
| S1 | 400 | 268 | 214 | 56 / 86 | 590 | 111 |
| S2 | 7 200 | 5 924 | 4 738 | 864 / 1 464 | 11 336 | 845 |
| S3 | 104 000 | 72 914 | 58 328 | 11 640 / 20 640 | 167 760 | 7 642 |
| S4 | 1 040 000 | 718 034 | 574 424 | 116 400 / 206 400 | 1 677 600 | 76 528 |

(do każdego dodaj warstwę app/DB: S1 ~42, S2 ~67, S3 ~335, S4 ~3 665 USD)

### Inferences
- Zarządzane opcje zdejmują: encoder, kolejkę, składowanie, tokeny dostępu; ale tracisz: pełną kontrolę nad dostępem (tokeny HMAC, bramka premiery), niski koszt przy darmowym modelu.
- Bunny: niska cena zależy od ich ladder'a i polityki „keep original”; zmierzyć na próbce.
- Mux ma rabaty za chłodny storage (-40% po 30 dniach, -60% po 90 dniach bez odtworzeń), co dla długiego ogona UGC realnie obniża koszt składowania.

### Gaps
- Faktyczny bitrate/ladder u Bunny i rozmiar składowanego wyjścia; limity i regulaminy UGC każdego dostawcy (nie sprawdzono); ceny Enterprise.

## 5. Koszty poza hostingiem przy uploadach użytkowników (jakościowo + rząd wielkości)

### Takeaway
Gdy każdy może wgrać film, największe koszty to ludzie i prawo: moderacja (w tym obowiązek reagowania na CSAM i zgłoszenia), procedury DSA (notice-and-action dla każdego hostingu), ochrona praw autorskich (art. 17 DSM — dla nowej małej usługi lżejszy reżim) oraz wypłaty, jeśli kiedyś będzie monetyzacja. Rząd wielkości: od kilkuset USD/mies. (S1) do dziesiątek tysięcy (S3+), głównie robocizna.

### Cited Findings
- CSAM: Cloudflare CSAM Scanning Tool porównuje treści serwowane przez cache Cloudflare z listami znanych materiałów (np. NCMEC), wysyła dzienny e-mail ze ścieżkami, próbuje blokować; skanuje tylko treść serwowaną przez cache; właściciel odpowiada prawnie za zgłoszenie, zachowanie dowodów (~1 rok) i usunięcie; strona nie podaje ceny ani czy obejmuje bezpośredni dostęp do R2 — [CSAM Scanning Tool](https://developers.cloudflare.com/cache/reference/csam-scanning/) (dostęp 2026-10-12)
- Warunki Developer Platform: za treści użytkowników końcowych odpowiada klient, Cloudflare może blokować i zawieszać za treści „illegal or harmful” (w tym CSAM/wykorzystywanie dzieci) — [Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/) (dostęp 2026-10-12)
- DSA: obowiązek mechanizmu zgłoszeń i działań (Art. 16) dotyczy każdego usługodawcy hostingowego niezależnie od wielkości; mikro i małe przedsiębiorstwa (<50 pracowników, < 10 mln EUR obrotu) są zwolnione z części obowiązków platform (m.in. Art. 19), nadal obowiązują punkty kontaktowe, warunki korzystania, współpraca z organami; [źródło wtórne, w tym ostrzeżenie o błędach numeracji w niektórych opracowaniach] — [Presencis DSA Art. 16](https://presencis.com/regulations/dsa/article-16/), [Presencis zakres stosowania](https://cdn.presencis.com/regulations/dsa/applicability/) (dostęp 2026-10-12)
- Prawa autorskie: art. 17(6) dyrektywy DSM — nowi, mali dostawcy (<3 lat, obrót <10 mln EUR) mają lżejszy reżim: „best efforts” po zezwolenie i usuwanie po zgłoszeniu; po przekroczeniu 5 mln unikalnych odwiedzających miesięcznie także „best efforts” by zapobiegać ponownym uploadom; transpozycje różnią się (np. Niemcy) — [Council doc 2019 / opracowanie Havel & Partners](https://www.havelpartners.cz/en/03-2019-commercial-flash-pdf/), [Council ST-5893-2019](https://data.consilium.europa.eu/doc/document/ST-5893-2019-INIT/en/pdf) (źródła wtórne/projekty tekstu, dostęp 2026-10-12)
- Detekcja audio: ACRCloud — cennik za logowaniem, per rozpoznanie (anegdotycznie ~5,8 USD/1000 zapytań w 2019); Audible Magic — cennik niepubliczny, stare szacunki: od ~900 EUR/mies. dla małego usługodawcy (<5000 plików audio/mies., wg opracowania KE cytowanego w 2017), 10-25 tys. USD/mies. dla średnich — [ACRCloud docs](https://docs.acrcloud.com/), [Audible Magic](https://www.audiblemagic.com/?p=1605) (wtórne i nieaktualne, dostęp 2026-10-12)
- Wypłaty (Stripe Connect): 2 USD / aktywne konto / mies. + 0,25% + 0,25 USD za wypłatę (strona lokalizacji USD/NO/SE; EUR nie potwierdzono), Instant Payouts 1%, cross-border 0,25% — [Stripe Connect pricing](https://stripe.com/fr-us/connect/pricing) (dostęp 2026-10-12, źródło oficjalne, ale wersja językowa niezgodna z EUR)

### Inferences
- Moderacja ludzka: przy S1 (400 uploadów/mies.) wystarczy kilkanaście godzin/mies. (przegląd po zgłoszeniu + filtr wstępny); przy S3 (40 000 uploadów/mies.) pre-moderacja wszystkiego = kilka etatów (3-8 osób przy 2-3 min/film), przy S4 dziesiątki; rząd wielkości 5-30 tys. USD/mies. dla S3 (tylko robocizna, bez narzędzi) — SZACUNEK własny, nie z źródła.
- Skanowanie CSAM (hash-match przez narzędzia dostawców) jest zwykle darmowe/niskie koszt, ale proces (zgłaszanie, retencja dowodów, kontakt z organami, szkolenie, wsparcie psychologiczne moderatorów) to koszt stały.
- DSA/prawo: radca prawny na wdrożenie regulaminu, procedur zgłoszeń i polityki — kilka-kilkanaście tys. USD jednorazowo + stały retainer; przy braku monetyzacji i statusie małego przedsiębiorstwa obowiązków jest mniej, ale notice-and-action i punkt kontaktowy są wymagane (SZACUNEK własny).
- Odcisk audio: sens dopiero przy realnych roszczeniach praw autorskich; budżet 1-25 tys. USD/mies. zależnie od wolumenu (SZACUNEK z nieaktualnych źródeł).
- Wsparcie użytkowników (konta, odwołania, zgłoszenia praw): rośnie z liczbą kanałów, ok. 1 etat na ~tysiące aktywnych kanałów (SZACUNEK).

### Gaps
- Oficjalne EUR-cenniki Stripe Connect (UE), aktualna cena Audible Magic/ACRCloud, koszty moderacji outsourcowanej (np. per-item): nie znalezione w źródłach pierwotnych.
- Interpretacja polskiej ustawy wdrażającej DSA i wymagań dla niekomercyjnej platformy: wymaga prawnika (repo samo notuje otwarte pytania prawne: „brak sekcji reklamacji/DSA” w STATUS.md).
- Czy CSAM Scanning Tool obejmuje treści serwowane z R2 przez Workera (cache API) — niejasne.
