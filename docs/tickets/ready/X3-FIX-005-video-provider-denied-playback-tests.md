# X3-FIX-005 — Video provider denied-playback negative tests

## ID

X3-FIX-005

## Status

READY

## Lane

video-provider / playback

## Type

Tests

## Priority

Launch-critical

## Goal

Add negative tests proving denied or non-ready playback never calls provider clients, fetches streams/tokens, leaks playback URLs/tokens, mounts the real player, or counts views.

## Scope

Test coverage for X3 safety invariants after provider foundation/playback contract exists. This may be test-only, or may add tiny test seams if needed.

## Allowed paths

- `tests/unit/api/media-source-route.test.ts`
- `tests/unit/api/media-proxy-route.test.ts`
- `tests/unit/api/playback-event-route.test.ts`
- `tests/unit/media-source-safety.test.ts`
- `tests/unit/modules/media/**`
- `tests/unit/modules/video/**`
- `tests/unit/components/**` if component test location exists
- Minimal test helper/seam files under `lib/modules/media/**` or `lib/modules/video/**` only if required
- `docs/reports/reconciliation/**` for the ticket report only

## Forbidden paths

- Runtime behavior changes beyond test seams
- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `scripts/check-architecture.ts` unless explicitly amended
- `package.json`
- `package-lock.json`
- Patron/user mutation files owned by X2 work

## Required tests

- Denied patron playback does not call Cloudflare/Mux/provider source resolver.
- Login-required playback does not call provider source resolver.
- `NO_PRIMARY_ASSET` does not call provider source resolver.
- `PROCESSING`/`FAILED` asset states do not return playable URLs/tokens.
- Denied playback response has no `source`, `playbackUrl`, `embedUrl`, `playbackToken`, or signed URL fields.
- Denied playback cannot create playback session/view count except explicit access-error telemetry if preserved.
- Client locked state does not mount the real player when playback plan is denied.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries`
- Targeted test command(s) for added tests

## Definition of done

- Negative tests fail on provider call before access allow.
- Negative tests fail on URL/token leakage in denied or non-ready plans.
- Test report lists any remaining untested invariant as follow-up.

## Expected PR report

Include summary, intent, changed files, validation, scope confirmation, what did not change, risks, follow-ups, and ticket status.

## Parallel safety

Do not run in parallel with the exact playback/provider files under active implementation unless coordinated with the implementer.
