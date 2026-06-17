# ADMIN-AUTH-POSTMERGE-REVERIFY-001 — Current-main admin auth reverification

Status: NON_EXECUTABLE / PLANNED
Ticket ID: ADMIN-AUTH-POSTMERGE-REVERIFY-001
Role: Planned future Builder / Reviewer / Operator as applicable
Priority: URGENT
Launch status: NO_GO

## Explicit NON_EXECUTABLE statement
This is a non-executable backlog card. It must be expanded and reconciled into a full Builder/Reviewer/Operator ticket before activation. It is not the current executable ticket and must not be implemented from this file as-is.

## Purpose
Current-main admin auth reverification.

## Associated risk IDs
ADMIN-AUTH-REVERIFY

## Current evidence classification
REVERIFICATION_REQUIRED / PREVIOUS_POSTMERGE_PASS_INCOMPLETE. Evidence is documented in `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`; production/provider state is not certified by this card.

## Dependencies and ordering
Depends on: CI signal restoration and any playback access changes that affect auth paths. The canonical order remains in `docs/tickets/ready/README.md` and `docs/roadmap/Launch-Execution-Backlog.md`.

## Expected outcome
Reverify DB-authoritative roles, deleted-user denial, configured/revoked admins, all admin routes, modular playback, legacy playback and comment moderation.

## Allowed scope
Verification/report files and focused tests only; no new auth implementation unless expanded. A future activated ticket must list exact allowed paths before work starts.

## Forbidden scope
- No unrelated runtime changes.
- No schema, migration, package, dependency, workflow or guard edits unless the activated ticket explicitly allows them.
- No public-launch readiness claim.
- No production/provider PASS claim without required evidence.
- No weakening of AGENTS.md invariants.

## Minimum acceptance criteria
- Exact current-main evidence is rechecked before implementation or verification.
- All associated risk IDs are addressed or explicitly carried forward.
- Tests/evidence match the activated ticket scope.
- Public launch remains NO_GO unless a later X7 certification process says otherwise.

## Required future validation
The expanded ticket must define exact commands. At minimum it must include `node scripts/check-control-plane-docs.mjs`, `git diff --check`, scope verification with `git diff --name-only`, and focused tests/evidence appropriate to the risk IDs above.

## Stop conditions
Stop if the work requires owner/operator evidence not available, touches forbidden files, requires a schema/package/workflow change not authorized by the activated ticket, conflicts with another active ticket, or would weaken product-policy invariants.

## Expansion requirement before activation
Before this card becomes executable, an Integrator must expand it with exact allowed files, forbidden files, implementation/verification steps, validation commands, Definition of Done, and final report requirements.
