# ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001 PR Report

Ticket: `docs/tickets/ready/ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001.md`
Launch status: `NO_GO`

## Summary

Implemented focused admin channel diagnostics and regression coverage for the existing DB-authoritative admin authorization model.

## Intent

Prove that privileged admin access remains based on local database role/account state, not Clerk metadata, and make admin channel failures stable and production-safe for operators.

## Changed files

- `app/api/admin/channel/route.ts`
- `app/admin/channel/page.tsx`
- `lib/modules/channel/application/get-admin-channel-settings.use-case.ts`
- `tests/unit/modules/channel/admin-channel.test.ts`
- `tests/unit/admin-channel-diagnostics-api.test.ts`
- `docs/reports/reconciliation/ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001.md`
- `scripts/strict-escapes-baseline.jsonc`

## Scope confirmation

Runtime/docs changes remain within the ticket allow-list. `scripts/strict-escapes-baseline.jsonc` was updated by explicit PR #1004 follow-up instruction to remove the stale `app/admin/channel/page.tsx` strict-escapes baseline entry after the underlying `any` cast was fixed. No payment, playback, Cloudflare lifecycle, Prisma schema, migrations, package files, workflows, global roadmap docs, or global control-plane docs were changed.

## Auth model confirmed

Admin server authorization remains DB-authoritative:

- Clerk `auth()` supplies identity only.
- `requireAdminActor` reads local `User.role` and `User.isDeleted`.
- DB `ADMIN` users and configured admin IDs are allowed only when the local user exists and is not deleted.
- Revoked DB users, deleted users, missing users, guests, and stale Clerk metadata/publicMetadata admin claims are denied.
- Clerk metadata/publicMetadata remains non-authoritative for server authorization.

## Route families covered

Regression coverage now covers representative route/wrapper families:

- Admin API routes using `requireAdminForApi`, including dashboard stats and admin channel.
- Admin app/page/session paths using `requireAdminSession` / `requireAdmin`.
- Context-factory routes using `createAppContextFromRequest`, including the admin users export pattern.
- Comment moderation/admin action use cases that require backend admin actor capability.
- Static route-family inventory for the accepted admin route wrapper patterns.

## Wrapper map / consolidation decision

No runtime wrapper consolidation was performed because the current wrappers already flow to DB-backed actor resolution and broad consolidation would increase ticket risk.

Accepted map:

- `requireAdminActor`: canonical DB-authoritative admin actor resolver.
- `requireAdminForApi`: API-facing wrapper returning stable `401` / `403` JSON before route-specific work.
- `requireAdminSession`: page/session compatibility wrapper backed by `requireAdminActor`.
- `createAppContextFromRequest`: route/use-case context factory backed by `getActorFromAuth`; defaults to requiring admin unless explicitly disabled.
- `verifyAdmin` / `isAdminRequest`: legacy boolean helpers, documented in code as not for production privileged admin routes/pages.

## Diagnostics added

- Added typed `AdminChannelSettingsDto` and `AdminChannelDiagnosticsDto` contracts.
- Added `getAdminChannelSettingsWithDiagnostics` for admin channel API consumers.
- Added safe diagnostic mapping for missing main channel, non-approved/non-primary channel state, schema mismatch, database connection errors, and fallback internal errors.
- Admin channel API now returns stable safe JSON error codes/messages and logs structured request context (`method`, `pathname`, request ID via scoped logger, admin user ID, diagnostic code) without returning raw database URLs or secrets in JSON.
- PR #1004 follow-up sanitized admin channel error logging further: the route logs only `diagnosticCode`, `errorName`, optional machine `errorCode`, method, pathname, and admin user ID. It no longer logs raw error objects or raw error messages for admin channel GET failures.

## Tests added/updated

- Added admin channel diagnostics API tests for success DTO shape, missing main channel, and database error redaction in JSON responses.
- Updated channel module tests for diagnostics DTO shape, missing settings record/schema-mismatch code, and safe diagnostic mapping.
- Removed the stale strict-escapes baseline entry for the fixed `app/admin/channel/page.tsx` explicit `any` cast.
- Re-ran existing admin auth, route-family, and comment moderation regression tests.

## Validation

- PASS: `git diff --check`
- PASS: `npm run lint`
- PASS: `npm test -- --run tests/unit/admin-access.test.ts tests/unit/admin-auth-actor-canonicalization.test.ts tests/unit/admin-route-authorization-static.test.ts tests/unit/post-merge-verification.test.ts tests/unit/modules/comments/admin-comment-use-cases.test.ts tests/unit/modules/channel/admin-channel.test.ts tests/unit/admin-channel-diagnostics-api.test.ts`
- PASS: `node scripts/check-control-plane-docs.mjs`
- WARN: `npm run quality:strict-escapes` confirms the fixed `app/admin/channel/page.tsx` baseline entry is gone, but still reports pre-existing/out-of-scope stale line-number drift for admin videos `as any` entries.
- WARN: `npm run typecheck` remains blocked by pre-existing, out-of-scope payment `requestId` Prisma type mismatches in `lib/modules/payments/infrastructure/payment.repository.ts` and `lib/services/payments/checkout.service.ts`.
- WARN: `npm run build` compiled successfully, then failed during type validation on the same pre-existing, out-of-scope payment `requestId` Prisma mismatch.
- WARN: PR base retarget and hosted CI rerun are GitHub-side operations; this local workspace has no configured Git remote output and no `gh` CLI available, so the code/docs follow-up is ready for retargeting PR #1004 to `main` and rerunning hosted CI outside this container.

## What did not change

- No broad admin UI redesign.
- No payment, patron grant, playback, video provider lifecycle, schema, migration, package, workflow, roadmap, or public launch status changes.
- No production/operator evidence was claimed.

## Risks and follow-ups

- `npm run typecheck` and `npm run build` are currently blocked by pre-existing payment `requestId` Prisma type mismatches outside this ticket scope.
- `npm run quality:strict-escapes` still reports out-of-scope admin video strict-escape baseline drift unrelated to the removed channel page entry.
- PR base retarget to `main` and hosted CI rerun still need to be completed in GitHub for PR #1004; this container cannot mutate PR base without remote/GitHub CLI access.
- Broader wrapper consolidation can be considered later as a separate low-risk refactor ticket if the owner wants fewer route-facing idioms.
- Public launch remains `NO_GO` until X7/operator evidence and remaining launch blockers are completed.

## Ticket status

Implementation complete for this builder task; ready for review. Public launch remains `NO_GO`.
