# Ticket: CI-SIGNAL-RESTORATION-001 — Restore independent CI and guard signal

- **Ticket ID**: CI-SIGNAL-RESTORATION-001
- **Lane**: CI / Quality / Control Plane
- **Phase**: Emergency post-#929 repair
- **Type**: Fix / CI guard restoration
- **Status**: READY_FOR_BUILDER
- **Parallel Safety**: Unsafe; single-writer CI/guard work
- **Conflicts with**: Any ticket touching `.github/workflows/**`, `scripts/check-strict-escapes.ts`, quality guard scripts, package scripts, or CI topology
- **Can run with**: Documentation-only review that does not touch CI/guard files
- **Owner role**: Builder
- **Priority**: URGENT
- **Launch status**: NO_GO

Status: READY_FOR_BUILDER
Ticket ID: CI-SIGNAL-RESTORATION-001

## Goal
Restore trustworthy CI signal before any further runtime repair by making launch-critical checks independently visible, preventing one early failure from skipping unrelated checks, and introducing a controlled strict-escapes historical-baseline/no-new-debt mechanism without weakening product guards.

## Context and exact known CI evidence
The emergency reconciliation recorded PR #930 CI run 613 evidence:

```txt
quality: FAIL at strict-escapes
security: FAIL at npm audit high
integration-postgres: PASS
hotspots/typecheck/coverage/lint/build: SKIPPED
Vercel previews: READY, deployment evidence only
```

This means current CI does not provide a reliable full signal. Vercel READY must not be treated as test, quality, security, provider-runtime or launch evidence. Public launch remains NO_GO.

## Control-plane provenance
- Source reconciliation: `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`
- Current queue source checked: `docs/tickets/ready/README.md`
- Product-policy sources checked: `AGENTS.md`, `docs/governance/BOLEK-OPERATING-MODEL.md`, `docs/strategy/OWNER-DECISIONS.md`
- Risk IDs: `CI-001`, `CI-002`, `CI-003`, `CI-004`, `CI-005`, `CI-006`, `CI-007`, `CI-008`
- Launch status impact: this ticket may restore CI visibility only; it must not claim public-launch readiness without X7 evidence.

## Dependencies
- Must start from a reconciled queue where this file is the exactly one current executable ticket.
- Must inspect current workflow topology before editing.
- Must not depend on runtime/product changes.
- Must not resolve security vulnerabilities by upgrading dependencies in this ticket; dependency remediation is tracked by `SECURITY-DEPENDENCY-REMEDIATION-001`.

## Allowed Files
Future Builder scope is narrowly limited to:

```txt
.github/workflows/**
scripts/check-strict-escapes.ts
scripts/strict-escapes-baseline.* or equivalent focused checked-in strict-escapes baseline file, only if justified
package.json, only when adding or adjusting CI script aliases is necessary
focused tests for guard behavior, only if needed to prove strict-escapes baseline/no-new-debt behavior
this ticket/report file for Builder reporting, if the ticket explicitly permits a report update
```

## Forbidden Files
The future Builder must not change:

```txt
app/**
components/**
lib/** product/runtime behavior
prisma/**
package-lock.json
runtime configuration
schema/migrations
dependencies or dependency versions
README.md or global roadmap docs unless separately authorized by an Integrator ticket
```

## Forbidden Actions
- No product/runtime behavior changes.
- No dependency upgrades.
- No vulnerability suppression.
- No blanket `continue-on-error` that hides failures.
- No removal, disabling or weakening of quality guards.
- No incidental Next.js/framework major upgrade.
- No rewriting old runtime code merely to satisfy strict-escapes debt.
- No claim that full CI passed unless all required checks actually ran and passed.

## Required CI job/check topology
The future CI topology must expose these independently visible checks/jobs or clearly named steps whose statuses remain visible even when another unrelated check fails:

1. environment validation
2. Prisma validation/generation
3. strict escapes
4. hotspots
5. architecture boundaries
6. control-plane docs
7. typecheck
8. tests/coverage
9. lint
10. build
11. integration-postgres
12. npm audit/security

One failure must not prevent unrelated checks from executing. The implementation may use separate jobs, a matrix, or another explicit topology, but failure visibility must be preserved. If a dependency relationship is technically required, the PR report must justify it and prove unrelated checks still run.

## Exact strict-escapes historical-baseline/no-new-debt contract
- `scripts/check-strict-escapes.ts` must continue to detect unsafe escape usage.
- Existing historical violations may be recorded in a focused checked-in baseline only if the baseline entries are exact and reviewable.
- New or modified files must fail when they introduce new unapproved escape debt.
- Existing baseline entries must fail if the code changes such that the entry no longer matches the exact historical location/pattern.
- The guard must report: total baseline entries, matched historical entries, missing/stale baseline entries, and new unbaselined violations.
- The guard must not silently accept broad globs that mask future debt.
- The baseline file must include an explanation header, review rules, and a reference to `CI-SIGNAL-RESTORATION-001`.

## Rules for reviewing and updating the baseline
- A baseline entry may be added only for pre-existing debt observed before this ticket's implementation, not for new code.
- A baseline entry must identify the file, stable match text or equivalent exact matcher, and reason/classification.
- Removing debt must remove the corresponding baseline entry in the same PR.
- If a file is substantially edited, the Builder must reassess whether any baseline entries for that file are still historical or must be fixed.
- Reviewers must reject baseline broadening that hides new violations.
- The PR body must include the exact baseline count before and after the change.

## Required Implementation Steps
1. Inspect current CI workflows and script aliases to map which checks run, which are skipped after strict-escapes failure, and where architecture/control-plane guards are absent.
2. Design a minimal CI topology exposing all required checks independently.
3. Implement the topology without blanket `continue-on-error`; preserve failing status for failing checks.
4. Implement strict-escapes historical-baseline/no-new-debt behavior, or justify why no baseline file is needed.
5. Ensure architecture-boundaries and control-plane docs guards run in CI.
6. Ensure npm audit/security runs and records its exact current failure without suppressing vulnerabilities.
7. Add focused guard tests only if needed to prove baseline/no-new-debt behavior.
8. Run all validation commands below and capture exact results.
9. Produce a final report that states public launch remains NO_GO and no runtime product behavior changed.

## Validation Commands
```bash
node scripts/check-control-plane-docs.mjs
npm run quality:architecture-boundaries
npm run quality:hotspots
npm run typecheck
npm test -- --coverage
npm run lint
npm run build
npm audit --audit-level=high
npm run test:integration:postgres
npm run quality:strict-escapes
```

If package script names differ on current main, the Builder must first list the available scripts, use the repository's canonical equivalents, and document the substitution.

## Semantic preservation checklist
- [ ] Product identity invariants preserved.
- [ ] Payment/access/patron invariants preserved; no runtime access behavior changed.
- [ ] Playback safety invariants preserved; no video/runtime behavior changed.
- [ ] Comments visibility/write-boundary invariants preserved.
- [ ] Email/subscription consent invariants preserved.
- [ ] Admin/action/audit requirements preserved.
- [ ] Ticket does not declare public launch ready without X7 evidence.

## Definition of Done
- [ ] Required checks are independently visible in CI topology.
- [ ] strict-escapes has a documented historical-baseline/no-new-debt contract or documented proof no baseline is necessary.
- [ ] architecture-boundaries and control-plane docs guards are run in CI.
- [ ] npm audit/security result is visible without vulnerability suppression.
- [ ] One failing check does not prevent unrelated checks from executing.
- [ ] No runtime product behavior changed.
- [ ] No dependency upgrades or package-lock changes were made.
- [ ] Validation commands were run and exact results recorded.
- [ ] Public launch remains NO_GO.

## Stop Conditions
Stop and return `BLOCKED` if:

- Restoring CI visibility requires runtime/product changes.
- Restoring CI visibility requires dependency upgrades or lockfile changes.
- Required checks cannot be made independently visible without repository-owner decisions.
- strict-escapes debt cannot be safely baselined without masking new debt.
- The current queue no longer points to this ticket as the single executable ticket.

## Final Report Requirements
The Builder PR report must include:

- Summary and intent.
- Complete changed-file list.
- CI topology before/after.
- strict-escapes baseline count before/after and review rules.
- Exact validation command results.
- npm audit/security baseline result without suppression.
- Scope confirmation that runtime/schema/packages/dependencies were unchanged, except `package.json` script aliases if explicitly used.
- Risks and follow-ups, including `SECURITY-DEPENDENCY-REMEDIATION-001`.
- Public launch: NO_GO.
