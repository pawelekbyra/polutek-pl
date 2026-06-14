# ADMIN-COCKPIT-SPEC: Support and Operations Center

Status: ACTIVE

## 1. Canonical Admin Authorization

Admin access MUST be resolved by a canonical resolver merging:
1. `ADMIN_CLERK_USER_IDS` environment variable.
2. Database-level roles (if applicable).
3. Explicit configured admin identifiers.

## 2. Access Diagnostics

Every user profile in the admin cockpit MUST show the **Access Diagnostics** block:
- **Identity**: local user vs Clerk identity.
- **Patron Truth**: all grants and their statuses.
- **Cache/Drift**: `User.isPatron` and Clerk metadata mismatches.
- **Financial**: payments and linked grants.

## 3. Admin Override

- Admin overrides MUST be explicit in `AccessDecision`.
- Overridden playback MUST be excluded from public metrics and marked as `adminPreview`.
