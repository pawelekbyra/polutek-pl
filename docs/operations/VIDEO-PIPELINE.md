# Własny pipeline wideo: upload, kolejka kodowania, worker, HLS (2026-10-03)

Decyzja właściciela 2026-10-02: **żadnych zewnętrznych dostawców wideo** (Mux, Cloudflare Stream, Vimeo, YouTube). Wideo wgrywamy, kodujemy i serwujemy sami. Dostarczanie (Worker `video.pawelperfect.com`, token HMAC) opisuje `docs/operations/HLS-SELF-HOSTED.md` i `docs/architecture/self-hosted-hls.md`; ten dokument opisuje to, co dzieje się **przed** dostarczaniem.

```
przeglądarka (admin)                      serwerek                                   Cloudflare R2
  |  presigned multipart PUT  ------------------------------------------------>  polutek (oryginały, prywatny)
  |  POST complete -> aplikacja sprawdza rozmiar + magic bytes, tworzy zadanie
  v
Postgres: VideoEncodeJob (QUEUED) <---- worker (kontener "encoder") SELECT ... FOR UPDATE SKIP LOCKED
                                         1. pobiera oryginał z R2 do /work
                                         2. ffprobe: limity, brak obrazu
                                         3. encode-hls.mjs (nice 10): jeden proces ffmpeg, cała drabinka
                                         4. wgrywa HLS do polutek-hls (master.m3u8 na końcu)
                                         5. weryfikuje obiekty -> VideoAsset(SELF_HLS, READY) + aktywna trasa
                                         6. (opcjonalnie) publikuje film
```

## 0. Upload oryginału (przeglądarka -> R2, wznawialny)

Admin wgrywa **oryginał** bezpośrednio do prywatnego bucketa `polutek` przez presigned **multipart** (nic nie idzie przez serwer aplikacji):

1. `POST /api/admin/videos/<id>/original-upload/multipart` (`fileName`, `fileSize`, `contentType`): walidacja (rozszerzenie z listy: mp4, m4v, mov, webm, mkv, avi, ts, mts, m2ts; typ `video/*` lub pusty; rozmiar 64 KiB .. **10 GiB**, zmienna `VIDEO_UPLOAD_MAX_BYTES`, twardy sufit 50 GiB), `CreateMultipartUpload`, wiersz `VideoOriginal` (UPLOADING, `uploadId`, układ części: 16 MiB, więcej tylko gdy trzeba zmieścić się w 10 000 części). Odmawia, gdy film ma aktywne kodowanie; poprzedni niedokończony upload tego filmu jest porzucany (i abortowany w R2).
2. Przeglądarka prosi o presigned PUT-y partiami po 50 (`.../multipart/parts`, ważne 2 h), wysyła 4 części równolegle (XHR, postęp/prędkość/ETA), każdą część ponawia 4 razy (odnawia URL). Po przeładowaniu strony `GET .../multipart?originalId=` mówi, które części R2 już ma, i wysyłane są tylko brakujące (klucz wznowienia w `localStorage`: film + nazwa + rozmiar + mtime).
3. `POST .../multipart/complete` (lista części z ETagami): `CompleteMultipartUpload`, potem **weryfikacja tego, co naprawdę leży w R2**: rozmiar = zadeklarowany i <= limit, **magic bytes** (MP4/MOV, Matroska/WebM, AVI, MPEG-TS/M2TS; nazwa i typ z przeglądarki nie wystarczają). Plik, który nie przejdzie, jest **kasowany z R2**, oryginał dostaje `FAILED` z powodem, audit `VIDEO_ORIGINAL_UPLOAD_REJECTED`. Poprawny: oryginał `READY`, poprzednie `SUPERSEDED`, `Video.activeOriginalId`, zadanie kodowania w kolejce. Ponowne `complete` jest idempotentne.
4. `DELETE .../multipart?originalId=` = Anuluj (abort w R2).

Bucket `polutek` zostaje **prywatny** (bez `r2.dev`, bez domeny publicznej). Jednorazowo trzeba ustawić **CORS** (przeglądarka PUT-uje na adres S3 i musi odczytać `ETag`): `npx wrangler r2 bucket cors set polutek --file scripts/hls/originals-cors.json` (plik: dozwolone originy `https://www.pawelperfect.com`/`https://pawelperfect.com`, metody PUT/GET/HEAD, `ExposeHeaders: ETag`). Niedokończone uploady: R2 kasuje części po 7 dniach, a cron `abandon-stale-originals` (timer `polutek-cron-abandon-stale-originals`, 04:30 UTC) w tym samym wieku abortuje multipart i ustawia wiersz `VideoOriginal` na `ABANDONED` (`?dryRun=1` tylko liczy).

Audit (`lib/modules/audit`): `VIDEO_ORIGINAL_UPLOAD_PROVISIONED`, `_COMPLETED`, `_REJECTED`, `_ABORTED`, `VIDEO_ORIGINAL_UPLOADS_ABANDONED` (cron), `VIDEO_ENCODE_ENQUEUED`, `_STARTED`, `_SUCCEEDED`, `_FAILED`, `_CANCEL_REQUESTED`, `_CANCELLED`. Trasy są za `requireAdminForApi`, CSRF i limitem żądań z middleware (start/complete/abort: 20/min).

## 1. Kolejka (Postgres, bez Redisa)

Tabela `VideoEncodeJob` (migracja `20261003100000_add_video_encode_job`). Wybór: **zwykła tabela + `SELECT … FOR UPDATE SKIP LOCKED`**, nie pg-boss. Powód: potrzebujemy jednego typu zadania, jednego workera i widoku w adminie; pg-boss dokłada własny schemat i migracje, własne stany i zależność, a i tak musielibyśmy dopisać postęp, ETA, anulowanie i heartbeat. Tabela to ~200 linii kodu, w pełni pod kontrolą, w tej samej bazie i w tych samych kopiach zapasowych.

- **Stany:** `QUEUED → RUNNING → SUCCEEDED | FAILED | CANCELLED` (`QUEUED` po błędzie przejściowym). Etapy: `DOWNLOADING → PROBING → ENCODING → UPLOADING → FINALIZING → DONE`. Procent (0-100) jest jeden dla całego zadania (pobranie 0-8, kodowanie 9-90: krótki pomiar głośności, potem jedno kodowanie całej drabinki, wgranie 90-99), ETA liczone z przepustowości kodowania (null, dopóki za mało danych).
- **Jedno kodowanie naraz** (CPX22 ma 2 vCPU): jeden worker, a `claim` odmawia, gdy jakieś zadanie ma świeży heartbeat (plus `pg_try_advisory_xact_lock`).
- **Idempotencja:** `idempotencyKey = "<originalId>:<n>"`; ponowne `enqueue` dla tego samego oryginału przy aktywnym zadaniu zwraca to zadanie; drugi plik tego samego filmu przy aktywnym zadaniu = błąd `ENCODE_ALREADY_ACTIVE`. Wynik: wersja HLS `v<N>` (nigdy nie nadpisujemy: cache krawędzi jest `immutable`).
- **Ponowienia:** 3 próby (`DEFAULT_MAX_ATTEMPTS`); błąd przejściowy (sieć, R2 5xx, ffmpeg zabity przez OOM, brak miejsca) po 1. próbie wraca do `QUEUED` za 1 min, po 2. za 5 min, po 3. zadanie kończy się `FAILED`. Trwałe (uszkodzony plik, brak obrazu, za długi, za duża rozdzielczość, walidacja wyniku) kończą zadanie od razu z `failureCode` i polskim opisem.
- **Heartbeat zadania** co 5 s (przy okazji sprawdzenie flagi anulowania). Zadanie `RUNNING` bez heartbeatu > 3 min (awaria, restart) jest cofane do `QUEUED` (albo `FAILED` po wyczerpaniu prób, `CANCELLED` gdy czekało anulowanie). Delikatne zatrzymanie kontenera (SIGTERM) oddaje zadanie do kolejki **bez zużycia próby**, ale kodowanie zaczyna się potem od zera (każdy deploy, który odtwarza kontener `encoder`, przerywa trwające kodowanie; zob. „Znane braki”).
- **Testy SQL kolejki** (`claimNext`, `requeueStale`, `markSucceeded`, `markFailedOrRetry`, `release`, `enqueue`) biegną na prawdziwym Postgresie w jobie CI `integration-postgres` (`tests/postgres/`, `vitest.postgres.config.ts`).
- **Anulowanie:** `QUEUED` od razu `CANCELLED`; `RUNNING` dostaje flagę, worker zabija ffmpeg, kasuje częściowy wynik w R2 i oznacza `CANCELLED`.
- **Ponowne kodowanie** = nowe zadanie (następna generacja i wersja HLS) dla aktywnego oryginału; stara wersja gra do chwili przełączenia trasy.

## 2. Worker

`scripts/video-worker.ts` (logika w `lib/modules/video-pipeline/`), uruchamiany jako **osobny kontener `encoder`** w `deploy/serwerek/docker-compose.yml` (obraz `polutek-worker:<sha>`, target `worker` w `Dockerfile`, budowany przez `deploy.sh` obok aplikacji). Dlaczego kontener, a nie jednostka systemd na hoście: ten sam pipeline wdrożeń i rollbacku co aplikacja (obraz = kod + zależności + ffmpeg w znanej wersji 8.0.1), izolacja i limity (`mem_limit 1500m`, `cpu_shares 256`, `nice 10` w środku), restart i logi tak samo jak reszta stosu, brak instalowania `node_modules` na hoście. Crony systemd (Next.js `/api/cron/*`) zostają bez zmian: to krótkie żądania HTTP, nie długie procesy.

Bezpieczeństwo workera: własny plik `worker.env` (tylko `DATABASE_URL`, `CLOUDFLARE_R2_*`, `NEXT_PUBLIC_R2_PUBLIC_HOST`; bez sekretów Stripe/auth), użytkownik `node`, brak portów.

Co robi dla zadania (`processEncodeJob`):

1. Zadanie z już działającym wynikiem (awaria między finalizacją a zapisem) kończy się od razu, bez ponownego kodowania i bez kasowania.
2. Sprawdza miejsce (`3 × rozmiar oryginału + 1 GiB`), pobiera oryginał do `/work/<jobId>/`.
3. `ffprobe`: wymaga obrazu (sam dźwięk = błąd trwały), odrzuca czas > 6 h i kadr > 7680×4320. Obsługuje obrót, przeplot (`bwdif`), zmienną liczbę klatek, brak ścieżki audio, nieparzyste wymiary i **HDR** (HLG/PQ, np. iPhone HDR/Dolby Vision 8.4): mapowanie tonów do SDR BT.709 (`zscale` + `tonemap=hable`, raz, w rozmiarze górnej rendycji).
4. `encode-hls.mjs` jako biblioteka (`encodeHls`): **jeden proces ffmpeg** dekoduje źródło raz i przez `split` zasila wszystkie rendycje (audio: loudnorm -16 LUFS raz, `asplit`). Drabinka to prostokąty 16:9 obrócone do orientacji źródła (1920×1080, 1280×720, 960×540, 640×360, 416×234), źródło wpisane w prostokąt, nigdy powiększane, `setsar=1`; pion 1080×1920 dostaje pełne 1080×1920, kino 1920×804 pełne 1920×804; rendycja prawie tak duża jak wyższa (>80% pikseli) jest pomijana. Rendycje ≤ 432p mają najwyżej 30 kl./s. H.264 High (poziom liczony z rozmiaru i kl./s), CMAF/fMP4, 6 s segmenty, IDR co 2 s w każdej rendycji (te same granice segmentów), własny master (`FRAME-RATE`, `CODECS`, `CLOSED-CAPTIONS=NONE`), plakat z górnej rendycji w 10% filmu, samokontrola wyniku. Preset z `HLS_PRESET` (domyślnie `slow`; `medium` ≈ 1,5-2× szybciej kosztem jakości/rozmiaru), `HLS_NICE` (domyślnie 10).
5. Wgrywa do `polutek-hls/videos/<videoId>/v/v<N>/…` po 4 pliki równolegle, **`master.m3u8` na końcu**, po uprzednim opróżnieniu prefiksu (poprzednia, niedokończona próba). Sprawdza, że master istnieje i liczba obiektów się zgadza.
6. Dopiero wtedy `VideoAsset(provider=SELF_HLS, READY, objectKey=videos/<id>/v/v<N>)` + aktywna trasa odtwarzania (`VideoPlaybackRouteService.activateRoute`). Jeśli film nie ma własnej miniatury (`/logo.png`), plakat staje się miniaturą; uzupełnia `duration`. Jeśli admin zaznaczył „opublikuj po przetworzeniu” (`Video.publishAfterAssetReady`), woła `attemptPublishAfterAssetReady` (blokady publikacji bez zmian: wymagają aktywnej trasy z gotowym assetem).

**Nigdy nie widać niepełnego wyniku:** dopóki asset i trasa nie istnieją, nic nie wskazuje na wgrane pliki, a master (punkt wejścia) idzie na końcu. Przy błędzie/anulowaniu/zatrzymaniu prefiks w R2 jest kasowany, katalog roboczy zawsze.

## 3. Konfiguracja (zmienne)

| Zmienna | Gdzie | Znaczenie |
|---|---|---|
| `DATABASE_URL` | worker.env | ta sama baza co aplikacja |
| `CLOUDFLARE_R2_ACCOUNT_ID`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY` | app.env, worker.env | jeden token R2 z odczytem i zapisem na bucketach `polutek`, `polutek-hls`, thumbnails |
| `CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS` | app.env, worker.env | `polutek` (prywatny, oryginały) |
| `CLOUDFLARE_R2_BUCKET_HLS` | app.env, worker.env | `polutek-hls` (domyślnie, gdy brak) |
| `CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE`, `NEXT_PUBLIC_R2_PUBLIC_HOST` | worker.env | miniatura z plakatu |
| `HLS_PRESET` (`slow`), `HLS_NICE` (`10`), `VIDEO_WORKER_WORK_DIR` (`/work`) | worker.env (opcjonalne) | |

## 4. Diagnostyka: zadanie utknęło / nie rusza

```bash
ssh serwerek
cd /opt/serwerek/apps/polutek
docker compose ps encoder && docker compose logs --tail 100 encoder      # logi JSON, jedna linia = jedno zdarzenie
docker exec -i polutek-db-1 sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "select id, status, stage, \"progressPercent\", \"attemptCount\", \"failureCode\", left(\"failureReason\",80), \"heartbeatAt\", \"nextAttemptAt\" from \"VideoEncodeJob\" order by \"createdAt\" desc limit 10"'
df -h /opt/serwerek/data/video-work && ls -la /opt/serwerek/data/video-work
```

| Objaw | Przyczyna / co robić |
|---|---|
| Admin: „worker nie odpowiada” (przy `QUEUED`) | kontener nie działa: `docker compose up -d encoder` (albo `deploy.sh`); brak `worker.env`; zły obraz. Heartbeat workera to `AppSetting video_worker_heartbeat`, odświeżany między zadaniami (w trakcie długiego zadania patrz `heartbeatAt` zadania) |
| `QUEUED` z `nextAttemptAt` w przyszłości | czeka na ponowienie po błędzie przejściowym; `failureCode` mówi czemu (np. `DISK_FULL`, `TRANSIENT_ERROR`) |
| `RUNNING`, ale heartbeat stary | worker padł; po 3 min zadanie wróci do kolejki samo. Natychmiast: `docker compose restart encoder` |
| `FAILED` + `INVALID_MEDIA` / `NO_VIDEO_STREAM` | zły plik; wgraj inny. `TOO_LONG`, `TOO_LARGE_FRAME`: poza limitami |
| `FAILED` + `VALIDATION_FAILED` | wynik nie przeszedł samokontroli (szczegóły w `failureReason`); spróbuj „Zakoduj ponownie”, a jeśli powtarza się, zgłoś (to błąd enkodera dla tego źródła) |
| `FAILED` + `WORKER_LOST` | worker padał 3 razy w trakcie (np. OOM: wszystkie rendycje kodują się naraz w jednym procesie): `dmesg`/`docker inspect` na `OOMKilled`, zwiększ `mem_limit` albo użyj `HLS_PRESET=medium` |
| ffmpeg mieli wiecznie | normalne tempo to ok. 1-3× czasu rzeczywistego filmu (2 vCPU); ETA widać w adminie |

Ręczne awaryjne czyszczenie zadania: `update "VideoEncodeJob" set status='CANCELLED', "finishedAt"=now(), "workerId"=null where id='<id>';` (tylko gdy kontener jest zatrzymany).

**Restart workera:** `cd /opt/serwerek/apps/polutek && docker compose restart encoder` (bieżące zadanie wraca do kolejki bez zużycia próby i kodowanie startuje od nowa). Aktualizacja: zwykły `./deploy.sh <tag>`.

**Rollback:** `./deploy.sh <tag> --rollback` przywraca poprzedni obraz aplikacji **i** workera (`.previous-worker-image`). Samo zatrzymanie kodowania: `docker compose stop encoder` (zadania czekają w `QUEUED`, nic się nie psuje). Migracja `VideoEncodeJob` jest addytywna i zostaje.

## 5. Panel admina

- **Nowy film** (`/admin/videos`, "Nowy film"): źródło to tylko "Wgraj plik wideo" albo "szkic bez pliku". Nie ma wyboru Mux/Stream/YouTube/Vimeo/URL ani UID. Po zapisie szkicu plik jedzie od razu (komponent `VideoPipelinePanel`).
- **Szczegóły filmu -> Media** (`/admin/videos/<id>?tab=media`): karta uploadu (wybór pliku, wstrzymaj/wznów/anuluj, procent, części, prędkość, ETA, checkbox "opublikuj automatycznie po zakodowaniu") i karta "Przetwarzanie" (stan, etap, procent, ETA, próby, przyczyna błędu, ostrzeżenie "worker nie odpowiada", "Anuluj kodowanie", "Zakoduj ponownie", lista wersji HLS z usuwaniem; wersji, która gra opublikowany film, nie da się usunąć).
- Trasy: `GET /api/admin/videos/<id>/pipeline`, `POST .../pipeline/encode`, `DELETE .../pipeline/jobs/<jobId>`, `DELETE .../pipeline/assets/<assetId>`; usunięcie filmu kasuje też jego obiekty w R2 (oryginały i HLS, best-effort po udanym usunięciu z bazy).
- Publikacja: bez zmian (blokady `VideoPolicy.getPublicationBlockers`); film jest publikowalny dopiero, gdy worker utworzył asset `SELF_HLS` READY i aktywną trasę. "Opublikuj po zakodowaniu" używa `Video.publishAfterAssetReady`.
- Napisy: pola `subtitleUrlPl/En` (adres WebVTT, tylko `https://` albo ścieżka `/...`) trafiają wyłącznie do grywalnego planu odtwarzania i do odtwarzacza (`<Track>` Vidstacka, przycisk napisów w kontrolkach). Host pliku `.vtt` musi być w CSP `connect-src` (np. przez `ALLOWED_MEDIA_HOSTS`). Stare wiersze dostawców (Mux/Stream/Vimeo/YouTube) w bazie są ignorowane (usunięcie: osobny PR czyszczący).

## 6. Włączenie na serwerze (kolejność)

1. Scal PR-y, `deploy.sh <tag>` (migracje `VideoEncodeJob` i `VideoOriginal.upload*`, obraz `worker`).
2. CORS bucketa oryginałów: `npx wrangler r2 bucket cors set polutek --file scripts/hls/originals-cors.json` (potrzebny token Cloudflare z uprawnieniem do R2).
3. Upewnij się, że token R2 ma odczyt i zapis na `polutek`, `polutek-hls` i bucketach miniatur; w `app.env` muszą być `CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS=polutek` i (opcjonalnie) `CLOUDFLARE_R2_BUCKET_HLS=polutek-hls`.
4. Na serwerze: `cd /opt/serwerek/apps/polutek && grep -E '^(DATABASE_URL|CLOUDFLARE_R2_|NEXT_PUBLIC_R2_PUBLIC_HOST)' app.env > worker.env && chmod 600 worker.env && mkdir -p /opt/serwerek/data/video-work && chown 1000:1000 /opt/serwerek/data/video-work`
5. `ENCODER_IMAGE=polutek-worker:<tag> docker compose up -d --no-deps encoder` (albo ponowny `./deploy.sh <tag>`), `docker compose logs -f encoder` ma pokazać `started`. `ai-log "enabled video encoder"`.
6. Test: nowy szkic, wgraj krótki plik, obserwuj Media -> Przetwarzanie.
7. Timer sprzątania uploadów: `cp deploy/serwerek/systemd/polutek-cron-abandon-stale-originals.timer /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now polutek-cron-abandon-stale-originals.timer`.

## 7. Limity i uwagi

- Maks. rozmiar uploadu 10 GiB (`VIDEO_UPLOAD_MAX_BYTES`, sufit 50 GiB). Dysk 75 GB: w trakcie zadania `oryginał + wynik` (do ok. 2-3× oryginału), po zadaniu kasowane; wynik HLS w R2 (nie na dysku serwera).
- Kodowanie: jedno naraz; czas dla 1080p i długich filmów na 2 vCPU niezmierzony (pilot: krótkie klipy 720p); strona zwalnia o ok. 25% w tym czasie (SERWEREK.md §14). `HLS_PRESET=medium` przyspiesza. Pamięć: wszystkie enkodery x264 działają w jednym procesie; przy pierwszym długim 1080p sprawdź szczyt RAM (`docker stats`) względem `mem_limit 1500m`.
- Poprzednie oryginały zostają w R2 (status SUPERSEDED) do ręcznego sprzątania albo usunięcia filmu; nieaktywne wersje HLS do ręcznego usunięcia w panelu.
- Znane braki: deploy przerywa trwające kodowanie (restart od zera, bez zużycia próby); napisy i wiele ścieżek audio wewnątrz HLS, trick play (I-frame, storyboard).

## 8. Przekodowanie istniejących filmów (nowa drabinka)

Stare wersje grają dalej (te same zasady dostarczania). Nowa drabinka (dolna rendycja 234p, pełny pion, HDR) obejmuje film dopiero po przekodowaniu: **Szczegóły filmu -> Media -> Przetwarzanie -> „Zakoduj ponownie”** (koduje aktywny oryginał do nowej wersji `v<N+1>`, po weryfikacji trasa przełącza się sama, odtwarzacze w trakcie grają starą wersję do końca tokenu). Filmy po kolei (jedno kodowanie naraz). Gdy wynik jest dobry, starą wersję można usunąć w tej samej karcie. Filmy wgrane jeszcze ręcznie (bez wiersza `VideoOriginal`) nie mają czego przekodować: trzeba w karcie uploadu wgrać plik źródłowy.
