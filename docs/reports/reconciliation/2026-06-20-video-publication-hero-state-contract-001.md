# Reconciliation closeout — VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001

Status: READY_FOR_INDEPENDENT_REVIEW
Launch status: NO_GO
Date: 2026-06-20

## Summary

Implemented a focused backend state contract for video publication, hero selection and public sidebar exposure.

## State-machine decision

`publishedAt` is **first-published-at**. Manual republish preserves an existing timestamp instead of replacing it. New publication sets `publishedAt` only when the video had no previous value.

Allowed publication transitions remain:

- `DRAFT -> PUBLISHED` through `publishAdminVideo` only.
- `PUBLISHED -> DRAFT` through admin unpublish, clearing hero/sidebar exposure.
- `DRAFT/PUBLISHED -> ARCHIVED` through archive, clearing hero/sidebar exposure.
- `ARCHIVED -> DRAFT` through restore.

## Changed files

- `lib/modules/video/domain/video.policy.ts` — shared blockers for publication, hero and sidebar state.
- `lib/modules/video/domain/video.errors.ts` — stable error classes/codes for publication, hero and sidebar blocking.
- `lib/modules/video/application/publish-admin-video.use-case.ts` — shared validation gate and first-published-at semantics.
- `lib/modules/video/application/update-admin-video.use-case.ts` — server-side hero/sidebar blocking and exposure clearing on non-published transitions.
- `lib/modules/video/application/get-admin-video-diagnostics.use-case.ts` — explicit admin diagnostics for publication, provider sync, publish-after-ready, hero and sidebar blockers.
- `lib/modules/video/infrastructure/video.repository.ts` — repository-level archive, hero and sidebar safety guards.
- Focused unit tests under `tests/unit/**video**`.
- Ready-ticket queue/status docs.

## Validation

- PASS — `git diff --check`
- PASS — `npm run typecheck`
- PASS — `npm run lint`
- PASS — targeted video publication/hero/sidebar tests
- PASS — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dummy npm run build`
- ENV NOTE — plain `npm run build` fails in this isolated workspace because `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is not set. The build succeeds with a dummy Clerk publishable key; static generation logs missing `DATABASE_URL` for sitemap data but exits successfully.

## Scope confirmation

Touched only allowed runtime/test/docs paths for this ticket. No payment, patron, comments, legal/email, package, schema, migration, broad guard or public playback changes were made.

## Risks and follow-ups

- Public launch remains `NO_GO`.
- Build-time sitemap still attempts database access when `DATABASE_URL` is absent; this is pre-existing environment sensitivity and not launch certification evidence.
- Next executable ticket is `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001`.
