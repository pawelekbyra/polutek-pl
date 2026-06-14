# Blocked Ticket Index

Status: ACTIVE
Launch status: **NO_GO**

This index lists tickets that are currently blocked by upstream dependencies, owner decisions, or missing legal/operator evidence.

## Promotion Rule
Only the **Integrator** may promote a blocked ticket to the `ready/` queue after verifying all dependencies are met.

## A. Detailed Blocked Email Repair Tickets

| ID | Title | Status | Dependency | Launch Impact |
| --- | --- | --- | --- | --- |
| `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` | Add lease ownership and fencing | `CONFIRMED_GAP` | `POSTMERGE-VERIFY-001` | **BLOCKER** |
| `EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001` | Enforce event type integrity | `CONFIRMED_GAP` | `POSTMERGE-VERIFY-001` | **HIGH** |
| `EMAIL-WEBHOOK-ROUTE-SECURITY-001` | Harden route security (Svix) | `CONFIRMED_GAP` | `POSTMERGE-VERIFY-001` | **BLOCKER** |
| `EMAIL-WEBHOOK-ERROR-SAFETY-001` | Prevent error/secret disclosure | `CONFIRMED_GAP` | `POSTMERGE-VERIFY-001` | **HIGH** |
| `EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001` | Add event-specific validation | `CONFIRMED_GAP` | `POSTMERGE-VERIFY-001` | **HIGH** |
| `EMAIL-WEBHOOK-MIGRATION-VERIFY-001` | Verify migration (legacy rows) | `EVIDENCE_MISSING` | `POSTMERGE-VERIFY-001` | **HIGH** |
| `EMAIL-WEBHOOK-COUNTER-SEMANTICS-001` | Define broadcast counters | `DECISION_REQUIRED` | `POSTMERGE-VERIFY-001` | **MEDIUM** |
| `EMAIL-WEBHOOK-PRIVACY-RETENTION-001` | Minimize PII and retention | `PARTIAL` | `POSTMERGE-VERIFY-001` | **MEDIUM** |
| `ARCH-CI-001` | Mandatory CI architecture guard | `CONFIRMED_GAP` | None | **HIGH** |
| `EMAIL-WEBHOOK-FINAL-CERT-001` | Final email certification | `BLOCKED` | All above tickets | **BLOCKER** |

## B. Architecture Repair Backlog

These items represent the broader architectural program. Detailed ticket files will be created as they move toward the ready queue.

| ID | Title | Priority | Status | Dependency | Launch Impact |
| --- | --- | ---: | --- | --- | --- |
| `ARCH-ADMIN-AUTH-001` | Canonical admin authorization | P0 | `CONFIRMED_GAP` | None | **BLOCKER** |
| `ARCH-ACCESS-001` | Explicit AccessDecision contract | P0 | `CONFIRMED_GAP` | None | **BLOCKER** |
| `ARCH-PLAYBACK-001` | Strict PlaybackPlan union | P0 | `CONFIRMED_GAP` | `ARCH-ACCESS-001` | **BLOCKER** |
| `ARCH-PLAYBACK-002` | Remove READY + canPlay inconsistency | P0 | `CONFIRMED_GAP` | `ARCH-PLAYBACK-001` | **HIGH** |
| `ARCH-CACHE-001` | Sensitive response non-cacheable | P0 | `CONFIRMED_GAP` | None | **HIGH** |
| `ARCH-PATRON-001` | Audit successful grant creation | P0 | `CONFIRMED_GAP` | `ARCH-ACCESS-001` | **HIGH** |
| `ARCH-PATRON-002` | Suspend/reactivate lifecycle | P0 | `CONFIRMED_GAP` | `ARCH-PATRON-001` | **HIGH** |
| `ARCH-CLERK-001` | Durable Clerk sync repair | P0 | `CONFIRMED_GAP` | None | **HIGH** |
| `ARCH-PAYMENT-001` | Explicit fulfillment eligibility | P0 | `CONFIRMED_GAP` | `ARCH-PATRON-001` | **HIGH** |
| `ARCH-COMMENTS-001` | Canonical comments permission | P0 | `CONFIRMED_GAP` | `ARCH-ACCESS-001` | **MEDIUM** |
| `ARCH-DI-001` | AppContext/Dependency boundary | P1 | `OPEN` | None | **MEDIUM** |
| `ARCH-LOG-001` | Sanitization of provider/webhook logs | P0 | `CONFIRMED_GAP` | None | **HIGH** |
| `ARCH-LEGACY-*` | Legacy service retirement (1-7) | P2 | `OPEN` | None | **LOW** |
| `ARCH-DOCS-001` | Final architecture reconciliation | P2 | `OPEN` | All above | **LOW** |

## C. Other Blocked Tickets

| ID | Title | Status | Dependency | Launch Impact |
| --- | --- | --- | --- | --- |
| `LAUNCH-BLOCKED-001` | Legal/Privacy/Terms copy | `BLOCKED` | Legal Review | **BLOCKER** |
| `LAUNCH-BLOCKED-002` | Cloudflare cost/retention policy | `BLOCKED` | Operator | **HIGH** |
| `LAUNCH-EMAIL-002` | Secure unsubscribe/suppression | `OPEN` | Stage 1 | **BLOCKER** |
