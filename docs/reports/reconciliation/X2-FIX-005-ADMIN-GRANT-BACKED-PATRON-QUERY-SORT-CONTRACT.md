# X2-FIX-005 — Admin Grant-Backed Patron Query/Sort Contract

## Summary

Implemented an explicit admin patron query/sort contract for the users read model. Admin patron filters remain backed by active `PatronGrant` rows, list/export DTOs now expose grant-backed read fields directly, and legacy cache fields are labeled as `USER_PATRON_CACHE` diagnostics rather than access truth.

## Admin patron query/sort inventory

### Existing fields kept for compatibility

- `isPatron` — legacy `User.isPatron` cache field. It remains in list/export DTOs for compatibility and diagnostics only.
- `patronSince` — legacy `User.patronSince` cache field. It remains visible for compatibility and diagnostics only.
- `patronSource` — legacy `User.patronSource` cache field. It remains visible for compatibility and diagnostics only.
- `patronCache` — explicit cache/read-model diagnostic wrapper sourced from `USER_PATRON_CACHE`.
- `patronCacheTruthMismatch` — diagnostic boolean comparing cache `isPatron` against active-grant truth.
- `patronDiagnostics` — admin detail diagnostic model containing cache, active-grant truth, and mismatch details.

### Grant-backed fields now explicit

- `patronTruth.isPatron` — canonical patron/access truth for admin read DTOs.
- `patronTruth.activeGrantCount` — active grant count.
- `patronTruth.activeGrantSince` — first active `PatronGrant.createdAt`.
- `patronTruth.activeGrantSource` — first active `PatronGrant.source`.
- `activeGrantSince` — top-level list/export alias for the canonical first active grant date.
- `activeGrantSource` — top-level list/export alias for the canonical first active grant source.
- `activeGrantCount` — top-level list/export alias for active grant count.

## What changed

- Added `activeGrantSince` and `activeGrantSource` to the patron truth read model while preserving the older `firstActiveGrantAt`/`source` aliases.
- Added `ADMIN_PATRON_QUERY_SORT_CONTRACT` to document that patron status/source filters and patron-since sorting are active-grant backed.
- Changed `orderBy=patronSince` in `listAdminUsers` from cache-backed `User.patronSince` sorting to compatibility behavior that sorts by first active `PatronGrant.createdAt`.
- Added support for an explicit `orderBy=activeGrantSince` use-case-level sort alias.
- Added top-level grant-backed fields to admin list/export DTOs while preserving legacy cache fields.
- Updated the admin users page label so the existing `patronSince` URL parameter is presented as an active-grant sort in the UI.

## What remains cache-backed and why

The fields `isPatron`, `patronSince`, and `patronSource` remain present because existing admin URLs, CSV consumers, and route serializers expect them. They are now explicitly cache/read-model diagnostics. They are not used as admin patron filter truth, and `orderBy=patronSince` no longer delegates to `User.patronSince` sorting in the users use case.

CSV headers were intentionally left unchanged for compatibility. The export use-case DTO now exposes grant-backed fields for programmatic callers; adding CSV columns is a narrow follow-up because changing headers could break existing spreadsheet/import consumers.

## Compatibility notes

- Existing admin URLs using `orderBy=patronSince` continue to work.
- `orderBy=patronSince` now means: sort by first active `PatronGrant.createdAt` (`activeGrantSince`) with users lacking active grants placed last.
- The explicit use-case alias `orderBy=activeGrantSince` is supported, but the current admin query parser still only whitelists the legacy `patronSince` URL parameter. This keeps URL compatibility without changing shared parser files outside the ticket scope.
- Existing export CSV headers and legacy cache columns are preserved.

## Validation

- `git diff --check` — passed.
- `npm run quality:architecture-boundaries` — passed with existing allowlisted route-service warnings.
- `npm test -- --run tests/unit/modules/users/list-admin-users.test.ts tests/unit/modules/users/export-admin-users.use-case.test.ts tests/unit/admin-users-export.test.ts tests/unit/modules/users/get-admin-user-details.test.ts` — passed.
- `npm test -- --run` — passed.
- `npm run typecheck` — failed on pre-existing/parallel X3 video asset schema/client mismatch outside this ticket scope (`VideoAssetProcessingState`, `providerAssetId`, `providerPlaybackId`, `processingState`). No user-module type errors remained after the local fix.

## Remaining risks

- Grant-backed patron sorting is implemented in the use case after fetching matching users because Prisma does not provide a simple User order-by-min-related-PatronGrant-createdAt expression in the current code shape. This is acceptable for the admin cleanup contract but may need optimization if the user table grows substantially.
- The API parser does not yet whitelist `activeGrantSince`; external URLs should keep using compatible `orderBy=patronSince` until a parser/UI contract ticket adds a public alias.
- CSV route output remains header-compatible and does not emit new grant-backed columns yet.

## Next recommended ticket

Add a narrow admin export/API contract ticket to optionally expose grant-backed CSV columns (`ActiveGrantSince`, `ActiveGrantSource`, `ActiveGrantCount`, `PatronTruthIsPatron`) behind an additive compatibility plan, and update the shared admin query parser to whitelist `activeGrantSince` as a public alias if desired.

## Merge recommendation

MERGE
