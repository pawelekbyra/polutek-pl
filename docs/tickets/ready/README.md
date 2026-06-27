# Ready Ticket Queue

Status: **ACTIVE_REFACTORING_ROADMAP_MODE**

Aktualnie realizujemy refaktoryzację według roadmapy:

- Source branch/file: `claude/beautiful-albattani-ajvwik:docs/REFACTORING-ROADMAP.md`
- Source URL: https://github.com/pawelekbyra/polutek-pl/blob/claude/beautiful-albattani-ajvwik/docs/REFACTORING-ROADMAP.md
- Roadmap title: `Polutek.pl — Refactoring Roadmap`
- Roadmap date: `2026-06-27` — pełny audyt 10 agentów równolegle

<!-- CONTROL_PLANE_CURRENT_TICKET_ID: REFACTORING-ROADMAP-2026-06-27 -->
<!-- CONTROL_PLANE_CURRENT_TICKET_FILE: docs/REFACTORING-ROADMAP.md -->

## Current Control-Plane Ticket

`REFACTORING-ROADMAP-2026-06-27` — realizować prace wynikające z `docs/REFACTORING-ROADMAP.md` z brancha `claude/beautiful-albattani-ajvwik`.

Każda nowa sesja pracy nad repo ma zacząć od przeczytania wskazanej roadmapy. Roadmapa jest aktualnym źródłem priorytetów refaktoryzacyjnych: krytyczne bugi, niedokończone funkcje, cleanup legacy warstw oraz standardy implementacyjne.

## Progress update rule — mandatory for every agent

Każdy agent po zakończeniu pracy **musi zaktualizować ten plik w tym samym PR/commicie**, zanim uzna pracę za skończoną.

Wymagane aktualizacje:

1. Zmień status itemu w tabeli `Queue` oraz checkbox w `Roadmap progress tracker`.
2. Dopisz PR/commit/evidence w kolumnie `Evidence`.
3. Jeśli item nie jest w pełni zrobiony, ustaw `PARTIAL` i dopisz co zostało.
4. Jeśli znaleziono blokadę, ustaw `BLOCKED` i dopisz konkretny powód.
5. Nie zostawiaj ukończonej pracy jako `TODO`.

Dozwolone statusy: `TODO`, `IN_PROGRESS`, `PARTIAL`, `BLOCKED`, `DONE`, `SKIPPED_BY_OWNER`.

## Queue

| Order | Ticket | Status | Evidence |
| ---: | --- | --- | --- |
| 1 | `REFACTORING-ROADMAP-2026-06-27` | `ACTIVE` | README pointer added in commit `ef9f6a125a7899d350dd04ed7d474263281272e5` |
| 1.1 | `BUG-001` — Redis failure fallback in playback-event recording | `TODO` | — |
| 1.2 | `BUG-002` — admin users export auth check before processing | `TODO` | — |
| 1.3 | `BUG-003` — admin comments routes return typed use-case errors, not hardcoded 500 | `TODO` | — |
| 1.4 | `BUG-004` — replace string-matching error classification in payment/admin routes | `TODO` | — |
| 1.5 | `BUG-005` — support custom Vercel Blob public host in thumbnail response service | `TODO` | — |
| 1.6 | `BUG-006` — stop persisting `/logo.png` fallback as real thumbnail data | `TODO` | — |
| 1.7 | `BUG-007` — malformed JSON handling in admin routes | `TODO` | — |
| 1.8 | `#1204` — complete multi-source video system (diagnostics, YouTube thumbnail, SEO, oEmbed, security tests) | `DONE` | PR claude/pr-1200-review-7ru1bo |
| 2 | `INCOMPLETE-*` items from roadmap | `TODO_AFTER_BUGS` | — |
| 3 | `CLEANUP-*` items from roadmap | `TODO_AFTER_INCOMPLETE` | — |

## Roadmap progress tracker

### Setup / control-plane work

- [x] Point canonical ready queue at `REFACTORING-ROADMAP-2026-06-27` — commit `ef9f6a125a7899d350dd04ed7d474263281272e5`
- [x] Add mandatory post-work update rule for agents — commit pending/current update

### Critical bugs from roadmap

- [ ] `BUG-001` — Redis failure fallback in playback-event recording
- [ ] `BUG-002` — admin users export auth check before processing
- [ ] `BUG-003` — admin comments routes return typed use-case errors, not hardcoded 500
- [ ] `BUG-004` — replace string-matching error classification in payment/admin routes
- [ ] `BUG-005` — support custom Vercel Blob public host in thumbnail response service
- [ ] `BUG-006` — stop persisting `/logo.png` fallback as real thumbnail data
- [ ] `BUG-007` — malformed JSON handling in admin routes

### Incomplete features from roadmap

- [ ] `INCOMPLETE-001` — HELD_FOR_REVIEW implementation decision/work
- [ ] `INCOMPLETE-002` — referral system finish-or-remove decision/work
- [ ] `INCOMPLETE-003` — Stripe disputes admin UI/manual sync
- [ ] `INCOMPLETE-004` — bounce/complaint email auto-suppression
- [ ] `INCOMPLETE-005` — admin refund endpoint/UI
- [ ] `INCOMPLETE-006` — Stripe reconciliation job
- [ ] `INCOMPLETE-007` — remove dead `Actor.isPatron`
- [ ] `INCOMPLETE-008` — unify loading state around VideoPlayer/PremiumWrapper

### Cleanup from roadmap

- [ ] `CLEANUP-001` — legacy service layer migration/removal map execution
- [ ] `CLEANUP-002` — API error handling standardization
- [ ] `CLEANUP-003` — user-visible typo cleanup

## Working rules for this mode

- Do not invent a separate priority order: follow the roadmap order unless the owner explicitly changes it.
- Keep changes small and reviewable. Prefer one bug/incomplete/cleanup item per PR.
- Each PR must name the exact roadmap item it addresses, for example `BUG-001`.
- Preserve `AGENTS.md` rules and existing control-plane guardrails.
- Public launch remains `NO_GO` unless a separate launch-certification ticket explicitly changes that.
- Before finishing, every agent must update this README with the status/evidence of the work just completed.

## Recently completed / HISTORICAL

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
- `LAUNCH-CERTIFICATION-AFTER-CI-DEBT-CLOSURE-001` — HISTORICAL verifier task for #951; public launch remains `NO_GO` pending #956/#1031 production evidence, legal review, remaining implementation requirements, and final owner certification.

## Non-executable owner/evidence review packs

- `LAUNCH-EMAIL-001` — `READY_FOR_OWNER_REVIEW` docs-only readiness pack; runtime implementation is `BLOCKED` and production evidence remains `PRODUCTION_EVIDENCE_REQUIRED`. It is not the current executable code ticket.
- `LAUNCH-LEGAL-001` — `READY_FOR_OWNER_REVIEW` docs-only legal/privacy/terms readiness pack; final legal publication remains `BLOCKED`, professional review is required, and it is not the current executable code ticket.

## Historical reports preserved

Historical reports remain linked from `docs/reports/reconciliation/README.md` and must stay preserved as historical evidence.
