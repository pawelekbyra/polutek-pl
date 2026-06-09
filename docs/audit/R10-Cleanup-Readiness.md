# R10 Cleanup Readiness Score

This report evaluates the readiness of various domains for the final R10 cleanup phase.

| Domain | Status | Readiness Score | Justification |
|--------|--------|-----------------|---------------|
| **Users** | **READY** | 90% | Modularized in R5. Only a few admin routes and a small bridge in `lib/modules/users` remain. |
| **Video** | **PARTIAL** | 70% | Core logic moved to `lib/modules/video`. Mixed routes remain for analytics/playback events. |
| **Access** | **READY** | 85% | `lib/modules/access` is active. Only `lib/actions` and legacy `comments` still use the old `AccessPolicy`. |
| **Email** | **NOT READY** | 40% | Blocked by R9. Currently uses a legacy provider adapting `EmailService`. |
| **Comments** | **PARTIAL** | 60% | R8 core comments migrated to modular use cases and repository. |
| **Payments** | **PARTIAL** | 50% | R7 module foundation and checkout intent migrated. Webhook remains legacy. |
| **Patron** | **READY** | 80% | R7 module foundation and admin patron management migrated. |
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
- **Status**: Core migrated.
- **Next Steps**: Migrate admin comments, pin, and context routes to full modular implementation.

### Payments (R7) & Patron
- **Status**: Foundation ready.
- **Next Steps**: Migrate Stripe webhook, fulfillment, and refund logic to Payments module.
