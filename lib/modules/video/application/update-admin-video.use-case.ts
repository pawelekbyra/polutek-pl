import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository, UpdateVideoInput } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { authorize } from "@/lib/modules/authz";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEvent } from "@/lib/modules/audit";
import { MediaStorageService, isDerivedThumbnailUrl, isThumbnailProxyPath } from "@/lib/modules/media";
import { VideoPolicy } from "../domain/video.policy";
import { syncPublicThumbnail } from "./sync-public-thumbnail.service";
import { announcePublishedVideo } from './announce-published-video';
import { publishAdminVideo } from "./publish-admin-video.use-case";
import { isAllowedPremiereChange, isUpcomingPremiere } from "../domain/premiere";
import { isAllowedStatusTransition } from "../domain/video-visibility";
import { clearReadyVisibility } from "./ready-visibility";
import { resolveVideoMetadata } from "../domain/video-metadata";
import {
    VideoNotFoundError,
    VideoNotOnMainChannelError,
    VideoInvalidHeroError,
    VideoInvalidSidebarError,
    VideoInvalidPremiereError,
    VideoNotReadyForPublicationError
} from "../domain/video.errors";

export { isThumbnailProxyPath };

export async function updateAdminVideo(
  input: UpdateVideoInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | VideoNotOnMainChannelError | VideoInvalidHeroError | VideoInvalidSidebarError | VideoInvalidPremiereError | VideoNotReadyForPublicationError | AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.update", { channel: { id: mainChannel.id, ownerUserId: mainChannel.userId, status: mainChannel.status } });
  if (denied) return fail(denied);
  const repository = new VideoRepository(ctx.prisma);

  const existing = await repository.findByIdWithAsset(input.id);
  if (!existing) return fail(new VideoNotFoundError(input.id));

  if (!VideoPolicy.isOnMainChannel(existing, mainChannel.id)) {
    return fail(new VideoNotOnMainChannelError(input.id));
  }

  if (!isAllowedPremiereChange(input.premiereAt, existing.premiereAt, ctx.now())) {
      return fail(new VideoInvalidPremiereError());
  }

  const nextStatus = input.status || existing.status;
  // Asking an unpublished video for status PUBLISHED is a request to publish it: the edit repository never writes
  // PUBLISHED itself, so this goes through publishAdminVideo below. Refuse up front when it cannot publish, so the
  // edit is not half-saved and the caller never gets a success for a video that stays a draft.
  const requestsPublication = input.status === 'PUBLISHED' && existing.status !== 'PUBLISHED';
  if (requestsPublication) {
      const blockers = VideoPolicy.getPublicationBlockers(existing);
      if (blockers.length > 0) return fail(new VideoNotReadyForPublicationError(blockers[0].message, blockers[0].code));
  }
  const nextTier = input.tier || existing.tier;

  if (input.status === 'UNLISTED' && !isAllowedStatusTransition(existing.status, 'UNLISTED')) {
      return fail(new VideoNotReadyForPublicationError("Zarchiwizowany film trzeba najpierw przywrócić do szkicu.", "VIDEO_PUBLICATION_ARCHIVED"));
  }

  // UNLISTED is reachable by link, so entering it needs what publishing needs (a READY own-HLS route etc.), and a
  // premiere (a public event) is not possible on an unlisted video.
  const becomesUnlisted = nextStatus === 'UNLISTED' && existing.status !== 'UNLISTED';
  if (becomesUnlisted && existing.status !== 'PUBLISHED') {
      const blockers = VideoPolicy.getUnlistBlockers({ ...existing, tier: nextTier });
      if (blockers.length > 0) return fail(new VideoNotReadyForPublicationError(blockers[0].message, blockers[0].code));
  }
  if (nextStatus === 'UNLISTED' && input.premiereAt instanceof Date) {
      return fail(new VideoInvalidPremiereError("Film niepubliczny nie może mieć premiery."));
  }

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

  const metadata = resolveVideoMetadata(input, { durationSeconds: existing.durationSeconds });
  if (metadata instanceof AppError) return fail(metadata);

  const safeInput = { ...input, ...metadata };
  // A paid video stays paid: the edit form only knows the two free levels and would silently make it free for
  // every signed-in account. Price and tier of a paid video change through the sales use cases only.
  if ((existing.tier as string) === 'PAID') delete safeInput.tier;
  // The edit form is loaded from the admin DTO, whose thumbnailUrl is the public src: the
  // proxy path (/api/videos/<id>/thumbnail) or, for a published video with a synced copy,
  // the public R2 URL (https://<NEXT_PUBLIC_R2_PUBLIC_HOST>/<key>). Saving either back
  // replaced the private storage URL; the public-thumbnail sync then saw no private key,
  // cleared thumbnailPublicUrl and deleted the public object, and the old-cover cleanup
  // below deleted the private one (incident 2026-09-30). Neither is a storage value:
  // keep the stored one.
  if (isDerivedThumbnailUrl(safeInput.thumbnailUrl, process.env as Record<string, string | undefined>)) delete safeInput.thumbnailUrl;
  // publishedAt is never taken from the request.
  delete safeInput.publishedAt;
  // "Natychmiast" on a published video whose premiere hasn't happened yet: it goes
  // live now, so it is dated now (not from when it was first published).
  const goesLiveNow = input.premiereAt === null && existing.status === 'PUBLISHED' && isUpcomingPremiere(existing, ctx.now());
  if (goesLiveNow) {
      safeInput.publishedAt = ctx.now();
  }
  if (input.status && input.status !== 'PUBLISHED') {
      safeInput.isMainFeatured = false;
      safeInput.showInSidebar = false;
  }
  if (becomesUnlisted) {
      // Reachable from now on; an unlisted video holds no premiere.
      safeInput.publishedAt = existing.publishedAt ?? ctx.now();
      safeInput.premiereAt = null;
      safeInput.publishAfterAssetReady = false;
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
      metadata: {
        changed: Object.keys(safeInput).filter(k => k !== 'id'),
        ...(safeInput.commentsMode !== undefined ? { commentsMode: safeInput.commentsMode } : {}),
        // Only the count, never the titles (audit metadata holds ids, counters and statuses).
        ...(safeInput.chapters !== undefined ? { chaptersCount: safeInput.chapters === null ? null : safeInput.chapters.length } : {}),
        ...(safeInput.premiereAt !== undefined ? { premiereAt: safeInput.premiereAt?.toISOString() ?? null } : {}),
        ...(safeInput.fundraisingGoalMinor !== undefined ? {
          fundraisingGoal: safeInput.fundraisingGoalMinor === null ? null : {
            amountMinor: safeInput.fundraisingGoalMinor,
            currency: safeInput.fundraisingGoalCurrency ?? null,
            startAt: safeInput.fundraisingStartAt?.toISOString() ?? null,
          },
        } : {}),
        ...(safeInput.fundraisingManualPercent !== undefined ? { fundraisingManualPercent: safeInput.fundraisingManualPercent } : {}),
      }
    }, tx);

    return video;
  });


  // The premiere was dropped ("Natychmiast"): the video is live now and its premiere date no longer exists for the
  // premiere cron, so it is announced like a new video (idempotent; never throws; skipped while it is not announceable).
  if (goesLiveNow && updated.status === 'PUBLISHED') await announcePublishedVideo(updated.id);

  if (input.status && input.status !== existing.status) await clearReadyVisibility(updated.id, ctx);

  // Unpublishing drops the public R2 copy; a new cover on a published video
  // gets copied there. Runs before the old private object is deleted below.
  await syncPublicThumbnail(updated, ctx);

  // Cleanup old cover if it was replaced and it was our owned storage (private R2 bucket)
  if (safeInput.thumbnailUrl && existing.thumbnailUrl && safeInput.thumbnailUrl !== existing.thumbnailUrl) {
    await MediaStorageService.deleteOwnedThumbnail(existing.thumbnailUrl);
  }

  // Status PUBLISHED on an unpublished video ("publish now" or "Premiera" with a date): publish it through the
  // canonical publish use case, which keeps the publication blockers; with a premiere the video then waits in
  // "Coming soon" until premiereAt. The result is the publication's result, never a bare "saved".
  if (requestsPublication) {
    return publishAdminVideo(updated.id, ctx);
  }

  return ok(toAdminVideoDto(updated));
}
