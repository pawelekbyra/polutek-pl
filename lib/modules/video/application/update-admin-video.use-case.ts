import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository, UpdateVideoInput } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { MediaPolicy, MediaStorageService } from "@/lib/modules/media";
import { VideoPolicy } from "../domain/video.policy";
import { syncPublicThumbnail } from "./sync-public-thumbnail.service";
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

  // Only re-validate hero eligibility when this update actually promotes the video to
  // Hero (false/unset -> true). The edit form always resubmits the video's current
  // isMainFeatured value on every save, even when the user only touched an unrelated
  // field like the title — without this guard, a video that became Hero before the
  // active-playback-route invariant existed (or otherwise has a legacy gap there) could
  // never be edited again, since every save would re-fail the same pre-existing blocker.
  if (input.isMainFeatured && !existing.isMainFeatured) {
      const blockers = VideoPolicy.getHeroBlockers({ ...existing, status: nextStatus, tier: nextTier });
      if (blockers.length > 0) return fail(new VideoInvalidHeroError(`${blockers[0].code}: ${blockers[0].message}`));
  }

  if (input.showInSidebar === true) {
      const blockers = VideoPolicy.getSidebarBlockers({ status: nextStatus });
      if (blockers.length > 0) return fail(new VideoInvalidSidebarError(`${blockers[0].code}: ${blockers[0].message}`));
  }

  const safeInput = { ...input };
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

  // Unpublishing drops the public R2 copy; a new cover on a published video
  // gets copied there. Runs before the old private object is deleted below.
  await syncPublicThumbnail(updated, ctx);

  // Cleanup old cover if it was replaced and it was our owned storage (R2 or Blob)
  if (input.thumbnailUrl && existing.thumbnailUrl && input.thumbnailUrl !== existing.thumbnailUrl) {
    await MediaStorageService.deleteOwnedThumbnail(existing.thumbnailUrl);
  }

  return ok(toAdminVideoDto(updated));
}
