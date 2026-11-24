# Wdrożenie utwardzonego pipeline'u wideo (K13–K22, K35)

Dotyczy gałęzi `feat/video-pipeline-hardening`: izolacja prób kodowania (`attemptId`), nowe prefiksy HLS
`videos/<id>/v/v<N>/attempts/<uuid>/` i wersje URL `v<N>~<uuid>`, rezerwacja sprzątania HLS, idempotentne
`complete`/`abort` uploadu, wznawianie w Studio. Dwie migracje z triggerami:
`20261106120000_encode_attempt_isolation` (K16) i `20261106160000_video_asset_cleanup_reservation` (K19).
Audyt: AUDYT-2-WIDEO-MIGRACJE (U1–U10). Opis pipeline'u: `VIDEO-PIPELINE.md`, dostarczanie: `HLS-SELF-HOSTED.md`.

## 0. Warunki wstępne

- Zielone CI PR-a (static, unit, postgres) oraz ręcznie uruchomiony job `heavy` (ffmpeg, Chromium, test K01).
- Próba migracji na kopii bazy (§6) zakończona bez błędów, łącznie z próbą cofnięcia.
- Testy ręczne na osobnym buckecie R2 (§5) zaliczone.
- `app.env`: dopisać jawnie `CLOUDFLARE_R2_BUCKET_HLS=polutek-hls` (kasowanie HLS robi teraz cron aplikacji).
  `VIDEO_WORKER_TEST_S3_ENDPOINT` nie może występować w żadnym `*.env` (`grep -l VIDEO_WORKER_TEST *.env` = pusto).
- Zapisane `cat .current-image .current-worker-image` (do cofnięcia) i świeża kopia `/opt/serwerek/scripts/backup.sh`.

## 1. Kolejność (nie zmieniać)

1. **Worker Cloudflare `hls-edge` NAJPIERW** (`node workers/hls-edge/deploy.mjs`, token CF z uprawnieniem Workers).
   Jest zgodny wstecz: stara wersja `v<N>` mapuje się na stary prefiks, ten sam podpis. Może iść kilka dni wcześniej.
   Sprawdzenie: istniejący film gra; ręcznie podpisany URL z wersją `v1~<uuid>` daje 404 z R2 (po przejściu parsera),
   a nie odrzucenie parsera. Bez tego kroku filmy zakodowane nowym kodem dadzą 404.
2. **Okno serwisowe encodera + migracje + aplikacja** (jeden `deploy.sh`, §2).
3. **Panel admina** (`deploy-admin.sh`): zawiera nowe akcje sprzątania HLS (rezerwacja + job `VIDEO_ASSET_CLEANUP`)
   i walidację kontraktów w panelu kodowania. Do czasu jego wdrożenia stary panel kasuje HLS po staremu.
4. Testy po wdrożeniu (§5, część „produkcja").

## 2. Okno serwisowe (ok. 10–15 min, encoder stoi 2–3 min)

```bash
cd /opt/serwerek/apps/polutek; set -a; . ./db.env; set +a
q() { docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"; }
q "SELECT status, count(*) FROM \"VideoEncodeJob\" GROUP BY 1;"        # oczekiwane: RUNNING = 0
q "SELECT id,status,stage,\"workerId\",\"heartbeatAt\" FROM \"VideoEncodeJob\" WHERE status IN ('QUEUED','RUNNING');"
# RUNNING > 0: poczekać na koniec kodowania (najlepiej). Uploady twórców na czas okna wstrzymać (komunikat).
docker compose stop encoder                                           # stop_grace_period 60 s, job wraca do QUEUED
q "SELECT count(*) FROM \"VideoEncodeJob\" WHERE status='RUNNING';"  # musi być 0; QUEUED mogą zostać
/opt/serwerek/scripts/backup.sh                                       # kopia bazy, musi się udać
# źródła do src/ jak w procedurze z CLAUDE.md serwera, potem:
./deploy.sh <sha>r1                                                   # dump, migracje (<1 s), app, health, nowy encoder
docker compose logs --tail=50 encoder   # brak "requires attemptId"; przy QUEUED: "job claimed" z attemptId
```

## 3. Kontrole SQL (tylko odczyt)

```sql
SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 3;
SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
  ('VideoEncodeJob_require_attempt_id_on_claim','VideoPlaybackRoute_reject_cleanup_reserved_asset');
SELECT status, count(*), count("attemptId") AS z_attempt FROM "VideoEncodeJob" GROUP BY 1;
SELECT count(*) FILTER (WHERE "objectKey" LIKE '%/attempts/%') AS proby,
       count(*) FILTER (WHERE "cleanupPendingAt" IS NOT NULL) AS w_sprzataniu FROM "VideoAsset";
SELECT status, count(*) FROM "VideoPlaybackRoute" GROUP BY 1;
SELECT status, attempts, "lastError" FROM "DurableJob" WHERE kind = 'VIDEO_ASSET_CLEANUP' ORDER BY "createdAt" DESC LIMIT 10;
-- asset READY bez trasy (wyciek po nieznanym wyniku aktywacji, U5; do ręcznej oceny):
SELECT a.id, a."objectKey", a."createdAt" FROM "VideoAsset" a
 WHERE a.provider='SELF_HLS' AND a."processingState"='READY'
   AND NOT EXISTS (SELECT 1 FROM "VideoPlaybackRoute" r WHERE r."assetId"=a.id);
```
(Nazwy kolumn `DurableJob` sprawdzić `\d "DurableJob"`; zapytania uruchamiać w `BEGIN TRANSACTION READ ONLY; … ROLLBACK;`.)

## 4. Cofnięcie

- **Przed pierwszym nowym kodowaniem** (brak assetów z `/attempts/`):
  1. `DROP TRIGGER "VideoEncodeJob_require_attempt_id_on_claim" ON "VideoEncodeJob";` — **zanim** wróci stary
     encoder; inaczej stary encoder dostaje błąd 55000 przy każdym claimie i kodowanie stoi bez alertu (U1).
  2. `./deploy.sh --rollback` (aplikacja i encoder na poprzednie obrazy), panel admina analogicznie.
  3. Kolumny `attemptId`, `cleanupPendingAt` i trigger K19 mogą zostać (stary kod ich nie używa). Przed usunięciem
     `cleanupPendingAt` sprawdzić, że nie ma rezerwacji ani jobów `VIDEO_ASSET_CLEANUP` (§3): stary kod ich nie obsłuży.
  4. Worker CF zostaje nowy (zgodny wstecz).
- **Po pierwszym nowym kodowaniu**: stara aplikacja nie zbuduje URL-a dla kluczy `…/attempts/…` (filmy przestaną grać)
  i nie skasuje ich wyniku (`ASSET_KEY_INVALID`). Preferowana **naprawa do przodu** (poprawka + nowy tag).
  Jeśli rollback jest konieczny: najpierw przekodować dotknięte filmy starym kodem albo zaakceptować ich niedostępność.
- Pełne cofnięcie schematu (tylko po próbie na kopii, §6): SQL z AUDYT-2 §3.1–3.2 i usunięcie wierszy z `_prisma_migrations`.

## 5. Testy ręczne

Przed produkcją, na **osobnym buckecie R2** (np. `polutek-staging-originals` / `polutek-staging-hls`, osobny token
z dostępem tylko do nich, CORS z `scripts/hls/originals-cors.json`), lokalnie albo na kopii stosu:
1. Upload z przeglądarki (Studio) pliku > 1 część: ETag w CORS, `complete`, wiersz READY, job QUEUED.
2. Przerwanie karty w połowie i wznowienie: wysyłane tylko brakujące części; druga karta z tym samym plikiem.
3. `complete` z utraconą odpowiedzią (ponowienie): ten sam job, bez drugiego wiersza.
4. Upload w trakcie kodowania innego pliku: 409 `ENCODE_ALREADY_ACTIVE`, multipart nadal otwarty, ponowienie po końcu działa (U4).
5. `deletePrefix` na prawdziwym R2 z `Quiet:false`: czy R2 zwraca `Deleted` dla każdego klucza i dla nieistniejącego
   (jeśli nie, kod zgłosi „no result" i sprzątanie stanie: wtedy poprawka przed produkcją).
6. Obraz `polutek-worker`: `docker run --rm --entrypoint ffmpeg <obraz> -filters | grep -E "zscale|tonemap"`;
   jedno kodowanie krótkiego pliku (także HDR z telefonu) do bucketu testowego.

Na produkcji po wdrożeniu:
1. Stare filmy (wszystkie 5) grają: URL z wersją `v<N>` bez `~`.
2. Jedno kodowanie testowe na filmie testowym (szkic): asset z kluczem `…/attempts/<uuid>`, odtwarzanie przez
   `video.pawelperfect.com` z wersją `v<N>~<uuid>` (telefon + komputer), plakat i czas trwania ustawione.
3. Usunięcie wyniku testowego w panelu: asset dostaje `cleanupPendingAt`, job `VIDEO_ASSET_CLEANUP` DONE po
   najbliższym przebiegu crona (`polutek-cron-premiere-notifications.timer`), prefiks w R2 pusty, wiersz usunięty.
4. Usunięcie starej wersji `v<N>`, gdy istnieje nowsza próba pod `v<N>/attempts/…`: próba zostaje i gra (U3).
5. Logi: `docker compose logs encoder app | grep -iE "attemptId|cleanup|55000"` bez niespodzianek.

## 6. Próba migracji na kopii bazy (osobne zadanie)

Polecenia: AUDYT-2 §3.5 (kontener `postgres:17-alpine` na 127.0.0.1, `pg_restore` dumpu produkcji, migracje z tej
gałęzi przez `psql -v ON_ERROR_STOP=1`, potem symulacja starego claimu). Oczekiwane po poprawce U2:
oba `UPDATE … SET status='RUNNING'` (bez `attemptId` i z niezmienionym starym `attemptId`) kończą się błędem 55000.
Potem próba cofnięcia (§4) i ponowne migracje. Na koniec `docker rm -f` kontenera i usunięcie dumpu.
