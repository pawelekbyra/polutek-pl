# MVP to Launch Scope

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Executive summary

Launch Polutek.pl jest publiczny, nie private beta. MVP-to-launch nie oznacza „quick minimum”; oznacza najmniejszy publicznie bezpieczny, supportowalny i excellent-enough zakres, który respektuje product DNA i aktywne owner decisions.

Launch-critical obejmuje bezpieczeństwo pieniędzy, PatronGrant, access, playback, Cloudflare Stream baseline, admin diagnostics, komentarze, email consent, observability i X7 gates. Should-have wzmacnia jakość, ale nie może blokować launchu, jeśli launch-critical safety jest spełnione. Post-launch obejmuje wygodę, richer community, zaawansowaną analitykę i rozbudowę providerów. Owner-question nie może zostać rozstrzygnięte przez agenta bez jawnej decyzji właściciela.

## Launch-critical

| Obszar | Wymaganie | Dlaczego blokuje launch | Faza/ticket |
| --- | --- | --- | --- |
| Payments / PatronGrant safety | Stripe one-time support zapisuje `Payment` jako fakt finansowy i tworzy `PatronGrant` tylko przez eligibility policy. | Bez tego patron może nie dostać dostępu albo dostać dostęp bez kwalifikującej płatności. | X1 / `docs/tickets/ready/X1-READY-001-payment-patron-current-state-inventory.md` |
| Stripe webhook idempotency | Raw body signature verification, idempotent `StripeEvent` ledger i brak duplicate grant na retry. | Webhook retry albo fałszywy event może zepsuć pieniądze, granty i support. | X1 / `docs/tickets/ready/X1-READY-001-payment-patron-current-state-inventory.md` |
| Minimum amount threshold | Server-side threshold per currency, admin-configurable; default launch: 10 PLN, 10 USD, 10 EUR, 10 CHF. | Client-side kwota albo below-threshold payment nie może tworzyć patron access. | X1 / `docs/tickets/ready/X1-READY-001-payment-patron-current-state-inventory.md` |
| Refund/dispute lifecycle | Full refund revokes linked grant; dispute suspends; dispute won reactivates; dispute lost/chargeback revokes; partial refund ma policy/manual review. | Launch nie może zostawić dostępu po cofniętej lub spornej płatności. | X1 / `docs/tickets/ready/X1-READY-001-payment-patron-current-state-inventory.md` |
| Access source of truth | Backend access czyta aktywny `PatronGrant`; nie ufa `User.isPatron`, Clerk metadata, `Subscription`, Payment alone ani frontend state. | To centralny warunek braku access leak i spójności paid-but-locked diagnostics. | X2 / `docs/tickets/ready/X2-READY-001-access-truth-inventory.md` |
| Locked playback denied-state | Denied `PlaybackPlan` nie zawiera URL/tokenu, nie mountuje playera, nie fetchuje streamu, nie robi provider call i nie liczy view. | Patron-only media nie mogą wyciec przez frontend, overlay, analytics albo provider request. | X4 / `docs/tickets/ready/X4-READY-001-playbackplan-current-state-inventory.md` |
| Cloudflare Stream baseline | Cloudflare Stream first provider path, processing state, primary READY asset, signed/private playback po Access allow. | Publiczny VOD potrzebuje bezpiecznego, operacyjnego playback path. | X3 / `docs/tickets/ready/X3-READY-001-video-provider-current-state-inventory.md` |
| Thin Mux-ready design | Provider per `VideoAsset` i minimalna abstrakcja kompatybilna z Mux, bez enterprise frameworka. | Zapobiega przepisywaniu fundamentu po launchu bez budowania overengineeringu. | X3 / `docs/tickets/ready/X3-READY-001-video-provider-current-state-inventory.md` |
| Admin access diagnostics | Owner widzi identity, payments, refunds, disputes, PatronGrant history, subscription, Clerk/User mismatch, final access decision i video asset state. | Paid-but-locked musi być rozwiązywalne bez DB/Stripe/Clerk console. | X5 / `docs/tickets/ready/X5-READY-001-admin-cockpit-current-state-inventory.md` |
| Manual access actions audit | Manual grant/suspend/reactivate/revoke ma reason, audit i confirmation dla działań niebezpiecznych. | Support nie może naprawiać dostępu bez śladu i kontroli. | X5 / `docs/tickets/ready/X5-READY-001-admin-cockpit-current-state-inventory.md` |
| Comments visibility vs write permissions | Komentarze pod patron-only video są publicznie czytelne; pisanie/reagowanie wymaga patrona albo admina; gość nie pisze/reportuje. | Community UX i polityka dostępu nie mogą mieszać read visibility z write permission. | X6 / future comments ticket or X7 gap analysis |
| Comments moderation safety | Report abuse, rate limiting, duplicate detection, moderation queue, audit dla hide/delete/restore/dismiss; no shadow bans. | Publiczny launch wymaga minimalnej ochrony przed spamem i nadużyciami. | X6 / future comments ticket or X7 gap analysis |
| Email unsubscribe/subscription separation | `Subscription` jest zgodą mailingową; unsubscribe nie cofa `PatronGrant`; Patron nie oznacza marketing consent. | Email consent nie może przypadkowo zmieniać patron access ani łamać zgód. | X6/X7 / future email ticket or `docs/tickets/ready/X7-READY-001-launch-readiness-gap-analysis.md` |
| Email delivery safety | Broadcast preview/test-send + audit, delivery webhooks, bounce/complaint suppression. | Publiczne maile wymagają minimalnej deliverability, consent i support safety. | X6/X7 / future email ticket or `docs/tickets/ready/X7-READY-001-launch-readiness-gap-analysis.md` |
| Observability/support essentials | Widoczne failed/stuck webhooks, payment/access/video/email/comments health, playback errors, no secrets/tokens in logs. | Owner musi wykrywać i diagnozować krytyczne awarie bez przecieków. | X5/X7 / `docs/tickets/ready/X5-READY-001-admin-cockpit-current-state-inventory.md`, `docs/tickets/ready/X7-READY-001-launch-readiness-gap-analysis.md` |
| Manual QA / X7 launch gates | Legal/privacy/cookie/email consent, accessibility, mobile, performance, security, backups/recovery, owner runbook, final certification. | Public launch nie może opierać się wyłącznie na roadmapie ani niewykonanej deklaracji. | X7 / `docs/tickets/ready/X7-READY-001-launch-readiness-gap-analysis.md` |

## Should-have

| Obszar | Wymaganie | Dlaczego warto | Czy blokuje launch? |
| --- | --- | --- | --- |
| Player UX | Lepsze copy locked states, captions/subtitles readiness, mobile polish, accessibility polish. | Zwiększa zrozumiałość i jakość konsumpcji VOD. | Nie, jeśli denied-state safety i podstawowe accessibility/mobile przechodzą. |
| Admin media cockpit | Wygodniejsze widoki upload/processing/provider failures. | Ułatwia support i operacje contentowe. | Nie, jeśli launch-critical diagnostics są wystarczające. |
| Broadcast UX | Lepszy flow preview/test-send i copy PL/EN ponad minimalny audit. | Zmniejsza ryzyko błędów w komunikacji. | Nie, jeśli minimalny preview/test-send/audit działa. |
| Moderation ergonomics | Lepszy spoiler flow, szybsza queue, wygodniejsze narzędzia moderatora. | Ułatwia operacje społeczności. | Nie, jeśli minimalne report/rate limit/audit istnieją. |
| Privacy-safe analytics | Podstawowe metryki bez admin preview i bez prywatnych tokenów/URL. | Pomaga ownerowi rozumieć produkt. | Nie, jeśli brak analytics nie wpływa na bezpieczeństwo i support. |
| Negative/contract test depth | Dodatkowe testy dla forbidden shortcuts poza minimalnym ryzykiem ticketu. | Zwiększa pewność i zmniejsza regresje. | Nie samo w sobie, chyba że dotyczy launch-critical gap. |
| Performance budgets | Budżety i checklisty perf dla kluczowych ścieżek. | Pomaga utrzymać public launch quality. | Nie, jeśli X7 performance gate przechodzi. |

## Post-launch

| Obszar | Wymaganie | Dlaczego po launchu |
| --- | --- | --- |
| Playback progress | Resume/progress enhancements, jeśli nie są już stabilne i certyfikowalne. | Nie jest konieczne do bezpiecznego public launchu VOD. |
| Advanced video | Zaawansowane Mux analytics, 4K, DRM, deep provider workflows. | Wymaga dodatkowej decyzji/kosztu i nie jest minimalnym Cloudflare baseline. |
| Email preferences | Preference center polish, segmentacja, richer campaigns. | Po launchu można iterować bez ryzyka access truth. |
| Community features | Edycja komentarzy, richer reactions/hearts, deeper threads, profile społecznościowe. | Może rozszerzać scope w kierunku social network; wymaga kontroli. |
| Owner dashboards | Zaawansowane dashboardy, retrospektywy i richer analytics. | Access Diagnostics są ważniejsze przed launchem. |
| Alert escalation | Bardziej rozbudowane kanały, on-call i retrospektywy. | Minimalne critical alerts blokują launch; zaawansowany workflow może poczekać. |
| Legacy cleanup | Stopniowe usuwanie legacy bridges i allowlist po domain migrations. | Nie powinno blokować launchu, jeśli nie tworzy security/access gap. |

## Owner questions before launch

| ID | Pytanie | Najpóźniej przed | Powiązana faza |
| --- | --- | --- | --- |
| OQ-001 | Polityka partial refund: czy częściowy refund redukuje/oznacza grant, czy pozostaje manual review? | X1 Payments / Patron Safety | X1 |
| OQ-002 | Czy reakcje/hearts w komentarzach są launch-critical, jeśli obecny runtime je posiada? | X6 Product Excellence Passes | X6 |
| OQ-003 | Jakie dokładnie PL/EN legal/cookie copy ma być użyte przed X7? | X7 Launch Readiness | X7 |
| OQ-004 | Jakie limity rate limiting dla komentarzy i broadcastów są akceptowalne na launch? | X6/X7 Launch Readiness | X6/X7 |
| OQ-005 | Jakie dokładne alert channels i thresholds są akceptowalne na launch dla billing/access/video/email failures? | X7 Launch Readiness | X7 |
| OQ-006 | Czy owner wymaga dodatkowej polityki preservation/migration dla oryginalnych plików wideo poza aktywną specyfikacją Video Provider? | X3 Video Provider Foundation | X3 |
| OQ-007 | Czy istnieją dodatkowe wymogi prawne/UX/accessibility, których nie ma jeszcze w aktywnych specs? | X7 Launch Readiness | X7 |

## Launch blockers

- Access leak albo playable URL/token w denied `PlaybackPlan`.
- Player mounted under overlay dla locked content.
- Provider call, token request lub stream fetch przed backendowym Access allow.
- Patron access oparty o `User.isPatron`, Clerk metadata, `Subscription`, Payment alone, Stripe state alone albo frontend state.
- Stripe webhook bez raw-body signature verification albo bez idempotency ledger.
- Duplicate grant na webhook retry.
- Below-threshold payment tworzy access.
- Full refund/dispute lifecycle nie cofa/zawiesza/reactivates/revokes zgodnie z policy.
- Brak rozstrzygniętej partial refund policy albo manual-review path przed X1 certyfikacją.
- Brak paid-but-locked diagnostics w admin cockpit przed public launch.
- Unsubscribe cofa `PatronGrant` albo Patron automatycznie zapisuje się na marketing.
- Brak bounce/complaint suppression przed publicznym broadcastem.
- Brak minimalnej moderation/report/rate-limit ochrony dla publicznych komentarzy.
- Logowanie sekretów, playback tokenów albo prywatnych URL-i.
- Brak X7 manual QA, owner runbook, legal/privacy/cookie/email consent review, security, backup/recovery, accessibility, mobile lub performance gate.

## Non-blockers

- Brak marketplace/multi-creator/tenant features, bo to nie jest produktowy cel.
- Brak recurring patron subscription, bo patronat jest jednorazowym wsparciem.
- Brak heavy enterprise video provider frameworka, jeśli Cloudflare baseline i cienki Mux-ready design są spełnione.
- Brak aktywnego R2/S3/Vercel Blob secure patron playback fallback.
- Brak zaawansowanych Mux analytics/4K/DRM.
- Brak resume/progress enhancements, jeśli podstawowy playback jest bezpieczny.
- Brak edit comments, deep threads, profiles i rozbudowanych reactions, chyba że owner oznaczy je jako launch-critical.
- Brak generic owner dashboard, jeśli Access Diagnostics i critical health są spełnione.
- Brak pełnego preference center polish, jeśli consent, unsubscribe i suppression są bezpieczne.
