# CI-SIGNAL-RESTORATION-001

Status: READY_FOR_BUILDER
Ticket ID: CI-SIGNAL-RESTORATION-001
Role: Builder
Priority: URGENT
Launch status: NO_GO

## Purpose
Restore CI/guard signal before further runtime work.

## Required scope
- Run strict-escapes, hotspots, architecture boundaries, typecheck, tests/coverage, lint, build, integration-postgres, control-plane docs and security as independently visible checks/jobs.
- One failing check must not prevent unrelated checks from executing.
- Preserve failure visibility; do not hide failures with blanket continue-on-error.
- Implement a documented historical baseline/no-new-debt mechanism for strict escapes rather than deleting the guard or mass-changing code.
- Run the architecture guard in CI.
- Run the control-plane guard in CI.
- Record the exact npm-audit baseline without suppressing vulnerabilities.
- Create or preserve separate `SECURITY-DEPENDENCY-REMEDIATION-001` for actual dependency work.

## Forbidden
No product/runtime behavior changes. Do not upgrade to a new major framework version as an incidental CI fix.

