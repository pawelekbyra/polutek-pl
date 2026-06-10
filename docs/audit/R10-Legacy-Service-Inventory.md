# R10 Legacy Service Inventory

This report identifies all legacy services in `lib/services/**` and their current usage status as of the R10 Foundation Preparation Pass.

## Classification Definitions

- **ACTIVE**: Currently used by runtime (App Router, API, or Server Actions).
- **BRIDGE**: Used by new modules as a bridge to legacy logic.
- **DEPRECATED**: Replaced by modules or newer services, but still has test usage.
- **DEAD**: No runtime usage found; safe to remove after verifying test coverage.

## Service Inventory

| Service | Status | Usage | Replaced By |
|---------|--------|-------|-------------|
| `playback/playback.service.ts` | **ACTIVE** | `app/api/media-source/[videoId]/route.ts` | - |
| `content.visibility.ts` | **DEAD** | None | `lib/modules/video` |
| `patron.service.ts` | **DEAD** | Only test usage | `lib/modules/patron` |
| `user-access.service.ts` | **ACTIVE** | `app/page.tsx`, `app/api/admin/users/[userId]/patron/route.ts` | `lib/modules/access` |
| `home-content.loader.ts` | **ACTIVE** | `app/page.tsx` | - |
| `user/language.service.ts` | **ACTIVE** | `lib/actions/user.ts` | `lib/modules/users` |
| `user/profile.service.ts` | **BRIDGE** | `lib/modules/users` | `lib/modules/users` |
| `user/admin.service.ts` | **DEAD** | None | - |
| `user/subscription.service.ts` | **DEAD** | None | - |
| `payments/checkout.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/payments` |
| `payments/fulfillment.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/payments` |
| `payments/refund.service.ts` | **DEAD** | None | `lib/modules/payments` |
| `audit.service.ts` | **ACTIVE** | `app/api/admin/templates/route.ts`, `lib/modules/users` | `lib/modules/audit` |
| `payment.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/payments` |
| `email.service.ts` | **BRIDGE** | `lib/modules/email/infrastructure`, `lib/modules/payments` | `lib/modules/email` |
| `content/video.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/video` |
| `content/creator.service.ts` | **ACTIVE** | `app/page.tsx`, `app/channel/[slug]/page.tsx` | `lib/modules/channel` |
| `channel/channel-layout.service.ts` | **ACTIVE** | `app/api/channel/sidebar/route.ts` | `lib/modules/channel` |
| `content.service.ts` | **ACTIVE** | `app/sitemap.ts` | - |
| `referral.service.ts` | **ACTIVE** | `app/api/user/referrals/claim/route.ts` | - |
| `admin/admin-query-parser.ts` | **ACTIVE** | `app/api/admin/videos/route.ts`, `app/api/admin/users/route.ts` | - |
| `admin/videos-diagnostics.service.ts` | **ACTIVE** | `app/api/admin/videos/[id]/route.ts` | - |
| `admin/payments-admin.service.ts` | **DEAD** | None | `lib/modules/payments` |
| `comments/comment.service.ts` | **ACTIVE** | `app/api/admin/comments/[commentId]/heart/route.ts` | `lib/modules/comments` |
| `comments/comment-reaction.service.ts` | **DEAD** | None | `lib/modules/comments` |
| `comments/comment-audit.service.ts` | **DEAD** | None | `lib/modules/audit` |
| `comments/comment-report.service.ts` | **ACTIVE** | `app/api/admin/comments/reports/route.ts` | `lib/modules/comments` |
| `comments/comment-access.service.ts` | **DEAD** | None | `lib/modules/comments` |
| `comments/comment-moderation.service.ts` | **ACTIVE** | `app/api/admin/comments/[commentId]/hide/route.ts` | `lib/modules/comments` |
| `storage/storage.service.ts` | **ACTIVE** | `lib/services/playback/playback.service.ts` | `lib/modules/media` |
| `user.service.ts` | **DEAD** | None | Replaced by specialized services and modules |

## Summary of Findings

- **Runtime dependency**: Many services are still heavily used by API routes or server actions.
- **R8 Comments Admin**: While public comment routes are modular, Admin moderation routes still use legacy services.
- **R10 Dead Code**: `user.service.ts`, `content.visibility.ts`, `patron.service.ts`, and various comment/user sub-services are completely unused in the current runtime and are primary candidates for deletion.
- **Audit overlap**: Both `audit.service.ts` and `lib/modules/audit` exist. The legacy one is still used by several modules and admin routes.
- **Modularization status**:
    - Users (R5): Mostly bridged or moved to modules.
    - Payments (R7): Core runtime moved to modular use cases. Subscriptions and some admin views remain legacy.
    - Comments (R8): Fully migrated for public routes; admin moderation remains legacy.
    - Email (R9): Webhooks and Broadcast are modular. Templates remain legacy (direct Prisma + AuditService).
