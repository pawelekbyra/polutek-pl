# Reconciliation Report: X2-READY-001 Access Truth Inventory

## Summary
Inventory of current access decision points and comparison against the X2 target standard: **Active PatronGrant must be the backend source of truth for patron access.**

## Access Truth Map

| Decision Point | Logic / Implementation | Source of Truth | Classification |
| :--- | :--- | :--- | :--- |
| **Video Playback** | `checkVideoAccess` use case | `User.isPatron` (DB) | LEGACY |
| **Media Source API** | `/api/media-source/[videoId]` -> `checkVideoAccess` | `User.isPatron` (DB) | LEGACY |
| **Comments Write** | `lib/modules/comments/application` -> `checkVideoAccess` | `User.isPatron` (DB) | LEGACY |
| **Admin Users List** | `app/admin/users/page.tsx` | `User.isPatron` (DB) | LEGACY |
| **Admin Dashboard Stats** | `getAdminDashboardStats` use case | `User.isPatron` (DB) | LEGACY |
| **Frontend UI (Nav/Card)** | `userProfile.isPatron` (Context/Clerk) | Clerk Metadata | UNSAFE (as truth) / SAFE (as cache) |
| **Admin User Details** | `getAdminUserDetails` use case | Aggregates `User` + `PatronGrant` | SAFE |

## Detailed Findings

### 1. `checkVideoAccess` Gateway
The `checkVideoAccess` use case is correctly positioned as the central gateway for all video-related access (playback, media, comments). However, it currently relies on the `user.isPatron` boolean column in the `User` table.
- **Status**: LEGACY.
- **Target**: Must query `PatronRepository` for active grants.

### 2. Clerk Metadata Usage
Clerk metadata is correctly treated as a cache. `UserAccessService.syncClerkAccess` is called after patron mutations to keep it in sync. No evidence found of the backend trusting Clerk metadata as the source of truth.
- **Status**: SAFE (as cache).

### 3. Subscription/Email State
Subscription state (mailing consent) is correctly decoupled from Patron status. No evidence found of subscriptions granting patron access.
- **Status**: SAFE.

### 4. `User.isPatron` Source of Truth
While X1-FIX-005 ensured that `User.isPatron` is updated correctly during refunds by recalculating from grants, the fact that `checkVideoAccess` reads the boolean column instead of checking the grants directly makes the boolean column the "truth" for the access module, which violates the X2 principle.
- **Status**: LEGACY.

## Launch-critical Gaps
1. **`checkVideoAccess` uses `User.isPatron`**: This is the most critical gap. If the boolean field is manually changed or fails to sync during a complex mutation, the ground truth (grants) is ignored.
2. **Admin Filtering**: Admin users list filters by the boolean column. While usually acceptable for performance, it should be verified against active grants in sensitive operations.

## Proposed X2 Backlog

| ID | Title | Priority | Goal |
| :--- | :--- | :--- | :--- |
| **X2-FIX-001** | Migrate `checkVideoAccess` to PatronGrant ground truth | **Launch-Critical** | Update the access use case to check for active grants via `PatronRepository` instead of `User.isPatron`. |
| **X2-FIX-002** | Standardize Patron mutations to always originate from Grants | **Launch-Critical** | Audit all paths that modify `User.isPatron` and ensure they go through `grantPatron` / `revokePatron`. |
| **X2-FIX-003** | Cleanup legacy `isPatron` usage in Admin | Should-Have | Update admin queries to use grants for filtering where feasible or document the boolean as a performance cache only. |

## Owner Questions
- Should `User.isPatron` be kept as a performance cache, or should it be deprecated entirely in favor of a `count` or `exists` query on `PatronGrant`?
- (Recommended: Keep as cache for listing/stats, but use Grants for specific access decisions).

## Validation Results
- Code inspection of `lib/modules/access`, `lib/modules/patron`, and `app/api/media-source`.
- Architecture boundaries check: `npm run quality:architecture-boundaries` PASSED.
- Typecheck: PASSED.

## Merge Recommendation
**MERGE** - Inventory complete. Proceed to X2-FIX-001.
