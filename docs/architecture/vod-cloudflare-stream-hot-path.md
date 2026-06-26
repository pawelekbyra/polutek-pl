# ADR: Cloudflare Stream VOD production hot path

Status: Accepted for #1106 slice 1  
Date: 2026-06-26  
Scope: architecture documentation and guard rails only

## Context

Issue #1106 is a larger VOD architecture epic. This ADR records the first narrow slice: the production playback hot path for Cloudflare Stream VOD. It does not certify the full #1106 epic and it does not change the database schema, upload lifecycle, webhook lifecycle, queue/event pipeline, or load-testing posture.

Polutek.pl is a single-creator VOD place. The production VOD architecture separates the application control plane from the media delivery plane so the Next.js application can make access decisions without becoming the server for video bytes.

## Decision

For production Cloudflare Stream VOD playback, Polutek/Next.js must not serve video bytes in the hot path.

Polutek/Next.js is the **control plane**:

- authenticate the actor;
- make backend access decisions;
- build the `PlaybackPlan`;
- resolve a signed Cloudflare Stream playback URL/token only after access is allowed;
- return safe metadata needed by the player;
- preserve comments, moderation, diagnostics, and analytics/session bookkeeping.

Cloudflare Stream/CDN is the **media plane**:

- deliver HLS/DASH manifests and video segments;
- serve video bytes from Cloudflare infrastructure;
- remain the default production delivery provider for READY Cloudflare VOD assets.

The default READY Cloudflare Stream path is therefore:

```txt
viewer -> Polutek page/API -> backend access allow -> PlaybackPlan READY
       -> signed Cloudflare manifest/source in plan
       -> player requests HLS/DASH/video bytes from Cloudflare Stream/CDN
```

It is not:

```txt
viewer -> Polutek /api/media -> Next.js reads/proxies video bytes -> viewer
```

## Repository-specific contract

### READY Cloudflare Stream assets

A READY primary `VideoAsset` with provider `CLOUDFLARE_STREAM` must produce a playback plan that prefers provider-backed playback over legacy delivery:

- `status: "READY"`;
- `canPlay: true` only after backend access allows playback;
- `source.provider: "CLOUDFLARE_STREAM"`;
- `source.kind: "cloudflare_stream"`;
- `source.playbackUrl` is a safe Cloudflare HLS/DASH manifest URL generated from the backend-resolved signed playback token/source;
- `source.embedUrl` may carry the Cloudflare iframe fallback for compatible contexts;
- `source.needsProxy: false`;
- `source.isSignedUrl: true` when signed Cloudflare playback is used;
- diagnostics record provider-backed resolution (`sourceMode: "PROVIDER_ASSET"`, provider resolution allowed/attempted after access allow).

The READY Cloudflare Stream playback plan must not use `/api/media/[...path]`, raw `Video.videoUrl`, S3/R2/Vercel Blob URLs, or other legacy direct URLs as its production playback source.

### Legacy and fallback paths

`/api/media/[...path]`, raw `Video.videoUrl`, R2/S3/Vercel Blob URLs, and direct video URLs are legacy, migration, development, or explicit fallback surfaces. They may remain in the codebase where needed for migration and compatibility, but they are not the default production media plane for READY Cloudflare Stream VOD assets.

For patron/private playback, R2/S3/Vercel Blob/direct URLs are not an active secure production fallback unless a future owner-approved architecture decision explicitly says so.

### Player-safe Cloudflare manifests

When the backend provides a safe Cloudflare HLS/DASH manifest for a Cloudflare Stream plan, the frontend player resolver must keep that manifest on the custom/player-safe path. It must not fall back to backend video proxy delivery or an unsafe raw legacy URL for Cloudflare Stream playback.

### Denied and not-ready plans

Denied, locked, missing-primary, processing, failed, or unavailable playback plans must not expose playable source data. They must not include playback URLs, tokens, sessions, provider secrets, raw media URLs, or session-sensitive source data. Provider calls for playback source resolution happen only after backend access allows playback and the asset is eligible for playback.

## Consequences

- The Next.js application remains responsible for authorization and playback orchestration, not video-byte serving.
- Cloudflare Stream/CDN remains the production media plane for Cloudflare VOD.
- Legacy direct/proxy paths can be documented and tested as non-default fallbacks instead of being removed in this slice.
- Tests must protect the control-plane/media-plane boundary without requiring live Cloudflare API calls.

## Explicitly out of scope for this PR

This #1106 slice does not implement or change:

- Prisma schema or migrations;
- Cloudflare upload lifecycle rewrites;
- Cloudflare webhook lifecycle implementation beyond existing behavior;
- queue, worker, or event-pipeline architecture;
- local signing key implementation;
- admin/upload video lifecycle rewrites;
- payment, PatronGrant, auth semantics, or unrelated CI baselines;
- load testing, CDN benchmarking, or production certification evidence.

## #1106 slice 2 follow-up: provider asset status contract

A stored `VideoAsset` is the backend/domain representation of provider media state. Playback selection must first inspect the persisted primary asset and only then decide whether a provider source can be resolved. The selector is intentionally storage-state-only: it does not call Cloudflare, sign URLs, create playback sessions, or inspect legacy `Video.videoUrl` fallback.

For a primary Cloudflare Stream asset:

- `READY` is the only state eligible for provider-backed playback resolution.
- `PENDING`, `UPLOADING`, and `PROCESSING` produce a non-playable processing plan.
- `FAILED` produces a non-playable unavailable plan with safe diagnostics only.
- Missing or non-primary assets produce `NO_PRIMARY_ASSET` rather than silently using raw legacy URLs.

## Admin diagnostics

Admin video DTOs may expose safe provider diagnostics: provider identity, provider asset/playback identifiers, processing status, primary flag, signed-playback requirement, failure reason, sync timestamps, and optional non-secret media metadata. Admin DTOs must not expose provider secrets, signed playback tokens, upload secrets, private signing keys, or viewer/session-specific playback source data.

Public playback DTOs remain separate. Denied or not-ready public playback plans must not leak provider identifiers, raw storage URLs, signed tokens, or playback sessions.

## Legacy URL fallback boundary

`Video.videoUrl`, `/api/media`, and R2/S3/Vercel Blob/direct URLs remain legacy, migration, development, or explicit fallback surfaces. A READY primary Cloudflare Stream asset must win over legacy `Video.videoUrl`, even if the legacy field is still populated during migration. Legacy fallback is allowed only after provider-asset handling has failed to find an eligible stored provider asset and the existing access/security rules allow that fallback.

## #1106 slice 3: Cloudflare asset sync lifecycle

This slice focuses on keeping the persisted `VideoAsset` state in sync with Cloudflare Stream via both administrative manual sync and automated webhooks.

### Centralized Status Mapping

Status mapping from Cloudflare Stream to Polutek's internal `VideoAssetProcessingState` is centralized in `lib/modules/video/domain/video-asset.constants.ts`. This ensures consistent behavior across webhooks and manual syncs:

- `pendingupload`, `downloading` -> `UPLOADING`
- `queued`, `processing` -> `PROCESSING`
- `ready` -> `READY`
- `error`, `failed` -> `FAILED`

### Idempotent Sync Lifecycle

The `handleCloudflareStreamWebhook` use case enforces strict state transition rules to ensure idempotency and prevent illegal regressions:

- Once an asset is `READY`, it cannot be moved back to any other state (e.g., by a delayed `processing` webhook).
- Webhooks update asset metadata including `sizeBytes`, `providerPlaybackId`, and `durationSeconds` (stored as formatted `duration` string on the `Video` model).
- When an asset becomes `READY`, it is automatically promoted to `isPrimary`, and other assets for the same video are demoted.

### Administrative Sync

The `syncCloudflareStatus` use case allows administrators to manually trigger a refresh of asset state. It:
- Calls the Cloudflare Stream API to fetch the latest metadata.
- Gracefully handles 404 errors by marking the local asset as `FAILED` (e.g., if deleted on Cloudflare).
- Reuses the same `handleCloudflareStreamWebhook` logic to ensure consistent metadata and status updates.

## Still remaining for later #1106 slices

This follow-up does not complete #1106. Remaining slices include Cloudflare direct-upload lifecycle hardening, local signed playback token service without a Cloudflare API call per viewer, public/private playback-plan cache split, event batching/queue/worker pipeline, and load-testing or production-readiness evidence.
