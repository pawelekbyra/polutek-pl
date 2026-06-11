# Reconciliation Report: X3-FIX-009 Disable Legacy Private Playback Fallback

## Summary
Implemented a narrow playback policy cutoff so patron-only playback no longer falls back to raw legacy `Video.videoUrl` or legacy storage assets when Cloudflare Stream / provider-backed playback is the required active path.

## Intent
Preserve legacy URLs as migration/import source material while preventing them from becoming active patron/private playback sources. Public/free legacy playback remains unchanged.

## Legacy Fallback Path Identified
The active fallback path was:

1. `PlaybackService.createPlaybackPlanWithContext` loaded `Video.videoUrl` and `Video.asset` after access passed.
2. If no READY provider-backed asset returned early, the service could continue to `videoUrl`.
3. For legacy `R2`, `S3`, or `VERCEL_BLOB` assets, the service could request a presigned storage URL and then wrap/redact it behind `/api/media/:videoId`.
4. `/api/media/:videoId` could independently serve `getGatedBlobResponse(...)` for the resolved legacy URL after access passed.

That meant a patron-allowed viewer could still reach legacy private media when the Cloudflare Stream provider path was not ready or absent.

## Policy / Gate Implemented
Added a server-only playback policy helper using `ALLOW_LEGACY_PRIVATE_FALLBACK`:

- Default: unset/anything other than `true` blocks patron-only legacy playback fallback.
- Emergency override: `ALLOW_LEGACY_PRIVATE_FALLBACK=true` permits legacy private fallback for rollback/migration emergencies.
- The flag is server-only and is not exposed through public DTOs or client env.

## Private Playback Behavior Before / After
### Before
- Patron-only video with `videoUrl` and no provider asset could produce a playable legacy/proxied source.
- Patron-only video with a READY legacy storage asset could request a presigned URL and emit a proxied legacy playback source.
- The legacy `/api/media/:videoId` route could serve patron-only legacy media after access passed.

### After
- Patron-only video with no READY provider-backed asset returns `NO_PRIMARY_ASSET`, no source, no player controls, no playback session, and no storage provider call.
- Patron-only READY legacy storage assets are treated as migration material only unless the emergency flag is explicitly enabled.
- Cloudflare `PROCESSING` / `FAILED` / not-ready states remain non-playable and do not fall back to legacy URLs.
- The legacy media proxy blocks patron-only legacy media by default so raw/private legacy storage is not an active private playback path.

## Public / Free Behavior Confirmation
Public/free legacy playback remains unchanged. Public videos with allowed legacy raw URLs still receive the existing proxied `/api/media/:videoId` playback behavior. Public YouTube/Vimeo URLs remain unchanged.

## Admin Diagnostics / Import Behavior
Admin diagnostics now flag patron videos that are unplayable because they lack a ready Cloudflare Stream/Mux asset while legacy fallback is disabled. Existing legacy migration visibility remains in place, and the Cloudflare import-by-URL workflow remains available because legacy URLs are still preserved as migration source data.

## Tests Added / Updated
- Added playback service coverage for patron-only `videoUrl` with no provider asset returning no source/session/provider call.
- Added playback service coverage for patron-only READY legacy storage asset returning no source and not requesting a presigned URL.
- Kept processing/failed Cloudflare negative coverage proving no legacy fallback.
- Added media proxy route coverage proving patron-only legacy proxy requests do not call `getGatedBlobResponse`.
- Added admin diagnostics coverage for the new unplayable-private-fallback cutoff.
- Existing public/free legacy playback tests continue to assert unchanged behavior.

## Files Changed
- `lib/services/playback/legacy-private-fallback.policy.ts`
- `lib/services/playback/playback.service.ts`
- `app/api/media/[...path]/route.ts`
- `lib/modules/video/application/get-admin-video-diagnostics.use-case.ts`
- `tests/unit/media-source-safety.test.ts`
- `tests/unit/api/media-proxy-route.test.ts`
- `tests/unit/modules/video/get-admin-video-details.test.ts`
- `docs/reports/reconciliation/X3-FIX-009-DISABLE-LEGACY-PRIVATE-PLAYBACK-FALLBACK.md`

## What Did Not Change
- Did not delete or mutate legacy `videoUrl` values.
- Did not add schema or migrations.
- Did not add dependencies.
- Did not change patron, payment, refund, user, or comment logic.
- Did not implement Cloudflare signed playback tokens.
- Did not implement Mux.
- Did not redesign the player.
- Did not touch launch-ops docs or roadmap docs.

## Validation Results
- `git diff --check`: PASS.
- `npm run db:generate`: PASS.
- `npm run typecheck`: PASS.
- `npm run quality:architecture-boundaries`: PASS.
- `npm test -- --run tests/unit/media-source-safety.test.ts tests/unit/api/media-proxy-route.test.ts tests/unit/modules/video/get-admin-video-details.test.ts`: PASS.
- `npm test -- --run tests/unit/modules/video`: PASS.
- `npm run vercel-build`: WARNING/ENVIRONMENT BLOCKED. `npm run db:generate` completed, but `next build` could not fetch Google Fonts (`Gluten`, `Inter`, `Outfit`, `Plus Jakarta Sans`, `Space Grotesk`) from `fonts.googleapis.com` in this environment.

## Remaining Risks
- `ALLOW_LEGACY_PRIVATE_FALLBACK=true` is intentionally an emergency rollback switch; enabling it reopens the legacy private fallback path and should be temporary only.
- Cloudflare signed playback is still not implemented by this ticket; READY provider assets still expose only safe provider metadata under the existing contract.
- Existing legacy URLs must remain reachable for Cloudflare import-by-URL migration workflows.

## Next Recommended Ticket
Implement the production Cloudflare Stream playback-token/source resolver behind the existing provider-gated `PlaybackPlan` contract, ensuring tokens are minted only after backend access approval.

## Ticket Status
Implementation complete.

## Merge Recommendation
MERGE.
