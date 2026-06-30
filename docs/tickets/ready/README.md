# Ready Ticket Queue

Status: **ACTIVE_PRODUCT_ROADMAP_MODE**

Ten plik jest kanoniczną kolejką wykonywalnych prac dla bieżącego produktu.

Polutek.pl jest po stabilizacji dużego refaktoru, ale produkt nadal aktywnie się rozwija. Aktualna kolejka łączy:

- P0 build/deploy health,
- P1 product work zaakceptowany przez właściciela,
- P2 quality/admin/media/accessibility features,
- techniczny dług z `docs/REFACTORING-ROADMAP.md`, realizowany małymi slice’ami.

`docs/REFACTORING-ROADMAP.md` pozostaje ważną techniczną bazą długu i audytem z 2026-06-27, ale nie jest już jedyną aktualną roadmapą produktu.

<!-- CONTROL_PLANE_CURRENT_MODE: ACTIVE_PRODUCT_ROADMAP_MODE -->
<!-- CONTROL_PLANE_CURRENT_QUEUE_FILE: docs/tickets/ready/README.md -->
<!-- CONTROL_PLANE_CURRENT_TICKET_ID: NONE -->
<!-- CONTROL_PLANE_CURRENT_TICKET_FILE: NONE -->
<!-- NO_ACTIVE_LARGE_CODE_TICKET -->
<!-- no active large code ticket — nie ma aktywnego dużego ticketu kodowego -->

## Current Control-Plane Rule

Każda nowa sesja pracy nad repo ma zacząć od:

1. Sprawdzenia, czy main/build/deploy nie jest zepsuty.
2. Przeczytania tego pliku.
3. Jeśli praca dotyczy długu technicznego, przeczytania `docs/REFACTORING-ROADMAP.md`.
4. Jeśli praca dotyczy launch/operacji, sprawdzenia `docs/roadmap/Launch-Execution-Backlog.md`.

Nie wolno wracać do trybu „duży refactor wszystko naraz”. Prace mają być małe, jednoznaczne i reviewable.

## Progress update rule — mandatory for every agent

Każdy agent po zakończeniu pracy **musi zaktualizować ten plik w tym samym PR/commicie**, zanim uzna pracę za skończoną.

Wymagane aktualizacje:

1. Zmień status itemu w tabeli `Queue` oraz checkbox w odpowiedniej sekcji progress tracker.
2. Dopisz PR/commit/evidence w kolumnie `Evidence`.
3. Jeśli item nie jest w pełni zrobiony, ustaw `PARTIAL` i dopisz co zostało.
4. Jeśli znaleziono blokadę, ustaw `BLOCKED` i dopisz konkretny powód.
5. Nie zostawiaj ukończonej pracy jako `TODO`.

Dozwolone statusy: `TODO`, `IN_PROGRESS`, `PARTIAL`, `BLOCKED`, `DONE`, `SKIPPED_BY_OWNER`, `ACTIVE`, `WATCH`.

## Queue

| Order | Ticket | Status | Evidence |
| ---: | --- | --- | --- |
| 1 | `REFACTORING-ROADMAP-2026-06-27` | `ACTIVE` | README pointer added in commit `ef9f6a125a7899d350dd04ed7d474263281272e5` |
| 1.1 | `BUG-001` — Redis failure fallback in playback-event recording | `DONE` | Zweryfikowane w kodzie: `record-playback-event.use-case.ts:227-229` try/catch obecny |
| 1.2 | `BUG-002` — admin users export auth check before processing | `DONE` | Zweryfikowane w kodzie: `app/api/admin/users/export/route.ts:12` requireAdminForApi na początku |
| 1.3 | `BUG-003` — admin comments routes return typed use-case errors, not hardcoded 500 | `DONE` | Zweryfikowane w kodzie: wszystkie 4 routes używają `fromUseCaseResult()` |
| 1.4 | `BUG-004` — replace string-matching error classification in payment/admin routes | `DONE` | Zweryfikowane w kodzie: używa `statusCode` zamiast `includes('Forbidden')` |
| 1.5 | `BUG-005` — support custom Vercel Blob public host in thumbnail response service | `DONE` | Zweryfikowane w kodzie: `thumbnail-response.service.ts:99` sprawdza `NEXT_PUBLIC_BLOB_PUBLIC_HOST` |
| 1.6 | `BUG-006` — stop persisting `/logo.png` fallback as real thumbnail data | `DONE` | PR claude/polutek-pl-proposals-qfkm9y: `video.repository.ts:268` zmienione na `?? ''`; later PR #1256 keeps thumbnails behind `/api/videos/[id]/thumbnail` |
| 1.7 | `BUG-007` — malformed JSON handling in admin routes | `DONE` | PR claude/polutek-pl-proposals-qfkm9y: try/catch przy `req.json()` w `emails/broadcast/route.ts` (actions już miało) |
| 1.8 | `#1204` — multi-source video slice: diagnostics, YouTube thumbnail, SEO, oEmbed, security tests | `DONE` | PR #1205. Later provider/upload expansion continued through #1227 and #1248; #1204/#1228 may remain product containers, not this old refactor remainder. |
| 2.1 | `INCOMPLETE-007` — remove dead `Actor.isPatron` | `DONE` | PR claude/polutek-pl-proposals-qfkm9y: usunięte z `actor.ts`, konstruktorów i testów |
| 2.2 | `INCOMPLETE-004` — bounce/complaint email auto-suppression | `DONE` | Zweryfikowane w kodzie: `handle-resend-webhook.use-case.ts:269` ustawia `marketingEmails: false` |
| 2.3 | `INCOMPLETE-008` — unify loading state around VideoPlayer/PremiumWrapper | `DONE` | Zweryfikowane w kodzie: `VideoPlayer.tsx:456-458` komentarz potwierdza świadomą decyzję — PremiumWrapper owns loading |
| 2.4 | `CLEANUP-003` — user-visible typo cleanup | `DONE` | Zweryfikowane w kodzie: `LanguageContext.tsx:76` — `Subskrybuj` poprawne |
| 2.5 | `CLEANUP-004` — hardcoded support email in components | `DONE` | PR claude/polutek-pl-proposals-qfkm9y: `PremiumWrapper.tsx:391` fallback zmieniony z email na `''` |
| 3.1 | `INCOMPLETE-001` — HELD_FOR_REVIEW implementation | `DONE` | PR claude/polutek-pl-proposals-qfkm9y: use cases hold/approve, auto-trigger (próg 3), API routes, admin UI |
| 3 | `INCOMPLETE-002` — remove referral system | `DONE` | PR claude/polutek-pl-proposals-qfkm9y: schema, model, user fields, patron referralId, use cases, services, tests |
| 3.2 | `INCOMPLETE-003` — Stripe disputes admin UI/manual sync | `DONE` | PR #1250: `POST /api/admin/payments/[id]/dispute-sync`, `adminDisputeSync` use case and admin UI action |
| 3.3 | `INCOMPLETE-005` — admin refund endpoint/UI | `DONE` | PR #1250: `POST /api/admin/payments/[id]/refund`, `adminRefund` use case and refund dialog UI |
| 3.4 | `INCOMPLETE-006` — Stripe reconciliation job | `DONE` | PR #1263 — Implemented Vercel cron reconciliation job in `app/api/cron/stripe-reconciliation`. |
| 4.1 | `CLEANUP-005` — SearchPage missing sizes in Image | `DONE` | PR claude/polutek-pl-proposals-qfkm9y: `app/search/page.tsx` dodano `sizes=` |
| 4.2 | `CLEANUP-006` — CoverImageUpload zbędne unoptimized | `DONE` | PR claude/polutek-pl-proposals-qfkm9y: `CoverImageUpload.tsx:189` usunięto `unoptimized` |
| 4.3 | `CLEANUP-001` — legacy service layer migration/removal | `PARTIAL` | PR #1263 migrated the highest-risk bridge files, but 2026-06-30 code recheck confirms `lib/services/**` is still an active compatibility layer used by runtime/tests. Next work must be targeted service-by-service, not a bulk delete. |
| 4 | `CLEANUP-002` — API error handling standardization | `DONE` | 53/63 route'ów już używało wzorca; pozostałe 10 to proxy/webhooki/diagnostyki — świadomie bez fromUseCaseResult |

## Current verified remainder — 2026-06-30

Po ponownej weryfikacji kodu 2026-06-30 stan krótkiej listy jest bardzo dobry: szybkie poprawki PR-A z audytu są zamknięte w kodzie (bounce/complaint suppression, copy typo, support email, canonical URLs, usunięte martwe komponenty i typed comment-report result).

Aktualny otwarty zakres wykonywalny z tej gałęzi audytu to tylko:

1. `CLEANUP-001` — dalsza, ostrożna migracja aktywnie używanego `lib/services/**`; katalog nie jest martwy i nie wolno usuwać go hurtowo.
2. Dependency cleanup — `artplayer` oraz `tw-animate-css` zostały usunięte, a `@base-ui/react`, `@react-email/render` i `sharp` zostają jako uzasadnione zależności produkcyjne/toolingowe.

`INCOMPLETE-003`, `INCOMPLETE-005` i `INCOMPLETE-006` nie są już remainderem. Public launch pozostaje osobnym `NO_GO`, dopóki operator/legal/evidence work nie zostanie domknięty.

## Roadmap progress tracker

### Setup / control-plane work

- [x] Point canonical ready queue at `REFACTORING-ROADMAP-2026-06-27` — commit `ef9f6a125a7899d350dd04ed7d474263281272e5`
- [x] Add mandatory post-work update rule for agents

### Critical bugs from roadmap

- [x] `BUG-001` — Redis failure fallback in playback-event recording — `DONE` (zweryfikowane w kodzie)
- [x] `BUG-002` — admin users export auth check before processing — `DONE` (zweryfikowane w kodzie)
- [x] `BUG-003` — admin comments routes return typed use-case errors, not hardcoded 500 — `DONE` (zweryfikowane w kodzie)
- [x] `BUG-004` — replace string-matching error classification in payment/admin routes — `DONE` (zweryfikowane w kodzie)
- [x] `BUG-005` — support custom Vercel Blob public host in thumbnail response service — `DONE` (zweryfikowane w kodzie)
- [x] `BUG-006` — stop persisting `/logo.png` fallback as real thumbnail data — `DONE` PR claude/polutek-pl-proposals-qfkm9y; later hardened by PR #1256
- [x] `BUG-007` — malformed JSON handling in admin routes — `DONE` PR claude/polutek-pl-proposals-qfkm9y

### Incomplete features from roadmap

- [x] `INCOMPLETE-001` — HELD_FOR_REVIEW implementation — `DONE` PR claude/polutek-pl-proposals-qfkm9y
- [x] `INCOMPLETE-002` — referral system removed — `DONE` PR claude/polutek-pl-proposals-qfkm9y
- [x] `INCOMPLETE-003` — Stripe disputes admin UI/manual sync — `DONE` PR #1250
- [x] `INCOMPLETE-004` — bounce/complaint email auto-suppression — `DONE` (zweryfikowane w kodzie)
- [x] `INCOMPLETE-005` — admin refund endpoint/UI — `DONE` PR #1250
- [x] `INCOMPLETE-006` — Stripe reconciliation job — `DONE` in PR #1263.
- [x] `INCOMPLETE-007` — remove dead `Actor.isPatron` — `DONE` PR claude/polutek-pl-proposals-qfkm9y
- [x] `INCOMPLETE-008` — unify loading state around VideoPlayer/PremiumWrapper — `DONE` (zweryfikowane w kodzie, świadoma implementacja)

### Cleanup from roadmap

- [ ] `CLEANUP-001` — legacy service layer migration/removal map execution — `PARTIAL`; code recheck confirms `lib/services/**` remains active and must be migrated in small slices.
- [x] `CLEANUP-002` — API error handling standardization — `DONE` (10 pozostałych route'ów to proxy/webhooki/diagnostyki, świadomie bez wzorca)
- [x] `CLEANUP-003` — user-visible typo cleanup — `DONE` (zweryfikowane w kodzie)
- [x] `CLEANUP-004` — hardcoded support email in components — `DONE` PR claude/polutek-pl-proposals-qfkm9y
- [x] `CLEANUP-005` — SearchPage missing sizes in Image — `DONE` PR claude/polutek-pl-proposals-qfkm9y
- [x] `CLEANUP-006` — CoverImageUpload zbędne unoptimized — `DONE` PR claude/polutek-pl-proposals-qfkm9y

## Working rules for this mode

- Do not invent a separate priority order: follow this file unless the owner explicitly changes it.
- P0 build/deploy failures override all product work.
- Keep changes small and reviewable. Prefer one product slice, bug, incomplete item, or cleanup item per PR.
- Each PR/commit should name the exact item it addresses where possible, for example `#1218`, `BUG-001`, or `THANK-YOU-ZONE-COPY`.
- Preserve `AGENTS.md` rules and existing control-plane guardrails.
- Public launch remains `NO_GO` unless a separate launch-certification ticket explicitly changes that.
- Before finishing, every agent must update this README with the status/evidence of the work just completed.

## Recently completed / HISTORICAL

- `#1259` — CLEANUP-001 partial: `user-access.service.ts` and `audit.service.ts` deleted; legacy bridge reduced to `email.service.ts` and `lib/services/user/profile.service.ts`.
- `#1258` — Clerk language update rate-limit guard, absolute icon URL and `EmailTemplate.name` migration fix.
- `#1257` — najs hand-drawn style applied to real homepage/channel surfaces after the experiment pass.
- `#1256` — thumbnail display now proxies through `/api/videos/[id]/thumbnail`; private blob URL stays backend-only.
- `#1250` — `INCOMPLETE-003` and `INCOMPLETE-005` completed: admin dispute sync and refund UI/API.
- `#1248` — preferred provider selection for video upload; admin chooses Cloudflare/Mux primary while R2 mirror pipeline keeps fallback.
- `#1263` — INCOMPLETE-006: Stripe reconciliation cron; CLEANUP-001: legacy services removal.
- `#1224` — CLEANUP-001 partial: `syncClerkAccess` migrated to `lib/modules/users`; payment/admin/script callers updated; CI green after follow-up test mock fixes.
- `REFACTORING-ROADMAP-2026-06-27` — historical technical audit baseline; no longer the only active product roadmap.
- `#1217` — duplicate scope merged into #1204 and closed.
- `LEGACY-ACCESS-POLICY-RETIREMENT-001` — DONE by PR #1075; legacy `AccessPolicy` and `comment-access` runtime surface removed, with architecture-boundary and Vitest guardrails added.
- `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` — DONE by PR #1008.
- `ADMIN-AUTH-ACTOR-CANONICALIZATION-001` — HISTORICAL implementation evidence; PR #922/#923/#929 path is no longer the current executable ticket and future reverification is tracked separately.
- `CI-SIGNAL-RECONCILIATION-002` — DONE: restored CI signal, reconciled escapes and hotspots.
- `SECURITY-DEPENDENCY-REMEDIATION-001` — HISTORICAL; implementation merged by PR #946, high audit findings reached zero, and this is not the current executable ticket.
- `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998.
- `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` — DONE by PR #994.
- `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001` — historical completed video-state contract work.
- `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` — historical completed provider-lifecycle work.
- `OWNER-LAUNCH-DECISIONS-001` — HISTORICAL; owner decisions are recorded, but runtime implementation, legal review, operator evidence, and X7 remain incomplete.
- `LAUNCH-CERTIFICATION-AFTER-CI-DEBT-CLOSURE-001` — HISTORICAL verifier task for #951; public launch remains `NO_GO` pending production evidence, legal review, remaining implementation requirements, and final owner certification.

## Non-executable owner/evidence review packs

- `LAUNCH-EMAIL-001` — `READY_FOR_OWNER_REVIEW` docs-only readiness pack; runtime implementation is `BLOCKED` and production evidence remains `PRODUCTION_EVIDENCE_REQUIRED`. It is not the current executable code ticket.
- `LAUNCH-LEGAL-001` — `READY_FOR_OWNER_REVIEW` docs-only legal/privacy/terms readiness pack; final legal publication remains `BLOCKED`, professional review is required, and it is not the current executable code ticket.

## Historical reports preserved

Historical reports remain linked from `docs/reports/reconciliation/README.md` and must stay preserved as historical evidence.
