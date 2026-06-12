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


## Product Excellence DNA

This section extends Product DNA with a measurable execution standard. It does not certify current runtime and does not change the identity of Polutek.pl: one official VOD place for one creator, one catalogue, one patron/access system, one community, one mailing list and one admin cockpit. It must not be used to expand the product into a marketplace, multi-creator SaaS, tenant platform, recurring patron subscription, heavy enterprise video-provider framework or generic social network.

### Excellence is evidence, not an adjective

Excellent nie oznacza „dużo funkcji”. Excellent oznacza spójny, bezpieczny, zrozumiały, szybki, dostępny, supportowalny i produkcyjnie zweryfikowany produkt.

Product excellence MUST NOT be claimed only because:

- docs exist,
- a roadmap exists,
- a PR was merged,
- unit tests passed,
- a local build works,
- a screen or endpoint exists,
- an agent wrote a `MERGE` recommendation.

Excellence requires domain-appropriate evidence: implementation, automated tests, contract tests, negative tests, production configuration, manual QA, UX review, operational data, owner acceptance and certification. Written standard != implemented runtime. Merged code != production proof. Green unit tests != production certification.

### Readiness levels

These statuses are not interchangeable:

- `SAFE_BASELINE` — no known launch-critical security or integrity defect is open, but visual polish and operational proof may still be incomplete.
- `LAUNCH_READY` — all required X7 gates, production smoke tests, owner runbook, legal/privacy, security, backup, accessibility, mobile and performance gates have production/manual evidence.
- `EXCELLENT_AND_STABLE` — `LAUNCH_READY` plus completed X6 excellence passes, owner usability review, representative user validation, production stabilization period, analysis of real user errors/questions and fixes for the highest-impact post-launch findings.

A PR, phase or report MUST state which level it is assessing. `SAFE_BASELINE` cannot be used as a synonym for `LAUNCH_READY`; `LAUNCH_READY` cannot be used as a synonym for `EXCELLENT_AND_STABLE`.

### Project-state truth classification

Use these statuses in Product Excellence, X6, X7 and reconciliation evidence. Do not use plain `DONE` when a more precise status applies.

| Status | Meaning |
| --- | --- |
| `IMPLEMENTED_VERIFIED` | Code/process exists, required tests passed and appropriate runtime, manual or production evidence was collected. |
| `IMPLEMENTED_UNVERIFIED` | Code/process exists, but production, manual or integration evidence is missing. |
| `PARTIAL` | Part of the requirement exists, but the path does not satisfy the full Definition of Done. |
| `MISSING` | Required implementation, process or evidence does not exist. |
| `BLOCKED` | Work cannot be completed without a technical dependency, access, credentials, prior ticket, merge resolution or owner decision. |
| `OWNER_DECISION_REQUIRED` | More than one compliant option exists and active docs do not authorize the agent to choose. |
| `DEFERRED_POST_LAUNCH` | Intentionally deferred and documented as non-blocking for public launch. |
| `NOT_APPLICABLE` | Requirement does not apply to the flow and the evidence record explains why. |

### X6 Product Excellence Program

X6 is a sequence of separate excellence passes. It is not one broad rewrite and MUST be split into small tickets. Every X6 pass MUST carry an evidence matrix with only the global status values:

| Kryterium | Status | Dowód | Środowisko | Data | Właściciel dowodu | Blocker/follow-up |
| --------- | ------ | ----- | ---------- | ---- | ----------------- | ----------------- |

Allowed evidence includes a test command and result, redacted screenshot, recording without secrets, redacted log, deployment URL, manual QA result, browser-test result, accessibility report, performance trace, support runbook result or owner acceptance. The only evidence MUST NOT be “wygląda dobrze”, “powinno działać”, “kod istnieje”, “agent przejrzał” or “testów nie uruchomiono, ale zmiana jest prosta”.

For each pass below, launch blockers block X7 unless explicitly accepted as non-critical by owner and recorded outside access, payments, token leakage, legal/privacy, broken production deployment or backup/recovery.

#### X6.1 — Design System Consistency Pass

- Goal: remove accidental competing UI patterns without requiring a full redesign when current UI is good.
- Scope: typography, spacing, size/hierarchy, buttons, inputs, dialogs, tabs, cards, badges, status indicators, success/error/warning patterns, public UI, auth UI, player UI, checkout, comments and admin cockpit.
- Entry criteria: launch-critical screens identified; current component/status patterns inventoried.
- Evidence required: UI inventory, screenshots for public/auth/player/checkout/comments/admin, list of intentional exceptions, mobile and desktop samples.
- Measurable exit criteria: no accidental competing pattern for the same interaction; consistent status naming; consistent destructive-action states; shared confirmation rules; consistent mobile/desktop behavior; explicit exception list.
- Launch blockers: destructive actions without confirmation; inconsistent states that hide access/payment/video risk; mobile pattern that prevents a launch-critical action.
- Should-have: visual refinements that do not affect comprehension, safety or support.
- Post-launch items: cosmetic redesign, animations and non-critical visual delight.
- Owner questions: `OWNER_DECISION_REQUIRED` for any intentional brand/design exception not already documented.
- Candidate small tickets: `X6-EX-001` UI consistency inventory and consolidation plan.

#### X6.2 — State Completeness Pass

- Goal: every launch-critical screen explains what is happening and gives a safe next action.
- Scope: homepage, catalogue, video page, public player, patron locked state, checkout, login, comments, newsletter, admin users, admin payments, admin videos, Cloudflare upload/import, webhook diagnostics and paid-but-locked diagnostics.
- Entry criteria: launch-critical screens and flows listed.
- Evidence required: matrix for loading, empty, success, validation error, server error, offline/network failure, retry, unauthorized, forbidden, locked, processing, unavailable, partial-data and destructive confirmation.
- Measurable exit criteria: no infinite spinner, unexplained blank screen, raw stack trace, vague “Something went wrong” without next action, real player hidden below locked overlay or destructive action without confirmation.
- Launch blockers: missing paid-but-locked diagnostic state; denied playback mounting player; destructive support action without confirmation.
- Should-have: richer illustration/copy for non-critical empty states.
- Post-launch items: advanced personalization of state copy.
- Owner questions: `OWNER_DECISION_REQUIRED` for copy tone where product/legal decision is missing.
- Candidate small tickets: `X6-EX-002` state completeness inventory.

#### X6.3 — Responsive and Browser Pass

- Goal: verify launch-critical flows across the minimum manual device/browser matrix.
- Scope: viewports 360 px, 390 px, 768 px, 1024 px and 1440 px; Chrome desktop, Firefox desktop, Safari desktop, Chrome Android and Safari iOS.
- Entry criteria: production-like deployment or stable preview with representative data.
- Evidence required: manual matrix with environment, date and status; unavailable environments recorded in the evidence field as not run, with status `BLOCKED` when access/device is required or `IMPLEMENTED_UNVERIFIED` when evidence is missing but not blocking; never mark unavailable environment as `IMPLEMENTED_VERIFIED`.
- Measurable exit criteria: player aspect ratio, fullscreen, orientation change, checkout with on-screen keyboard, dialogs, long PL/EN text, comments composer, admin tables/forms, upload/import, locked state, sticky navigation, focus and scroll restoration verified or blocked.
- Launch blockers: mobile/browser issue preventing checkout, access, playback, support diagnostics, moderation or safe admin action.
- Should-have: non-critical layout polish outside launch-critical flows.
- Post-launch items: broader device coverage after real traffic data.
- Owner questions: `OWNER_DECISION_REQUIRED` for owner-approved minimum physical-device set beyond the baseline.
- Candidate small tickets: `X6-EX-003` mobile/browser matrix execution.

#### X6.4 — Accessibility Pass

- Goal: target WCAG 2.2 AA for launch-critical public and admin flows.
- Scope: automated scan plus manual keyboard operation, visible focus, focus order, keyboard traps, labels/instructions, accessible errors, headings/landmarks, contrast, assistive-technology status messages, reduced motion, zoom/reflow, hit targets, accessible authentication and captions/subtitles readiness when required by owner/legal scope.
- Entry criteria: representative launch-critical flows deployed in a testable environment.
- Evidence required: automated scan report, manual keyboard checklist, contrast notes, form/error evidence and owner/legal note for captions/subtitles scope.
- Measurable exit criteria: no critical WCAG 2.2 AA blocker in launch-critical flows; automated scan alone cannot certify accessibility.
- Launch blockers: keyboard trap, inaccessible checkout/auth/admin critical action, unreadable contrast for critical text, missing form labels for required launch forms.
- Should-have: minor non-blocking improvements with no critical usability impact.
- Post-launch items: broader assistive-technology testing and media accessibility enhancements beyond launch scope.
- Owner questions: `OWNER_DECISION_REQUIRED` for captions/subtitles scope and any accepted accessibility exception.
- Candidate small tickets: `X6-EX-004` accessibility audit and remediation list.

#### X6.5 — Performance Pass

- Goal: set a web performance quality bar for representative users without weakening security, accessibility or domain correctness.
- Scope: homepage, catalogue, video page, locked patron page, player start, checkout, comments, admin video details and admin user/access diagnostics.
- Entry criteria: production-like build and representative content/data.
- Evidence required: repeatable lab measurements before field data exists; device and throttling described; mobile and desktop measured separately; field data at 75th percentile when available.
- Measurable exit criteria: target LCP <= 2.5 s, INP <= 200 ms and CLS <= 0.1 at p75 separately for mobile/desktop when field data exists; before field data, missing field evidence is `IMPLEMENTED_UNVERIFIED`, not full pass.
- Launch blockers: performance issue preventing checkout, playback start, locked-state comprehension, admin diagnostics or support recovery; performance fix that leaks token/source or weakens access/security/accessibility.
- Should-have: optimizations for non-critical pages and aesthetic transitions.
- Post-launch items: field-data tuning after production traffic.
- Owner questions: `OWNER_DECISION_REQUIRED` for performance exceptions and representative device/network baseline.
- Candidate small tickets: `X6-EX-005` performance baseline and budgets.

#### X6.6 — Copy, Trust and Comprehension Pass

- Goal: make launch-critical flows understandable without misleading users about patronat, access, newsletter or support.
- Scope: product explanation, one-time patron support, qualifying thresholds, access timing, lifetime/no-expiry default, patronat vs newsletter, locked reason, next action, PROCESSING state, paid-but-locked support, refund/dispute effects, contact path and irreversible actions.
- Entry criteria: launch-critical UI copy inventory exists in PL/EN where applicable.
- Evidence required: copy inventory, screenshot samples, PL/EN glossary, error messages with next actions and admin-action copy.
- Measurable exit criteria: consistent PL/EN vocabulary; no misleading “subscription” for patronat; errors explain next action; no user-facing technical jargon; admin-required states are explicit.
- Launch blockers: copy implies recurring patron subscription, newsletter grants access, access is guaranteed without eligibility, or paid-but-locked has no support path.
- Should-have: tone refinement and brand voice improvements.
- Post-launch items: copy adjustments from real user questions.
- Owner questions: `OWNER_DECISION_REQUIRED` for legal-sensitive copy and any waiver of user-validation findings.
- Candidate small tickets: `X6-EX-006` copy/trust review.

#### X6.7 — Owner and Admin Usability Pass

- Goal: owner can operate support-critical tasks without direct DB access or developer help.
- Scope: publish video, upload Cloudflare asset, import legacy material, observe PENDING -> PROCESSING -> READY, diagnose FAILED asset, find user by payment, diagnose paid-but-locked, inspect final access decision source, manual grant with reason/audit, suspend/reactivate/revoke, refund/dispute check, moderate reported comment, test-send email, inspect failed/stuck webhook, inspect health status and execute rollback/recovery runbook.
- Entry criteria: owner runbook draft and production-like admin environment.
- Evidence required: for each scenario: instruction, expected result, proof, where to find errors and safe retry/recovery path.
- Measurable exit criteria: owner completes each required scenario or records `BLOCKED`; paid-but-locked without diagnosis is a launch blocker.
- Launch blockers: owner cannot diagnose paid-but-locked, failed webhook, provider failure, access decision or dangerous manual action safely.
- Should-have: improved admin ergonomics after core support flows work.
- Post-launch items: dashboard refinements based on real support load.
- Owner questions: `OWNER_DECISION_REQUIRED` for rollback/recovery acceptance and support escalation ownership.
- Candidate small tickets: `X6-EX-007` owner usability runbook test.

#### X6.8 — Representative User Validation Pass

- Goal: validate comprehension and trust with representative users or record an explicit owner waiver.
- Scope: at least 5 representative sessions, including at least one mobile user, one new user unfamiliar with the product, one patron or simulated patron flow, one locked -> support -> access flow and an issue log without sensitive data.
- Entry criteria: stable flow set, test script and privacy-safe recording/note policy.
- Evidence required: session notes, severity-classified issue register and owner acceptance/waiver.
- Measurable exit criteria: findings classified as `BLOCKER`, `HIGH`, `MEDIUM`, `LOW` or `OUT_OF_SCOPE`; no unresolved `BLOCKER` in launch-critical comprehension/trust/access/payment/playback flow.
- Launch blockers: users cannot understand one-time patronat, payment trust, locked state, finding a film, starting playback, comments, newsletter distinction, error next action or basic mobile navigation.
- Should-have: medium/low usability improvements with follow-ups.
- Post-launch items: broader validation after production usage.
- Owner questions: `OWNER_DECISION_REQUIRED` for usability testing waiver or recruitment constraints.
- Candidate small tickets: `X6-EX-008` representative user validation.

### Post-Launch Stabilization DNA

Launch nie kończy Product Excellence. Launch rozpoczyna produkcyjny stabilization pass.

The default stabilization model is a recommendation until owner approves it; timing is therefore `OWNER_DECISION_REQUIRED`, not an already-binding owner decision.

- First 72 hours: increased monitoring; webhook checks; payment/access mismatches; provider failures; playback failures; email failures; comments/abuse; support requests; mobile errors; quick rollback readiness.
- First 14 days: triage real bugs; analyze user questions; analyze paid-but-locked; analyze abandoned flows; improve copy; fix the most common mobile problems; regress launch-critical flows after fixes.
- Up to 30 days: stability review; owner retrospective; explicit debt list; legacy cleanup decision; post-launch feature decision; Product Standard update from real usage; confirm or revoke `EXCELLENT_AND_STABLE`.

Post-launch fixes MUST preserve the Product DNA and MUST NOT turn the product into a platform, marketplace, recurring patron subscription or enterprise SaaS.

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
- Domyślne launch thresholds: 10 PLN, 10 USD, 10 EUR, 10 CHF, 10 GBP.
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
