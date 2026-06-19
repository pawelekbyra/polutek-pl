# X3-FIX-008 — Cloudflare import and attach existing legacy video

Status: UPDATED_AFTER_PR_968
Launch status: NO_GO
PR: #967
Updated after: #968 merged to main

## Summary

This update keeps the legacy Cloudflare import behavior narrow after rebasing onto the current main that includes #968. Imported legacy Cloudflare assets are recorded as non-primary pending assets so the existing legacy playback/publication behavior is not changed by the import action.

## Intent

Preserve the X3-FIX-008 import path while ensuring a newly imported Cloudflare Stream asset starts as:

- `processingState: PENDING`;
- `isPrimary: false`;
- audit metadata `importedAssetIsPrimary: false`.

## Changed files

- `lib/modules/video/application/import-legacy-video-to-cloudflare.use-case.ts`
- `tests/unit/modules/video/import-legacy-video-to-cloudflare.use-case.test.ts`
- `docs/reports/reconciliation/X3-FIX-008-cloudflare-import-attach-existing-legacy-video.md`

## Scope confirmation

No public playback behavior was changed. No publication, hero, sidebar, channel, schema, package, auth, payments, audit-system, security, or launch-certification behavior was changed. Public launch remains `NO_GO`.

## What did not change

- No public player or playback route changes.
- No legacy private playback fallback retirement.
- No publication or visibility contract changes.
- No schema or package changes.
- No launch certification claim.

## Risks

- Provider import status still depends on the existing Cloudflare sync/status workflow after import starts.
- Existing unrelated audit/security findings may remain outside this ticket.

## Follow-ups

- Continue with planned provider status sync/operator evidence work.
- Public launch remains blocked until X7/operator evidence is complete.

## Ticket status

X3-FIX-008 remains a narrow runtime/admin import fix updated after #968.
