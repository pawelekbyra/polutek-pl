# Reconciliation Report: X2-FIX-001 - Check Video Access PatronGrant Truth

## 1. Summary
This ticket migrates the `checkVideoAccess` use case to rely on the active `PatronGrant` ground truth instead of the denormalized `User.isPatron` boolean for patron-only video access.

## 2. What Changed
- **`checkVideoAccess` Use Case**: Updated the `AccessTier.PATRON` logic to call `getPatronStatus(user.id, ctx)` and check if `activeGrants.length > 0`.
- **Tests**: Updated `tests/unit/modules/access/check-video-access.use-case.test.ts` to mock `getPatronStatus` and added test cases to verify that access is granted based on active grants, even if `User.isPatron` is stale (false when it should be true, or true when it should be false).

## 3. What Did Not Change
- `User.isPatron` field remains in the database and actor context (as a cache/diagnostic field).
- Admin bypass behavior remains unchanged.
- Public and Logged-in video access logic remains unchanged.
- Anonymous user behavior remains unchanged.
- No changes were made to the PatronGrant schema or the payment/refund lifecycle.

## 4. Evidence of Ground Truth Migration
In `lib/modules/access/application/check-video-access.use-case.ts`:
```typescript
  if (video.tier === AccessTier.PATRON) {
    // X2 Standard: Active PatronGrant is the ground truth for access.
    // User.isPatron may be stale; we rely on real-time grant lookup.
    const patronStatusResult = await getPatronStatus(user.id, ctx);

    if (patronStatusResult.ok && patronStatusResult.data.activeGrants.length > 0) {
      return ok({ hasAccess: true });
    }

    return ok({
        hasAccess: false,
        reason: "PATRON_REQUIRED",
        requiredTier: AccessTier.PATRON
    });
  }
```
The test suite now explicitly covers these scenarios:
- `allows patron based on active PatronGrant (ignoring User.isPatron false)`
- `denies patron based on missing active PatronGrant (ignoring User.isPatron true)`

## 5. Validation Results
- `npm run quality:architecture-boundaries`: PASSED
- `npm run typecheck`: PASSED
- `npm test -- tests/unit/modules/access/check-video-access.use-case.test.ts --run`: PASSED (19 tests)

## 6. Remaining Risks
- Performance: Every check for a patron video now involves a real-time lookup of active grants. Given the current single-channel scope and low expected grant volume per user, this is acceptable. If performance becomes an issue, we can consider more aggressive caching.
- Stale `isPatron` field: While access is now correct, the `isPatron` field in the database might still be stale in some cases until the next reconciliation/recalculation event.

## 7. Next Recommended Ticket
- `X2-FIX-002-migrate-comment-write-access-to-patron-grant-truth`

## Merge Recommendation
**MERGE / FIX**
