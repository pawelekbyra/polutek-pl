# Ticket: X3-FIX-009-disable-legacy-private-playback-fallback

## Info
- **ID:** X3-FIX-009
- **Lane:** Video
- **Type:** Refactor/Safety
- **Goal:** Strictly disable direct legacy URL playback for private videos once the migration phase is over.
- **Parallel Safety:** No (Affects Playback Runtime)

## Context
X3-FIX-006 migration plan states that legacy storage is not a safe long-term solution for patron playback. This ticket implements the final "cutoff".

## Requirements
1.  **Modify `PlaybackService.createPlaybackPlanWithContext`:**
    -   If `tier` is `PATRON` and `asset.provider` is NOT `CLOUDFLARE_STREAM` (or Mux), return `status: NO_PRIMARY_ASSET` even if `videoUrl` is present.
    -   Exception: Allow legacy fallback only if a feature flag `ALLOW_LEGACY_PRIVATE_FALLBACK` is enabled.
2.  **Clean up `getGatedBlobResponse`:**
    -   Log a deprecation warning whenever a private blob is served.
3.  **Update Diagnostics:**
    -   Flag any video that is now "unplayable" due to this cutoff.

## Allowed Files
- `lib/services/playback/playback.service.ts`
- `lib/blob.ts`
- `lib/modules/video/application/get-admin-video-diagnostics.use-case.ts`
- `tests/unit/media-source-safety.test.ts`

## Forbidden Files
- `app/components/**`
- `lib/modules/comments/**`
