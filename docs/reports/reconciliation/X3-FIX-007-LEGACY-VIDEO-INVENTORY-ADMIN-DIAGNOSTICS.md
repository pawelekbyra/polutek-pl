# Reconciliation Report: X3-FIX-007 Legacy Video Inventory Admin Diagnostics

## Summary
Enhanced the admin video management system with diagnostics and metadata specifically designed to identify videos requiring migration from legacy storage (S3, R2, Vercel Blob, direct URLs) to Cloudflare Stream. This provides the Human Owner with a clear inventory and filtering capabilities to plan the migration phase as defined in X3-FIX-006.

## Diagnostics Added
The `getAdminVideoDiagnostics` use case now identifies:
- **`LEGACY_STORAGE_SOURCE`**: Video relies on legacy `videoUrl` without a Cloudflare Stream asset.
- **`LEGACY_PROVIDER_ASSET`**: Video uses an asset provider marked as legacy (`R2`, `S3`, `VERCEL_BLOB`).
- **`INSECURE_PRIVATE_SOURCE`**: A `PATRON` video uses a direct storage URL (non-proxied), flagging a high-priority security risk.
- **`MISSING_SOURCE`**: Video has neither a legacy URL nor an asset.
- **Cloudflare Info**: Provides info/warning status for Cloudflare assets (`PROCESSING`, `FAILED`). Healthy `READY` state is recognized without creating diagnostic noise.

## Migration Status Model
Added `migrationStatus` to `AdminVideoDto` and `AdminVideoListItem`, calculated as:
- **`READY`**: Cloudflare Stream asset is in `READY` state.
- **`MIGRATION_REQUIRED`**: Using legacy providers or legacy `videoUrl`.
- **`MISSING_SOURCE`**: No usable source detected.
- **`PROCESSING`**: Cloudflare Stream asset is still being encoded.
- **`FAILED`**: Cloudflare Stream processing failed.

## Admin UI/Filter Behavior
- **Video Table**: Added visual badges for migration status (`MIGRACJA`, `BRAK`, `FAILED`, `PROCESSING`).
- **Video Filters**: Added a new "Migracja" dropdown filter to surface videos by their migration state.
- **Query Parser**: Updated `admin-query-parser.ts` to support the new `migrationStatus` parameter.
- **Repository**: Updated `VideoRepository` to include `asset` and handle complex migration-related filtering in `findAdminList`.
- **API Route**: Updated `app/api/admin/videos/route.ts` to pass the `migrationStatus` filter to the use case.

## Tests Added/Updated
- **`tests/unit/modules/video/get-admin-video-details.test.ts`**: Added tests for legacy source flagging, insecure private source detection, and missing source errors.
- **`tests/unit/modules/video/video-dto.test.ts`**: Added tests for the `migrationStatus` calculation logic.
- **`tests/unit/modules/video/video-repository-predicates.test.ts`**: Added tests for `findAdminList` filtering by `READY` and `MIGRATION_REQUIRED` states.

## What Did Not Change
- Playback runtime behavior remains untouched.
- Cloudflare import functionality is not yet implemented.
- Access policies were not changed.
- No changes to public-facing components.

## Validation Results
- `npm run db:generate`: PASSED
- `npm run typecheck`: PASSED
- `npm run quality:architecture-boundaries`: PASSED
- `npx vitest tests/unit/modules/video/`: 63 tests PASSED

## Remaining Risks
- The `INSECURE_PRIVATE_SOURCE` check relies on URL pattern matching in `MediaPolicy.isProbablyRawMediaUrl`, which may have false negatives for custom domains.
- The "Migration Required" filter in the repository uses an `OR` query that might be slow if the table grows extremely large without proper indexing on `videoUrl` (though `asset` is indexed).

## Next Recommended Ticket
**X3-FIX-008-cloudflare-import-attach-existing-legacy-video**: To allow admins to trigger imports directly from the legacy URLs surfaced by these diagnostics.

## Merge Recommendation
**MERGE** - The inventory capabilities are complete and verified, providing the necessary data for the migration phase.
