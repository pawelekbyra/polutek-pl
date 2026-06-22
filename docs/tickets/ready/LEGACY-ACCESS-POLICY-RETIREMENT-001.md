# LEGACY-ACCESS-POLICY-RETIREMENT-001 — Legacy AccessPolicy retirement

Status: DONE / HISTORICAL — IMPLEMENTED BY PR #1075
Ticket ID: LEGACY-ACCESS-POLICY-RETIREMENT-001
Role: Historical evidence / Reviewer reference
Priority: RESOLVED FOR LEGACY ACCESSPOLICY SURFACE
Launch status: NO_GO

## Current status after PR #1075

PR #1075 decommissioned the legacy runtime `AccessPolicy` surface:

- deleted `lib/access/access-policy.ts`;
- deleted `lib/access/comment-access.ts`;
- removed the obsolete `lib/services/content/video.service.ts` allowlist from `scripts/check-architecture.ts`;
- added `checkDecommissionedAccessPolicySurface()` to the permanent `npm run quality:architecture-boundaries` path;
- added `tests/unit/access-policy-decommissioning.test.ts` as source-contract coverage;
- preserved the canonical access source of truth in `lib/modules/access/checkVideoAccess`, where active `PatronGrant` / `getPatronStatus` drives patron access decisions.

The original non-executable backlog card is therefore resolved for its intended scope: retiring the deprecated `AccessPolicy` runtime surface so access truth is not split.

## Issue relationship

Issue #1036 remains open because it is broader than this ticket. It still tracks follow-up work around:

- documenting or eventually renaming Prisma legacy patron-cache fields;
- auditing Clerk `publicMetadata.isPatron` as display/cache-only metadata;
- hardening standalone comments UI fallback so access-impacting decisions come only from backend viewer state.

## Scope completed

Completed by PR #1075:

- runtime `AccessPolicy` imports/calls removed;
- `isPatronLikeUser` / `getCommentAccessState` legacy helper surface removed;
- runtime reintroduction blocked by architecture boundaries;
- tests assert the legacy files do not exist and `checkVideoAccess` does not use `User.isPatron` as the grant decision source.

## Historical non-goals that still apply

- No public-launch readiness claim.
- No production/provider PASS claim.
- No Prisma migration or schema rename was included in this ticket.
- Public launch remains `NO_GO` until the later launch evidence/certification process says otherwise.

## Validation reference

PR #1075 reported and CI confirmed the relevant validation paths, including:

- `npm run lint`;
- `npm run typecheck`;
- `npm run quality:strict-escapes`;
- `npm run quality:architecture-boundaries`;
- `tests/unit/access-policy-decommissioning.test.ts`;
- broader CI including build, coverage, integration-postgres, Prisma validation/generation, audit/security, and Vercel preview checks.

## Final note

Do not reactivate this file as a Builder prompt. New access/patron-cache cleanup should be tracked through issue #1036 or a new small ticket with exact allowed files and validation commands.