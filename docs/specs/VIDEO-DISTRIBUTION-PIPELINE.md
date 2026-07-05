# Video Distribution Pipeline

Polutek video architecture is master-first and provider-neutral.

Originals are stored as versioned `VideoOriginal` records in original storage, currently R2. A `Video` may point at an active original while retaining previous original/master versions for audit, retry and future replacement workflows.

Playback providers are materialized through `VideoDistributionPlan`, `VideoDistributionTarget` and `VideoProviderJob`:

- `VideoDistributionPlan` describes the desired distribution strategy for a video.
- `VideoDistributionTarget` describes a requested provider target such as Mux or Cloudflare Stream.
- `VideoProviderJob` describes work needed to create, attach, sync or delete provider-side playback assets.
- `VideoAsset` remains the real provider-side asset record.
- `VideoPlaybackRoute` is the single active playback source selected for playback.

Cloudflare Stream and Mux are the first implemented automatic playback providers, but the architecture is intentionally open to more providers such as Bunny Stream later. Provider decisions should be based on capability metadata rather than branches that assume only Cloudflare and Mux exist.

Webhook events update provider state, but distribution policy should be evaluated by orchestrator/reconciler in later phases. Phase 1/2 foundation code is read-only for media state and does not execute jobs, activate routes, or call providers.

Public playback must never resolve provider sources before access is allowed. Patron-only video requires private/signed provider playback and blocks YouTube/Vimeo because embed-only providers cannot enforce Polutek patron access.

## Admin media state

The admin media-state use case reads the new schema and returns a DTO that describes:

- selected original/master state,
- active distribution plan and target/job summaries,
- active playback route,
- legacy primary asset fallback,
- safe summary state for admin UI.

The read-only admin API endpoint is `GET /api/admin/videos/[id]/media`. It does not mutate state, start provider jobs, trigger webhooks, activate playback routes, return signed playback URLs, or call provider APIs.

## Adding a future provider

Bunny.net/Bunny Stream is not implemented yet. A future provider should be added by:

1. adding a `StorageProvider` enum value such as `BUNNY_STREAM`,
2. adding provider capability metadata in `video-provider-capabilities.ts`,
3. implementing a playback provider adapter,
4. optionally enabling it in strategy/admin UI configuration,
5. extending webhook handling and reconciliation as needed.

The domain model should not need provider-specific tables for each playback vendor. New providers should fit the existing `VideoDistributionTarget`, `VideoProviderJob`, `VideoAsset` and `VideoPlaybackRoute` model unless they require new genuinely provider-neutral concepts.

## Later phases

Later phases should implement provider job execution, original upload completion refactoring, admin UI, webhook refactoring, playback route activation, reconciler/orchestrator logic and cron scheduling. Those concerns are intentionally out of scope for this foundation layer.
