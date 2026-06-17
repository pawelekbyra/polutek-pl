# SECURITY-DEPENDENCY-REMEDIATION-001 — Security dependency remediation

Status: READY_FOR_BUILDER
Ticket ID: SECURITY-DEPENDENCY-REMEDIATION-001
Role: Builder
Priority: URGENT
Lane: Security / Dependencies / CI
Type: Fix / Dependency remediation
Launch: NO_GO

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

## Required Builder preflight
1. Verify the current queue still points to this ticket as the exactly one current executable ticket.
2. Run `npm ci`.
3. Run `npm audit --audit-level=high`.
4. Run `npm audit --json > /tmp/npm-audit.json`.
5. Parse the JSON and record exact severity counts, package names, direct/transitive classification, dependency paths, fixed versions, major/non-major status, `fixAvailable`, dependency section impact, and compatibility risk.
6. If npm audit still returns an endpoint/network error rather than advisory JSON, stop and return `BLOCKED_AUDIT_ENDPOINT_UNAVAILABLE` with the raw error summary.

## Allowed files
Default allowed files are limited to:

```txt
package.json
package-lock.json
```

Additional files may be touched only when a specific package API update requires compatibility changes. If required, the Builder must name each exact file before editing it in the PR report. Broad globs are forbidden. Candidate compatibility-test files must be exact paths discovered from the successful audit result and package usage search; do not use `app/**`, `lib/**`, `tests/**`, or similar broad scopes.

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
- Keep runtime changes out unless a named package API update requires an exact compatibility patch.
- Preserve CI visibility restored by PR #931/#932.

## Validation commands
At minimum run and report exact results:

```bash
npm ci
npm audit --audit-level=high
npm audit --json > /tmp/npm-audit.json
node scripts/check-control-plane-docs.mjs
git diff --check
git diff --name-only
```

Also run focused compatibility tests required by the actual updated package(s). The Builder must list exact commands after reviewing the successful audit result and package usage.

## Definition of Done
- [ ] Successful audit JSON was obtained and exact advisory details were recorded.
- [ ] High/critical npm audit findings are remediated or explicitly escalated with exact `fixAvailable` evidence.
- [ ] No vulnerability suppression was introduced.
- [ ] No workflow, Prisma, migration, hotspot, or stale reconciliation-test work was performed.
- [ ] Package changes are limited to the remediation scope.
- [ ] Required validation commands were run and reported honestly.
- [ ] Public launch remains `NO_GO`.

## Final report requirements
The Builder PR report must include summary, intent, changed files, exact audit baseline before/after, compatibility risk, validation command results, scope confirmation, non-claims, follow-ups, ticket status, and `Public launch: NO_GO`.
