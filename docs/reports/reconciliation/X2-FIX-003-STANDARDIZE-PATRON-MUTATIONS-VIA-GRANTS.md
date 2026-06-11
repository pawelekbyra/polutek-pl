# X2-FIX-003 — Standardize Patron Mutations via Grants

## Summary

This ticket audited runtime writes and repair paths for `User.isPatron`, `patronSince`, and `patronSource` and kept the invariant that active `PatronGrant` is the backend access truth.

One small local runtime fix was made in the user profile merge path: when an identity/email conflict moves `PatronGrant` rows from an old user id to a canonical user id, the canonical user's denormalized patron cache is now rebuilt from active `PatronGrant` truth inside the same transaction.

## Intent

- Treat `User.isPatron`, `patronSince`, and `patronSource` as a denormalized cache/read model.
- Ensure patron status mutation paths either go through `grantPatron`, `revokePatron`, or an explicit active-`PatronGrant` recalculation.
- Avoid broad refactors, schema changes, payment lifecycle changes, comment changes, video/access changes, and roadmap/global-doc updates.

## Search terms used

The following searches were run against runtime code (`app`, `lib`) and unit tests as part of the audit:

- `isPatron`
- `patronSince`
- `patronSource`
- `User.isPatron`
- `user.update`
- `user.updateMany`
- `syncClerkAccess`
- `recalculateUserPatronStatus`
- `recalculatePatronStatus`

Representative command:

```bash
rg -n "isPatron|patronSince|patronSource|user\.update|user\.updateMany|syncClerkAccess|recalculateUserPatronStatus|recalculatePatronStatus" app lib
```

## Mutation-path inventory

| Path | Mutation/read surface | Classification | Notes |
| --- | --- | --- | --- |
| `lib/modules/patron/application/grant-patron.use-case.ts` | Sets `User.isPatron=true`, `patronSince`, `patronSource`; creates `PatronGrant`. | SAFE | Canonical grant path. It is the intended writer for positive patron cache state. |
| `lib/modules/patron/application/revoke-patron.use-case.ts` | Revokes active grants, then calls `recalculatePatronStatus`. | SAFE | Canonical revoke path. Cache is rebuilt after grant revocation. |
| `lib/modules/patron/application/recalculate-patron-status.use-case.ts` | Reads first active `PatronGrant`, then updates user patron fields. | CACHE_SYNC | Explicit PatronGrant-backed recalculation path. |
| `lib/modules/patron/infrastructure/patron.repository.ts` | `updateUserPatronFields` writes patron cache fields. | SAFE | Repository helper used by grant/recalculate use cases, not standalone access truth. |
| `lib/services/user-access.service.ts` | `recalculateUserPatronStatus` delegates to `recalculatePatronStatus`; `syncClerkAccess` writes Clerk metadata only. | CACHE_SYNC | Legacy bridge remains, but recalculation is grant-backed. Comments were clarified to avoid `User.isPatron` truth wording. |
| `lib/services/patron.service.ts` | Deprecated compatibility bridge delegates to `grantPatron` / `revokePatron`; sync helper delegates to Clerk metadata sync. | SAFE | Legacy facade, but runtime mutation goes through patron module use cases. |
| `app/api/admin/users/[userId]/patron/route.ts` | Admin grant/revoke route calls `grantPatron` / `revokePatron`, then syncs Clerk metadata. | SAFE | Manual action path uses canonical use cases. No direct `User.isPatron` write. |
| `lib/modules/payments/application/fulfill-payment.use-case.ts` | Successful payment calls `grantPatron` and returns data for Clerk sync. | SAFE | Payment fulfillment grants through the patron module. |
| `lib/services/payments/fulfillment.service.ts` | Legacy payment fulfillment calls `grantPatronStatus`, then `syncClerkAccess`. | SAFE | Deprecated bridge delegates to patron module. |
| `lib/modules/payments/application/handle-refund.use-case.ts` | Full refund uses targeted `revokePatron`; partial refund uses grant-backed recalc. | SAFE / CACHE_SYNC | Consistent with X1-FIX-005. |
| `lib/modules/payments/application/handle-dispute.use-case.ts` | Dispute paths recalculate patron status and sync Clerk metadata. | CACHE_SYNC | Cache is rebuilt via grant-backed recalculation. |
| `lib/services/payment.service.ts` | Legacy payment/refund/dispute service calls `grantPatronStatus` or `UserAccessService.recalculateUserPatronStatus`. | SAFE / CACHE_SYNC | Deprecated bridge remains; no direct cache mutation found in this ticket's scope. |
| `lib/modules/users/application/sync-user-from-webhook.use-case.ts` | Creates new users with `isPatron=false`; soft delete revokes grants and clears user patron cache. | LEGACY | Creation default is safe. Soft-delete clearing follows grant revocation, but should eventually use patron module revoke/recalc for audit consistency. |
| `lib/services/user/profile.service.ts` | Soft delete revokes grants and clears user patron cache. Identity merge moved `PatronGrant` rows. | CACHE_SYNC after fix / LEGACY | Merge path now recalculates canonical user cache from active grants after moving grants. Soft-delete remains a legacy cleanup path. |
| `lib/modules/users/application/claim-referral.use-case.ts` | Referral award uses `grantPatron`. | SAFE | Referral patron access goes through canonical grant use case. |
| `lib/modules/users/application/get-user-access-profile.use-case.ts` | Returns `User.isPatron` in a profile/read model. | LEGACY | Non-launch-critical read model. Not changed because this ticket targets mutations, and X2 access truth work already moved sensitive access checks. |
| `lib/modules/users/application/list-admin-users.use-case.ts` and `export-admin-users.use-case.ts` | Filters/exports by `isPatron` and `patronSource`. | LEGACY | Admin list/export uses cache fields as read-model filters; not backend access truth. Follow-up recommended for grant-backed admin filters/diagnostics. |
| `lib/modules/users/application/get-admin-users-stats.use-case.ts` | Counts users where `isPatron=true`. | LEGACY | Admin stats read model, not access control. Follow-up recommended. |
| `lib/api/app-context-factory.ts` / `lib/api/auth.ts` | Actor `isPatron` from DB or Clerk metadata. | LEGACY | Should not be used for paywall enforcement; existing comments in `lib/api/auth.ts` already warn this. Not a mutation path. |
| `lib/access/access-policy.ts` / `lib/access/comment-access.ts` | Legacy boolean access helpers. | UNKNOWN | Out of allowed runtime scope for this ticket and not touched; prior X2 tickets routed sensitive video/comment behavior through `checkVideoAccess`. |
| `lib/services/channel/channel-layout.service.ts`, `app/page.tsx`, `app/channel/[slug]/page.tsx`, `app/components/**` | UI display/gating props read `isPatron`. | LEGACY | Read surfaces only; outside this mutation-standardization ticket. |

## Runtime changes made

1. `lib/services/user/profile.service.ts`
   - After identity conflict reconciliation moves `PatronGrant` rows from the old user id to the canonical user id, the service now queries the canonical user's first active grant and updates `User.isPatron`, `patronSince`, and `patronSource` from that grant inside the same transaction.
   - This prevents the denormalized cache from staying stale after an identity merge.

2. `lib/services/user-access.service.ts`
   - Clarified comments so they no longer say access decisions should rely on `User.isPatron`.
   - Documented `syncClerkAccess` as Clerk metadata/cache sync that must receive grant-backed values.

3. `tests/unit/services/user-profile-cache-sync.test.ts`
   - Added a focused unit test proving identity merge cache reconciliation reads active `PatronGrant` truth before writing patron cache fields.

## Scope confirmation

Changed only files allowed by the ticket:

- `lib/services/user/profile.service.ts`
- `lib/services/user-access.service.ts`
- `tests/unit/services/user-profile-cache-sync.test.ts`
- `docs/reports/reconciliation/X2-FIX-003-STANDARDIZE-PATRON-MUTATIONS-VIA-GRANTS.md`

Did not touch forbidden paths, including:

- `tests/unit/architecture/post-merge-state-reconciliation.test.ts`
- `README.md`
- `AGENTS.md`
- `scripts/check-architecture.ts`
- `docs/roadmap/**`
- `docs/strategy/**`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `package.json`
- `package-lock.json`

## What did not change

- `User.isPatron` was not removed.
- `PatronGrant` schema was not changed.
- Payment/refund lifecycle was not changed.
- Comment behavior was not changed.
- `checkVideoAccess` was not changed.
- Clerk metadata semantics were not changed beyond clarifying cache-sync comments.
- No roadmap/global docs were changed.

## Validation results

- `git diff --check` — PASS
- `npm run quality:architecture-boundaries` — PASS
- `npm run typecheck` — PASS
- `npm test -- tests/unit/services/user-profile-cache-sync.test.ts --run` — PASS
- `npm test -- tests/unit/modules/patron --run` — PASS
- `npm test -- tests/unit/user-access.service.test.ts --run` — PASS
- `npm test -- --run` — FAIL due to pre-existing/out-of-scope `tests/unit/architecture/post-merge-state-reconciliation.test.ts` assertions against forbidden `README.md` / `scripts/check-architecture.ts` reconciliation text. This file is explicitly owned by parallel `STABILIZE-001` work and was not touched.

## Remaining risks

| Risk | Classification | Recommended handling |
| --- | --- | --- |
| User soft-delete paths clear patron cache directly after revoking grants. | LEGACY | Follow-up ticket should consolidate soft-delete grant revocation through the patron module or a dedicated account-deletion access cleanup use case. |
| Admin list/export/stats filters still use cached `User.isPatron` and `patronSource`. | LEGACY | Follow-up ticket should make admin diagnostics/filtering explicitly grant-backed or label these fields as cache/mismatch data. |
| Legacy boolean access helpers still exist outside this ticket's allowed scope. | UNKNOWN | Keep migrating sensitive access callers to `checkVideoAccess` / active grant truth; do not broaden this PR. |
| Clerk metadata sync accepts boolean inputs. | CACHE_SYNC risk | Keep callers constrained to grant/revoke/recalculate results; consider a later API shape that accepts a PatronStatusDto/recalc result instead of raw booleans. |

## Next recommended ticket

**X2-FIX-004 — Grant-backed admin patron read models and diagnostics**

Suggested scope:

- Inventory admin list/detail/export/stats uses of `User.isPatron`, `patronSince`, and `patronSource`.
- Convert feasible admin filters/counts to active `PatronGrant` queries.
- Where cache fields remain useful, label them explicitly as cache/mismatch diagnostics.
- Avoid touching video/comment/payments behavior.

## Ticket status

`MERGE`
