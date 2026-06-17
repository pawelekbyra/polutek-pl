# ADMIN-AUTH-ACTOR-CANONICALIZATION-001 — Canonicalize server-side admin actor resolution

Status: IMPLEMENTATION_MERGED / PREVIOUS_POSTMERGE_PASS_INCOMPLETE / REVERIFICATION_REQUIRED / HISTORICAL_IMPLEMENTATION_EVIDENCE
Ticket ID: ADMIN-AUTH-ACTOR-CANONICALIZATION-001
Role: Builder / Historical
Priority: URGENT
Launch status: NO_GO

## Current-state reconciliation

This ticket is no longer `READY_FOR_BUILDER`. PR #922 merged the implementation, PR #923 verified the modular access path, and PR #929 later repaired an omitted legacy AccessPolicy playback path. Therefore the original PR #923 PASS is historical evidence but not complete current-main certification.

Future reverification is tracked by `ADMIN-AUTH-POSTMERGE-REVERIFY-001`.

## Preserved invariants

```txt
Clerk confirms identity.
The local DB confirms current roles and account status.
Session claims and publicMetadata are not authoritative sources for admin authorization.
```

The future reverification must cover DB-authoritative role resolution, deleted-user denial, configured-admin behavior, revoked-admin behavior, all admin routes, modular playback, legacy playback, comment moderation, no session-claim authorization, no double authorization, and current main rather than the old #922 merge alone.
