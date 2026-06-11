# R10 Legacy Service Inventory

This report identifies all legacy services in `lib/services/**` and their current usage status.

## Classification Definitions

- **ACTIVE**: Currently used by runtime (App Router, API, or Server Actions).
- **BRIDGE**: Used by new modules as a bridge to legacy logic.
- **DEPRECATED**: Replaced by modules or newer services, but still has test usage.
- **REMOVED**: Successfully deleted from the codebase.

## Service Inventory

| Service | Status | Usage | Replaced By |
|---------|--------|-------|-------------|
| `playback/playback.service.ts` | **ACTIVE** | `app/api/media-source/[videoId]/route.ts` | - |
| `content.visibility.ts` | **REMOVED** | None | `lib/modules/video` |
| `patron.service.ts` | **ACTIVE** | Staged for removal, but retained for test stability | `lib/modules/patron` |
| `user-access.service.ts` | **ACTIVE** | `app/page.tsx`, `app/api/admin/users/[userId]/patron/route.ts` | `lib/modules/access` |
| `home-content.loader.ts` | **ACTIVE** | `app/page.tsx` | - |
| `user/language.service.ts` | **ACTIVE** | `lib/actions/user.ts` | `lib/modules/users` |
| `user/profile.service.ts` | **BRIDGE** | `lib/modules/users` | `lib/modules/users` |
| `user/admin.service.ts` | **ACTIVE** | Internal helper | - |
| `user/subscription.service.ts` | **ACTIVE** | Internal helper | - |
| `payments/checkout.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/payments` |
| `payments/fulfillment.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/payments` |
| `payments/refund.service.ts` | **ACTIVE** | Retained for stability | `lib/modules/payments` |
| `audit.service.ts` | **ACTIVE** | Bridge | `lib/modules/audit` |
| `payment.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/payments` |
| `email.service.ts` | **BRIDGE** | Bridge | `lib/modules/email` |
| `content/video.service.ts` | **DEPRECATED** | Only test usage | `lib/modules/video` |
| `content/creator.service.ts` | **ACTIVE** | Runtime usage | `lib/modules/channel` |
| `channel/channel-layout.service.ts` | **ACTIVE** | Runtime usage | `lib/modules/channel` |
| `content.service.ts` | **ACTIVE** | Runtime usage | - |
| `referral.service.ts` | **ACTIVE** | Runtime usage | - |
| `admin/admin-query-parser.ts` | **ACTIVE** | Runtime usage | - |
| `admin/payments-admin.service.ts` | **ACTIVE** | Retained for stability | `lib/modules/payments` |
| `comments/comment.service.ts` | **REMOVED** | None | `lib/modules/comments` |
| `comments/comment-reaction.service.ts` | **REMOVED** | None | `lib/modules/comments` |
| `comments/comment-audit.service.ts` | **REMOVED** | None | `lib/modules/audit` |
| `comments/comment-report.service.ts` | **REMOVED** | None | `lib/modules/comments` |
| `comments/comment-access.service.ts` | **REMOVED** | None | `lib/modules/comments` |
| `comments/comment-moderation.service.ts` | **REMOVED** | None | `lib/modules/comments` |
| `storage/storage.service.ts` | **ACTIVE** | Internal helper | `lib/modules/media` |
| `user.service.ts` | **ACTIVE** | Bridge | - |

## Summary of Findings

- **R10 Comments Admin**: Admin moderation routes are now fully modularized and legacy comment services removed.
- **R10 Dead Code**: Successfully removed all `lib/services/comments/` moderation services and `content.visibility.ts`.
