# X3-FIX-010 — Admin Cloudflare draft creation errors

Status: IMPLEMENTED
Launch status: NO_GO

## Summary

Admin Cloudflare draft creation now has safer defaults and more actionable error messages. A new draft can be created without a legacy `videoUrl` and without manually entering a thumbnail URL; the backend uses `/logo.png` as the placeholder thumbnail.

## Changed files

- `lib/modules/video/application/create-admin-video.use-case.ts`
  - Adds explicit validation for missing title and slug.
  - Normalizes blank `videoUrl` to `null`.
  - Uses `/logo.png` when `thumbnailUrl` is blank.
- `tests/unit/modules/video/create-admin-video.use-case.test.ts`
  - Covers default draft thumbnail.
  - Covers readable title validation error.
- `app/admin/videos/page.tsx`
  - Shows API `message` before raw error code so users do not only see `INTERNAL_ERROR`.
  - Sends trimmed slug and thumbnail fields.
- `app/admin/videos/components/VideoForm.tsx`
  - Makes thumbnail optional for Cloudflare-first draft creation.
  - Explains that blank thumbnail uses `/logo.png`.

## Scope confirmation

No public playback behavior, publication contract, schema, package, seed, payment, auth, launch certification, or audit/security changes.

## Validation

Expected validation:

- `npm run typecheck`
- `npm run lint`
- `npm run quality:strict-escapes`
- `npm run quality:architecture-boundaries`
- targeted create-admin-video unit tests

Public launch remains NO_GO.
