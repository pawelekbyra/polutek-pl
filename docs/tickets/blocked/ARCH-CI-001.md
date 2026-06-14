# ARCH-CI-001 — Make architecture and critical integration validation mandatory in CI

Status: **CONFIRMED_GAP**
Ticket ID: ARCH-CI-001
Launch impact: **HIGH**

## Purpose
Harden CI workflows to ensure that architectural boundaries and critical integration tests (like PostgreSQL-backed idempotency) are never skipped and results are accurately reported.

## Requirements
- `quality` job must have production-like environment variables.
- `RUN_INTEGRATION_TESTS=true` must be set in appropriate jobs.
- Skipped tests must fail the build or be explicitly allowed via documented exception.
- `npm run quality:architecture-boundaries` must be mandatory.
- Coverage reports must be accurately collected and enforced.

## Acceptance Criteria
- CI fails if architecture boundaries are violated.
- CI fails if integration tests are skipped.
- Production environment contract is validated in CI.
