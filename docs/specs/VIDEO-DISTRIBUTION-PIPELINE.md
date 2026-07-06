# Video Distribution Pipeline

Polutek video architecture is master-first and provider-neutral. Cloudflare Stream and Mux are peers: they are the first automatic file playback providers, not a permanent architectural assumption. R2 is the current original-storage implementation.

Originals are stored as versioned `VideoOriginal` records. Playback providers are materialized through `VideoDistributionPlan`, `VideoDistributionTarget` and `VideoProviderJob`; the active source used by public playback is `VideoPlaybackRoute`. `VideoAsset.isPrimary` remains legacy compatibility state derived from route activation.

## Implemented flow

1. Admin chooses a distribution strategy per video: Auto, Cloudflare Stream, Mux, Cloudflare + Mux, or Manual / advanced.
2. Upload writes the original to R2, marks that `VideoOriginal` ready, and sets `Video.activeOriginalId`.
3. The selected strategy creates only the requested targets and provider import jobs. Mux-only does not create Cloudflare work, Cloudflare-only does not create Mux work, and Manual creates no provider jobs.
4. Provider jobs generate fresh signed R2 import URLs per attempt. Signed source URLs are never returned in admin DTOs and are redacted from persisted errors.
5. Webhook events update asset/job/target state, then call the provider-neutral orchestrator. Webhooks never choose the active source directly.
6. The reconciler can repair missed webhooks by polling provider status through the adapter registry and invoking the orchestrator.
7. The orchestrator owns policy: FIRST_READY, PREFER_SELECTED, LOWEST_COST, MANUAL, and current BEST_HEALTH-as-FIRST_READY behavior.
8. Autopublish policies are evaluated after route/target readiness and use the existing admin publish use case.
9. Public playback checks access before resolving provider sources, prefers `Video.activePlaybackRouteId`, and only falls back to legacy primary assets during migration.

## Admin media state and UI

`GET /api/admin/videos/[id]/media` returns the full pipeline state for the admin UI:

- selected original/master state,
- active distribution plan,
- targets and latest jobs,
- active playback route,
- legacy asset fallback,
- summary state and warnings.

The default media tab uses product-level labels such as `Strategia źródeł`, `Oryginał zapisany`, `Tworzę źródło`, `Gotowe`, `Wymaga interwencji` and `Aktywne źródło`. Provider IDs stay in advanced technical flows, not the default UI.

## Operations

- `POST /api/admin/videos/[id]/distribution-plan` creates/replaces the active plan.
- `POST /api/admin/videos/[id]/provider-jobs/[jobId]/retry` retries a provider job and returns media state.
- `POST /api/admin/videos/[id]/reconcile` re-evaluates route policy for one video.
- `POST /api/admin/video-provider-jobs/reconcile` and `POST /api/cron/video-provider-jobs/reconcile` sync stale provider jobs.
- `POST /api/admin/videos/distribution-backfill` backfills legacy videos. It defaults to dry-run and does not enqueue provider jobs.

## Security invariants

Public playback must never resolve provider sources before access is allowed. Denied access returns no provider URLs and creates no playback session. Patron-only video requires private/signed provider playback; YouTube/Vimeo are blocked for patron-only content because embed-only providers cannot enforce Polutek patron access.

## Adding a future provider

Bunny.net/Bunny Stream is not implemented. A future provider should be added by:

1. adding a `StorageProvider` enum value such as `BUNNY_STREAM`,
2. adding provider capability metadata,
3. implementing a playback provider adapter,
4. optionally enabling it in strategy/admin UI configuration,
5. extending webhook mapping/reconciliation as needed.

The domain model should not need provider-specific tables for each playback vendor. New providers should fit `VideoDistributionTarget`, `VideoProviderJob`, `VideoAsset` and `VideoPlaybackRoute` unless they require a genuinely provider-neutral concept that is missing today.
