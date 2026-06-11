# Reconciliation Report: X3-FIX-005 Video Provider Denied Playback Negative Tests

## Summary
Added launch-critical negative tests to ensure that denied or non-ready playback never calls provider source clients, leaks sensitive URLs/tokens, or incorrectly counts views/sessions.

## Safety Invariants Covered
- **Access Priority:** `checkVideoAccess` is called before any playable source inspection or provider resolution.
- **Provider Isolation:** Provider source resolution and signing are bypassed if access is denied or asset is not ready.
- **Leak Prevention:** Playback plans for denied/non-ready states do not contain `source`, `playbackUrl`, `embedUrl`, or any provider-specific tokens/URLs.
- **Session/View Integrity:** `VideoPlaybackSession` creation and view-counting logic are strictly gated by both initial access checks and asset readiness.

## Tests Added/Updated

### `tests/unit/media-source-safety.test.ts`
- **Denied Access (PATRON_REQUIRED/LOGIN_REQUIRED):** Verified no `StorageService.getPresignedUrl` calls, no `videoPlaybackSession.create` calls, and redacted `source` in result.
- **Video Not Found:** Verified 404-style denial prevents any downstream provider/storage calls.
- **Asset Processing/Failed:** Verified that even if access is allowed, `PROCESSING` or `FAILED` states block provider resolution and session creation.
- **No Primary Asset:** Verified fallback behavior for missing or non-primary assets.
- **Provider Placeholder:** Verified that the initial `READY` plan for a provider asset (`CLOUDFLARE_STREAM`) does NOT create a session or resolve a source yet (this happens later during explicit resolution).

### `tests/unit/modules/video/record-playback-event.use-case.test.ts`
- **View Counting Protection:** Verified that `recordView` and `markSessionAsViewed` are never called if `checkVideoAccess` denies the operation.
- **Event Recording Protection:** Verified that no events (except `ACCESS_ERROR`) are recorded in the database when access is denied.

### `tests/unit/api/media-source-route.test.ts`
- **403 Response:** Verified that the API returns HTTP 403 on denial.
- **API Redaction:** Verified that `playbackUrl`, `embedUrl`, and `source` fields are removed from the JSON response on denial.

## Provider No-Call Evidence
All tests for denied/non-ready states explicitly assert that:
- `StorageService.getPresignedUrl` was not called.
- `prisma.videoPlaybackSession.create` was not called.
- `diagnostics.providerResolutionAllowed` is `false`.

## URL/Token Leakage Assertions
- `expect(plan.source).toBeUndefined()` in denied states.
- `expect(data.playbackUrl).toBeUndefined()` in API route denial response.
- `expect(JSON.stringify(plan)).not.toContain('cloudflare/cf-provider-object-key')`.

## Session/View-Count Assertions
- `expect(plan.tracking.playbackSessionId).toBe('')` for all non-playable states.
- `expect(mockRepo.recordView).not.toHaveBeenCalled()` in `recordPlaybackEventUseCase` tests when access is denied.

## What Did Not Change
- No changes to production logic in `PlaybackService` or `recordPlaybackEventUseCase` were required as the existing code already followed the correct ordering.
- No changes to `checkVideoAccess` logic.
- No implementation of actual Cloudflare token generation or Mux integration.

## Validation Results
- `npm run typecheck`: PASSED
- `npm run quality:architecture-boundaries`: PASSED
- `npm test -- tests/unit/media-source-safety.test.ts tests/unit/modules/video/record-playback-event.use-case.test.ts tests/unit/api/media-source-route.test.ts`: PASSED

## Merge Recommendation
**MERGE** - The core invariants for denied/non-ready playback are now strictly covered by negative tests, ensuring no regressions in privacy or usage-tracking accuracy.
