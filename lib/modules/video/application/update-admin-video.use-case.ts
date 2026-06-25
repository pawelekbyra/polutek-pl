import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository, UpdateVideoInput } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { MediaPolicy } from "@/lib/modules/media";
import { VideoPolicy } from "../domain/video.policy";
import { VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { buildCloudflareFirstFrameThumbnailUrl, DEFAULT_VIDEO_THUMBNAIL_URL, normalizeThumbnailSourceMode } from "@/lib/media/cloudflare-thumbnail";
import {
    VideoNotFoundError,
    VideoNotOnMainChannelError,
    VideoUrlNotAllowedError,
    VideoInvalidHeroError,
    VideoInvalidSidebarError
} from "../domain/video.errors";

export async function updateAdminVideo(
  input: UpdateVideoInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | VideoNotOnMainChannelError | VideoUrlNotAllowedError | VideoInvalidHeroError | VideoInvalidSidebarError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const existing = await repository.findByIdWithAsset(input.id);
  if (!existing) return fail(new VideoNotFoundError(input.id));

  if (!VideoPolicy.isOnMainChannel(existing, mainChannel.id)) {
    return fail(new VideoNotOnMainChannelError(input.id));
  }

  if (input.videoUrl && !MediaPolicy.isAllowedVideoSourceUrl(input.videoUrl, process.env as any)) {
    return fail(new VideoUrlNotAllowedError(input.videoUrl));
  }

  const nextStatus = input.status || existing.status;
  const nextTier = input.tier || existing.tier;

  if (input.isMainFeatured) {
      const blockers = VideoPolicy.getHeroBlockers({ ...existing, status: nextStatus, tier: nextTier });
      if (blockers.length > 0) return fail(new VideoInvalidHeroError(`${blockers[0].code}: ${blockers[0].message}`));
  }

  if (input.showInSidebar === true) {
      const blockers = VideoPolicy.getSidebarBlockers({ status: nextStatus });
      if (blockers.length > 0) return fail(new VideoInvalidSidebarError(`${blockers[0].code}: ${blockers[0].message}`));
  }

  const safeInput = { ...input };
  const thumbnailSource = normalizeThumbnailSourceMode(input.thumbnailSource);

  if (thumbnailSource === "DEFAULT") {
    safeInput.thumbnailUrl = DEFAULT_VIDEO_THUMBNAIL_URL;
  } else if (thumbnailSource === "CLOUDFLARE_FIRST_FRAME") {
    const providerAssetId = existing.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM
      ? existing.asset.providerAssetId
      : null;
    if (providerAssetId) {
      safeInput.thumbnailUrl = buildCloudflareFirstFrameThumbnailUrl(providerAssetId);
    } else if (!safeInput.thumbnailUrl) {
      safeInput.thumbnailUrl = DEFAULT_VIDEO_THUMBNAIL_URL;
    }
  }

  if (input.status && input.status !== 'PUBLISHED') {
      safeInput.isMainFeatured = false;
      safeInput.showInSidebar = false;
  }

  const updated = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const video = await repository.updateForMainChannel(safeInput, mainChannel.id, tx);

    if (safeInput.isMainFeatured) {
        await repository.clearHero(mainChannel.id, video.id, tx);
    }

    await recordAuditEvent(ctx, {
      action: 'VIDEO_UPDATED',
      targetType: 'Video',
      targetId: video.id,
      metadata: { changed: Object.keys(safeInput).filter(k => k !== 'id') }
    }, tx);

    return video;
  });

  return ok(toAdminVideoDto(updated));
}
