import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { AccessDecisionDto } from "../domain/access-decision.dto";
import { MainChannelService } from "@/lib/modules/channel";
import { getPatronStatus } from "@/lib/modules/patron";
import { AccessTier, VideoStatus } from "@prisma/client";
import { canUseDemoFallbacks } from "@/lib/feature-flags";

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
  const isMainChannelVideo = video.creatorId === mainChannel.id &&
                             video.creator?.isApproved &&
                             video.creator?.isPrimary;

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

  // Admin access granted for existing main-channel non-archived content
  if (isAdmin) return ok({ hasAccess: true });

  // 5. Tier-based access
  if (video.tier === AccessTier.PUBLIC) return ok({ hasAccess: true });

  if (actor.type === 'guest') {
    // If the frontend expects PATRON_REQUIRED reason even for guest on PATRON videos, we return it.
    // Otherwise LOGIN_REQUIRED is the first barrier.
    const reason = video.tier === AccessTier.PATRON ? "PATRON_REQUIRED" : "LOGIN_REQUIRED";
    return ok({
        hasAccess: false,
        reason,
        requiredTier: video.tier
    });
  }

  // 6. User-specific checks (LOGGED_IN, PATRON)
  if (actor.type !== 'user') {
    // Should not happen for authenticated non-admin actors but for safety:
    return ok({ hasAccess: false, reason: "FORBIDDEN" });
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId }
  });

  // Missing or deleted local user
  if (!user) return ok({ hasAccess: false, reason: "FORBIDDEN" });
  if (user.isDeleted) return ok({ hasAccess: false, reason: "DELETED" });

  if (video.tier === AccessTier.LOGGED_IN) return ok({ hasAccess: true });

  if (video.tier === AccessTier.PATRON) {
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

  return ok({ hasAccess: false, reason: "FORBIDDEN" });
}
