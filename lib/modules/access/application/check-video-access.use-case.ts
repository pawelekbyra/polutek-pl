import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { AccessDecisionDto } from "../domain/access.dto";
import { MainChannelService } from "@/lib/modules/channel";
import { AccessTier, VideoStatus } from "@prisma/client";

export type CheckVideoAccessInput = {
  videoIdOrSlug: string;
};

export async function checkVideoAccess(
  input: CheckVideoAccessInput,
  ctx: AppContext
): Promise<UseCaseResult<AccessDecisionDto, never>> {
  const { videoIdOrSlug } = input;
  const { actor, prisma } = ctx;

  // 1. Resolve main channel
  const mainChannel = await MainChannelService.getRequired(ctx);

  // 2. Resolve video
  const { isUuid } = await import("@/lib/utils/uuid");
  const video = await prisma.video.findFirst({
    where: isUuid(videoIdOrSlug)
      ? { id: videoIdOrSlug, creatorId: mainChannel.id }
      : { slug: videoIdOrSlug, creatorId: mainChannel.id },
    include: {
        creator: {
            select: { id: true, slug: true, isApproved: true, isPrimary: true }
        }
    }
  });

  // Admin bypass
  const isAdmin = actor.type === 'admin';

  if (!video) return ok({ hasAccess: false, reason: "NOT_FOUND" });

  // 3. Main-channel scoping & Visibility
  const isMainChannelVideo = video.creatorId === mainChannel.id &&
                             video.creator?.isApproved &&
                             video.creator?.isPrimary;

  // Non-admins only see approved primary main channel videos
  if (!isAdmin && !isMainChannelVideo) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  if (video.status === VideoStatus.ARCHIVED) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  // 4. Publication Status
  const isPublished = video.status === VideoStatus.PUBLISHED &&
                      (!video.publishedAt || video.publishedAt <= new Date());

  if (!isPublished && !isAdmin) {
    return ok({ hasAccess: false, reason: "NOT_FOUND" });
  }

  // Admin access (after checking existence/main-channel/archived)
  if (isAdmin) return ok({ hasAccess: true });

  // 5. Tier-based access
  if (video.tier === AccessTier.PUBLIC) return ok({ hasAccess: true });

  if (actor.type === 'guest') {
    return ok({
        hasAccess: false,
        reason: "LOGIN_REQUIRED",
        requiredTier: video.tier
    });
  }

  // 6. User-specific checks (LOGGED_IN, PATRON)
  if (actor.type !== 'user') {
    return ok({ hasAccess: false, reason: "FORBIDDEN" });
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId }
  });

  if (!user || user.isDeleted) {
    return ok({ hasAccess: false, reason: "DELETED" });
  }

  if (video.tier === AccessTier.LOGGED_IN) return ok({ hasAccess: true });

  if (video.tier === AccessTier.PATRON) {
    // DB isPatron is the single source of truth
    if (user.isPatron) return ok({ hasAccess: true });

    return ok({
        hasAccess: false,
        reason: "PATRON_REQUIRED",
        requiredTier: AccessTier.PATRON
    });
  }

  return ok({ hasAccess: false, reason: "FORBIDDEN" });
}
