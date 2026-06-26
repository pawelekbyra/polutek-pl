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
