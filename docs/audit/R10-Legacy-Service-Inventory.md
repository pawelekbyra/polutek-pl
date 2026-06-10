# R10 Legacy Service Inventory

This report identifies all legacy services in `lib/services/**` and their current usage status as of the R10 Foundation Preparation Pass.

## Classification Definitions

- **ACTIVE**: Currently used by runtime (App Router or API).
- **BRIDGE**: Used by new modules as a bridge to legacy logic.
- **DEPRECATED**: Replaced by modules or newer services, but still has some (often test) usage.
- **DEAD**: No runtime usage found; safe to remove after verifying test coverage.

## Service Inventory

| Service | Status | Usage | Replaced By |
|---------|--------|-------|-------------|
| `playback/playback.service.ts` | **ACTIVE** | `app/api/media-source/[videoId]/route.ts` | - |
| `content.visibility.ts` | **DEAD** | None | `lib/modules/video`? |
| `patron.service.ts` | **ACTIVE** | `app/api/admin/users/[userId]/patron/route.ts` | - |
| `user-access.service.ts` | **ACTIVE** | `app/api/admin/users/export/route.ts`, `app/page.tsx` | - |
| `home-content.loader.ts` | **ACTIVE** | `app/page.tsx` | - |
| `user/language.service.ts` | **ACTIVE** | `lib/actions/user.ts` | `lib/modules/users` |
| `user/profile.service.ts` | **BRIDGE** | `lib/modules/users/application/get-or-create-current-user.use-case.ts` | `lib/modules/users` |
| `user/admin.service.ts` | **DEPRECATED** | Only referenced via `user.service.ts` (dead) | - |
| `user/subscription.service.ts` | **DEPRECATED** | Only referenced via `user.service.ts` (dead) | - |
| `payments/checkout.service.ts` | **DEPRECATED** | - | `lib/modules/payments` |
| `payments/fulfillment.service.ts` | **DEPRECATED** | - | `lib/modules/payments` |
| `payments/refund.service.ts` | **DEPRECATED** | - | `lib/modules/payments` |
| `audit.service.ts` | **ACTIVE** | Admin routes (`templates`, `users/export`) | `lib/modules/audit` |
| `payment.service.ts` | **DEPRECATED** | - | `lib/modules/payments` |
| `email.service.ts` | **BRIDGE** | `lib/modules/email/infrastructure/legacy-email-service-provider.ts` | `lib/modules/email` |
| `content/video.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/video` |
| `content/creator.service.ts` | **ACTIVE** | `app/page.tsx`, `app/channel/[slug]/page.tsx` | `lib/modules/channel`? |
| `channel/channel-layout.service.ts` | **ACTIVE** | `app/api/channel/sidebar/route.ts` | `lib/modules/channel` |
| `content.service.ts` | **ACTIVE** | `app/sitemap.ts` | - |
| `referral.service.ts` | **ACTIVE** | `app/api/user/referrals/claim/route.ts` | - |
| `admin/admin-query-parser.ts` | **ACTIVE** | Various `app/api/admin/**` routes | - |
| `admin/videos-diagnostics.service.ts` | **ACTIVE** | `app/api/admin/videos/[id]/route.ts` | - |
| `admin/payments-admin.service.ts` | **DEPRECATED** | - | `lib/modules/payments` |
| `comments/comment.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/comments` |
| `comments/comment-reaction.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/comments` |
| `comments/comment-audit.service.ts` | **DEAD** | None | `lib/modules/audit` |
| `comments/comment-report.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/comments` |
| `comments/comment-access.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/comments` |
| `comments/comment-moderation.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/comments` |
| `storage/storage.service.ts` | **ACTIVE** | `lib/services/playback/playback.service.ts` | `lib/modules/media` |
| `user.service.ts` | **DEAD** | None | Replaced by specialized services and modules |

## Summary of Findings

- **Runtime dependency**: Many services are still heavily used by API routes that are pending migration (especially Comments R8 and Payments R7).
- **Redundancy**: `user.service.ts` and `content.visibility.ts` appear to be completely unused in the current codebase.
- **Audit overlap**: Both `audit.service.ts` and `lib/modules/audit` exist. The legacy one is still used by admin routes.
- **Modularization status**:
    - Users (R5): Mostly bridged or moved to modules.
    - Payments (R7): Core runtime and administrative flows moved to modular use cases. Legacy services are deprecated.
    - Comments (R8): Still relies entirely on legacy `comments/` services.
