# Ticket: X3-FIX-008-cloudflare-import-attach-existing-legacy-video

## Info
- **ID:** X3-FIX-008
- **Lane:** Video
- **Type:** Feature/Admin
- **Goal:** Allow admins to trigger Cloudflare Stream "Link/Import" for an existing legacy video URL.
- **Parallel Safety:** Yes

## Context
X3-FIX-006 migration plan identifies "Import via URL" as the preferred migration path for existing legacy content to minimize local bandwidth usage.

## Requirements
1.  **Add `importLegacyVideoToCloudflare` use case:**
    -   Accepts `videoId`.
    -   Fetches the legacy `videoUrl`.
    -   Calls Cloudflare Stream API with `{ "url": legacyUrl }` to initiate an import.
    -   Creates a `VideoAsset` in `PENDING` state with the returned UID.
2.  **Add Admin Action Button:**
    -   In the Video Details page, under "Media" tab, add a button "Importuj do Cloudflare z Legacy URL".
    -   Only visible if a valid legacy `videoUrl` exists and no CF asset is present.
3.  **Ensure Idempotency:**
    -   Prevent multiple imports for the same video.

## Allowed Files
- `lib/modules/video/application/import-legacy-video-to-cloudflare.use-case.ts` (New)
- `lib/modules/video/infrastructure/cloudflare-stream.client.ts`
- `app/api/admin/videos/[id]/actions/route.ts`
- `app/admin/videos/[id]/page.tsx`
- `tests/unit/modules/video/**`

## Forbidden Files
- `prisma/schema.prisma`
- `lib/modules/access/**`
