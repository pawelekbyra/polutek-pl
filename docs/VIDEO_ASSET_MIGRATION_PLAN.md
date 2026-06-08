# VideoAsset Migration Plan

This document outlines the strategy for migrating from legacy `Video.videoUrl` to the `VideoAsset` model as the primary source of truth for video delivery.

## Context
Currently, the `Video` model has a legacy `videoUrl` field. The `VideoAsset` model was introduced to provide a more robust way to manage media, including multiple providers (R2, Vercel Blob, etc.), object keys, and metadata.

## Current State
- `Video.videoUrl` is used in most places for delivery.
- `PlaybackService` checks for `video.asset` but still relies on `video.videoUrl` as a fallback or primary check.
- Admin CRUD operations primarily update `videoUrl`.

## Migration Sequence

### 1. Backfill Phase
- Create a script to iterate over all `Video` records.
- For each record with a `videoUrl` but no `asset`, create a `VideoAsset` record.
- Identify the provider based on the URL (e.g., Vercel Blob vs external).

### 2. Admin Write Path Update
- Update the video management API (`app/api/admin/videos/[id]/route.ts`) to write to `VideoAsset` whenever a video URL is updated.
- Maintain `Video.videoUrl` for backward compatibility during the transition.

### 3. Playback Resolution Update
- Update `PlaybackService.createPlaybackPlan` to prioritize `video.asset`.
- Use `Video.videoUrl` only as a legacy fallback.

### 4. Delivery API Update
- Update `/api/media/[videoId]` to fetch the URL from the `VideoAsset`.

### 5. Deprecation Phase
- Mark `Video.videoUrl` as `@deprecated` in `schema.prisma`.
- Update all remaining read sites to use `video.asset.videoUrl` (if we add it to asset) or resolve it via the asset's provider and key.

### 6. Cleanup Phase
- Remove `Video.videoUrl` from the schema after ensuring all environments are migrated.

## Technical Considerations
- **Signed URLs**: `VideoAsset` should facilitate easier generation of presigned URLs (R2/S3).
- **HLS/DASH**: Future HLS/DASH support should be tied to `VideoAsset` properties.
- **Validation**: Ensure `VideoAsset` has required fields like `provider` and `objectKey` for internal storage.
