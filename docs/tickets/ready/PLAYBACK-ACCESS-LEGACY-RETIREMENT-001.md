# PLAYBACK-ACCESS-LEGACY-RETIREMENT-001 — Playback access truth and legacy path retirement

Status: PLANNED_AFTER_VIDEO_STATE_CONTRACT
Role: Builder
Priority: Launch-critical
Launch status: NO_GO
Type: Runtime implementation + focused tests

## Product decision

This ticket replaces the split between `LEGACY-ACCESS-POLICY-RETIREMENT-001` and `LEGACY-MEDIA-PROXY-RETIREMENT-001`, and absorbs the playback/access parts of `ADMIN-AUTH-POSTMERGE-REVERIFY-001`.

Current main has a modular playback plan, DB-backed actor resolution, safe redaction of provider IDs, Cloudflare signed playback, and a legacy compatibility response from `/api/media-source/[videoId]`. It also still has deprecated playback APIs and a controlled legacy private fallback flag. The right task is not another inventory; it is to retire or reconcile the remaining legacy playback/access paths so there is one access truth.

## Goal

Ensure denied, non-ready, private, or legacy videos never return a playable source, and ensure all playback entry points use the same backend access decision.

## Required implementation

### A. Single playback authority

- Keep `checkVideoAccess` and DB-backed actor resolution as the server-side access source of truth.
- Remove or fully contain deprecated playback helpers that bypass current AppContext/Actor semantics.
- Ensure public routes do not authorize from Clerk public metadata, cached UI state, or legacy helpers.

### B. `/api/media-source` contract

- Reconcile the compatibility fields `hasAccess`, `kind`, `playbackUrl`, and `embedUrl` with the canonical playback plan.
- For denied access, non-ready assets, missing primary asset, and blocked legacy fallback, the response must not contain a playable URL.
- Keep provider identifiers redacted in public diagnostics.

### C. Legacy media fallback

- Decide whether `ALLOW_LEGACY_PRIVATE_FALLBACK` remains available only as an explicit emergency/operator flag or is removed.
- Patron-only legacy playback fallback should remain blocked unless owner explicitly chooses otherwise.
- Public legacy fallback may remain only if it does not bypass provider privacy/access constraints.

### D. Tests

- Add regression tests for denied patron video, guest login-required video, deleted/archived video, non-ready Cloudflare asset, Cloudflare READY asset, legacy public URL, and legacy patron URL.
- Test that denied/non-ready plans create no playback session and expose no playable source.
- Test that Cloudflare READY playback returns signed embed URL only after access is allowed.

## Non-goals

- Do not implement admin upload/import lifecycle here.
- Do not change payment/patron grant semantics.
- Do not perform live provider validation.
- Do not claim launch certification.

## Allowed paths

- `app/api/media-source/**`
- `app/api/media/**` if present or reintroduced only as a safe compatibility route
- `lib/services/playback/**`
- `lib/modules/access/**`
- `lib/modules/media/**`
- `lib/api/auth.ts`
- `tests/unit/api/media-source-route.test.ts`
- `tests/unit/media-source-safety.test.ts`
- `tests/unit/**playback**`
- `tests/integration/**critical-path**` if used for playback regression
- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` for status updates

## Acceptance criteria

- There is one server-side access truth for playback.
- Denied and non-ready responses contain no playable source.
- Legacy private fallback is removed or explicitly and safely gated.
- Deprecated helper usage is removed or tested as safe compatibility.
- Tests cover both allowed playback and denied/non-ready no-leak paths.

## Validation

- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- targeted media-source/playback tests
- `npm run build`

## Expected PR report

Include the final legacy policy decision, changed files, tests, any intentionally retained compatibility fields, and confirmation that public launch remains `NO_GO`.
