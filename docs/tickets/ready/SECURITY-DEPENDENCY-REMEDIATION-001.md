# SECURITY-DEPENDENCY-REMEDIATION-001 — Security dependency remediation

Status: IMPLEMENTATION_MERGED / HIGH_AUDIT_FINDINGS_ZERO / HISTORICAL
Ticket ID: SECURITY-DEPENDENCY-REMEDIATION-001
Role: Builder / Historical
Priority: URGENT
Lane: Security / Dependencies / CI
Type: Historical fix / dependency remediation with bounded compatibility migration
Launch: NO_GO
Parallel Safety: HISTORICAL_ONLY / NOT_CURRENT_EXECUTABLE

## Current-state reconciliation

This ticket is no longer `READY_FOR_BUILDER` and must not be used as the current executable ticket.

The implementation was merged in PR #946. Later CI/security checks also passed during #953, and the current executable-ticket pointer is controlled only by `docs/tickets/ready/README.md`.

Current control-plane state:

```txt
Current executable source: docs/tickets/ready/README.md
Current executable ticket: NONE
Queue status: NO_ACTIVE_LARGE_CODE_TICKET
Security remediation: HISTORICAL
Public launch: NO_GO
```

## Historical goal

Remove the visible high/critical npm audit findings using the smallest verified dependency upgrade, apply only the exact compatibility changes proven necessary by GitHub Actions and vendor documentation, and preserve runtime/security behavior without vulnerability suppression or launch-readiness claims.

## Historical activation and evidence

This ticket was activated after PR #931/#932 restored independent CI visibility and the post-merge reconciliation selected security remediation as the sole executable ticket at that time.

Historical evidence recorded for this work:

- audit baseline run: `27697718247`;
- candidate simulation run: `27698051613`;
- implementation validation run: `27702668049` / CI run `637`;
- temporary diagnostic PR: `#934 — CLOSED / UNMERGED / MUST_NOT_MERGE`;
- implementation PR: `#946`;
- later CI/security confirmation during `#953`.

## Historical verified candidate

The implementation upgraded the dependency baseline to the verified Next/Clerk/ESLint line that removed high audit findings:

```txt
next: ^15.5.19
@clerk/nextjs: ^7.5.3
eslint-config-next: 15.5.16
```

The verified simulated audit-after and implementation CI result recorded:

```txt
info: 0
low: 1
moderate: 3
high: 0
critical: 0
total: 4
npm audit --audit-level=high: PASS
```

Remaining non-high findings must still be reported honestly. Do not claim blanket `SECURITY_PASS` while low/moderate findings remain.

## Historical scope summary

The original executable scope covered:

- Next 15 request API compatibility updates;
- Clerk 7 compatibility updates;
- generated Next 15 type/lint compatibility updates;
- package and lockfile remediation;
- preservation of webhook verification, authentication, authorization, BOLA protections, request IDs, CSP, public-route boundaries, navigation, and sign-out redirect behavior.

The original ticket explicitly forbade broadening into unrelated runtime work, workflow changes, Prisma/schema/migration changes, test rewrites, hotspot/coverage cleanup, or launch-readiness claims.

## Current non-executable rule

Do not resume, implement, or branch from this historical ticket as if it were active.

Any future dependency/security remediation must be created as a new current ticket and must include:

- a fresh audit baseline;
- exact allowed files;
- explicit dependency versions or constraints;
- validation commands;
- Definition of Done;
- updated control-plane pointer in `docs/tickets/ready/README.md` if it becomes the single current executable ticket.

## Current references

- Current executable queue: `docs/tickets/ready/README.md`.
- Historical ledger: `docs/tickets/HISTORICAL-LEDGER.md`.
- Current launch backlog: `docs/roadmap/Launch-Execution-Backlog.md`.

Public launch remains `NO_GO`.
