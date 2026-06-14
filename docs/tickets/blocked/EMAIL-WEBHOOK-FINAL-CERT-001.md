# EMAIL-WEBHOOK-FINAL-CERT-001 — Certify Resend webhook correctness after all repair tickets

* **Status**: BLOCKED
* **Ticket ID**: EMAIL-WEBHOOK-FINAL-CERT-001
* **Role**: Independent Certifier
* **Launch impact**: LAUNCH_BLOCKER

## Purpose
Final certification of the Resend webhook implementation. This is a read-only verification task after all repairs are completed.

## Verified current behavior
Current implementation (PR #905) is uncertified and has known gaps.

## Root cause
Premature merge without independent verification.

## Risk
Launching with broken idempotency or security gaps.

## Dependencies
- **ALL** `EMAIL-WEBHOOK-*` repair tickets.
- `ARCH-CI-001`.

## Owner decisions required
- Final launch approval.

## Allowed paths
- Read-only repository.
- `docs/reports/certification/**`

## Disallowed paths
- **NO** code modifications.

## Target behavior
Formal verification report certifying production readiness.

## Detailed acceptance criteria
1. All dependencies marked COMPLETED.
2. Full green CI (including architecture and integration).
3. Real PostgreSQL concurrency proof (no fencing violations).
4. Production Svix authenticity verified.
5. Error redaction verified in logs and DB.
6. Counter semantics verified against arrival permutations.
7. No unresolved launch-blocking gaps in the email domain.

## Required unit tests
- Review existing.

## Required integration tests
- Review existing.

## Required negative tests
- Review existing.

## Migration impact
None.

## Security/privacy impact
Ensures all requirements are met.

## Observability requirements
- Review logs/metrics.

## Rollout/rollback requirements
- None.

## Non-goals
- Fixing any remaining bugs (must be FIXED before certification).

## Required evidence
- Final certification report with an explicit Certifier verdict.

## Exit state
`MERGE_CERTIFIED`.
