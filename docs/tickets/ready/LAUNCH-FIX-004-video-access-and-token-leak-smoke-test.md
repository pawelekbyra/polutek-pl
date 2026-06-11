# LAUNCH-FIX-004 — Video access and token-leak smoke test

## ID

LAUNCH-FIX-004

## Status

READY

## Lane

launch-ops

## Type

Ops smoke test / docs-only evidence

## Goal

Verify in the deployed environment that allowed viewers can play Cloudflare-backed videos and denied viewers do not receive or trigger private playback sources/tokens.

## Context

The product invariant is: allowed `PlaybackPlan` mounts a player; denied `PlaybackPlan` shows a locked placeholder. Denied viewers must not fetch streams, request tokens, call Cloudflare/Mux for playback source, count playback/view events, or receive `playbackUrl`/`playbackToken`.

## Allowed files

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` only if moving/annotating this ticket is part of the agreed workflow
- `docs/operations/**` if a browser/network smoke-test checklist is needed

## Forbidden files

- `lib/**`
- `app/**`
- `components/**`
- `tests/**`
- `prisma/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `AGENTS.md`
- `scripts/**`
- `docs/roadmap/**`
- `docs/strategy/**`

## Required work

- Select one public video and one patron-only Cloudflare READY video.
- As guest, open public video and record expected playable result.
- As guest, open patron-only video and record locked/denied result.
- As signed-in non-patron, open patron-only video and record denied result.
- As patron/admin, open patron-only video and record playable result.
- Inspect network responses for denied viewers and confirm no private source/token is present.
- Check logs/evidence for denied viewers not causing playback token/source provider calls where available.

## Validation

- `git diff --check`
- No runtime validation required.
- Confirm no forbidden files changed.

## Expected PR report

- Summary
- Reports created
- Smoke-test matrix by actor and video tier
- Token/source leak inspection evidence
- Risks/gaps
- Confirmation this is docs-only
- Confirmation no runtime files changed
- Validation results
- Recommended next execution order
- Merge recommendation: MERGE / FIX / BLOCKED

## Merge recommendation rule

Recommend **MERGE** only if allowed/denied evidence and token-leak inspection are documented. Recommend **BLOCKED** if no READY patron-only Cloudflare video or no test patron/non-patron account is available.
