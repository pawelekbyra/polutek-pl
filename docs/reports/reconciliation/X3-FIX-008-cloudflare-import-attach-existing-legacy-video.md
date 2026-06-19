# X3-FIX-008 — Cloudflare import and attach existing legacy video

Ticket: X3-FIX-008
Status: IMPLEMENTED
Launch status: NO_GO

## Summary

The legacy URL import path now matches the X3-FIX-008 contract. Starting a Cloudflare import from an existing `Video.videoUrl` creates a Cloudflare Stream asset as `PENDING` and keeps it non-primary until provider sync or webhook evidence marks it ready.

## Changed files

- `lib/modules/video/application/import-legacy-video-to-cloudflare.use-case.ts`
  - Imported assets stay `processingState: PENDING`.
  - Imported assets stay `isPrimary: false`.
  - Audit metadata records that the imported asset is not primary.
- `tests/unit/modules/video/import-legacy-video-to-cloudflare.use-case.test.ts`
  - Success case asserts non-primary pending import.
  - Duplicate import and missing legacy URL cases remain covered.

## Validation

Expected validation:

- `git diff --check`
- `npm run quality:architecture-boundaries`
- `npm run quality:strict-escapes`
- `npm test -- --run tests/unit/modules/video/import-legacy-video-to-cloudflare.use-case.test.ts`
- `npm run typecheck`

Known unrelated CI debt should stay out of this PR.

## Scope confirmation

No public playback behavior, publication contract, access module, schema, package, seed, or launch-certification changes.

## Ticket status

X3-FIX-008 is implemented for the narrow one-video import path. Public launch remains NO_GO.
