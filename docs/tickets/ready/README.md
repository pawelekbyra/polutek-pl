# Ready Ticket Queue

Status: **POST-REFACTOR PRODUCT MODE**

Po zakończonej stabilizacji nie ma aktywnego dużego ticketu kodowego.

<!-- CONTROL_PLANE_CURRENT_TICKET_ID: NONE -->
<!-- CONTROL_PLANE_CURRENT_TICKET_FILE: NONE -->

## Current Control-Plane Ticket

Brak aktywnego dużego ticketu kodowego. Nowe prace muszą być małe, jawnie opisane i zgodne z `AGENTS.md`.

## Queue

| Order | Ticket | Status |
| ---: | --- | --- |
| — | `NONE` | `NO_ACTIVE_LARGE_CODE_TICKET` |
| 1 | `CLEANUP-001-SCHEMA-TRUTH-LANGUAGE.md` | `DONE_IN_THIS_PR` |

## Recently completed / HISTORICAL

- `CLEANUP-001-SCHEMA-TRUTH-LANGUAGE` — DONE in this cleanup PR; corrected misleading schema comments so `Subscription` and `PATRON` tier language point to active `PatronGrant` truth, not legacy `User.isPatron` cache.
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
