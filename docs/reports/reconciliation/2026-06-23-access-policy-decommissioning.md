# 2026-06-23 — AccessPolicy decommissioning reconciliation

Status: CURRENT DOMAIN RECONCILIATION FOR ACCESSPOLICY DECOMMISSIONING
Launch status: NO_GO
Related PR: #1075
Related issue: #1036
Merge commit: 56597eb2d62ec0aa3bc3f5b465ef725773cf6d90

## Summary

PR #1075 removed the deprecated legacy `AccessPolicy` runtime surface and reconciled the permanent guardrails so future runtime code cannot silently reintroduce the old path.

This report is domain-specific evidence for AccessPolicy decommissioning. It does not certify production/provider readiness and does not change public launch status.

## What changed

Completed in PR #1075:

- deleted `lib/access/access-policy.ts`;
- deleted `lib/access/comment-access.ts`;
- removed legacy AccessPolicy-specific test files that tested the retired implementation;
- updated `PROJECT_CONTEXT.md` to point paywall work at canonical access policy in `lib/modules/access`;
- replaced the old allowlisted architecture check with `checkDecommissionedAccessPolicySurface()`;
- added `tests/unit/access-policy-decommissioning.test.ts` to assert the legacy files/imports/calls stay absent and `checkVideoAccess` does not use `User.isPatron` as the grant decision source.

## Current authoritative access path

The canonical runtime video access decision path is `lib/modules/access/checkVideoAccess`.

For patron-gated video access, active `PatronGrant` via `getPatronStatus` is the source of truth. `User.isPatron` and Clerk `publicMetadata.isPatron` must not be treated as backend access-control truth.

## Guardrails now in place

Permanent architecture boundary:

- `npm run quality:architecture-boundaries` scans runtime source for legacy references to:
  - `lib/access/access-policy`;
  - `lib/access/comment-access`;
  - `AccessPolicy.canViewVideo`;
  - `AccessPolicy.canComment`;
  - `AccessPolicy.canReactToVideo`;
  - `AccessPolicy.canReactToComment`;
  - `isPatronLikeUser`;
  - `getCommentAccessState`.

Vitest source-contract guardrail:

- `tests/unit/access-policy-decommissioning.test.ts` asserts the deleted legacy files stay deleted;
- it asserts source imports/calls do not return to the legacy surface;
- it checks `checkVideoAccess` continues to use `getPatronStatus` and does not grant patron access through a direct `user.isPatron` decision branch.

## Validation evidence

PR #1075 reported focused validation:

- `npm run lint`;
- `npm run typecheck`;
- `npm run quality:strict-escapes`;
- `npm run quality:architecture-boundaries`;
- `npx vitest tests/unit/access-source-of-truth.test.ts`;
- `npx vitest tests/unit/access-policy-decommissioning.test.ts`.

GitHub CI on the merged head also completed successfully for the broader pipeline, including build, lint, typecheck, coverage, integration-postgres, architecture boundaries, strict escapes, Prisma validation/generation and audit/security.

## What remains open

Issue #1036 remains open because it tracks broader patron-cache cleanup beyond this PR:

- Prisma legacy patron cache fields still need explicit schema comments or a cautious future rename/migration plan;
- Clerk `publicMetadata.isPatron` still needs final audit and documentation as display/cache-only metadata;
- standalone comments UI fallback should be hardened so access-impacting decisions come only from backend viewer state;
- regression tests should continue covering unsynchronized cache cases.

## Non-goals

- No Prisma migration was performed.
- No payment, admin, overlay, middleware or launch-doc certification work was included.
- No public-launch PASS claim is made.
- Public launch remains `NO_GO`.