# Product Standard

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Cel

Ten dokument jest aktywnym standardem jakości produktu dla faz X1-X7. Ma służyć jako filtr dla ticketów, PR-ów, review, certyfikacji i decyzji scope przed publicznym launchem Polutek.pl.

Standard nie jest dowodem aktualnego runtime. Target architecture != current implementation. Każdy runtime PR musi udowodnić zgodność kodem, testami i walidacją z konkretnego ticketu.

## Product DNA

Polutek.pl is not a platform. Polutek.pl is a place.

Polutek.pl jest jednym oficjalnym miejscem VOD twórcy:

- jeden oficjalny kanał,
- jeden katalog wideo,
- jeden system patronów i dostępu,
- jedna społeczność,
- jedna lista mailingowa,
- jeden kokpit admina.

Produkt nie jest marketplace, multi-creator SaaS, mini-Patreonem, white-label CMS, tenant platformą ani generyczną siecią społecznościową.

Patronat jest nagrodą za kwalifikujące jednorazowe wsparcie/donację. Patronat nie jest subskrypcją cykliczną. Dostęp patrona jest permanentny/lifetime/no-expiry domyślnie, chyba że zostanie zawieszony albo cofnięty polityką.

Launch jest publiczny, nie private beta. Jakość launchu ma być excellent, ale osiągana fazami i ticketami, nie jednym wielkim PR-em.

## Launch quality bar

Launch może zostać rekomendowany dopiero wtedy, gdy launch-critical domeny mają spójny kod, testy, docs, support diagnostics i manual QA:

- płatność kwalifikująca tworzy właściwy `PatronGrant` przez bezpieczny domain flow,
- płatność niekwalifikująca nie tworzy dostępu,
- duplicate Stripe webhook nie tworzy duplicate grant,
- full refund/dispute lifecycle nie pozostawia nieuprawnionego dostępu,
- backendowe access truth opiera się na aktywnym `PatronGrant`,
- denied `PlaybackPlan` nie zawiera URL/tokenu i nie uruchamia provider call,
- locked state jest osobnym renderem, nie playerem pod overlayem,
- Cloudflare Stream baseline jest bezpieczny i supportowalny,
- owner może zdiagnozować paid-but-locked bez DB/Stripe/Clerk console,
- komentarze pod opublikowanymi wideo są czytelne zgodnie z polityką, a pisanie jest gated,
- newsletter/subscription/unsubscribe nie narusza `PatronGrant`,
- krytyczne zdarzenia billing/access/video/email/comments są widoczne bez logowania sekretów,
- legal/privacy/cookie/email consent, accessibility, mobile, performance, security, backups, runbook i manual QA przechodzą X7 gate.

## Domain standards

### Payments / Patronat

- `Payment != PatronGrant`.
- `Payment` jest faktem finansowym / money-support event.
- `PatronGrant` jest prawem dostępu / statusem patrona.
- Stripe Checkout dla patronatu jest jednorazowym wsparciem/donacją, nie recurring subscription.
- Próg kwalifikującego wsparcia jest admin-konfigurowalny per waluta.
- Domyślne launch thresholds: 10 PLN, 10 USD, 10 EUR, 10 CHF.
- Stripe webhook musi weryfikować signature na raw body.
- Stripe webhook processing musi być idempotentne przez event ledger.
- Client-side amount nie jest zaufanym źródłem prawdy.
- Below-threshold payment nie może tworzyć patron access.
- Full refund cofa powiązany grant.
- Dispute zawiesza powiązany grant.
- Dispute won reactivates.
- Dispute lost/chargeback revokes.
- Partial refund musi mieć jawną politykę właściciela albo zostać skierowany do manual review.
- Manual grant/suspend/reactivate/revoke wymaga reason + audit.

### Access / PatronGrant

- Active `PatronGrant` jest docelowym backendowym źródłem prawdy dla patron access.
- Access decisions są deny-by-default i walidowane backendowo dla każdego wrażliwego requestu.
- `User.isPatron` może istnieć migracyjnie tylko jako legacy/mismatch diagnostic, nie jako backend access truth.
- Clerk metadata może być UI/cache/read model, nie backend access truth.
- `Subscription`, `Payment` alone, Stripe state alone i frontend state nie są access truth.
- Admin override musi być explicit, audited i nie może maskować źródła finansowego.
- Access module powinien zwracać jawne allow/deny reason używane przez PlaybackPlan i Admin Diagnostics.

### Video provider

- Cloudflare Stream jest pierwszym providerem wideo.
- Mux ma pozostać projektowo wspierany per `VideoAsset`, przez cienką abstrakcję, bez ciężkiego enterprise multi-provider frameworka.
- Provider jest właściwością `VideoAsset`; produktowe metadata należą do `Video`.
- Primary READY asset napędza playback.
- Provider webhooks aktualizują media/processing state.
- Direct upload / resumable upload powinien być wspierany tam, gdzie provider to umożliwia.
- R2/S3/Vercel Blob mogą istnieć jako legacy/migracja, ale nie są aktywnym secure patron playback fallback bez nowej decyzji architektonicznej.
- Provider call po playback source/token może nastąpić dopiero po backendowym Access allow.

### Playback / Player / Locked state

- Allowed `PlaybackPlan` -> mount player.
- Denied `PlaybackPlan` -> locked placeholder.
- Locked state jest osobnym render tree, nie realnym playerem ukrytym pod overlayem.
- Denied plan nie może zawierać playable URL, playback URL ani playback tokenu.
- Denied/locked state nie może:
  - montować realnego playera,
  - fetchować streamu,
  - żądać playback tokenu,
  - wywoływać Cloudflare/Mux po playback source,
  - liczyć playback/view event,
  - ujawniać `playbackUrl` ani `playbackToken`.
- Docelowe stany `PlaybackPlan`: `READY`, `LOGIN_REQUIRED`, `PATRON_REQUIRED`, `VIDEO_NOT_READY`, `NO_PRIMARY_ASSET`, `PROCESSING`, `UNAVAILABLE`, `ERROR`.
- Tracking startuje tylko przy realnym playbacku.
- Admin preview jest wyłączony z public analytics.

### Admin cockpit / Support diagnostics

- Admin cockpit jest support operations center, nie vanity dashboard.
- Access Diagnostics ma pierwszeństwo przed generic dashboard.
- Owner musi zdiagnozować paid-but-locked bez bezpośredniego DB/Stripe/Clerk console.
- Launch-critical diagnostics powinny pokazywać: identity, `PatronGrant` history, payments, refunds, disputes, subscription, Clerk/User mismatch, final access decision, video asset/provider state, webhook failures i system health.
- Manualne akcje wpływające na access wymagają reason + audit.
- Działania niebezpieczne wymagają confirmation.
- Admin UI nie może naprawiać access przez ustawienie `User.isPatron`.

### Comments / Community / Moderation

- Widoczność komentarzy != uprawnienie do komentowania.
- Komentarze pod opublikowanymi wideo, w tym patron-only video, są widoczne publicznie zgodnie z moderation state.
- PUBLIC/LOGGED_IN: komentowanie wymaga loginu.
- PATRON: komentowanie/reagowanie/pisanie wymaga patrona albo admina.
- Goście mogą czytać opublikowane komentarze, ale nie pisać, reagować ani reportować.
- Moderation states: `VISIBLE`, `HELD_FOR_REVIEW`, `HIDDEN`, `DELETED`.
- No shadow bans.
- Report abuse, rate limiting, duplicate detection i admin moderation queue są launch-critical, chyba że owner jawnie ograniczy scope.
- Hide/delete/restore/dismiss wymagają audytu.
- Single-level replies są wystarczające na launch.
- Comment editing i rozbudowane community mogą poczekać.

### Email / Subscription

- `Subscription = mailing/follow/newsletter consent`.
- `Subscription/email != Patron`.
- Patron nie oznacza newsletter subscriber.
- Newsletter subscription nie daje patron access.
- Unsubscribe z emaila nigdy nie cofa `PatronGrant`.
- Patron nie oznacza automatycznej zgody marketingowej.
- Transactional emails są oddzielone od marketingu.
- Broadcast wymaga preview/test-send i audytu.
- Bounce/complaint suppression jest launch-critical.
- Consent state musi być widoczny dla admina bez sugerowania access truth.

### Observability / Audit / Support

- Audit trail jest osobny od operational/debug logs.
- Logi i analytics nie mogą zawierać sekretów, playback tokenów ani prywatnych URL-i.
- Launch-critical health musi obejmować failed/stuck webhooks, payment/patron mismatches, access decisions, video/provider failures, playback errors, email delivery health i comments/community health.
- Critical billing/access/video/email failures wymagają alertów z kanałami i progami zaakceptowanymi przez właściciela przed X7.
- Analytics muszą być privacy-safe i wyłączać admin preview z public views.

### Launch readiness

- Launch jest publiczny, nie private beta.
- Access leak jest launch blockerem.
- Payment fulfillment gap jest launch blockerem.
- Privacy/legal/cookie/email consent gap jest launch blockerem.
- Paid-but-locked bez admin diagnostics jest launch blockerem.
- X7 musi objąć manual QA, owner runbook, security review, backups/recovery, accessibility, mobile, performance i final certification.

## PR quality gates

Każdy PR w X1-X7 musi przejść przez następujący filtr:

- Czy PR realizuje dokładnie jeden ticket?
- Czy edytuje wyłącznie allowed paths ticketu?
- Czy nie miesza runtime, schema, package files, guardów, roadmapy i global docs bez jawnej zgody?
- Czy zachowuje `Payment != PatronGrant`, `Subscription/email != Patron` i Active `PatronGrant` jako target backend access truth?
- Czy nie używa `User.isPatron`, Clerk metadata, Payment alone, Subscription ani frontend state jako access truth?
- Czy denied playback nie ma tokenu/URL/provider call/view tracking?
- Czy locked state nie montuje realnego playera?
- Czy comments visibility i write permission pozostają rozdzielone?
- Czy unsubscribe nie dotyka `PatronGrant`?
- Czy manual access-affecting actions mają reason + audit?
- Czy logs/analytics nie ujawniają sekretów/tokenów?
- Czy testy i walidacja wynikają z ticketu i faktycznie zostały uruchomione?
- Czy PR body jasno mówi, czego nie zmieniono i jakie ryzyka pozostają?

## Definition of done dla runtime PR

Runtime PR jest done dopiero wtedy, gdy:

- implementuje dokładnie zakres ticketu,
- nie narusza forbidden paths ani single-writer zasad,
- ma testy adekwatne do ryzyka domeny,
- ma negative tests albo udokumentowaną kontrolę dla forbidden shortcuts,
- ma idempotency/security tests tam, gdzie dotyka webhooków, access, providerów lub tokenów,
- ma admin/support tests tam, gdzie dotyka diagnostics, audit lub manual actions,
- nie przedstawia target architecture jako istniejącego runtime,
- aktualizuje wyłącznie dokumenty dozwolone przez ticket,
- uruchamia wszystkie walidacje z ticketu,
- raportuje PASS/FAIL/NOT RUN uczciwie,
- nie zostawia znanego launch-critical gap bez blocker/follow-up ticketu.

## Definition of done dla docs/spec PR

Docs/spec PR jest done dopiero wtedy, gdy:

- edytuje wyłącznie dozwolone docs paths,
- nie zmienia runtime,
- nie zmienia schema, migrations, package files, guardów ani roadmapy bez jawnej zgody,
- nie rozstrzyga otwartych pytań właściciela samodzielnie,
- rozdziela target standard od current implementation,
- wskazuje launch-critical, should-have, post-launch i owner-question tam, gdzie dotyczy,
- jest spójny z `AGENTS.md`, `OWNER-DECISIONS.md`, ADR i aktywnymi specs,
- uruchamia `git diff --check` albo inną walidację wymaganą przez ticket,
- PR body zawiera summary, intent, changed files, validation, scope confirmation, risks, follow-ups i ticket status.

## Blockers

PR lub faza musi zostać oznaczona jako `FIX`, `BLOCKED` albo `REJECT`, jeśli zachodzi którykolwiek warunek:

- access leak albo token/URL leak dla denied playback,
- provider call przed backend Access allow,
- payment/subscription/frontend/cache użyte jako patron access truth,
- recurring patron subscription model bez nowej decyzji właściciela,
- full refund/dispute lifecycle pozostawia nieuprawniony access,
- paid-but-locked nie jest diagnozowalne przez admin cockpit przed launchem,
- email unsubscribe cofa `PatronGrant`,
- comments pod patron-only video są ukryte przed czytaniem wbrew owner decision,
- manual grant/revoke/suspend/reactivate bez reason + audit,
- runtime PR miesza schema/package/guard/roadmap/global docs bez jawnej zgody,
- dokument lub PR rozwiązuje open owner question bez decyzji właściciela,
- walidacja wymagana ticketem nie została uruchomiona i nie jest oznaczona jako NOT RUN z powodem.

## Non-goals

- Marketplace.
- Multi-creator SaaS.
- Mini-Patreon.
- White-label CMS.
- Tenant onboarding / tenant platforma.
- Generic social network.
- Recurring patron subscription model bez nowej owner decision.
- Heavy enterprise multi-provider video framework.
- Active R2/S3/Vercel Blob secure patron playback fallback bez decyzji architektonicznej.
- Generic dashboard przed Access Diagnostics.
- Mega-refactor zamiast faz/ticketów.
- Udawanie, że target architecture jest już aktualnym runtime.
