# SECURITY-DEPENDENCY-REMEDIATION-001 — Security dependency remediation

Status: READY_FOR_BUILDER
Ticket ID: SECURITY-DEPENDENCY-REMEDIATION-001
Role: Builder
Priority: URGENT
Lane: Security / Dependencies / CI
Type: Fix / Dependency remediation
Launch: NO_GO
Parallel Safety: SERIAL_ONLY / UNSAFE_WITH_ANY_PACKAGE_JSON_OR_LOCKFILE_WORK

## Goal
Remediate the currently visible high npm audit/security failure without suppressing vulnerabilities, without broad runtime refactor, and without claiming launch readiness.

## Activation evidence
This ticket was activated by the post-PR #931/#932 reconciliation after `CI-SIGNAL-RESTORATION-001` reached `MERGED / ACCEPTED / CI_VISIBILITY_RESTORED / HISTORICAL_BASELINE_ACTIVE`.

Local pre-activation commands on 2026-06-17:

```bash
npm ci
npm audit --audit-level=high
npm audit --json > /tmp/npm-audit.json
```

Observed result:

- `npm ci`: completed, with environment warning that the repository requires Node `22.x` while the local runtime is Node `v24.15.0` / npm `11.4.2`.
- `npm audit --audit-level=high`: failed because the npm registry audit endpoint returned `403 Forbidden` for `POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`.
- `npm audit --json > /tmp/npm-audit.json`: produced an npm audit endpoint error JSON, not a vulnerability report, with `statusCode: 403` and `body: "Forbidden"`.

Because the local audit endpoint was unavailable, this activation ticket must not invent advisory details. The Builder must rerun npm audit in a network-enabled environment and record exact findings before changing dependencies.

## Current audit baseline

| Field | Current value |
| --- | --- |
| Findings by severity | Unknown from local pre-activation audit because npm audit endpoint returned 403. CI/security remains unresolved because previous CI evidence showed npm audit high failing and PR #931 restored visibility rather than remediation. |
| Direct packages implicated | Unknown until a successful `npm audit --json` report is obtained. |
| Transitive packages implicated | Unknown until a successful `npm audit --json` report is obtained. |
| Dependency paths | Unknown until a successful `npm audit --json` report is obtained. |
| Available fixed versions | Unknown until a successful `npm audit --json` report is obtained. |
| Major / non-major | Unknown until a successful `npm audit --json` report is obtained. |
| `fixAvailable` | Unknown until a successful `npm audit --json` report is obtained. |
| dependencies / devDependencies impact | Unknown until a successful `npm audit --json` report is obtained. |
| Compatibility risk | Must be assessed per successful audit result and package changelog/release notes. Do not assume compatibility. |

## Parallel safety
This ticket is `SERIAL_ONLY / UNSAFE_WITH_ANY_PACKAGE_JSON_OR_LOCKFILE_WORK`. While this ticket is being executed, no other branch or agent may change:

- `package.json`;
- `package-lock.json`;
- dependency overrides;
- dependency installation state.

The Builder must confirm this parallel-safety condition in the final report before editing package files.

## Required Builder preflight
1. Verify the current queue still points to this ticket as the exactly one current executable ticket.
2. Verify no other active branch/workstream is changing `package.json`, `package-lock.json`, dependency overrides, or dependency installation state.
3. Run `npm ci`.
4. Obtain valid advisory JSON with `npm audit --json > /tmp/npm-audit.json`.
5. Parse and record the baseline and exact findings: severity counts, package names, direct/transitive classification, dependency paths, fixed versions, major/non-major status, `fixAvailable`, dependency section impact, and compatibility risk.
6. Decide the minimal non-forced remediation strategy.
7. Only after steps 1-6 are complete may the Builder edit `package.json` or `package-lock.json`.
8. Run `npm audit --audit-level=high` as part of validation after remediation.
9. If npm audit still returns an endpoint/network error rather than advisory JSON, stop before package edits and return `BLOCKED_AUDIT_ENDPOINT_UNAVAILABLE` with the raw error summary.

The Builder must obtain valid advisory JSON before any change to `package.json` or `package-lock.json`. If the audit JSON does not contain vulnerability details, the Builder must not perform experimental dependency updates.

## Allowed files
Allowed files for the first execution of this ticket are exactly:

```txt
package.json
package-lock.json
```

No other files may be changed during the first execution of this ticket. If successful npm audit analysis shows that a safe update requires runtime, configuration, or test-file changes, the Builder must not expand scope independently. The Builder must stop before editing those files and return:

```txt
BLOCKED_SCOPE_EXPANSION_REQUIRED
```

The `BLOCKED` report must list every required file, the concrete API change, and the justification. An Integrator must then expand this ticket with exact paths before work continues.

## Forbidden files and actions
The Builder must not:

- run or accept `npm audit fix --force`;
- suppress, ignore, silence, or downgrade high/critical findings;
- make unrelated refactors;
- change Prisma schema or migrations;
- change workflows;
- change strict-escapes, architecture, control-plane, or other guard files;
- fix hotspots in this ticket;
- fix stale reconciliation tests in this ticket;
- claim `FULL_CI_PASS`, `SECURITY_PASS`, `PRODUCTION_CERTIFIED`, `LAUNCH_READY`, or public-launch readiness unless a later certification process proves it;
- weaken AGENTS.md invariants;
- broaden package ranges beyond what the remediation requires.

## Implementation requirements
- Prefer the smallest non-forced dependency update that remediates high/critical advisories.
- If the successful audit reports `fixAvailable` only through a semver-major update, assess compatibility and update exact tests/commands in the PR report.
- If no safe fix is available, document the package, advisory, dependency path, `fixAvailable` status, and proposed owner/reviewer decision.
- Keep runtime, configuration, and test changes out of this first execution. If they are required, return `BLOCKED_SCOPE_EXPANSION_REQUIRED` before editing them.
- Preserve CI visibility restored by PR #931/#932.

## Validation commands
The Builder must run every command below and classify each result as `PASS`, `FAIL`, `BLOCKED_ENVIRONMENT`, or `NOT_APPLICABLE` with a concrete justification. No command may be omitted without a recorded result.

```bash
npm ci
npm audit --audit-level=high
npm audit --json > /tmp/npm-audit.json
npm run quality:strict-escapes
npm run quality:architecture-boundaries
node scripts/check-control-plane-docs.mjs
npm run typecheck
npm test -- --coverage
npm run lint
npm run build
npm run test:integration:postgres
git diff --check
git diff --name-only
git status --short
```

## Definition of Done
- [ ] Successful audit JSON was obtained before any package-file edit and exact advisory details were recorded.
- [ ] High/critical npm audit findings are remediated or explicitly escalated with exact `fixAvailable` evidence.
- [ ] No vulnerability suppression was introduced.
- [ ] All independent CI jobs were run and their results were recorded.
- [ ] `quality:strict-escapes`, `quality:architecture-boundaries`, and control-plane docs were not weakened.
- [ ] `typecheck`, `tests/coverage`, `lint`, `build`, and `integration-postgres` have explicit recorded results.
- [ ] No workflow, Prisma, migration, hotspot, or stale reconciliation-test work was performed.
- [ ] No file outside `package.json` and `package-lock.json` was changed.
- [ ] If any other file was required, the result is `BLOCKED_SCOPE_EXPANSION_REQUIRED`, not partial implementation.
- [ ] Parallel Safety was confirmed in the Builder report.
- [ ] Required validation commands were run and reported honestly.
- [ ] Public launch remains `NO_GO`.

## Final report requirements
The Builder PR report must include summary, intent, changed files, Parallel Safety confirmation, exact audit baseline before/after, compatibility risk, validation command results for every required command, scope confirmation, non-claims, follow-ups, ticket status, and `Public launch: NO_GO`.
