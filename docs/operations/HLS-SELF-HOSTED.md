# Własny HLS: kodowanie, dostarczanie, wdrożenie i rollback (pilot 2026-10-02)

Decyzja i uzasadnienie: `docs/architecture/self-hosted-hls.md`. Badania: `docs/research/serwerek/01-hls-encoding.md`, `02-hls-delivery-cloudflare.md`.

Pilot: film `c52f0407-b0e8-4b5c-b6d3-a9f152653002` (slug `czesc`, tier PUBLIC). Poprzedni dostawca (Cloudflare Stream) zostaje jako natychmiastowy zapas.

## Co działa (stan 2026-10-02)

| Element | Stan |
|---|---|
| Bucket R2 `polutek-hls` (prywatny, `r2.dev` wyłączony) | utworzony, pilot wgrany: `videos/c52f0407-…/v/v1/` (3 rendycje 720/540/360, master, poster) |
| Worker `polutek-hls-edge` + domena `video.pawelperfect.com` (strefa `pawelperfect.com`) | wdrożony (plan Free), sprawdzony: 200 z tokenem, 403 bez/zły/wygasły, 206 dla Range, CORS dla `https://www.pawelperfect.com` |
| Sekret `HLS_TOKEN_SECRET` | w `%USERPROFILE%\.ai-secrets\secrets.env`, w Workerze i w `/opt/serwerek/apps/polutek/app.env` (kopia `app.env.bak-hls-20261002`); aplikacja NIE restartowana |
| Kod aplikacji (provider `SELF_HLS`, plan odtwarzania, fallback, CSP) | w PR; **nie wdrożony** |
| Wiersze w bazie (asset + route `SELF_HLS`) | **celowo nieutworzone**: starsza aplikacja nie zna nowej wartości enum i wywaliłaby się przy odczycie filmu. Tworzy je `activate-self-hls.sql` po deployu |

## Kodowanie (`scripts/hls/encode-hls.mjs`)

Bez zależności npm: Node >= 18 + ffmpeg/ffprobe (na serwerku: Node 22, ffmpeg 8.0.1).

```bash
nice -n 10 node encode-hls.mjs --input src.mp4 --out out-v1        # opcje: --preset slow --segment 6 --keyframe 2 --lufs -16 --max-height 1080 --dry-run
```

- H.264 High, capped CRF na rendycję (1080p CRF21/max 7,5 Mb/s, 720p 22/4,5, 540p 23/3, 360p 23/1,1), 8-bit 4:2:0, tylko SDR (HDR = błąd z komunikatem), bez upscalingu (rendycje <= wysokość źródła), stała liczba klatek (24 zostaje 24, NTSC dokładne).
- IDR co 2 s, GOP zamknięty, segmenty 6 s fMP4/CMAF, **wszystkie rendycje cięte w tych samych punktach** (sprawdzane).
- Audio zmiksowane do każdej rendycji (jedna ścieżka: mniej żądań niż osobne audio): AAC-LC 128k, loudnorm 2-przebiegowy do -16 LUFS / -1 dBTP.
- Master piszemy sami z zmierzonych rozmiarów segmentów: `BANDWIDTH` = szczyt, `AVERAGE-BANDWIDTH`, `RESOLUTION`, `FRAME-RATE`, `CODECS` z prawdziwego SPS; pierwszy wariant = najbliższy 2 Mb/s (start Apple).
- Na końcu samokontrola: playlisty VOD zamknięte, init, suma EXTINF = długość źródła, każdy segment zaczyna się od klatki kluczowej, te same granice segmentów. Wynik w `meta.json` (czasy, rozmiary, problemy). Kod wyjścia 1 przy problemach.
- Nie ma: playlist I-frame (trick play), napisów, wielu ścieżek audio, HDR (patrz pytania w dokumencie architektury).

**Pomiar (CPX22, 2 vCPU, `nice -n 10`, preset slow):** źródło 1280x720 24 fps 10 s -> 3 rendycje w **13,5 s** (720p 6,1 s, 540p 3,9 s, 360p 2,5 s, pomiar głośności ok. 1 s), szczyt RAM 460 MB, wynik 4,7 MB. To ok. 1,3x czasu rzeczywistego dla drabinki do 720p. Dla 1080p i długich filmów: niezmierzone (rząd 2-3x czasu rzeczywistego, przy kodowaniu strona zwalnia o ok. 25%, SERWEREK.md §14).

Źródło pilota: Cloudflare Stream trzyma oryginał tylko u siebie; pobrano jego `downloads/default.mp4` (720p, ok. 1,3 Mb/s, 24 fps, AAC). Oryginału w R2 nie było. **Dla nowych filmów zawsze zachowuj oryginał w R2 (`polutek`)**, bo kodowanie z już skompresowanego pliku traci jakość.

## Wgranie (`scripts/hls/upload-hls.sh`)

```bash
R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… bash upload-hls.sh out-v1 <videoId> v1
```

Wszystko oprócz `master.m3u8`, potem master (publikacja "na końcu"). Klucz: `videos/<videoId>/v/<wersja>/…`. Nowa wersja = nowy katalog (`v2`), nigdy nadpisywanie. rclone loguje przy pierwszej próbie `501 NotImplemented` z R2 i druga próba przechodzi (hałas, plik trafia).

## Dostarczanie (`workers/hls-edge`)

URL: `https://video.pawelperfect.com/h/<exp>.<sig>/<videoId>/<wersja>/<plik>`; `sig` = base64url(HMAC-SHA256(`HLS_TOKEN_SECRET`, `<videoId>/<wersja>/<exp>`)). Token obejmuje cały film w danej wersji (playlisty mają względne URI, więc hls.js i natywny Safari dziedziczą prefiks bez nagłówków i cookies). Token wydaje tylko `PlaybackService` po `checkVideoAccess()` i bramce premiery; TTL 6 h.

- Worker sprawdza token przy KAŻDYM żądaniu, zanim zajrzy do cache; cache edge ma klucz bez tokenu (jedna kopia dla wszystkich widzów). Segmenty i init: `public, max-age=31536000, immutable`; playlisty `max-age=300`.
- Dozwolone tylko rozszerzenia m3u8/m4s/mp4/ts/vtt/jpg/webp i ścieżki `[A-Za-z0-9_-]`; `meta.json` nie jest serwowany. CORS tylko dla `ALLOWED_ORIGINS` (`https://www.pawelperfect.com`, `https://pawelperfect.com`); metody GET/HEAD/OPTIONS; Range przez cache.
- To kontrola dostępu, nie DRM: zalogowany widz może skopiować URL na czas TTL i pobrać pliki.
- Wdrożenie / aktualizacja Workera (idempotentne): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `HLS_TOKEN_SECRET` w środowisku, potem `node workers/hls-edge/deploy.mjs`.
- **Plan Free: 100 000 żądań Workera na dobę** (każdy plik to żądanie, także z cache). Film 3 min = ok. 35 żądań na odtworzenie, czyli ok. 2,8 tys. odtworzeń na dobę. Po przekroczeniu Worker zwraca błąd, a odtwarzacz przełącza się na poprzedniego dostawcę (fallback). Powyżej limitu: Workers Paid 5 USD/mies. (decyzja właściciela, nic nie kupiono).

## Aplikacja

- Prisma: wartość `SELF_HLS` w enum `StorageProvider` (migracja `20261002140000_add_self_hls_storage_provider`, addytywna, bez BOM). `VideoAsset`: `provider=SELF_HLS`, `objectKey=videos/<videoId>/v/<wersja>`, `bucket=polutek-hls`.
- `PlaybackService`: po decyzji dostępu i bramce premiery asset `SELF_HLS` daje podpisany `master.m3u8` (`source.kind=self_hls`); odmowa nie ma żadnego URL (test). Gdy brak `HLS_TOKEN_SECRET` albo zły klucz obiektu, gra poprzedni dostawca.
- `source.fallback` = podpisany manifest poprzedniego dostawcy (Cloudflare Stream/Mux, READY); `VideoPlayer` przełącza się na niego **raz**, gdy własny HLS zgłosi błąd (ruch/limit Workera/awaria/zły token). Sesje i liczenie wyświetleń bez zmian (`sourceKind=self_hls`).
- CSP: `video.pawelperfect.com` (i host z `HLS_DELIVERY_BASE_URL`) w `connect-src`/`media-src`.
- Env: `HLS_TOKEN_SECRET` (>= 32 znaki, ten sam co w Workerze; rotacja = nowy sekret w Workerze i aplikacji naraz, aktywne tokeny wygasną), `HLS_DELIVERY_BASE_URL` (domyślnie `https://video.pawelperfect.com`).
- Admin: panel źródeł i karta aktywnej trasy pokazują "Własny HLS".

## Wdrożenie pilota (robi główna sesja, po scaleniu PR)

```bash
# 1. deploy aplikacji (migracja enum wykona się w deploy.sh; pg_dump przed migracją jest automatyczny)
cd /opt/serwerek/apps/polutek && rm -rf src && mkdir src && (git archive <commit> | tar -x -C src) && ./deploy.sh <tag>

# 2. skrypty SQL na serwer
scp scripts/hls/{activate,rollback}-self-hls.sql serwerek:/opt/serwerek/data/hls-work/

# 3. próba na sucho (transakcja wycofana), potem prawdziwa aktywacja
ssh serwerek 'cd /opt/serwerek/data/hls-work && docker exec -i polutek-db-1 sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -v ON_ERROR_STOP=1 -v video_id=c52f0407-b0e8-4b5c-b6d3-a9f152653002 -v version=v1" < activate-self-hls.sql'
ssh serwerek 'ai-log "HLS pilot: activated SELF_HLS route for video c52f0407 (activate-self-hls.sql)"'
```

(`activate-self-hls.sql` kończy się `COMMIT;`; na sucho zamień go na `ROLLBACK;` w kopii.) Sprawdzenie: otwórz film `czesc` na `www.pawelperfect.com`, w DevTools/Network żądania idą do `video.pawelperfect.com/h/…`; panel admina `/admin/videos/<id>` pokazuje aktywną trasę "Własny HLS".

## Rollback

- **Natychmiastowy, jednego filmu (sekundy, bez deployu):**
  ```bash
  ssh serwerek 'cd /opt/serwerek/data/hls-work && docker exec -i polutek-db-1 sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -v ON_ERROR_STOP=1 -v video_id=c52f0407-b0e8-4b5c-b6d3-a9f152653002" < rollback-self-hls.sql'
  ```
  Aktywna trasa wraca na Cloudflare Stream. Plany odtwarzania są budowane przy każdym żądaniu, więc zmiana działa od razu (ewentualnie zamknięte karty dostają plan z poprzedniej trasy do wygaśnięcia, co jest nieszkodliwe).
- **Bez dotykania bazy:** usuń `HLS_TOKEN_SECRET` z `app.env` i `docker compose up -d --no-deps app`: aplikacja gra poprzedniego dostawcę dla wszystkich filmów. Albo wyłącz Workera (Cloudflare Dashboard -> Workers -> `polutek-hls-edge` -> usuń domenę): odtwarzacz przełączy się na fallback po błędzie.
- **Aplikacja:** `./deploy.sh <tag> --rollback`. Migracja enum jest addytywna i zostaje; stare wiersze `SELF_HLS` w bazie wywaliłyby starszy kod, więc przed rollbackiem kodu najpierw `rollback-self-hls.sql` i `DELETE` wierszy `SELF_HLS` (asset i trasa).

## Utrzymanie

- Nowy film: zakoduj -> `upload-hls.sh` -> wstaw `VideoAsset`/`VideoPlaybackRoute` (`activate-self-hls.sql` z innym `video_id`). Nie ma jeszcze automatycznej kolejki ani przycisku w adminie (pytanie otwarte).
- Sprzątanie starych wersji z R2 ręcznie po okresie karencji.
- Logi Workera: Cloudflare Dashboard (observability włączone).
