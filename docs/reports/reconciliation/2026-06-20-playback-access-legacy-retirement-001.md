# PLAYBACK-ACCESS-LEGACY-RETIREMENT-001 Reconciliation Report

Date: 2026-06-20
Ticket: `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001`
Launch status: `NO_GO`

## Summary

Implemented playback access legacy retirement so `/api/media-source/[videoId]` derives legacy compatibility fields only from a canonical allowed, `READY`, playable backend playback plan. Denied and non-playable plans are stripped of playable source fields and playback session identifiers before public response serialization.

## Intent

Ensure denied, non-ready, private, or unsafe legacy videos never return a playable source, while preserving `checkVideoAccess` plus DB-backed actor/AppContext resolution as the single server-side playback access truth.

## Changed files

- `app/api/media-source/[videoId]/route.ts`
- `lib/services/playback/playback.service.ts`
- `lib/services/playback/legacy-private-fallback.policy.ts`
- `tests/unit/api/media-source-route.test.ts`
- `tests/unit/media-source-safety.test.ts`
- `docs/reports/reconciliation/2026-06-20-playback-access-legacy-retirement-001.md`
- `docs/tickets/ready/PLAYBACK-ACCESS-LEGACY-RETIREMENT-001.md`

## Implementation notes

- Deprecated `PlaybackService.createPlaybackPlan(videoId, userId, ...)` was removed so playback entry points must pass a full `AppContext` through `createPlaybackPlanWithContext`.
- `/api/media-source/[videoId]` now exposes compatibility `hasAccess`, `kind`, `playbackUrl`, and `embedUrl` only when the canonical playback plan is access-allowed, `READY`, `canPlay`, and has an actual playable source.
- Malformed or legacy-style non-playable plans are sanitized at the route boundary by clearing `source`, `playbackUrl`, `embedUrl`, `kind`, and playback-session timing.
- The historical `ALLOW_LEGACY_PRIVATE_FALLBACK` flag is intentionally ignored. Patron/private legacy fallback remains blocked unless a future owner-approved ticket explicitly reintroduces a safer operator emergency mechanism.
- Public legacy URL playback remains available only after backend access is allowed and raw object-storage URLs are converted to the `/api/media/[videoId]` compatibility proxy route.
- Cloudflare READY playback remains provider-backed and signed only after access is allowed.

## What did not change

- No payment or PatronGrant semantics changed.
- No admin upload/import lifecycle changed.
- No live provider validation was performed.
- No launch certification was claimed.
- Public launch remains `NO_GO`.

## Validation

- `git diff --check` — PASS
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm test -- --run tests/unit/media-source-safety.test.ts tests/unit/api/media-source-route.test.ts` — PASS
- `npm run build` — WARNING: build reached static page generation, then failed because `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is not set in this environment.

## Risks

- `/api/media/[videoId]` compatibility proxy was not changed in this ticket. Public legacy URLs still depend on that route remaining safe and access-gated.
- Production Cloudflare signing was not live-validated; coverage is limited to unit-level provider token behavior.

## Follow-ups

- Continue with `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` after owner/integrator review.
- Keep launch status as `NO_GO` until X7 evidence and owner launch decision are complete.

## Ticket status

`PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` is completed from Builder implementation perspective, with build marked as environment-warning due to missing Clerk public key.
