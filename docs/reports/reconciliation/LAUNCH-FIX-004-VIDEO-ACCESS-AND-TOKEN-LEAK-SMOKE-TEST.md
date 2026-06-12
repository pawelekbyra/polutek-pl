# Historical snapshot / superseded by signed playback

This report is historical evidence from before PR #870 / `X3-FIX-011-CLOUDFLARE-SIGNED-PLAYBACK-RUNTIME.md`. Its READY Cloudflare placeholder conclusions are superseded for current main by signed Cloudflare Stream playback. Preserve the original findings below as historical validation, not current playback truth.

# Launch Evidence Report: LAUNCH-FIX-004 Video Access and Token Leak Smoke Test

## Summary
Verified that video access rules and token/source leakage prevention are launch-ready. This smoke test confirms that denied viewers (guests and non-patron users) receive no playable sources, tokens, or sensitive provider metadata, and that no side effects (view counts, playback sessions) occur upon denial.

## Status
Merge recommendation: **MERGE** (Evidence-focused / Docs and Test-only).

## Smoke Cases Matrix

| Case | Actor | Video Tier | Expected Outcome | Evidence |
|------|-------|------------|------------------|----------|
| Public Playback | Guest | PUBLIC | Playable (Legacy Proxy) | `tests/unit/media-source-safety.test.ts` ("should redact raw videoUrl while preserving legacy URL playback behavior") |
| Patron Denial (Guest) | Guest | PATRON | Denied (403/Locked) | `tests/unit/media-source-safety.test.ts` ("should not return source... if access is denied (PATRON_REQUIRED)") |
| Patron Denial (User) | Non-Patron | PATRON | Denied (403/Locked) | `tests/unit/media-source-safety.test.ts` ("should not return source... for logged-in non-patron") |
| Login Required | Guest | PATRON | Denied (LOGIN_REQUIRED) | `tests/unit/media-source-safety.test.ts` ("should not return source... if access is denied (LOGIN_REQUIRED)") |
| Legacy Fallback Cutoff | Patron | PATRON (Legacy Only) | Blocked (409) | `tests/unit/media-source-safety.test.ts` ("blocks patron-only legacy videoUrl fallback") |
| Storage Provider Cutoff | Patron | PATRON (S3 Ready) | Blocked (409) | `tests/unit/media-source-safety.test.ts` ("blocks patron-only READY legacy storage asset fallback") |
| Processing Asset | Patron | PATRON (Processing) | Processing (No Source) | `tests/unit/media-source-safety.test.ts` ("returns processing plan with no source... for allowed Cloudflare asset still processing") |
| Failed Asset | Patron | PATRON (Failed) | Unavailable (No Source) | `tests/unit/media-source-safety.test.ts` ("returns unavailable plan with no source... for allowed Cloudflare asset that failed") |
| Ready CF Asset | Patron | PATRON (Ready CF) | READY (Safe Metadata Only) | `tests/unit/media-source-safety.test.ts` ("READY Cloudflare asset for allowed patron does not create a session or resolve provider source yet") |

## Denied Access Evidence
Tests confirm that for `PATRON_REQUIRED` or `LOGIN_REQUIRED` results:
- `plan.access.allowed` is `false`.
- `plan.source` is `undefined`.
- `plan.canPlay` is `false`.
- `plan.tracking.playbackSessionId` is empty.
- Verified in `tests/unit/media-source-safety.test.ts`.

## Token/Source Redaction Evidence
- **API Redaction (Denied):** `tests/unit/api/media-source-route.test.ts` ("returns 403 when access is denied and redacts all source fields") verifies that `playbackUrl`, `embedUrl`, and `source` are removed.
- **API Redaction (Processing/Failed):** `tests/unit/api/media-source-route.test.ts` ("redacts PROCESSING Cloudflare video" and "redacts FAILED Cloudflare video") verifies that no source/URL is leaked even if access is allowed.
- **Leak Prevention (Legacy URLs):** `tests/unit/media-source-safety.test.ts` (Processing/Failed cases) explicitly asserts that the JSON result does not contain the raw legacy S3/bucket strings.
- **Diagnostics Safety:** `app/api/media-source/[videoId]/route.ts` explicitly redacts raw URLs from diagnostics warnings via `MediaPolicy.isProbablyRawMediaUrl`.
- **Provider Metadata:** `tests/unit/media-source-safety.test.ts` confirms that `READY` Cloudflare assets expose only safe fields (`providerPlaybackId`) and not sensitive object keys.

## Side Effect Evidence
- **Storage:** `StorageService.getPresignedUrl` is NOT called for denied viewers or not-ready assets.
- **Sessions:** `prisma.videoPlaybackSession.create` is NOT called for denied viewers or READY Cloudflare assets (pre-resolution).
- **Views/Events:** `tests/unit/modules/video/record-playback-event.use-case.test.ts` confirms that `PLAY_STARTED`, `WATCHED_10_SECONDS`, and view counting are blocked if `checkVideoAccess` denies the operation.

## Legacy Fallback Cutoff Evidence
- **Patron-only blocks:** `tests/unit/media-source-safety.test.ts` ("blocks patron-only legacy videoUrl fallback") proves that patron-only videos with legacy S3/R2 URLs return `NO_PRIMARY_ASSET` instead of a playable proxy.
- **Proxy blockage:** `tests/unit/api/media-proxy-route.test.ts` ("blocks patron legacy media proxy fallback") confirms that `/api/media/:videoId` returns `409 Conflict` for patron-only videos when `ALLOW_LEGACY_PRIVATE_FALLBACK` is disabled.

## Current Limitations
- **Cloudflare Ready:** Allowed patrons receive a `READY` plan with safe metadata, but `canPlay` is `false` because provider source resolution (signed tokens) is gated and not yet implemented in the current runtime player. This ensures no unready or unsigned streams are accidentally exposed.

## Test Commands Run
```bash
npm test -- --run tests/unit/media-source-safety.test.ts tests/unit/api/media-source-route.test.ts tests/unit/api/media-proxy-route.test.ts tests/unit/modules/video/record-playback-event.use-case.test.ts
npm run quality:architecture-boundaries
npm run typecheck
```

## Merge Recommendation
**MERGE**. Core access invariants and negative security outcomes are covered by precise tests. Redaction of sensitive fields for denied and READY-but-not-yet-playable states is confirmed. Side-effect suppression on denial is verified.
