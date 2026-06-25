# Runtime Service Import Inventory

## Purpose

This document inventories runtime imports from the legacy `lib/services/**` layer after the module refactor. It is a documentation-only cleanup artifact for issue #1115: it does not change runtime behavior, does not refactor imports, and does not delete or move production code.

The inventory classifies each current runtime usage so follow-up tickets can migrate the remaining service-layer dependencies in small, reviewable steps.

## Search method / commands used

Baseline/control-plane verification before editing:

```bash
sed -n '1,220p' AGENTS.md
sed -n '1,220p' docs/tickets/ready/README.md
sed -n '1,160p' docs/governance/BOLEK-OPERATING-MODEL.md
git status --short --branch
```

Runtime import search:

```bash
find . -maxdepth 4 -type d | sed 's#^./##' | rg '(^|/)services($|/)'
rg -n "@/lib/services|\.\.?/.*/lib/services|\.\.?/services" app lib --glob '!**/*.test.*' --glob '!**/*.spec.*'
rg -n "@/lib/services" app lib --glob '!lib/services/**'
```

Scope notes:

- The inventory below covers runtime source files under `app/**` and `lib/**` that import from `@/lib/services/**`.
- Imports inside `lib/services/**` itself are excluded because they are part of the legacy layer, not consumers of it.
- Tests and docs are excluded from the table because this issue asks for runtime imports.
- `scripts/resync-clerk-access.ts` imports `../lib/services/user-access.service`, but it is an operational script rather than application runtime; it should be reviewed separately if script import cleanup is later requested.

## Inventory

| File path | Imported service/module | Usage summary | Classification | Suggested next action |
| --- | --- | --- | --- | --- |
| `app/channel/[slug]/page.tsx` | `CreatorContentService` from `@/lib/services/content/creator.service` | Loads creator/channel data for metadata and channel page rendering. | migrate to modules | Add a channel/content read use case in modules and switch this route in a dedicated page-data ticket. |
| `app/sitemap.ts` | `CreatorContentService`, `VideoContentService` from `@/lib/services/content.service` | Builds sitemap creator and video URLs. | tolerate as read-side helper | Keep until content read models expose sitemap-specific queries; migrate with other public content reads. |
| `app/search/page.tsx` | `VideoContentService` from `@/lib/services/content/video.service` | Loads public videos before in-memory public search filtering. | tolerate as read-side helper | Replace with a public video search/read use case once available. |
| `app/search/page.tsx` | `normalizePublicVideoSearchQuery`, `searchPublicVideos` from `@/lib/services/public-video-search` | Pure search normalization/filtering helper for public search page. | tolerate as read-side helper | Either keep as a pure helper or move under a content/search module in a small cleanup ticket. |
| `app/page.tsx` | `loadHomeContent` from `@/lib/services/home-content.loader` | Loads homepage/channel content for metadata and home rendering. | migrate to modules | Create a home content read use case and migrate the page without changing behavior. |
| `app/page.tsx` | `normalizePaymentTotals` from `@/lib/services/user-access.service` | Normalizes user payment totals for decorative profile display. | migrate to modules | Replace with the existing users-domain payment total helper or expose a stable module export. |
| `app/api/channel/sidebar/route.ts` | `ChannelLayoutService` from `@/lib/services/channel/channel-layout.service` | Returns sidebar layout data for the channel API route. | migrate to modules | Introduce a channel sidebar read use case and switch the route in a focused API ticket. |
| `app/api/media-source/[videoId]/route.ts` | `PlaybackService` from `@/lib/services/playback/playback.service` | Builds/validates playback access and media source response for the media API route. | migrate to modules | Move playback-plan/media-source orchestration behind a module API, preserving denied-plan safety invariants. |
| `app/api/admin/users/[userId]/patron/route.ts` | `UserAccessService` from `@/lib/services/user-access.service` | Performs admin patron access mutation/read behavior for a specific user. | migrate to modules | Replace with patron/access module use cases and keep audit/reason behavior explicit. |
| `app/api/admin/users/route.ts` | `parseUserQueryParams` from `@/lib/services/admin/admin-query-parser` | Parses admin user list query parameters. | tolerate as read-side helper | Move parser to admin/users module when admin list endpoints are consolidated. |
| `app/api/admin/videos/route.ts` | `parseVideoQueryParams` from `@/lib/services/admin/admin-query-parser` | Parses admin video list query parameters. | tolerate as read-side helper | Move parser to admin/video module alongside list use case cleanup. |
| `app/admin/videos/page.tsx` | `AdminVideoListItem` from `@/lib/services/admin/videos-admin.dto` | DTO type for admin videos page/component props. | tolerate as read-side helper | Move DTO contracts to an admin video module or shared app type in a type-only cleanup. |
| `app/admin/videos/components/useAdminVideos.ts` | `AdminVideoListItem` from `@/lib/services/admin/videos-admin.dto` | DTO type for admin videos client-side fetch state. | tolerate as read-side helper | Include with the admin video DTO relocation ticket. |
| `app/admin/videos/components/VideoTable.tsx` | `AdminVideoListItem` from `@/lib/services/admin/videos-admin.dto` | DTO type for admin video table rows. | tolerate as read-side helper | Include with the admin video DTO relocation ticket. |
| `app/admin/videos/components/VideoTableWrapper.tsx` | `AdminVideoListItem` from `@/lib/services/admin/videos-admin.dto` | DTO type for admin video table wrapper props. | tolerate as read-side helper | Include with the admin video DTO relocation ticket. |
| `app/admin/users/payments/page.tsx` | `AdminPaymentListItem`, `AdminPaymentsListResponse` from `@/lib/services/admin/payments-admin.dto` | DTO types for admin user payments page. | tolerate as read-side helper | Move admin payment DTO contracts to a payments/admin module in a type-only cleanup. |
| `app/admin/comments/page.tsx` | `CommentDto` from `@/lib/services/comments/comment.dto` | DTO type for admin comments display. | tolerate as read-side helper | Move comment DTO contracts to the comments module when comment admin reads are consolidated. |
| `app/components/comments/components/ReportDialog.tsx` | `CommentReportReasonDto` from `@/lib/services/comments/comment.dto` | DTO type for comment report reason values. | tolerate as read-side helper | Move comment DTO contracts to the comments module in a type-only cleanup. |
| `app/components/comments/components/CommentItem.tsx` | `CommentReportReasonDto` from `@/lib/services/comments/comment.dto` | DTO type for report action props. | tolerate as read-side helper | Include with the comment DTO relocation ticket. |
| `app/components/comments/EmbeddedComments.tsx` | `AccessTierDto` from `@/lib/services/comments/comment.dto` | DTO type for embedded comments access tier props. | tolerate as read-side helper | Include with the comment DTO relocation ticket. |
| `app/components/PremiumWrapper.tsx` | Playback DTOs from `@/lib/services/playback/playback.dto` | Playback plan/status DTO types for premium gating UI. | tolerate as read-side helper | Move playback DTO contracts to the media/playback module before service removal. |
| `app/components/PremiumWrapper.tsx` | `AccessTierDto` from `@/lib/services/comments/comment.dto` | Access tier DTO type shared with premium wrapper props. | tolerate as read-side helper | Include with DTO relocation; avoid changing UI behavior in that ticket. |
| `app/components/AccessLockOverlay.tsx` | `PlaybackPlanStatus` from `@/lib/services/playback/playback.dto` | Type-only playback status import for locked overlay display. | tolerate as read-side helper | Include with playback DTO contract relocation. |
| `lib/actions/user.ts` | `UserLanguageService` from `@/lib/services/user/language.service` | Server action updates user language and revalidates layout. | migrate to modules | Add a users module language update use case and switch the server action. |
| `lib/modules/payments/application/fulfill-payment.use-case.ts` | `EmailService` from `@/lib/services/email.service` | Sends legacy transactional email during payment fulfillment. | keep as temporary legacy adapter | Keep until the email module provider/use cases cover this transactional send path. |
| `lib/modules/payments/application/fulfill-payment.use-case.ts` | `UserAccessService` from `@/lib/services/user-access.service` | Bridges payment fulfillment to patron/access grant behavior. | migrate to modules | Replace with patron grant/access module use cases in a payment fulfillment boundary ticket. |
| `lib/modules/payments/application/fulfill-payment.use-case.ts` | `writeAuditLog` from `@/lib/services/audit.service` | Writes audit log for payment fulfillment side effects. | migrate to modules | Introduce/use a module audit port to remove direct service dependency. |
| `lib/modules/payments/application/handle-refund.use-case.ts` | `UserAccessService` from `@/lib/services/user-access.service` | Applies refund effects to patron/access state. | migrate to modules | Replace with patron grant lifecycle use cases for refund revocation. |
| `lib/modules/payments/application/handle-dispute.use-case.ts` | `UserAccessService` from `@/lib/services/user-access.service` | Applies dispute effects to patron/access state. | migrate to modules | Replace with patron grant lifecycle use cases for dispute suspend/reactivate/revoke. |
| `lib/modules/users/application/sync-user-from-webhook.use-case.ts` | `EmailService` from `@/lib/services/email.service` | Sends legacy account lifecycle transactional emails from Clerk webhook sync. | keep as temporary legacy adapter | Keep as an explicit R5/R9 bridge until email module transactional sends are available. |
| `lib/modules/users/application/export-admin-users.use-case.ts` | `writeAuditLog` from `@/lib/services/audit.service` | Audits admin user export action. | migrate to modules | Introduce/use an audit module port for admin export audit writes. |
| `lib/modules/users/application/get-or-create-current-user.use-case.ts` | `UserProfileService` from `@/lib/services/user/profile.service` | Modular bridge delegates user creation/conflict resolution to legacy profile service. | keep as temporary legacy adapter | Keep until complex user synchronization and account merge logic are moved into the users module. |
| `lib/modules/email/infrastructure/legacy-email-service-provider.ts` | `EmailService` from `@/lib/services/email.service` | Adapter implementation for the email module provider interface. | keep as temporary legacy adapter | Keep as the named legacy adapter until email sending is fully module-owned. |
| `lib/modules/video/application/get-admin-video-diagnostics.use-case.ts` | `hasReadyProviderBackedPlaybackAsset`, `isLegacyPrivatePlaybackFallbackAllowed` from `@/lib/services/playback/legacy-private-fallback.policy` | Checks legacy private playback fallback policy in admin diagnostics. | prepare separate removal ticket | Move fallback policy into video/media domain and retire service-layer policy import separately. |
| `lib/launch/content-diagnostics.ts` | `visiblePublishedAtFilter` from `@/lib/services/content/video.service` | Reuses published visibility predicate for launch content diagnostics. | tolerate as read-side helper | Move visibility predicate to a content/video policy module when content service reads are migrated. |

## Recommended next tickets

1. **Move DTO-only service imports to module/shared contracts.** Relocate admin video, admin payment, comment, and playback DTO exports from `lib/services/**` to module or app contract files, then update type-only consumers without changing runtime behavior.
2. **Migrate public content read helpers.** Add module read use cases for homepage, channel page, sitemap, search, sidebar, and launch diagnostics, then replace the read-side service imports route by route.
3. **Replace user/access service bridges in payment lifecycle.** Move payment fulfillment, refund, dispute, and admin patron access behavior to patron/access module use cases while preserving PatronGrant source-of-truth and audit requirements.
4. **Introduce a module audit port.** Replace direct `writeAuditLog` service imports in payment and admin user module use cases with a module-owned audit abstraction.
5. **Retire explicit legacy adapters after replacements exist.** Once transactional email and user profile synchronization are module-owned, remove `LegacyEmailServiceProvider` and the remaining `UserProfileService`/`EmailService` bridge imports in separate small PRs.
