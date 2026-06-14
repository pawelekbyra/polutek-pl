# ADMIN-COCKPIT-SPEC: Support and Operations Center

Status: ACTIVE

## 1. Canonical Admin Authorization

Admin access MUST be resolved by a canonical resolver merging:
1. `ADMIN_CLERK_USER_IDS` environment variable.
2. Database-level roles.
3. Explicit configured admin identifiers.
4. Resolution must distinguish: FORBIDDEN, MISSING_CONFIGURATION, and TECHNICAL_FAILURE.

## 2. Access Diagnostics

Every user profile in the admin cockpit MUST show the **Access Diagnostics** block:
- **Identity**: local user, Clerk ID, email, role, deleted/active status.
- **Patron Truth**: all grants, effective grants, sources, and lifecycle states.
- **Cache/Drift**: `User.isPatron` and Clerk metadata mismatches, sync attempts/errors.
- **Financial**: payments, eligibility details, refund/dispute status.
- **Subscription**: consent status (clarifying it does not grant access).
- **Audit**: manual/automated lifecycle changes with reasons and actor IDs.

## 3. Admin Override

- Admin overrides MUST be explicit in `AccessDecision`.
- Overridden playback MUST be excluded from public metrics and marked as `adminPreview`.
- Preview sessions do not mutate `User.isPatron` or cache.

## 4. Support Scenarios
- "Paid but locked": check eligibility and grant link.
- "Refund but access remains": check if independent grant exists.
- "Clerk/DB mismatch": trigger manual reconciliation.
