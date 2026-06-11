# X3-FIX-001 — Cloudflare Stream VideoAsset Foundation

## Summary

Implemented the smallest schema and domain/repository foundation for Cloudflare Stream-capable `VideoAsset` records.

## Intent

Prepare X3 playback/upload follow-up tickets to model video assets by provider identity and provider processing state without implementing provider runtime behavior in this ticket.

## Schema changes

- Added `CLOUDFLARE_STREAM` to `StorageProvider` as the owner-approved first provider for new private video assets.
- Added `MUX` to `StorageProvider` for per-asset design compatibility only.
- Preserved `R2`, `S3`, and `VERCEL_BLOB` as legacy/migration-compatible provider values.
- Added `VideoAssetProcessingState` with `PENDING`, `UPLOADING`, `PROCESSING`, `READY`, and `FAILED`.
- Extended `VideoAsset` with:
  - `providerAssetId`
  - `providerPlaybackId`
  - `processingState`
  - `isPrimary`
  - `failureReason`
  - `providerSyncedAt`
  - `processingStartedAt`
  - `processingEndedAt`
- Kept the existing one-asset-per-video shape (`videoId @unique`) intact. `isPrimary` is an explicit marker for current/future primary asset semantics; the current runtime still has one current asset per video.
- Added indexes for processing-state and provider asset lookup.
- Added migration `20260611000000_cloudflare_stream_video_asset_foundation`.

## Domain/repository/DTO changes

- Added admin-safe `AdminVideoAssetDto` mapping for asset metadata/state.
- `toAdminVideoDto` now includes asset metadata when the caller has already loaded an asset relation.
- The asset DTO intentionally omits playback URLs, playback tokens, signed URLs, upload URLs, and provider calls.
- `VideoRepository.findByIdWithAsset` is typed to return `VideoAsset | null` metadata.

## Legacy compatibility notes

- Existing `Video.videoUrl` remains unchanged.
- Existing `VideoAsset.objectKey`, `bucket`, `mimeType`, and `sizeBytes` remain unchanged.
- Existing `R2`, `S3`, and `VERCEL_BLOB` provider values remain representable and default to `READY` through the migration.
- R2/S3/Vercel Blob remain legacy/migration paths only; this ticket does not promote them to active private patron playback providers.

## What did not change

- No Cloudflare upload runtime was implemented.
- No playback-provider calls were implemented.
- No signed playback token generation was implemented.
- No provider webhook handling was implemented.
- No admin upload/status UI was implemented.
- No access checks, payment/patron behavior, comments behavior, or newsletter behavior changed.
- No `Video.videoUrl` removal or legacy storage removal was performed.
- No package, architecture guard, roadmap, strategy, README, or AGENTS changes were made.

## Validation results

- `npx prisma validate` without env failed because `DATABASE_URL_UNPOOLED` is required by the repo schema.
- `DATABASE_URL='postgresql://user:pass@localhost:5432/db' DATABASE_URL_UNPOOLED='postgresql://user:pass@localhost:5432/db' npx prisma validate` passed.
- `DATABASE_URL='postgresql://user:pass@localhost:5432/db' DATABASE_URL_UNPOOLED='postgresql://user:pass@localhost:5432/db' npx prisma generate` passed.
- Additional validation commands are recorded in the PR/final report.

## Risks

- Existing production rows will receive `processingState = READY` and `isPrimary = true`, which preserves legacy behavior but does not certify that legacy object storage is secure private playback.
- `isPrimary` is intentionally redundant while `videoId` remains unique; follow-up multi-asset work may need a partial unique index or relation redesign if multiple assets per video are introduced.
- Provider sync timestamps are metadata only until later X3 runtime/provider tickets populate them.

## Follow-ups

- X3 playback planning should select only backend-approved primary/current assets before any provider call.
- X3 upload work should populate Cloudflare Stream `providerAssetId`, optional `providerPlaybackId`, processing state, and sync/debug timestamps.
- Provider webhook/sync work should update `processingState`, `failureReason`, and processing timestamps.

## Next recommended ticket

Proceed with the next X3 ticket that builds backend playback planning/access behavior on top of this foundation, while preserving the denied-access invariant: denied plans must not call providers, fetch streams/tokens, mount players, count playback/view events, or leak URLs/tokens.

## Merge recommendation

MERGE
