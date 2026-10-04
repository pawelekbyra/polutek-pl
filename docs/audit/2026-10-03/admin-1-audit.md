# Ścieżka 1/3: pełny audyt obecnego panelu administratora pawelperfect.com

Data: 2026-10-04. Kod: `origin/main` = `355fbf36` (po #1614 usunięcie dostawców wideo, #1636 e-maile, #1637 płatności, #1638 auth).
Metoda: przeczytane w całości wszystkie pliki `app/admin/**` (69 plików), wszystkie 48 plików tras `app/api/admin/**` (63 handlery), `middleware.ts`, `lib/auth-utils.ts`, `lib/api/{auth,csrf,admin-rate-limit,admin-body,admin-schemas}.ts`, `lib/admin/*`, a w `lib/modules/**` każdy use case wołany przez panel (video, video-pipeline, comments, users, payments, email, notifications, channel, audit, admin-stats). Do tego kontrola tylko do odczytu na serwerze (`systemctl list-timers`, `docker ps`, długości zmiennych env bez wartości, `SELECT count(*)` w Postgresie).
Punkt odniesienia: poprzedni audyt `docs/audit/2026-10-03/audit-feat-admin.md` (stan `88c787d0`). Każde znalezisko poniżej sprawdziłem ponownie w aktualnym kodzie; co zostało naprawione, zaznaczam.

Fakty z produkcji (2026-10-04, tylko odczyt):
- 4 konta `ADMIN`, **0 z włączonym 2FA**, 35 użytkowników, 4 filmy, 19 komentarzy, 147 płatności.
- `AuditLog` z `actorType='admin'`: 25 wierszy, **0 z IP**, 4 z `requestId`.
- `ADMIN_EMAILS` ustawione na pusty ciąg (bootstrap wyłączony, dobrze). `BLOB_READ_WRITE_TOKEN` nadal ustawiony (fallback na Vercel Blob żyje). Rate limit działa na lokalnym Redisie (`polutek-redis-1` + `srh`, `KV_REST_API_URL`).
- 7 timerów systemd `polutek-cron@*` działa (send-broadcasts co minutę, stripe-reconciliation co 15 min, reszta dziennie). **Panel nie pokazuje żadnego z nich.**

---

## 1. Podsumowanie i ocena

**Ocena: 5/10** (bez zmian względem 2026-10-03; część błędów naprawiono, część nowych wyszła przy głębszym czytaniu).

Mocne strony (do zachowania):
- **Bezpieczeństwo tras jest jednolite.** Wszystkie 63 handlery wołają `requireAdminForApi`, który sprawdza rolę w bazie przy każdym żądaniu (`auth({ fresh: true })` omija cache ciasteczka). CSRF i limity są centralnie w `middleware.ts`.
- **Logika domenowa jest w modułach `lib/modules/**`**, prawie każda trasa to 15-40 linii: parsowanie, use case, odpowiedź. To da się przenieść do nowej aplikacji.
- **Pipeline wideo** (upload multipart do R2, kolejka `VideoEncodeJob`, worker, anulowanie, ponowne kodowanie, wersje HLS) jest najlepszą częścią panelu: przemyślany, odporny na utratę zadania, z czytelnym UI (`VideoPipelinePanel`, `PipelineStatusCard`).
- **Poczta po #1636** jest dobra: kolejka rozsyłek, klucz idempotencji (`requestKey`), test tylko na adres admina, anulowanie, postęp.
- **Zwrot** ma od #1637 klucz idempotencji Stripe (`admin-refund.use-case.ts:89`).

Słabe strony (decydują o przebudowie):
1. **Trzy główne listy (filmy, użytkownicy, wpłaty) mają zepsutą paginację** i strzelają zapytaniem przy każdym znaku w wyszukiwarce. W liście filmów każda zmiana strony dodatkowo resetuje widok do „pierwszego ładowania”.
2. **Strona „Układ kanału” nie działa**: „USTAW HERO” niczego nie zapisuje (a pokazuje sukces), kolejność jest odwrócona względem serwisu, widać najwyżej 20 filmów.
3. **Formularz edycji nie pozwala cofnąć do szkicu ani zarchiwizować filmu, który jest w sidebarze** (nowe znalezisko): serwer odrzuca zapis, bo formularz odsyła `showInSidebar: true`.
4. **Panel jest „ślepy”**: pulpit `/admin` to 7 kafelków bez żadnej liczby; zakładka „Komentarze” filmu zawsze pusta, „Sesje wideo” zawsze 0, odznaka „Wymaga uwagi” nigdy się nie pokazuje, statystyki listy filmów nigdy nie przychodzą. Brak widoku zdrowia systemu, kolejki kodowania, cronów, webhooków, dziennika audytu.
5. **Konta admina bez 2FA** (0/4), sesja 30 dni przesuwana, ten sam origin i ciasteczko co serwis publiczny, brak ponownego uwierzytelnienia przed zwrotem, rozsyłką czy usunięciem filmu.
6. **Każda strona to osobny ekran z publicznym `Navbar`**, 16 stron ma 15 różnych układów, mieszany PL/EN, teksty 8-10 px, **podwójne szkielety** na 6 trasach i szkielet zamiast formularza w trakcie zapisu.
7. **Trzy różne ścieżki zapisu filmu i dwa formularze edycji**, jeden z luźnym schematem (`adminLooseObjectSchema`).

Liczba znalezisk: **38** (P0: 0, **P1: 5**, P2: 19, P3: 14). Szczegóły w §8.

---

## 2. Inwentarz

### 2.1 Strony `app/admin/**` (16 stron)

Ochrona wspólna: `middleware.ts:156-168` (optymistycznie: jest ciasteczko sesji, inaczej redirect `/?signin=1&next=…`), potem `app/admin/layout.tsx:10` (`requireAdmin()` w bazie, inaczej `redirect("/")`). Strony klienckie pobierają dane z `/api/admin/*`, które same sprawdzają admina.

| Ścieżka | Typ | Cel / co pokazuje | Akcje | Dane z | Link w nawigacji | Ładowanie | Własny pasek |
|---|---|---|---|---|---|---|---|
| `/admin` | server (statyczna) | 7 kafelków sekcji, zero danych | tylko linki | brak (`/api/admin/stats` istnieje, nieużywane) | `UserMenu.tsx:94-100` „Zarządzaj kanałem”, `AccountModal.tsx:81` | `loading.tsx` → `AdminHomeSkeleton` | publiczny `Navbar` |
| `/admin/videos` | client | tabela filmów, filtry, inline tworzenie i edycja, upload przy tworzeniu | utwórz, edytuj (inline), duplikuj, usuń (dialog), podgląd, kopiuj link | `GET/POST/DELETE /api/admin/videos`, `PATCH /videos/[id]` | kafelek `/admin` | `loading.tsx` + `AdminTableSkeleton` w tabeli | `AdminLayoutShell` (= `Navbar`) |
| `/admin/videos/[id]` | client | 8 zakładek: podsumowanie z odtwarzaczem, treść, media (pipeline), dostęp, diagnostyka, komentarze, statystyki, historia | publikuj, cofnij, archiwizuj, przywróć, Hero, sidebar on/off i pozycja, upload, kodowanie, usuń wersję, ukryj/przywróć/usuń komentarz | `GET /videos/[id]`, `POST/PATCH /videos/[id]/actions`, pipeline | link z tabeli | `loading.tsx` + `AdminVideoDetailsSkeleton` w stronie (podwójny) | `Navbar` |
| `/admin/videos/[id]/edit` | client | kanoniczny formularz edycji (metadane, premiera, cel zbiórki, miniatura) | zapisz, anuluj | `GET /videos/[id]`, zapis przez `POST /api/admin/videos` z `id` | ze szczegółów | brak `loading.tsx`, `AdminFormSkeleton` przy ładowaniu **i przy zapisie** | `AdminLayoutShell` |
| `/admin/videos/layout` | client | kolejność sidebaru, Hero, widoczność | strzałki, „USTAW HERO”, oko, zapisz | `GET /videos?pageSize=100…`, `POST /videos/reorder` | tylko przycisk w nagłówku listy filmów i w szczegółach | `loading.tsx` + skeleton w stronie (podwójny) | `Navbar` |
| `/admin/users` | client | lista użytkowników, 4 kafelki, filtry, CSV | nadaj/cofnij znacznik wspierającego (dialog z powodem), „Wyślij wiadomość” (martwy) | `GET /users`, `/users/stats`, `/users/export` | kafelek | `loading.tsx` + skeleton w stronie (podwójny) | `Navbar` |
| `/admin/users/[userId]` | client | profil, suma wpłat, zakładki: podsumowanie, wpłaty, granty, aktywność, historia zmian | nadaj/cofnij znacznik, „Zobacz w Stripe” | `GET /users/[id]` | link z listy i z wpłat | podwójny skeleton | `Navbar` |
| `/admin/users/dashboard` | client | 4 kafelki + sumy per waluta | brak | `GET /users/stats` | tylko karta na `/admin/users` | podwójny skeleton | `Navbar` |
| `/admin/users/payments` | client | lista płatności, podsumowanie, filtry | zwrot (dialog z kwotą), synchronizacja sporu | `GET /payments`, `POST /payments/[id]/{refund,dispute-sync}` | tylko karta na `/admin/users` | podwójny skeleton | `Navbar` |
| `/admin/comments` | client | lista komentarzy, wyszukiwanie z debounce, licznik zgłoszeń | wstrzymaj, ukryj, zatwierdź, przywróć, usuń, akcje zbiorcze (ukryj/usuń do 50) | `GET /comments`, `/comments/reports?status=PENDING`, `POST /comments/[id]/*` | kafelek | `loading.tsx` + wiersze `<Skeleton>` | `Navbar` |
| `/admin/comments/reports` | client | oczekujące zgłoszenia | odrzuć, ukryj (+rozwiąż), wstrzymaj (+rozwiąż) | `GET /comments/reports`, `POST …/resolve`, `…/hide`, `…/hold` | link z komentarzy | `loading.tsx` + wiersze `<Skeleton>` | `Navbar` |
| `/admin/emails` | client | zakładki: szablony, nowa rozsyłka (kreator), historia | edycja/przywrócenie szablonu, test, wyślij (dialog), anuluj | `/templates`, `/emails/broadcast*` | kafelek | `loading.tsx` (header+tabela) + spinner/pulse w zakładkach | `Navbar` |
| `/admin/notifications` | client | kafelki „ostatnie 50”, formularz rozsyłki, szablony, lista | wyślij (dialog), zapisz/przywróć szablon | `/notifications*` | kafelek | `loading.tsx` + `<Skeleton>` | `Navbar` |
| `/admin/channel` | **server** (własne `requireAdmin`) | nazwa, opis, banner (URL), domyślna miniatura (URL), licznik subskrybentów | zapisz, resync licznika | `getAdminChannelSettings` bezpośrednio, `PATCH /channel`, `POST /subscribers/resync` | kafelek | `loading.tsx` → `AdminFormSkeleton` | `Navbar` |
| `/admin/settings` | client | domyślna miniatura wideo (upload) | wgraj, usuń (2 kliknięcia) | `/settings/media/default-video-thumbnail` (+`/proxy` jako `<img>`) | **tylko** link z `/admin/channel` | brak `loading.tsx`, spinner | **brak paska** |
| `/admin/payments` | **server** (bez własnego `requireAdmin`) | minimalna kwota napiwku per waluta | zapisz | `getPaymentCurrencyLimits()` bezpośrednio, `PATCH /payment-settings` | kafelek | `loading.tsx` → `AdminFormSkeleton` | `Navbar` |

Strony całkowicie osierocone: brak. Strony osiągalne tylko „okrężnie” (bez kafelka): `/admin/settings`, `/admin/videos/layout`, `/admin/users/dashboard`, `/admin/users/payments`. Wpłaty (finanse!) są schowane pod „Użytkownicy”.
Strona opisana w dokumentacji, a nieistniejąca: `/admin/videos/new` (CLAUDE.md §5).

### 2.2 Trasy `app/api/admin/**` (48 plików, 63 handlery)

Legenda: wszystkie mają `requireAdminForApi` (DB, `fresh`). CSRF: wszystkie metody mutujące, centralnie (`middleware.ts:161-164`). Limit: domyślnie 120/min odczyt i 120/min mutacje, ścisłe w kolumnie. `pAB(x)` = `parseAdminBody` + schemat `x` z `lib/api/admin-schemas.ts`. Audyt = zapis `recordAuditEvent*` w trasie lub use case.

| Trasa | Metody | Walidacja | Audyt | Limit | Wołający w UI |
|---|---|---|---|---|---|
| `channel` | GET, PATCH | PATCH: własny zod (`channelPatchSchema`) | PATCH tak | 120 | PATCH: `ChannelSettingsForm`; **GET: brak wołającego** (strona jest serwerowa) |
| `comments` | GET | query (`z.nativeEnum`, paginacja) | – | 120 | `/admin/comments` |
| `comments/[id]/approve`, `hold`, `hide`, `restore` | POST | brak ciała | tak (`moderate-comment-status`) | 120 | `/admin/comments`, `reports`, szczegóły filmu (hide/restore), publiczny `CommentItem.tsx` (hide/restore) |
| `comments/[id]/delete` | POST | pAB(`adminCommentDeleteSchema`, allowEmpty) | tak | 120 | `/admin/comments`, szczegóły filmu |
| `comments/[id]/heart` | POST | brak ciała | tak | 120 | **tylko publiczny** `CommentItem.tsx:141` |
| `comments/reports` | GET | query | – | 120 | `reports`, `comments` (licznik) |
| `comments/reports/[id]/resolve` | POST | pAB(`adminCommentReportResolveSchema`) | tak | 120 | `reports` |
| `emails/broadcast` | GET, POST | POST pAB(`adminBroadcastCreateSchema`, `requestKey` UUID) | POST tak | POST 3 | `BroadcastHistory`, `BroadcastWizard` |
| `emails/broadcast/[id]/cancel` | POST | brak ciała | tak | 120 | `BroadcastHistory` |
| `emails/broadcast/audience` | GET | – | – | 120 | `BroadcastWizard` |
| `emails/broadcast/test` | POST | pAB(`adminBroadcastTestSchema`) | tak | 5 | `BroadcastWizard` |
| `maintenance/main-channel/preview` | GET | – | – | 120 | **brak** |
| `maintenance/main-channel/apply` | POST | własny zod (fraza) | tak | 120 | **brak** |
| `notifications` | GET | – | – | 120 | `/admin/notifications` |
| `notifications/broadcast` | POST | pAB(`adminNotificationBroadcastSchema`) | tak (kontekst z sesji) | 3 | `NotificationBroadcastForm` |
| `notifications/templates` | GET, PUT, DELETE | PUT pAB, DELETE query | tak | 120 | `NotificationTemplatesEditor` |
| `payment-settings` | GET, PATCH | PATCH własny zod | tak | PATCH 10 | PATCH: `PaymentSettingsForm`; **GET: brak** |
| `payments` | GET | query (`orderDir` niewalidowane) | – | 120 | `/admin/users/payments` |
| `payments/[id]/refund` | POST | pAB(`adminPaymentRefundSchema`, allowEmpty = pełny zwrot) | tak | 5 | `/admin/users/payments` |
| `payments/[id]/dispute-sync` | POST | brak ciała | tak | 5 | `/admin/users/payments` |
| `settings/media/default-video-thumbnail` | GET, POST, DELETE | formData (MIME z nagłówka, 5 MB) | tak (POST/DELETE) | 120 | `/admin/settings` |
| `…/default-video-thumbnail/proxy` | GET | – | – | 120 | `<img>` w `/admin/settings` |
| `stats` | GET | – | – | 120 | **brak** (pulpit go nie używa) |
| `subscribers/resync` | POST | brak ciała | tak (Safe) | 120 | `ChannelSettingsForm` |
| `templates` | GET, POST, DELETE | POST pAB(`adminEmailTemplateSchema`) | tak | 120 | `TemplatesList`, `EmailTemplateEditor`, `BroadcastWizard` |
| `users` | GET | query (`orderDir` niewalidowane) | – | 120 | `/admin/users` |
| `users/[userId]` | GET | – | – | 120 | `/admin/users/[userId]` |
| `users/[userId]/patron` | PATCH | pAB(`adminPatronActionSchema`) + wymagany powód | tak | 10 | `UserPatronActions` |
| `users/export` | GET | query | tak (eksport audytowany, dobrze) | 120 | `/admin/users` (`window.open`) |
| `users/stats` | GET | – | – | 120 | `/admin/users`, `/admin/users/dashboard` |
| `videos` | GET, POST, DELETE | POST: ręczny guard + zod tylko dla `premiereAt`, `fundraisingGoal`, `fundraisingManualPercent`; DELETE query `id` | tak | 120 | lista, edycja (POST z `id`!), układ (GET) |
| `videos/[id]` | GET, PATCH | PATCH pAB(`adminVideoWriteSchema.passthrough()`) | tak | 120 | szczegóły, edycja (GET), `VideoStudio` (PATCH miniatury), zapis metadanych w trakcie uploadu, martwy `fetchVideoForEdit` |
| `videos/[id]/actions` | PATCH, POST | PATCH: **pAB(`adminLooseObjectSchema`)**, POST pAB(akcja) | tak | 120 | szczegóły (publish/unpublish/archive/restore/set-hero, PATCH sidebar i pozycja) |
| `videos/[id]/comments` | GET | query | – | 120 | **brak** (a zakładka „Komentarze” filmu go potrzebuje, ADM-06) |
| `videos/[id]/original-upload/multipart` | POST, GET, DELETE | POST pAB, GET/DELETE query | tak | POST/DELETE 20 | `lib/video-upload/multipart-uploader.ts` |
| `…/multipart/parts` | POST | pAB (max 50 części) | (presign, bez audytu, OK) | 120 | uploader |
| `…/multipart/complete` | POST | pAB | tak | 20 | uploader |
| `videos/[id]/pipeline` | GET | – | – | 120 | `useVideoPipeline` (polling 3 s / 15 s) |
| `videos/[id]/pipeline/encode` | POST | brak ciała | tak | 120 | `useVideoPipeline.reencode` |
| `videos/[id]/pipeline/jobs/[jobId]` | DELETE | – | tak | 120 | `useVideoPipeline.cancel` |
| `videos/[id]/pipeline/assets/[assetId]` | DELETE | – | tak | 120 | `useVideoPipeline.deleteAsset` |
| `videos/cover-upload` | POST | formData (MIME z nagłówka, bez magic bytes) | tak (Safe) | 120 | `CoverImageUpload` |
| `videos/r2-diagnostics` | GET | – | – | 120 | **brak** (komunikaty o „redeploy w Vercel”) |
| `videos/reorder` | POST | pAB(`adminVideoReorderSchema`, wycina `isMainFeatured`) | tak | 120 | `/admin/videos/layout` |
| `videos/resync` | POST | pAB | tak | 120 | **brak** |

Podsumowanie:
- **Handlery bez wywołującego: 8** (`channel` GET, `maintenance/*` ×2, `payment-settings` GET, `stats`, `videos/[id]/comments`, `videos/r2-diagnostics`, `videos/resync`).
- **Wywołania nieistniejących tras: brak.** Martwe wywołanie: `fetchVideoForEdit` (`useAdminVideos.ts:81-113`), bo `middleware.ts:190-196` przekierowuje `?edit=` na `/edit` zanim strona się wyrenderuje.
- **Trasy admina wołane z publicznego UI:** `comments/[id]/{hide,restore,heart}` z `CommentItem.tsx:113-141`. Przy przeniesieniu panelu na subdomenę trzeba zdecydować, czy moderacja „w miejscu” na stronie publicznej zostaje.
- Od poprzedniego audytu ubyło 13 tras dostawców (Mux/Stream, `emails/responses`, `emails/status`, `health/*`), co jest zgodne z #1614/#1636.

### 2.3 Rzeczy opisane w dokumentacji, których nie ma (albo są inne)

| Dokument | Twierdzenie | Kod |
|---|---|---|
| CLAUDE.md §5 tabela | `/admin/videos/new` „Create video” | strona nie istnieje, tworzenie inline na liście |
| CLAUDE.md §5 tabela | `/admin/settings` „Vercel Blob upload” | R2 prywatny z fallbackiem na Blob |
| CLAUDE.md §5 Etap 0 | „all 55 app/api/admin routes”, `/api/admin/health/clerk` | 48 plików / 63 handlery; `health/clerk` nie istnieje |
| CLAUDE.md §5 Etap 0 | limit „keyed by admin user id” | klucz = skrót ciasteczka sesji (`middleware.ts:134-140`) + IP |
| CLAUDE.md §5 Etap 0 | `AuditLog` przechowuje `ip`, `userAgent`, `requestId` | kolumny są; w produkcji 0/25 wierszy admina z IP, 4/25 z `requestId` |
| CLAUDE.md §5 decyzja | „Clerk-based admin works”, `ADMIN_CLERK_USER_IDS` | Better Auth + `ADMIN_EMAILS` (puste) |
| CLAUDE.md §4.16 | „Raw `fundraisingGoal*` keys are ignored” | prawda dla `PATCH /videos/[id]` i `POST /videos`; `PATCH /videos/[id]/actions` je zapisuje (ADM-08) |
| CLAUDE.md §0, §9 | „The executable coding queue is `docs/tickets/ready/`” | katalog nie istnieje (usunięty w #1632) |
| `lib/api/auth.ts:12-13` (komentarz) | „a demotion in /admin/users is undone” | w panelu w ogóle nie ma zmiany roli |
| `lib/admin/use-admin-list-query.ts` (komentarz) | hook używany przez „users, comments, reports, videos” | filmy i wpłaty mają własne implementacje |

---

## 3. Ocena funkcji (ścieżka wykonania każdej akcji mutującej)

Kolumny: **Działa?** / **Błąd widoczny dla admina?** / **Podwójne kliknięcie** / **Potwierdzenie** / **Odświeżenie po akcji**.

### 3.1 Filmy

| Akcja | Ścieżka | Działa? | Błąd widoczny | Podwójny klik | Potwierdzenie | Odświeżenie |
|---|---|---|---|---|---|---|
| Utwórz (inline) | `videos/page.tsx:155-237` → `POST /videos` → `createAdminVideo` (zawsze `DRAFT`) | tak | tak (`formError`), ale szczegóły zod niewidoczne (ADM-13) | przycisk zablokowany w trakcie; **po utworzeniu `formData.id` nie jest ustawiane**, więc główne przyciski formularza w trakcie uploadu tworzą drugi szkic albo kończą się błędem duplikatu sluga (ADM-11) | – | `fetchVideos(page)` |
| Upload oryginału + kodowanie | `VideoPipelinePanel` → `multipart-uploader.ts` (start → parts → PUT do R2 → complete) → `completeOriginalMultipart` → `VideoEncodeJob` → worker `encoder` | tak, wznawianie z `localStorage`, weryfikacja rozmiaru i magic bytes | tak | `begin` blokowany przez `phase` | – | polling 3 s / 15 s, `onChanged` |
| Anuluj kodowanie | `DELETE …/pipeline/jobs/[id]` → `requestCancel`; worker przerywa przy następnym heartbeacie i sprząta prefiks R2 | tak | tak | przycisk `disabled` gdy `cancelRequested` | **brak** (operacja odwracalna: „Zakoduj ponownie”) | `refresh()` |
| Zakoduj ponownie | `POST …/pipeline/encode` → `enqueueEncode` (idempotentne dla aktywnego zadania) | tak | tak | idempotentne | – | tak |
| Usuń wersję HLS | `DELETE …/assets/[id]` → `deleteSelfHlsAsset` (odmawia, gdy wersja gra opublikowany film) | tak; kolejność: R2 przed DB (przy błędzie DB zostaje wiersz bez plików, rzadkie) | tak | „Potwierdź usunięcie” (2 kliknięcia) | tak (2 kliknięcia) | tak |
| Publikuj | szczegóły `handleAction('publish')` → `publishAdminVideo` (blokady publikacji) | tak | tak, toast „Błąd: …” | brak `pending`, drugi klik idempotentny | brak (OK) | `fetchVideo()` |
| Cofnij publikację | `updateAdminVideo({status: DRAFT})` → czyści Hero i sidebar, usuwa publiczną miniaturę | tak | tak | – | **brak**, a zdejmuje film i Hero z serwisu (ADM-05) | tak |
| Archiwizuj | `archiveAdminVideo` | tak | tak | – | **brak** (`variant="destructive"`, ale bez pytania) | tak |
| Przywróć | `updateAdminVideo({status: DRAFT})` | tak | tak | – | – | tak |
| Ustaw Hero (szczegóły) | `set-hero` → `updateAdminVideo({isMainFeatured:true})` → `getHeroBlockers` (wymaga PUBLISHED + PUBLIC + gotowe HLS) → `clearHero` w transakcji | tak | tak (kod + komunikat) | – | brak (zmienia stronę główną) | tylko ta karta |
| Ustaw Hero (układ) | `layout/page.tsx:62-67` lokalnie → `POST /videos/reorder`, schemat wycina `isMainFeatured` | **nie**, toast sukcesu (ADM-02) | – | – | – | – |
| Kolejność sidebaru | `layout` → `reorderAdminVideos` | zapisuje, ale na odwróconej i uciętej do 20 liście (ADM-02) | ogólny toast „Wystąpił błąd”, bez powodu | `isSaving` | – | `fetchVideos()` |
| Sidebar on/off, pozycja (szczegóły) | `PATCH /actions` (luźny schemat) → `updateAdminVideo` | tak; dla szkicu odmowa z komunikatem | tak | – | – | tak |
| Edycja metadanych (`/edit`) | `POST /videos` z `id` → `buildAdminVideoUpdatePayload` → `updateAdminVideo` | tak, **poza** zmianą statusu filmu będącego w sidebarze (ADM-03) | tak, `readAdminApiError` | formularz chowany za szkieletem w trakcie zapisu | – | `router.push` + `refresh` |
| Premiera | `buildPublicationPayload` (klient) + `isAllowedPremiereChange` (serwer); szkic z „Premierą” publikowany przez `publishAdminVideo` po zapisie | tak; **nieatomowe**: gdy publikacja się nie uda, premiera i reszta pól są już zapisane, a admin widzi błąd (ADM-33) | tak | – | – | tak |
| Cel / pasek zbiórki | `FundraisingGoalCard` → `buildFundraisingPayload` → `fundraisingGoalUpdateFields` / `fundraisingManualPercent` | tak (tylko w `/edit`, inline edycja tego nie ma) | tak | – | – | tak |
| Miniatura | `CoverImageUpload` → `POST /videos/cover-upload` (R2 prywatny, fallback Blob) → zapis URL w formularzu lub `PATCH /videos/[id]` (`VideoStudio`) → `syncPublicThumbnail`, usunięcie starej okładki | tak; MIME z nagłówka bez magic bytes; wgrana i niezapisana okładka zostaje sierotą | tak | – | – | tak |
| Duplikuj | `videos/page.tsx:114-143` kopiuje pochodny `thumbnailUrl` z DTO, serwer go odrzuca → `/logo.png` | częściowo: kopia bez okładki (ADM-10) | nie | – | – | – |
| Usuń film | dialog → `DELETE /videos?id=` → `snapshotVideoStorage` → `deleteAdminVideo` (kaskada w DB) → `purgeVideoStorage` (R2) | tak; działające zadanie kodowania traci własność i samo sprząta | tak | `deletingVideoId` | **tak** (dialog) | `fetchVideos(page)` |

### 3.2 Użytkownicy i pieniądze

| Akcja | Ścieżka | Działa? | Błąd widoczny | Podwójny klik | Potwierdzenie | Odświeżenie |
|---|---|---|---|---|---|---|
| Nadaj / cofnij znacznik wspierającego | `UserPatronActions` (dialog + wymagany powód) → `PATCH /users/[id]/patron` → `grantPatron`/`revokePatron` (audyt) | tak | tak | `pendingRequestRef` | tak | szczegóły: `fetchUser`; **lista: `router.refresh()` nic nie robi** (ADM-12) |
| Eksport CSV | `window.open(GET /users/export)` → `exportAdminUsers` (audyt) | tak; escapowanie formuł niepełne (ADM-27) | nowa karta z JSON-em błędu | – | – | – |
| Zwrot | dialog z kwotą → `POST /payments/[id]/refund` → `adminRefund`: sprawdzenie statusu i kwoty → `stripe.refunds.create` z `idempotencyKey` → audyt → `handleRefund` (CAS) | tak | tak, ale angielskie komunikaty („Refund amount … is invalid”) | idempotencja Stripe | tak (dialog), **brak pola „powód”** w UI | `fetchPayments(page)` (wraca na str. 1, ADM-01) |
| Synchronizacja sporu | `POST /payments/[id]/dispute-sync` → `adminDisputeSync` | tak | tak | `loading` | dialog | tak |
| Ustawienia płatności | `PATCH /payment-settings` (min. kwota × 5 walut) | tak | tak | `status` | – | stan z odpowiedzi |

Brak w panelu: zmiana roli, zawieszenie/ban, usunięcie konta, wylogowanie sesji, wysyłka e-maila do jednej osoby, informacje o bezpieczeństwie konta (weryfikacja e-maila, 2FA, powiązanie Google, ostatnie logowanie, sesje). 4 konta admina da się zarządzać tylko w bazie.

### 3.3 Komentarze i zgłoszenia

| Akcja | Działa? | Błąd widoczny | Podwójny klik | Potwierdzenie | Odświeżenie |
|---|---|---|---|---|---|
| Wstrzymaj / ukryj / zatwierdź / przywróć (`/admin/comments`) | tak | tak, toast z `message` | spinner per wiersz | – | `fetchComments(page)` |
| Usuń pojedynczo | tak, **ostateczne** (komentarz w kodzie: „a deleted comment is final”) | tak | spinner | **brak** (ADM-05) | tak |
| Akcje zbiorcze (ukryj/usuń do 50) | tak, 50 równoległych POST-ów; trzecia akcja zbiorcza w minucie trafia w limit 120/min i częściowo pada (ADM-34) | licznik „x udanych, y błędów” | `isBulkPending` | **brak** dla „Usuń zaznaczone” | tak |
| Usuń komentarz w szczegółach filmu | martwe: lista komentarzy filmu nigdy się nie ładuje (ADM-06) | – | – | – | – |
| Zgłoszenia: odrzuć / ukryj / wstrzymaj | „ukryj” = 2 żądania (hide, potem resolve), nieatomowe; **każdy błąd tylko `logger.error`, bez toastu**; brak stanu `pending` | **nie** | dwa żądania | – | tylko przy sukcesie |
| Serduszko twórcy | tylko w publicznym UI | – | – | – | – |

### 3.4 Poczta, powiadomienia, kanał, ustawienia

| Akcja | Działa? | Uwagi |
|---|---|---|
| Szablony e-mail: zapis, przywrócenie domyślnego | tak | błąd usuwania szablonu własnego cichy (`TemplatesList.tsx` `handleDelete`, tylko `console.error`), brak potwierdzenia przy „przywróć domyślny” |
| Rozsyłka e-mail: test, wyślij, anuluj | tak, wzorcowo: `requestKey`, kolejka, timer co minutę na serwerze, postęp w historii co 5 s | historia bez paginacji (wszystkie rozsyłki), podgląd HTML bez faktycznej ramki e-maila |
| Powiadomienia: rozsyłka | tak technicznie, ale **dzwonek jest ukryty** (`Navbar.tsx:23`), więc nikt ich nie widzi; brak idempotencji (podwójny klik = 2 rozsyłki, limit 3/min); formularz nie ma pola `href`, choć API je przyjmuje | ADM-16 |
| Kanał: zapis | tak; błędy walidacji pokazują „Invalid data” zamiast polskiego komunikatu ze schematu | `displaySubscribersCount` zapisuje się, ale **żadna strona publiczna go nie wyświetla** (`app/[locale]/channel/[slug]/page.tsx:137-141` czyta go i ignoruje), czyli pole nic nie robi |
| Resync licznika subskrybentów | tak | – |
| Domyślna miniatura (upload/usuń) | tak, ale stary obiekt jest kasowany **przed** zapisem w DB (`default-video-thumbnail/route.ts:91-93`), a w fallbacku Blob przed wgraniem nowego (`:99-101`) | ADM-19 |

---

## 4. Dane, UX i szkielety

### 4.1 Skąd biorą się liczby

| Miejsce | Źródło | Definicja | Uwagi |
|---|---|---|---|
| `/admin` pulpit | – | – | **zero liczb**; gotowe `getAdminDashboardStats` (`/api/admin/stats`) nieużywane |
| `/admin/users` kafelki | `getAdminUsersStats` | `totalUsers` = wszyscy łącznie z usuniętymi; `patrons` = `patronGrant.findMany(distinct userId)` (ładuje wiersze zamiast `count`); „Wpłaty” = **liczba** płatności `SUCCEEDED` (bez `PARTIALLY_REFUNDED`), a nie kwota; „Komentarze” = `deletedAt null` | podpis sugeruje kwotę |
| `/admin/users/dashboard` | jw. + `UserPaymentTotal.groupBy(currency)` | sumy netto (pomniejszane przy zwrotach i sporach), brutto prowizji Stripe | **czwarta** definicja przychodu; strona pada (TypeError) przy błędzie API (`dashboard/page.tsx:58`) |
| `/admin/users/payments` podsumowanie | `getFinancialStats(where)` z `RECEIVED_STATUSES` | respektuje filtry | piąta definicja |
| `/api/admin/stats` (nieużywane) | `payment.groupBy` `SUCCEEDED` | brutto, bez częściowych zwrotów | – |
| Pasek zbiórki (publiczny) | `SUCCEEDED` + `PARTIALLY_REFUNDED` netto, kursy wyświetlania | – | spójne tylko samo ze sobą |
| Lista filmów: komentarze | `Video._count.comments` | **liczy też ukryte i usunięte** | – |
| Lista filmów: kafelki statystyk | `AdminVideoStats` | **nigdy się nie pokazują**: `getAdminVideoList` nie zwraca `stats` | – |
| Lista filmów: odznaka problemów | `diagnosticsIssuesCount` | **pole nie istnieje w DTO** (`toAdminVideoDto`), odznaka nigdy się nie pokazuje | – |
| Szczegóły filmu „Sesje wideo” | `video._count.playbackSessions` | **zawsze 0**: `findByIdForMainChannel` liczy tylko `comments` | – |
| Szczegóły filmu „Komentarze” | `video.comments` | **zawsze pusto**: DTO nie zawiera komentarzy, a trasa `videos/[id]/comments` nie ma wywołującego | licznik obok pokazuje N, lista „Brak komentarzy” |
| Diagnostyka filmu | `getAdminVideoDiagnostics` | dubluje komunikaty (FAILED dwa razy, blokady Hero powtarzają blokady publikacji) | – |
| `/admin/notifications` kafelki | ostatnie 50 rekordów | „Razem” = 50 przy każdym większym ruchu | ADM-16 |

Koszt zapytań: przy obecnej skali (35 użytkowników, 4 filmy, 147 płatności) każda strona to 2-7 prostych zapytań, bez problemu. Słabe miejsca na przyszłość: `findMany distinct` zamiast `count`, `include: { assets: true }` dla każdego filmu na liście, historia rozsyłek bez paginacji, brak jakiegokolwiek cache dla liczb pulpitu. Nic nie jest liczone „na sztywno”, ale pięć różnych definicji przychodu daje pięć różnych liczb.

### 4.2 Powłoki, nawigacja, organizacja

- **Brak powłoki panelu.** `app/admin/layout.tsx` sprawdza tylko admina i owija w `AdminVisualShell` (jedyna rola: inna klasa CSS dla `/admin/payments`). 14 z 16 stron renderuje publiczny `Navbar` (logo serwisu, przełącznik języka, menu użytkownika, logika PWA); `/admin/settings` nie ma żadnego paska; filmy używają `AdminLayoutShell` (to tylko `Navbar` + `<main>`).
- **Brak bocznej nawigacji i jednego miejsca na wszystkie sekcje.** Nawigacja = kafelki na `/admin` + okruszki `AdminNavigation` + przyciski „Wróć”. Cztery strony są dostępne tylko z wnętrza innych sekcji.
- **Dwa wzorce nagłówków** (karta „hero” i goły `<h1>`), szerokości kontenera od `max-w-4xl` do `max-w-7xl`, różne tła (`bg-muted/20`, gradienty).
- **Język mieszany:** surowe enumy (`PUBLISHED`, `PATRON (GRANT)`, `ADMIN`), „Archiv”, „Public”, „Login”, „Hero Video”, „Tier”, toast „Akcja publish wykonana pomyślnie.”, angielskie komunikaty z API („Invalid data”, „No file uploaded”, „Refund amount … is invalid”). Nazewnictwo z dawnego płatnego modelu: „Użytkownicy i Patroni… monitoruj aktywność finansową”, „Status Patronatu”, „Granty Patrona (Uprawnienia)”, zakładka „Dostęp”.

### 4.3 Tabele, filtry, paginacja, formularze, puste stany

- Tabele: shadcn `Table` (ma `overflow-x-auto`), więc nie łamią układu na telefonie, ale wymagają przewijania w poziomie (lista użytkowników ma 6 kolumn, filmów 7).
- Filtry: stan w `useState`, **nie w URL** (odświeżenie strony gubi filtry, nie da się wysłać linku). Filtry atrapy: „Wymaga uwagi”, „Niepubliczne” (`UNLISTED`). Komentarze nie mają filtra statusu (API go ma). Wpłaty pokazują domyślnie wszystkie statusy, w tym `PENDING`/`CANCELED` z porzuconych intencji.
- Paginacja: działa w komentarzach i zgłoszeniach; **zepsuta** w filmach, użytkownikach i wpłatach (ADM-01). Brak wyboru rozmiaru strony, brak sortowania rosnącego (`orderDir` ignorowane w filmach, w użytkownikach „E-mail (alfabetycznie)” sortuje Z→A).
- Formularze: ręczne `setFormData({...formData, x})`, brak współdzielonego schematu z serwerem, błędy pól nie wracają do pól (ADM-13). Formularz filmu (355 linii) obsługuje i tworzenie, i edycję, z warunkami `isCreate` w kilkunastu miejscach.
- Puste stany: jednolity wzór `py-20 text-center italic` w tabelach (dobry). Strona szczegółów filmu pokazuje fałszywe puste stany (komentarze).
- Kopiowanie linku: `alert()` (`VideoTable.tsx:25`).

### 4.4 Szkielety ładowania: lista WSZYSTKICH (właściciel chce zero)

`components/skeletons/admin.tsx` eksportuje 15 komponentów szkieletów. Użycie:

| Trasa | `loading.tsx` (route) | Szkielet w stronie (fetch po stronie klienta) | Efekt |
|---|---|---|---|
| `/admin` | `AdminHomeSkeleton` | – | 1 faza (strona statyczna, szkielet zbędny) |
| `/admin/videos` | `AdminVideosPageSkeleton` | `AdminTableSkeleton` (6×7) w `VideoTableWrapper` | **2 fazy** + nakładka „Odświeżanie listy…” |
| `/admin/videos/[id]` | `AdminVideoDetailsSkeleton` | ten sam w stronie | **2 fazy** |
| `/admin/videos/[id]/edit` | – | `AdminFormSkeleton` przy ładowaniu **i w trakcie zapisu** (formularz `hidden`) | migotanie formularza przy każdym zapisie |
| `/admin/videos` (edycja inline) | – | `AdminFormSkeleton` w trakcie zapisu | jw. |
| `/admin/videos/layout` | `AdminVideoLayoutSkeleton` | ten sam w stronie | **2 fazy** |
| `/admin/users` | `AdminUsersPageSkeleton` | ten sam w stronie | **2 fazy** |
| `/admin/users/[userId]` | `AdminUserDetailsSkeleton` | ten sam w stronie | **2 fazy** |
| `/admin/users/dashboard` | `AdminUsersDashboardSkeleton` | ten sam w stronie | **2 fazy** |
| `/admin/users/payments` | `AdminPaymentsPageSkeleton` | ten sam w stronie | **2 fazy** |
| `/admin/comments` | `AdminCommentsPageSkeleton` | 8 wierszy `<Skeleton>` przy każdym fetchu | 2 fazy + migotanie przy akcji i stronicowaniu |
| `/admin/comments/reports` | `AdminCommentReportsPageSkeleton` | wiersze `<Skeleton>` | 2 fazy |
| `/admin/notifications` | `AdminNotificationsPageSkeleton` | `<Skeleton>` w tabeli | 2 fazy |
| `/admin/emails` | `AdminPageHeaderSkeleton` + `AdminTableSkeleton` | spinner „Pobieranie szablonów…”, `animate-pulse` w historii, spinner w edytorze | 2 fazy |
| `/admin/channel` | `AdminFormSkeleton` | – (dane z serwera) | 1 faza, **jedyny wzorzec bliski docelowemu** |
| `/admin/payments` | `AdminFormSkeleton` | – (dane z serwera) | 1 faza, jw. |
| `/admin/settings` | – | spinner | – |

Wniosek: 13 `loading.tsx`, 6 tras z podwójnym szkieletem, 2 formularze zastępowane szkieletem w trakcie zapisu. Przyczyna jest jedna: dane pobierane w `useEffect` po stronie klienta. Wzorzec docelowy już istnieje w dwóch miejscach (`/admin/channel`, `/admin/payments`): Server Component czyta dane przez use case i oddaje gotowy HTML.

### 4.5 Responsywność i dostępność

- **Telefon:** panel da się otworzyć, ale nie jest do tego zaprojektowany. Publiczny `Navbar`, filtry zawijają się w kilka rzędów, tabele przewijane w poziomie, szczegóły filmu mają układ 3/4 + 1/4 dopiero od `lg`. Wyszukiwarka komentarzy ma sztywne `w-64`. 35 wystąpień tekstu 8-9 px i 113 wystąpień 10 px (`text-[8px]`, `text-[9px]`, `text-[10px]`).
- **Dostępność:** 21 przycisków-ikon z samym `title`, tylko 13 `aria-label` w całym panelu; `Label` niepowiązany z `Select` (`VideoForm.tsx:187,269`); pole „Poz.” bez etykiety (`videos/[id]/page.tsx:161`); brak `aria-live` przy przesuwaniu w układzie; usunięci użytkownicy jako `opacity-50`.

### 4.6 Duplikacja komponentów i co zachować jako wzorzec

| Zachować jako wzorzec | Wyrzucić |
|---|---|
| `VideoPipelinePanel` + `PipelineStatusCard` + `useVideoPipeline` + `multipart-uploader.ts` (wznawianie, postęp, ETA, heartbeat workera, potwierdzenie 2-klikowe) | publiczny `Navbar` na stronach admina, `AdminLayoutShell`, `AdminVisualShell` |
| `BroadcastWizard` (3 kroki, test, licznik odbiorców, `requestKey`) + `BroadcastHistory` (postęp, anulowanie) | edycja inline filmu (`AdminVideoEditView`, `fetchVideoForEdit`, obsługa `?edit=`) |
| `UserPatronActions` (dialog z wymaganym powodem, ochrona przed podwójnym wysłaniem) | 15 komponentów szkieletów i 13 `loading.tsx` |
| `video-utils.ts` (premiera: `datetime-local`↔ISO, budowanie payloadów zbiórki) | `AdminVideoStats`, filtry atrapy, `AdminActionCard`, `AdminStatTile` w obecnej formie (4 lokalne kopie kafelka zredukowane do jednej, ale bez trendu, porównania okresu, wykresu) |
| strony serwerowe `/admin/channel` i `/admin/payments` (dane z use case w Server Component) | `useAdminListQuery` (rozwiązuje tylko boilerplate, nie stan w URL, nie anulowanie, nie cache) |
| `parseAdminBody` + schematy zod, `readAdminApiError` (do rozszerzenia o `fieldErrors`) | `r2-diagnostics`, `maintenance/*`, `videos/resync` jako trasy HTTP |

---

## 5. Bezpieczeństwo panelu

| Obszar | Stan | Ocena |
|---|---|---|
| Ochrona stron po stronie serwera | `middleware.ts` (ciasteczko) + `app/admin/layout.tsx:10` (`requireAdmin`, DB). Strony klienckie nie renderują danych bez API, więc layout wystarcza w praktyce. `/admin/payments/page.tsx` czyta dane bez własnej kontroli; Next.js ostrzega, że layout nie renderuje się ponownie przy nawigacji i „does not control whether the rest of the route renders” | OK w praktyce, wzorzec kruchy (ADM-26). Źródło: https://nextjs.org/docs/app/guides/authentication (sekcja „Layouts and auth checks”, wersja dokumentacji 16.3.8, aktualizacja 2026-08-25) |
| `requireAdminForApi` | wszystkie 63 handlery; `auth({ fresh: true })` (bez cache ciasteczka, więc unieważniona sesja działa od razu), rola z bazy, `isDeleted` odrzucany | dobrze |
| CSRF | centralnie dla POST/PUT/PATCH/DELETE `/api/admin/*` i `/api/user/*`: `Origin` = host żądania albo host z `NEXT_PUBLIC_APP_URL`; brak `Origin` przepuszczany tylko przy braku/`same-origin`/`none` w `Sec-Fetch-Site`; tryb `report` przez env (nieustawiony = enforce) | dobrze |
| Limity | per skrót ciasteczka sesji + IP (`CF-Connecting-IP`, `TRUST_CF_CONNECTING_IP=true`), Redis lokalny, fail-open po 700 ms | dobrze; opis w CLAUDE.md nieścisły |
| Walidacja ciał | zod na większości tras; wyjątki: `PATCH /videos/[id]/actions` (`adminLooseObjectSchema` = dowolny obiekt, przechodzą surowe `fundraisingGoal*`, `publishAfterAssetReady*`, `status` jako dowolny string → błąd Prismy 500), `POST /videos` (ręczny guard), `orderDir` w query (dowolny string → 500) | ADM-08, ADM-28 |
| Wycieki danych | API admina zwraca pełne e-maile, `metadata` płatności Stripe, ID klienta Stripe; `r2-diagnostics` ujawnia skrót Account ID i nazwę bucketu (tylko adminowi) | akceptowalne dla jednego admina |
| Akcje admina na samym sobie | brak zmiany roli, usuwania, banów w panelu, więc nie da się zdegradować ani usunąć siebie; znacznik wspierającego można nadać sobie (bez skutków) | brak ryzyka, ale też brak zarządzania adminami |
| Usunięcie ostatniego admina | w panelu niemożliwe (brak funkcji); przez „Usuń konto” blokowane w use case (CLAUDE.md §4.12) | OK |
| Bootstrap `ADMIN_EMAILS` | kod promuje zweryfikowany e-mail przy każdym żądaniu (`lib/api/auth.ts:17-25`); na produkcji zmienna pusta, więc wyłączone | OK; przy nowym panelu usunąć całkiem |
| Resztki Clerka | w kodzie panelu brak; w dokumentacji (CLAUDE.md §5, komentarze) tak; tabela `ClerkEvent` martwa | do sprzątnięcia w docs |
| **2FA** | `requireAdminActor` (`lib/api/auth.ts:90-99`) nie sprawdza `twoFactorEnabled`; logowanie Google pomija 2FA z założenia; **0 z 4 adminów ma 2FA** (sprawdzone w bazie) | **P1** (ADM-04). OWASP zaleca MFA dla kont uprzywilejowanych: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html (link standardowy; nie mogłem go dziś ponownie otworzyć, bo wyczerpał się limit wyszukiwania w tej sesji) |
| Sesja admina | ta sama co użytkownika: 30 dni, odświeżana co dobę (`lib/auth/config.ts:9-11`), `freshAge` 1 dzień, ciasteczko na tym samym hoście co serwis publiczny | **XSS na stronie publicznej = przejęcie panelu** (ADM-35) |
| Ponowne uwierzytelnienie | brak przed zwrotem, rozsyłką do wszystkich, usunięciem filmu z plikami, usunięciem wersji HLS | ADM-04 |
| Audyt | 41 akcji mutujących zapisuje zdarzenie; brak `ip`/`userAgent` (0/25), `requestId` rzadko (4/25), `targetType` niespójny (`"COMMENT"` vs `"Video"`), brak „przed/po”, brak przeglądarki dziennika | ADM-14 |
| Upload plików | okładki i domyślna miniatura: MIME z nagłówka klienta, bez magic bytes; `videoId` z formData trafia do klucza R2 bez walidacji (tylko prywatny bucket, tylko admin) | P3 (ADM-38) |
| CSV | `sanitizeCsvField` w gałęzi formuły nie podwaja cudzysłowów, nie obsługuje `\t`/`\r`; ryzyko ograniczone, bo nick ma whitelistę znaków (`lib/auth/nickname.ts:17`), ale e-mail i stare nazwy nie | P3 (ADM-27). OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection |

---

## 6. Zdolność do rozbudowy: co przenieść do nowej aplikacji na subdomenie

### 6.1 Czy logika jest oddzielona od tras

Tak, w dużej mierze. 41 z 48 plików tras to cienkie adaptery: `requireAdminForApi` → parsowanie → use case z `lib/modules/**` → `fromUseCaseResult`. Use case'y przyjmują `AppContext` (`prisma`, `actor`, `now`, `requestId`, `db.read/writeTransaction`), więc da się je wołać z innego hosta, z Server Action, z workera albo z CLI bez kopiowania.

Wyjątki (logika w trasie, trzeba przenieść do modułu):
- `settings/media/default-video-thumbnail/route.ts`: Prisma, R2, Vercel Blob, kolejność kasowania, audyt.
- `videos/cover-upload/route.ts`: wybór magazynu, klucz, fallback Blob.
- `videos/route.ts` DELETE: orkiestracja `snapshotVideoStorage` → `deleteAdminVideo` → `purgeVideoStorage`.
- `users/export/route.ts`: budowanie CSV.
- `videos/r2-diagnostics/route.ts`: cała diagnostyka.

Moduły, które nie przyjmują `AppContext` i biorą globalny `prisma` (do ujednolicenia, ale używalne): całe `notifications/*`, `default-thumbnail.service`, `process-broadcast-queue`, `send-transactional-email`.
Warstwy: `lib/modules/**` nie importuje `next/headers`/`next/navigation` (jedyny wyjątek `thumbnail-response.service.ts` zwraca `NextResponse`); 4 pliki w `lib/modules` importują z `@/app/...` (treści publiczne, nie panel).

### 6.2 Tabela reuse vs rewrite

| Warstwa | Element | Werdykt | Uzasadnienie |
|---|---|---|---|
| Domena | `video` (create/update/publish/archive/delete, `VideoPolicy`, premiera, zbiórka, sync miniatur) | **KEEP**, poprawić jedną ścieżkę zapisu | reguły i niezmienniki (Hero tylko PUBLIC+PUBLISHED, sidebar tylko PUBLISHED, miniatury pochodne nigdy w DB) są poprawne i przetestowane |
| Domena | `video-pipeline` (upload, kolejka, worker, cleanup) | **KEEP bez zmian** | najlepszy moduł w repo |
| Domena | `payments` (`adminRefund`, `adminDisputeSync`, `listAdminPayments`, ustawienia) | **KEEP** | dodać blokadę wiersza i jedną definicję przychodu |
| Domena | `users` (`listAdminUsers` z sortowaniem po grancie w SQL, `getAdminUserDetails`, `exportAdminUsers`, `patron-read-model`) | **KEEP** | dołożyć dane bezpieczeństwa konta (sesje, 2FA, Google, ostatnie logowanie) |
| Domena | `comments` (moderacja, zgłoszenia) | **KEEP** | dodać atomowe „rozwiąż z akcją” |
| Domena | `email` (szablony, rozsyłki z kolejką) | **KEEP** | świeżo przebudowane w #1636 |
| Domena | `notifications` | **KEEP w zamrażarce** | dzwonek ukryty |
| Domena | `audit` (`recordAuditEvent*`) | **KEEP**, rozszerzyć | dodać IP/UA/requestId automatycznie z kontekstu żądania, `diff`, listowanie z filtrami (`getAuditLogs` umie tylko po celu albo użytkowniku) |
| Domena | `admin-stats` | **REWRITE** | 3 liczby, jedna definicja przychodu niezgodna z resztą |
| Infrastruktura | `requireAdminForApi`, `parseAdminBody`, `admin-schemas`, `csrf`, `admin-rate-limit` | **KEEP**, przenieść do wrappera akcji | jeden punkt `requireAdmin → zod → limit → use case → audyt` |
| Infrastruktura | `lib/admin/query-parser.ts` | **REWRITE** | `pageSize` nie mapowany na `limit`, `orderDir` niewalidowany i ignorowany |
| UI | `useAdminListQuery` | **DROP** | nie rozwiązuje stanu w URL, anulowania, cache; w nowej aplikacji listy jako Server Components ze `searchParams` |
| UI | pipeline (`VideoPipelinePanel`, `PipelineStatusCard`, `useVideoPipeline`, `useOriginalUpload`, `multipart-uploader`) | **KEEP**, przestylować | działa, ma postęp i odporność |
| UI | `BroadcastWizard`, `BroadcastHistory`, `EmailTemplateEditor`, `UserPatronActions`, `FundraisingGoalCard`, `video-utils` | **KEEP logikę**, przestylować | – |
| UI | wszystkie pozostałe strony i `components/skeletons/admin.tsx` | **REWRITE / DROP** | ręczne `useEffect`-fetch, szkielety, publiczny `Navbar` |
| UI | odtwarzacz w szczegółach filmu (`PremiumWrapper` + `VideoPlayer` z serwisu publicznego) | **do decyzji** | na osobnej subdomenie potrzebny lekki podgląd HLS (token z `buildSelfHlsPlan` dla admina) zamiast całego publicznego odtwarzacza |

### 6.3 Konsekwencje dla nowej aplikacji pod `admin.pawelperfect.com`

- Repo to jedna paczka (bez workspaces). Najtańsza droga: **ta sama aplikacja Next.js, routing po hoście** (proxy/middleware przepisuje `admin.pawelperfect.com/*` na segment `app/(admin)/*`), osobny layout, osobne ciasteczko sesji admina. Osobna aplikacja (drugi kontener) wymaga wydzielenia `lib/` do pakietu workspace (alias `@/`, singleton Prisma, logger), to więcej pracy i więcej RAM na CPX22.
- Trasy admina wołane z publicznego `CommentItem.tsx` (hide/restore/heart) trzeba albo zostawić na domenie publicznej, albo zastąpić linkiem „otwórz w panelu”.
- Dane, których nowy pulpit potrzebuje, a których dziś nie ma w żadnym module: stan timerów systemd, zdrowie kontenerów, heartbeat workera globalnie (jest w `AppSetting video_worker_heartbeat`), kolejka `VideoEncodeJob` dla wszystkich filmów, ostatnie `StripeEvent`/webhooki Resend z błędami, `VideoPlaybackSession`/`VideoPlaybackEvent` jako analityka oglądalności, liczba aktywnych sesji `Session`.

---

## 7. Decyzje dla każdej obecnej zakładki: KEEP / REWRITE / DROP

| Zakładka | Logika (moduł) | UI | Decyzja i uzasadnienie |
|---|---|---|---|
| Pulpit `/admin` | brak | 7 kafelków | **DROP UI, REWRITE**: pulpit z liczbami (ruch, przychód jedną definicją, kolejka, błędy, premiery, zgłoszenia do rozpatrzenia) |
| Filmy: lista | KEEP (`getAdminVideoList`, z poprawką `limit`/`orderDir`/`needsAttention`) | REWRITE | lista serwerowa ze stanem w URL; usunąć edycję inline, „Duplikuj” (albo zrobić serwerowo), filtry atrapy, `AdminVideoStats` |
| Filmy: nowy film | KEEP (`createAdminVideo` + pipeline) | REWRITE | osobna strona `/videos/new`, która po utworzeniu przechodzi do szczegółów → Media; upload żyje w jednym miejscu, z `beforeunload` |
| Film: szczegóły | KEEP (szczegóły, diagnostyka bez duplikatów, audyt) | REWRITE | zakładki: Przegląd (z podglądem i statystykami z `VideoPlaybackSession`), Media (pipeline bez zmian), Komentarze (podpiąć istniejące `videos/[id]/comments`), Historia; DROP zakładek „Dostęp” i „Treść” (duplikują edycję) |
| Film: edycja | KEEP (`updateAdminVideo`, `video-utils`) | REWRITE | jeden `PATCH /videos/[id]` ze ścisłym schematem, status tylko przez akcje; Hero i sidebar jako przełączniki w formularzu z poprawną walidacją |
| Układ kanału | KEEP `reorderAdminVideos`, dodać Hero | REWRITE | dziś nie działa; przeciąganie + klawiatura, kolejność jak w serwisie, wszystkie filmy |
| Komentarze | KEEP | REWRITE | filtr statusu, tytuł filmu zamiast ID, potwierdzenie usunięcia, akcje zbiorcze jednym żądaniem |
| Zgłoszenia | KEEP + nowe atomowe `resolve(action)` | REWRITE | dziś błędy ciche i dwa nieatomowe żądania; połączyć z Komentarzami jako filtr „Zgłoszone” |
| Użytkownicy: lista | KEEP `listAdminUsers` | REWRITE | DROP „Wyślij wiadomość”, kafelków-linków; dodać wyszukiwarkę globalną |
| Użytkownik: szczegóły | KEEP + dane konta | REWRITE | dodać: weryfikacja e-maila, 2FA, Google, sesje z wylogowaniem, ostatnie logowanie, blokada komentowania |
| Dashboard użytkowników | – | **DROP** | wchłonąć w pulpit |
| Wpłaty | KEEP refund/dispute/list | REWRITE | osobna sekcja „Pieniądze” (nie pod Użytkownikami); pole „powód”, eksport CSV, domyślnie bez porzuconych `PENDING` |
| Płatności (ustawienia) | KEEP | REWRITE (mała) | przenieść do „Ustawienia” |
| Kanał | KEEP | REWRITE | banner przez upload zamiast URL; DROP pola „domyślna miniatura (URL)” i `displaySubscribersCount` (nic nie robi publicznie) albo podpiąć go świadomie |
| Media (domyślna miniatura) | KEEP po przeniesieniu do modułu i usunięciu Blob | REWRITE | scalić z „Kanał / Ustawienia” |
| Poczta | KEEP | REWRITE tylko powłoki i stylu | moduł świeży i dobry |
| Powiadomienia | KEEP w zamrażarce | **DROP z nawigacji** do czasu odkrycia dzwonka | dziś wysyła coś, czego nikt nie widzi |
| Trasy bez wywołującego | – | – | **DROP** `maintenance/*`, `videos/resync`, `r2-diagnostics` (jako trasy; diagnostyka R2 ma trafić do strony „System”), `stats`, `channel` GET, `payment-settings` GET; **KEEP** `videos/[id]/comments` (podpiąć) |

---

## 8. Lista błędów do naprawy niezależnie od przebudowy

Format: **ID — waga — typ.** plik:linia, ścieżka wykonania, naprawa, nakład (S/M/L), pewność. Waga: P0 krytyczne, P1 ważne teraz, P2 ważne, P3 drobne. „(było ADM-xx)” = numer z audytu 2026-10-03.

### P1

**ADM-01 — P1 — błąd.** Paginacja w filmach, użytkownikach i wpłatach wraca na stronę 1; zapytanie przy każdym znaku. (było ADM-01, nadal aktualne)
- `app/admin/users/page.tsx:56-72`, `app/admin/users/payments/page.tsx:51-85`, `app/admin/videos/components/useAdminVideos.ts:41-79` + `app/admin/videos/page.tsx:47-73`.
- Ścieżka: `fetchX` ma w zależnościach `useCallback` `page` i pole wyszukiwania; `useEffect` z `fetchX` w zależnościach woła `fetchX(1)`. Klik „Następna” → `setPage(2)` → nowa tożsamość funkcji → efekt → strona 1. Każdy znak w wyszukiwarce też zmienia tożsamość → zapytanie (w users dodatkowo `fetchStats`). W filmach `loadAdminVideos` (zależny od `fetchVideos`) uruchamia efekt z `setIsInitialLoading(true)`, więc każda zmiana strony/znaku przechodzi przez „pierwsze ładowanie” i 2-3 żądania. Brak `AbortController`, odpowiedzi mogą przyjść w złej kolejności.
- Naprawa: stan listy w `searchParams`, efekt zależny tylko od parametrów, debounce, `AbortController`; docelowo Server Component.
- Nakład S. Pewność wysoka (analiza kodu).

**ADM-02 — P1 — błąd.** „Układ kanału”: Hero nie zapisuje się mimo komunikatu sukcesu; kolejność odwrócona; widać max 20 filmów. (było ADM-02/03)
- `app/admin/videos/layout/page.tsx:26, 62-67, 75-80`; `lib/api/admin-schemas.ts:86-96` (schemat wycina `isMainFeatured`); `lib/admin/query-parser.ts:25-34` (`pageSize` zamiast `limit`); `lib/modules/video/infrastructure/video.repository.ts:220, 226` (`limit || 20`, zawsze `'desc'`); publiczny sidebar sortuje `asc` (`video.repository.ts:178`, `video-content.service.ts:34`).
- Skutek: pierwsze przesunięcie przenumerowuje cały odwrócony widok, więc kolejność na stronie zmienia się inaczej, niż admin widzi. Uwaga: reguła „Hero tylko PUBLIC” w UI (`:184`) jest **zgodna** z `VideoPolicy.getHeroBlockers` (`video.policy.ts:87`); poprzedni audyt mylnie podał, że nie.
- Naprawa: Hero przez `POST /actions {action:"set-hero"}` albo rozszerzony use case z `getHeroBlockers` + `clearHero`; mapować `pageSize`→`limit`, przekazywać `orderDir`; pobierać wszystkie filmy kanału.
- Nakład S. Pewność wysoka.

**ADM-04 — P1 — bezpieczeństwo.** Konta admina bez 2FA i bez ponownego uwierzytelnienia; długa sesja na wspólnym originie. (było ADM-05)
- `lib/api/auth.ts:90-99` (`requireAdminActor`: rola + `isDeleted`, bez `twoFactorEnabled`); `lib/auth/config.ts:9-11` (sesja 30 dni, odświeżana co dobę); logowanie Google pomija 2FA (CLAUDE.md §4.12). Produkcja: **0/4 adminów z 2FA**.
- Jedno skradzione ciasteczko = zwroty, rozsyłka do wszystkich, usunięcie filmów z plikami.
- Naprawa (niezależnie od przebudowy): w `requireAdminActor` wymagać `twoFactorEnabled` (dla Google: TOTP jako drugi krok w panelu albo passkey); dla zwrotu, usunięcia filmu/wersji, rozsyłki: świeża sesja (np. 10 min) albo ponowny kod; krótsza sesja admina.
- Nakład M. Pewność wysoka.

**ADM-05 — P1 — UX/dane.** Operacje nieodwracalne lub o dużym skutku bez potwierdzenia. (było ADM-06)
- `app/admin/comments/page.tsx:190-199` (usuń zaznaczone, do 50), `:296-298` (usuń pojedynczo; komentarz w kodzie `:292`: usunięcie jest ostateczne); `app/admin/videos/[id]/page.tsx:112-115, 200` (cofnij publikację, archiwizuj: zdejmują film, Hero i sidebar, kasują publiczną miniaturę, `update-admin-video.use-case.ts:76-79`); `:243` (usuń komentarz).
- Naprawa: wspólny `ConfirmDialog` z opisem skutku („strona główna zostanie bez Hero”).
- Nakład S. Pewność wysoka.

**ADM-06 — P1 — błąd/„ślepy panel”.** Szczegóły i lista filmów pokazują fałszywe dane. (nowe)
- `app/admin/videos/[id]/page.tsx:237` czyta `video.comments`, którego DTO nie ma (`get-admin-video-details.use-case.ts:37-41`, `toAdminVideoDto`): zakładka „Komentarze” zawsze „Brak komentarzy”, choć licznik obok pokazuje N.
- `:256` `video._count?.playbackSessions`: repozytorium liczy tylko `comments` (`video.repository.ts:97`), więc „Sesje wideo” zawsze 0.
- `VideoTable.tsx:107` `vid.diagnosticsIssuesCount`: pola nie ma w DTO, odznaka „Wymaga uwagi” nigdy się nie pokazuje.
- Naprawa: podpiąć istniejącą trasę `GET /api/admin/videos/[id]/comments`; dodać `_count.playbackSessions` (z `countedAsView`); liczyć problemy w `getAdminVideoList` albo usunąć odznakę.
- Nakład S. Pewność wysoka.

### P2

**ADM-03 — P2 — błąd.** Formularz edycji nie pozwala cofnąć do szkicu ani zarchiwizować filmu widocznego w sidebarze. (nowe)
- `app/admin/videos/[id]/edit/page.tsx:138-141` (i inline `videos/page.tsx:186-188`) zawsze odsyła `showInSidebar` z wczytanych danych. `update-admin-video.use-case.ts:55-58`: `input.showInSidebar === true` + `nextStatus = DRAFT/ARCHIVED` → `VideoInvalidSidebarError` („VIDEO_SIDEBAR_NOT_PUBLISHED: …”). Czyszczenie sidebaru (`:76-79`) działa dopiero po tej walidacji. Formularz nie ma przełącznika sidebaru, więc admin nie ma jak tego obejść (tylko przez akcję w szczegółach).
- Naprawa: w use case przy statusie ≠ PUBLISHED pomijać walidację sidebaru (i tak go czyści) albo nie wysyłać pól ekspozycji z formularza.
- Nakład S. Pewność wysoka.

**ADM-07 — P2 — błąd/atrapy.** Filtry i statystyki listy filmów. (było ADM-07, częściowo naprawione w #1614)
- `needsAttention` wysyłany (`useAdminVideos.ts:51`), parsowany (`query-parser.ts:51`), ignorowany w `findAdminList` (`video.repository.ts:185-238`); `stats` nigdy nie zwracane (`get-admin-video-list.use-case.ts:17-30`), więc `AdminVideoStats` martwy; opcja „Niepubliczne” (`UNLISTED`) bez sposobu ustawienia; `orderDir` ignorowany. Filtr „Migracja” jest już poprawnie przepisany na `SELF_HLS`.
- Nakład S. Pewność wysoka.

**ADM-08 — P2 — spójność/walidacja.** Trzy ścieżki zapisu filmu. (było ADM-08)
- (a) `POST /videos` z `id` (`videos/route.ts:93-96`, używa go kanoniczny formularz `/edit`!); (b) `PATCH /videos/[id]` (`[id]/route.ts:14-37`, `passthrough`); (c) `PATCH /videos/[id]/actions` (`actions/route.ts:14-34`, `adminLooseObjectSchema`): przechodzą surowe `fundraisingGoalMinor/Currency/StartAt`, `publishAfterAssetReady*`, `premiereAt` jako string, `status` jako dowolny string (błąd Prismy → 500).
- Naprawa: jedno `PATCH /videos/[id]` ze schematem `.strict()`; usunąć PATCH z `/actions` i gałąź `id` z `POST /videos`; status tylko przez akcje.
- Nakład M. Pewność wysoka.

**ADM-09 — P2 — spójność.** Dwa formularze edycji. (było ADM-09)
- Ikona „Edytuj” (`VideoTable.tsx:152`) otwiera edycję inline (`videos/page.tsx:84-112`): bez „Celu zbiórki”, pola napisów puste i niezapisywane (body ich nie wysyła), martwe `?edit=` (`videos/page.tsx:64-69`, `useAdminVideos.ts:81-113`, bo `middleware.ts:190-196` przekierowuje).
- Naprawa: tabela linkuje do `/edit`, usunąć inline edit.
- Nakład M. Pewność wysoka.

**ADM-11 — P2 — UX/dane.** Upload przy tworzeniu można porzucić; drugi szkic w trakcie uploadu. (było ADM-11 + nowe)
- `AdminVideoEditView.tsx:58-87`: „Anuluj/Wróć” odmontowuje `VideoPipelinePanel` w trakcie wysyłki; błąd `fetchVideos` podmienia cały widok na `AdminVideoErrorView` (`videos/page.tsx:292-294`); `useOriginalUpload` nie przerywa przy odmontowaniu, brak `beforeunload`.
- Nowe: po utworzeniu `videos/page.tsx:206-218` ustawia tylko `createUploadState`, a `formData.id` zostaje puste, więc główne przyciski formularza w trakcie uploadu wysyłają **ponowne tworzenie** (błąd duplikatu sluga albo drugi szkic, gdy tytuł/slug się zmienił).
- Naprawa: `/videos/new` → po utworzeniu przekierowanie do szczegółów (Media), `beforeunload`, potwierdzenie przy „Anuluj”.
- Nakład M. Pewność wysoka (drugi szkic: średnia, zależy od zmiany sluga).

**ADM-13 — P2 — UX.** Admin nie widzi powodu błędu walidacji; komunikaty po angielsku. (było ADM-13)
- `lib/admin/api-error.ts:6-24` czyta tylko `message`/`error`, nigdy `details.fieldErrors` z `parseAdminBody` (`admin-body.ts:266-273`); polski komunikat ze schematu kanału (`channel/route.ts:32`) nie dociera. Angielskie: „Invalid data”, „No file uploaded”, „File too large”, `Payment … cannot be refunded`, `Refund amount … is invalid`.
- Nakład S. Pewność wysoka.

**ADM-14 — P2 — bezpieczeństwo/audyt.** Dziennik audytu bez kontekstu i bez przeglądarki. (było ADM-14)
- `AuditRepository.create` (`audit.repository.ts`) zapisuje `ip`/`userAgent` tylko gdy podane; żadna ścieżka admina ich nie podaje (produkcja: 0/25). `requestId` tylko tam, gdzie trasa przekaże (4/25). `targetType` niespójny (`"COMMENT"` w komentarzach, `"Video"`, `"User"`, `"Payment"`), więc moderacja nie pojawia się w historii filmu. Brak „przed/po”. `getAuditLogs` umie tylko po celu albo użytkowniku.
- Naprawa: kontekst żądania (`AsyncLocalStorage` albo w `requireAdminForApi`) automatycznie w `recordAuditEvent`; jedna konwencja `targetType`; `metadata.diff`; strona dziennika z filtrami.
- Nakład M. Pewność wysoka.

**ADM-16 — P2 — UX/śmieć.** Powiadomienia wysyłane do niewidocznego dzwonka. (było ADM-16)
- `Navbar.tsx:23` `TEMP_HIDE_NOTIFICATIONS_BELL = true`; `/admin/notifications` pozwala wysłać broadcast bez ostrzeżenia; brak idempotencji (`broadcast-notification.use-case.ts`); formularz bez pola `href`; kafelki liczą „ostatnie 50” (`notifications/page.tsx` ~50-52, `notifications/route.ts:9`).
- Nakład S. Pewność wysoka.

**ADM-17 — P2 — UX.** Moderacja zgłoszeń: błędy ciche, akcje nieatomowe. (było ADM-17)
- `app/admin/comments/reports/page.tsx:37-72`: każdy błąd tylko `logger.error`, brak toastu i stanu `pending`; „Ukryj” = hide + resolve w dwóch żądaniach; gdy komentarz jest już ukryty, hide pada i zgłoszenie wisi bez informacji. `comments/page.tsx:33` nie bierze `error` z hooka (błąd ładowania = pusta tabela); kolumna „Film” to 8 znaków UUID (`:270`), brak filtra statusu.
- Naprawa: `POST /reports/[id]/resolve {action: HIDE|HOLD|DISMISS}` w jednej transakcji, toasty, tytuł filmu.
- Nakład S/M. Pewność wysoka.

**ADM-18 — P2 — błąd/dane.** Dashboard użytkowników i niespójne definicje przychodu. (było ADM-18)
- `app/admin/users/dashboard/page.tsx:18-33, 58`: przy błędzie API `stats` = `null` → `stats.totalUsers` → TypeError i error boundary.
- `get-admin-users-stats.use-case.ts:29-36`: „Wpłaty” = liczba `SUCCEEDED` (bez `PARTIALLY_REFUNDED`), pokazywana pod podpisem sugerującym kwotę; patroni przez `findMany distinct`.
- Pięć definicji przychodu (§4.1). Naprawa: jeden use case „przychód” (netto, `SUCCEEDED`+`PARTIALLY_REFUNDED`, per waluta i w PLN wg kursów wyświetlania) używany wszędzie.
- Nakład S. Pewność wysoka.

**ADM-19 — P2 — błąd/spójność.** Domyślna miniatura: zła kolejność kasowania, logika w trasie, żywy fallback Vercel Blob, drugi mechanizm w kanale. (było ADM-19)
- `app/api/admin/settings/media/default-video-thumbnail/route.ts:91-93` kasuje stary obiekt przed upsertem w DB; `:99-101` w fallbacku Blob kasuje stary **przed** wgraniem nowego (gdy R2 padło, a stary był w R2, admin traci oba); `:147` DELETE kasuje obiekt przed usunięciem ustawienia. `BLOB_READ_WRITE_TOKEN` nadal ustawiony na serwerze, więc zewnętrzna zależność od Vercela żyje (wbrew zasadzie „własny stos”). Kanał ma osobne pole URL `defaultThumbnailUrl` (`channel/route.ts:44`), dowolny `http(s)`, który proxy miniatur może odrzucić po cichu.
- Naprawa: jeden mechanizm w module media, usuwanie po commicie, bez Blob.
- Nakład M. Pewność wysoka.

**ADM-20 — P2 — spójność.** Brak powłoki i nawigacji panelu; pusty pulpit. (było ADM-20)
- 14 stron z publicznym `Navbar`, `/admin/settings` bez paska (`settings/page.tsx:84`), `AdminVisualShell.tsx:8` (wyjątek dla płatności), `AdminLayoutShell` tylko dla filmów; pulpit `app/admin/page.tsx:7-51` bez danych, z nieaktualnym opisem „ustawienia bramki patronackiej” (`:29`); wpłaty pod użytkownikami.
- Nakład M. Pewność wysoka.

**ADM-21 — P2 — UX (wymaganie właściciela).** Szkielety: 13 `loading.tsx`, podwójne szkielety na 6 trasach, formularz zastępowany szkieletem w trakcie zapisu. (nowe w tej formie)
- Lista w §4.4. Zapis: `app/admin/videos/[id]/edit/page.tsx:203-205`, `AdminVideoEditView.tsx:51-53` (`AdminFormSkeleton` + `className="hidden"` na formularzu).
- Naprawa: dane z serwera (wzorzec `/admin/channel`), przy zapisie stan `pending` na przycisku zamiast chowania formularza.
- Nakład M. Pewność wysoka.

**ADM-31 — P2 — testy.** Testy panelu sprawdzają tekst źródła, nie zachowanie. (było ADM-31)
- 16 plików `tests/unit/admin-*.test.ts` + katalog `tests/unit/admin/`; 8 z nich to `readFileSync` + `toContain`; żaden nie wykrył ADM-01, 02, 03, 06. `admin-mutations-audit-static.test.ts` i `admin-mutations-validation-static.test.ts` uznają trasę za „audytowaną/zwalidowaną” po nazwach (przepuszczają `adminLooseObjectSchema`). E2E tylko `tests/e2e/beta-smoke.spec.ts`.
- Nakład M/L. Pewność wysoka.

**ADM-35 — P2 — bezpieczeństwo (architektura).** Panel na tym samym hoście i ciasteczku co serwis publiczny. (nowe)
- Sesja admina = ciasteczko `pp*` na `www.pawelperfect.com`, to samo co dla każdego widza; dowolny XSS na stronie publicznej (komentarze, opisy, szablony) działa z uprawnieniami admina, gdy właściciel ogląda serwis zalogowany. Uprawnienia admina są tylko rolą konta konsumenckiego.
- Naprawa w przebudowie: osobna subdomena z osobnym, host-only ciasteczkiem, krótką sesją, wymuszonym 2FA/passkey; moderacja w miejscu na stronie publicznej wyłączona albo przez osobny token.
- Nakład L (część przebudowy). Pewność wysoka.

**ADM-36 — P2 — brak funkcji.** Czego brakuje do pracy jednej osoby (panel „ślepy”). (było ADM-35, rozszerzone)
1. Strona „System”: worker `encoder` (heartbeat jest w `AppSetting video_worker_heartbeat`), cała kolejka `VideoEncodeJob`, 7 timerów systemd z ostatnim wynikiem, ostatnie webhooki Stripe/Resend i ich błędy, R2 i dysk, wersja wdrożenia.
2. Dziennik audytu z filtrami (ADM-14).
3. Analityka oglądalności z `VideoPlaybackSession`/`VideoPlaybackEvent` (dane już są, panel ich nie pokazuje).
4. Eksport wpłat CSV.
5. Wyszukiwarka globalna (użytkownik / film / płatność po ID, e-mailu, Stripe ID).
6. Bezpieczeństwo konta użytkownika: weryfikacja, 2FA, Google, sesje z wylogowaniem, ostatnie logowanie, blokada komentowania/ban.
7. Zarządzanie adminami (dziś tylko w bazie; 4 konta).
8. Przegląd premier i zbiórki na pulpicie.
- Nakład L. Pewność wysoka.

### P3

**ADM-10 — P3 — błąd.** „Duplikuj” gubi miniaturę (`videos/page.tsx:125` kopiuje pochodny URL; `createAdminVideo` go odrzuca → `/logo.png`), admin o tym nie wie. Nakład S. Pewność wysoka.

**ADM-12 — P3 — błąd.** Po nadaniu/cofnięciu znacznika z listy użytkowników znaczek się nie odświeża: `users/page.tsx:318` nie przekazuje `onActionComplete`, `UserPatronActions.tsx` woła `router.refresh()`, które nie pobiera ponownie listy klienckiej. Nakład S. Pewność wysoka.

**ADM-15 — P3 — błąd/prywatność.** „Wyślij wiadomość” (`users/page.tsx:319`) prowadzi do `/admin/emails?to=<email>` (bez kodowania, e-mail w URL i logach); strona parametru nie czyta, wysyłki do jednej osoby nie ma. Usunąć albo zrobić „Wyślij e-mail” po `userId` w szczegółach. Nakład S. Pewność wysoka.

**ADM-22 — P3 — spójność.** Mieszany PL/EN i surowe enumy (`AdminVideoStats.tsx:21-24`, `videos/[id]/page.tsx:80, 105, 153-155`, `layout/page.tsx:172-174`, `users/page.tsx` „PATRON (GRANT)”, `users/[userId]/page.tsx:108` „Patron (grant truth)”), słownictwo płatnego modelu. Jedna mapa etykiet `lib/admin/labels.ts`. Nakład S/M. Pewność wysoka.

**ADM-23 — P3 — dostępność.** 21 przycisków-ikon tylko z `title`, 13 `aria-label` w całym panelu, `Label` bez powiązania z `Select` (`VideoForm.tsx:187, 269`), pole „Poz.” bez etykiety (`videos/[id]/page.tsx:161`), 148 wystąpień tekstu 8-10 px. Nakład S/M. Pewność wysoka.

**ADM-24 — P3 — śmieć.** 8 handlerów bez wywołującego (§2.2); `r2-diagnostics` ma porady o „redeploy w Vercel” (`r2-diagnostics/route.ts:67`). Każda zbędna trasa to powierzchnia ataku. Usunąć; diagnostykę R2 przenieść na stronę „System”. Nakład S. Pewność wysoka (grep wywołań w `app/`, `lib/`, `components/`).

**ADM-25 — P3 — śmieć.** Martwy kod: `requireUser`, `verifyAdmin`, `isAdminRequest` (`lib/auth-utils.ts:44-49, 81-87`), `_isAdmin` w `useAdminVideos.ts:9` i nieosiągalna gałąź „Brak uprawnień” (`videos/page.tsx:30, 48, 296`), `fetchVideoForEdit`, nieużywane importy w `users/payments/page.tsx` i `users/[userId]/page.tsx:11`, komentarz `lib/api/auth.ts:12-13` o nieistniejącej degradacji. Nakład S. Pewność wysoka.

**ADM-26 — P3 — bezpieczeństwo (obrona w głąb).** `/admin/payments/page.tsx` czyta dane serwerowo bez własnej kontroli admina (tylko layout). Wzorzec: `getAdminContext()` z `cache()` w każdej stronie i akcji serwerowej. Nakład S. Pewność wysoka.

**ADM-27 — P3 — bezpieczeństwo.** CSV: `users/export/route.ts:29-35` w gałęzi formuły zwraca `"'${str}"` bez podwajania cudzysłowów i nie obsługuje `\t`/`\r`. Najpierw escapowanie, potem prefiks `'` dla `= + - @ \t \r`. Nakład S. Pewność wysoka.

**ADM-28 — P3 — błąd.** `orderDir` z query bez walidacji (`lib/admin/query-parser.ts:32`): dowolny string → wyjątek Prismy → 500 w wpłatach i użytkownikach; w filmach ignorowany; „E-mail (alfabetycznie)” sortuje Z→A. Nakład S. Pewność wysoka.

**ADM-29 — P3 — pieniądze.** Zwrot: UI nie ma pola „powód” (`users/payments/page.tsx:96-118`), więc `Payment.refundReason` i metadane Stripe nie są ustawiane; brak blokady wiersza (`SELECT … FOR UPDATE`), więc dwa równoległe zwroty o **różnych** kwotach mogą przejść ten sam test `maxRefundable` (klucz idempotencji chroni tylko identyczne żądania). Przy jednym adminie ryzyko małe. Nakład S. Pewność wysoka. (było ADM-04 P1, obniżone, bo klucz idempotencji jest od #1637)

**ADM-30 — P3 — współbieżność.** Brak blokady optymistycznej: `/edit` wysyła wszystkie pola (`edit/page.tsx:128-146`), dwie karty nadpisują się po cichu. `updatedAt` w żądaniu i 409. Nakład S. Pewność wysoka.

**ADM-32 — P3 — dokumentacja.** Rozbieżności z §2.3 (CLAUDE.md §5: `/admin/videos/new`, 55 tras, `health/clerk`, Clerk, Blob, `docs/tickets/ready/`, „ip w AuditLog”). Nakład S. Pewność wysoka.

**ADM-33 — P3 — spójność.** „Premiera” na szkicu nieatomowa: `update-admin-video.use-case.ts:81-107` zapisuje pola (w tym `premiereAt`) w transakcji, a `publishAdminVideo` (`:122-124`) jest wołane po niej; gdy publikacja się nie uda (np. HLS nie gotowy), admin widzi błąd, choć zmiany są zapisane. Nakład S. Pewność wysoka.

**ADM-34 — P3 — UX.** Akcje zbiorcze komentarzy to 50 równoległych POST-ów (`comments/page.tsx:116-132`); przy domyślnym limicie 120 mutacji/min trzecia akcja zbiorcza w minucie częściowo pada. Jedno żądanie zbiorcze z listą ID. Nakład S. Pewność wysoka.

**ADM-37 — P3 — śmieć danych.** `displaySubscribersCount` w kanale zapisuje się, ale żadna strona publiczna go nie używa (`app/[locale]/channel/[slug]/page.tsx:135-141` czyta i ignoruje). Okładka wgrana, a niezapisana w formularzu, zostaje sierotą w prywatnym buckecie; „Resetuj” wstawia `/logo.png` zamiast domyślnej miniatury kanału (`VideoForm.tsx:247-258`). Nakład S. Pewność wysoka (pierwsza część), średnia (sieroty).

**ADM-38 — P3 — bezpieczeństwo.** Upload obrazów ufa MIME z nagłówka klienta (`cover-upload/route.ts:32`, `default-video-thumbnail/route.ts:67`), bez sprawdzenia magic bytes; `videoId` z formData trafia do klucza R2 bez walidacji (`cover-upload/route.ts:26, 46, 70`). Tylko admin i prywatny bucket. Nakład S. Pewność wysoka.

### Co naprawiono od audytu 2026-10-03 (nie wymaga pracy)
- Zwrot ma klucz idempotencji Stripe (`admin-refund.use-case.ts:89`).
- Rozsyłka e-mail: jeden kontrakt zod bez pól „legacy”, `requestKey`, kolejka w tle, test na własny adres (było ADM-23).
- Zakładki „Odpowiedzi” i „Ustawienia Resend” oraz trasy `emails/responses`, `emails/status` usunięte (było ADM-24).
- Trasy dostawców wideo usunięte; filtr „Źródło” usunięty, filtr „Migracja” przepisany na własny HLS (część ADM-07, ADM-25).

### Źródła zewnętrzne
- Next.js, „How to implement authentication” (layouty nie są granicą autoryzacji, DAL, Proxy tylko optymistycznie): https://nextjs.org/docs/app/guides/authentication (pobrane 2026-10-04, wersja dokumentacji 16.3.8).
- OWASP Multifactor Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
- Oba linki OWASP to standardowe adresy; nie otworzyłem ich ponownie, bo w trakcie pracy wyczerpał się limit wyszukiwania w sesji.
