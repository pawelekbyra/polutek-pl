# SECURITY-DEPENDENCY-REMEDIATION-001 — Security dependency remediation

Status: READY_FOR_BUILDER
Ticket ID: SECURITY-DEPENDENCY-REMEDIATION-001
Role: Builder
Priority: URGENT
Lane: Security / Dependencies / CI
Type: Fix / Dependency remediation with bounded compatibility migration
Launch: NO_GO
Parallel Safety: SERIAL_ONLY / UNSAFE_WITH_ANY_PACKAGE_JSON_OR_LOCKFILE_WORK

## Goal

Remove all currently visible high/critical npm audit findings using the smallest verified dependency upgrade, apply only the exact compatibility changes proven necessary by an isolated GitHub Actions simulation, and preserve product/runtime behavior without suppressing vulnerabilities or claiming launch readiness.

## Activation and scope-expansion evidence

This ticket was activated by the post-PR #931/#932 reconciliation after `CI-SIGNAL-RESTORATION-001` reached `MERGED / ACCEPTED / CI_VISIBILITY_RESTORED / HISTORICAL_BASELINE_ACTIVE`.

The first package-only execution correctly returned `BLOCKED_AUDIT_ENDPOINT_UNAVAILABLE` because its local npm audit endpoint returned `403 Forbidden` before package edits.

Bolek then obtained valid `npm audit --json` evidence in an isolated GitHub Actions diagnostic run and performed a non-merged compatibility simulation in temporary draft PR #934. PR #934 was closed without merge and its branch was reset to the `main` baseline after evidence collection. The simulation did not modify `main`.

Evidence classification:

- Audit baseline and candidate validation: `CI_LOG_EVIDENCE` / GitHub Actions run `27697718247` and simulation run `27698051613`.
- Required compatibility files: `CI_LOG_EVIDENCE` from TypeScript, lint, and build output.
- Candidate versions: `CI_LOG_EVIDENCE` from the generated package files and audit-after artifact.
- Temporary diagnostic PR #934: `HISTORICAL_GIT_EVIDENCE / MUST_NOT_MERGE / CLOSED_UNMERGED`.

## Verified audit baseline before remediation

| Field | Verified value |
| --- | --- |
| Severity counts | `info: 0`, `low: 1`, `moderate: 1`, `high: 12`, `critical: 0`, `total: 14` |
| Direct high packages | `next@14.2.35`, `@clerk/nextjs@5.x`, `eslint-config-next@14.2.3` |
| Clerk transitive high chain | `@clerk/nextjs` → `@clerk/backend`, `@clerk/clerk-react`, `@clerk/shared`, `js-cookie` |
| ESLint transitive high chain | `eslint-config-next` → `@next/eslint-plugin-next` → `glob`; `@typescript-eslint/parser` → `@typescript-eslint/typescript-estree` → `minimatch` |
| Next high threshold | The recorded Next advisories require at least `15.5.16`; the verified simulation resolved `next` to `15.5.19`. |
| Clerk fix | Audit reported `@clerk/nextjs@7.5.3`, semver-major. |
| ESLint config candidate | `eslint-config-next@15.5.16` removed the recorded high transitive findings in simulation. |
| Compatibility risk | Verified major migration: Next async request APIs and lint behavior changed; Clerk component, redirect-prop, and middleware auth APIs changed. |

## Verified candidate and audit-after result

The isolated package-only candidate used:

```txt
next: ^15.5.19
@clerk/nextjs: ^7.5.3
eslint-config-next: 15.5.16
```

Verified audit-after result:

```txt
info: 0
low: 1
moderate: 3
high: 0
critical: 0
total: 4
npm audit --audit-level=high: exit 0
```

Remaining non-high findings in the simulation were:

- low `esbuild` development-server finding with a fix available;
- moderate `postcss` under Next with no fix available in the simulated dependency graph;
- aggregate moderate entries for direct `next` and `@clerk/nextjs` caused by that transitive `postcss` finding.

This ticket must clear high/critical findings. It must report remaining low/moderate findings honestly and must not claim blanket `SECURITY_PASS` while they remain.

## Verified compatibility failures requiring scope expansion

The package-only simulation proved that the original two-file scope was insufficient:

1. `app/api/webhooks/clerk/route.ts`
   - Next 15 makes `headers()` asynchronous.
   - The three header reads around current lines 91-93 must use an awaited headers object without changing webhook verification semantics.
2. `lib/utils/correlation.ts`
   - Next 15 makes `headers()` asynchronous.
   - Correlation-ID lookup must await the headers object while preserving fallback behavior.
3. `app/components/Navbar.tsx`
   - Clerk 7 no longer exports `SignedIn` and `SignedOut` from the current import path.
   - The component already uses `useUser`; signed-in/signed-out rendering must be expressed from the supported Clerk 7 user/auth state without changing visible behavior.
   - `UserButton.afterSignOutUrl` is no longer accepted; use the supported Clerk 7 redirect contract verified from installed package types/documentation.
4. `middleware.ts`
   - Clerk 7 middleware callback auth no longer supports `(await auth()).protect()`.
   - Migrate the three protection branches to the supported `auth.protect()` contract while preserving the existing public-route, admin-route, comments-GET exception, request-ID, and CSP behavior.
5. `app/error.tsx`
   - Next 15 lint rejects the internal `/` navigation implemented with raw `<a>`.
   - Replace it with `next/link` while preserving styling and behavior.
6. `next-env.d.ts`
   - Next 15 regenerates this tracked file during build; the generated change is allowed only when produced by the verified Next upgrade.

The simulation also exposed an existing warning in `app/admin/videos/page.tsx` and existing failures in `tests/unit/config.test.ts` and `tests/unit/architecture/post-merge-state-reconciliation.test.ts`. They are outside this ticket and must not be changed here.

## Parallel safety

This ticket is `SERIAL_ONLY / UNSAFE_WITH_ANY_PACKAGE_JSON_OR_LOCKFILE_WORK`. While it is being executed, no other branch or agent may change:

- `package.json`;
- `package-lock.json`;
- dependency overrides;
- dependency installation state.

The Builder must confirm this condition before editing package files and in the final report.

## Required Builder preflight

1. Verify the current queue still points to this ticket as the exactly one current executable ticket.
2. Verify no other active branch/workstream is changing package files or dependency installation state.
3. Use Node `22.x` from `.nvmrc`.
4. Run `npm ci`.
5. Obtain a fresh valid `npm audit --json` report and compare it with the verified baseline above.
6. Stop with `BLOCKED_AUDIT_BASELINE_DRIFT` if the direct high packages or required fixed thresholds materially changed.
7. Only after steps 1-6 may implementation begin.

If the npm endpoint is unavailable locally but the verified baseline remains current, the Builder may implement on a branch and rely on the PR's GitHub Actions audit job for final audit-after evidence. It must classify local audit as `BLOCKED_ENVIRONMENT` and must not claim security completion until GitHub Actions confirms zero high/critical findings.

## Allowed files

Allowed files are exactly:

```txt
package.json
package-lock.json
next-env.d.ts
app/api/webhooks/clerk/route.ts
app/components/Navbar.tsx
app/error.tsx
lib/utils/correlation.ts
middleware.ts
```

No other file may be changed. If another runtime, configuration, test, workflow, documentation, or generated file is required, stop before editing it and return `BLOCKED_SCOPE_EXPANSION_REQUIRED` with the exact path and reason.

## Forbidden files and actions

The Builder must not:

- run or accept `npm audit fix --force`;
- suppress, ignore, silence, or downgrade findings;
- make unrelated refactors;
- change Prisma schema or migrations;
- change workflows;
- change strict-escapes, architecture, control-plane, or other guard files;
- change `app/admin/videos/page.tsx`;
- change `tests/unit/config.test.ts`;
- change `tests/unit/architecture/post-merge-state-reconciliation.test.ts`;
- fix hotspots or stale reconciliation tests in this ticket;
- migrate `next lint` to another lint command in this ticket;
- upgrade to Next 16 or Clerk beyond the bounded verified candidate without a new Integrator decision;
- claim `FULL_CI_PASS`, `PRODUCTION_CERTIFIED`, `LAUNCH_READY`, or blanket `SECURITY_PASS` while low/moderate findings remain;
- weaken `AGENTS.md` invariants.

## Implementation requirements

- Apply the bounded candidate versions proven by simulation:
  - `next` to `^15.5.19`;
  - `@clerk/nextjs` to `^7.5.3`;
  - `eslint-config-next` to exact `15.5.16`.
- Regenerate `package-lock.json` using npm under Node 22; do not hand-edit dependency trees.
- Apply only the compatibility changes listed in this ticket.
- Preserve all authentication, authorization, webhook verification, request-ID, CSP, navigation, and sign-out behavior.
- Treat the existing coverage failures as pre-existing and report them, not fix them.
- Preserve CI visibility restored by PR #931/#932.

## Validation commands

Run every command and classify it as `PASS`, `FAIL`, `BLOCKED_ENVIRONMENT`, or `NOT_APPLICABLE` with a concrete justification:

```bash
node --version
npm --version
npm ci
npm audit --json > /tmp/npm-audit-after.json
npm audit --audit-level=high
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

Additionally verify:

- the three Clerk webhook header reads still feed the same verification code;
- all protected middleware branches remain protected;
- public routes and the comments GET exception remain unchanged;
- navbar signed-in and signed-out branches remain functionally equivalent;
- sign-out returns to `/` using a supported Clerk 7 contract;
- `git diff --name-only` contains only exact allowed paths.

## Definition of Done

- [ ] Fresh audit baseline was obtained or local endpoint failure was explicitly classified and GitHub Actions supplied final evidence.
- [ ] All recorded high/critical findings are removed.
- [ ] `npm audit --audit-level=high` passes in GitHub Actions.
- [ ] Remaining low/moderate findings are listed without suppression.
- [ ] Typecheck passes after the bounded Next/Clerk compatibility migration.
- [ ] Lint and build pass after the exact `app/error.tsx` and compatibility changes.
- [ ] Strict escapes, architecture boundaries, control-plane docs, and integration-postgres pass.
- [ ] Existing coverage failures are reported and are not expanded or hidden.
- [ ] No workflow, Prisma, migration, hotspot, stale-test, or unrelated refactor work was performed.
- [ ] No file outside the exact allowed list changed.
- [ ] Parallel Safety was confirmed.
- [ ] Public launch remains `NO_GO`.

## Final report requirements

The Builder PR report must include:

- verdict `READY_FOR_INDEPENDENT_REVIEW` or an exact `BLOCKED_*` status;
- base and head SHA;
- Node/npm versions;
- Parallel Safety confirmation;
- audit before/after severity counts and direct/transitive paths;
- exact package versions before/after;
- compatibility changes per file;
- every validation command result;
- explicit classification of pre-existing coverage failures;
- exact changed-file list;
- non-claims;
- `Public launch remains NO_GO`.
