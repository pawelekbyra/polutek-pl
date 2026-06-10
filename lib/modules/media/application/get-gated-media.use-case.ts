import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { checkVideoAccess } from "@/lib/modules/access";
import { canUseDemoFallbacks } from "@/lib/feature-flags";
import { INITIAL_VIDEOS } from "@/lib/data/initial-content";
import { MediaSourceNotFoundError } from "../domain/media.errors";

export type GetGatedMediaInput = {
  videoIdOrSlug: string;
};

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
): Promise<UseCaseResult<GatedMediaResult, MediaSourceNotFoundError>> {
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
    // This should ideally not happen
    return ok({ id: video.id, videoUrl: "" });
  }

  const decision = accessResult.data;

  // If NOT_FOUND was returned by access check, we treat it as media not found.
  if (decision.reason === "NOT_FOUND") {
      return fail(new MediaSourceNotFoundError(videoIdOrSlug));
  }

  return ok({
    id: video.id,
    videoUrl: video.videoUrl
  });
}
