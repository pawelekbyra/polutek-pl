import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { checkVideoAccess } from "@/lib/modules/access";
import { canUseDemoFallbacks } from "@/lib/feature-flags";
import { INITIAL_VIDEOS } from "@/lib/data/initial-content";
import { MediaSourceNotFoundError, MediaAccessDeniedError } from "../domain/media.errors";

export type GetGatedMediaInput = {
  videoIdOrSlug: string;
};

export type GetGatedMediaError = MediaSourceNotFoundError | MediaAccessDeniedError;

export type GatedMediaResult = {
  id: string;
  videoUrl: string;
};

/**
 * getGatedMedia coordinates media metadata retrieval and access control.
 * It does NOT perform the actual proxy/streaming, just the domain-level gating.
 */
export async function getGatedMedia(
  input: GetGatedMediaInput,
  ctx: AppContext
): Promise<UseCaseResult<GatedMediaResult, GetGatedMediaError>> {
  const { videoIdOrSlug } = input;
  const { prisma } = ctx;

  // 1. Resolve video & its URL safely.
  const { isUuid } = await import("@/lib/utils/uuid");
  let video = await prisma.video.findFirst({
    where: isUuid(videoIdOrSlug)
      ? { id: videoIdOrSlug }
      : { slug: videoIdOrSlug },
    select: { id: true, videoUrl: true }
  });

  if (!video && canUseDemoFallbacks()) {
    const fallback = INITIAL_VIDEOS.find(v => v.id === videoIdOrSlug || v.slug === videoIdOrSlug);
    if (fallback) {
      video = { id: fallback.id, videoUrl: fallback.videoUrl };
    }
  }

  if (!video) return fail(new MediaSourceNotFoundError(videoIdOrSlug));

  // 2. Perform modular access check.
  // Note: checkVideoAccess handles 404/Not Found internally via main-channel scoping.
  const accessResult = await checkVideoAccess({ videoIdOrSlug: video.id }, ctx);

  if (!accessResult.ok) {
    // This should ideally not happen (checkVideoAccess never fails today), but
    // fail closed rather than ever returning a videoUrl without a confirmed grant.
    return fail(new MediaAccessDeniedError(video.id));
  }

  const decision = accessResult.data;

  // If NOT_FOUND was returned by access check, we treat it as media not found.
  if (decision.reason === "NOT_FOUND") {
      return fail(new MediaSourceNotFoundError(videoIdOrSlug));
  }

  // Access denied (LOGIN_REQUIRED, PATRON_REQUIRED, FORBIDDEN, DELETED, ...):
  // never return a playable URL for a decision that isn't an explicit grant.
  if (!decision.hasAccess) {
    return fail(new MediaAccessDeniedError(video.id, decision.reason));
  }

  return ok({
    id: video.id,
    videoUrl: video.videoUrl || ""
  });
}
