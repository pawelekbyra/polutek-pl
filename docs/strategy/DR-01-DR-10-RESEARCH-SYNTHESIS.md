# DR-01–DR-10 Research Synthesis

## Status

GO

## Executive summary dla właściciela

Launch-critical scope jest jasny: bezpieczne płatności i PatronGrant, backendowe źródło prawdy access, brak wycieku tokenów/URL w denied PlaybackPlan, bazowy Cloudflare Stream path, adminowe Access Diagnostics, polityka komentarzy, separacja newslettera od patronatu, obserwowalność krytycznych zdarzeń i X7 launch QA gates. Should-have to poprawki jakościowe, które wzmacniają doświadczenie, ale nie powinny blokować pierwszego publicznego launchu, jeśli launch-critical bezpieczeństwo jest spełnione. Post-launch to rozbudowa wygody, analityki, community i providerów po stabilnym launchu. Nie budować marketplace, multi-creator SaaS, mini-Patreona, white-label CMS, ciężkiego enterprise video frameworka ani cyklicznego patron-subscription modelu bez nowej decyzji właściciela.

Raw DR source documents not present in active repo docs; synthesis is based on active specs/audits/control-plane docs.

## Źródła

Przeczytane źródła prawdy i dokumenty pomocnicze:

- `README.md`
- `AGENTS.md`
- `docs/roadmap/Active-Execution-Roadmap.md`
- `docs/tickets/ready/X0.5-READY-001-research-synthesis.md`
- `docs/tickets/ready/X0.5-READY-002-owner-decisions-lock.md`
- `docs/strategy/OWNER-DECISIONS.md`
- `docs/strategy/RESEARCH-SYNTHESIS.md`
- `docs/strategy/MVP-TO-LAUNCH-SCOPE.md`
- `docs/strategy/DO-NOT-BUILD.md`
- `docs/strategy/PRODUCT-STANDARD.md`
- `docs/reports/reconciliation/X0-READY-001-R-PHASE-HANDOFF-INVENTORY.md`
- `docs/specs/ACCESS-PATRON-SPEC.md`
- `docs/specs/ADMIN-COCKPIT-SPEC.md`
- `docs/specs/COMMENTS-MODERATION-SPEC.md`
- `docs/specs/EMAIL-COMMS-SPEC.md`
- `docs/specs/LAUNCH-READINESS-SPEC.md`
- `docs/specs/OBSERVABILITY-SUPPORT-SPEC.md`
- `docs/specs/PAYMENTS-PATRON-SAFETY-SPEC.md`
- `docs/specs/PLAYBACKPLAN-PLAYER-SPEC.md`
- `docs/specs/VIDEO-PROVIDER-SPEC.md`
- `docs/audit/POST-R-CONTROL-PLANE-ACTIVATION-REPORT.md`
- `docs/audit/R10-AccessPolicy-Inventory.md`
- `docs/audit/R10-Cleanup-Readiness.md`
- `docs/audit/R10-Dead-Code-Candidates.md`
- `docs/audit/R10-Direct-Prisma-Inventory.md`
- `docs/audit/R10-GUARD-CLEANUP-NOTE.md`
- `docs/audit/R10-Legacy-Service-Inventory.md`
- `docs/audit/R10-Next-Cleanup-Plan.md`
- `docs/audit/R10-R11-DOCS-RECONCILIATION-NOTE.md`
- `docs/audit/R10-R11-HANDOFF-READINESS-REVIEW.md`
- `docs/audit/R7-Audit-Report.md`

## Product invariants

Ta synteza respektuje następujące inwarianty:

- Polutek.pl nie jest platformą / marketplace / SaaS / mini-Patreonem; jest jednym oficjalnym miejscem VOD twórcy.
- Patronat nie jest subskrypcją cykliczną.
- Patronat jest nagrodą za kwalifikujące jednorazowe wsparcie.
- Active PatronGrant jest docelowym źródłem prawdy dla patron access.
- Payment != PatronGrant.
- Subscription/email != Patron.
- Clerk metadata nie jest backend source of truth.
- Cloudflare Stream first.
- Mux later per `VideoAsset`.
- Komentarze pod patron-only video są widoczne publicznie, ale pisanie/reagowanie wymaga patron/admin.
- Launch jest publiczny, nie private beta.

## DR synthesis table

| DR | Obszar | Najważniejsze ustalenia | Launch-critical | Should-have | Post-launch | Do-not-build | Owner questions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DR-01 | Masterplan / product direction / single-creator VOD place | Produkt to jedno oficjalne miejsce VOD twórcy, nie platforma. X0.5 ma zamienić research w standard produktu, owner decisions, specs i backlog przed X1-X7. | Jednoznaczny scope launchu, kontrola ticketowa, brak runtime bez aktywnego ticketu, brak mylenia target architecture z current implementation. | Product standard jako filtr jakości dla UX/admin/player/email/comments. | Dalsze excellence passes po certyfikowanych fazach. | Marketplace, multi-creator SaaS, tenant platforma, white-label CMS, generic social network. | Czy owner chce dodatkowe ograniczenia prawne/UX ponad aktywne specs? |
| DR-02 | Payments / patron support / Stripe / patron grant | Stripe Checkout to jednorazowe wsparcie; Payment jest faktem finansowym; PatronGrant jest prawem dostępu. Grant powstaje przez policy/use-case po spełnieniu progu. | Raw body signature verification, idempotent StripeEvent ledger, server-side minimum amount validation, brak grantu poniżej progu, brak duplicate grant, full refund/dispute lifecycle, manual actions reason + audit. | Admin-editable threshold UX, lepsze widoki payment health, testy negatywne forbidden shortcuts. | Bardziej rozbudowane narzędzia reconciliation i alert escalation. | Recurring patron subscription model, webhook ustawiający `User.isPatron`, payment-alone access, client-side amount trust. | Partial refund policy: manual review czy automatyczna redukcja/cofnięcie grantu? |
| DR-03 | Access / locked content / PatronGrant source of truth | Access ma być deny-by-default i backendowy. Active PatronGrant jest prawdą dla patron access; `User.isPatron`, Clerk metadata i Subscription są legacy/cache/diagnostics, nie truth. | Wszystkie sensitive playback paths pytają Access module; denied plan nie ma tokenu/source; mismatch diagnostics nie ufa legacy flagom; admin override audytowany. | Testy route/API contract i negative tests dla legacy shortcutów. | Stopniowe usuwanie legacy bridges po stabilizacji. | Access z `User.isPatron`, Clerk metadata, Subscription, frontend state, fail-open. | Czy zachować jakieś istniejące runtime elementy jako read-model, jeśli nie naruszają truth? |
| DR-04 | Video provider architecture / Cloudflare Stream first / Mux later | Cloudflare Stream jest pierwszym providerem; Mux ma być możliwy per `VideoAsset` przez cienką abstrakcję; Video trzyma metadane produktu, VideoAsset stan provider/media. | Provider per VideoAsset, primary READY asset, upload/processing failure visibility, signed/private playback po Access allow, provider call never before access allow. | Admin media cockpit polish, captions/subtitles readiness, migracja oryginałów opisana. | Zaawansowane Mux analytics/4K/DRM, deeper media workflows. | Ciężki enterprise multi-provider framework, aktywny R2/S3/Vercel Blob jako secure patron playback fallback bez decyzji. | Czy owner wymaga dodatkowego preservation policy dla oryginałów mediów? |
| DR-05 | Playback UX / player / locked state / denied-state behavior | Backend PlaybackPlan steruje playerem. Allowed plan mountuje player; denied plan renderuje oddzielny locked placeholder bez URL/tokenu/provider call. | Stany READY/LOGIN_REQUIRED/PATRON_REQUIRED/VIDEO_NOT_READY/NO_PRIMARY_ASSET/PROCESSING/UNAVAILABLE/ERROR, no player under overlay, no denied tracking, mobile/accessibility baseline. | Lepsze copy locked states, captions/subtitles, player UX polish, admin preview marker. | Resume/progress enhancements i rich analytics po launchu. | Player ukryty overlayem, stream fetch przed allow, leaking playbackUrl/token, liczenie denied view jako playback. | Czy istniejące reakcje/hearts lub resume/progress mają być certyfikowane na launch, jeśli są już w runtime? |
| DR-06 | Admin cockpit / admin operations / diagnostics | Admin cockpit jest support operations center; Access Diagnostics przed dashboardem. Owner musi diagnozować paid-but-locked bez DB/Stripe/Clerk console. | User identity, PatronGrant history, payments/refunds/disputes, subscription, Clerk mismatch, final access decision, video asset status, failed webhooks, audyt manual actions. | Ergonomia admina, corrective use-cases przez domain modules, confirmation UX. | Rozbudowane support workflows i alert escalation. | Generic vanity dashboard przed diagnostics, direct DB mutation from UI, `User.isPatron` jako access fix, unaudited repairs. | Jakie dokładne alert channels i thresholds mają działać na launch? |
| DR-07 | Comments / community / moderation | Widoczność komentarzy != uprawnienie pisania. Komentarze pod opublikowanymi wideo są czytelne publicznie; pisanie/reagowanie przy PATRON wymaga patron/admin. | Report abuse, rate limiting, duplicate detection, moderation queue, audit hide/delete/restore/dismiss, single-level replies, no shadow bans. | Lepsza moderacja, spoiler UX, ergonomia queue. | Edycja komentarzy, bogatsze community, reakcje/hearts jeśli nie certyfikowane na launch. | Blokowanie czytania patron comments dla nie-patronów, guest write/report, UI-only permissions, shadow bans. | Czy reakcje/hearts są launch-critical, jeśli obecny runtime je posiada? Jakie rate limits są akceptowalne? |
| DR-08 | Email communication / subscriptions / notifications | Subscription to wyłącznie zgoda mailingowa. Patron nie jest automatycznie subskrybentem; unsubscribe nigdy nie dotyka PatronGrant; transactional oddzielnie od marketingu. | Consent/unsubscribe, bounce/complaint suppression, delivery webhooks, broadcast preview/test-send/audit, admin-visible consent state without access implication. | Preference center target, PL/EN template polish, broadcast UX. | Zaawansowana segmentacja i preference center polish. | Unsubscribe revoking access, automatic marketing opt-in for patrons, mixed transactional/marketing, broadcast bez preview/test-send/audit. | Jakie finalne PL/EN legal/cookie/email copy ma być użyte przed X7? Jakie rate limits dla broadcastów? |
| DR-09 | Observability / support / auditability | Właściciel potrzebuje health/support visibility dla webhooków, payments, access, providerów, playback, email i comments. Audit trail jest osobny od debug logs. | Failed/stuck events visible, critical billing/access/video/email alerts, mismatch diagnostics, redaction policy, no secrets/tokens in logs, admin preview excluded from analytics. | Privacy-safe owner dashboard, lepsze support runbook links, dev observability. | Głębsze alerts/escalation workflows i richer analytics. | Logging secrets/tokens, traktowanie audytu jako debug logs, ukrywanie failed webhook states, analytics z admin preview jako public views. | Jakie alert channels/thresholds są akceptowalne na launch? |
| DR-10 | Launch readiness / QA / public launch | Launch jest publiczny i wymaga X7 certification; access leak, payment fulfillment gap i privacy/legal/cookie/email consent gaps są blockerami. | Accessibility/mobile/performance checks, security review, backups/recovery, manual QA evidence, owner runbook, legal/privacy review, blocker register, final certification. | Copy/accessibility polish, performance budgets, manual QA templates. | Po-launch retrospektywa i rozszerzone cert dashboards. | Private beta jako substytut launch readiness, launch z access leak, broken payment fulfillment, missing consent/unsubscribe, brak support path. | Final legal/cookie copy; czy są dodatkowe kryteria public launch poza aktywnymi specs? |

## Launch-critical scope

| Item | Dlaczego launch-critical | Źródło | Powiązana faza/ticket |
| --- | --- | --- | --- |
| Payments / PatronGrant safety | Bezpieczne finansowe zdarzenia, webhook idempotency, progi i grant lifecycle są warunkiem, żeby patronat nie dawał błędnego dostępu ani nie gubił uprawnień. | `AGENTS.md`, `docs/specs/PAYMENTS-PATRON-SAFETY-SPEC.md`, `docs/strategy/OWNER-DECISIONS.md`, `docs/audit/R7-Audit-Report.md` | X1; `docs/tickets/ready/X1-READY-001-payment-patron-current-state-inventory.md` |
| Access source of truth | Active PatronGrant musi być backendową prawdą; legacy `User.isPatron`, Clerk metadata, Subscription i frontend state nie mogą decydować o patron access. | `AGENTS.md`, `docs/specs/ACCESS-PATRON-SPEC.md`, `docs/strategy/PRODUCT-STANDARD.md`, `docs/audit/R10-AccessPolicy-Inventory.md` | X2; `docs/tickets/ready/X2-READY-001-access-truth-inventory.md` |
| Locked playback denied-state | Denied PlaybackPlan nie może mountować playera, pobierać streamu, żądać tokenu, wołać providera, liczyć view ani ujawniać URL/tokenu. | `AGENTS.md`, `docs/specs/PLAYBACKPLAN-PLAYER-SPEC.md`, `docs/strategy/PRODUCT-STANDARD.md` | X4; `docs/tickets/ready/X4-READY-001-playbackplan-current-state-inventory.md` |
| Video provider baseline | Cloudflare first + cienki Mux-ready design per VideoAsset i widoczność processing failures są potrzebne, żeby launch miał bezpieczny playback path. | `docs/strategy/OWNER-DECISIONS.md`, `docs/specs/VIDEO-PROVIDER-SPEC.md`, `docs/roadmap/Active-Execution-Roadmap.md` | X3; `docs/tickets/ready/X3-READY-001-video-provider-current-state-inventory.md` |
| Admin support diagnostics | Owner musi rozwiązywać paid-but-locked i mismatch bez bezpośredniego DB/Stripe/Clerk console; manualne akcje wymagają reason + audit. | `AGENTS.md`, `docs/specs/ADMIN-COCKPIT-SPEC.md`, `docs/specs/OBSERVABILITY-SUPPORT-SPEC.md` | X5; `docs/tickets/ready/X5-READY-001-admin-cockpit-current-state-inventory.md` |
| Comments permission/visibility | Czytanie komentarzy i prawo pisania są oddzielne; patron-only video ma publiczne comments read, ale write/react wymaga patron/admin. | `AGENTS.md`, `docs/specs/COMMENTS-MODERATION-SPEC.md`, `docs/strategy/OWNER-DECISIONS.md` | X6 lub dedykowany comments ticket po X0.5; brak osobnego ready ticketu comments w aktywnej kolejce |
| Email unsubscribe/subscription separation | Subscription jest tylko zgodą mailingową; unsubscribe nie może usunąć PatronGrant; bounce/complaint suppression i consent są launch-critical. | `AGENTS.md`, `docs/specs/EMAIL-COMMS-SPEC.md`, `docs/strategy/PRODUCT-STANDARD.md` | X6 lub X7 readiness; brak osobnego ready ticketu email w aktywnej kolejce |
| Observability/support essentials | Krytyczne błędy billing/access/video/email/comments muszą być widoczne i nie mogą logować sekretów/tokenów. | `AGENTS.md`, `docs/specs/OBSERVABILITY-SUPPORT-SPEC.md`, `docs/strategy/MVP-TO-LAUNCH-SCOPE.md` | X5/X7; `docs/tickets/ready/X5-READY-001-admin-cockpit-current-state-inventory.md`, `docs/tickets/ready/X7-READY-001-launch-readiness-gap-analysis.md` |
| Launch QA gates | Public launch wymaga X7 certification, manual QA, legal/privacy/cookie/email consent, security, backups, accessibility, mobile i performance checks. | `docs/specs/LAUNCH-READINESS-SPEC.md`, `docs/roadmap/Active-Execution-Roadmap.md`, `README.md` | X7; `docs/tickets/ready/X7-READY-001-launch-readiness-gap-analysis.md` |

## Should-have scope

Rzeczy dobre dla jakości, ale nieblokujące pierwszego public launchu, o ile launch-critical safety i certyfikacja X7 są spełnione:

- Lepszy player UX: copy locked states, captions/subtitles readiness, admin preview marker i accessibility polish.
- Admin media cockpit polish oraz wygodniejsze widoki processing/upload failures.
- Broadcast preview/test-send UX ponad minimalny wymóg audytowalnego preview/test-send.
- Comment moderation ergonomics: lepszy spoiler flow, szybsza queue, wygodniejsze narzędzia moderatora.
- Privacy-safe analytics excluding admin preview.
- Dodatkowe negative tests i contract tests dla forbidden shortcuts, jeśli nie blokują głównej migracji.
- Performance budgets i manual QA templates jako wzmacniacz X7.

## Post-launch scope

Rzeczy sensowne później, ale niewarte opóźniania launchu:

- Resume/progress enhancements, jeśli nie są już stabilne i certyfikowalne.
- Zaawansowane Mux analytics, 4K/DRM albo deep provider workflows, jeśli owner podejmie taką decyzję.
- Preference center polish i bardziej rozbudowana segmentacja email.
- Richer community features: edycja komentarzy, rozbudowane reakcje/hearts, deeper threads, profile społecznościowe.
- Zaawansowane owner dashboards, alert escalation, retrospektywy po launchu i richer analytics.
- Stopniowe usuwanie legacy bridges i route-service allowlist po zamknięciu launch-critical domain migrations.

## Do-not-build scope

Nie budować, bo narusza product DNA lub aktywne owner decisions:

- Marketplace.
- Multi-creator SaaS.
- Mini-Patreon.
- White-label CMS.
- Tenant onboarding / tenant platforma.
- Generyczna sieć społecznościowa.
- Ciężki enterprise multi-provider video framework.
- Recurring subscription patron model bez jawnej nowej decyzji właściciela.
- Aktywny R2/S3/Vercel Blob secure patron playback fallback bez przyszłej decyzji architektonicznej.
- Player ukryty pod overlayem zamiast oddzielnego locked render tree.
- Provider call, playback token request lub stream fetch przed backendowym Access allow.
- Patron access oparty o `User.isPatron`, Clerk metadata, Subscription, Payment alone albo frontend state.
- Email unsubscribe cofający PatronGrant.
- Generic admin dashboard przed Access Diagnostics.
- Mega-refactor łączący runtime, schema, roadmapę, package files i guardy w jednym PR.

## Owner questions

Pytania właściciela wymagające decyzji lub doprecyzowania przed późniejszą certyfikacją:

- Polityka partial refund: czy częściowy refund redukuje/oznacza grant, czy pozostaje manual review?
- Czy reakcje/hearts w komentarzach są launch-critical, jeśli obecny runtime je posiada?
- Jakie dokładnie PL/EN legal/cookie copy ma być użyte przed X7?
- Jakie limity rate limiting dla komentarzy i broadcastów są akceptowalne na launch?
- Jakie dokładne alert channels i thresholds są akceptowalne na launch dla billing/access/video/email failures?
- Czy owner wymaga dodatkowej polityki preservation/migration dla oryginalnych plików wideo poza aktywną specyfikacją Video Provider?
- Czy istnieją dodatkowe wymogi prawne/UX/accessibility, których nie ma jeszcze w aktywnych specs?

## Blockers

Brak blockerów dla kontynuacji X0.5.

## Rekomendacja

GO — można przejść do X0.5-READY-002

## Następny proponowany ticket

```txt
docs/tickets/ready/X0.5-READY-002-owner-decisions-lock.md
```

## Czego nie zmieniono

- runtime,
- `app/**`,
- `lib/**`,
- `components/**`,
- `tests/**`,
- `prisma/**`,
- `scripts/**`,
- package files,
- `README.md`,
- `AGENTS.md`,
- roadmap,
- tickets.
