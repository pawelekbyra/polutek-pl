# D. Inwentaryzacja kodu: z jednego kanału do platformy wielu twórców

Repozytorium: `pawelekbyra/polutek-pl`, gałąź `main`, HEAD `376e3517`. Analiza statyczna (tylko odczyt kodu, bez uruchamiania). Ścieżki względem korzenia repo. Numery linii z HEAD.

---

## Wnioski (TL;DR)

1. **Warstwa danych jest w połowie gotowa na wiele kanałów, warstwa aplikacji nie.** `Creator` już istnieje (z `userId`, `slug`, `subscribersCount`), `Video.creatorId` jest wymagane i zindeksowane, `Payment.creatorId`, `Comment.creatorId`, `Subscription.creatorId` istnieją. `VideoRepository` jest już sparametryzowany identyfikatorem kanału (`findByIdForMainChannel(id, mainChannelId)`, `createForMainChannel(input, mainChannelId, tx)`, `clearHero(mainChannelId, …)`). Główny problem to **źródło** tego identyfikatora: niemal każdy use case woła `MainChannelService.getRequired(ctx)`, które rozwiązuje kanał z `flags.mainCreatorSlug` (env `MAIN_CREATOR_SLUG`). Takich wywołań jest ok. **39 plików produkcyjnych** (app, lib, apps, scripts) i **25 plików testów**.
2. **Brak warstwy autoryzacji.** Use case'y wideo (`createAdminVideo`, `updateAdminVideo`, `publishAdminVideo`, `archiveAdminVideo`, `deleteAdminVideo`, `reorderAdminVideos`) i pipeline'u (`startOriginalUpload`, `completeOriginalMultipart`, `enqueueEncode`...) **w ogóle nie sprawdzają aktora**. Jedyna bramka to `requireAdmin()` / `panelRouteContext()` w `apps/admin`. Inne moduły sprawdzają `ctx.actor.type !== "admin"` lokalnie, w różnych formach (`fail`, `throw`, pusty wynik). Wystawienie tych use case'ów na `www` bez nowej warstwy polityk byłoby luką krytyczną.
3. **„Admin” ma dziś trzy znaczenia, które trzeba rozdzielić:** (a) `User.role = ADMIN` na `www` (podgląd szkiców, ominięcie premiery, moderacja komentarzy w API, odznaka `ADMIN`), (b) aktor panelu `{type:"admin", userId: AdminUser.id}` (inna tabela, inny identyfikator w tym samym polu `userId`), (c) „twórca” = `Creator.userId` (odznaka „Twórca”, odpowiedź twórcy). Docelowo: `superadmin` (tylko panel, bez kanału), `channel owner/member` (studio na `www`), zwykły `user`.
4. **Płatności są w pełni jednokontowe** (jedno konto Stripe, `STRIPE_SECRET_KEY`, jeden webhook, `PatronGrant`/`UserPaymentTotal` bez wymiaru kanału, okno napiwku z zakodowanym „Pawłowi Perfectowi”). Stripe Connect wymaga nowego modelu (konto połączone per kanał, destination charges, webhook Connect, zwroty z `reverse_transfer`) oraz decyzji prawnej (model niekomercyjny z CLAUDE.md §1/§4.1 przestaje opisywać produkt).
5. **Pipeline wideo jest globalny i jednowątkowy:** jedna kolejka FIFO po `createdAt`, blokada doradcza `947201` i warunek „żadne inne zadanie nie biegnie” = jedno kodowanie naraz na cały serwis. Brak kwot, brak sprawiedliwości per kanał, limit uploadu 10 GiB globalnie (`VIDEO_UPLOAD_MAX_BYTES`). Klucze R2 są per `videoId` (bez kanału) i to jest **dobre** (nie trzeba ich zmieniać).
6. **Strona publiczna jest zbudowana wokół jednego kanału:** strona główna = kanał (`loadHomeContent()`), `/watch/[slug]` tylko przekierowuje na `/?v=slug`, `/channel/[slug]` zwraca „Kanał nie znaleziony” dla każdego sluga ≠ `MAIN_CREATOR_SLUG`, sitemap/JSON-LD/OG opisują jeden kanał, rozsyłka e-mail ma jedną grupę odbiorców, subskrypcja jest jednocześnie „obserwuj kanał” i „zgoda na maile”.
7. **Panel (`apps/admin`) jest w całości „jednokanałowy”** w ekranach Treści/Układ/Ustawienia/Tłumaczenia (przez `MainChannelService`) i „globalny bez filtra” w ekranach Analityka/Przychody/Społeczność/Komunikacja. Brakuje pojęcia „lista kanałów”, „szczegóły kanału”, filtra kanału i akcji moderacyjnych na kanale.
8. **Testy:** 392 pliki testów; ~64 dotykają założeń głównego kanału, 25 mockuje `MainChannelService`, 19 mockuje cały barrel `@/lib/modules/channel`, kilka testów czytających źródła wprost zabrania copy „wielu twórców” (`tests/unit/single-channel-copy.test.ts`) i administracji na `www` (`tests/unit/legacy-admin-retired.test.ts`). Te testy muszą być świadomie przepisane, nie wyłączone.
9. **Rekomendowany porządek:** (0) decyzje produktowe/prawne → (1) warstwa polityk `can()` + aktor z członkostwem w kanale (bez zmiany zachowania) → (2) schemat addytywny (`ChannelMember`, `Creator.handle/status`, `StripeConnectedAccount`...) i backfill → (3) zamiana `MainChannelService` na `ChannelResolver` (kontekst kanału z URL/zasobu), z „kanałem domyślnym” za flagą → (4) studio twórcy na `www` (te same use case'y) → (5) panel superadmina „wszystkie kanały” → (6) Stripe Connect za flagą per kanał → (7) strona odkrywania, sitemap, SEO → (8) migracja czyszcząca (`isPrimary`, `MAIN_CREATOR_SLUG`). Skala: ok. **150-220 plików** produkcyjnych i **90-130 plików testów**; najbardziej ryzykowne: płatności i autoryzacja.

---

## 1. Sprzężenie z jednym kanałem (inwentarz)

Klasyfikacja: **(a)** trywialnie parametryzowalne identyfikatorem kanału, **(b)** wymaga przeprojektowania, **(c)** do usunięcia.

### 1.1 Rdzeń: rozwiązywanie „kanału głównego”

| Plik:linia | Co robi | Klasa |
|---|---|---|
| `lib/feature-flags.ts:10-22` | `flags.mainCreatorSlug` z `MAIN_CREATOR_SLUG` (domyślnie `'polutek'` z `lib/constants.ts:46`), rzuca w produkcji, gdy brak; ostrzeżenie „ENABLE_MULTI_CREATOR is deprecated … strict single-channel” (l. 25-27) | (c) po migracji; na czas przejścia zostaje jako „kanał domyślny strony głównej” |
| `lib/constants.ts:42,46` | `MAIN_CREATOR_NAME`, `MAIN_CREATOR_SLUG` (fallbacki) | (c) |
| `lib/modules/channel/application/main-channel.service.ts` (cały) | `MainChannelService.getOptional/getRequired/getConfiguredSlug`, `incrementSubscribersCount` itd.; `getRequired` wymaga `isApproved && isPrimary`; `findMainChannel` w `react.cache` | (b): zastąpić `ChannelService.getById/getByHandle` + `ChannelResolver` (kanał z kontekstu żądania/zasobu). Metody liczników subskrypcji są już per `channelId` (a) |
| `lib/modules/channel/infrastructure/channel.repository.ts:16-23` | `findMainChannel()` po slugu z env | (c) |
| `lib/modules/channel/domain/channel.policy.ts` (cały) | `MainChannelPolicy.isPublicMainChannel` (`isApproved && isPrimary`), `assertVideoBelongsToMainChannel`, `buildPublicMainChannelVideoWhere` | (b): zamienić na `ChannelPolicy.isPubliclyVisible(channel)` (status kanału) i `video.creatorId === channelId` |
| `lib/modules/channel/domain/channel.errors.ts` | `MainChannelNotFoundError/NotApprovedError/NotPrimaryError` | (b) → `ChannelNotFound/ChannelSuspended` |
| `lib/channel/main-channel.service.ts` | przestarzały adapter (`@deprecated`), importowany m.in. przez `app/[locale]/channel/[slug]/page.tsx:12` | (c) |
| `lib/env/validation.ts:31,103-104` | `MAIN_CREATOR_SLUG` na liście wymaganych w produkcji | (c) (po fazie 3) |
| `lib/data/initial-content.ts:3-9`, `prisma/seed.ts` (15 wystąpień) | demo-kanał i seed głównego twórcy | (b) seed wielu kanałów do testów; demo-fallbacki do usunięcia (c) |
| `scripts/check-architecture.ts:25,28,44` | wyjątki z allowlisty uzasadnione cyklem `channel↔video` „przez MainChannelService” | (b): po usunięciu MainChannelService cykl znika, wyjątki do skasowania |

### 1.2 Moduł `video`

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `lib/modules/video/infrastructure/video.repository.ts:93-140,161-259,290-415` | metody `*ForMainChannel(id, mainChannelId)`, `findPublicList(mainChannelId)` z filtrem `creator: {isApproved, isPrimary}` (l. 172-173, 252-253), `findHero`, `createForMainChannel`, `updateForMainChannel`, `archiveVideo`, `clearHero`, `setHero`, `reorder` | (a) – już przyjmują id kanału; zmiana nazw (`…ForChannel`) i zamiana filtra `isPrimary` na status kanału |
| `lib/modules/video/application/create-admin-video.use-case.ts:117,123` | `MainChannelService.getRequired` → `createForMainChannel(…, mainChannel.id)`; komunikat P2003 o „głównym kanale” (l. 72) | (a) + autoryzacja (b): `channelId` z wejścia, `can(actor,'video.create',channel)` |
| `update-admin-video.use-case.ts:25-31,85-88` | kanał główny, `VideoPolicy.isOnMainChannel`, `clearHero(mainChannel.id)` | (a) + autoryzacja |
| `publish-admin-video.use-case.ts:16-19`, `archive-admin-video.use-case.ts:15-26`, `delete-admin-video.use-case.ts:17-24`, `reorder-admin-videos.use-case.ts:12-29`, `resync-admin-video-stats.use-case.ts:23-84`, `get-admin-video-list.use-case.ts:11-14`, `get-admin-video-by-id.use-case.ts:16-19`, `publish-after-asset-ready.use-case.ts:49-51` | ten sam wzorzec | (a) + autoryzacja; `publishAfterAssetReady` jest wołane z workera (aktor `system`) → kanał brać z wiersza wideo |
| `get-public-video-list.use-case.ts:10-13`, `get-hero-video.use-case.ts:10-13` | publiczna lista/Hero kanału głównego | (a) per kanał; Hero strony głównej platformy to nowe pojęcie (b) |
| `lib/modules/video/application/video-search.service.ts:66-74` | wyszukiwarka tylko w kanale głównym z `isApproved/isPrimary` | (b): wyszukiwanie globalne po wszystkich publicznych kanałach + filtr kanału; ranking |
| `lib/modules/video/infrastructure/video-content.service.ts:22-31` | `buildPublicVideoWhere()` = kanał główny + `isApproved/isPrimary` | (b) |
| `video-content.service.ts:41-47` | `findMainCreatorAdminAvatar()` – awatar **pierwszego ADMINA** jako fallback awatara kanału | (c) |
| `video-content.service.ts:60-88` | `getSitemapVideos()` tylko kanał główny | (b) |
| `video-content.service.ts:158-201,203-262` | `getAllVideos()`, `getMainFeaturedVideo()` + wstrzyknięcie awatara admina, gdy `creator.slug === mainCreatorSlug` (l. 185-192, 248-250) | (b) strona główna platformy ≠ kanał |
| `lib/modules/video/domain/video.policy.ts:122-160` | `isOnMainChannel`, `buildPublicWhere(mainChannelId)`, `buildAdminWhere(mainChannelId)` | (a) |
| `lib/modules/video/domain/video.errors.ts` | `VideoNotOnMainChannelError` (kod `VIDEO_NOT_ON_MAIN_CHANNEL`, mapowany w `apps/admin/lib/actions/panel.ts:31`) | (a) zmiana nazwy na `VideoNotInChannelError` |
| `lib/modules/video/infrastructure/fundraising-progress.service.ts:28-36` | suma napiwków „kanału” z `OR: [{creatorId}, {creatorId: null}]` | (b): wiersze z `creatorId=null` (stare) liczyłyby się do **każdego** kanału; po backfillu usunąć gałąź `null`. Docelowo cel zbiórki per film = napiwki przypisane do filmu (nowe `Payment.videoId`) |
| `Video.slug @unique` (`prisma/schema.prisma:553`) | slug globalnie unikalny | decyzja: zostawić globalnie unikalny (prostsze URL-e `/watch/<slug>`), albo `@@unique([creatorId, slug])` + URL `/@handle/<slug>`; rekomendacja: zostawić globalny + krótki `publicId` |

### 1.3 Moduł `channel` (poza rdzeniem)

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `lib/modules/channel/application/channel-layout.service.ts:47-151` | sidebar = filmy kanału głównego; `viewerState = role==='ADMIN' ? "ADMIN"` (l. 56) odblokowuje premiery i `LOGGED_IN` (l. 117, 157) | (a) per kanał + (b) „ADMIN” → „właściciel tego kanału” |
| `lib/modules/channel/application/home-content.loader.ts` | strona główna = podsumowanie kanału głównego + jego filmy + Hero | (b) |
| `lib/modules/channel/infrastructure/creator-content.service.ts:15-21,40,42-46,107-117` | `getCreatorBySlug` zwraca `null` dla każdego sluga ≠ główny; wymaga `isApproved && isPrimary`; awatar fallback z admina; DTO filmów dostaje awatar admina | (b) |
| `lib/modules/channel/application/get-admin-channel-settings.use-case.ts:49-69`, `update-admin-channel-settings.use-case.ts:20-50`, `change-channel-owner.use-case.ts:15-58`, `resync-subscribers.use-case.ts:14` | ustawienia/właściciel kanału głównego, tylko `actor.type==='admin'` | (a) parametr `channelId` + rozdzielenie: superadmin (panel) vs właściciel (studio) |
| `lib/modules/channel/domain/channel-avatar.ts` (§4.22 CLAUDE.md) | `resolveChannelAvatarUrl({ownerImageUrl, adminImageUrl})` – fallback na **pierwszego administratora** | (b): usunąć `adminImageUrl`; dodać `Creator.avatarUrl` (własny awatar kanału) z fallbackiem na awatar właściciela; zaktualizować test `tests/unit/modules/channel/channel-avatar-source.test.tsx` i §4.22 |

### 1.4 Dostęp i odtwarzanie

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `lib/modules/access/application/check-video-access.use-case.ts:31-76` | szuka filmu tylko w kanale głównym, wymaga `isPublicMainChannel(video.creator)`; filmy innych kanałów = `NOT_FOUND` | (b): znaleźć film po id/slugu globalnie, sprawdzić `ChannelPolicy.isPubliclyVisible(video.creator)` (status kanału: aktywny/zawieszony), potem obecne reguły |
| ten sam plik `:63,86,95,102` | `isAdmin` widzi szkice, omija premierę, ma `hasAccess:true` | (b) → `can(actor,'video.preview',video)` = właściciel/członek kanału lub superadmin (patrz §2) |
| `lib/modules/playback/application/playback.service.ts:39-48,196-200,302` | `isAdminPreviewSession`, ominięcie bramki premiery dla admina | (b) jak wyżej |
| `lib/modules/playback/application/self-hls-plan.ts:27,87-117` | `isAdminPreview` w sesji | (a) zmiana nazwy na `isOwnerPreview` (kolumna `VideoPlaybackSession.isAdminPreview` zostaje, semantyka „podgląd zaplecza”) |
| `app/api/videos/[id]/thumbnail/route.ts:47-54` | miniatury szkiców tylko dla `actor.type === "admin"` | (b) → właściciel kanału lub superadmin |
| `workers/hls-edge/worker.mjs:6-8,57-67,157` | token HMAC `videoId/version/exp`, klucz `videos/<videoId>/v/<version>/…` | brak zmian (a); patrz ryzyka (§10) |

### 1.5 Subskrypcje i e-mail

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `lib/modules/subscriptions/application/subscribe.use-case.ts:18-67`, `unsubscribe.use-case.ts:29-70`, `get-subscription-status.use-case.ts:16-31` | subskrypcja zawsze kanału głównego; łączy „obserwuj” z globalną zgodą e-mail (`EmailPreference.marketingEmails`, `recordExplicitContentOptIn`) i synchronizacją Resend Audience (jedna lista) | (b): rozdzielić „obserwuj kanał” (per kanał) od „powiadomienia e-mail o nowych filmach tego kanału” (per subskrypcja, `Subscription.notifyEmail`), zgoda globalna zostaje jako warunek prawny |
| `lib/modules/subscriptions/application/signed-unsubscribe.use-case.ts:52-58` | podpisany link wypisu kasuje subskrypcję kanału głównego | (b): token musi nieść `channelId` (albo „wszystkie”) |
| `app/api/subscriptions/route.ts`, `app/components/SubscribeButton.tsx:49,87` | API bez parametru kanału | (a) dodać `channelId` w ciele/zapytaniu |
| `lib/modules/email/infrastructure/broadcast-audience.ts:20-34` | odbiorcy = subskrybenci kanału z `flags.mainCreatorSlug` (§4.6) | (b): rozsyłka per kanał (twórca) i osobno rozsyłka platformowa (superadmin); `BroadcastEmail` bez `creatorId` |
| `prisma/schema.prisma:1120-1126` | enum `BroadcastRecipientGroup` (`ALL, SUBSCRIBERS, PATRONS, MANUAL, NON_PATRONS`) | (b) dodać zakres kanału (`BroadcastEmail.channelId?`) |
| `lib/modules/email/application/notify-new-user.ts:5` | mail o każdym nowym koncie do `pawel.perfect@gmail.com` | (b) → powiadomienie superadmina (konfiguracja), nie „właściciela kanału” |
| `lib/modules/email/infrastructure/resend-email.transport.ts:24,27`, `lib/modules/email/domain/email-template-registry.ts:19` | nadawca „Pawel Perfect”, linia tożsamości z adresem osoby | (b) nazwa platformy; maile twórców wysyłane „w imieniu platformy, od kanału X” |

### 1.6 Płatności (szczegóły w §6)

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `lib/modules/payments/application/create-checkout-intent.use-case.ts:72-73,118-138` | `creatorId = MainChannelService.getRequired(ctx).id`; `metadata.creatorId`; jedno konto Stripe | (b) |
| `create-checkout-intent.use-case.ts:20-24` | opis intentu „Napiwek dla {APP_NAME}” | (b) „Napiwek dla {channel.name}” |
| `app/components/support/TipRecipientStep.tsx:88-95`, `TipMethodStep.tsx:65` | zakodowany odbiorca „Pawłowi Perfectowi”/„Paweł Perfect” | (b) odbiorca z kontekstu kanału |
| `app/components/ChannelHome.tsx:25,217-236,391-392` | okno napiwku bez parametru kanału | (a) przekazać `channelId` |
| `lib/modules/payments/application/fulfill-payment.use-case.ts:84-87` | `UserPaymentTotal` i `PatronGrant` bez kanału | (b) |

### 1.7 Komentarze

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `Comment.creatorId` (`schema.prisma:899-900`, „Optional for now”) | denormalizacja kanału na komentarzu, ustawiana w `create-video-comment.use-case.ts:104` i `create-creator-reply.use-case.ts:47` | (a) – już per kanał; po backfillu `NOT NULL` |
| `lib/comments-public-author.ts:29-31` | odznaka `ADMIN` z `User.role`, odznaka `AUTHOR` gdy `author.id === video.creator.userId` | „Twórca” jest **już** per film (kto jest właścicielem kanału filmu) – (a). Odznaka `ADMIN` (globalna rola) – (c) albo zamiana na „Zespół platformy” (b) tylko dla kont superadmina na `www` (które docelowo nie istnieją) |
| `lib/modules/comments/infrastructure/comment.repository.ts:211-214` | `findVideoCreatorId` = `Creator.userId` | (b) przy `ChannelMember` „twórca” = członek kanału z rolą `OWNER/MANAGER` |
| `lib/modules/comments/application/create-creator-reply.use-case.ts:13-49` | panel pisze odpowiedź **jako `Creator.userId`** (podszywanie się pod właściciela kanału) | (b): w modelu wielu twórców superadmin nie może pisać jako twórca; „odpowiedz jako twórca” przenieść do studia (aktor = właściciel) |
| `lib/modules/comments/application/list-panel-comments.use-case.ts`, `list-admin-comments`, `moderate-*`, `set-admin-comment-heart`, `toggle-admin-comment-heart`, `resolve-comment-report`, `undo-comment-moderation`, `delete-admin-comment` | moderacja globalna, `actor.type === 'admin'` | (b) dwa zakresy: twórca moderuje swój kanał (studio), superadmin moderuje wszystko (panel) |

### 1.8 Powiadomienia

| Plik | Sprzężenie | Klasa |
|---|---|---|
| `lib/modules/notifications/*`, `NotificationTemplate` (`schema.prisma:538-546`) | szablony globalne, edytowalne przez admina; rodzaje `PATRON/SUPPORT` zakładają jednego odbiorcę napiwków | (b) szablony zostają platformowe, treść z parametrem kanału; nowy rodzaj „nowy film kanału, który obserwujesz”, „ktoś dał napiwek Twojemu kanałowi” (dla twórcy) |
| `lib/modules/patron/application/grant-patron.use-case.ts:24`, `fulfill-payment.use-case.ts:131-151` | „dziękujemy za wsparcie” bez kanału | (b) |

### 1.9 Media, tłumaczenia, admin-content

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `lib/modules/media/application/default-thumbnail.service.ts:15-17` | domyślna miniatura z `Creator.defaultThumbnailUrl` kanału **głównego**, potem `AppSetting default_video_thumbnail` | (a) per kanał filmu, fallback platformowy |
| `lib/modules/admin-content/application/content.ts:76,105` | `getThumbnailSource`, `getChannelLayout` – kanał główny | (a) |
| `lib/modules/admin-content/application/default-thumbnail.ts:53,87` | tylko admin zmienia domyślną miniaturę (globalną) | zostaje superadmin (globalna) + nowa per kanał w studio |
| `lib/modules/admin-content/application/media-uploads.ts:31,64` | okładki/napisy (klucze `videos/<id>/covers|subtitles`) – sprawdzenie istnienia filmu przez use case'y z kanałem głównym | (a) + autoryzacja |
| `lib/modules/translations/application/translations.ts:30,33,170`, `generate-drafts.ts:25,31` | tłumaczenia filmów kanału głównego; `reviewedById` = `AdminUser.id`; komunikat „Szkice AI generuje właściciel kanału” sprawdza `actor.type==='admin'` | (b): tłumacze to dziś konta panelu (`AdminLanguageGrant`); w multi-kanale tłumaczenie per kanał (członek kanału z rolą `TRANSLATOR`) albo platformowe |
| `lib/modules/video-pipeline/application/video-guard.ts:5-14` | `requireVideo()` = film kanału głównego | (b) → `requireVideoForActor(videoId, actor, action)` z polityką |
| `lib/modules/video-pipeline/application/encode-queue.use-cases.ts:126-133` | `getPipelineState` porównuje `video.creatorId` z kanałem głównym | (a) + autoryzacja |

### 1.10 Zdrowie, diagnostyka, skrypty

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `lib/modules/health/application/check-health.use-case.ts:38-55` | `/api/health` liczy „approved/primary creator” i filmy kanału głównego | (b): zdrowie platformy nie zależy od kanału; liczniki kanałów jako informacja |
| `lib/launch/content-diagnostics.ts:9-137`, `scripts/launch-diagnose.ts`, `scripts/diagnose-home-content.ts:39-86` | diagnoza „czy kanał główny istnieje, jest zatwierdzony i primary” | (c)/(b) |
| `apps/admin/app/(panel)/ustawienia/page.tsx:75` | komunikat „Sprawdź … (MAIN_CREATOR_SLUG)” | (b) |
| `playwright.config.ts:10-39` | E2E z `MAIN_CREATOR_SLUG` | (b) |

### 1.11 Strony, SEO, metadane, JSON-LD, OG, teksty

| Plik:linia | Sprzężenie | Klasa |
|---|---|---|
| `app/[locale]/(home)/page.tsx` | strona główna = kanał; OG i `VideoObject` JSON-LD z wybranego filmu (`?v=`); opis domyślny „`${APP_NAME} — kanał wideo`” (l. 65); `embedUrl` = `/?v=slug` | (b): strona główna = odkrywanie (feed); film = `/watch/<slug>` (prawdziwa strona, nie redirect); kanał = `/@handle` |
| `app/[locale]/watch/[slug]/page.tsx` | tylko `redirect` na `/?v=slug` (kanoniczny URL filmu to strona główna) | (b) |
| `app/[locale]/channel/[slug]/page.tsx:25-80` | dla sluga ≠ główny zwraca „Kanał nie znaleziony”; `revalidate = 60` | (b) |
| `app/sitemap.ts:43-56` | jeden kanał (`getConfiguredOrDefaultCreator`) + filmy kanału głównego | (b) sitemap index (kanały, filmy), paginacja |
| `app/layout.tsx:29` | opis „niezależny kanał wideo twórcy” | (b) |
| `app/components/Hero.tsx:273-309` | pasek kanału pod odtwarzaczem, fallback `MAIN_CREATOR_NAME` (l. 292) | (a) |
| `app/components/legal/LegalDocs.tsx:36-111,144,255,350` | Regulamin/Polityka: „Twórcą i administratorem serwisu … jest Paweł Perfect (Twórca)”, administrator danych = osoba fizyczna | (b) całkowicie nowe dokumenty (platforma pośrednicząca, DSA, twórcy jako użytkownicy publikujący, Stripe Connect); podbić `LEGAL_DOCUMENTS_VERSION` |
| `lib/i18n/catalog/*.json` (np. `de.json:16,28,56,57,194,399,400,479,522,523`, `"Paweł Perfect"` l. 253) | teksty „official channel”, „Manage channel”, „An independent creator's video channel…” | (b) nowe klucze we wszystkich 6 katalogach (test parytetu) |
| `lib/auth/config.ts:85-86` | `PASSKEY_RP_NAME = "Pawel Perfect"` | (b) nazwa platformy (zmiana RP name nie psuje kluczy; RP ID zostaje) |
| `lib/constants.ts` (`APP_NAME`, `SITE_TITLE`) | tytuł = adres strony | zostaje |

### 1.12 Podsumowanie klasyfikacji

- **(a) trywialne (parametr `channelId`)**: repozytorium wideo, większość use case'ów wideo, liczniki subskrypcji, domyślna miniatura, `Comment.creatorId`, layout sidebara, ustawienia kanału. Ok. 30 plików.
- **(b) przeprojektowanie**: strona główna/SEO/sitemap/watch/channel, `checkVideoAccess`, wyszukiwarka, subskrypcje+zgody e-mail, rozsyłki, płatności, moderacja dwupoziomowa, tłumaczenia, awatar kanału, teksty prawne. Ok. 60-80 plików.
- **(c) usunięcie**: `flags.mainCreatorSlug`, `MAIN_CREATOR_*`, `findMainChannel`, `findMainCreatorAdminAvatar`, `lib/channel/main-channel.service.ts`, demo-fallbacki (`canUseDemoFallbacks`, `lib/data/initial-content.ts`), `Creator.isPrimary` (migracja czyszcząca), diagnostyka „kanału głównego”, ostrzeżenie `ENABLE_MULTI_CREATOR`.

---

## 2. Sprzężenie „admin = twórca”

### 2.1 Pełna lista sprawdzeń roli/typu admina na `www` (app, lib, middleware; bez `apps/admin`)

Grep `role ===/!== 'ADMIN'`, `isAdmin`, `actor.type ===/!== 'admin'`, `SystemRole.ADMIN`, `role: 'ADMIN'` daje **144 trafienia w 80 plikach**; po odjęciu typów, komentarzy i modułów `admin-*` (czytanych tylko przez panel) zostaje ok. **60 sprawdzeń, które coś bramkują**. Poniżej każde z nich z propozycją. Kolumna „Docelowo”: **OWN** = członek/właściciel kanału zasobu (`can(actor, …, channel)`), **SA** = superadmin (tylko panel), **USR** = każdy zalogowany, **DEL** = usunąć.

#### Tożsamość i konto

| # | Plik:linia | Co bramkuje | Docelowo |
|---|---|---|---|
| 1 | `lib/api/auth.ts:13-14,31-32` | `resolveDbBackedActor`: `role==='ADMIN'` → aktor `{type:'admin'}` | aktor `user` z `channelRoles` (członkostwa) i opcjonalnym `platformRole`; typ `admin` na `www` znika |
| 2 | `lib/api/auth.ts:40-56,80-90` | `resolveDbBackedAdminActor`/`requireAdminActor` | DEL na `www` (zostaje tylko dla audytu, patrz #3) |
| 3 | `lib/modules/audit/application/resolve-admin-audit-context.ts:20-21` | kontekst audytu przez `requireAdminActor()` | SA w panelu / OWN w studiu |
| 4 | `app/api/user/profile/route.ts:25` | `isAdmin` w profilu → link do panelu | zastąpić `channels: [{id, handle, role}]` → link „Studio” (OWN); link do panelu tylko jeśli konto ma powiązanie z `AdminUser` (SA) |
| 5 | `app/components/Navbar.tsx:19,69-87,226` | stan `isAdmin` z profilu | jw. |
| 6 | `app/components/auth/UserMenu.tsx:20-24,94-101,118` | pozycja „Zarządzaj kanałem” → `ADMIN_PANEL_ORIGIN` | „Twoje studio” (OWN) / „Utwórz kanał” (USR) |
| 7 | `app/components/auth/AccountModal.tsx:16-21,80-84` | link „Zarządzaj kanałem” do panelu | jw. |
| 8-12 | `app/api/user/{account:27, avatar:11, export:18, first-sign-in:16, nickname:12}/route.ts` | `actor.type !== "user" && !== "admin"` (czy zalogowany) | USR (po usunięciu typu `admin` warunek upraszcza się) |
| 13 | `app/api/user/account/route.ts:22,49` + `lib/auth/reauth.ts:62-66` | `LAST_ADMIN`: ostatni ADMIN nie może skasować konta | DEL na `www`; zamiast tego: właściciel kanału nie usunie konta bez decyzji o kanale (przekazanie/usunięcie, rozliczenie Connect) – (b) |
| 14 | `app/components/home/home-viewer-data.ts:90` | `userId` dla `user|admin` (limit) | USR |
| 15 | `app/api/videos/[id]/playback-event/route.ts:24` | `userId` dla `user|admin` | USR |

#### Podgląd, dostęp, odtwarzanie

| # | Plik:linia | Co bramkuje | Docelowo |
|---|---|---|---|
| 16 | `check-video-access.use-case.ts:63` | `isAdmin` | `canPreview = can(actor,'video.preview',video)` |
| 17 | `:86` | szkic/niepublikowany widoczny dla admina | OWN (+SA tylko w panelu przez osobny podgląd) |
| 18 | `:95` | admin omija premierę | OWN |
| 19 | `:102` | admin ma zawsze `hasAccess` dla niezarchiwizowanego | OWN |
| 20 | `playback.service.ts:39-48` | `isAdminPreviewSession` (nie licz wyświetleń) | OWN (podgląd właściciela nie liczy się do wyświetleń szkicu) |
| 21 | `playback.service.ts:196-200` | ominięcie bramki premiery | OWN |
| 22 | `playback.service.ts:302` | zapis `isAdminPreview` | OWN |
| 23 | `self-hls-plan.ts:87` | `userId` dla `user|admin` | USR |
| 24 | `record-playback-event.use-case.ts:119` | `userId` dla `user|admin` | USR |
| 25 | `app/api/videos/[id]/thumbnail/route.ts:50-52` | miniatura szkicu tylko admin | OWN |
| 26 | `channel-layout.service.ts:56` | `viewerState = 'ADMIN'` z roli | `'OWNER'` gdy widz jest członkiem kanału, którego sidebar się buduje |
| 27 | `channel-layout.service.ts:117` | premiera odblokowana dla ADMIN w sidebarze | OWN |
| 28 | `channel-layout.service.ts:157` | `isLocked` false dla ADMIN | OWN |
| 29 | `app/components/channel/sidebar-layout-request.ts:17` | typ `viewerState` | zmiana typu |
| 30 | `app/components/PlayerErrorOverlay.tsx:10-17,94`, `VideoPlayer.tsx:79,402-430` | `isAdmin` (na sztywno `false`) pokazuje kody błędów | DEL albo OWN |

#### Komentarze (API na `www`)

| # | Plik:linia | Co bramkuje | Docelowo |
|---|---|---|---|
| 31 | `create-video-comment.use-case.ts:84` | `canModerate = admin || videoCreatorId===userId` (DTO pokazuje ukryte) | OWN |
| 32 | `delete-comment.use-case.ts:39` | moderator = admin lub twórca filmu | OWN (twórca kasuje u siebie) |
| 33 | `get-comment-context.use-case.ts:47-49` | `canModerate` | OWN |
| 34 | `list-comment-replies.use-case.ts:47-49` | `canModerate` | OWN |
| 35 | `list-video-comments.use-case.ts:69-76` | `isGlobalAdmin` → widzi `HIDDEN/HELD` na stronie publicznej | OWN (SA nie potrzebuje tego na `www`) |
| 36 | `pin-comment.use-case.ts:33` | przypięcie: admin lub twórca | OWN |
| 37 | `unpin-comment.use-case.ts:30` | odpięcie | OWN |
| 38 | `update-comment.use-case.ts:55` | `canModerate` (DTO) | OWN |
| 39 | `report-comment.use-case.ts:54` | nie można zgłosić komentarza ADMINA ani twórcy filmu | twórca: zostaje (OWN); ADMIN: DEL (albo SA, jeśli superadmin ma konto na `www`) |
| 40 | `comment.policy.ts:58` | edycja własnego komentarza (`user|admin`) | USR |
| 41 | `comment.policy.ts:65` | `canDeleteComment`: admin zawsze | OWN lub SA (w panelu) |
| 42 | `comment.policy.ts:74` | `canModerateComment`: admin zawsze | OWN lub SA |
| 43 | `lib/comments-public-author.ts:31` | odznaka `ADMIN` w DTO (UI jej nie pokazuje: `app/components/comments/types.ts:6-14` pokazuje tylko `AUTHOR`) | DEL z DTO; odznaka „Twórca” (`:32`) zostaje (OWN) |

#### Subskrypcje, płatności, użytkownicy (www-ścieżki)

| # | Plik:linia | Co bramkuje | Docelowo |
|---|---|---|---|
| 44-46 | `subscribe.use-case.ts:19`, `unsubscribe.use-case.ts:30`, `get-subscription-status.use-case.ts:19` | `userId` dla `user|admin` | USR |
| 47 | `payment.policy.ts:5` | `canCreateCheckout` dla `user|admin` | USR; dodatkowo: nie można napiwkować własnego kanału |
| 48 | `payment.policy.ts:17` | `canManagePaymentSettings` = admin | SA (minima walut) + OWN (ustawienia Connect kanału) |
| 49 | `lib/modules/users/domain/user.policy.ts:5-6,14` | `isAdmin`, admin widzi każdy profil | SA |
| 50 | `get-user-access-profile.use-case.ts:9,32`, `get-actor-access-profile.use-case.ts:19-21` | `isAdmin` z roli | zamienić na role kanałowe |
| 51 | `lib/modules/users/infrastructure/user-admin.service.ts:16-21` | tworzy/podnosi admina z `MAIN_CREATOR_NAME`, `ADMIN_EMAIL` | DEL |
| 52 | `admin-manage-user.use-case.ts:50,113,124,126` | admin nie może być zarządzany; ostatni admin | SA (rola platformowa) – zostaje w panelu |
| 53 | `admin-user-safety.use-case.ts:13,35` | wyciszenie, nie można wyciszyć admina | SA (panel) + nowy zakres OWN: „zablokuj użytkownika na moim kanale” (nowa tabela `ChannelBan`) |
| 54-55 | `email/application/broadcasts.use-cases.ts:81,143` | `createdById` dla `admin|user` | OWN (rozsyłka kanału) / SA (platformowa) |
| 56-57 | `patron.policy.ts:6,11`, `admin-set-supporter.use-case.ts:23,35`, `revoke-patron.use-case.ts:29` | ręczne nadanie/odebranie „wspierającego” | SA, ale per kanał (`PatronGrant.channelId`) albo DEL |
| 58 | `payments/application/admin-refund.use-case.ts:80` | `refundedById` z admina | SA (i opcjonalnie OWN dla swojego kanału) |
| 59 | `video-pipeline/application/video-guard.ts:17` | `requestedById` tylko dla admina | każdy aktor z uprawnieniem (OWN/SA) |
| 60 | `translations/application/translations.ts:30`, `generate-drafts.ts:25` | recenzent = admin; szkice AI tylko „właściciel” (`admin` bez `allowedLanguages`) | OWN (tłumaczenia filmów swojego kanału) + SA |

Dodatkowo kanały/ustawienia (`channel/application/*`: `change-channel-owner.use-case.ts:15,30,57`, `get-admin-channel-settings.use-case.ts:49`, `update-admin-channel-settings.use-case.ts:20`, `resync-subscribers.use-case.ts:14`) i wszystkie `lib/modules/admin-*` (`admin-community/*`, `admin-overview/application/alert-thresholds.ts:21,40`, `admin-revenue/queries.ts:10`, `admin-security/audit-log.ts:38,99`, `email/application/admin-communication.ts:45`) → **SA** (panel); ustawienia kanału dodatkowo **OWN** w studiu.

### 2.2 Wniosek dla modelu ról

- Na `www` typ aktora `admin` powinien zniknąć. Superadmin pracuje w `apps/admin` (osobna tożsamość). Jeśli właściciel platformy chce mieć też konto widza na `www`, to jest zwykły `user` (bez nadprawnień).
- `User.role = ADMIN` (`SystemRole`) traci sens; zostawić kolumnę do migracji czyszczącej albo przemianować na `platformRole` (np. `STAFF` do oznaczeń w moderacji), ale **nie** jako bramkę do treści kanałów.
- Odznaka „Twórca” już jest liczona per film (`toPublicCommentAuthor(author, video.creator.userId)`). Przy `ChannelMember` → „Twórca” = autor jest członkiem kanału filmu z rolą `OWNER` (lub `MANAGER`), co wymaga dołączenia członków do zapytania (`findVideoCreatorId` → `findVideoChannelMemberIds`).

---

## 3. Cykl życia filmu i pipeline

### 3.1 Przebieg dziś (tylko panel)

1. **Utworzenie szkicu**: `apps/admin/app/(panel)/tresci/actions.ts` `createFilmAction` → `createAdminVideo(input, ctx)` (`lib/modules/video/application/create-admin-video.use-case.ts:110-163`): kanał = `MainChannelService.getRequired`, `repository.createForMainChannel(...)`, audyt `VIDEO_CREATED`. Domyślna miniatura `/logo.png`.
2. **Upload oryginału** (bezpośrednio do prywatnego R2, multipart, wznawialny):
   - `POST apps/admin/app/api/videos/[id]/original-upload/multipart/route.ts` → `startOriginalUpload` (`lib/modules/video-pipeline/application/original-upload.use-cases.ts:73`): `validateUploadRequest` (rozszerzenie z listy, rozmiar 64 KiB…`maxUploadBytes()` = 10 GiB lub `VIDEO_UPLOAD_MAX_BYTES` ≤ 50 GiB, deklarowany typ `video/*`), `requireVideo` (kanał główny), klucz `originals/<videoId>/<now>.<ext>` (`upload-policy.ts:173-175`), wiersz `VideoOriginal` `UPLOADING`.
   - `…/multipart/parts/route.ts` → `presignOriginalParts` (≤ 50 części na raz, TTL 2 h).
   - `GET …/multipart` → `listOriginalParts` (wznowienie); `DELETE` → `abortOriginalUpload`.
   - `…/multipart/complete/route.ts` → `completeOriginalMultipart` (l. 185): weryfikacja tego, co **faktycznie** jest w R2: rozmiar deklarowany vs rzeczywisty, limit, **magic bytes** (`sniffVideoContainer`, `SNIFF_BYTES=1024`; mp4/mkv/avi/ts/m2ts). Potem `enqueueEncode`.
   - Porzucone uploady: cron `abandon-stale-originals` → `abandonStaleOriginalUploads` (l. 270).
3. **Kodowanie**: `enqueueEncode` (`encode-queue.use-cases.ts:81`), idempotencja `"<originalId>:<n>"`. Worker `scripts/video-worker.ts` → `worker-loop.ts` → `EncodeJobRepository.claimNext` (`encode-job.repository.ts:44-77`): `FOR UPDATE SKIP LOCKED` + `pg_try_advisory_xact_lock(947201)` + `NOT EXISTS RUNNING` = **jedno kodowanie na cały serwis**, kolejność `ORDER BY createdAt ASC`. `process-encode-job.ts` (ffmpeg w kontenerze `encoder`), wynik do bucketa `polutek-hls` pod `videos/<videoId>/v/v<N>/…` (`keys.ts:6-12`), master na końcu. `finalize-self-hls.ts:29` (aktor `system`) tworzy `VideoAsset` + `VideoPlaybackRoute`, potem `publishAfterAssetReady` (kanał główny!).
4. **Okładka**: `apps/admin/app/api/videos/[id]/cover/route.ts` → `uploadVideoCover` (`admin-content/application/media-uploads.ts:31`): JPG/PNG/WebP ≤ 5 MB, magic bytes, klucz `videos/<id>/covers/<sha>.<ext>` w prywatnym R2; publiczna kopia przy publikacji (`syncPublicThumbnail`, cron `sync-public-thumbnails`).
5. **Napisy**: `…/subtitles/[lang]/route.ts` → `uploadVideoSubtitle` (`media-uploads.ts:64`): walidacja WebVTT, `videos/<id>/subtitles/<hash>.vtt`, serwowane z publicznego hosta R2.
6. **Publikacja**: `filmStatusAction` → `publishAdminVideo` (blokady `VideoPolicy.getPublicationBlockers`), premiera przez `updateAdminVideo` → `publishAdminVideo`.
7. **Układ/Hero**: `saveLayoutAction` → `saveChannelLayout` (`admin-content/application/content.ts:118-140`) → `reorderAdminVideos` + `updateAdminVideo({isMainFeatured})`.
8. **Usunięcie**: `deleteFilmAction` (wpisany slug + świeże potwierdzenie, `requireStepUp`) → `deleteVideoWithStorage` (`content.ts:84-101`): snapshot R2 → `deleteAdminVideo` (kaskada) → `purgeVideoStorage` → kasowanie napisów publicznych.

### 3.2 Co jest dziś tylko w panelu i musi przejść za autoryzację właściciela kanału

Wszystkie trasy `apps/admin/app/api/videos/[id]/*` (6 tras) i akcje `tresci/actions.ts` (`createFilmAction`, `saveFilmAction`, `filmStatusAction`, `deleteFilmAction`, `encodeAction`, `removeSubtitleAction`, `saveLayoutAction`) oraz `ustawienia/actions.ts` (`saveChannelAction`, `removeDefaultThumbnailAction`, `resyncSubscribersAction`). Use case'y są wspólne, więc **studio na `www`** może wołać te same funkcje, ale dopiero po:
- dodaniu do każdego use case'u jawnego `channelId` (albo wyprowadzenia go z `videoId`) i wywołania `authorize(ctx, 'video.update', {channelId})` na początku (nie w trasie);
- zmianie `requireVideo()` (`video-guard.ts`) na wersję z polityką;
- usunięciu założenia, że `ctx.actor.type === 'admin'` (np. `actorId()` w `video-guard.ts:16-18`, `translations.ts:30`);
- sprawdzeniu limitów (kwota miejsca, liczba filmów w kolejce, rozmiar).

Uwaga na CLAUDE.md §4.14 („Nie dodawaj tras ani UI administratora do `www`”) i test `tests/unit/legacy-admin-retired.test.ts`: studio twórcy **nie** jest administracją platformy; trzeba przeformułować regułę („administracja platformy tylko w panelu; zarządzanie własnym kanałem w `/studio` za polityką kanału”) i zaktualizować test (ścieżki `app/[locale]/studio/**`, `app/api/studio/**` jako dozwolone).

### 3.3 Klucze R2

| Obiekt | Klucz | Kanał w kluczu? |
|---|---|---|
| Oryginał | `originals/<videoId>/<epochMs>.<ext>` (bucket `polutek`) | nie |
| HLS | `videos/<videoId>/v/v<N>/…` (bucket `polutek-hls`) | nie |
| Okładka | `videos/<videoId>/covers/<sha256>.<ext>` (prywatny) + kopia publiczna | nie |
| Napisy | `videos/<videoId>/subtitles/<hash>.vtt` (publiczny) | nie |
| Domyślna miniatura | `settings/default-video-thumbnail/<hash>.<ext>` | globalna |

Rekomendacja: **nie dodawać** `channelId` do kluczy. `videoId` jest niezmienny, a film może zmienić kanał (przekazanie kanału, scalenie) bez kopiowania obiektów. Rozliczenie miejsca per kanał liczyć z bazy (`VideoOriginal.sizeBytes`, `VideoAsset.sizeBytes` są już zapisywane; dodać rozmiary okładek/napisów albo okresowy `ListObjects` po prefiksie `videos/<id>/`). Nowe obiekty per kanał (awatar, baner kanału) pod `channels/<channelId>/avatar/<hash>.<ext>`.

### 3.4 Sprawiedliwość kolejki i kwoty

- Brak czegokolwiek per twórca: FIFO globalne, jedno zadanie naraz (`encode-job.repository.ts:30-31,62-73`). Jeden twórca z 20 długimi filmami blokuje wszystkich na godziny.
- Propozycja: kolumna `VideoEncodeJob.channelId` (denormalizacja, addytywna) i wybór „najstarsze zadanie kanału, który najdawniej był obsłużony” (round-robin: `DISTINCT ON (channelId)` + `ORDER BY lastServedAt`), limit zadań `QUEUED` na kanał, priorytet dla kanałów zweryfikowanych. Druga maszyna/kolejka koderów dopiero przy skali.
- Kwoty: brak. Dodać `ChannelQuota` (lub kolumny na kanale): `maxStorageBytes`, `maxUploadBytes`, `maxVideoDurationSec`, `maxUploadsPerDay`, `maxQueuedJobs`; egzekwować w `startOriginalUpload` (przed presign) i w `completeOriginalMultipart` (po rzeczywistym rozmiarze), czas trwania po `ffprobe` w workerze (`sourceInfo`).
- Walidacja: rozmiar i magic bytes są dobre; dla uploadów od obcych twórców dodać: limit rozdzielczości/czasu (ffprobe), odrzucanie wielu strumieni wideo, skan treści (CSAM hash, np. PhotoDNA/Cloudflare CSAM Scanning dla obrazów) i kolejkę moderacji przed publikacją dla nowych kanałów.

### 3.5 Co zakłada Worker `workers/hls-edge`

- Token = HMAC(`HLS_TOKEN_SECRET`, `"<videoId>/<version>/<exp>"`), TTL 6 h (`self-hls-token.service.ts:14`), klucz cache bez tokenu. Nie zna kanałów i nie musi.
- Skutki dla wielu kanałów: (1) zawieszenie kanału/filmu nie unieważnia już wydanych tokenów (do 6 h) – jeśli potrzebne szybkie zdjęcie (np. nakaz usunięcia), trzeba: skasować obiekty HLS albo dodać listę odwołań (KV `revoked:<videoId>`) sprawdzaną w Workerze, albo skrócić TTL i odświeżać; (2) Workers Free = 100 tys. żądań/dobę (STATUS.md) – przy wielu twórcach to pierwszy twardy limit; (3) cache krawędzi trzyma segmenty usuniętego filmu do czasu wygaśnięcia – przy usuwaniu prawnym trzeba purge'ować cache po prefiksie.

---

## 4. Architektura autoryzacji dziś

### 4.1 Aktorzy

- Typ: `lib/modules/shared/actor.ts` – `guest | user{userId, onboardingPending?} | admin{userId} | system{reason}`.
- `www`: `lib/api/auth.ts` – `getActorFromAuth()` → sesja Better Auth (`lib/auth/server.ts`) → `resolveDbBackedActor(userId)` czyta `User.role/isDeleted/onboardingPending` (§4.5: baza jest autorytatywna). `requireAdminActor()` z `auth({fresh:true})`.
- Panel: `apps/admin/lib/actions/panel.ts:19-28` `panelContext(viewer)` i `apps/admin/lib/api/panel-route.ts:19-24` `panelRouteContext(request)` tworzą `{type:"admin", userId: AdminUser.id}`; TRANSLATOR → `ctx.allowedLanguages`. `apps/admin/lib/community.ts:12` tworzy sztucznego aktora `{type:"admin", userId:"panel-read"}` do odczytów.
- **Problem tożsamości:** pole `userId` w aktorze `admin` raz jest `User.id` (www), raz `AdminUser.id` (panel). Trafia do `AuditLog.actorUserId`, `VideoEncodeJob.requestedById`, `Payment.refundedById`, `PatronGrant.grantedById/revokedById`, `VideoTranslation.reviewedById`, `BroadcastEmail.createdById`. Nie ma mapowania `AdminUser ↔ User` (panel tworzy konto właściciela z `ADMIN_OWNER_EMAIL`, `apps/admin/lib/auth/access-session.ts:20`; `apps/admin/lib/config.ts:83`).

### 4.2 Gdzie są sprawdzenia

- **W trasach/akcjach panelu**: `requireAdmin()` (`apps/admin/lib/auth/guard.ts`), `requireStepUp()`, proxy `apps/admin/proxy.ts` (JWT Access, rola TRANSLATOR tylko na `TRANSLATOR_PATHS`, `apps/admin/lib/auth/roles.ts:22-26`).
- **W use case'ach**: niespójnie. Moduły `admin-*`, `comments` (moderacja), `channel` (ustawienia), `users`, `email`, `patron`, `translations` mają lokalne `if (ctx.actor.type !== "admin")` z różnymi skutkami (`fail(AppError 403)`, `fail({type:"UNAUTHORIZED"})`, `throw AppError`, `return []`/`null`). Moduł `video` i `video-pipeline` **nie mają żadnego** (polegają na trasie). `comments` dla akcji użytkownika ma porządną klasę `CommentPolicy` (`lib/modules/comments/domain/comment.policy.ts`).
- **Polityki domenowe istnieją punktowo**: `CommentPolicy`, `PaymentPolicy`, `PatronPolicy`, `UserPolicy`, `VideoPolicy` (stan, nie uprawnienia), `MainChannelPolicy`. Brak centralnego `can()`.

### 4.3 Propozycja warstwy polityk

**Miejsce:** nowy moduł `lib/modules/authz/` (domain + application), importowany przez barrel `@/lib/modules/authz` (bramka architektury już tego wymaga, `scripts/check-architecture.ts:74-90`).

```
lib/modules/authz/
  domain/
    actions.ts          // union typów akcji: 'channel.create' | 'channel.update' | 'video.create' | 'video.update'
                        // | 'video.publish' | 'video.delete' | 'video.preview' | 'video.upload' | 'comment.moderate'
                        // | 'comment.pin' | 'comment.reply_as_creator' | 'payout.manage' | 'refund.issue'
                        // | 'broadcast.send' | 'analytics.read' | 'platform.*' ...
    principal.ts        // Principal = guest | user{userId, memberships: Map<channelId, ChannelRole>, flags} | staff{adminUserId, role} | system
    resources.ts        // ChannelRef{id, status}, VideoRef{id, channelId, status}, CommentRef{id, videoId, channelId}
    policy.ts           // czyste: can(principal, action, resource): Decision {allow, reason}
    matrix.ts           // tabela rola × akcja (OWNER/MANAGER/EDITOR/MODERATOR/TRANSLATOR + staff OWNER/MODERATOR/SUPPORT)
  application/
    authorize.ts        // authorize(ctx, action, resource) → ładuje brakujące fakty (członkostwo, status kanału) i zwraca fail(Forbidden)
    load-principal.ts   // memberships z ChannelMember (jedno zapytanie, cache per request)
  index.ts
```

Zasady:
1. **Sprawdzenie w use case'ie, nie w trasie** (trasa tylko buduje kontekst). Każdy mutujący use case zaczyna od `const denied = await authorize(ctx, 'video.update', video); if (denied) return fail(denied)`.
2. `AppContext.actor` rozszerzyć o `principal` (albo zamienić typ `Actor` na `Principal` z kompatybilnym `type`): `user` niesie członkostwa (ładowane leniwie w `authorize`, nie w każdym żądaniu); `staff` = konto panelu (`AdminUser.id`), osobny typ, żeby `userId` przestał znaczyć dwie rzeczy.
3. `policy.ts` czyste i bez I/O (testowalne macierzą, patrz §8). `authorize.ts` w application dociąga fakty.
4. Bramka architektury: dodać regułę, że pliki `lib/modules/{video,video-pipeline,channel,comments,payments,admin-content,translations,email}/application/*.ts`, które piszą do bazy (`writeTransaction|\.create\(|\.update`), muszą importować `authorize` z `@/lib/modules/authz` albo być na allowliście (worker/cron z aktorem `system`). Wzór: istniejąca `checkLegacyChannelAdapter()` w `scripts/check-architecture.ts:105-125`.
5. `apps/admin` też woła te same use case'y z aktorem `staff`; macierz daje `staff OWNER` uprawnienia platformowe (moderacja, zawieszenie, zwroty), ale **nie** „pisz jako twórca” ani „zmieniaj konto wypłat kanału”.
6. Widoczność publiczna (status kanału, status filmu, premiera, poziom) zostaje w `checkVideoAccess`; polityka `can()` dotyczy działań zaplecza i podglądu.

---

## 5. Panel administratora (`apps/admin`)

### 5.1 Ekrany i zakres

| Ekran (ścieżka) | Źródło danych | Dziś | Co potrzebne dla „wszystkich kanałów” |
|---|---|---|---|
| Dzisiaj `/` (`app/(panel)/page.tsx`, `lib/overview.ts`, `lib/modules/admin-overview`) | globalne liczby, wpłaty, komentarze, system | globalny | kafle per platforma + „nowe kanały do weryfikacji”, „zgłoszenia filmów/kanałów”, „kanały z błędami Connect” |
| Analityka `/analityka` (`lib/modules/admin-analytics`, telemetria) | `telemetry.r_video_*` po `video_id`, `VideoPlaybackSession` | globalny, bez filtra | filtr kanału (join `Video.creatorId`), ranking kanałów |
| Treści `/tresci`, `/tresci/[slug]/{edycja,jakosc,analityka,komentarze,tlumaczenia}`, `/tresci/nowy`, `/tresci/uklad` | `admin-content`, `video`, `video-pipeline` przez `MainChannelService` | **jeden kanał** | lista filmów wszystkich kanałów z filtrem i kolumną kanału; edycja tylko moderacyjna (zmiana statusu, ukrycie, zdjęcie, ostrzeżenie); `nowy` i `uklad` przenieść do studia (superadmin nie ma kanału) |
| Społeczność `/spolecznosc`, `/spolecznosc/u/[id]` (`admin-community`, `comments/list-panel-comments`) | komentarze, zgłoszenia, użytkownicy | globalny (komentarze wszystkich filmów = jednego kanału) | filtr kanału; `replyAsCreatorAction`, `setHeartAction` → usunąć z panelu (podszywanie się pod twórcę) lub ograniczyć do kanału platformy |
| Przychody `/przychody` (`admin-revenue`, `payments/list-admin-payments`), eksport `api/export/payments` | `Payment` | globalny | kolumna kanału, filtr, sumy per kanał, prowizja platformy, stan kont Connect, przelewy (`Transfer`/`Payout`), spory |
| Komunikacja `/komunikacja` (`email`, `notifications`) | rozsyłki, szablony | jedna grupa odbiorców (kanał główny) | rozsyłki platformowe (wszyscy z kontem i zgodą) vs nadzór nad rozsyłkami kanałów (limity, wstrzymanie) |
| System `/system`, `/system/r2` | host-status, R2, kolejka | globalny | kolejka kodowania z kolumną kanału, zużycie miejsca per kanał |
| Bezpieczeństwo `/bezpieczenstwo` (`admin-security/audit-log`) | `AuditLog` | globalny | filtr kanału (`AuditLog` nie ma `channelId`: dodać) |
| Premiera na żywo `/premiera` (`lib/live-*.ts`) | jeden film na żywo | jeden kanał | per kanał lub do studia |
| Ustawienia `/ustawienia` (`channel/*`, `default-thumbnail`, progi, minima walut) | ustawienia kanału głównego + globalne | mieszany | rozdzielić: „Ustawienia platformy” (minima, progi, domyślna miniatura, prowizja) i nowy ekran **Kanały** |
| Tłumaczenia `/tlumaczenia`, `/tlumaczenia/[slug]` (`translations`) | filmy kanału głównego | jeden kanał | per kanał (studio) albo platformowy zespół tłumaczy z filtrem kanału |
| API: `search`, `live`, `jobs/morning-report`, `email/preview`, `settings/default-thumbnail`, `spolecznosc/uzytkownicy/export`, `export/audit` | – | globalne | wyszukiwarka z kanałami |

### 5.2 Nowe ekrany

- **Kanały** (lista): handle, nazwa, właściciel, status (`PENDING_REVIEW/ACTIVE/LIMITED/SUSPENDED/BANNED/DELETED`), liczba filmów, miejsce, subskrybenci, stan Connect (`charges_enabled/payouts_enabled/requirements`), zgłoszenia, data utworzenia; filtry i sortowanie.
- **Kanał – szczegóły**: profil, członkowie, filmy, kwoty (edycja), historia moderacji (strajki), zgłoszenia, przychody i przelewy, akcje: zatwierdź, ogranicz, zawieś (z powodem dla użytkownika – DSA „statement of reasons”), przywróć, przekaż właściciela, wymuś wylogowanie z Connect, usuń kanał (dwuetapowo, `requireStepUp`).
- **Zgłoszenia** (filmy, kanały, komentarze) – kolejka z SLA.
- Globalny **przełącznik kanału** w nagłówku panelu (filtr kontekstu dla Treści/Analityki/Przychodów/Społeczności), przechowywany w URL (`?kanal=<handle>`).

### 5.3 Tożsamość panelu

Panel ma osobną instancję Better Auth (`apps/admin/lib/auth/auth.ts`), tabele `AdminUser/AdminSession/AdminAccount/AdminPasskey/AdminTwoFactor/AdminEnrollment/AdminAuthEvent/AdminLanguageGrant`, logowanie Cloudflare Access (`ADMIN_AUTH_MODE=access`, `apps/admin/proxy.ts`), role `OWNER|TRANSLATOR` (`apps/admin/lib/auth/roles.ts`). Aktor use case'ów: `{type:"admin", userId: AdminUser.id}`. **Nie ma** powiązania z `User`, więc dziś „odpowiedź twórcy” z panelu pisze jako `Creator.userId`. Dla superadmina bez kanału to jest pożądane rozdzielenie: zostawić osobną tożsamość, zamienić typ aktora na `staff` i rozszerzyć role panelu (`OWNER`, `MODERATOR`, `SUPPORT`, `FINANCE`, `TRANSLATOR`), bo przy wielu kanałach moderację będą robić inne osoby niż właściciel platformy. Tłumacze (`TRANSLATOR` + `AdminLanguageGrant`) to dziś konta panelu – przy tłumaczeniach per kanał trzeba zdecydować, czy tłumacz jest członkiem kanału (studio) czy pracownikiem platformy (panel).

---

## 6. Płatności

### 6.1 Przebieg dziś

1. `POST app/api/checkout/create-intent/route.ts` (limit `checkout:<userId>`, akceptacja regulaminu `recordTermsAcceptance`, walidacja kwoty przez `PaymentCurrencySetting.minAmountMinor`) → `createCheckoutIntent` (`lib/modules/payments/application/create-checkout-intent.use-case.ts:53-138`): jeden `requestId` = jeden `Payment` = jeden `PaymentIntent`; `creatorId = MainChannelService.getRequired(ctx).id` (l. 72-73); Stripe Customer na koncie platformy (`User.stripeCustomerId`), `automatic_payment_methods`, `metadata {userId, paymentId, requestId, creatorId}`, klucz idempotencji `payment-intent-<paymentId>`. Zmiana kwoty aktualizuje ten sam intent.
2. Sukces → `fulfillPayment()` (`fulfill-payment.use-case.ts`) z trzech miejsc: webhook (`handle-stripe-webhook.use-case.ts:124-140`), szybka ścieżka `GET app/api/payments/[paymentId]/route.ts` (`get-payment-status`/`reconcile-payment`), cron `GET /api/cron/stripe-reconciliation` (co 15 min; `reconcile-payment.use-case.ts:48-77` – `paymentIntents.retrieve`, anulowanie porzuconych po 24 h). CAS na statusie, `incrementUserPaymentTotal(userId, currency, amount)`, `ensureSupporterGrant` (`PatronGrant`, „wpłacił = patron”), podziękowanie mailem i powiadomieniem.
3. Webhook `app/api/webhooks/stripe/route.ts`: jeden sekret `STRIPE_WEBHOOK_SECRET`, sprawdzenie trybu live/test po prefiksie klucza (`secretKeyIsLive`, l. 33-38), deduplikacja `StripeEvent` (`stripe-event-lock.service.ts`), typy: `payment_intent.succeeded|payment_failed|canceled`, `charge.refunded`, `charge.refund.updated`, `refund.created|updated|failed`, `charge.dispute.created|updated|closed`.
4. Zwroty z panelu: `przychody/actions.ts refundAction` → `adminRefund` (`admin-refund.use-case.ts`): `syncRefundsFromStripe` przed decyzją, audyt `PAYMENT_REFUND_REQUESTED` przed ruchem pieniędzy, `stripe.refunds.create` z kluczem idempotencji (l. 156), `handleRefund` aktualizuje `refundedAmountMinor`, `UserPaymentTotal`, `revokeSupporterGrantIfNoPaidTips`. Spory: `admin-dispute-sync.use-case.ts:49-56` (`charges.list`, `disputes.list`).
5. RODO: `StripeCustomerAnonymization` + `stripe.customers.update` (`stripe-customer-anonymization.use-case.ts:93`).
6. Pasek zbiórki: `fundraising-progress.service.ts` sumuje `Payment` po `creatorId` (+ `null`) od `fundraisingStartAt`, cache 60 s w pamięci procesu.

### 6.2 Zakodowane założenia „jedno konto”

- `getStripeClient()` (`infrastructure/stripe-client.ts`) – jeden klucz, bez nagłówka `Stripe-Account`.
- Webhook tylko dla zdarzeń konta platformy (Connect wymaga osobnego endpointu z „Listen to events on Connected accounts” albo flagi i osobnego sekretu).
- `tipIntentDescription` = „Napiwek dla {APP_NAME}”; `statement_descriptor` niezdefiniowany (będzie platformy).
- `PatronGrant` (`schema.prisma:225-242`) i `UserPaymentTotal` (`:1040-1049`, `@@unique([userId, currency])`) bez kanału; `NotificationPreference.patronEnabled` globalne; maile „become patron” globalne.
- `PaymentCurrencySetting` globalne (minima) – to może zostać platformowe.
- `fundraising` liczy `creatorId: null` jako napiwki kanału.
- UI: `TipRecipientStep.tsx:88-95` „Pawłowi Perfectowi”, `TipMethodStep.tsx:65`.
- Prawo/produkt: CLAUDE.md §1, §4.1 („`PatronGrant` to prywatna ewidencja właściciela”), §4.10 („Jedno minimum na walutę”), dokumenty prawne (Twórca = Paweł Perfect, „nie wystawia faktur”, „Płatności obsługuje Stripe”).

### 6.3 Docelowo: Stripe Connect

**Model:** konta **Express** (Stripe robi KYC i panel wypłat twórcy) i **destination charges** (`transfer_data.destination = acct_…`, `on_behalf_of = acct_…` żeby twórca był stroną rozliczenia, opcjonalnie `application_fee_amount`). Uzasadnienie: Customer i PaymentIntent zostają na koncie platformy, więc obecne `createCheckoutIntent`, `reconcile-payment`, deduplikacja i `fulfillPayment()` działają prawie bez zmian; refund i spory zostają po stronie platformy (platforma odpowiada za ujemne salda – ryzyko finansowe, trzeba rezerw/opóźnienia wypłat). Alternatywa „direct charges” wymagałaby klonowania Customerów na każde konto połączone, `Stripe-Account` w każdym wywołaniu i zdarzeń Connect do realizacji płatności – więcej zmian.

**Gdzie wchodzi kanał i konto połączone:**
1. `app/api/checkout/create-intent/route.ts` + schemat wejścia: `channelId` (i opcjonalnie `videoId`) z UI; walidacja: kanał `ACTIVE`, `StripeConnectedAccount.chargesEnabled`, widz ≠ członek kanału.
2. `createCheckoutIntent`: zamiast `MainChannelService` → `channelId` z wejścia; `Payment.creatorId` (już jest) + nowe `Payment.connectedAccountId`, `applicationFeeMinor`, `videoId?`; `paymentIntents.create({... transfer_data:{destination}, on_behalf_of, application_fee_amount, metadata:{channelId}})`. `reuseAttempt`: jeśli `channelId` próby ≠ kanał wiersza → nowa próba. Uwaga: przy `on_behalf_of` dostępne metody płatności (BLIK, Przelewy24) zależą od kraju i możliwości konta twórcy.
3. `fulfillPayment`: walidować `metadata.channelId` z wierszem (jak dziś `userId`), `UserPaymentTotal` → per (user, channel, currency) albo nowa tabela `ChannelSupporterTotal`; `PatronGrant.channelId`; podziękowanie z nazwą kanału; powiadomienie twórcy („otrzymałeś napiwek”).
4. Webhook: drugi endpoint `POST /api/webhooks/stripe-connect` z `STRIPE_CONNECT_WEBHOOK_SECRET` (zdarzenia z `event.account`): `account.updated` (aktualizacja `chargesEnabled/payoutsEnabled/requirements` w `StripeConnectedAccount`), `account.application.deauthorized`, `capability.updated`, `payout.paid|failed` (informacyjnie), `transfer.reversed`. Zdarzenia płatności (`payment_intent.*`, `charge.refunded`, `charge.dispute.*`) przy destination charges przychodzą nadal na konto platformy – istniejący handler zostaje. `StripeEvent` zostaje wspólną tabelą deduplikacji (id zdarzeń są globalnie unikalne), dodać kolumnę `account`.
5. Zwroty (`admin-refund.use-case.ts:156`): `refunds.create({payment_intent, amount, reverse_transfer: true, refund_application_fee: <decyzja>})`; jeśli saldo twórcy jest za małe, odwrócenie transferu się nie uda albo zrobi ujemne saldo – obsłużyć błąd i alert. Kto może zwracać: superadmin (panel) i opcjonalnie właściciel kanału (studio, polityka `refund.issue`).
6. Spory: `charge.dispute.created` → przy destination charges kwota sporu i opłata idą z salda platformy; polityka odzyskania od twórcy (`transfers.createReversal`) i zapis w ledgerze.
7. Uzgadnianie (cron `stripe-reconciliation`): bez zmian dla intentów; nowe zadanie „sync connected accounts” (raz na dobę `accounts.retrieve` dla kont z `requirements.currently_due`), oraz sprawdzenie, że każda `SUCCEEDED` płatność ma `transfer` (`charge.transfer`).
8. Onboarding twórcy (studio): `accounts.create({type:'express', country, capabilities:{card_payments, transfers}})`, `accountLinks.create({type:'account_onboarding', return_url, refresh_url})`, link do `loginLinks.create` (panel Express). Hostowane strony Stripe – bez zmian CSP; przy wbudowanych komponentach Connect (`@stripe/connect-js`) trzeba dopisać `connect-js.stripe.com` do `script-src/frame-src` w `lib/utils/security.ts`.
9. Fundraising: liczyć po `Payment.videoId` (lub `creatorId`) bez gałęzi `null`; cache kluczować kanałem (już jest `creatorId` w kluczu, `fundraising-progress.service.ts:45`).
10. Ledger: dodać `ChannelLedgerEntry` (napiwek brutto, prowizja, opłata Stripe, zwrot, odwrócenie, spór) – bez tego panel przychodów i studio nie pokażą wiarygodnych sald; źródłem prawdy o saldzie pozostaje Stripe (`balance_transaction`).

---

## 7. Model danych

### 7.1 Modele dotykające kanału dziś

| Model | Pole | Uwagi |
|---|---|---|
| `Creator` (`schema.prisma:429-449`) | `id, userId, slug @unique, name, bio, defaultThumbnailUrl, subscribersCount, displaySubscribersCount, isApproved, isPrimary` | jeden właściciel (`userId`), brak statusu, handle = `slug` |
| `User` | `creators Creator[]` | relacja 1:N już jest |
| `Video` | `creatorId` (wymagane, indeksy `[creatorId,status]`, `[creatorId]`), `isMainFeatured`, `showInSidebar`, `sidebarOrder`, fundraising | Hero/sidebar są per kanał (repozytorium już tak filtruje) |
| `Payment` | `creatorId?` | do backfillu + nowe pola Connect |
| `Comment` | `creatorId?` (`onDelete: SetNull`) | do backfillu |
| `Subscription` | `creatorId` (`@@unique([userId, creatorId])`) | gotowe per kanał |

### 7.2 Modele, które potrzebują `channelId` (nowe kolumny, addytywnie)

`PatronGrant`, `UserPaymentTotal` (albo zastąpić), `BroadcastEmail`, `BroadcastEmailRecipient` (pośrednio), `AuditLog` (`channelId?` do filtrów), `VideoEncodeJob` (`channelId` dla sprawiedliwości kolejki), `Notification` (`channelId?`), `CommentReport` (pośrednio przez komentarz; dodać dla szybkich filtrów), `StripeEvent` (`account?`), `VideoTranslation` (pośrednio przez film – nie trzeba), `EmailPreference` (zostaje globalne, zgoda per kanał na `Subscription`).

### 7.3 Proponowany schemat docelowy

**Nazwa:** zostawić tabelę `Creator` (Prisma `@@map` niepotrzebne) i w kodzie domenowym nazywać ją `Channel` (typ/alias), albo `model Channel @@map("Creator")` – zmiana nazwy modelu w Prisma bez zmiany tabeli jest addytywna dla bazy, ale dotyka ~60 plików (`prisma.creator`). Rekomendacja: **nie zmieniać nazwy tabeli**, wprowadzić `Channel` jako nazwę w warstwie domenowej i DTO; zmianę nazwy modelu Prisma zostawić na koniec (opcjonalnie).

```prisma
enum ChannelStatus { PENDING_REVIEW ACTIVE LIMITED SUSPENDED BANNED DELETED }
enum ChannelRole   { OWNER MANAGER EDITOR MODERATOR TRANSLATOR }

model Creator {               // = Channel
  // istniejące pola...
  handle            String?   @unique   // "@pawel", case-insensitive przez indeks częściowy na lower(handle)
  status            ChannelStatus @default(PENDING_REVIEW)  // backfill: ACTIVE dla isApproved
  statusReason      String?
  statusChangedAt   DateTime?
  statusChangedById String?            // AdminUser.id
  avatarUrl         String?            // wartość magazynowa (jak §4.8)
  bannerUrl         String?            // (STATUS.md: banner był usunięty; decyzja)
  country           String?            // dla Connect/podatków
  isVerified        Boolean @default(false)
  deletedAt         DateTime?
  members           ChannelMember[]
  connectedAccount  StripeConnectedAccount?
  quota             ChannelQuota?
  strikes           ChannelStrike[]
  // isPrimary, isApproved: zostają do migracji czyszczącej (dwa wdrożenia, §4.0)
}

model ChannelMember {
  id        String      @id @default(uuid())
  channelId String
  userId    String
  role      ChannelRole
  createdAt DateTime @default(now())
  invitedById String?
  @@unique([channelId, userId])
  @@index([userId])
}

model StripeConnectedAccount {
  id                 String   @id            // acct_...
  channelId          String   @unique
  type               String                  // "express"
  country            String
  chargesEnabled     Boolean  @default(false)
  payoutsEnabled     Boolean  @default(false)
  detailsSubmitted   Boolean  @default(false)
  requirementsDue    Json?
  disabledReason     String?
  livemode           Boolean
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
}

// Payment: + connectedAccountId String?, applicationFeeMinor Int?, videoId String?, transferId String?
// PatronGrant: + channelId String? (+ index [userId, channelId, revokedAt])
// UserPaymentTotal: + channelId String? i nowy unique [userId, channelId, currency] (stary unique usunąć migracją czyszczącą)

model ChannelLedgerEntry {
  id String @id @default(uuid())
  channelId String; paymentId String?; kind String  // TIP, FEE, STRIPE_FEE, REFUND, REVERSAL, DISPUTE, DISPUTE_WON
  amountMinor Int; currency String; stripeObjectId String? @unique; createdAt DateTime @default(now())
  @@index([channelId, createdAt])
}

model ChannelQuota {
  channelId String @id
  maxStorageBytes BigInt; maxUploadBytes BigInt; maxVideoSeconds Int; maxUploadsPerDay Int; maxQueuedJobs Int
  usedStorageBytes BigInt @default(0); updatedAt DateTime @updatedAt
}

enum ReportTarget { VIDEO CHANNEL COMMENT }
model ContentReport {          // zgłoszenia filmów i kanałów (komentarze mają CommentReport)
  id String @id @default(uuid()); targetType ReportTarget; targetId String; channelId String
  reporterId String?; reason String; note String?; status String @default("PENDING")
  createdAt DateTime @default(now()); resolvedAt DateTime?; resolvedById String?; decision String?
  @@index([status, createdAt]); @@index([channelId])
}

model ChannelStrike {
  id String @id @default(uuid()); channelId String; videoId String?; reason String; policy String
  issuedById String; issuedAt DateTime @default(now()); expiresAt DateTime?; appealedAt DateTime?; revokedAt DateTime?
  @@index([channelId, expiresAt])
}

model ModerationAction {       // DSA: uzasadnienie dla użytkownika, ślad decyzji
  id String @id @default(uuid()); targetType String; targetId String; channelId String?
  action String; reasonPublic String; reasonInternal String?; actorAdminUserId String?; createdAt DateTime @default(now())
}

model ChannelBan { channelId String; userId String; until DateTime?; reason String?; @@id([channelId, userId]) }

// Subscription: + notifyEmail Boolean @default(false), notifyInApp Boolean @default(true)
// Video: + moderationStatus (VISIBLE, AGE_RESTRICTED, LIMITED, REMOVED), removedReason; VideoEncodeJob: + channelId
// BroadcastEmail: + channelId String? (null = platformowa); AuditLog: + channelId String?
```

Maszyna stanów kanału: `PENDING_REVIEW → ACTIVE` (zatwierdzenie lub automatycznie po weryfikacji), `ACTIVE ↔ LIMITED` (bez napiwków/rozsyłek, filmy widoczne), `ACTIVE|LIMITED → SUSPENDED` (filmy niewidoczne, studio tylko do odczytu, napiwki wyłączone), `SUSPENDED → ACTIVE|BANNED`, każdy → `DELETED` (miękkie, potem czyszczenie). Jedno miejsce przejść jak `CommentPolicy.MODERATION_TRANSITIONS`.

### 7.4 Ograniczenia migracji (CLAUDE.md §4.0)

- Tylko migracje **addytywne**; istniejących plików migracji nie edytować; pliki bez BOM.
- Migracja czyszcząca (usunięcie `isPrimary`, `isApproved`, `SystemRole.ADMIN`-jako-bramki, starego unique `UserPaymentTotal`, `MAIN_CREATOR_SLUG`) tylko **po backupie i za zgodą właściciela**, zasada **dwóch wdrożeń** (najpierw kod przestaje czytać kolumnę, potem osobna migracja), `deploy.sh --rollback` cofa tylko kod (po destrukcyjnej migracji wycofanie = przywrócenie zrzutu `pre-deploy-*`), procedura w `docs/architecture/db-cleanup-2026-10-05.md`.
- Backfill (np. `Comment.creatorId`, `Payment.creatorId`, `Creator.status`, `ChannelMember(OWNER)` z `Creator.userId`, `Creator.handle` = `slug`) jako osobna migracja SQL (idempotentna) – w tym repo migracje SQL są normą (np. indeks częściowy `User_name_lower_active_key`).
- `NOT NULL` na `Comment.creatorId`/`Payment.creatorId` dopiero po backfillu i w drugim wdrożeniu.
- Uwaga na `tests/postgres/db-cleanup-migration.pg.test.ts` i `fixtures/pre-cleanup-seed.sql` (seed zawiera `Creator`/`Subscription`).

---

## 8. Testy

### 8.1 Stan

- 392 pliki testów (`tests/unit`, `tests/integration` (2), `tests/postgres` (10 plików `*.pg.test.ts`, `vitest.postgres.config.ts`, prawdziwy Postgres, `fileParallelism:false`)).
- Zależność od głównego kanału: **64 pliki** zawierają `MainChannel|mainChannel|MAIN_CREATOR|mainCreatorSlug|isPrimary: true|isApproved`; rozkład: `tests/unit` (20, katalog główny), `tests/unit/modules/video` (16), `tests/unit/modules/email` (9), `tests/unit/modules/channel` (4), po 1-2 w `access`, `comments`, `health`, `payments`, `subscriptions`, `admin-content`, `admin-phase3`, `launch`, `services`, `translations`, `video-pipeline`, `integration` (1).
- **25 plików** mockuje `MainChannelService`, **19** mockuje cały barrel `vi.mock('@/lib/modules/channel')` (dlatego `channel.policy` jest importowany głęboko – `scripts/check-architecture.ts:44`).
- **73 pliki** używają aktora `type:'admin'` lub `role:'ADMIN'`; **57** używają `creatorId`.
- **Testy czytające źródła jako tekst** (38 plików z `readFileSync`), które bezpośrednio pękną albo trzeba je przepisać:
  - `tests/unit/single-channel-copy.test.ts` – zakazuje fraz „inni twórcy”, „discover creators”, „platforma wideo” i wymaga „kanał wideo”/„niezależny kanał wideo” w `app/[locale]/(home)/page.tsx` i `app/layout.tsx`.
  - `tests/unit/legacy-admin-retired.test.ts` – brak administracji na `www`, link do panelu w menu właściciela (l. 72).
  - `tests/unit/channel-page.test.ts` – `/channel/[MAIN_CREATOR_SLUG]` przy `ENABLE_MULTI_CREATOR=false`.
  - `tests/unit/modules/channel/channel-avatar-source.test.tsx` (§4.22, fallback admina).
  - `tests/unit/security/access-source-contract.test.ts`, `launch-security-boundaries.test.ts`, `comments-ui-contract.test.ts`, `comments-access-harden.test.ts`, `sidebar-search-cleanup-static.test.ts`, `r7-boundary.test.ts`, `tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts`, `tests/unit/modules/email/email-boundary.test.ts`, `tests/unit/legal-storage-inventory.test.ts`, test parytetu katalogów i18n.
  - `tests/integration/launch-candidate-critical-path.test.ts`.

### 8.2 Strategia

1. **Macierz autoryzacji jako test czystej funkcji** (`tests/unit/modules/authz/matrix.test.ts`): `it.each` po kartezjańskim iloczynie {guest, user-bez-kanału, OWNER, MANAGER, EDITOR, MODERATOR, TRANSLATOR, członek-innego-kanału, staff OWNER, staff MODERATOR, system} × {wszystkie akcje} × {stan zasobu: kanał ACTIVE/SUSPENDED, film DRAFT/PUBLISHED/premiera}. Oczekiwania w jednej tabeli (ta sama tabela co `matrix.ts`, ale wpisana niezależnie w teście, żeby błąd w macierzy nie przechodził „sam ze sobą”).
2. **Testy kontraktowe use case'ów** (Postgres, `tests/postgres/authz-*.pg.test.ts`): dwa kanały A i B, właściciel A próbuje każdej mutacji na zasobach B (film, upload, okładka, napisy, komentarz, pin, zwrot, rozsyłka, układ) → zawsze `FORBIDDEN`/`NOT_FOUND`, żadnego zapisu w bazie i w R2 (fałszywy klient R2). To jest główna ochrona przed IDOR.
3. **Bramka statyczna** (rozszerzenie `scripts/check-architecture.ts` + test źródeł): każdy mutujący use case wywołuje `authorize(`; zakaz `MainChannelService` poza allowlistą przejściową; zakaz `actor.type === 'admin'` poza `lib/modules/authz`.
4. **Przepisanie mocków**: zamiast mockować `MainChannelService`, testy dostają `ctx` z fabryki `makeChannelCtx({channel, principal})` (`tests/helpers/`), co zmniejsza zależność od barreli.
5. **Testy płatności Connect**: jednostkowe na zbudowanych parametrach `paymentIntents.create` (destination, fee, on_behalf_of), webhook Connect z podpisanymi zdarzeniami (`Stripe.webhooks.generateTestHeaderString`), zwrot z `reverse_transfer`, Postgres-owy test idempotencji `fulfillPayment` z `channelId`.
6. **E2E** (Playwright, już skonfigurowany `playwright.config.ts`): utworzenie kanału → upload małego pliku → kodowanie (fałszywy encoder) → publikacja → widok publiczny → napiwek w trybie testowym.

---

## 9. Szacunek wielkości i kolejność

### 9.1 Rozmiar per obszar (pliki produkcyjne do zmiany / nowe; LOC orientacyjnie)

| Obszar | Dziś (pliki/LOC) | Do zmiany | Nowe | Szac. LOC zmian |
|---|---|---|---|---|
| `authz` (nowy moduł + aktor) | – | `lib/api/auth.ts`, `shared/actor.ts`, `shared/app-context.ts`, `apps/admin/lib/actions/panel.ts`, `apps/admin/lib/api/panel-route.ts`, `apps/admin/lib/community.ts`, `scripts/check-architecture.ts` | 8-10 | 800-1 200 |
| `channel` | 13 / 828 | 13 | 6-8 (create channel, members, status, resolver) | 1 000-1 500 |
| `video` | 36 / 3 737 | ~20 | 2-3 | 700-1 000 |
| `video-pipeline` | 15 / 2 065 | 5 (guard, queue, repo claim, upload quotas) | 1-2 | 400-700 |
| `access`/`playback` | 11 / 902 | 5 | – | 200-300 |
| `comments` | 34 / 2 292 | ~15 | 1 (channel ban) | 400-600 |
| `subscriptions` + `email` | 42 / 3 963 | ~12 | 2 | 600-900 |
| `payments` + `patron` | ~35 / ~3 000 | ~12 | 4-6 (Connect onboarding, webhook Connect, ledger, sync accounts) | 1 500-2 500 |
| `admin-content`, `translations`, `media`, `health`, `launch` | ~25 | ~12 | – | 300-500 |
| `www` strony/komponenty (`app/`) | 134 komp. / 20 627 | ~30 (home, watch, channel, sitemap, layout, Hero, ChannelHome, tip steps, Navbar/UserMenu/AccountModal, Subscribe, sidebar) | 25-40 (studio: lista filmów, edycja, upload, układ, ustawienia kanału, członkowie, wypłaty, analityka, komentarze; tworzenie kanału; strona odkrywania; `/@handle`) | 6 000-10 000 |
| `app/api` | 45 tras | ~10 | 15-25 (`/api/studio/**`, `/api/channels`, webhook Connect) | 1 500-2 500 |
| `apps/admin` | 157 / 14 586 | ~35 | 8-12 (Kanały, Kanał, Zgłoszenia, przełącznik kanału) | 3 000-5 000 |
| `prisma` | – | `schema.prisma` | 4-6 migracji | 400-700 SQL/Prisma |
| teksty prawne, i18n (6 katalogów), docs, CLAUDE.md | – | ~15 | – | 1 500+ (tekst) |
| **Razem** | | **~200-230 plików** | **~70-110 plików** | **ok. 18-28 tys. LOC** |
| Testy | 392 | 90-130 do przepisania | 30-50 nowych | 6-10 tys. LOC |

### 9.2 Kolejność faz (expand/contract, produkcja działa po każdej)

| Faza | Zakres | Flaga / ochrona | Wynik widoczny |
|---|---|---|---|
| **0. Decyzje** | właściciel: odwrócenie §1/§4.1/§4.14 (model niekomercyjny, „jeden kanał”), forma prawna platformy, prowizja, kraje Connect, moderacja (DSA), zamknięty pilotaż (STATUS.md: ~10 twórców) | – | aktualizacja CLAUDE.md i STATUS.md |
| **1. Autoryzacja bez zmiany zachowania** | moduł `authz`, typ `staff` dla panelu, `authorize()` we wszystkich use case'ach z regułą „admin/staff = wszystko, user = jak dziś”; bramka statyczna; macierz testów | brak (zachowanie identyczne) | nic |
| **2. Schemat addytywny + backfill** | `ChannelMember`, `Creator.handle/status/avatarUrl`, `StripeConnectedAccount`, kolumny `channelId`, `ChannelQuota`, `ContentReport`, `ModerationAction`; backfill: `OWNER` z `Creator.userId`, `status=ACTIVE` dla zatwierdzonych, `Comment/Payment.creatorId` | migracje addytywne | nic |
| **3. Kanał z kontekstu** | `ChannelResolver`: kanał z zasobu (film → `creatorId`) lub z URL; `MainChannelService` zostaje tylko jako „kanał domyślny strony głównej” (`DEFAULT_CHANNEL_HANDLE`); `checkVideoAccess`/wyszukiwarka/sitemap globalne z warunkiem `status=ACTIVE`; `/channel/[slug]` dla każdego aktywnego kanału; `/watch/[slug]` jako prawdziwa strona | `MULTI_CHANNEL_PUBLIC=false` (dopóki jest jeden kanał, wynik identyczny) | brak różnicy z jednym kanałem |
| **4. Studio twórcy na `www`** | `/[locale]/studio/**`, `app/api/studio/**`; tworzenie kanału z panelu konta (status `PENDING_REVIEW`); upload/kodowanie/okładki/napisy/publikacja/układ/komentarze przez te same use case'y; kwoty; sprawiedliwa kolejka | `STUDIO_ENABLED` + lista dozwolonych kont (pilotaż) | twórcy-piloci |
| **5. Panel superadmina** | ekrany Kanały/Kanał/Zgłoszenia, filtr kanału wszędzie, akcje statusu, usunięcie „odpowiedz jako twórca” z panelu, role panelu `MODERATOR/SUPPORT/FINANCE` | – | operator widzi wszystkie kanały |
| **6. Stripe Connect** | onboarding Express w studiu, destination charges, webhook Connect, ledger, zwroty z odwróceniem, nowe teksty napiwku; stary kanał właściciela też przechodzi na konto połączone (albo zostaje „kanałem platformy” bez transferu) | `CONNECT_ENABLED` per kanał (`StripeConnectedAccount.chargesEnabled`) | napiwki do twórców |
| **7. Strona odkrywania i SEO** | strona główna = feed (wiele kanałów), `/@handle`, sitemap index, JSON-LD per film/kanał, nowe teksty prawne, i18n, wyłączenie bety | `MULTI_CHANNEL_PUBLIC=true` | publiczna platforma |
| **8. Sprzątanie** | migracja czyszcząca (`isPrimary`, `isApproved`, `MAIN_CREATOR_SLUG`, `SystemRole.ADMIN` jako bramka, `findMainCreatorAdminAvatar`, demo-fallbacki, `lib/channel/main-channel.service.ts`, stary unique `UserPaymentTotal`) | dwa wdrożenia, backup, zgoda | – |

---

## 10. Niespodzianki i ryzyka

1. **Use case'y wideo i pipeline'u nie mają żadnej autoryzacji** (§4.2). Każda nowa trasa na `www`, która je zawoła bez `authorize()`, daje każdemu zalogowanemu pełną kontrolę nad filmami. To ryzyko nr 1; faza 1 musi poprzedzić studio.
2. **`userId` w aktorze `admin` znaczy dwie różne rzeczy** (`User.id` vs `AdminUser.id`); audyt i pola `*ById` są niejednoznaczne. Przy wielu operatorach i twórcach nie da się wiarygodnie odtworzyć „kto co zrobił”.
3. **„Odpowiedz jako twórca” z panelu podszywa się pod właściciela kanału** (`create-creator-reply.use-case.ts:46-47`, `authorId: creatorUserId`). Przy obcych twórcach to niedopuszczalne (prawnie i wizerunkowo).
4. **Awatar kanału fallbackuje do pierwszego administratora** (`video-content.service.ts:41-47`, §4.22) – kanał bez awatara pokazałby twarz właściciela platformy. Do usunięcia przed jakimkolwiek drugim kanałem.
5. **Pasek zbiórki liczy wpłaty `creatorId = null` do każdego kanału** (`fundraising-progress.service.ts:34`).
6. **Cache w pamięci procesu**: `totalsCache` (fundraising, 60 s, `Map` bez limitu rozmiaru – przy wielu kanałach i datach startu rośnie bez ograniczeń), `react.cache` dla kanału głównego (bezpieczne, per żądanie). `/channel/[slug]` ma `revalidate = 60` (ISR) – status zawieszenia kanału zadziała z opóźnieniem do 60 s; przy zawieszeniu trzeba `revalidatePath`.
7. **Jedno kodowanie naraz, FIFO globalne** (§3.4); serwer CPX22 (2 vCPU, 4 GB, dysk 75 GB) i limit uploadu do 50 GiB – kilku twórców z dużymi plikami zapcha dysk i kolejkę. Kwoty muszą być przed otwarciem studia.
8. **Worker HLS**: token nie wiąże kanału (OK), ale nie ma odwołania tokenów – zawieszony/usunięty film gra do 6 h, a cache krawędzi trzyma segmenty; Workers Free 100 tys. żądań/dobę to pierwszy twardy limit skali (STATUS.md, `koszty-skalowania.md`).
9. **Crony są globalne** (`deploy/serwerek/systemd/`, `scripts/serwerek/cron-runner.sh`): `send-broadcasts` co minutę obsłuży też rozsyłki twórców – potrzebne limity per kanał (dzienny wolumen, reputacja nadawcy: maile twórców idą z domeny platformy, SES/Resend; jeden spamujący twórca psuje dostarczalność wszystkim). `retention`, `prune-*` bez zmian.
10. **Subskrypcja = zgoda na maile** (`subscribe.use-case.ts:33-40` zapisuje `recordExplicitContentOptIn` globalnie i synchronizuje jedną listę Resend Audience). Przy wielu kanałach obserwowanie kanału nie może oznaczać zgody na maile od wszystkich; link wypisu (`signed-unsubscribe.use-case.ts`) musi nieść kanał.
11. **Strona główna i URL-e**: kanoniczny URL filmu to `/?v=<slug>` (sitemap i JSON-LD `embedUrl`), `/watch/<slug>` tylko przekierowuje. Zmiana na `/watch/<slug>` zmienia kanoniczne adresy (301, hreflang w `getLocaleAlternates`). Strona główna jest `force-dynamic` i ma bramkę „Follow the white rabbit” (§4.13) – to jest tożsamość obecnego kanału, nie platformy; decyzja właściciela, czy bramka zostaje na platformie, czy tylko na `/@pawel`.
12. **Slug filmu globalnie unikalny** (`Video.slug @unique`, `VideoTranslation @@unique([language, slug])`) – twórcy będą kolidować na popularnych nazwach („intro”, „vlog-1”). Albo dopisywać sufiks, albo przejść na krótkie `publicId` w URL.
13. **Dokumenty prawne i model biznesowy**: Regulamin i Polityka (`app/components/legal/LegalDocs.tsx`) opisują osobę fizyczną jako „Twórcę”, administratora danych i jedynego adresata napiwków; maile mają linię tożsamości z adresem osoby (`resend-email.transport.ts:27`). Platforma z treściami użytkowników to hosting w rozumieniu DSA (mechanizm zgłoszeń, uzasadnienia decyzji, punkt kontaktowy, raporty przejrzystości), a Stripe Connect czyni platformę stroną odpowiedzialną za spory/ujemne salda (destination charges) i KYC twórców przez Stripe. CLAUDE.md §1, §4.1, §4.14 i STATUS.md („To nie marketplace”, „niekomercyjny”) wymagają wyraźnej zmiany decyzji właściciela przed kodem.
14. **Prawa autorskie i treści nielegalne**: brak jakiejkolwiek moderacji filmów (dziś tylko komentarze). STATUS.md notuje problem licencji coverów – przy twórcach zewnętrznych platforma potrzebuje notice-and-takedown, strajków i skanowania (CSAM).
15. **Telemetria** (§4.19): rollupy po `video_id` w schemacie `telemetry`, czytane przez panel z `ADMIN_TELEMETRY_DATABASE_URL`. Studio na `www` nie ma dostępu do tego schematu (rola `pp_collector` tylko pisze) – analityka twórcy wymaga nowej roli tylko do odczytu albo kopii agregatów do schematu publicznego; zakaz id użytkownika w telemetrii zostaje.
16. **CSP**: `www` już ma w `connect-src` hosty uploadu R2 (`lib/utils/security.ts:3-10,53`), a CORS bucketa oryginałów już dopuszcza `www.pawelperfect.com` (`scripts/hls/originals-cors.json`) – studio na `www` nie wymaga zmian infrastruktury dla uploadu. Wbudowane komponenty Stripe Connect wymagałyby dopisania hostów.
17. **Limity Redis** są per użytkownik (`checkout:<userId>`, `subscriptions:*:<userId>`, `media-source:*`) – brak limitów per kanał (np. liczba uploadów, rozsyłek, utworzonych kanałów per konto). Tworzenie kanału musi mieć limit i Turnstile.
18. **Usunięcie konta właściciela kanału**: `account-deletion-cleanup.use-case.ts` nie wie o posiadanych kanałach (tylko resync liczników subskrypcji, l. 97-159); `LAST_ADMIN` (`app/api/user/account/route.ts:49`) chroni tylko admina. Potrzebna reguła: konto z kanałem nie zostanie usunięte bez decyzji o kanale i rozliczeniu Connect.
19. **Demo-fallbacki** (`canUseDemoFallbacks`, `INITIAL_VIDEOS`, `DEFAULT_CREATOR`) przecinają `checkVideoAccess` (`check-video-access.use-case.ts:47-59,73`) i treści – przy wielu kanałach zwiększają ryzyko pomyłki; usunąć wcześnie (są wyłączone w produkcji).
20. **Zmienna `REFERRAL_PATRON_THRESHOLD` jest na liście wymaganych w produkcji** (`lib/env/validation.ts:32`), choć mechanizm poleceń/patronów jest martwy – do posprzątania przy okazji.
21. **Dryf dokumentacji**: CLAUDE.md §1 mówi o `PATRON` w enumie `AccessTier`, schemat ma tylko `PUBLIC`/`LOGGED_IN` (STATUS.md już to odnotowuje). Docs mogą nie odpowiadać kodowi także przy kanałach; ten raport opiera się na kodzie.
22. **`PASSKEY_RP_NAME = "Pawel Perfect"`** i `RP ID pawelperfect.com` – zmiana domeny platformy (STATUS.md: rozważane `polutek.*`) unieważnia klucze dostępu; nazwę RP można zmienić bez skutków, RP ID nie.
