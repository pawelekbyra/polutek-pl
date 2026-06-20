# 2026-06-20 — Architecture launch-readiness audit

Status: AUDIT_FINDINGS_RECORDED
Launch status: NO_GO
Verdict: CLEANUP_REQUIRED_BEFORE_NEXT_NON_PAYMENTS_TICKET

## Context

This report records the important findings from the deep architecture/codebase audit performed after the video provider lifecycle, publication/hero/sidebar, and playback/access refactors.

The current executable ticket at the time of this report is `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001`. That ticket is already in progress and this report does not change its scope.

## Executive decision

Do not start a broad rewrite. The codebase is not structurally broken.

Do add a narrow follow-up ticket after the active payments work and before the next non-payments domain ticket:

- `CI-SIGNAL-RECONCILIATION-002`

The goal of that ticket is to restore trustworthy CI/test/control-plane signal and capture the remaining audit cleanup that does not belong inside payments.

## Architecturally solid areas

The audit identified these as solid and not candidates for broad rewrite:

- `checkVideoAccess` as the DB-backed playback access source of truth.
- `getActorFromAuth` / admin actor resolution as DB-authoritative identity handling.
- `PlaybackService.createPlaybackPlanWithContext` as correctly ordered playback planning: access before source resolution.
- refund handling: local payment ownership, CAS-style state changes, full-vs-partial grant handling.
- comment write access using the same video access decision.
- architecture-boundary and control-plane docs checks as real guard scripts, not cosmetic checks.

## Confirmed risks and owners

| Finding | Severity | Owner ticket | Action |
| --- | --- | --- | --- |
| CI/test signal gap: the audit found that the CI coverage command was scoped too narrowly and did not represent the full available test suite. | P0 process risk | `CI-SIGNAL-RECONCILIATION-002` | Make CI/test scripts represent the real suite or explicitly name narrow smoke checks. |
| `strict-escapes` baseline drift and current unbaselined type escapes. | P0 process risk / P2 code hygiene | `CI-SIGNAL-RECONCILIATION-002` | Fix straightforward cases or reconcile baseline with justifications. Do not weaken the guard. |
| `hotspots` failure around large admin video page. | P1 maintainability | `CI-SIGNAL-RECONCILIATION-002` | Extract components/helpers only; no runtime behavior changes. |
| MASTERPLAN CI risk register is stale/imprecise relative to actual guard wiring and current failures. | P1 control-plane risk | `CI-SIGNAL-RECONCILIATION-002` | Update risk register to distinguish wired guards, red guards, and missing/full-suite gaps. |
| Payments fulfillment trusts Stripe intent metadata user id without local payment-user cross-check. | P1 security/data correctness | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` | Already owned by active payments ticket. Do not duplicate here. |
| Payment request idempotency relies on weak local metadata lookup. | P1 financial correctness | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` | Already owned by active payments ticket. Do not duplicate here. |
| Dead legacy Stripe fulfillment/webhook service paths remain in code. | P2 footgun | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` or a later cleanup if not handled there | Delete only if zero production callers remain. |
| `getGatedMedia` contract can be misunderstood as a complete access gate. | P2 footgun | Completed playback ticket follow-up if not already fixed by PR #994; otherwise final cleanup | Ensure no future caller can misuse it as an authorization source. |
| Multiple admin auth wrapper idioms exist over the same DB-authoritative truth. | P2 reviewability | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` | Document or consolidate route-facing patterns where practical. |

## Required ordering

Because payments work is already the current executable ticket, do not insert another ticket before it.

After active payments hardening completes, the recommended order is:

1. `CI-SIGNAL-RECONCILIATION-002`
2. `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001`
3. remaining operator/legal/launch evidence work

## Non-goals for CI-SIGNAL-RECONCILIATION-002

- Do not change payment fulfillment logic.
- Do not change playback/access runtime behavior unless only updating docs that reference the completed playback work.
- Do not change admin authorization semantics.
- Do not add schema migrations.
- Do not claim public launch readiness.

## Launch status

Public launch remains `NO_GO`.
