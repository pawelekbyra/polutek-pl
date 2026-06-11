# Reconciliation Report: X3-FIX-009 Disable Legacy Private Playback Fallback

## Summary
Implemented a narrow playback policy cutoff that prevents patron-only/private playback from using raw legacy `Video.videoUrl` or legacy object-storage assets as an active playback source unless the server-only emergency migration flag is explicitly enabled.

## Intent
Cloudflare Stream is the first active private video provider path. Legacy `videoUrl`, R2, S3, and Vercel Blob references may remain stored and visible to admins for migration/import, but they must not become the active playable private patron source by default.

## Legacy Fallback Path Identified
The current fallback path was:

1. `PlaybackService.createPlaybackPlanWithContext` loaded `video.asset` and `video.videoUrl` after access was allowed.
2. If there was no provider-backed ready asset, the service could continue to legacy `videoUrl` handling.
3. If a READY legacy storage asset (`R2`, `S3`, `VERCEL_BLOB`) existed, `StorageService.getPresignedUrl` could be called and then redacted to `/api/media/:videoId`.
4. `/api/media/:videoId` could be called directly and serve the legacy URL through `getGatedBlobResponse` after access checks.

This meant an allowed patron viewer could still reach legacy private playback through the migration bridge even though legacy storage is not the active safe private playback provider.

## Policy / Gate Implemented
Added a server-side `VideoPolicy` gate:

- Default behavior: patron/private playback requires a primary READY provider-backed asset (`CLOUDFLARE_STREAM` or design-compatible `MUX`).
- Server-only emergency override: `ALLOW_LEGACY_PRIVATE_FALLBACK=true` allows the old legacy fallback path for migration/rollback only.
- The flag is not `NEXT_PUBLIC_` and is not exposed to clients.
- No packages, schema changes, or migrations were added.

## Private Playback Behavior Before / After
Before:

- Patron-only videos with legacy `videoUrl` and no ready provider asset could produce a playable legacy `/api/media/:videoId` source after access was allowed.
- Patron-only READY legacy storage assets could request object-storage signing and then play through the media proxy.
- Direct `/api/media/:videoId` requests could still reach the legacy proxy for patron content after access was allowed.

After:

- Patron-only videos without a READY primary Cloudflare Stream/Mux asset return `NO_PRIMARY_ASSET` with no source, no token, no provider call, no player-ready plan, and no playback session.
- Patron-only READY legacy storage assets remain represented as migration data but do not trigger object-storage signing by default.
- Direct `/api/media/:videoId` requests are blocked with `NO_PRIMARY_ASSET` for patron/private legacy fallback when the provider-backed asset is not ready.
- Denied viewers still receive no source/token/provider call/session.

## Public / Free Behavior Confirmation
Public/free legacy playback remains unchanged. Public legacy URLs still resolve through the existing redacted `/api/media/:videoId` proxy behavior, and the existing YouTube/public source behavior remains intact.

## Admin Diagnostics / Migration Visibility
Admin diagnostics now explicitly flag patron videos that are unplayable under the cutoff because they do not have a READY active provider-backed asset. Existing migration diagnostics/import workflows remain intact and legacy URLs are preserved as migration sources.

## Tests Added / Updated
- Added playback tests for patron-only legacy `videoUrl` with no READY provider asset.
- Added playback tests for patron-only READY legacy object-storage assets to ensure no signing/provider call occurs by default.
- Added explicit coverage for the server-only emergency `ALLOW_LEGACY_PRIVATE_FALLBACK=true` path.
- Updated media proxy route tests to block direct private legacy fallback and preserve public legacy behavior.
- Updated admin diagnostics expectations for patron legacy cutoff visibility.

## Files Changed
- `lib/modules/video/domain/video.policy.ts`
- `lib/services/playback/playback.service.ts`
- `app/api/media/[...path]/route.ts`
- `lib/modules/video/application/get-admin-video-diagnostics.use-case.ts`
- `tests/unit/media-source-safety.test.ts`
- `tests/unit/api/media-proxy-route.test.ts`
- `tests/unit/modules/video/get-admin-video-details.test.ts`
- `docs/reports/reconciliation/X3-FIX-009-DISABLE-LEGACY-PRIVATE-PLAYBACK-FALLBACK.md`

## What Did Not Change
- No legacy URLs were deleted or cleared.
- No schema or migrations were added.
- No packages or dependencies were added.
- No payment, refund, PatronGrant, access-truth, user, or comment behavior was changed.
- No Mux implementation was added.
- No Cloudflare signed playback implementation was added.
- No broad player redesign was performed.
- No launch-ops docs were touched.

## Validation Results
- `git diff --check`: PASS.
- `npm run db:generate`: PASS.
- `npm run typecheck`: PASS.
- `npm run quality:architecture-boundaries`: PASS.
- `npx vitest tests/unit/media-source-safety.test.ts tests/unit/api/media-proxy-route.test.ts tests/unit/api/media-source-route.test.ts tests/unit/modules/video/get-admin-video-details.test.ts --run`: PASS.
- `npm test -- --run tests/unit/modules/video`: PASS.
- `npm run vercel-build`: WARNING / ENVIRONMENT BLOCKED. Prisma generation completed, but `next build` failed because this environment could not fetch Google Fonts (`Gluten`, `Inter`, `Outfit`, `Plus Jakarta Sans`, `Space Grotesk`) from `fonts.googleapis.com`.

## Remaining Risks
- The emergency `ALLOW_LEGACY_PRIVATE_FALLBACK=true` flag intentionally restores legacy private fallback and must remain off by default in production.
- Cloudflare Stream READY assets still expose only provider metadata because signed playback resolution remains a future ticket.
- Admins must continue migrating patron-only legacy content to Cloudflare Stream before it becomes playable under the default cutoff.

## Next Recommended Ticket
Implement the production Cloudflare Stream playback source/token resolution path behind the existing `PlaybackPlan` provider-gating contract so READY Cloudflare assets can become playable without reintroducing raw legacy URLs.

## Ticket Status
Implementation complete.

## Merge Recommendation
MERGE.
