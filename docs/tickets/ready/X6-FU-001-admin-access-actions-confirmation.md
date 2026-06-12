# X6-FU-001-admin-access-actions-confirmation

ID: `X6-FU-001`
Status: `IMPLEMENTED`
Lane: X6 Product Excellence
Type: Runtime/UI follow-up
Source: `docs/reports/reconciliation/X6-EX-001-UI-CONSISTENCY-INVENTORY.md`

## Goal

Make admin access-impact actions clear and safe before public launch, especially manual patron grant/revoke flows that can create paid-but-locked support incidents.

## Launch-critical gap

Current admin patron actions use terse buttons plus a browser `prompt()` for reason entry before immediately PATCHing grant/revoke. This is not a clear dangerous-action confirmation workflow for an action that affects premium access.

## Required scope

- Replace prompt-based manual patron grant/revoke with a structured confirmation UI.
- Require a non-empty reason before submitting.
- Show the access impact explicitly before submit:
  - grant creates/activates patron access,
  - revoke removes patron access and may lock premium playback/comment permissions.
- Preserve audit requirements and backend reason validation.
- Include paid-but-locked support diagnostics in or near the admin user detail surface so support can distinguish payment facts, active/revoked grants, cache mismatch, and subscription/newsletter state.
- Keep patron access distinct from mailing subscription in labels and helper copy.

## Suggested allowed paths for implementation ticket

To be confirmed by owner before activation:

- `app/admin/users/UserPatronActions.tsx`
- `app/admin/users/[userId]/page.tsx`
- narrow supporting admin-user UI components if created under `app/admin/users/**`
- tests only if the activated ticket explicitly allows them

## Forbidden without separate owner approval

- Payment/patron backend policy changes.
- Prisma schema or migrations.
- Package updates.
- Global roadmap/docs updates.
- Any change to global roadmap or strategy documents beyond current-main reconciliation.

## Validation to define when activated

At minimum:

```bash
git diff --check
npm run lint
```

Add targeted tests only after owner/reviewer confirms the implementation scope.

## Ticket status

`DONE` — implemented and merged on main (PR #876).
