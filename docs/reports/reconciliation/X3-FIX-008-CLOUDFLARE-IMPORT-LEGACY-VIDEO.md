# Reconciliation Report: X3-FIX-008 Cloudflare Import Existing Legacy Video

## Summary
Implemented a narrow admin-only migration workflow that starts a Cloudflare Stream import from an existing legacy `Video.videoUrl` and attaches the returned Cloudflare UID as the video's `VideoAsset`.

## Intent
Allow admins to migrate existing legacy video URLs surfaced by X3-FIX-006 and X3-FIX-007 diagnostics without changing playback runtime, patron access, payment behavior, comments, or public/player UI.

## Import-by-URL Flow
1. Admin opens the video details media section.
2. The UI shows **Importuj do Cloudflare z legacy URL** only when a legacy URL exists and no Cloudflare Stream asset is attached.
3. The admin action calls the existing admin video actions route with `import-legacy-to-cloudflare`.
4. The use case verifies the video belongs to the main channel, requires a non-empty legacy `videoUrl`, and refuses videos that already have a Cloudflare Stream asset.
5. The Cloudflare Stream client calls the Stream copy/import-by-URL endpoint with the legacy URL.
6. The returned Cloudflare UID is stored in `VideoAsset.providerAssetId` and `providerPlaybackId`, with `processingState: PENDING` and `isPrimary: true`.
7. The legacy `videoUrl` is preserved for rollback and migration audit.

## Idempotency Behavior
- If a video already has a Cloudflare Stream asset in any state (`PENDING`, `UPLOADING`, `PROCESSING`, `READY`, or `FAILED`), the use case refuses a new import with `CLOUDFLARE_ASSET_ALREADY_EXISTS`.
- The use case re-checks asset state inside the transaction before writing the new asset to reduce duplicate imports when admin actions race.
- Existing legacy fallback data is not deleted or cleared.

## Admin UI / Action Behavior
- Added a small media-section button: **Importuj do Cloudflare z legacy URL**.
- The button is hidden unless `video.videoUrl` exists and the attached asset is not Cloudflare Stream.
- Success toast shows the attached Cloudflare UID.
- Error toast uses the safe admin error message returned by the admin-only action.

## Files Changed
- `lib/modules/video/application/import-legacy-video-to-cloudflare.use-case.ts`
- `lib/modules/video/infrastructure/cloudflare-stream.client.ts`
- `lib/modules/video/index.ts`
- `app/api/admin/videos/[id]/actions/route.ts`
- `app/admin/videos/[id]/page.tsx`
- `tests/unit/modules/video/import-legacy-video-to-cloudflare.use-case.test.ts`
- `tests/unit/modules/video/video-dto.test.ts`
- `docs/reports/reconciliation/X3-FIX-008-CLOUDFLARE-IMPORT-LEGACY-VIDEO.md`

## Tests Added / Updated
- Added use-case coverage for successful legacy URL import and Cloudflare UID attachment.
- Added coverage for missing legacy URL refusal.
- Added coverage for refusing an already attached Cloudflare asset.
- Added transaction-time duplicate prevention coverage.
- Added payload safety coverage to ensure provider secrets, upload URLs, signed URLs, and playback tokens are not returned.
- Added DTO coverage proving public payloads still do not expose playback behavior when a Cloudflare import is pending.

## What Did Not Change
- No playback runtime changes.
- No playback token issuance.
- No public/player UI changes.
- No legacy playback fallback removal.
- No access, patron, payment, user, or comment behavior changes.
- No Prisma schema or migration changes.
- No package or dependency changes.
- No Mux implementation.

## Validation Results
- `git diff --check`: PASS.
- `npm run db:generate`: PASS.
- `npm run typecheck`: PASS.
- `npm run quality:architecture-boundaries`: PASS.
- `npx vitest tests/unit/modules/video/import-legacy-video-to-cloudflare.use-case.test.ts tests/unit/modules/video/video-dto.test.ts --run`: PASS.
- `npm test -- --run tests/unit/modules/video`: PASS.
- `npm run vercel-build`: WARNING/ENVIRONMENT BLOCKED. `npm run db:generate` completed, but `next build` could not fetch Google Fonts (`Gluten`, `Inter`, `Outfit`, `Plus Jakarta Sans`, `Space Grotesk`) from `fonts.googleapis.com` in this environment.

## Remaining Risks
- Cloudflare may accept the import request but fail processing asynchronously; readiness still depends on the existing provider webhook/status flow.
- Two truly simultaneous requests can both call Cloudflare before the transaction duplicate check rejects the loser locally. The local database remains protected from duplicate asset attachment, but the rejected remote import may require manual Cloudflare cleanup.
- The legacy URL must remain reachable by Cloudflare for the import to succeed.

## Next Recommended Ticket
Add an admin migration status refresh/retry workflow that can reconcile failed Cloudflare imports and surface actionable Cloudflare processing errors without exposing provider secrets or playback tokens.

## Ticket Status
Implementation complete.

## Merge Recommendation
MERGE.
