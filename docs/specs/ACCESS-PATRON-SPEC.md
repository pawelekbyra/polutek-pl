# ACCESS-PATRON-SPEC: Patron Access and Identity Truth

Status: ACTIVE
Launch status: **NO_GO**

## 1. Domain Invariants

- **Patron Access Truth**: Only the existence of an **ACTIVE PatronGrant** determines patron-level access.
- **Identity != Authorization**: Clerk provides identity; the local `Access` module provides authorization.
- **Denormalization**: `User.isPatron` is a read-only cache. If it conflicts with `PatronGrant`, the grant wins.

## 2. AccessDecision Contract

All access-sensitive routes MUST use the canonical `AccessDecision` contract:

```ts
type AccessDecision = {
  allowed: boolean;
  reason:
    | "PUBLIC" | "AUTHENTICATED" | "ACTIVE_PATRON_GRANT"
    | "ADMIN_OVERRIDE" | "LOGIN_REQUIRED" | "PATRON_REQUIRED"
    | "FORBIDDEN" | "ERROR";
  decisionSource: "PUBLIC_POLICY" | "ACTIVE_PATRON_GRANT" | "ADMIN_OVERRIDE" | "DENY_POLICY";
  adminOverride: boolean;
  evaluatedAt: string;
};
```

## 3. Drift Reconciliation

- **Admin Diagnostics**: Admin dashboard must show both the cache (`User.isPatron`) and the truth (`PatronGrant`) and highlight mismatches.
- **Durable Clerk Repair**: Sync failures to Clerk must be durable (retry table) and auditable.

## 4. Forbidden Shortcuts

- **DO NOT** check `User.isPatron` in backend authorization paths.
- **DO NOT** trust Clerk metadata for backend access truth.
- **DO NOT** bypass the Access module in Playback or Comment routes.
