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

| Priority | ID | Title | Status | Dependency | Launch Impact |
| --- | --- | --- | --- | --- | --- |
| P0 | `ARCH-ADMIN-AUTH-001` | Canonical admin authorization | `TICKET_DETAIL_PENDING` | None | **BLOCKER** |
| P0 | `ARCH-ACCESS-001` | Explicit AccessDecision contract | `TICKET_DETAIL_PENDING` | None | **BLOCKER** |
| P0 | `ARCH-PLAYBACK-001` | Strict PlaybackPlan union | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **BLOCKER** |
| P0 | `ARCH-PLAYBACK-002` | Remove READY + canPlay inconsistency | `TICKET_DETAIL_PENDING` | `ARCH-PLAYBACK-001` | **HIGH** |
| P0 | `ARCH-CACHE-001` | Sensitive response non-cacheable | `TICKET_DETAIL_PENDING` | None | **HIGH** |
| P0 | `ARCH-PATRON-001` | Audit successful grant creation | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **HIGH** |
| P0 | `ARCH-PATRON-002` | Suspend/reactivate lifecycle | `TICKET_DETAIL_PENDING` | `ARCH-PATRON-001` | **HIGH** |
| P0 | `ARCH-PATRON-003` | Refund revokes only linked grant | `TICKET_DETAIL_PENDING` | `ARCH-PATRON-001` | **HIGH** |
| P0 | `ARCH-CLERK-001` | Durable Clerk sync repair | `TICKET_DETAIL_PENDING` | None | **HIGH** |
| P0 | `ARCH-PAYMENT-001` | Explicit fulfillment eligibility | `TICKET_DETAIL_PENDING` | `ARCH-PATRON-001` | **HIGH** |
| P0 | `ARCH-LOG-001` | Log sanitization (Secrets/PII) | `TICKET_DETAIL_PENDING` | None | **HIGH** |
| P0 | `ARCH-E2E-001` | Denied playback regression tests | `TICKET_DETAIL_PENDING` | `ARCH-PLAYBACK-002` | **HIGH** |
| P0 | `ARCH-COMMENTS-001` | Canonical comments permission | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **MEDIUM** |
| P1 | `ARCH-DI-001` | Decide AppContext boundary | `OPEN` | None | **MEDIUM** |
| P1 | `ARCH-DI-002` | Migrate Access from direct Prisma | `OPEN` | `ARCH-DI-001` | **MEDIUM** |
| P1 | `ARCH-DI-003` | Inject Playback Provider | `OPEN` | `ARCH-DI-001` | **MEDIUM** |
| P1 | `ARCH-DI-004` | Inject Stripe dependencies | `OPEN` | `ARCH-DI-001` | **MEDIUM** |
| P1 | `ARCH-ADMIN-001` | Complete Access Diagnostics | `OPEN` | `ARCH-ACCESS-001` | **MEDIUM** |
| P1 | `ARCH-ADMIN-002` | Expose Admin Override source | `OPEN` | `ARCH-ACCESS-001` | **MEDIUM** |
| P1 | `ARCH-GUARD-001` | Forbidden auth-source rules | `OPEN` | `ARCH-CI-001` | **MEDIUM** |
| P1 | `ARCH-TEST-001` | Complete access/playback matrix | `OPEN` | All P0 repairs | **MEDIUM** |
| P1 | `ARCH-COVERAGE-001` | Critical-domain coverage reqs | `OPEN` | `ARCH-CI-001` | **MEDIUM** |
| P2 | `ARCH-LEGACY-001` | Remove PlaybackService dependency | `OPEN` | All P0 repairs | **LOW** |
| P2 | `ARCH-LEGACY-002` | Remove UserAccessService dep | `OPEN` | `ARCH-ACCESS-001` | **LOW** |
| P2 | `ARCH-LEGACY-003` | Replace ChannelLayout bridge | `OPEN` | `ARCH-DI-001` | **LOW** |
| P2 | `ARCH-LEGACY-004` | Move Admin Query Parser | `OPEN` | None | **LOW** |
| P2 | `ARCH-LEGACY-005` | Remove Email Service bridge | `OPEN` | All Email repairs | **LOW** |
| P2 | `ARCH-LEGACY-006` | Remove Storage Service bridge | `OPEN` | `ARCH-DI-003` | **LOW** |
| P2 | `ARCH-LEGACY-007` | Remove User Profile bridge | `OPEN` | None | **LOW** |
| P2 | `ARCH-GUARD-002` | AST/Dependency Graph enforcement | `OPEN` | `ARCH-CI-001` | **LOW** |
| P2 | `ARCH-DOCS-001` | Final architecture reconciliation | `OPEN` | All repairs | **LOW** |

## C. Other Blocked Tickets

| ID | Title | Status | Dependency | Launch Impact |
| --- | --- | --- | --- | --- |
| `LAUNCH-BLOCKED-001` | Legal/Privacy/Terms copy | `BLOCKED` | Legal Review | **BLOCKER** |
| `LAUNCH-BLOCKED-002` | Cloudflare cost/retention policy | `BLOCKED` | Operator | **HIGH** |
| `LAUNCH-EMAIL-002` | Secure unsubscribe/suppression | `OPEN` | Stage 1 | **BLOCKER** |
