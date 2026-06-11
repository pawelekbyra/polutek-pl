# Ticket: X3-FIX-007-legacy-video-inventory-admin-diagnostics

## Info
- **ID:** X3-FIX-007
- **Lane:** Video
- **Type:** Feature/Admin
- **Goal:** Enhance admin diagnostics to identify and inventory videos relying on legacy storage.
- **Parallel Safety:** Yes

## Context
As defined in X3-FIX-006 migration plan, we need to identify videos that lack a primary Cloudflare Stream asset and rely on legacy `videoUrl` or legacy `VideoAsset` providers (R2/S3/Blob).

## Requirements
1.  **Update `getAdminVideoDiagnostics` use case:**
    -   Add `LEGACY_STORAGE_SOURCE` issue when a video has no `CLOUDFLARE_STREAM` asset but has a `videoUrl`.
    -   Add `LEGACY_PROVIDER_ASSET` issue when the asset provider is `R2`, `S3`, or `VERCEL_BLOB`.
    -   Flag `INSECURE_PRIVATE_SOURCE` if a `PATRON` video uses a legacy `videoUrl` that looks raw (non-proxied).
2.  **Expose migration metadata in `AdminVideoListItem`:**
    -   Include a `migrationStatus` field: `READY` (CF present), `MIGRATION_REQUIRED` (Legacy present), `MISSING_SOURCE`.
3.  **Update Admin Video List UI:**
    -   Add a "Migration" filter to show videos requiring attention.
    -   Show visual indicators for legacy sources in the video table.

## Allowed Files
- `lib/modules/video/application/get-admin-video-diagnostics.use-case.ts`
- `lib/modules/video/domain/video.dto.ts`
- `app/api/admin/videos/route.ts`
- `app/admin/videos/components/**`
- `tests/unit/modules/video/**`

## Forbidden Files
- `PlaybackService.ts` (Runtime)
- `prisma/schema.prisma`
