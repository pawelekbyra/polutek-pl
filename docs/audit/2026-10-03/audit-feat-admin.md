# Audyt panelu administratora (pawelperfect.com), 2026-10-03

Zakres: `app/admin/**` (wszystkie 34 pliki stron i komponentów), `app/api/admin/**` (61 tras), `middleware.ts`, `lib/auth-utils.ts`, `lib/api/{auth,csrf,admin-rate-limit,admin-body,admin-schemas}.ts`, `lib/admin/*`, `lib/modules/{video,audit,payments,users,admin-stats}` w miejscach wołanych przez panel, testy `tests/unit/*admin*`.
Stan kodu: HEAD `88c787d0` (main). Audyt wyłącznie do odczytu: nic nie zmieniano, nie logowano się na serwer ani do panelu.
Ekrany i trasy dostawców Mux/Stream/YouTube/Vimeo (PR #1614, nadal OPEN) nie są oceniane merytorycznie. Wymieniam je tylko w inwentarzu jako „do usunięcia w #1614”.

---

## 1. Podsumowanie i ocena

**Ocena ogólna: 5/10.** Fundament bezpieczeństwa jest solidny. Każda z 61 tras woła `requireAdminForApi`, rola jest sprawdzana w bazie, a CSRF i limity działają centralnie w `middleware.ts`. Ciała żądań przechodzą przez zod w większości tras, audyt zapisuje się w transakcji. Słabsza jest warstwa aplikacyjna panelu:

- **Trzy listy (użytkownicy, wpłaty, filmy) mają zepsutą paginację.** Po przejściu na stronę 2 efekt Reacta od razu ładuje stronę 1. Do tego przy każdym znaku w polu wyszukiwania idzie osobne zapytanie (ADM-01).
- **Strona „Układ kanału” (`/admin/videos/layout`) nie działa poprawnie.** Przycisk „USTAW HERO” niczego nie zapisuje, a i tak pokazuje komunikat sukcesu. Kolejność filmów jest wyświetlana odwrotnie niż na stronie, więc pierwsze przesunięcie zmienia kolejność na żywej stronie inaczej, niż admin zamierzał (ADM-02, ADM-03).
- **Zwrot w Stripe nie ma klucza idempotencji ani blokady wiersza** (ADM-04). Admin nie ma obowiązkowego 2FA ani ponownego uwierzytelnienia przed operacjami nieodwracalnymi (ADM-05).
- **Część filtrów i statystyk listy filmów to atrapy.** Filtry „Źródło” i „Wymaga uwagi” są ignorowane przez backend, statystyki nigdy nie przychodzą z API, a filtry „Migracja” dotyczą Cloudflare Stream (ADM-07).
- **Filmy mają trzy ścieżki zapisu z różną walidacją i dwa formularze edycji** (ADM-08, ADM-09).
- **Każda strona to osobny, ręcznie złożony ekran** z publicznym `Navbar`. Nie ma wspólnej powłoki ani bocznej nawigacji. Język jest mieszany PL/EN, a dostępność słaba (ADM-20..22).
- **Testy panelu to głównie testy „tekstu źródła”** (`readFileSync` + `toContain`). Żaden nie złapał błędów z ADM-01..03 (ADM-31).
- **Brakuje narzędzi do codziennej pracy jednej osoby:** strony zdrowia systemu, przeglądarki dziennika audytu, eksportu wpłat, wyszukiwarki globalnej i informacji o logowaniu użytkownika (ADM-35).

Liczba znalezisk: **37**. P0: 0, **P1: 6**, **P2: 21**, **P3: 10**.

---

## 2. Inwentarz

### 2.1 Strony `app/admin/**`

Ochrona: `app/admin/layout.tsx:10` wywołuje `requireAdmin()` (redirect na `/`). Do tego w `middleware.ts:155-168` jest optymistyczny test ciasteczka. Strony klienckie pobierają dane przez `/api/admin/*`, które same sprawdzają admina.

| Ścieżka | Cel | Skąd podlinkowana | Uwagi |
|---|---|---|---|
| `/admin` | Kafelki sekcji (7) | `UserMenu.tsx:102`, `AccountModal.tsx:81` | Bez danych i bez statystyk. Brak kafelków dla `/admin/settings`, układu filmów, dashboardu użytkowników i wpłat |
| `/admin/videos` | Lista filmów, inline tworzenie i edycja, usuwanie | dashboard | ADM-01, 07, 09, 10, 11 |
| `/admin/videos/[id]` | Szczegóły: podgląd, media/kodowanie, dostęp, diagnostyka, komentarze, statystyki, historia | tabela filmów | ADM-06, 33 |
| `/admin/videos/[id]/edit` | Kanoniczny formularz edycji (premiera, cel zbiórki) | szczegóły, redirect z `?edit=` (middleware.ts:190-196) | ADM-08 |
| `/admin/videos/layout` | Kolejność, sidebar, Hero | tylko przycisk w nagłówku listy filmów | **ADM-02, ADM-03** |
| `/admin/videos/new` | — | **nie istnieje** (wymieniona w CLAUDE.md §5) | dokumentacja |
| `/admin/users` | Lista użytkowników, filtry, eksport CSV, akcje patrona | dashboard | ADM-01, 12, 15 |
| `/admin/users/[userId]` | Szczegóły, wpłaty, granty, historia | lista, InboundInbox, wpłaty | brak informacji o logowaniu (ADM-35) |
| `/admin/users/dashboard` | Statystyki użytkowników i finansów | tylko karta na `/admin/users` | ADM-18 |
| `/admin/users/payments` | Lista wpłat, zwrot, synchronizacja sporu | tylko karta na `/admin/users` | ADM-01, 04 |
| `/admin/comments` | Moderacja, akcje zbiorcze | dashboard | ADM-06, 17 |
| `/admin/comments/reports` | Zgłoszenia | link z komentarzy | ADM-17 |
| `/admin/emails` | Szablony, rozsyłka, historia, „Odpowiedzi”, ustawienia Resend | dashboard | ADM-15, 23, 24 |
| `/admin/notifications` | Rozsyłka powiadomień i szablony | dashboard | ADM-16 |
| `/admin/channel` (server) | Nazwa, opis, okładka, domyślna miniatura (URL), licznik subskrybentów | dashboard | ADM-19 |
| `/admin/settings` | Domyślna miniatura (upload) | tylko link z `/admin/channel` | brak `Navbar`, ADM-19, 20 |
| `/admin/payments` (server) | Limity walut i progi | dashboard | ADM-30 |

Strony osierocone: brak całkowicie niepodlinkowanych. Cztery strony są jednak osiągalne tylko z jednego miejsca wewnątrz innej sekcji (`/admin/settings`, `/admin/videos/layout`, `/admin/users/dashboard`, `/admin/users/payments`).

### 2.2 Trasy `app/api/admin/**` (61)

Legenda: **Auth** = `requireAdminForApi` (wszystkie 61: TAK). **CSRF i limit** idą centralnie z middleware dla wszystkich metod mutujących (limity ścisłe: refund 5, dispute-sync 5, emails/broadcast 3, notifications/broadcast 3, users/patron 10, payment-settings 10, upload start/complete/abort 20; reszta 120/min). „Walidacja”: `pAB(x)` = `parseAdminBody(schemat x)`.

| Trasa | Metody | Walidacja | Audyt | Wołający |
|---|---|---|---|---|
| channel | GET, PATCH | własny zod (`safeParse`) | tak (use case) | `/admin/channel` (PATCH); GET: brak wołającego (strona jest serwerowa) |
| comments | GET | query | — | comments/page |
| comments/[id]/approve, hold, hide, restore, heart | POST | brak ciała | tak | comments, reports, `CommentItem.tsx` (hide/restore/heart z publicznego UI) |
| comments/[id]/delete | POST | pAB(adminCommentDelete), allowEmpty | tak | comments, szczegóły filmu |
| comments/reports | GET | query | — | reports, comments (licznik) |
| comments/reports/[id]/resolve | POST | pAB | tak | reports |
| emails/broadcast | GET, POST | własny zod z polami „legacy” | tak | BroadcastWizard, EmailDashboard, BroadcastHistory |
| emails/responses | GET, PATCH | pAB | tak | InboundInbox |
| emails/status | GET | — | — | emails/page, EmailDashboard (zaszyta zaślepka) |
| health/cloudflare, health/mux | GET, POST | pAB(probe) | allowlista | **brak** (#1614) |
| maintenance/main-channel/preview, apply | GET, POST | zod (fraza) | tak | **brak** |
| notifications | GET | — | — | notifications/page |
| notifications/broadcast | POST | pAB | tak | NotificationBroadcastForm |
| notifications/templates | GET, PUT, DELETE | pAB | tak | NotificationTemplatesEditor |
| payment-settings | GET, PATCH | zod | tak | PaymentSettingsForm (PATCH); GET: brak |
| payments | GET | query | — | users/payments |
| payments/[id]/refund | POST | pAB allowEmpty | tak (handleRefund) | users/payments |
| payments/[id]/dispute-sync | POST | brak ciała | tak | users/payments |
| settings/media/default-video-thumbnail | GET, POST, DELETE | formData (allowlista) | tak | settings/page |
| …/default-video-thumbnail/proxy | GET | — | — | `<img>` w settings |
| stats | GET | — | — | **brak** |
| subscribers/resync | POST | — | tak | ChannelSettingsForm |
| templates | GET, POST, DELETE | zod | tak | TemplatesList, EmailTemplateEditor, BroadcastWizard |
| users | GET | query | — | users/page |
| users/[id] | GET | — | — | users/[id] |
| users/[id]/patron | PATCH | pAB | tak | UserPatronActions |
| users/export | GET | query | tak | users/page (window.open) |
| users/stats | GET | — | — | users/page, users/dashboard |
| video-provider-jobs/reconcile | POST | pAB | tak | **brak** (#1614) |
| videos | GET, POST, DELETE | POST: ręczny guard + 3 schematy (allowlista) | tak | lista, edycja, layout |
| videos/[id] | GET, PATCH | pAB(adminVideoWrite, passthrough) | tak | szczegóły, edycja, VideoStudio, zapis metadanych w trakcie uploadu |
| videos/[id]/actions | PATCH, POST | PATCH: **pAB(adminLooseObject)**; POST: pAB(action) | tak | szczegóły (publish/unpublish/archive/restore/set-hero, PATCH sidebar) |
| videos/[id]/original-upload/multipart (+parts, complete) | POST, GET, DELETE | pAB | tak (parts: allowlista) | `lib/video-upload/multipart-uploader.ts` |
| videos/[id]/pipeline, encode, jobs/[jobId], assets/[assetId] | GET, POST, DELETE | brak ciała | tak | useVideoPipeline |
| videos/cover-upload | POST | formData | tak (Safe) | CoverImageUpload |
| videos/reorder | POST | pAB(reorder) | tak | layout |
| videos/[id]/comments | GET | — | — | **brak** |
| videos/[id]/media | GET | — | — | **brak** |
| videos/[id]/original-upload (single) | POST, PATCH | pAB | tak | **brak** |
| videos/[id]/distribution-plan, playback-route, reconcile, upload, sources, sources/[sourceId], sources/mux-upload, provider-jobs/[jobId]/retry | różne | pAB | tak | **brak** (#1614) |
| videos/distribution-backfill, r2-diagnostics, resync | POST, GET, POST | pAB | tak | **brak** |

Wywołania do nieistniejących tras: brak. `/api/admin/health/clerk` z CLAUDE.md już nie istnieje (tylko dokumentacja). Link `/admin/emails?to=…` prowadzi na istniejącą stronę, ale parametr `to` jest ignorowany (ADM-15).

---

## 3. Znaleziska

Format: **ID — waga — typ**, potem plik:linia, problem, naprawa, nakład (S/M/L), pewność.

### P1

**ADM-01 — P1 — błąd.** Paginacja w trzech listach wraca na stronę 1 i strzela zapytaniem przy każdym znaku.
- Pliki: `app/admin/users/page.tsx:56-72`, `app/admin/users/payments/page.tsx:52-86`, `app/admin/videos/components/useAdminVideos.ts:42-81` razem z `app/admin/videos/page.tsx:71-73`.
- Ścieżka: `fetchUsers`/`fetchPayments`/`fetchVideos` mają w zależnościach `useCallback` stan `page` i `searchQuery`. `useEffect` ma tę funkcję w zależnościach i woła ją z argumentem `1`. Kliknięcie „Następna” ustawia `page=2` (`use-admin-list-query.ts:74`). Funkcja dostaje nową tożsamość, efekt odpala się ponownie i woła `fetch…(1)`, więc lista wraca na stronę 1.
- Każdy znak w polu wyszukiwania też zmienia tożsamość funkcji. Efekt odpala zapytanie (w `/admin/users` dodatkowo `fetchStats()`), bez debounce i bez `AbortController`, więc odpowiedzi mogą przyjść w złej kolejności.
- W liście filmów efekt odpala się dodatkowo tuż po pierwszym ładowaniu, czyli podwójne zapytanie.
- Komentarze i zgłoszenia działają dobrze, bo ich `fetchComments` nie zależy od `page`.
- Naprawa: stan listy w URL (`searchParams`). Fetch w efekcie zależnym tylko od parametrów, z `AbortController` i debounce wyszukiwania. Docelowo TanStack Query z `keepPreviousData` (patrz §5).
- Nakład: S. Pewność: wysoka (analiza kodu, bez uruchomienia).

**ADM-02 — P1 — błąd.** „USTAW HERO” na stronie układu niczego nie zapisuje, a pokazuje sukces.
- `app/admin/videos/layout/page.tsx:62-67` ustawia `isMainFeatured` lokalnie. `handleSave` (`:69-94`) wysyła go do `/api/admin/videos/reorder`.
- `adminVideoReorderSchema` (`lib/api/admin-schemas.ts:78-88`) ma tylko `id`, `sidebarOrder` i `showInSidebar`, a zod odrzuca nieznane pola. `reorderAdminVideos` i `VideoRepository.reorder` (`video.repository.ts:405-434`) w ogóle nie dotykają Hero.
- Skutek: toast „Układ kanału został zapisany”, a Hero bez zmian. Po odświeżeniu wraca stary.
- Dodatkowo UI blokuje Hero dla tieru innego niż PUBLIC, a polityka (`VideoPolicy.getHeroBlockers`) tego nie wymaga.
- Naprawa: zapisać Hero osobno przez `POST /actions {action:"set-hero"}` albo rozszerzyć schemat i use case (wtedy z walidacją blokad Hero i `clearHero`). Zgrać regułę tieru z polityką.
- Nakład: S. Pewność: wysoka.

**ADM-03 — P1 — błąd.** Strona układu pokazuje kolejność odwrotną niż na stronie i widzi najwyżej 20 filmów.
- `layout/page.tsx:26` pyta o `?pageSize=100&orderBy=sidebarOrder&orderDir=asc`.
- Trasa przekazuje `pageSize` (`query-parser.ts:25-33`), ale `findAdminList` czyta `filters.limit || 20` i zawsze sortuje `'desc'` (`video.repository.ts:231-238`). `orderDir` w ogóle nie trafia do repozytorium.
- Publiczny sidebar sortuje `sidebarOrder: 'asc'` (`video-content.service.ts:34`). Admin widzi więc listę odwróconą, z numeracją „1.” liczoną od indeksu.
- Pierwsze przesunięcie (`moveItem`, `:41-55`) przenumerowuje wszystko według odwróconego widoku, przez co cała kolejność na stronie zmienia się inaczej, niż admin zamierzał. Przy ponad 20 filmach reszta znika z widoku.
- To samo ignorowanie `orderDir` sprawia, że w liście filmów nie ma sortowania rosnącego. W `/admin/users` sortowanie „E-mail (alfabetycznie)” działa Z→A, bo UI nie wysyła `orderDir`.
- Naprawa: w `parseVideoQueryParams` mapować `pageSize` na `limit` i przekazywać `orderDir` do Prismy. Na stronie układu pobierać wszystkie filmy kanału.
- Nakład: S. Pewność: wysoka.

**ADM-04 — P1 — bezpieczeństwo (pieniądze).** Zwrot bez idempotencji i bez blokady.
- `lib/modules/payments/application/admin-refund.use-case.ts:60-84`: odczyt `refundedAmountMinor`, potem `stripe.refunds.create` bez `idempotencyKey`, potem zapis w DB.
- Dwie karty, ponowiona próba po timeoucie albo dwa szybkie żądania mogą przejść ten sam test `maxRefundable` i utworzyć **dwa** zwroty częściowe. Stripe zatrzyma dopiero przekroczenie kwoty obciążenia.
- UI (`users/payments/page.tsx` ~96-117) nie ma pola „powód”, więc `Payment.refundReason` i `reason` w Stripe nigdy nie są ustawiane, choć kolumny istnieją.
- Naprawa: `idempotencyKey` (np. `refund:{paymentId}:{alreadyRefunded}:{amount}` albo UUID generowany w dialogu i wysyłany w ciele), `SELECT … FOR UPDATE` na płatności w transakcji, pole powodu w dialogu.
- Nakład: S/M. Pewność: wysoka.

**ADM-05 — P1 — bezpieczeństwo.** Konto admina nie wymaga 2FA ani ponownego uwierzytelnienia przed operacjami nieodwracalnymi.
- `lib/api/auth.ts:106-115` (`requireAdminActor`) sprawdza tylko rolę i `isDeleted`. Logowanie Google pomija 2FA z założenia (CLAUDE.md §4.12).
- Jedno przejęte ciasteczko sesji wystarcza do zwrotów, rozsyłek do wszystkich subskrybentów i usuwania filmów razem z plikami.
- Zalecenie OWASP: MFA obowiązkowe dla kont uprzywilejowanych i step-up dla operacji wysokiego ryzyka.
- Naprawa: w `requireAdminActor` wymagać `user.twoFactorEnabled` (dla Google: TOTP jako drugi krok w panelu albo passkey). Dla refund, delete video i broadcast wymagać świeżej sesji (`freshAge`, np. 10 min) albo ponownego kodu TOTP.
- Nakład: M. Pewność: wysoka co do braku, średnia co do kosztu (Better Auth nie ma jeszcze wbudowanego wymuszania, issue #10310).

**ADM-06 — P1 — UX/dane.** Operacje nieodwracalne albo masowe bez potwierdzenia.
- `app/admin/comments/page.tsx`: „Usuń zaznaczone” (do 50 komentarzy, `handleBulkAction('delete')`, ok. linia 192 pliku) i pojedyncze „Usuń” (~294) bez dialogu.
- `app/admin/videos/[id]/page.tsx:243`: „Usuń” komentarz w karcie filmu.
- `:112-115` i `:200`: „Cofnij publikację” i „Archiwizuj”. Zdejmują film z serwisu, czyszczą Hero i sidebar (`update-admin-video.use-case.ts:81-84`) i kasują publiczną miniaturę, a wszystko bez potwierdzenia. „Archiwizuj” ma `variant="destructive"`, ale nie pyta.
- Usunięcie filmu i zmiana patrona mają dialogi (dobrze).
- Naprawa: wspólny `ConfirmDialog` z opisem skutku. Dla unpublish/archive filmu będącego Hero ostrzeżenie „strona główna nie będzie miała Hero”.
- Nakład: S. Pewność: wysoka.

### P2

**ADM-07 — P2 — błąd/śmieć.** Filtry i statystyki listy filmów to atrapy.
- `VideoFilters.tsx:138-151` (Źródło: YouTube/Vimeo/Blob/HLS/DASH/MP4, bez `SELF_HLS`) i `:203` („Wymaga uwagi”) są wysyłane (`useAdminVideos.ts:49,53`), ale `findAdminList` (`video.repository.ts:187-229`) nie zna `sourceKind` ani `needsAttention`. Filtry nic nie robią.
- „Migracja” (`VideoFilters.tsx:157-168`) filtruje po `CLOUDFLARE_STREAM` (`repository:197-212`), czyli zostałość po dostawcy.
- `AdminVideoStats` (`videos/page.tsx:334`) renderuje się tylko gdy `data.stats`, a `getAdminVideoList` (`get-admin-video-list.use-case.ts:17-30`) nie zwraca `stats`. Rząd 7 kafelków nigdy się nie pokazuje.
- Opcja statusu `UNLISTED` istnieje w filtrze, ale nie da się jej ustawić.
- Naprawa: usunąć Źródło, Migrację i UNLISTED. „Wymaga uwagi” zdefiniować na nowo (np. brak `SELF_HLS READY`, błąd kodowania, opublikowany bez miniatury) i zaimplementować w repozytorium. Statystyki policzyć jednym `groupBy` albo usunąć komponent.
- Nakład: S. Pewność: wysoka.

**ADM-08 — P2 — spójność/bezpieczeństwo danych.** Trzy ścieżki zapisu filmu z różną walidacją.
- (a) `POST /api/admin/videos` z `id` (`videos/route.ts`, POST): ręczne `buildAdminVideoUpdatePayload`.
- (b) `PATCH /api/admin/videos/[id]` (`[id]/route.ts:14-37`): `adminVideoWriteSchema.passthrough()`, konwersja `premiereAt`, usuwanie surowych `fundraisingGoal*`.
- (c) `PATCH /api/admin/videos/[id]/actions` (`actions/route.ts:18-38`): `adminLooseObjectSchema` przekazany wprost do `updateAdminVideo`.
- Przez (c) przechodzą surowe `fundraisingGoalMinor/Currency/StartAt` (repozytorium je zapisuje: `pickFundraisingUpdate`, `video.repository.ts:329`), wbrew CLAUDE.md §4.16 „Raw keys are ignored”. Przechodzi też `premiereAt` jako string bez konwersji i `status` o dowolnej wartości (błąd Prismy daje 500).
- `status: "PUBLISHED"` w (a), (b) i (c) bez premiery jest po cichu ignorowany (`video.repository.ts:331-335`): 200 OK, a film zostaje szkicem. Formularz to częściowo maskuje (`VideoForm.tsx:288-290`).
- Naprawa: jedno `PATCH /videos/[id]` ze ścisłym schematem zod (`.strict()`, enumy, typy). Usunąć PATCH z `/actions`. `POST /videos` tylko do tworzenia. Zmiany statusu wyłącznie przez akcje publish/unpublish/archive.
- Nakład: M. Pewność: wysoka.

**ADM-09 — P2 — spójność/śmieć.** Dwa formularze edycji filmu.
- Ikona „Edytuj” w tabeli (`VideoTable.tsx:152`) otwiera edycję **inline** na liście (`videos/page.tsx:84-113` + `AdminVideoEditView`). Ta wersja nie ma karty „Cel zbiórki”, wysyła `videoUrl` (legacy) i ustawia napisy na `""`.
- Kanoniczna edycja to `/admin/videos/[id]/edit`.
- Obsługa `?edit=` w `videos/page.tsx:64-69` i `fetchVideoForEdit` (`useAdminVideos.ts:83-116`) jest martwa, bo middleware przekierowuje `?edit=` na stronę edycji (`middleware.ts:190-196`).
- Naprawa: tabela linkuje do `/edit`. Usunąć inline edit i `fetchVideoForEdit`. Tworzenie nowego filmu jako osobna strona `/admin/videos/new` (zgodna z dokumentacją).
- Nakład: M. Pewność: wysoka.

**ADM-10 — P2 — błąd.** „Duplikuj” gubi miniaturę.
- `videos/page.tsx:127` kopiuje `vid.thumbnailUrl` z DTO listy. To pochodny adres (`resolvePublicThumbnailSrc`, `video.dto.ts:190`): proxy albo publiczny R2.
- `createAdminVideo` odrzuca adresy pochodne (`isDerivedThumbnailUrl`) i wstawia `/logo.png`. Kopia nie ma okładki, a admin o tym nie wie.
- Naprawa: duplikacja po stronie serwera (`POST /videos/[id]/duplicate`, kopiuje prywatny klucz) albo ukrycie akcji.
- Nakład: S. Pewność: wysoka.

**ADM-11 — P2 — UX/dane.** Upload w trakcie tworzenia filmu można niechcący „porzucić”.
- `AdminVideoEditView.tsx:47-94`: „Anuluj”/„Wróć” (`onCancel → setIsEditing(false)`) odmontowuje `VideoPipelinePanel` w trakcie wysyłki.
- Błąd `fetchVideos` (np. przy `onChanged`) podmienia cały widok na `AdminVideoErrorView` (`videos/page.tsx:295-297`).
- `useOriginalUpload` nie przerywa wysyłki przy odmontowaniu, a w repo nie ma `beforeunload`. Upload leci dalej niewidocznie, a zamknięcie karty przerywa go bez ostrzeżenia.
- Naprawa: nowy film jako strona `/new`, która po utworzeniu przekierowuje do `/admin/videos/[id]?tab=media`. Upload przeżywa wtedy tylko w jednym miejscu. Do tego `beforeunload` w czasie wysyłki i potwierdzenie przy „Anuluj”.
- Nakład: M. Pewność: wysoka.

**ADM-12 — P2 — błąd.** Po nadaniu lub cofnięciu patrona z listy użytkowników znaczek się nie odświeża.
- `UserPatronActions.tsx:106-110` bez `onActionComplete` woła `router.refresh()`. `/admin/users` jest stroną kliencką z `useAdminListQuery`, więc `refresh` nie pobiera listy ponownie (`users/page.tsx:318` nie przekazuje callbacku).
- Naprawa: przekazać `onActionComplete={() => fetchUsers(page)}` albo invalidate query.
- Nakład: S. Pewność: wysoka.

**ADM-13 — P2 — UX.** Admin nie widzi powodu błędu walidacji.
- `parseAdminBody` zwraca `{error:"Invalid data", details}` (`admin-body.ts:47-55`). `readAdminApiError` (`lib/admin/api-error.ts:6-24`) czyta tylko `message`/`error`, nigdy `details.fieldErrors`. Kanał (`ChannelSettingsForm.tsx` ~56) pokazuje `payload.error`.
- Admin dostaje angielskie „Invalid data” zamiast polskiego „Podaj poprawny adres URL…”, który już jest zdefiniowany w schemacie (`channel/route.ts:31`).
- Podobnie inne trasy zwracają angielskie komunikaty: „No file uploaded”, „File too large. Max: 5 MB”, `Payment … has status … and cannot be refunded`.
- Naprawa: jedna funkcja formatująca `details.fieldErrors` z polskimi komunikatami w schematach, pokazywanymi przy polach.
- Nakład: S. Pewność: wysoka.

**ADM-14 — P2 — bezpieczeństwo/audyt.** Dziennik audytu nie ma kontekstu żądania i nie da się go przeglądać.
- `AuditRepository.create` (`audit.repository.ts:22-38`) zapisuje `ip`/`userAgent` tylko gdy są podane. Żadna ścieżka admina ich nie podaje (ustawia je tylko `lib/auth/audit.ts` dla zdarzeń logowania).
- `requestId` jest ustawiany tylko w części tras (np. `users/*`, `videos/[id]` PATCH). W `refund`, `patron`, `comments/*`, `reorder` i innych go nie ma.
- Brak „przed/po” dla zmian.
- Brak strony z przeglądem `AuditLog` (filtry: aktor, akcja, cel, data). Jest tylko lista w karcie filmu (`VideoAuditLog`) i użytkownika.
- Naprawa: kontekst żądania (requestId z `x-request-id`, IP przez `lib/api/client-ip.ts`, UA) w `AsyncLocalStorage` albo przekazany do `createAppContext` w `requireAdminForApi`. `metadata.diff` dla aktualizacji. Strona `/admin/audit` (§5.7).
- Nakład: M. Pewność: wysoka.

**ADM-15 — P2 — błąd/prywatność.** „Wyślij wiadomość” prowadzi donikąd.
- `users/page.tsx:319` linkuje do `/admin/emails?to=<email>`, bez kodowania i z e-mailem w URL (trafia do historii i logów).
- `app/admin/emails/page.tsx` nie czyta `searchParams`, a wysyłki do pojedynczej osoby nie ma (tylko broadcast MANUAL).
- Naprawa: usunąć przycisk albo dodać „Wyślij e-mail” w szczegółach użytkownika (POST z `userId`, bez e-maila w URL). Ewentualnie link do PP Support.
- Nakład: S. Pewność: wysoka.

**ADM-16 — P2 — UX/śmieć.** Rozsyłka powiadomień trafia do użytkowników, którzy jej nie widzą.
- Dzwonek jest ukryty (`Navbar.tsx:23`, `TEMP_HIDE_NOTIFICATIONS_BELL = true`). `/admin/notifications` pozwala jednak wysłać broadcast bez żadnego ostrzeżenia.
- Kafelki (`notifications/page.tsx:50-52`) liczą „ostatnie 50”, a podpis sugeruje całość.
- Naprawa: baner „Dzwonek jest ukryty, powiadomienia nie są widoczne” albo ukrycie sekcji, dopóki flaga jest włączona. Statystyki liczyć zapytaniem `count`.
- Nakład: S. Pewność: wysoka.

**ADM-17 — P2 — UX.** Moderacja: błędy są ciche, akcje nieatomowe.
- `comments/reports/page.tsx:36-72`: niepowodzenie resolve, hide i hold kończy się tylko `logger.error`, bez toastu. „Ukryj” to dwa żądania (hide, potem resolve). Gdy drugie padnie, komentarz jest ukryty, a zgłoszenie wisi. Brak stanu „pending”, więc podwójny klik wysyła dwa żądania.
- `comments/page.tsx:33` nie bierze `error` z `useAdminListQuery`, więc błąd ładowania listy daje pustą tabelę.
- Ikony akcji mają tylko `title`.
- Naprawa: endpoint `resolve` z akcją (`HIDE|HOLD|DISMISS`) w jednej transakcji, toasty, `pending` per wiersz, stan błędu listy.
- Nakład: S/M. Pewność: wysoka.

**ADM-18 — P2 — błąd/poprawność liczb.** Dashboard użytkowników.
- `users/dashboard/page.tsx:18-33`: gdy `/api/admin/users/stats` zwróci błąd, `stats` zostaje `null`, a `:58` czyta `stats.totalUsers`, co wywołuje TypeError i error boundary.
- „Wszystkie Wpłaty” liczy tylko `SUCCEEDED` (`get-admin-users-stats.use-case.ts:36`), bez `PARTIALLY_REFUNDED`.
- „Patroni” ładuje wszystkie granty do pamięci (`findMany distinct`).
- Kafel „Wpłaty” na `/admin/users` pokazuje liczbę, a nie kwotę.
- Naprawa: stan błędu, spójna definicja (succeeded + partially_refunded, kwoty netto), `count` przez `groupBy`.
- Nakład: S. Pewność: wysoka.

**ADM-19 — P2 — błąd/spójność.** Domyślna miniatura: dwa mechanizmy i zła kolejność kasowania.
- `settings/media/default-video-thumbnail/route.ts:91-92`, `:99-101` i `:147` kasują stary obiekt **przed** zapisem w DB. Gdy upsert padnie, ustawienie wskazuje na nieistniejący plik.
- Logika (Prisma, `@vercel/blob`) siedzi w trasie, a nie w module. Fallback na Vercel Blob nadal jest w kodzie, choć serwis jest na serwerku.
- Kanał ma osobne pole URL `defaultThumbnailUrl` (`channel/route.ts:14-32`), które przyjmuje dowolny `http(s)`. Proxy miniatur dopuszcza tylko hosty z allowlisty (`MediaPolicy.isAllowedThumbnailUrl`), więc obcy URL po cichu się nie wyświetli.
- Naprawa: jeden mechanizm (upload do R2 w module media, usuwanie starego obiektu po commicie), usunąć pole URL i Blob.
- Nakład: M. Pewność: wysoka.

**ADM-20 — P2 — spójność.** Brak wspólnej powłoki i nawigacji panelu.
- Każda strona sama renderuje publiczny `Navbar` (z menu użytkownika, przełącznikiem języka, logiką PWA). `AdminLayoutShell` (`videos/components/AdminLayoutShell.tsx`) obejmuje tylko filmy. `/admin/settings` (`settings/page.tsx:84`) nie ma `Navbar` w ogóle.
- `AdminVisualShell` dubluje rolę layoutu.
- Brak bocznej nawigacji. Wpłaty są schowane pod „Użytkownicy”.
- Dashboard `/admin` (`app/admin/page.tsx:7-71`) to 7 kafelków bez żadnej informacji. Opis „ustawienia bramki patronackiej” (`:29`) jest nieaktualny.
- Naprawa: `app/admin/layout.tsx` z sidebarem (shadcn `Sidebar`), breadcrumbs i nagłówkiem strony jako komponent. Usunąć `Navbar` ze stron.
- Nakład: M. Pewność: wysoka.

**ADM-21 — P2 — spójność.** Mieszany język i surowe enumy.
- `AdminVideoStats.tsx:21-24` („Archiv”, „Public”, „Login”), `VideoForm.tsx:270` („Tier”), `videos/[id]/page.tsx:105,153-155` (`PUBLISHED`, „Hero Video”, „TAK”).
- `layout/page.tsx:264-266` (surowe `tier`/`status`), `users/page.tsx:277,308` („PATRON (GRANT)”, `ADMIN`/`USER`), `users/[userId]/page.tsx:108` („Patron (grant truth)”).
- Toasty „Akcja publish wykonana pomyślnie.” (`videos/[id]/page.tsx:80`), komunikaty API po angielsku (ADM-13), „Broadcasty”, „Dashboard”.
- Naprawa: jedna mapa etykiet PL dla enumów (`lib/admin/labels.ts`) i przegląd tekstów.
- Nakład: S/M. Pewność: wysoka.

**ADM-22 — P2 — dostępność.**
- Przyciski z samą ikoną mają tylko `title`, bez `aria-label`: `VideoTable.tsx:152-157`, `comments/page.tsx` (hold, hide, approve), `layout/page.tsx:280-288`.
- `Label` niepowiązany z `Select`: `VideoForm.tsx:188,270`.
- Pole „Poz.” bez etykiety: `videos/[id]/page.tsx:161`.
- Teksty 8-10 px (`text-[8px]`, `text-[9px]`) w tabelach użytkowników i wpłat oraz na stronie układu. Wiersze `opacity-50 grayscale` dla usuniętych użytkowników.
- Przesuwanie na stronie układu tylko strzałkami (dobrze), ale bez ogłoszenia zmiany (`aria-live`).
- Naprawa: przejście po WCAG 2.2 AA, min. 12 px dla treści.
- Nakład: S/M. Pewność: wysoka.

**ADM-23 — P2 — spójność/bezpieczeństwo operacyjne.** Rozsyłka e-mail.
- `emails/broadcast/route.ts:24-90`: pola „Backward compatibility” (`recipientGroup`, `subjectPl`, `isTest`…) są w praktyce **głównym** kontraktem, bo `BroadcastWizard.tsx:130-150` wysyła `recipientGroup`. Audience `NON_PATRONS` jest nieosiągalne z UI.
- Brak klucza idempotencji. Ponowienie po timeoucie wyśle drugi broadcast do wszystkich.
- Wysyłka i filtrowanie odbiorców idą synchronicznie w żądaniu, z dwoma zapytaniami do DB na odbiorcę (`send-admin-broadcast-email.use-case.ts:100-115`).
- GET historii używa aktora `system` (`:117-121`).
- Naprawa: jeden kontrakt zod (bez legacy), `requestId` idempotencji zapisany w `BroadcastEmail`, filtrowanie odbiorców jednym zapytaniem, wysyłka w tle (kolejka jak `VideoEncodeJob`).
- Nakład: M. Pewność: wysoka.

**ADM-24 — P2 — śmieć (do decyzji).** Zakładki „Odpowiedzi” i „Ustawienia (Resend Audience)”.
- Poczta przychodząca idzie od 2026-10-02 przez Cloudflare Email Routing do PP Support (CLAUDE.md §0). `InboundInbox` (Resend `email.received`) najpewniej nic już nie dostaje.
- `emails/status/route.ts` to zaszyta zaślepka („UNVERIFIED”, „Brak automatycznego health checku”).
- Naprawa: potwierdzić w Resend, że inbound jest martwy, potem usunąć zakładkę, trasę `responses` i `status`. W panelu dać link do PP Support.
- Nakład: S. Pewność: średnia (nie sprawdzałem konfiguracji Resend).

**ADM-25 — P2 — śmieć.** Trasy bez wywołującego.
- Niezależne od #1614: `stats`, `maintenance/main-channel/{preview,apply}`, `videos/r2-diagnostics` (komunikaty o „redeploy w Vercel”), `videos/resync`, `videos/distribution-backfill`, `videos/[id]/{comments,media}`, `videos/[id]/original-upload` (wersja jednoczęściowa), `payment-settings` GET, `channel` GET.
- W zakresie #1614: `health/{cloudflare,mux}`, `video-provider-jobs/reconcile`, `videos/[id]/{distribution-plan,playback-route,reconcile,upload,sources*,provider-jobs/*}` oraz akcje `create-upload-url`, `attach-asset`, `import-legacy-to-cloudflare`, `sync-cloudflare` w `actions/route.ts:88-117`.
- Każda zbędna trasa admina to dodatkowa powierzchnia ataku.
- Naprawa: usunąć po #1614. Operacje serwisowe (maintenance, resync, r2-diagnostics) jako skrypty CLI na serwerku albo jedna strona „Narzędzia”.
- Nakład: S. Pewność: wysoka (grep wywołań w `app/`, `lib/`, `components/`).

**ADM-31 — P2 — brak testu.** Testy panelu nie sprawdzają zachowania.
- 9 plików testów admina to testy tekstu źródła (`readFileSync` + `toContain`), np. `admin-videos-client-auth-gate.test.ts`, `admin-dashboard.test.ts` (oczekuje 4 kafelków, a jest 7, i i tak przechodzi). Brak testu paginacji, strony układu i odświeżania listy po akcji.
- `admin-mutations-audit-static.test.ts:54-75` uznaje trasę za audytowaną, gdy **dowolny** identyfikator z pliku jest nazwą eksportu z pliku, który woła `recordAuditEvent`. Wspólne nazwy (`createAppContext`, eksporty z `@/lib/modules/video`) dają fałszywe „OK”. To nadmierne przybliżenie, nie dowód.
- `admin-mutations-validation-static.test.ts` uznaje za zwalidowane każde wystąpienie `.safeParse(`, więc też trasę z `adminLooseObjectSchema` (ADM-08).
- E2E: tylko `tests/e2e/beta-smoke.spec.ts`.
- Naprawa: testy komponentów (Testing Library, mock fetch/MSW) dla list, layoutu i dialogów. Kontrakt tras: mapa trasa → schemat → oczekiwana akcja audytu, test wołający handler z zamockowanym `recordAuditEvent` (zachowanie zamiast grep). Playwright dla 5 ścieżek admina na seedowanej bazie.
- Nakład: M/L. Pewność: wysoka.

**ADM-35 — P2 — brak funkcji.** Czego brakuje do codziennej pracy jednej osoby:
1. **Zdrowie systemu** (`/admin/system`): worker `encoder` (heartbeat jest w `PipelineStatusCard.tsx:34`, ale tylko per film), kolejka kodowania (wszystkie zadania), ostatnie uruchomienie timerów systemd (crony), ostatnie webhooki Stripe/Resend i ich błędy, stan R2 i dysku, wersja wdrożenia.
2. **Dziennik audytu z filtrami** (ADM-14).
3. **Eksport wpłat CSV.** Ikona `Download` jest importowana w `users/payments/page.tsx:16`, a funkcji nie ma.
4. **Wyszukiwarka globalna** (użytkownik / film / płatność po ID, e-mailu, Stripe ID), np. Ctrl+K.
5. **Szczegóły konta użytkownika:** weryfikacja e-mail, 2FA, powiązane konto Google, ostatnie logowanie, aktywne sesje z możliwością wylogowania, blokada komentowania/bana.
6. **Dziennik błędów aplikacji** (ostatnie N błędów z loggera) albo link do miejsca, gdzie są.
7. **Przegląd premier i celu zbiórki** na dashboardzie.

Nadmiarowe: kafelki statystyk filmów (dziś martwe), „Diagnostyka” i „Statystyki” z placeholderem „Rozszerzona analityka… w osobnym zakresie” (`videos/[id]/page.tsx:257`), sztuczny licznik subskrybentów (`displaySubscribersCount`, do decyzji właściciela).
- Nakład: L (łącznie). Pewność: wysoka.

### P3

**ADM-26 — P3 — śmieć.** Martwy kod:
- `normalizeCloudflareSource` (`video-utils.ts:7-23`).
- Parametr `_isAdmin` w `useAdminVideos` i fikcyjny stan `isAdmin` w `videos/page.tsx:30,48,299` (ustawiany zawsze na `true`; gałąź „Brak uprawnień” nieosiągalna).
- `verifyAdmin`, `isAdminRequest`, `requireUser` w `lib/auth-utils.ts:44-87` (brak użyć).
- Nieużywane importy: `Download`, `Image` w `users/payments/page.tsx:16,19`; `Trash2`, `Share2`, `Mail` w `users/[userId]/page.tsx:11`.
- Komentarz w `resolve-admin-audit-context.ts` mówi o „Clerk session”.
- Nakład: S. Pewność: wysoka.

**ADM-27 — P3 — bezpieczeństwo (obrona w głąb).** Sprawdzenie admina tylko w layoucie dla stron serwerowych.
- Dokumentacja Next.js ostrzega, że layout nie renderuje się ponownie przy nawigacji i nie blokuje renderu segmentów potomnych.
- `/admin/payments/page.tsx:8` czyta dane bez własnego `requireAdmin()` (dane niewrażliwe, ale wzorzec jest kruchy). `/admin/channel` robi to dobrze.
- Naprawa: DAL `getAdminContext()` z `cache()`, wołany w każdej stronie i akcji serwerowej.
- Nakład: S. Pewność: wysoka.

**ADM-28 — P3 — spójność z frameworkiem.** `middleware.ts` jest w Next 16 przestarzałe: plik nazywa się teraz `proxy.ts`, działa na Node.js i jest do tego codemod.
- Naprawa: `npx @next/codemod@canary middleware-to-proxy .` w osobnym PR.
- Nakład: S. Pewność: wysoka.

**ADM-29 — P3 — bezpieczeństwo.** Eksport CSV.
- `users/export/route.ts:30-36`: gałąź „formuła” zwraca `"'${str}"` bez podwajania cudzysłowów, co psuje plik. Nie obsługuje wiodącego `\t` i `\r` (OWASP CSV Injection).
- Naprawa: najpierw escapowanie cudzysłowów, potem prefiks `'` dla `= + - @ \t \r`.
- Nakład: S. Pewność: wysoka.

**ADM-30 — P3 — spójność.** Nieaktualne słownictwo płatnego modelu:
- „ustawienia bramki patronackiej” (`app/admin/page.tsx:29`).
- „Patron threshold” w `/admin/payments` bez wyjaśnienia, że to tylko próg znaczka.
- „Użytkownicy i Patroni… monitoruj aktywność finansową” (`users/page.tsx:114-116`).
- Zakładka „Dostęp”, „Przejdź do edycji dostępu” (`videos/[id]/page.tsx:206`), choć PATRON = zalogowany.
- Nakład: S. Pewność: wysoka.

**ADM-32 — P3 — dokumentacja/bezpieczeństwo.** Limit „per admin user id” jest w rzeczywistości kluczowany skrótem ciasteczka sesji (`middleware.ts:126-133`). Fail-open przy awarii Redisa (świadoma decyzja).
- Naprawa: poprawić opis albo kluczować po `userId` po walidacji (w handlerze).
- Nakład: S. Pewność: wysoka.

**ADM-33 — P3 — UX.** Szczegóły filmu.
- Statusy jako surowe enumy, warunek `video.asset` (legacy) przy podpowiedzi uploadu (`videos/[id]/page.tsx:144`).
- „Akcja publish wykonana” bez odświeżenia Hero na innych kartach.
- Brak widoku premiery i celu zbiórki w szczegółach.
- Nakład: S. Pewność: wysoka.

**ADM-34 — P3 — śmieć danych/UX.**
- Okładka wgrana, ale niezapisana w formularzu, zostaje jako sierota w prywatnym buckecie (brak sprzątania).
- Pole „Ręczny URL miniatury” pokazuje wewnętrzny adres S3 R2 po uploadzie (`VideoForm.tsx:238-247`), a „Resetuj” wstawia `/logo.png` zamiast domyślnej miniatury kanału.
- Nakład: S. Pewność: średnia.

**ADM-36 — P3 — spójność.** Archiwizacja przez select „Status” w formularzu (`VideoForm.tsx:291-293`) idzie przez `updateAdminVideo` (audyt `VIDEO_UPDATED`), a nie `archiveAdminVideo` (osobny use case i akcja audytu). To dwa różne zapisy tej samej operacji.
- Nakład: S. Pewność: wysoka.

**ADM-37 — P3 — błąd (współbieżność).** Brak blokady optymistycznej. Strona edycji wysyła wszystkie pola (`[id]/edit/page.tsx:126-149`), więc dwie karty albo zmiana z widoku szczegółów nadpisują się po cichu.
- Naprawa: `updatedAt` w żądaniu i odpowiedź 409 przy niezgodności.
- Nakład: S. Pewność: wysoka.

---

## 4. Rozbieżności dokumentacja ↔ kod

| Dokument | Twierdzenie | Kod |
|---|---|---|
| CLAUDE.md §5 tabela | `/admin/videos/new` — „Create video” | Strona nie istnieje. Tworzenie jest inline na liście |
| CLAUDE.md §5 tabela | `/admin/settings` — „Vercel Blob upload” | R2 prywatny z fallbackiem na Blob |
| CLAUDE.md §5 (Etap 0) | „all 55 app/api/admin routes” | 61 tras |
| CLAUDE.md §5 (Etap 0) | `/api/admin/health/clerk` omija `auth.protect()` przy tokenie | Trasa nie istnieje. `HEALTHCHECK_TOKEN` używają `/api/health` i `/api/diagnostics/cloudflare-stream` |
| CLAUDE.md §5 (Etap 0) | Rate limit „keyed by admin user id” | Skrót ciasteczka sesji (`middleware.ts:126-133`) |
| CLAUDE.md §5 (Etap 0) | `AuditLog` przechowuje `ip`, `userAgent`, `requestId` | Kolumny są, ścieżki admina ich nie wypełniają (ADM-14) |
| CLAUDE.md §4.16 | „Raw fundraisingGoal* keys in a request body are ignored” | Prawda tylko dla `PATCH /videos/[id]`. `PATCH /actions` je przyjmuje (ADM-08) |
| CLAUDE.md §6 | `POST /videos/[id]/reconcile` wołany z media panelu („Odśwież” + poll 15 s), „nie cofać” | Media panel zastąpiony przez `VideoPipelinePanel`. Trasa bez wywołującego |
| CLAUDE.md §5.1/§5.2 | Tickety `ADMIN-LIST-SCAFFOLD-CONSOLIDATION-001`, `ADMIN-DESIGN-SYSTEM-CONSISTENCY-001` w `docs/tickets/ready/` | Brak takich plików |
| CLAUDE.md §5.2 | `useAdminListQuery` „used by users, comments, reports, videos” (komentarz w hooku) | Filmy i wpłaty mają własne implementacje. Paginacja w users jest zepsuta (ADM-01) |
| CLAUDE.md §5.1 | `BroadcastEmailForm.tsx` „dead code, left alone” | Plik usunięty |
| CLAUDE.md §5 (decyzja) | „Admin identity … `ADMIN_CLERK_USER_IDS`”, „Clerk-based admin works” | Better Auth + `ADMIN_EMAILS` |
| `docs/specs/ADMIN-COCKPIT-SPEC.md` | „Paid-but-locked support flow”, „Clerk mismatch”, „suspend/reactivate” | Model darmowy. Clerk usunięty. Brak zawieszania kont |
| `docs/audit/2026-09-30-admin-backoffice-architecture.md` | Clerk, Vercel, `admin.pawelperfect.pl`, 55 tras | Całość sprzed Better Auth i serwerka. Do oznaczenia jako historyczny |
| `tests/unit/admin-dashboard.test.ts` | „renders four admin section tiles” | 7 kafelków |

---

## 5. Lepsze rozwiązania (stan na październik 2026, ze źródłami)

Zasada przewodnia: przy jednym adminie najlepszy jest **prosty, jednolity wzorzec**, nie więcej warstw. Poniżej propozycje uporządkowane od najwyższego stosunku wartości do kosztu.

### 5.1 Odczyty: Server Components + Data Access Layer, stan list w URL

**Dziś:** 15 stron klienckich robi `fetch` w `useEffect` z ręcznym stanem. Stąd ADM-01, brak anulowania, „migotanie” skeletonów i zdublowana autoryzacja (layout + API).

**Lepiej:** strony list jako Server Components czytające `searchParams` (strona, filtr, sortowanie). Dane brać bezpośrednio z use case przez `lib/admin/dal.ts` (`server-only`, `cache()`, `requireAdmin()` wewnątrz). Next.js zaleca DAL dla nowych projektów, sprawdzanie autoryzacji blisko danych i ostrzega przed sprawdzaniem tylko w layoucie.

Paginacja i filtry jako linki/`router.replace` z nowym `searchParams`: odporne na F5, do udostępnienia, bez wyścigów. Interaktywne fragmenty (dialogi, upload, polling pipeline) zostają klienckie.

**Koszt:** M na listę (4 listy). Usuwa ADM-01 i ADM-03 u źródła.

Źródła: https://nextjs.org/docs/app/guides/data-security , https://nextjs.org/docs/app/guides/authentication

### 5.2 Mutacje: Server Actions zamiast 61 tras REST?

**Ocena:** opłaca się częściowo, nie w całości.

**Za:**
- Wbudowany test `Origin` = `Host`.
- Typowane wywołania bez ręcznego `fetch` i parsowania błędów.
- `revalidatePath` po akcji rozwiązuje ADM-12.
- Martwe akcje są usuwane z bundla, więc nie byłoby problemu ADM-25.

**Przeciw i ograniczenia:**
- Każda akcja to publiczny endpoint POST i musi sama sprawdzać admina (dokumentacja wprost). Middleware/proxy nie jest granicą bezpieczeństwa.
- Upload multipart, proxy obrazków, eksport CSV, polling pipeline i wywołania z publicznego `CommentItem` naturalnie zostają trasami.
- Limity per trasa trzeba by przenieść z middleware do helpera `adminAction()`.

**Rekomendacja:** formularze i proste akcje (edycja filmu, kanał, płatności, szablony, moderacja, patron, publish/archive) przenieść na Server Actions przez jeden wrapper `adminAction(schema, handler, {audit, rateLimit, stepUp})`. Wrapper robi: `requireAdminActor` → zod → limit → use case → `recordAuditEvent` z kontekstem → `revalidatePath`. Trasy REST zostawić tylko tam, gdzie są potrzebne (ok. 12-15 zamiast 61).

**Tańsza alternatywa (S/M):** zostawić REST, ale dodać jeden typowany klient `adminApi.<akcja>()` z tymi samymi schematami zod i TanStack Query `useMutation` z invalidacją.

**Koszt:** L dla pełnej migracji (robić stopniowo, sekcja po sekcji).

Źródła: https://nextjs.org/docs/app/guides/data-security (Server Actions: secure IDs, Origin check, auth w każdej akcji), https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions

### 5.3 Formularze: jeden schemat zod dla klienta i serwera

**Dziś:** schematy są tylko po stronie serwera (`admin-schemas.ts`), część ręczna (`admin-video-payload.ts`), a błędy pól nie wracają do UI (ADM-13).

**Lepiej:** schemat w `lib/admin/schemas/*` importowany przez formularz (react-hook-form + `zodResolver`, albo `useActionState` z `fieldErrors` przy Server Actions) i przez serwer. Komunikaty po polsku w schemacie. Formularz filmu (356 linii, ręczne `setFormData({...formData})`) skraca się wtedy wyraźnie.

**Koszt:** M.

Źródła: https://nextjs.org/docs/app/guides/authentication (wzorzec `useActionState` + zod `fieldErrors`), https://vercel.com/academy/nextjs-foundations/server-actions-for-forms

### 5.4 Jedna generyczna tabela danych

**Dziś:** 5 ręcznie pisanych tabel z różną paginacją, filtrami, pustymi stanami i rozmiarami tekstu (ADM-20..22).

**Lepiej:** `AdminDataTable` na TanStack Table (logika headless) + shadcn `Table`. Sortowanie, paginacja i filtry po stronie serwera, stan w URL (nuqs albo `searchParams`), wspólne puste stany, skeleton, zaznaczanie i akcje zbiorcze z potwierdzeniem. To dziś de facto standard w ekosystemie shadcn.

**Koszt:** M (komponent) + S na każdą listę.

Źródła: https://data-table.openstatus.dev/ , https://next.jqueryscript.net/shadcn-ui/data-table-tablecn/ , https://niko-table.com/

### 5.5 Gdzie zostaje klient: TanStack Query (już jest w zależnościach)

`@tanstack/react-query` jest w `package.json:59`, ale panel go nie używa. Dla elementów klienckich (polling pipeline, licznik zgłoszeń, dialogi) `useQuery` daje `signal` do anulowania, `placeholderData: keepPreviousData` dla paginacji, deduplikację i `invalidateQueries` po mutacji (ADM-12).

**Koszt:** S/M.

Źródła: https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries , https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

### 5.6 Jedna powłoka panelu

`app/admin/layout.tsx` jako Server Component z sidebarem (shadcn `Sidebar`): Pulpit, Filmy, Układ, Komentarze, Zgłoszenia (z licznikiem), Użytkownicy, Wpłaty, Poczta, Powiadomienia, Kanał, Ustawienia, Audyt, System. Do tego breadcrumbs i `PageHeader`. Bez publicznego `Navbar`. Mapa etykiet PL dla enumów.

**Koszt:** M. Zamyka ADM-20, ADM-21 i część ADM-22.

### 5.7 Dziennik audytu według OWASP

**Pola:** kto (id, typ aktora, metoda uwierzytelnienia, w tym czy 2FA), co (akcja, wynik sukces/porażka), na czym (cel), kiedy, skąd (IP, UA, `requestId`), zmiana (przed/po dla pól), a dla break-glass osobna flaga.

**Wykonanie:** kontekst żądania raz w `requireAdminForApi`/`adminAction` przez `AsyncLocalStorage`. Strona `/admin/audit` z filtrami i eksportem. Rejestrować też **nieudane** próby akcji admina (403, walidacja), bo dziś audyt jest tylko po sukcesie.

Źródła: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html , https://pangea.cloud/securebydesign/secure-audit-field-selection/

### 5.8 Uwierzytelnienie admina

- MFA obowiązkowe dla admina i step-up przed refund, delete i broadcast (OWASP).
- Better Auth nie ma jeszcze wbudowanego „required-admins” (otwarta propozycja #10310), więc wymuszenie robi się w `requireAdminActor` (sprawdzenie `twoFactorEnabled`) plus `freshAge` dla akcji wrażliwych.

Źródła: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html , https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html , https://github.com/better-auth/better-auth/issues/10310

### 5.9 Idempotencja operacji z pieniędzmi i masowych

Stripe zaleca klucz idempotencji dla każdego POST, w tym `refunds.create`: UUID v4 albo klucz deterministyczny bez danych osobowych. Ten sam wzorzec (klucz zapisany w DB z unikalnym indeksem) dla broadcastu e-mail i powiadomień.

Źródło: https://docs.stripe.com/api/idempotent_requests

### 5.10 Framework

`middleware.ts` → `proxy.ts` (Next 16, codemod, domyślnie Node.js). Proxy pozostaje sprawdzeniem optymistycznym, a prawdziwa autoryzacja jest w DAL i akcjach (już tak jest, trzeba to tylko utrzymać).

Źródło: https://nextjs.org/docs/app/api-reference/file-conventions/proxy

### 5.11 Testy zamiast „grepowania” źródła

- Testy komponentów (Testing Library) dla list i dialogów.
- Test kontraktu tras budowany z jednej mapy `{trasa, metoda, schemat, akcjaAudytu, limit}`, która jest też źródłem prawdy dla wrappera z 5.2.
- Playwright: logowanie seedowanym adminem z TOTP, publikacja filmu, zmiana kolejności i Hero, zwrot w trybie testowym Stripe, moderacja.
- Testy statyczne zostawić tylko jako sieć bezpieczeństwa, nie jako jedyną weryfikację.

---

## 6. Kolejność małych PR-ów

| # | PR | Zamyka | Nakład |
|---|---|---|---|
| 1 | Naprawa paginacji i wyszukiwania (users, payments, videos): efekt zależny od parametrów, `AbortController`, debounce | ADM-01 | S |
| 2 | Strona układu: Hero przez `set-hero`; `pageSize` → `limit` i `orderDir` w repozytorium; pobieranie wszystkich filmów | ADM-02, ADM-03 | S |
| 3 | Zwrot: `idempotencyKey`, blokada wiersza, pole powodu w dialogu | ADM-04 | S/M |
| 4 | Wspólny `ConfirmDialog` dla usuwania komentarzy (też zbiorczego), unpublish i archive | ADM-06 | S |
| 5 | Błędy walidacji po polsku z polami (`readAdminApiError` + schematy) | ADM-13 | S |
| 6 | Lista filmów: usunąć martwe filtry i statystyki (albo zaimplementować „Wymaga uwagi”) | ADM-07 | S |
| 7 | Szybkie poprawki: odświeżenie listy po akcji patrona, crash dashboardu użytkowników, ciche błędy zgłoszeń, przycisk „Wyślij wiadomość”, baner o ukrytym dzwonku | ADM-12, 15, 16, 17, 18 | S |
| 8 | Usunięcie inline edycji z listy, strona `/admin/videos/new`, duplikacja po stronie serwera, `beforeunload` w uploadzie | ADM-09, 10, 11 | M |
| 9 | Jedna ścieżka zapisu filmu (ścisły schemat), usunięcie `PATCH /actions`, archiwizacja tylko przez use case, `updatedAt` (409) | ADM-08, 36, 37 | M |
| 10 | Po scaleniu #1614: usunięcie osieroconych tras i martwego kodu, decyzja o „Odpowiedziach”/Resend Audience | ADM-24, 25, 26 | S |
| 11 | Kontekst audytu (IP, UA, `requestId`, diff) + strona `/admin/audit` | ADM-14 | M |
| 12 | Wymuszenie 2FA dla admina + step-up dla refund, delete i broadcast | ADM-05 | M |
| 13 | Idempotencja broadcastu i wysyłka w tle | ADM-23 | M |
| 14 | Domyślna miniatura: jeden mechanizm w module media, kasowanie po commicie, bez Blob | ADM-19, 34 | M |
| 15 | Powłoka panelu z sidebarem, mapa etykiet PL, poprawki dostępności | ADM-20, 21, 22, 30 | M |
| 16 | Strona „System” (worker, kolejka, crony, webhooki) + eksport wpłat + wyszukiwarka | ADM-35 | M/L |
| 17 | `AdminDataTable` (TanStack Table + URL) i migracja list na Server Components + DAL | §5.1, §5.4 | L |
| 18 | Stopniowe przejście formularzy na `adminAction` (Server Actions) ze wspólnymi schematami | §5.2, §5.3 | L |
| 19 | Testy behawioralne i E2E panelu; uszczelnienie testów statycznych | ADM-31 | M/L |
| 20 | Drobne: `proxy.ts` (codemod), CSV escaping, DAL w stronach serwerowych, opis limitów | ADM-27, 28, 29, 32, 33 | S |
| 21 | Synchronizacja CLAUDE.md §5, oznaczenie ADMIN-COCKPIT-SPEC i dokumentu architektury z 2026-09-30 jako historycznych | §4 | S |

PR-y 1-7 są małe, niezależne i usuwają wszystkie znaleziska P1 poza ADM-05 (PR 12).
