# ADMIN-AUTH-ACTOR-CANONICALIZATION-001 — Canonicalize server-side admin actor resolution

Status: READY_FOR_BUILDER
Ticket ID: ADMIN-AUTH-ACTOR-CANONICALIZATION-001
Role: Builder
Priority: URGENT
Launch status: NO_GO

## Purpose

Define and implement one canonical server-side resolver for the current actor used by admin authorization and admin bypass decisions.

Core rule:

```txt
Clerk confirms identity.
The local DB confirms current roles and account status.
Session claims and publicMetadata are not authoritative sources for admin authorization.
```

The resolver must define invariants, not force specific implementation names. Names such as `createCurrentActorContext()` and `requireAdminContext()` are implementation decisions.

## Confirmed problem

`app/admin/layout.tsx` uses `requireAdmin()`, but `app/admin/channel/page.tsx` again uses `getActorFromAuth()`, which trusts `sessionClaims.metadata.role`.

A real DB `ADMIN` without the matching claim receives a false `403`.

The channel page also converts all errors into `Maintenance Required`.

Do not suggest running maintenance setup blindly. Maintenance may rewrite the owner of videos, comments, payments and subscriptions.

## Required resolver invariants

The canonical server-side resolver must:

```txt
obtain userId from Clerk
load the current local User
reject missing local User
reject isDeleted=true
determine admin from current DB role or controlled ADMIN_CLERK_USER_IDS allowlist
require an active local User even for configured admin IDs
never trust an admin claim for security bypass
return a user actor with current, safely resolved patron state
preserve existing PatronGrant semantics
```

Session claims and public metadata may be used only as non-authoritative UI hints, never as server-side authorization truth.

## Minimal required implementation scope for the future Builder PR

The future implementation must inspect and repair authorization for at least:

```txt
/admin/channel page
/api/admin/channel GET/PATCH
main-channel maintenance preview/apply
admin comment moderation: hide, restore, delete, heart, reports, resolve report
admin videos: list/create, details/update, actions and verified resync/reorder scope
admin payment/settings routes using app-context-factory
admin users export
public media/playback routes with admin bypass
comment pin/edit/delete routes with admin bypass
Navbar and admin UI consistency
```

For routes that already call `requireAdminForApi()`, the future implementation must use the returned `adminUserId` to construct:

```ts
{ type: "admin", userId: adminUserId }
```

Do not call a weaker role resolver again after a stronger admin check.

`createAppContextFromRequest` must stop granting permissions to a deleted user.

## Required tests for the future implementation PR

Add focused automated tests for at least:

```txt
DB ADMIN + no admin claim → admin page/API works
DB ADMIN + claim USER or no role → admin works
claim admin + DB USER → no admin bypass
claim admin + DB isDeleted=true → denied
DB ADMIN + isDeleted=true → denied
configured admin ID + active User → works
configured admin ID + isDeleted=true → denied
revoked admin cannot see draft/private playback
revoked admin cannot edit another user's comments
revoked admin cannot pin or moderate
channel page does not show Maintenance Required for an auth error
channel page distinguishes FORBIDDEN
channel page distinguishes MAIN_CHANNEL_NOT_FOUND
channel page distinguishes MAIN_CHANNEL_NOT_APPROVED
channel page distinguishes MAIN_CHANNEL_NOT_PRIMARY
channel page distinguishes INTERNAL_ERROR
admin routes do not perform double, contradictory authorization
public UI metadata is not the basis for server access
```

## Forbidden changes for the future implementation PR

Do not:

```txt
change PatronGrant semantics
weaken DB admin checks
grant admin solely by email
grant admin solely by publicMetadata or session claims
run maintenance automatically
change channel data
change video upload workflow in the auth ticket
combine auth implementation with video repair
```

The auth implementation must be a separate future PR.

After merge, auth must require independent post-merge verification before the control-plane can advance to video repair.

## Completion contract

The future implementation PR must end with:

```txt
implementation complete
verification pending
public launch NO_GO
```

It must require a later independent post-merge verification ticket covering canonical actor resolution, DB role authority, deleted-user denial, admin bypass boundaries, channel-page error classification and regression coverage for affected admin/public routes.
