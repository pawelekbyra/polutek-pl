# R10 Cleanup Readiness Score

This report evaluates the readiness of various domains for the final R10 cleanup phase.

| Domain | Status | Readiness Score | Justification |
|--------|--------|-----------------|---------------|
| **Users** | **READY** | 90% | Modularized in R5. Only a few admin routes and a small bridge in `lib/modules/users` remain. |
| **Video** | **PARTIAL** | 70% | Core logic moved to `lib/modules/video`. Mixed routes remain for analytics/playback events. |
| **Access** | **READY** | 85% | `lib/modules/access` is active. Only `lib/actions` and legacy `comments` still use the old `AccessPolicy`. |
| **Email** | **NOT READY** | 40% | Blocked by R9. Currently uses a legacy provider adapting `EmailService`. |
| **Comments** | **NOT READY** | 10% | Blocked by R8. Entirely dependent on legacy `lib/services/comments`. |
| **Payments** | **PARTIAL** | 30% | Blocked by R7. Many routes still use direct Prisma and legacy `PaymentService`. |
| **Patron** | **PARTIAL** | 50% | Closely tied to Payments. `patron.service.ts` is still active. |
| **Admin** | **PARTIAL** | 20% | Admin routes are the biggest "offenders" for direct Prisma and legacy audit service usage. |

## Detailed Breakdown

### Users (R5)
- **Status**: Mostly migrated.
- **Next Steps**: Eliminate `UserProfileService` bridge and migrate `admin/users` routes.

### Video (R6) & Media (R3)
- **Status**: Good progress on modularization.
- **Next Steps**: Move `playback-event` persistence to Video module repository.

### Access
- **Status**: Module is solid.
- **Next Steps**: Switch Comments and interactions to use `checkVideoAccess`.

### Comments (R8)
- **Status**: Pre-migration.
- **Next Steps**: Complete R8 to move all logic to `lib/modules/comments`.

### Payments (R7) & Patron
- **Status**: In progress.
- **Next Steps**: Finish R7 to eliminate `PaymentService` and direct Prisma usage in checkout/subscriptions.
