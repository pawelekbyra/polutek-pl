# X6-FU-002 — Playback plan state messaging

Status: DONE — merged on main (PR #877).
Type: runtime UI + focused tests
Source finding: `docs/reports/reconciliation/X6-EX-001-UI-CONSISTENCY-INVENTORY.md`

## Intent

Make denied and unavailable playback states clearly distinguishable in the player/paywall UI without changing access, provider, playback, analytics, session, API, schema, package, or global documentation behavior.

## Scope

Allowed paths:

- `app/components/PremiumWrapper.tsx`
- existing paywall/locked/error components used by `PremiumWrapper`
- `app/components/VideoPlayer.tsx` only if needed for message rendering
- narrow focused component/static tests
- this ticket
- `docs/reports/reconciliation/X6-FU-002-PLAYBACK-PLAN-STATE-MESSAGING.md`

Forbidden paths/changes:

- `lib/services/playback/**`
- `lib/modules/video/**`
- media/API routes
- provider clients
- access policy
- Prisma schema or migrations
- package files
- global docs
- admin user files used by X6-FU-001

## Requirements

Map these backend `PlaybackPlan`/result states to safe user-facing UI:

- `LOGIN_REQUIRED`
- `PATRON_REQUIRED`
- `VIDEO_NOT_READY`
- `PROCESSING`
- `NO_PRIMARY_ASSET`
- `UNAVAILABLE`
- `ERROR`
- `READY` behavior remains unchanged.

For every non-ready state:

- show a clear Polish message and safe next action,
- point login-required users to login,
- explain patron-required as one-time support/patron access, not a subscription,
- explain processing/not-ready as material being prepared,
- give no-primary-asset/unavailable/error a non-technical retry or support path,
- never mount the real player,
- never fetch a playback source or request a token from the UI beyond the existing safe media-source access-plan request,
- never display provider identifiers, asset IDs, private URLs, tokens, or internal errors,
- preserve existing analytics/session/view ordering,
- use existing UI patterns; no redesign.

## Required focused tests

Focused tests must prove:

- correct UI for every listed state,
- no player mount for denied/not-ready states,
- no source/token request for denied/not-ready states,
- `READY` still mounts the player,
- messages contain no sensitive provider details,
- retry/login/support actions are keyboard-accessible.

## Validation

Run and report:

```bash
git diff --check
npm run lint
npm run typecheck
npm run quality:architecture-boundaries
npm test -- --run <only the focused test files added or changed>
```

## PR report must include

- summary,
- state matrix,
- changed files,
- focused test results,
- security invariant confirmation,
- verdict: `MERGE`, `FIX`, or `BLOCKED`.
