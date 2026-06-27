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
| 0 | `BUILD-DEPLOY-HEALTH` — main musi się budować i deployować | `ACTIVE` | Ostatni znany build blocker naprawiony commit `24bf278dd3c05b038c6734c97395efd0243ac15f`; każdy nowy failed build ma pierwszeństwo. |
| 1 | `#1204` — pełny multi-source video: admin create/edit, provider switch i playback E2E | `ACTIVE` | #1204 jest kanonicznym issue po scaleniu #1217; zawiera Cloudflare/YouTube/Mux/R2/Vimeo, player E2E i source builder. |
| 2 | `VIDEO-PROVIDER-MUX-R2-VIMEO` — provider extensibility pod #1204 | `TODO_AFTER_1204_SLICE` | Projektować provider adaptery i playback plan, nie hardkodować providerów w playerze. |
| 3 | `#1218` — adminowalna domyślna miniatura filmów z cropperem | `TODO` | Issue #1218. Powiązane z `BUG-006`, ale jako feature globalnego fallbacku. |
| 4 | `#1219` — opcjonalne napisy PL/EN per film | `TODO` | Issue #1219. WebVTT `.vtt`, upload/edit/delete, access-controlled tracks. |
| 5 | `THANK-YOU-ZONE-COPY` — Strefa Fenju / Thank You Zone jako bonus w podziękowaniu | `WATCH` | Copy zmienione w `LanguageContext.tsx`; dalsze zmiany prawne/marketingowe muszą zachować ten kierunek. |
| 6 | `BUG-001` — Redis failure fallback in playback-event recording | `TODO` | Refactoring roadmap debt. |
| 7 | `BUG-002` — admin users export auth check before processing | `TODO` | Refactoring roadmap debt. |
| 8 | `BUG-003` — admin comments routes return typed use-case errors, not hardcoded 500 | `TODO` | Refactoring roadmap debt. |
| 9 | `BUG-004` — replace string-matching error classification in payment/admin routes | `TODO` | Refactoring roadmap debt. |
| 10 | `BUG-005` — support custom Vercel Blob public host in thumbnail response service | `TODO` | Refactoring roadmap debt; verify against current private Blob story before implementing. |
| 11 | `BUG-006` — stop persisting `/logo.png` fallback as real thumbnail data | `TODO` | Refactoring roadmap debt; coordinate with #1218. |
| 12 | `BUG-007` — malformed JSON handling in admin routes | `TODO` | Refactoring roadmap debt. |
| 13 | `INCOMPLETE-*` items from refactoring roadmap | `TODO_AFTER_BUGS_AND_ACTIVE_PRODUCT` | Do not start as a large batch. One item per PR. |
| 14 | `CLEANUP-*` items from refactoring roadmap | `TODO_AFTER_INCOMPLETE` | Do not start as a large batch. One item per PR. |
| 15 | `LAUNCH-OPERATOR-LEGAL` — public launch evidence, legal/privacy/cookies/support copy | `BLOCKED_OPERATOR_LEGAL` | Tracked in `docs/roadmap/Launch-Execution-Backlog.md`; public launch remains `NO_GO`. |

## Product roadmap progress tracker

### P0 — Build/deploy health

- [x] Fix TypeScript build blocker in `CoverImageUpload.tsx` — commit `24bf278dd3c05b038c6734c97395efd0243ac15f`.
- [ ] Keep main deployable; any failed Vercel build preempts normal product work.

### P1 — Video/media product core

- [ ] `#1204` — admin create flow can add multiple video sources before save.
- [ ] `#1204` — admin edit flow can add/remove/switch video sources.
- [ ] `#1204` — one-click primary switch only for READY/playable/tier-safe source.
- [ ] `#1204` — player/playback E2E for every enabled provider.
- [ ] `#1204` — Mux treated as strategic full VOD provider, not dead enum.
- [ ] `#1204` — R2 has an explicit security/playback decision.
- [ ] `#1204` — Vimeo planned as external embed provider with tier limits.

### P2 — Admin media UX

- [ ] `#1218` — global default video thumbnail controlled by admin.
- [ ] `#1218` — cropper 16:9 for global default thumbnail.
- [ ] `#1218` — fallback order: video thumbnail → provider thumbnail → global default → final code fallback.
- [ ] `#1219` — optional PL captions per video.
- [ ] `#1219` — optional EN captions per video.
- [ ] `#1219` — upload/change/delete captions in create/edit flow.
- [ ] `#1219` — validated WebVTT and access-controlled player tracks.

### Copy / positioning guardrails

- [x] Rename right playlist/support area to `STREFA FENJU` / `THANK YOU ZONE`.
- [x] Reframe support area as thank-you bonus, not paid content purchase.
- [ ] Keep legal/support copy aligned with this positioning in future changes.

### Critical bugs from refactoring roadmap

- [ ] `BUG-001` — Redis failure fallback in playback-event recording.
- [ ] `BUG-002` — admin users export auth check before processing.
- [ ] `BUG-003` — admin comments routes return typed use-case errors, not hardcoded 500.
- [ ] `BUG-004` — replace string-matching error classification in payment/admin routes.
- [ ] `BUG-005` — support custom Vercel Blob public host in thumbnail response service.
- [ ] `BUG-006` — stop persisting `/logo.png` fallback as real thumbnail data.
- [ ] `BUG-007` — malformed JSON handling in admin routes.

### Incomplete features from refactoring roadmap

- [ ] `INCOMPLETE-001` — HELD_FOR_REVIEW implementation decision/work.
- [ ] `INCOMPLETE-002` — referral system finish-or-remove decision/work.
- [ ] `INCOMPLETE-003` — Stripe disputes admin UI/manual sync.
- [ ] `INCOMPLETE-004` — bounce/complaint email auto-suppression.
- [ ] `INCOMPLETE-005` — admin refund endpoint/UI.
- [ ] `INCOMPLETE-006` — Stripe reconciliation job.
- [ ] `INCOMPLETE-007` — remove dead `Actor.isPatron`.
- [ ] `INCOMPLETE-008` — unify loading state around VideoPlayer/PremiumWrapper.

### Cleanup from refactoring roadmap

- [ ] `CLEANUP-001` — legacy service layer migration/removal map execution.
- [ ] `CLEANUP-002` — API error handling standardization.
- [ ] `CLEANUP-003` — user-visible typo cleanup.
- [ ] `CLEANUP-004` — hardcoded support email cleanup.
- [ ] `CLEANUP-005` — SearchPage image sizes.
- [ ] `CLEANUP-006` — CoverImageUpload image optimization review.

## Working rules for this mode

- Do not invent a separate priority order: follow this file unless the owner explicitly changes it.
- P0 build/deploy failures override all product work.
- Keep changes small and reviewable. Prefer one product slice, bug, incomplete item, or cleanup item per PR.
- Each PR/commit should name the exact item it addresses where possible, for example `#1218`, `BUG-001`, or `THANK-YOU-ZONE-COPY`.
- Preserve `AGENTS.md` rules and existing control-plane guardrails.
- Public launch remains `NO_GO` unless a separate launch-certification ticket explicitly changes that.
- Before finishing, every agent must update this README with the status/evidence of the work just completed.

## Recently completed / HISTORICAL

- `REFACTORING-ROADMAP-2026-06-27` — historical technical audit baseline; no longer the only active product roadmap.
- `#1217` — duplicate scope merged into #1204 and closed.
- `LEGACY-ACCESS-POLICY-RETIREMENT-001` — DONE by PR #1075; legacy `AccessPolicy` and `comment-access` runtime surface removed, with architecture-boundary and Vitest guardrails added.
- `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` — DONE by PR #1008.
- `ADMIN-AUTH-ACTOR-CANONICALIZATION-001` — HISTORICAL implementation evidence; PR #922/#923/#929 path is no longer the current executable ticket and future reverification is tracked separately.
- `CI-SIGNAL-RECONCILIATION-002` — DONE: restored CI signal, reconciled escapes and hotspots.
- `SECURITY-DEPENDENCY-REMEDIATION-001` — HISTORICAL; implementation merged by PR #946, high audit findings reached zero, and this is not the current executable ticket.
- `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998.
- `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` — DONE by PR #994.
- `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001`
- `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001`
- `OWNER-LAUNCH-DECISIONS-001` — HISTORICAL; owner decisions are recorded, but runtime implementation, legal review, operator evidence, and X7 remain incomplete.
- `LAUNCH-CERTIFICATION-AFTER-CI-DEBT-CLOSURE-001` — HISTORICAL verifier task for #951; public launch remains `NO_GO` pending production evidence, legal review, remaining implementation requirements, and final owner certification.

## Non-executable owner/evidence review packs

- `LAUNCH-EMAIL-001` — `READY_FOR_OWNER_REVIEW` docs-only readiness pack; runtime implementation is `BLOCKED` and production evidence remains `PRODUCTION_EVIDENCE_REQUIRED`. It is not the current executable code ticket.
- `LAUNCH-LEGAL-001` — `READY_FOR_OWNER_REVIEW` docs-only legal/privacy/terms readiness pack; final legal publication remains `BLOCKED`, professional review is required, and it is not the current executable code ticket.

## Historical reports preserved

Historical reports remain linked from `docs/reports/reconciliation/README.md` and must stay preserved as historical evidence.
