# Miniatury filmów (Cloudflare R2)

Stan 2026-10-05. Kod: `lib/modules/media/domain/r2-thumbnail.ts`, `lib/modules/media/infrastructure/r2-thumbnail-storage.client.ts`, `lib/modules/video/application/sync-public-thumbnail.service.ts`.
Operacje (cron, buckety): `../operations/SERWEREK.md`.

## Dwa buckety

- **Prywatny** (`CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE`, `polutek-thumbnails-private`): każdy upload administratora (okładka filmu, domyślna miniatura), także szkiców, pod kluczem z hashem treści
  (`videos/<videoId|new>/covers/<sha256>.<ext>`). `Video.thumbnailUrl` i ustawienie `default_video_thumbnail` trzymają adres S3 obiektu (`https://<konto>.r2.cloudflarestorage.com/<bucket>/<klucz>`):
  bezwzględny, ale czytelny tylko z poświadczeniami. `ThumbnailResponseService` strumieniuje go uwierzytelnionym `GetObject`, nigdy zwykłym `fetch`. **Ten bucket nigdy nie dostaje publicznego dostępu.**
- **Publiczny** (`CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC`, `polutek-thumbnails`, host `NEXT_PUBLIC_R2_PUBLIC_HOST`): tylko kopie miniatur filmów `PUBLISHED`, ten sam klucz,
  `Cache-Control: public, max-age=31536000, immutable`. `Video.thumbnailPublicUrl` zapisuje kopię. Napisy do filmów leżą w tym samym buckecie pod `videos/<id>/subtitles/`
  (uzgadnianie miniatur pomija ten prefiks: zostaw tak).
- Poświadczenia R2 są wspólne z bucketem oryginałów (`CLOUDFLARE_R2_ACCOUNT_ID` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY`); token potrzebuje Object Read & Write na obu.

## Synchronizacja

`publishAdminVideo` kopiuje miniaturę do publicznego bucketa; `updateAdminVideo` (odpublikowanie lub nowa okładka), `archiveAdminVideo` i `deleteAdminVideo` usuwają kopię publiczną.
Przy usuwaniu kolumna w bazie jest czyszczona **przed** skasowaniem obiektu, więc nieudane usunięcie nie zostawia reklamowanego szkicu. Te haki nie rzucają wyjątków: nieudana synchronizacja zostawia film na proxy.
Cron `/api/cron/sync-public-thumbnails` (codziennie) uzgadnia wszystkie filmy i kasuje publiczne obiekty, których żaden film nie reklamuje (starsze niż 1 h). Każda zmiana statusu wychodząca z `PUBLISHED`
musi przejść przez jeden z tych use case'ów albo wołać `syncPublicThumbnail()`.

## Niezmiennik (incydent 2026-09-30)

**`Video.thumbnailUrl` trzyma wyłącznie wartość magazynową** (prywatny adres R2, adres Blob, adres zewnętrzny, `/logo.png`), nigdy *pochodnego* adresu: ścieżki proxy `/api/videos/<id>/thumbnail` ani adresu z `NEXT_PUBLIC_R2_PUBLIC_HOST`.
Formularz edycji kiedyś zapisał z powrotem publiczny adres, synchronizacja nie znalazła klucza prywatnego, wyczyściła `thumbnailPublicUrl` i skasowała publiczny obiekt. Zabezpieczenia: `isDerivedThumbnailUrl()` (`r2-thumbnail.ts`)
odrzuca takie wartości w `updateAdminVideo`, `VideoRepository.updateForMainChannel` i `createAdminVideo` (wraca `/logo.png`); `syncPublicThumbnail` pomija (loguje błąd, nic nie kasuje) wiersz z publicznym adresem w `thumbnailUrl`.
Publiczne obiekty nie są kasowane, dopóki ktoś się do nich odwołuje (`deletePublicCopyIfUnreferenced`, `reconcilePublicThumbnails`); cron raportuje `orphansKeptReferenced` i `publicUrlInThumbnailUrl`, a `?dryRun=1` pokazuje plan bez zapisu.

## DTO i proxy

- Publiczne DTO (`toPublicVideoDto`, `VideoContentService.mapToPublicVideoDTO`, układ sidebara) używają `resolvePublicThumbnailSrc()`: publiczny adres R2 tylko dla filmu `PUBLISHED`, którego klucz w `thumbnailPublicUrl` zgadza się z bieżącym prywatnym;
  inaczej `/api/videos/[id]/thumbnail`. **Nigdy nie wstawiaj prywatnego adresu magazynu do publicznego DTO.**
- `/api/videos/[id]/thumbnail` strumieniuje źródło po stronie serwera i sam egzekwuje politykę: opublikowane filmy są publiczne, szkice tylko dla administratora. Trasa jest **publiczna** w `middleware.ts`: nie usuwaj jej z `isPublicRoute`.
  Miniatury opublikowanych filmów przez proxy są cache'owalne (`PUBLIC_THUMBNAIL_CACHE_CONTROL`); szkice zawsze `PRIVATE_THUMBNAIL_CACHE_CONTROL`. `resolveVideoThumbnailUrl()` zwraca surowy adres do strumieniowania po stronie serwera, nigdy ścieżkę proxy.
- Łańcuch domyślny: `Creator.defaultThumbnailUrl` → `default_video_thumbnail` (`AppSetting`) → `null`, zawsze przez proxy. Oba ustawia się w panelu (Ustawienia → Kanał).
- Uploady spadają na Vercel Blob, gdy brak zmiennych R2; adresy Blob działają przez proxy jak dawniej. `scripts/migrate-thumbnails-to-r2.ts` (`npm run media:migrate-thumbnails-r2`, domyślnie próba na sucho, `--apply`,
  `--rollback=<dziennik.json>`) kopiuje miniatury Blob do R2 i przepina bazę; nigdy nie kasuje obiektów Blob. Stan: jedna miniatura (`dla-patronow`) bywa jeszcze na Blob (`STATUS.md`).
