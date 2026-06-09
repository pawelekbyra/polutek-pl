# R10 Dead Code Candidates

This report identifies files and code structures that appear to be unused or redundant and are candidates for removal after R7/R8/R9.

## High Confidence Removal (DEAD)

These files have zero runtime or test usage and can be removed safely after a final sanity check.

- `lib/services/user.service.ts`: Fully deprecated and replaced by specialized services. All its methods are proxies.
- `lib/services/content.visibility.ts`: No imports found in the codebase. Likely replaced by modular video/access checks.
- `lib/services/comments/comment-audit.service.ts`: No imports found. Auditing has moved to `lib/modules/audit`.

## Medium Confidence Removal (DEPRECATED)

These files are used only by other deprecated services or in legacy test suites.

- `lib/services/user/admin.service.ts`: Only used by `user.service.ts` (dead) and `profile.service.ts` (bridge).
- `lib/services/user/subscription.service.ts`: Only used by `user.service.ts` (dead).
- `lib/services/content/video.service.ts`: Only used in tests. Runtime usage has moved to `lib/modules/video`.
- `lib/services/content.service.ts`: Acts as a facade for `content/video.service.ts` and `content/creator.service.ts`. Should be eliminated once those services are fully modularized.

## Low Confidence / Blocked Removal

These are currently used but should be targeted for removal after specific roadmap milestones.

- `lib/services/audit.service.ts`: Blocked by R10 (full migration of admin routes to `lib/modules/audit`).
- `lib/services/user/profile.service.ts`: Blocked until `lib/modules/users` no longer needs it as a bridge.
- `lib/services/email.service.ts`: Blocked until R9 (Email module) is complete and legacy provider is removed.
- `lib/services/storage/storage.service.ts`: Blocked until `lib/modules/media` fully takes over signed URL generation.

## Unused DTOs & Helpers

- (TBD) Specific DTOs within `lib/services/**/comment.dto.ts` that might not be used by the frontend anymore.
