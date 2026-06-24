# Patron Cache Fields Audit (`User.isPatron`, `patronSince`, `patronSource`)

This document tracks the usage of legacy/cache patron fields in the `User` model.
Authoritative access decisions MUST use `PatronGrant` records (via `getPatronStatus` or `checkVideoAccess`).

## Field: `User.isPatron`

| Location | Type | Description |
| :--- | :--- | :--- |
| `lib/modules/access/application/check-video-access.use-case.ts` | **Comment only** | Explicitly notes that `User.isPatron` is stale and relies on real-time grant lookup. |
| `lib/api/auth.ts` | **Display/Cache** | Used to populate Clerk session claims or actor metadata for UI badges. |
| `lib/comments-public-author.ts` | **Display/Cache** | Used for the "PATRON" badge on comments. |
| `app/components/Navbar.tsx` | **Display/Cache** | Used for the patron gem icon in the navbar. |
| `app/components/comments/...` | **Display/Cache** | Used for decorative badges in comment threads. |
| `app/api/admin/users/export/route.ts` | **Admin/Statistics** | Exported for historical reference. |
| `app/admin/users/AdminAccessDiagnostics.tsx` | **Admin/Statistics** | Displayed to compare cache vs. truth. |
| `lib/modules/payments/application/fulfill-payment.use-case.ts` | **Cache Sync** | Returned for sync to Clerk after payment. |

## Field: `User.patronSince`

| Location | Type | Description |
| :--- | :--- | :--- |
| `lib/modules/users/application/patron-read-model.ts` | **Admin/Statistics** | Part of the read model for admin diagnostics. |
| `app/api/admin/users/export/route.ts` | **Admin/Statistics** | Exported for historical reference. |
| `app/admin/users/AdminAccessDiagnostics.tsx` | **Admin/Statistics** | Displayed to compare cache vs. truth. |

## Field: `User.patronSource`

| Location | Type | Description |
| :--- | :--- | :--- |
| `lib/modules/users/application/patron-read-model.ts` | **Admin/Statistics** | Part of the read model for admin diagnostics. |
| `app/api/admin/users/export/route.ts` | **Admin/Statistics** | Exported for historical reference. |
| `app/admin/users/AdminAccessDiagnostics.tsx` | **Admin/Statistics** | Displayed to compare cache vs. truth. |

## Summary of Findings

- **Backend Authorization**: NO backend authorization logic currently relies on `User.isPatron`. `checkVideoAccess` (the primary gate) correctly uses `getPatronStatus` which queries `PatronGrant`.
- **UI/UX**: Most reads are decorative (Navbar gems, comment badges).
- **Admin**: Used for diagnostics and exports.

## Conclusion

The system has successfully moved to `PatronGrant` as the source of truth for access. Cache fields are retained for UI performance and historical diagnostics but are ignored by the security-critical paths.
