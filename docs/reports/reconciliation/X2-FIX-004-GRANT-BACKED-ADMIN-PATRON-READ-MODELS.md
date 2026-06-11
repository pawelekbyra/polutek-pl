# X2-FIX-004 — Grant-backed admin patron read models and diagnostics

## Summary

Admin user detail, list, export, and stats read models now separate patron access truth from denormalized `User` cache fields. The backend access truth displayed to admins is an active `PatronGrant` (`revokedAt: null`), while `User.isPatron`, `User.patronSince`, and `User.patronSource` remain visible only as cache/read-model data.

## Admin patron read-model inventory

| Surface | Previous patron source | X2-FIX-004 result |
| --- | --- | --- |
| `getAdminUserDetails` | Returned both `User.isPatron` and `patronGrants`, but did not compute a final grant-backed diagnostic status. | Adds `patronDiagnostics` with `truth`, `cache`, `cacheTruthMismatch`, and `finalPatronStatus` derived from active `PatronGrant`. |
| Admin user detail page | Patron badge and patron action state used `user.isPatron`. | Patron badge/action state now use `patronDiagnostics.truth.isPatron`; cache fields are shown in diagnostics. |
| `listAdminUsers` | Patron filter/source filter and row patron display were cache-backed. | Patron filters/source filters now query active `patronGrants`; DTO includes `patronTruth`, `patronCache`, and mismatch flag. |
| Admin users list page | Row patron status and action state used `user.isPatron`. | Row status/action state use `patronTruth.isPatron`; cache mismatch is labeled. |
| `exportAdminUsers` | Patron filter/source filter and exported fields were cache-backed. | Patron filters/source filters now query active `patronGrants`; export DTO includes truth/cache/mismatch fields. CSV column names remain stable for backward compatibility; the export DTO/report label legacy patron fields as cache and exposes grant-backed truth to adapters. |
| `getAdminUsersStats` | Patron count used `User.isPatron`. | Patron count is distinct users with active `PatronGrant`; response labels `patronCountSource`. |

## What changed

- Added a small admin read-model helper for patron cache, active-grant truth, and cache/truth mismatch diagnostics.
- Admin user detail now returns active-grant diagnostics and final patron status from `ACTIVE_PATRON_GRANT`.
- Admin user detail UI now renders patron status/actions from active grant truth and displays cache diagnostics.
- Admin user list and export filters for `isPatron` and `patronSource` now use active `PatronGrant` relation queries.
- Admin user list/export DTOs expose explicit cache and truth read models plus a mismatch flag.
- Admin user stats patron count now comes from distinct active grant user IDs.

## What intentionally remains cache-backed

- Legacy DTO fields `isPatron`, `patronSince`, and `patronSource` remain present for backward compatibility and diagnostics, but comments/types label them as cache/read-model data.
- Existing admin query parameter names (`isPatron`, `patronSource`) remain unchanged to avoid an API/UI refactor; their backend semantics now target active grants.
- Existing `orderBy=patronSince` remains a sort over the denormalized user cache field. A dedicated grant-backed sort would require a broader query refactor.

## Evidence that admin diagnostics/detail use PatronGrant as truth

- Detail DTO `patronDiagnostics.finalPatronStatus` is built from active grants only.
- Detail UI patron badge and `UserPatronActions` state use `patronDiagnostics.truth.isPatron`, not `User.isPatron`.
- Tests cover stale false cache with an active grant and stale true cache with no active grant.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries`
- `npm run typecheck`
- `npm test -- --run tests/unit/modules/users/get-admin-user-details.test.ts tests/unit/modules/users/list-admin-users.test.ts tests/unit/modules/users/export-admin-users.use-case.test.ts tests/unit/modules/users/get-admin-users-stats.test.ts`
- `npm test -- --run`

## Scope confirmation

Changed files are limited to allowed admin/users application use cases, relevant admin API/page adapters, related user unit tests, and this reconciliation report. No schema, migration, payment/refund lifecycle, access module, comments, video/player/provider, X3 ticket, roadmap, strategy, README, or AGENTS changes were made.

## Remaining risks

- Grant-backed list/export filters can be more expensive than cache-backed filters on large datasets; the existing `PatronGrant` indexes should help, but production query plans should be monitored.
- Grant-backed sorting by patron status/since is not fully implemented; `orderBy=patronSince` remains cache-backed.

## Follow-up tickets

1. Add an explicit admin query/sort contract for grant-backed patron fields (`activeGrantSince`, `activeGrantSource`, `activeGrantCount`) and deprecate cache-based `patronSince` sorting.
2. Add end-to-end/admin API tests for CSV headers and user detail diagnostics once the admin API test harness is available.
3. Consider a materialized/denormalized grant-backed admin read model if list/export performance becomes an issue.

## Ticket status

`MERGE` — X2-FIX-004 implemented with active `PatronGrant` truth in admin detail diagnostics, list/export filters, and stats; cache fields remain labeled and visible for mismatch diagnostics.
