import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { AccessDecisionDto } from "../domain/access-decision.dto";
import { MainChannelService } from "@/lib/modules/channel";
// Deep import deliberate: many tests mock the whole @/lib/modules/channel barrel
// narrowly (for MainChannelService only), and this is a pure, side-effect-free
// policy class — routing it through that barrel would force every such test to
// also mock MainChannelPolicy. Allowlisted in scripts/check-architecture.ts.
import { MainChannelPolicy } from "@/lib/modules/channel/domain/channel.policy";
import { VideoStatus } from "@prisma/client";
import { toVideoAccessTier } from "@/lib/access-tier";
import { canUseDemoFallbacks } from "@/lib/feature-flags";
import { isUpcomingPremiere, toPremiereDate } from "@/lib/modules/video/domain/premiere";

export type CheckVideoAccessInput = {
  videoIdOrSlug: string;
};

/**
 * checkVideoAccess is the central decision point for video content gating.
 * It enforces main-channel scoping, visibility rules, and tier-based access.
 */
export async function checkVideoAccess(
  input: CheckVideoAccessInput,
  ctx: AppContext
): Promise<UseCaseResult<AccessDecisionDto, never>> {
  const { videoIdOrSlug } = input;
  const { actor, prisma } = ctx;
  const now = ctx.now();

  // 1. Resolve main channel
  const mainChannel = await MainChannelService.getRequired(ctx);

  // 2. Resolve video
  const { isUuid } = await import("@/lib/utils/uuid");
  let video = await prisma.video.findFirst({
    where: isUuid(videoIdOrSlug)
      ? { id: videoIdOrSlug, creatorId: mainChannel.id }
      : { slug: videoIdOrSlug, creatorId: mainChannel.id },
    include: {
        creator: {
            select: { id: true, slug: true, isApproved: true, isPrimary: true }
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

  // Admin bypass check (only within main channel)
  const isAdmin = actor.type === 'admin';

  if (!video) return ok({ hasAccess: false, reason: "NOT_FOUND" });

  // 3. Main-channel scoping & Approved Primary Check
  // Admin bypass is scoped to the main channel. Off-channel video remains NOT_FOUND in strict single-channel mode.
  const isMainChannelVideo = MainChannelPolicy.isVideoOnMainChannel(video, mainChannel.id) &&
                             !!video.creator &&
                             MainChannelPolicy.isPublicMainChannel(video.creator);

  // For fallbacks, we might not have a full creator object in the same way, but MainChannelService.getRequired ensures mainChannel is valid.
  if (!isMainChannelVideo && !canUseDemoFallbacks()) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  // 4. Visibility rules (Archived/Published/Draft)
  if (video.status === VideoStatus.ARCHIVED) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  const isPublished = video.status === VideoStatus.PUBLISHED &&
                      (!video.publishedAt || video.publishedAt <= now);

  if (!isPublished && !isAdmin) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  // From here on the decision is about this one row, whether it was asked for by id or by slug:
  // callers load the video by `videoId` (never by their raw input) and apply the premiere gate
  // from `premiereAt`, so a slug cannot skip it (audit SEC-10). The tier decision itself does not
  // change: comments on an upcoming premiere stay usable (CLAUDE.md "Premieres").
  const resolvedVideoId = video.id;
  const upcomingPremiereAt = !isAdmin && isUpcomingPremiere(video, now)
    ? toPremiereDate(video.premiereAt)?.toISOString()
    : undefined;
  const decide = (decision: AccessDecisionDto) =>
    ok({ ...decision, videoId: resolvedVideoId, ...(upcomingPremiereAt ? { premiereAt: upcomingPremiereAt } : {}) });

  // Admin access granted for existing main-channel non-archived content
  if (isAdmin) return decide({ hasAccess: true });

  // 5. Tier-based access: two levels (lib/access-tier.ts); a leftover PATRON row counts as LOGGED_IN.
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
