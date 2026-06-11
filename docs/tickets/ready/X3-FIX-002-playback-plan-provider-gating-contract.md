# X3-FIX-002 — PlaybackPlan provider gating contract

## ID

X3-FIX-002

## Status

READY

## Lane

video-provider / playback

## Type

Runtime safety

## Priority

Launch-critical

## Goal

Make playback planning provider-aware while preserving the invariant: denied access never calls Cloudflare/Mux, never fetches stream/token, never leaks playback URL/token, never mounts a real player, and never counts a view.

## Scope

Refactor the playback plan boundary after `X3-FIX-001` so source/token resolution only happens after backend access allow and after selecting a primary READY asset.

## Allowed paths

- `lib/services/playback/**` or replacement playback module path
- `lib/modules/video/**`
- `lib/modules/media/**`
- `app/api/media-source/[videoId]/route.ts`
- `app/components/PremiumWrapper.tsx`
- `app/components/VideoPlayer.tsx`
- `tests/unit/api/media-source-route.test.ts`
- `tests/unit/media-source-safety.test.ts`
- `tests/unit/modules/video/**`
- `tests/unit/modules/media/**`
- `docs/reports/reconciliation/**` for the ticket report only

## Forbidden paths

- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `scripts/check-architecture.ts` unless explicitly amended
- `package.json`
- `package-lock.json`
- Patron/user mutation files owned by X2 work

## Required changes

- Introduce explicit playback plan statuses aligned with target states: `READY`, `LOGIN_REQUIRED`, `PATRON_REQUIRED`, `VIDEO_NOT_READY`, `NO_PRIMARY_ASSET`, `PROCESSING`, `UNAVAILABLE`, `ERROR`.
- Ensure denied/non-ready plans have no playable URL or token.
- Ensure provider source/token calls are after backend access allow.
- Keep legacy URL fallback only if explicitly marked legacy and safe for allowed public cases.
- Update route response compatibility carefully, without leaking legacy raw URLs.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries`
- Targeted playback/media-source tests

## Definition of done

- Playback plan has explicit denied/non-ready states.
- No denied plan includes `source.playbackUrl`, `playbackToken`, or provider source metadata.
- Provider resolution is structurally after access allow in code and tests.

## Expected PR report

Include summary, intent, changed files, validation, scope confirmation, what did not change, risks, follow-ups, and ticket status.

## Parallel safety

Do not run in parallel with other playback/media-source route work, video provider runtime work, or X2 access mutation work.
