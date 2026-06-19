# X3-FIX-004 — Admin video create Cloudflare-first form reconciliation

Ticket: `X3-FIX-004-admin-video-create-cloudflare-first-form`
Status: IMPLEMENTED
Launch status: NO_GO

## Summary

The admin add-video entry point now starts from a Cloudflare-first draft shell instead of a legacy raw URL / YouTube-first workflow. New video creation defaults to a safe draft, keeps sidebar and hero visibility disabled, and redirects to the existing video detail/media page after creation so the operator can continue with the Cloudflare asset workflow.

## Changed files

- `app/admin/videos/page.tsx`
  - Changed new-video defaults to `DRAFT`, `showInSidebar: false`, `isMainFeatured: false`, and empty `videoUrl`.
  - Changed the add-video call to action to communicate Cloudflare-first draft creation.
  - Prevented duplicate flow from copying legacy `videoUrl` as the new primary media source.
  - Normalized empty `videoUrl` to `null` in the create/update payload.
- `app/admin/videos/components/VideoForm.tsx`
  - Removed missing `videoUrl` as an error for new videos.
  - Removed `required` from the legacy video URL input.
  - Relabeled the field as `Legacy / Migracja only`.
  - Added a prominent Cloudflare Stream workflow panel for save draft → details/media → upload URL or UID attach → provider status sync.
  - Updated create button and preview placeholder copy for the Cloudflare-first path.
- `tests/unit/modules/video/create-admin-video.use-case.test.ts`
  - Added a targeted `createAdminVideo` unit test proving a draft can be created with `videoUrl: null` and repository defaults still force `DRAFT`, no sidebar, and no hero.
- `scripts/strict-escapes-baseline.jsonc`
  - Removed stale baseline entries for `VideoForm.tsx` after replacing historical `any` escapes with typed diagnostics and typed preview DTO wiring.

## Validation

- `git diff --check` — PASS.
- `npm run quality:architecture-boundaries` — PASS.
- `npm run quality:strict-escapes` — PASS.
- `npm test -- --run tests/unit/modules/video/create-admin-video.use-case.test.ts` — PASS.
- `npm run typecheck` — PASS.

## Scope confirmation

This change stayed within the runtime/report scope and did not edit global roadmap/control-plane files, package files, schema/migrations, public playback, publication contracts, TUS lifecycle, seed/content work, audit/security remediation, or launch certification artifacts. The strict-escapes baseline was updated only to remove stale `VideoForm.tsx` entries made obsolete by this ticket's typed form changes so the required validation can remain green.

## What did not change

- No public playback behavior was implemented or changed.
- No Cloudflare READY state is faked by the create form.
- No TUS resume/cancel/retry lifecycle was implemented.
- No homepage, channel, sidebar, hero, or publication contract work was implemented.
- No audit/security remediation was attempted.

## Risks and follow-ups

- Existing admin edit flows can still display legacy `videoUrl` for migration; this ticket only changes the create shell and does not retire legacy media fields.
- Cloudflare production privacy, upload lifecycle completeness, public playback contract, and launch certification remain separate follow-up tickets.
- Public launch remains `NO_GO` until X7/operator evidence and launch certification are complete.

## Ticket status

`X3-FIX-004` is implemented locally and ready for review after validation commands complete.
