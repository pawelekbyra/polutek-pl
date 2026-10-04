# Audyt podsystemu: komentarze, reakcje, polubienia filmu, wyświetlenia

Stan: `main` @ `88c787d0` (worktree `dns-migration-cloudflare-bcfaf0`), 2026-10-03. Audyt tylko do odczytu. Na produkcji wykonano wyłącznie anonimowe GET (`/api/channel/sidebar`, `/api/comments?videoId=…`, `/api/comments/{id}/replies`, `/api/videos/{id}/comments`).

---

## 1. Podsumowanie i ocena

**Ocena ogólna: 5/10.** Szkielet jest rozsądny: moduł `lib/modules/comments` z use case'ami, jedna tabela reakcji `CommentReaction` z `@@unique([userId, commentId])`, liczniki zmieniane w transakcji, TanStack Query v5 z optymistycznymi aktualizacjami i wycofaniem, render tekstu przez React (brak XSS), limit 5 komentarzy/min, audyt akcji admina. Ale system nie jest "idealny" ani spójny:

- **Wątki są ucięte do 3 odpowiedzi.** UI renderuje wyłącznie `repliesPreview` (3 najstarsze), endpoint `/replies` nie jest nigdzie używany, a dla gości i tak zwraca 401 (zweryfikowane na produkcji). Czwarta odpowiedź znika po odświeżeniu (COM-01).
- **Moderacja ma błędy niszczące dane**: usunięcie nadpisuje treść `"[deleted]"`, a "Przywróć" na usuniętym komentarzu publikuje `[deleted]` jako widoczny komentarz (COM-02); trzy dowolne konta mogą ukryć każdy komentarz (COM-03).
- **Polubienie filmu przerysowuje całą stronę na serwerze** (`revalidatePath('/', 'layout')` w server action) (COM-06).
- **DSA (art. 16/17)**: brak potwierdzenia zgłoszenia, brak informacji o decyzji, brak uzasadnienia dla autora (COM-18).
- Dużo śmieci: martwe tabele `CommentLike`/`CommentDislike`, martwy shim `/api/comments` POST/PATCH/DELETE, nieużywany i niebezpieczny `/api/comments/image-upload`, potrójna definicja DTO, hack testowy w kodzie produkcyjnym, kolumna `score` tylko do zapisu (COM-37).
- Testy: dużo testów "grep po źródle", brak testów dla najpoważniejszych błędów (COM-42).

**Liczba znalezisk: 51** (COM-01…COM-51) — P0: 0, P1: 6, P2: 34, P3: 11.

Kształt publicznej odpowiedzi API (produkcja, gość): brak e-maila i pól prywatnych; jest `author.id` (= `User.id`, dawny identyfikator Clerk `user_…`), surowe `author.username`, odznaki `ADMIN`/`AUTHOR`/`PATRON`, `imageUrl` wciąż na `img.clerk.com`. Brak nagłówka `Cache-Control` (Cloudflare: `DYNAMIC`). `viewer.canComment=false` dla gościa — poprawnie.

---

## 2. Tabela operacji

| Operacja | Trasa | Strażnik | Walidacja | Test |
|---|---|---|---|---|
| Lista komentarzy (główne) | `GET /api/comments?videoId=` → `GET /api/videos/[id]/comments` (`app/api/videos/[id]/comments/route.ts:40`) | middleware: `/api/comments` publiczne (exact match, `middleware.ts:69`); `checkVideoAccess` (LOGIN_REQUIRED = czytanie dozwolone) | `limit` 1..50; `sortBy` bez walidacji (`as any`, l.49) | `comments-route.test.ts`, `core-flows`, `r8-access-inheritance` |
| Lista komentarzy (bezpośrednio) | `GET /api/videos/[id]/comments` | middleware: **nie publiczna** → 401 dla gościa (zweryfikowane) | jw. | brak testu middleware |
| Odpowiedzi | `GET /api/comments/[id]/replies` (`replies/route.ts:9`) | middleware: **401 dla gościa** (zweryfikowane); use case pozwala czytać | `limit` **bez ograniczenia** (l.13) | `list-comment-replies-public-read` (tylko use case) |
| Kontekst komentarza | `GET /api/comments/[id]/context` | zalogowany; `hasAccess` | brak | brak |
| Dodanie komentarza/odpowiedzi | `POST /api/videos/[id]/comments` (`route.ts:88`) | zalogowany; rate limit 5/min/użytkownik; `checkVideoAccess` | zod: `text` 1..5000 (trim) lub `imageUrl` (host z allowlisty); body ≤10 kB; use case: ≤2000 grafemów; `parentId` bez walidacji formatu i statusu rodzica | `comments-route.test.ts` (8), `patron-grant-write-access` |
| Dodanie (shim) | `POST /api/comments` (`app/api/comments/route.ts:15`) | cookie w middleware | `request.clone().json()` bez limitu rozmiaru | brak; nieużywane przez frontend |
| Edycja | `PATCH /api/comments/[id]` (`[commentId]/route.ts:12`) | zalogowany; autor **lub admin** (`comment.policy.ts:37`) | zod `text` min 1, use case ≤2000; brak limitu body; brak rate limitu | brak testu trasy |
| Usunięcie (autor/moderator) | `DELETE /api/comments/[id]` | zalogowany; autor/admin/twórca; `hasAccess` | — | `core-flows` (4) |
| Reakcja LIKE/DISLIKE | `PUT /api/comments/[id]/reaction` | zalogowany; `hasAccess` | body `type`; brak rate limitu | `comment-reactions-route` (1), `toggle-comment-reaction` (3) |
| Cofnięcie reakcji | `DELETE /api/comments/[id]/reaction` | jw. | — | `toggle-comment-reaction` |
| Przypięcie / odpięcie | `POST/DELETE /api/comments/[id]/pin` | admin lub twórca; **bez** `checkVideoAccess` | tylko komentarz główny, VISIBLE | `r8-access-inheritance` (4) |
| Zgłoszenie | `POST /api/comments/[id]/report` | zalogowany; rate limit 5/h; `hasAccess` | zod reason enum, note ≤500 | brak testu trasy; brak testu progu 3 |
| Upload obrazka | `POST /api/comments/image-upload` | zalogowany; **brak rate limitu** | MIME z klienta, ≤5 MB | brak; nieużywane przez UI |
| Lajk/dislike filmu | server action `toggleVideoLike/Dislike` (`lib/actions/interactions.ts`) | zalogowany; `checkVideoAccess`; CSRF: mechanizm server actions | brak rate limitu | `toggle-video-interaction` (4), `hero-like-dislike-aria` |
| Stan lajka widza | `GET /api/videos/[id]/viewer-state` | sesja opcjonalna | brak sprawdzania dostępu (zwraca tylko własny stan) | `video-viewer-state-route.test.ts` |
| Wyświetlenie | `POST /api/videos/[id]/playback-event` → `recordPlaybackEventUseCase` | publiczne; rate limit 150/min | body rozkładane `...body` bez schematu | testy modułu video (poza zakresem) |
| Admin: lista | `GET /api/admin/comments` | `requireAdminForApi`, CSRF, rate limit | `status` rzutowany bez walidacji | `api/admin/comments-route.test.ts` (8) |
| Admin: hide/hold/approve/restore/delete/heart | `POST /api/admin/comments/[id]/{…}` | jw. | delete: zod `reason` | `admin-comment-use-cases` (use case); **brak testów mapowania błędów tras** |
| Admin: zgłoszenia | `GET /api/admin/comments/reports`, `POST …/reports/[id]/resolve` | jw. | resolve: `DISMISSED`/`ACTION_TAKEN` | use case: tak; trasy: nie |
| Admin: komentarze filmu | `GET /api/admin/videos/[id]/comments` | jw. | `sortBy as any` | `video-comments-route.test.ts` (6) |

---

## 3. Znaleziska

Format: **ID · waga · typ** — plik:linia — problem — naprawa — nakład — pewność.

### P1

**COM-01 · P1 · błąd/UX** — `lib/modules/comments/infrastructure/comment.repository.ts:35-38`, `app/components/comments/EmbeddedComments.tsx:508-531`, `middleware.ts:69`, `app/api/comments/[commentId]/replies/route.ts`
Odpowiedzi są ładowane tylko jako `replies: { take: 3, orderBy: createdAt asc }`. UI nie ma przycisku "pokaż więcej odpowiedzi", nie wyświetla `repliesCount`, nie woła `/replies` (grep: zero użyć we frontendzie). Skutek: 4. i kolejne odpowiedzi są niewidoczne dla wszystkich. Ścieżka: użytkownik wysyła 4. odpowiedź → `onMutate` dokleja ją do `repliesPreview` (`useComments.ts:240`) → `onSuccess` podmienia → przy następnym refetchu serwer zwraca 3 najstarsze → odpowiedź "znika". Dodatkowo `/api/comments/{id}/replies` nie jest na liście tras publicznych (middleware dopasowuje tylko dokładnie `/api/comments`), więc gość dostaje `401 {"error":"Unauthorized"}` (zweryfikowane na produkcji), mimo że use case pozwala czytać.
Naprawa: przycisk "Pokaż N odpowiedzi" (z `repliesCount`) + `useInfiniteQuery(['comment-replies', parentId])` na `/replies` z kursorem; dodać `/api/comments/(.*)/replies` do `isPublicRoute`; podgląd: 1-2 najnowsze lub odpowiedzi twórcy. — M — wysoka.

**COM-02 · P1 · błąd/utrata danych** — `comment.repository.ts:182`, `restore-admin-comment.use-case.ts:13`, `hide-admin-comment.use-case.ts:12-13`, `app/admin/comments/page.tsx:296-298`
`softDelete` nadpisuje `text: "[deleted]"` i `imageUrl: null`. Panel admina pokazuje "Przywróć" także dla `DELETED`, a `restoreAdminComment` ustawia `VISIBLE` bez sprawdzenia statusu → publicznie pojawia się komentarz o treści `[deleted]` podpisany nazwiskiem autora; `repliesCount` rodzica nie jest ponownie zwiększany. `hideAdminComment` też nie sprawdza statusu (DELETED → HIDDEN). Treść usuniętą przez moderatora tracimy bezpowrotnie — brak dowodu do zgłoszeń i ewentualnych skarg.
Naprawa: nie nadpisywać treści przy usunięciu (maskować w DTO, co już robi `mapCommentToDto`); twarde wymazanie dopiero po okresie retencji (cron) albo przy usunięciu konta; `restore` dozwolone tylko z `HIDDEN`/`HELD_FOR_REVIEW`; maszyna stanów w jednym miejscu (`CommentPolicy.canTransition(from, to)`). — M — wysoka.

**COM-03 · P1 · bezpieczeństwo/nadużycia** — `report-comment.use-case.ts:61-80`
Po 3 zgłoszeniach od dowolnych kont komentarz przechodzi w `HELD_FOR_REVIEW` i znika publicznie (również komentarze admina/twórcy). Brak wagi wieku konta, brak wyłączenia dla twórcy, brak powiadomienia autora. `reportsCount` nigdy nie maleje (oddalenie zgłoszenia go nie zmniejsza), więc po przywróceniu jedno nowe zgłoszenie znowu ukrywa komentarz. Rate limit zgłoszeń jest per użytkownik (5/h), więc 3 świeże konta wystarczą.
Naprawa: próg liczony z unikalnych zgłaszających z wagą (wiek konta, historia trafnych zgłoszeń), nigdy auto-hold dla roli ADMIN/autora filmu; `reportsCount` liczony z `PENDING` (lub zerowany przy decyzji); auto-hold tylko jako "do przeglądu" z powiadomieniem moderatora. — M — wysoka.

**COM-06 · P1 · wydajność** — `lib/actions/interactions.ts:39,70`
Lajk/dislike filmu idzie przez server action, która woła `revalidatePath('/', 'layout')`. Każde kliknięcie unieważnia cały layout, a odpowiedź server action niesie przerysowany payload RSC strony `force-dynamic` (zapytania o wszystkie filmy, sidebar itd.). To łamie zasadę z CLAUDE.md §4.13 "in-session switches never re-render the page on the server". Do tego `getOrCreateCurrentUser` — relikt Clerka ("Legacy requirement…").
Naprawa: zwykła trasa `PUT/DELETE /api/videos/[id]/reaction` (idempotentna, stan docelowy w body), bez `revalidatePath`; Hero aktualizuje stan z odpowiedzi; usunąć `getOrCreateCurrentUser`. — S — wysoka.

**COM-18 · P1 · prawo (DSA)** — `report-comment.use-case.ts`, `ReportDialog.tsx`, `resolve-comment-report.use-case.ts`, use case'y hide/hold/delete
Art. 16 DSA dotyczy każdego dostawcy usług hostingu (wyłączenie mikro/małych przedsiębiorstw obejmuje tylko sekcję o platformach internetowych, nie art. 16-17). Braki: (a) zgłosić może tylko zalogowany (art. 16 ust. 1: "każda osoba lub podmiot"); (b) brak potwierdzenia otrzymania zgłoszenia i informacji o decyzji dla zgłaszającego (art. 16 ust. 4-5); (c) formularz nie zbiera elementów z art. 16 ust. 2 (uzasadnienie, dlaczego treść jest nielegalna; oświadczenie o dobrej wierze) — "Kijowy Komentarz" jako powód; (d) brak uzasadnienia decyzji dla autora przy ukryciu/wstrzymaniu/usunięciu (art. 17) i informacji o środkach odwoławczych; (e) auto-hold po 3 zgłoszeniach to decyzja automatyczna — art. 17 ust. 3 lit. c wymaga informacji o użyciu środków zautomatyzowanych.
Naprawa: tabela `ModerationDecision` (komentarz, typ, podstawa: regulamin/nielegalne, fakty, automat tak/nie, kto), powiadomienie autora (in-app + e-mail) z uzasadnieniem, e-mail potwierdzenia i decyzji do zgłaszającego, formularz zgłoszenia dostępny dla gościa (z e-mailem i Turnstile). Decyzja prawna należy do właściciela. — L — średnia (interpretacja prawna).

**COM-08 · P1 · błąd/bezpieczeństwo** — `toggle-video-like.use-case.ts:45-61`, `toggle-video-dislike.use-case.ts:45-61`, `toggle-comment-like.use-case.ts:52-65`, `report-comment.use-case.ts:55-66`; przekazywanie `error.message`: wszystkie use case'y (`fail({type:"DATABASE_ERROR", message: error.message})`), `reaction/route.ts:35`, `Hero.tsx:145`
Wzorzec "find, potem create" w transakcji READ COMMITTED: dwa równoległe żądania tego samego użytkownika (podwójny klik, retry, dwie karty) → `P2002` → `DATABASE_ERROR`. Komunikat Prismy (nazwy tabel, constraintów) trafia do klienta; Hero wyświetla toast `BŁĄD BAZY DANYCH: <komunikat Prismy>`; trasa reakcji mapuje każdy błąd (także NOT_FOUND i DATABASE_ERROR) na 403.
Naprawa: `INSERT … ON CONFLICT DO NOTHING/UPDATE` (Prisma `upsert` + obsługa P2002 z jednym retry) i stan docelowy zamiast przełącznika; nigdy nie zwracać `error.message` z bazy — logować, klientowi kod błędu; mapowanie statusów jedną funkcją `commentErrorStatus`. — M — wysoka.

### P2

**COM-04 · P2 · bezpieczeństwo/spam** — `app/api/comments/[commentId]/reaction/route.ts` (brak `rateLimit`), `toggle-comment-like.use-case.ts:73-88`, `send-notification.use-case.ts:39-64`
Brak limitu reakcji; każda zmiana na LIKE tworzy nowe powiadomienie dla autora (bez deduplikacji). Pętla like→clear→like generuje dowolnie wiele wierszy `Notification`. Reakcje filmu dodatkowo zapisują wpis `AuditLog` przy każdym kliknięciu (`toggle-video-like.use-case.ts:64`).
Naprawa: rate limit (np. 60/min), deduplikacja powiadomień (`@@unique([userId, kind, targetId])` albo agregacja "X osób polubiło"), nie wysyłać ponownie po cofnięciu i ponownym lajku. — S — wysoka.

**COM-05 · P2 · bezpieczeństwo/wydajność** — `app/api/comments/[commentId]/replies/route.ts:13`
`limit = parseInt(searchParams.get("limit") || "10")` bez ograniczeń: `limit=100000` ładuje wszystko, ujemny odwraca kierunek w Prismie, `NaN` → 500.
Naprawa: zod `z.coerce.number().int().min(1).max(50)`. — S — wysoka.

**COM-07 · P2 · błąd** — wszystkie `app/api/admin/comments/[commentId]/*/route.ts` i `reports/[reportId]/resolve/route.ts` (`fromUseCaseResult`)
`CommentError` nie jest `AppError`, więc `handleApiError` zwraca 500 "Wystąpił nieoczekiwany błąd" dla NOT_FOUND/VALIDATION_ERROR (np. "zatwierdź" komentarz, który nie jest wstrzymany). Komentarz w `comment.errors.ts:24-31` twierdzi, że "every admin comments route derives its status from" `commentErrorStatus` — prawda tylko dla dwóch tras list.
Naprawa: `CommentDomainError` (już istnieje, nieużywany) albo mapowanie przez `commentErrorStatus` we wszystkich trasach; test każdej trasy. — S — wysoka.

**COM-09 · P2 · błąd** — `useComments.ts:320-367`, `EmbeddedComments.tsx:219-232`, `Hero.tsx:116-160`
Reakcje są przełącznikami liczonymi z bieżącego cache (`getCommentReactionAction`). Szybkie klikanie wysyła PUT i DELETE równolegle (osobne mutacje nie są serializowane); kolejność na serwerze może się odwrócić. Lajk filmu: serwer sam przełącza — powtórzone żądanie odwraca stan.
Naprawa: API "stan docelowy" (`PUT {reaction: 'LIKE'|'DISLIKE'|null}`), idempotentne; w TanStack Query `scope: { id: 'reaction:'+commentId }` (mutacje z tym samym `scope.id` wykonują się szeregowo). — S — wysoka.

**COM-10 · P2 · bezpieczeństwo** — `lib/modules/comments/domain/comment.dto.ts:60`, `get-comment-context.use-case.ts:27-70`
`shouldHideContent` obejmuje tylko `HIDDEN` i `DELETED`. `GET /api/comments/{id}/context` zwraca komentarz w dowolnym statusie, więc treść `HELD_FOR_REVIEW` (np. auto-wstrzymana po zgłoszeniach) jest dostępna dla każdego zalogowanego, który zna id; zwraca też komentarze kont usuniętych. Endpoint nie jest używany przez UI.
Naprawa: maskować wszystko poza `VISIBLE` dla nie-moderatorów (whitelist zamiast blacklist); usunąć endpoint albo użyć go do deep-linków (COM-24). — S — wysoka.

**COM-11 · P2 · błąd** — `create-video-comment.use-case.ts:75-84`
Rodzic sprawdzany tylko pod kątem istnienia i filmu. Można odpowiedzieć na komentarz `DELETED`/`HIDDEN`/`HELD`/autora usuniętego; odpowiedź jest niewidoczna (rodzic odfiltrowany), a `repliesCount` rodzica rośnie.
Naprawa: rodzic musi być `VISIBLE` i autor nieusunięty (moderator może więcej). — S — wysoka.

**COM-12 · P2 · błąd (spójność liczników)** — `comment.repository.ts:156-158,177-186`, `delete-comment.use-case.ts:59`
`repliesCount` rośnie przy każdym utworzeniu, maleje przy każdym usunięciu niezależnie od statusu, nie zmienia się przy hide/hold/restore/usunięciu konta autora. Sprawdzenie "już usunięty" i odczyt `parentId` są poza transakcją → dwa równoległe DELETE dekrementują dwa razy (licznik może zejść poniżej zera — brak `gt: 0`). Pole nie jest nigdzie wyświetlane.
Naprawa: liczyć widoczne odpowiedzi (`_count` z filtrem) albo aktualizować licznik jednym `UPDATE … SET "repliesCount" = (SELECT count(*) …)` w tej samej transakcji co zmiana statusu; warunkowy update `where: { id, status: { not: DELETED } }` jako blokada wyścigu. — M — wysoka.

**COM-13 · P2 · błąd** — `pin-comment.use-case.ts:46-47`, `useComments.ts:388-411`
Serwer pozwala przypiąć wiele komentarzy (nie odpina poprzedniego), UI optymistycznie zakłada jeden; po refetchu widać kilka gwiazdek. Pin nie sprawdza `checkVideoAccess`. Optymistyczna zmiana tylko w bieżącym `sortBy`.
Naprawa: w transakcji odpiąć pozostałe pod filmem (`updateMany where videoId, pinnedAt not null`) lub unikalny indeks częściowy; zapisywać `pinnedById`. — S — wysoka.

**COM-15 · P2 · bezpieczeństwo/integralność** — `comment.policy.ts:36-42`, `update-comment.use-case.ts`
Admin może przez API edytować cudzy komentarz (polityka zwraca `true` dla admina), bez wpisu audytu i bez historii; treść dalej podpisana przez użytkownika. UI tego nie oferuje (`viewerCanEdit` tylko dla autora), więc to martwe i niebezpieczne uprawnienie.
Naprawa: edycja tylko przez autora; moderator ukrywa/usuwa. Audyt edycji + tabela `CommentRevision`. — S — wysoka.

**COM-16 · P2 · UX** — `CommentItem.tsx:355-383`, `useComments.ts:494-506`
Edycja: "Zapisz" zamyka edytor przed odpowiedzią, `editMutation` nie ma `onError` ani optymistycznej aktualizacji — błąd jest cichy, wpisany tekst przepada. Brak `maxLength`, brak etykiety pola, brak Esc/Ctrl+Enter, `editedAt` nigdy nie jest wyświetlane ("(edytowano)"), pole `bg-white` na sztywno.
Naprawa: optymistyczna podmiana tekstu z wycofaniem, edytor zostaje otwarty przy błędzie, etykieta i licznik, znacznik "edytowano" z datą w `title`. — S — wysoka.

**COM-17 · P2 · UX/i18n** — `ReportDialog.tsx:174-177,197`, `useComments.ts:508-517`
Zgłoszenie: dialog zamyka się od razu, mutacja nie ma `onSuccess`/`onError` → brak potwierdzenia i błędu (429, 400 przy notatce >500 znaków, bo pole nie ma `maxLength`). Etykieta PL dla `SPAM` to "Kijowy Komentarz".
Naprawa: toast/aria-live z wynikiem, `maxLength=500` z licznikiem, poprawne etykiety (wspólny słownik). — S — wysoka.

**COM-19 · P2 · prywatność/spójność** — `comment.repository.ts:33-45` (brak `author: { isDeleted: false }` w `replies.where`), `account-deletion-cleanup.use-case.ts:55-60`
Komentarze usuniętego konta są ukryte w liście głównej, licznikach i `/replies`, ale widoczne w podglądzie odpowiedzi jako "Usunięty Użytkownik". Treść komentarzy usuniętego konta pozostaje w bazie i w panelu admina bez terminu wymazania (RODO art. 17 — decyzja właściciela).
Naprawa: jeden filtr widoczności (helper `publicCommentWhere`) użyty wszędzie; przy usuwaniu konta: wymazać treść lub ustalić retencję i zapisać to w polityce prywatności. — S — wysoka.

**COM-20 · P2 · błąd/prywatność** — `app/components/comments/types.ts:135-140`, `CommentItem.tsx:182-186`, `lib/comments-public-author.ts:35`
`isPatronAuthor` traktuje `ADMIN` jak patrona → admini mają plakietkę "PATRON" (na produkcji: "Jurek Pepsiak" ma tylko `ADMIN`). Odznaki `AUTHOR`/`ADMIN` nie są w ogóle pokazywane. Tekst "PATRON" na sztywno po angielsku. Publiczna plakietka ujawnia fakt wpłaty (dane finansowe) bez zgody użytkownika.
Naprawa: osobne odznaki "Twórca" (AUTHOR) i "Wspiera" (opt-in w ustawieniach konta), tłumaczone. — S — wysoka.

**COM-21 · P2 · błąd/prywatność** — `app/components/SafeAvatar.tsx:31`, `EmbeddedComments.tsx:121-124`, `lib/utils/security.ts:62`
Zapasowy awatar to `https://api.dicebear.com/…`, a CSP `img-src` dopuszcza tylko `https://www.dicebear.com` (sprawdzone w nagłówku produkcji) → obrazek blokowany. Seed to nick użytkownika wysyłany do strony trzeciej. Dane produkcyjne wciąż mają `imageUrl` na `img.clerk.com` (Clerk usunięty 2026-10-02).
Naprawa: lokalny `/default-avatar.jpg` albo inicjały generowane lokalnie; migracja `img.clerk.com` → `/api/avatars/[id]` lub null; usunąć dicebear z CSP. — S — wysoka.

**COM-22 · P2 · błąd** — `app/components/ChannelHome.tsx:315-321`, `EmbeddedComments.tsx:126-132`
`EmbeddedComments` nie jest kluczowany po `videoId`. Po przełączeniu filmu zostają `replyTo`, szkic, błąd, sortowanie. Ścieżka: kliknij "Odpowiedz" pod filmem A → przełącz na B → wyślij → `parentId` z filmu A → 400 "Nieprawidłowy komentarz nadrzędny".
Naprawa: `key={selectedVideo.id}` lub reset stanu w efekcie na zmianę `videoId`; szkice per film w `sessionStorage`. — S — wysoka.

**COM-23 · P2 · UX/dostępność** — `EmbeddedComments.tsx:180-183,233-239,318-341`
"Odpowiedz" woła `window.scrollTo({top: 0})` — przewija na górę strony (do odtwarzacza), nie do pola odpowiedzi, i nie przenosi fokusu. Przycisk "Wróć do początku komentarzy" też przewija do góry strony.
Naprawa: odpowiedź inline pod komentarzem (jak YouTube) z fokusem w polu; przycisk powrotu: `commentsTopRef.current.scrollIntoView()` + fokus na nagłówku. — S — wysoka.

**COM-24 · P2 · błąd** — `CommentItem.tsx:227-237,90-103`
"Kopiuj link" bierze `window.location.href` (maskowany przez `UrlMask` do `/`) → link bez `?v=`, otwiera domyślny film. Podświetlenie `#comment-id` działa tylko, gdy komentarz jest na pierwszej stronie listy. Brak potwierdzenia skopiowania; menu niedostępne dla gościa.
Naprawa: budować `/?v=<slug>&c=<id>`; przy wejściu z `c=` pobrać kontekst (`/context`) i wstawić go na górę listy ("Wyróżniony komentarz"). — M — wysoka.

**COM-25 · P2 · mobile** — `CommentItem.tsx:208-214`
Przycisk menu ma `opacity-0` do najechania myszą; na dotyku nie ma hover → menu niewidoczne (klikalne, ale nie do odkrycia).
Naprawa: `@media (hover: hover)` dla ukrywania, na dotyku zawsze widoczne. — S — wysoka.

**COM-27 · P2 · UX moderacji** — `CommentItem.tsx:105-131,283-349`
Moderator widzi komentarze `HIDDEN`/`HELD` identycznie jak widoczne (brak oznaczenia); dla `HELD` brak akcji "Zatwierdź"; ukrycie/przywrócenie/serce nie aktualizują cache (stan nieaktualny do refetchu); ukrywanie niedostępne dla odpowiedzi; serce: brak toastu przy odpowiedzi `!ok`, ikona `Star` w menu, a `Heart` w treści.
Naprawa: mutacje moderacyjne w `useComments` z optymistyczną zmianą statusu; plakietka "Ukryty/Do przeglądu"; te same akcje dla odpowiedzi. — M — wysoka.

**COM-28 · P2 · UX/utrata danych** — `app/admin/comments/page.tsx:83-129,286-299`
Usunięcie (pojedyncze i zbiorcze, do 50) bez potwierdzenia; "Przywróć" dla `DELETED` (COM-02); brak filtra statusu w UI (API go obsługuje), film jako 8 znaków UUID, treść ucięta bez podglądu, brak linku do komentarza i do użytkownika. Akcja zbiorcza = 50 równoległych POST-ów: brak atomowości, częściowe porażki, 50 osobnych wpisów audytu, obciążenie limitu 120/min.
Naprawa: `POST /api/admin/comments/bulk { ids ≤100, action, reason }` w jednej transakcji z jednym `recordAuditEvent` (lista id w metadanych) i wynikiem per id; dialog potwierdzenia z liczbą; filtr statusu, tytuł filmu, podgląd. — M — wysoka.

**COM-29 · P2 · UX moderacji** — `app/admin/comments/reports/page.tsx:37-70`, `resolve-comment-report.use-case.ts`
Kolejka per zgłoszenie, nie per komentarz: rozpatrzenie jednego zostawia pozostałe zgłoszenia tego komentarza jako `PENDING`; "ukryj i rozpatrz" to dwa nieatomowe wywołania; oddalenie nie przywraca auto-wstrzymanego komentarza; `ACTION_TAKEN` nie wykonuje żadnej akcji.
Naprawa: widok grupowany po komentarzu; decyzja `resolveComment(commentId, decision)` w jednej transakcji rozpatruje wszystkie zgłoszenia, zmienia status, zapisuje `ModerationDecision` i powiadamia (COM-18). — M — wysoka.

**COM-30 · P2 · audyt** — `report-comment.use-case.ts:83-88`, `toggle-video-like.use-case.ts:64-68`, `create-video-comment.use-case.ts:106-111`
Audyt zgłoszenia zapisuje wolny tekst `note` (CLAUDE.md §5: metadane tylko id/liczniki/statusy). Każdy lajk/odlajk filmu i każdy komentarz widza trafia do `AuditLog` (tabela audytu jako dziennik aktywności). `recordAuditEvent` po zatwierdzeniu transakcji: jego błąd zwraca błąd użytkownikowi, choć operacja się udała → retry tworzy duplikat komentarza.
Naprawa: audyt tylko działań moderacyjnych/admina; dla widzów `recordAuditEventSafe` albo nic; bez `note`. — S — wysoka.

**COM-31 · P2 · bezpieczeństwo (liczniki)** — `lib/modules/video/application/record-playback-event.use-case.ts:53-66,182-188,222-240`, `app/api/videos/[id]/playback-event/route.ts:270-282`
Wyświetlenie liczy się na podstawie `positionMs`/`maxProgressMs` podawanych przez klienta; brak sprawdzenia czasu po stronie serwera (`now - firstPlayAt ≥ 10 s`). Klient może wysłać `PLAY_STARTED` i od razu `WATCHED_10_SECONDS` z `positionMs=10000`. Deduplikacja przez Redis na `ip+UA` (zmiana UA = nowe wyświetlenie); przy awarii Redis brak deduplikacji. Body bez schematu (`...body`).
Naprawa: wymagać `now - firstPlayAt ≥ próg` i `totalWatchMs ≥ próg` liczonego serwerowo; zod dla body; deduplikacja per użytkownik/`ipHash` (bez UA) na 24 h w Postgresie (unikalny indeks dzienny), Redis tylko jako cache. — M — wysoka.

**COM-33 · P2 · błąd (paginacja)** — `comment.repository.ts:135-144`, `list-video-comments.use-case.ts:96-100`
Kursor Prismy po `id` z `orderBy` po `likesCount`/`pinnedAt`/`createdAt`: dla "Najlepsze" zmiana lajków między stronami daje duplikaty/pominięcia; usunięcie komentarza-kursora → Prisma zwraca pustą stronę (koniec listy przedwcześnie); `nextCursor` gdy `length === limit` → zbędne puste żądanie; `count` liczony przy każdej stronie. Brak `id` jako rozstrzygacza remisów w `orderBy`.
Naprawa: kursor nieprzezroczysty (base64 krotki `(pinnedAt, likesCount, createdAt, id)`), warunek wierszowy `(…) < (…)`, `take: limit + 1`, `id` jako ostatni klucz sortowania, `count` tylko dla pierwszej strony; indeks `(videoId, parentId, status, createdAt DESC, id)`. — M — wysoka.

**COM-34 · P2 · wydajność** — `useComments.ts:346-350,420-422,489-491,503-505`
Po każdej reakcji/przypięciu/usunięciu/edycji `invalidateQueries(['comments', videoId])` → zapytanie nieskończone pobiera ponownie **wszystkie** załadowane strony (przy 10 stronach 10 żądań). Odpowiedzi API już zawierają stan autorytatywny (`likesCount`, `viewerReaction`, `comment`).
Naprawa: `setQueryData` z odpowiedzi serwera; inwalidacja tylko przy niepowodzeniu; dla sortowania "Najlepsze" nie przesuwać elementów w trakcie sesji. — S — wysoka.

**COM-37 · P2 · śmieci (część z ryzykiem)** — patrz lista:
- `prisma/schema.prisma:923-947` modele `CommentLike`, `CommentDislike` + relacje `Comment.likes/dislikes` (`:874-875`) i w `User`: zero użyć w kodzie (0 wierszy na produkcji według zlecenia). Usunąć migracją addytywną-odwrotną (DROP TABLE) po potwierdzeniu właściciela.
- `app/api/comments/route.ts:15-35` POST/PATCH/DELETE (shim) + `middleware.ts:150-156` wyjątek: nieużywane przez frontend; POST czyta body bez limitu przez `request.clone().json()`.
- `app/api/comments/image-upload/route.ts`: nieużywany (komentarz w use case: "not exposed in UI"); brak rate limitu, MIME z nagłówka klienta, domyślnie `private` zwraca URL `/api/comments/image-proxy/…`, który nie istnieje; Vercel Blob to stary stos. **Ryzyko kosztowe** (dowolny zalogowany wgrywa po 5 MB). Usunąć razem z `imageUrl` w schemacie POST i `isAllowedCommentImageUrl`.
- `app/api/comments/[commentId]/route.ts:120-127`: hack dla testów w kodzie produkcyjnym (każdy `TypeError` z "findUnique" → 403).
- `comment.repository.ts:190-195` `toggleHeart` przez surowy SQL i `as any`, choć pole jest w schemacie; `:220-226` komentarz "R10 Cleanup Note".
- Kolumna `Comment.score` tylko zapisywana (`repository:108,118,119`), nigdy czytana (duplikat `likesCount`); `sortBy 'oldest'` tylko w repozytorium; `Comment.creatorId` ("Optional for now") zbędne w jednym kanale.
- Potrójny DTO: `comment.dto.ts`, `comment-frontend.dto.ts`, `app/components/comments/types.ts` (różnią się: `score`, `isHearted?`).
- `EmbeddedComments` props `videoTier` (nieużywany), `totalPaid`; `CommentPolicy.canUpdateComment` gałąź admina (COM-15); `isGeneratedClerkUsername` (relikt Clerka, 4 użycia); `dislikesCount` w publicznym DTO filmu i odpowiedzi akcji (niewyświetlany, sprzeczny z "brak publicznego licznika dislike").
- Endpoint `/context` nieużywany (COM-10), `/replies` nieużywany (COM-01 — do użycia, nie do usunięcia).
Nakład M — pewność wysoka.

**COM-38 · P2 · i18n** — `EmbeddedComments.tsx` (≈25 miejsc), `CommentItem.tsx` (≈20), `CommentComposer.tsx`, `ReportDialog.tsx`, `useComments.ts:41-69`, `comments-public-author.ts:26,42` ("Usunięty Użytkownik", "Użytkownik" z serwera), `Hero.tsx:145-148`, `LanguageContext.tsx:135` (`deleteComment: 'Wyciąć?'`)
Teksty jako `language === "pl" ? … : …` zamiast słownika; serwer zwraca komunikaty tylko po polsku, a klient je wyświetla także anglojęzycznym (np. "Nieprawidłowy komentarz nadrzędny."). 
Naprawa: wszystkie teksty komentarzy w jednym słowniku; API zwraca kody (`code`), klient tłumaczy; nazwy zastępcze tłumaczone po stronie klienta (serwer zwraca `author: null` / flagę `isDeletedAuthor`). — M — wysoka.

**COM-39 · P2 · dostępność** — `CommentItem.tsx:164-170,250-251,423`, `CommentComposer.tsx:221`, `EmbeddedComments.tsx:155-167,487-534`
`aria-label` na `<span>` bez roli (przypięcie) nie jest odczytywany; brak komunikatu `aria-live` po dodaniu/usunięciu/zgłoszeniu; pole jest `disabled` w trakcie wysyłania (traci fokus); po usunięciu fokus znika; lista to `div`y (brak `<article>`/listy z nagłówkami autora); `window.confirm` do usuwania; automatyczne doładowanie IntersectionObserverem i jednocześnie przycisk "Pokaż więcej" (klawiatura/czytnik: treść dochodzi bez sygnału).
Naprawa: lista `<ol>`/`<article aria-labelledby>`, wspólny `aria-live="polite"` region komunikatów, `readOnly`+`aria-busy` zamiast `disabled`, fokus na następny element po usunięciu, dialog potwierdzenia z Radix, tylko przycisk "Pokaż więcej" (bez auto-doładowania) albo wzorzec `role="feed"` z `aria-busy`. — M — wysoka.

**COM-41 · P2 · antyspam** — `app/api/videos/[id]/comments/route.ts:105-115`, brak modeli
Jest tylko limit 5/min/użytkownik. Brak: wykrywania duplikatów (wymagane przez `COMMENTS-MODERATION-SPEC.md` "Rate limiting and duplicate detection"), limitu linków, moderacji wstępnej pierwszych komentarzy nowych kont, blokady/wyciszenia użytkownika (brak pola w `User`), wyłączenia komentarzy lub "wszystko do przeglądu" per film, limitu dziennego, normalizacji tekstu (znaki bidi U+202E, zero-width).
Naprawa: patrz sekcja 5. — M/L — wysoka.

**COM-42 · P2 · brak testu** — `tests/unit/**`
Część testów to grep po źródle (`comments-access-harden.test.ts`, `comments-ui-contract.test.ts`, `comments-privacy.test.ts`) — nie łapią zachowania. Brakuje testów: restore `DELETED` (COM-02), widoczności >3 odpowiedzi i 401 dla gościa na `/replies` (COM-01), wyścigów P2002 (COM-08), mapowania błędów tras admina (COM-07), wycieku `HELD` przez `/context` (COM-10), spamu powiadomień (COM-04), progu 3 zgłoszeń (COM-03), `limit` w `/replies` (COM-05), stanu przy przełączeniu filmu (COM-22), E2E (Playwright: dodaj → odpowiedz → polub → usuń). Test `core-flows.test.ts` "denies non-patron on patron-only video (returns FORBIDDEN)" opisuje stary model (nazwa myląca). — M — wysoka.

**COM-48 · P2 · powiadomienia** — `toggle-comment-like.use-case.ts:73-88`, `send-notification.use-case.ts:84-90`, `notification-templates.use-case.ts:11`, `Navbar.tsx:23`
Jedyne powiadomienie komentarzowe to "polubiono Twój komentarz". Brak powiadomień o **odpowiedzi** (najważniejsze) i **sercu twórcy**. Dzwonek jest ukryty (`TEMP_HIDE_NOTIFICATIONS_BELL`), więc wiersze są zapisywane, ale nikt ich nie widzi (martwe zapisy). Szablon nadpisywany per `kind` (`COMMENT`) — dodanie powiadomienia o odpowiedzi z tym samym `kind` sprawi, że nadpisanie szablonu podmieni tekst obu.
Naprawa: rodzaje `COMMENT_REPLY`, `COMMENT_HEART`, `COMMENT_LIKE` (agregowane), deduplikacja, link `/?v=slug&c=id`; dopóki dzwonek ukryty — wstrzymać zapisy albo pokazać listę w `AccountModal`. — M — wysoka.

**COM-14 · P2 · błąd** — `comment.repository.ts:190-195`, `toggle-admin-comment-heart.use-case.ts`, `CommentItem.tsx:305-349`
Serce: odczyt + zapis surowym SQL (nieatomowe, przełącznik), brak powiadomienia, menu pokazuje serce dla `viewerCanModerate` (także twórca niebędący adminem), a trasa jest tylko dla admina; odpowiedź `!ok` ignorowana bez komunikatu.
Naprawa: `PUT …/heart {hearted: boolean}` przez Prisma `update`; uprawnienie "moderator filmu" spójne z pin. — S — wysoka.

**COM-32 · P2 · błąd (licznik)** — `comment.repository.ts:148-151`, `useComments.ts:225-230,460-466`, `EmbeddedComments.tsx:347`
Nagłówek "N komentarzy" liczy tylko główne komentarze, ale optymistyczna aktualizacja dodaje/odejmuje 1 także dla odpowiedzi → licznik skacze po refetchu.
Naprawa: zdecydować (YouTube liczy wszystkie widoczne) i liczyć spójnie na serwerze i w optymistycznej aktualizacji. — S — wysoka.

**COM-47 · P2 · bezpieczeństwo (obrona w głąb)** — `middleware.ts:145-156`
Sprawdzanie `Origin` (CSRF) działa tylko dla `/api/admin/*` i `/api/user/*`. Mutacje `/api/comments/*` i `/api/videos/*` polegają wyłącznie na `SameSite=Lax`. Subdomeny tej samej witryny (`support.pawelperfect.com` z oprogramowaniem firm trzecich, `video.pawelperfect.com`) są "same-site", więc SameSite ich nie blokuje.
Naprawa: rozszerzyć `checkAdminCsrf` na wszystkie mutacje `/api/*` poza webhookami/cronem/Better Auth. — S — średnia.

### P3

**COM-26 · P3 · UX/bezpieczeństwo treści** — `CommentItem.tsx:380`
`<p>` bez `whitespace-pre-wrap` (nowe linie znikają) i bez `break-words` (długie ciągi rozpychają layout); brak normalizacji (NFC, usuwanie U+202A-202E, U+200B-200F, ograniczenie pustych linii). Render przez React — XSS brak. — S — wysoka.

**COM-35 · P3 · jakość** — `useComments.ts:184-191`, `AppPreloadProvider.tsx:114-129`
`queryFn` ignoruje `signal` (brak przerwania przy szybkim przełączaniu filmów); preload ma własną kopię `queryFn` z inną obsługą błędów. Naprawa: wspólne `commentsQueryOptions(videoId, sort)` (`queryOptions` z v5) używane przez hook i preload. — S — wysoka.

**COM-36 · P3 · jakość** — `useComments.ts:183`
Klucz `["comments", videoId, sortBy]` bez tożsamości widza, choć odpowiedź zawiera pola zależne od widza; poprawność zależy od `queryClient.clear()` w `AuthLifecycleProvider.tsx:36` (przejście A→B bez wylogowania nie jest obsłużone). Naprawa: dodać `viewerId` do klucza. — S — średnia.

**COM-40 · P3 · UX (odstępy, pomiar z kodu, Tailwind 4.3)** — `EmbeddedComments.tsx:315,344,438,489,509`, `CommentItem.tsx:159`, `CommentComposer.tsx:124`
Zmierzone wartości (w Tailwind v4 `space-y-*` daje `margin-bottom` przez `:where()` o zerowej specyficzności, więc jawne `mb-*` wygrywa):
- nagłówek "N komentarzy" → kompozytor: `mb-[14px]` / `sm:mb-[20px]`;
- kompozytor → pierwszy komentarz: `mb-10` = **40 px** (nadpisuje `space-y-[24px]`/`sm:space-y-[30px]` korzenia);
- między wątkami głównymi: `pb-[18px]` komentarza + `space-y-[22px]` listy = **40 px** (górny padding i linia znikają przez `first:pt-0 first:border-t-0`, bo każdy `CommentItem` jest pierwszym dzieckiem swojego `CommentMotionItem`), plus ~8-10 px pustego obszaru w wierszu akcji (`h-8`, tekst 12 px) → wizualnie ok. **50 px**;
- komentarz → blok odpowiedzi: 18 + 22 = **40 px** (`mt-4` zapada się z marginesem 22 px);
- między odpowiedziami: `pb-18` + `space-y-22` + `pt-18` = **58 px** z linią `border-t` 18 px nad awatarem;
- wewnątrz komentarza: `gap-[13px]` awatar–treść, `space-y-[2px]`, `pt-1` przed akcjami; dół sekcji `mb-[30px]`.
Źródło problemu: dwa niezależne mechanizmy odstępu (padding elementu i `space-y` rodzica) sumują się. Zalecenie: jeden właściciel odstępu (`flex flex-col gap-*` na liście, bez `py` w elemencie), np. 16 px między wątkami, 12 px między odpowiedziami, 24 px pod kompozytorem. Pełny audyt stylów robi osobny agent. — S — wysoka.

**COM-43 · P3 · styl** — `EmbeddedComments.tsx:442-466`, `CommentComposer.tsx:274`, `CommentItem.tsx:360`
Literalne `red-50/100/600/900`, `bg-white` zamiast tokenów `--chan-*` (tryb ciemny). — S — wysoka.

**COM-44 · P3 · prywatność** — `lib/comments-public-author.ts:47`
Zwracane jest surowe `author.username` zamiast przefiltrowanego `username` (wycieka wygenerowany `user_…` / `deleted_…`); `author.id` = `User.id` publicznie. Naprawa: zwracać przefiltrowaną wartość lub nic (Better Auth nie ma osobnego username). — S — wysoka.

**COM-45 · P3 · walidacja** — `app/api/videos/[id]/comments/route.ts:49`, `app/api/admin/videos/[id]/comments/route.ts:20`, `app/api/admin/comments/route.ts:19`, `app/api/admin/comments/reports/route.ts:15-16`
`sortBy`/`status` rzutowane bez walidacji; nieprawidłowy `status` → błąd Prismy → 500. Naprawa: zod enum. — S — wysoka.

**COM-46 · P3 · UX** — `CommentComposer.tsx:178-194`, `EmbeddedComments.tsx:428`
Gdy lista się nie załaduje (`isError`), `viewer` jest pusty → zalogowany widzi "Zaloguj się, aby dodać komentarz". Naprawa: rozróżnić "gość" od "brak danych". — S — wysoka.

**COM-49 · P3 · wydajność** — `comment.repository.ts:33-45,138`
Podgląd odpowiedzi jako zagnieżdżone `include` z `take: 3` i `patronGrants` autora dla każdego komentarza i odpowiedzi (subzapytania per strona); filtr `author: { isDeleted: false }` wymaga złączenia. Przy obecnej skali nieistotne; przy przepisaniu warto policzyć odpowiedzi i odznaki w jednym zapytaniu. — S — niska (zależy od strategii ładowania relacji w Prismie).

**COM-50 · P3 · UX** — `CommentItem.tsx:469-477`, `EmbeddedComments.tsx:521`
Nie można odpowiedzieć na odpowiedź (przycisk ukryty), choć serwer to obsługuje (dopina do rodzica); YouTube pozwala z `@wzmianką`. Naprawa: przycisk na odpowiedziach z prefiksem `@nick`. — S — wysoka.

**COM-51 · P3 · bezpieczeństwo** — `lib/modules/access/application/check-video-access.use-case.ts:116`, `create-video-comment.use-case.ts:49-51`
Dla konta usuniętego `reason: DELETED` jest mapowane na "Film nie istnieje" (myląco). W praktyce `getActorFromAuth` odrzuca usunięte konta wcześniej. — S — średnia.

(Liczenie: P1 = COM-01, 02, 03, 06, 08, 18 → 6; P3 = COM-26, 35, 36, 40, 43, 44, 45, 46, 49, 50, 51 → 11; P2 = pozostałe 34. Łącznie 51 ID. Kolejność w sekcji nie jest numeryczna, bo znaleziska pogrupowano według wagi.)

---

## 4. Rozbieżności dokumentacja vs kod

| Dokument | Twierdzenie | Kod |
|---|---|---|
| `COMMENTS-MODERATION-SPEC.md` "Product rules" | "PATRON: patron/admin can comment/react/write" | Każdy zalogowany (`check-video-access.use-case.ts:122`). Spec nieaktualny. |
| Spec "Launch-critical" | "Rate limiting and duplicate detection" | Jest tylko rate limit; deduplikacji brak (COM-41). |
| Spec | "Comment editing deferred" | Edycja istnieje (PATCH + UI), bez historii i bez znacznika. |
| Spec | "Hide/delete/restore/dismiss require audit" | Spełnione; ale edycja (także adminem) bez audytu (COM-15). |
| Spec | "No shadow bans" | Auto-hold po 3 zgłoszeniach ukrywa komentarz bez informacji dla autora — de facto ciche ukrycie (COM-03/18). |
| Spec | "Reactions/hearts Phase 2 unless certified" | Są w produkcji, bez certyfikacji. |
| CLAUDE.md §4.9 | "one reaction per user per comment", "Dislike has no public counter" | Zgodne dla komentarzy; ale `Video.dislikesCount` jest w publicznym DTO filmu i odpowiedzi server action (niewyświetlany). |
| CLAUDE.md §4.9 / schemat | brak wzmianki o `CommentLike`/`CommentDislike` | Martwe tabele w schemacie (COM-37). |
| `comment.errors.ts:24-31` | "every admin comments route derives its status from this" | Tylko 2 trasy list; akcje zwracają 500 (COM-07). |
| `list-comment-replies.use-case.ts:32` | "Comments are publicly readable" (również odpowiedzi) | Middleware blokuje gościa (401) (COM-01). |
| `create-video-comment.use-case.ts:88-89` | "imageUrl … not exposed in the public CommentComposer UI" | Prawda, ale endpoint uploadu i akceptacja `imageUrl` żyją (COM-37). |
| CLAUDE.md §4.12 "Avatar" | nowe konta dostają `/default-avatar.jpg` | Komentarze bez `imageUrl` używają dicebear (zablokowanego przez CSP) (COM-21). |
| CLAUDE.md §4.13 | "nothing in-session may … re-render the page on the server" | Lajk filmu: `revalidatePath('/', 'layout')` (COM-06). |
| CLAUDE.md §5 (audyt) | metadane audytu bez treści wiadomości | `COMMENT_REPORT` zapisuje `note` (COM-30). |
| CLAUDE.md "TEMPORARY CHANGES" | dzwonek ukryty | Powiadomienia komentarzy dalej zapisywane (martwe zapisy) (COM-48). |
| `docs/specs` / CLAUDE.md | brak informacji o progu auto-hold 3 | Próg zaszyty w kodzie (`HOLD_THRESHOLD = 3`). |

---

## 5. Lepsze rozwiązania (stan na październik 2026, ze źródłami)

1. **Reakcje jako stan docelowy, nie przełącznik.** `PUT /api/comments/:id/reaction {reaction: "LIKE"|"DISLIKE"|null}` i analogicznie dla filmu; serwer wykonuje `INSERT … ON CONFLICT (userId, commentId) DO UPDATE` / `DELETE` i przelicza licznik w tej samej transakcji z warunkiem (`likesCount = likesCount + delta` tylko gdy stan faktycznie się zmienił). Idempotentne, odporne na retry i wyścigi (P2002). Źródła: Postgres `INSERT … ON CONFLICT` — https://www.postgresql.org/docs/current/sql-insert.html ; wyścigi upsert w Prismie — https://github.com/prisma/prisma/discussions/14993 .
2. **Serializacja mutacji per komentarz w TanStack Query v5**: `useMutation({ scope: { id: \`reaction:${commentId}\` } })` — mutacje z tym samym `scope.id` wykonują się szeregowo. Aktualizacja cache z odpowiedzi serwera zamiast `invalidateQueries` całej listy. Wspólne `queryOptions` dla hooka i preloadu, `signal` w `queryFn`. Źródła: https://tanstack.com/query/latest/docs/framework/react/guides/mutations (sekcja Mutation Scopes), https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates , https://tkdodo.eu/blog/mastering-mutations-in-react-query .
3. **Lajk filmu w React 19**: jeśli zostaje server action, to `useOptimistic` w `startTransition` (reduktor składa szybkie kliknięcia) i **bez** `revalidatePath`; prościej: trasa API + TanStack (spójnie z komentarzami). Źródła: https://react.dev/reference/react/useOptimistic , https://dev.to/stacknotice/react-useoptimistic-optimistic-ui-patterns-that-actually-work-2026-5460 .
4. **Paginacja kursorem keyset** z unikalnym rozstrzygaczem `id`, porównaniem wierszowym `(createdAt, id) < ($1, $2)` i indeksem w tej samej kolejności; kursor nieprzezroczysty; `take: limit + 1`. Dla "Najlepsze" zamrozić ranking na czas sesji (snapshot `rankedAt` w kursorze) albo sortować po stabilnym `score` przeliczanym okresowo. Źródła: https://dev.to/hidetzu/the-same-row-twice-four-things-keyset-pagination-needs-2ecp , https://www.andrewfisher.me/development/keyset-pagination/ .
5. **Wątki**: model dwupoziomowy (jak teraz) + `GET /replies` stronicowane kursorem, przycisk "Pokaż N odpowiedzi", odpowiedź na odpowiedź z `@wzmianką`, `repliesCount` liczony tylko z widocznych (przeliczany w transakcji zmiany statusu).
6. **Moderacja**: jedna maszyna stanów (`VISIBLE ⇄ HELD ⇄ HIDDEN → DELETED`, `DELETED` nieodwracalne dla widza), treść nie nadpisywana przy usunięciu (maskowanie w DTO + wymazanie po retencji), tabela `ModerationDecision` (kto, co, podstawa, automat, uzasadnienie), kolejka zgłoszeń grupowana per komentarz, jedna trasa akcji zbiorczych w transakcji. Ustawienia per film: komentarze włączone / wyłączone / "wszystkie do przeglądu".
7. **Antyspam warstwowo** (wzorzec Discourse "trust levels"): pierwszy komentarz nowego konta (np. <24 h lub 0 zatwierdzonych) idzie do przeglądu; nowe konta bez linków lub z limitem 1 linku; deduplikacja (hash znormalizowanej treści per użytkownik w 10 min); limit dzienny; blokada/wyciszenie użytkownika (`User.commentBannedUntil`); zgłoszenia ważone wiarygodnością zgłaszającego; Turnstile już jest w projekcie — można go użyć przy pierwszym komentarzu. Źródło: https://meta.discourse.org/t/tips-for-preventing-spam/264020 .
8. **DSA dla małej platformy**: art. 16 (zgłoszenia, potwierdzenie, informacja o decyzji) i art. 17 (uzasadnienie dla autora z informacją o automacie i środkach odwoławczych) obowiązują wszystkich dostawców hostingu; mikro i małe przedsiębiorstwa są zwolnione z obowiązków sekcji "platformy internetowe" (m.in. wewnętrzny system skarg z art. 20, raporty przejrzystości), ale nie z art. 16-17. Do decyzji właściciela/prawnika. Źródła: tekst rozporządzenia 2022/2065 — https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ%3AL%3A2022%3A277%3AFULL ; art. 16 — https://www.eu-digital-services-act.com/Digital_Services_Act_Article_16.html ; art. 17 — https://www.cms-digitallaws.com/en/dsa/article-17/ ; zakres dla mniejszych dostawców — https://www.ropesgray.com/en/insights/viewpoints/102j0f0/reminder-eu-digital-services-act-applies-beyond-very-large-online-service-prov .
9. **Dostępność listy**: semantyczna lista `<article>` z nagłówkiem (autor + czas), region `aria-live="polite"` dla wyników akcji, fokus po akcjach, przycisk "Pokaż więcej" zamiast automatycznego doładowania (albo wzorzec `role="feed"` z `aria-busy`, który ma znane ograniczenia dla użytkowników klawiatury). Źródła: https://www.w3.org/WAI/ARIA/apg/patterns/feed/ , https://www.deque.com/blog/infinite-scrolling-rolefeed-accessibility-issues/ .
10. **Edycja z historią i przypinanie przez twórcę**: `CommentRevision(commentId, text, editedAt)`, znacznik "(edytowano)"; jeden przypięty komentarz na film (indeks częściowy unikalny `WHERE pinnedAt IS NOT NULL`); serce twórcy jako idempotentny `PUT`, z powiadomieniem.
11. **Wyświetlenia**: liczyć po stronie serwera z czasu zegarowego sesji (`now - firstPlayAt`, `totalWatchMs`), deduplikacja dzienna w Postgresie (unikalny klucz `(videoId, viewerKey, day)`), Redis tylko jako przyspieszenie.
12. **Wirtualizacja**: przy obecnych liczbach (2-11 komentarzy pod filmem) zbędna; przy >200 elementach rozważyć `@tanstack/react-virtual` z zachowaniem semantyki listy. Wcześniej wystarczy `content-visibility: auto` na elementach.

---

## 6. Kolejność małych PR-ów

1. **PR-1 (S, P1)**: odpowiedzi publicznie czytelne + widoczne: `isPublicRoute` dla `/api/comments/(.*)/replies`, clamp `limit` (COM-05), przycisk "Pokaż N odpowiedzi" z `/replies` (COM-01). Testy: gość 200, 4. odpowiedź widoczna.
2. **PR-2 (S, P1)**: lajk filmu bez `revalidatePath` — trasa API stanu docelowego + Hero (COM-06, COM-09 część filmowa), bez `getOrCreateCurrentUser`.
3. **PR-3 (M, P1)**: moderacja bez utraty danych — brak nadpisywania treści, maszyna stanów, restore tylko z HIDDEN/HELD, potwierdzenia w adminie, mapowanie błędów tras admina (COM-02, COM-07, COM-28 część).
4. **PR-4 (S, P1)**: reakcje idempotentne + upsert + brak `error.message` w odpowiedziach + rate limit reakcji + deduplikacja powiadomień (COM-08, COM-04, COM-09).
5. **PR-5 (M, P1)**: zgłoszenia: próg ważony, bez auto-hold dla twórcy/admina, `reportsCount` z PENDING, kolejka per komentarz, rozpatrzenie atomowe (COM-03, COM-29).
6. **PR-6 (S)**: drobne błędy klienta: `key={videoId}` (COM-22), odpowiedź inline z fokusem (COM-23), menu widoczne na dotyku (COM-25), link do komentarza z `?v=` (COM-24), edycja z obsługą błędu (COM-16), feedback zgłoszenia i etykiety (COM-17).
7. **PR-7 (S)**: spójność widoczności: wspólny filtr publiczny (COM-19), maskowanie wszystkiego poza VISIBLE (COM-10), walidacja rodzica (COM-11), licznik nagłówka (COM-32), `repliesCount` (COM-12).
8. **PR-8 (S)**: odznaki i awatary: ADMIN≠PATRON, odznaka twórcy, opt-in "Wspiera", lokalny awatar zastępczy, migracja `img.clerk.com` (COM-20, COM-21, COM-44).
9. **PR-9 (M)**: sprzątanie: usunięcie `CommentLike`/`CommentDislike`, shimu `/api/comments` POST/PATCH/DELETE, `image-upload`, hacka testowego, `score`, `oldest`, potrójnego DTO, `toggleHeart` przez SQL, nieużywanych propsów (COM-37). Migracja DROP po zgodzie właściciela.
10. **PR-10 (M)**: paginacja keyset z rozstrzygaczem + aktualizacja cache z odpowiedzi zamiast inwalidacji (COM-33, COM-34, COM-35, COM-36).
11. **PR-11 (M)**: i18n i dostępność listy (COM-38, COM-39, COM-46), odstępy (COM-40 — w porozumieniu z audytem stylów).
12. **PR-12 (M)**: powiadomienia: odpowiedź, serce, agregacja lajków, osobne `kind` (COM-48) — po decyzji o dzwonku.
13. **PR-13 (L)**: DSA: `ModerationDecision`, uzasadnienia dla autora, potwierdzenia dla zgłaszającego, formularz dla gościa (COM-18) — po konsultacji prawnej.
14. **PR-14 (M)**: antyspam warstwowy i ustawienia komentarzy per film (COM-41), audyt tylko dla moderacji (COM-30), CSRF Origin dla wszystkich mutacji (COM-47).
15. **PR-15 (M)**: wyświetlenia liczone serwerowo (COM-31).
16. Równolegle do każdego PR: testy zachowania zamiast grepów po źródle (COM-42), na końcu E2E Playwright dla pełnego przepływu komentarzy.
