# X6-FU-002 Playback Plan State Messaging

Status: `READY FOR REVIEW`
Ticket: `docs/tickets/ready/X6-FU-002-playback-plan-state-messaging.md`
Date: 2026-06-12
Type: runtime UI messaging + focused test
Source finding: `docs/reports/reconciliation/X6-EX-001-UI-CONSISTENCY-INVENTORY.md`

## Summary

Implemented safe, state-specific playback placeholder messaging in `PremiumWrapper` for denied and unavailable playback-plan states. The change does not modify access policy, provider resolution, media/API routes, playback service code, Prisma schema, package files, analytics endpoints, or global docs.

## Intent

Make denied and unavailable playback states clearly distinguishable for users while preserving the invariant that only playable/ready plans mount the real player.

## State matrix

| Playback state | User-facing UI | Safe next action | Player mounted? | Sensitive details shown? |
| --- | --- | --- | --- | --- |
| `LOGIN_REQUIRED` | Polish login-required message explaining the film requires login and that login is not patron access or mailing consent. | Keyboard-accessible Clerk login modal button. | No | No |
| `PATRON_REQUIRED` | Polish patron-only message explaining access is a reward for qualifying one-time support and not a recurring subscription. | Keyboard-accessible `#donations` support link. | No | No |
| `VIDEO_NOT_READY` | Polish message that the material is being prepared and is not ready for safe playback yet. | Keyboard-accessible retry button. | No | No |
| `PROCESSING` | Polish message that the video file is being processed and the player appears only after readiness. | Keyboard-accessible retry button. | No | No |
| `NO_PRIMARY_ASSET` | Polish non-technical message that no active video file is available yet. | Keyboard-accessible support email link. | No | No |
| `UNAVAILABLE` | Polish non-technical message that playback cannot be safely prepared right now. | Keyboard-accessible support email link. | No | No |
| `ERROR` | Polish non-technical generic preparation failure message. | Keyboard-accessible retry button. | No | No |
| `READY` | Existing ready/playable child rendering remains the only real-player mount path. | Existing player behavior. | Yes | Existing behavior |

## Changed files

- `docs/tickets/ready/X6-FU-002-playback-plan-state-messaging.md`
- `app/components/PremiumWrapper.tsx`
- `tests/unit/playback-plan-state-messaging.test.ts`
- `docs/reports/reconciliation/X6-FU-002-PLAYBACK-PLAN-STATE-MESSAGING.md`

## Scope confirmation

Confirmed in-scope only. No changes were made to forbidden paths:

- `lib/services/playback/**`
- `lib/modules/video/**`
- media/API routes
- provider clients
- access policy
- Prisma/schema/migrations
- package files
- global docs
- admin user files used by X6-FU-001

## Validation commands and results

```bash
git diff --check
# PASS

npm run lint
# PASS with existing warning in app/admin/videos/page.tsx about migrationStatusFilter dependency.

npm run typecheck
# PASS

npm run quality:architecture-boundaries
# PASS

npm test -- --run tests/unit/playback-plan-state-messaging.test.ts
# PASS — 1 test file, 5 tests
```

## Security invariant confirmation

- Denied/not-ready states render `PlaybackPlanStateOverlay`, not `children`, so `VideoPlayer` and the real media player are not mounted for those states.
- The blocked-state overlay does not fetch `/api/media-source`, request provider playback data, or reference playback URLs/tokens.
- The UI messages avoid provider names, provider IDs, asset IDs, private URLs, tokens, and internal error details.
- Existing analytics/session/view ordering remains behind the existing `VideoPlayer` mount path and was not changed.
- `READY`/playable behavior remains the path that renders `children` unchanged.

## What did not change

- Access decisions and patron eligibility.
- Playback service/provider behavior.
- Media-source route contract.
- Playback-event route and analytics events.
- Database schema, migrations, packages, or architecture guard.
- Admin user/action files.

## Risks

- The support path uses the existing public contact email already present in privacy-policy copy; a dedicated paid-but-locked support route remains an owner/product follow-up if desired.
- Tests are focused static component-contract tests because the repository does not currently include a browser/React component test harness.

## Follow-ups

- Owner/product decision: whether to add a dedicated paid-but-locked support/contact surface instead of mailto fallback.
- Future UI pass can localize equivalent English copy if this surface needs bilingual state-specific text; the required Polish messages are implemented now.

## Ticket status

`READY FOR REVIEW`

## Verdict

`MERGE`
