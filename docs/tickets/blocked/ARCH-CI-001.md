# ARCH-CI-001 — Make architecture and critical integration validation mandatory in CI

* **Status**: CONFIRMED_GAP
* **Ticket ID**: ARCH-CI-001
* **Role**: Builder
* **Launch impact**: HIGH

## Purpose
Harden CI workflows to ensure that architectural boundaries and critical integration tests are never skipped and results are accurately reported.

## Verified current behavior
`quality` job fails at environment validation. Subsequent steps like `typecheck`, `architecture-boundaries`, and `vitest` are skipped, leading to MERGED_UNVERIFIED code. `npm audit` failures are not strictly enforced.

## Root cause
CI workflow configuration allows fatal failures early without reporting on subsequent mandatory checks.

## Risk
Merging code that violates domain boundaries or fails critical concurrency invariants without knowing it.

## Dependencies
- `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`

## Owner decisions required
- Threshold for `npm audit` (High/Critical).

## Allowed paths
- `.github/workflows/**`
- `scripts/check-architecture.ts`

## Disallowed paths
- `lib/**`
- `app/**`

## Target behavior
CI fails if architecture boundaries are violated. Integration tests (PG) must run for relevant changes. Accurate reporting of passed/skipped/failed counts.

## Detailed acceptance criteria
1. `quality` job has valid production-like env stubs.
2. `npm run quality:architecture-boundaries` is mandatory.
3. `RUN_INTEGRATION_TESTS=true` set in CI for relevant jobs.
4. Skipped critical integration tests (e.g. idempotency) fail the build.
5. `npm audit --audit-level=high` is enforced.
6. CI reports the number of skipped tests explicitly.

## Required unit tests
- None.

## Required integration tests
- Verify CI failure when a boundary is violated (manual test).

## Required negative tests
- None.

## Migration impact
None.

## Security/privacy impact
Ensures security and quality gates are actually closed.

## Observability requirements
- CI summaries show exact test counts.

## Rollout/rollback requirements
- Workflow update.

## Non-goals
- Fixing runtime code.

## Required evidence
- Green CI run with all checks executed.

## Exit state
`IMPLEMENTED_VERIFIED`.
