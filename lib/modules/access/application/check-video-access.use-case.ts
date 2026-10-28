import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { AccessDecisionDto } from "../domain/access-decision.dto";
import { can, toPrincipal } from "@/lib/modules/authz";
// Deep import deliberate: many tests mock the whole @/lib/modules/channel barrel
// narrowly, and this is a pure, side-effect-free policy class — routing it through
// that barrel would force every such test to also mock MainChannelPolicy.
// Allowlisted in scripts/check-architecture.ts.
import { MainChannelPolicy } from "@/lib/modules/channel/domain/channel.policy";
import { VideoStatus } from "@prisma/client";
import { toVideoAccessTier } from "@/lib/access-tier";
import { canUseDemoFallbacks } from "@/lib/feature-flags";
import { isUpcomingPremiere, toPremiereDate } from "@/lib/modules/video/domain/premiere";
import { isAdultVideo, isLinkAccessibleStatus } from "@/lib/modules/video/domain/video-visibility";
import { premiumPassGate } from "@/lib/modules/patron-zone"; // patron zone (docs/architecture/patron-zone.md)

export type CheckVideoAccessInput = {
  videoIdOrSlug: string;
};

/**
 * checkVideoAccess is the central decision point for video content gating.
 * It enforces channel visibility (the video's own channel, CLAUDE.md 4.24), moderation state, publication
 * rules and tier-based access. Slugs are globally unique, so the channel never has to be passed in.
 */
export async function checkVideoAccess(
  input: CheckVideoAccessInput,
  ctx: AppContext
): Promise<UseCaseResult<AccessDecisionDto, never>> {
  const { videoIdOrSlug } = input;
  const { actor, prisma } = ctx;
  const now = ctx.now();

  // 1. Resolve the video together with its own channel
  const { isUuid } = await import("@/lib/utils/uuid");
  let video = await prisma.video.findFirst({
    where: isUuid(videoIdOrSlug) ? { id: videoIdOrSlug } : { slug: videoIdOrSlug },
    include: {
        creator: {
            // The asking user's own membership too (audit S18): a manager, editor, moderator or translator
            // of the video's channel may preview it, not only the owner. Never the whole member list.
            select: {
              id: true, slug: true, userId: true, status: true, deletedAt: true,
              members: { where: { userId: actor.type === 'user' ? actor.userId : '' }, select: { userId: true, role: true } },
            }
        }
    }
  });

  // Handle demo fallbacks if enabled
  if (!video && canUseDemoFallbacks()) {
      const { INITIAL_VIDEOS } = await import("@/lib/data/initial-content");
      const fallback = INITIAL_VIDEOS.find(v => v.id === videoIdOrSlug || v.slug === videoIdOrSlug);
      if (fallback) {
          // Map fallback to expected shape
          video = {
              ...fallback,
              publishedAt: fallback.publishedAt ? new Date(fallback.publishedAt) : null,
              createdAt: new Date(),
              updatedAt: new Date(),
          } as any;
      }
  }

  if (!video) return ok({ hasAccess: false, reason: "NOT_FOUND" });

  // 2. Who may look at an unpublished or hidden video: platform staff, and members of the video's channel whose
  // role allows `video.preview` (CLAUDE.md 4.23). Nobody else, whatever they pass in.
  const channel = video.creator;
  const isStaff = actor.type === 'admin';
  const canPreview = isStaff || (
    actor.type === 'user' && !!channel &&
    can(toPrincipal(actor), "video.preview", { id: channel.id, ownerUserId: channel.userId, status: channel.status, members: channel.members ?? [] }).allow
  );

  // 3. Channel visibility (any channel, not only the main one)
  const channelVisible = !!channel && MainChannelPolicy.isPubliclyVisible(channel);

  // For fallbacks there is no channel row; demo content is public.
  if (!channelVisible && !canPreview && !canUseDemoFallbacks()) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  // 4. Moderation and visibility rules (Removed/Archived/Published/Draft)
  const moderation = (video as { moderationStatus?: string }).moderationStatus;
  if (moderation === 'REMOVED' && !isStaff) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  if (video.status === VideoStatus.ARCHIVED) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  // PUBLISHED and UNLISTED are both reachable with the link and follow the same tier rules; UNLISTED is only
  // kept off the lists (the list queries filter PUBLISHED themselves).
  const isPublished = isLinkAccessibleStatus(video.status) &&
                      (!video.publishedAt || video.publishedAt <= now);

  if (!isPublished && !canPreview) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  // From here on the decision is about this one row, whether it was asked for by id or by slug:
  // callers load the video by `videoId` (never by their raw input) and apply the premiere gate
  // from `premiereAt`, so a slug cannot skip it (audit SEC-10). The tier decision itself does not
  // change: comments on an upcoming premiere stay usable (CLAUDE.md "Premieres").
  const resolvedVideoId = video.id;
  const upcomingPremiereAt = !canPreview && isUpcomingPremiere(video, now)
    ? toPremiereDate(video.premiereAt)?.toISOString()
    : undefined;
  let premiumPassUntil: string | undefined;
  let premiumPassGated = false;
  const decide = (decision: AccessDecisionDto) =>
    ok({ ...decision, videoId: resolvedVideoId, ...(upcomingPremiereAt ? { premiereAt: upcomingPremiereAt } : {}), ...(decision.hasAccess && premiumPassUntil ? { premiumPassUntil } : {}), ...(decision.hasAccess && premiumPassGated ? { premiumPassGated } : {}) });

  // patron zone (docs/architecture/patron-zone.md): a live video behind the demo pass needs an active
  // pass, for staff on the public site too (owner decision 2026-10-20). Off = null, nothing changes.
  const passGate = isPublished ? await premiumPassGate(ctx, video, now) : null;
  if (passGate && "denied" in passGate) return decide({ hasAccess: false, reason: "PASS_REQUIRED" });
  if (passGate) premiumPassGated = true;
  if (passGate) premiumPassUntil = passGate.activeUntil ?? undefined; // lifetime access has no end date to show

  // Staff and members of the channel with `video.preview` see their non-archived content
  if (canPreview) return decide({ hasAccess: true });

  // Adult videos are for signed-in viewers only (moderation state or the creator's own 18+ declaration, not the
  // access tier).
  if (isAdultVideo({ moderationStatus: moderation, isAdult: (video as { isAdult?: boolean }).isAdult }) && actor.type === 'guest') {
    return decide({ hasAccess: false, reason: "LOGIN_REQUIRED", requiredTier: "LOGGED_IN" });
  }

  // 5a. Paid videos (stage 6): the viewer needs a live entitlement. Read from the raw column on purpose:
  // `toVideoAccessTier` maps every unknown value to LOGGED_IN, which would let any account in.
  if ((video.tier as string) === "PAID") {
    if (actor.type === 'guest') {
      return decide({ hasAccess: false, reason: "LOGIN_REQUIRED", requiredTier: "LOGGED_IN" });
    }
    if (actor.type !== 'user') return decide({ hasAccess: false, reason: "FORBIDDEN" });
    const entitlement = await prisma.entitlement.findFirst({
      where: { userId: actor.userId, videoId: resolvedVideoId, revokedAt: null },
      select: { id: true },
    });
    return entitlement
      ? decide({ hasAccess: true })
      : decide({ hasAccess: false, reason: "PAYMENT_REQUIRED", requiredTier: "LOGGED_IN" });
  }

  // 5. Tier-based access: two levels (lib/access-tier.ts).
  const tier = toVideoAccessTier(video.tier);
  if (tier === "PUBLIC") return decide({ hasAccess: true });

  if (actor.type === 'guest') {
    return decide({
        hasAccess: false,
        reason: "LOGIN_REQUIRED",
        requiredTier: tier
    });
  }

  // 6. LOGGED_IN: any signed-in, not deleted account
  if (actor.type !== 'user') {
    // Should not happen for authenticated non-admin actors but for safety:
    return decide({ hasAccess: false, reason: "FORBIDDEN" });
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId }
  });

  // Missing or deleted local user
  if (!user) return decide({ hasAccess: false, reason: "FORBIDDEN" });
  if (user.isDeleted) return decide({ hasAccess: false, reason: "DELETED" });

  // Support is a voluntary donation that grants nothing (CLAUDE.md §4.4): never add a
  // PatronGrant check here.
  return decide({ hasAccess: true });
}
