import { AppContext } from "@/lib/modules/shared/app-context";
import { recordAuditEvent } from "@/lib/modules/audit";
import { publishAdminVideo } from "./publish-admin-video.use-case";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoPolicy } from "../domain/video.policy";
import { unlistAdminVideo } from "./unlist-admin-video.use-case";
import { getReadyVisibility, setReadyVisibility, type ReadyVisibility } from "./ready-visibility";

export async function requestPublishAfterAssetReady(videoId: string, ctx: AppContext, visibility: ReadyVisibility = "PUBLISHED"): Promise<void> {
  const now = new Date();
  await (ctx.prisma as any).$transaction(async (tx: any) => {
    const current = await tx.video.findUnique({ where: { id: videoId } });
    if (!current || current.publishAfterAssetReadyCompletedAt || current.status === "PUBLISHED" || current.status === "UNLISTED") return;
    await tx.video.update({
      where: { id: videoId },
      data: {
        publishAfterAssetReady: true,
        publishAfterAssetReadyRequestedAt: current.publishAfterAssetReadyRequestedAt || now,
        publishAfterAssetReadyCompletedAt: null,
        publishAfterAssetReadyError: null,
      },
    });
    if (!current.publishAfterAssetReady) {
      await recordAuditEvent(ctx, {
        action: "VIDEO_PUBLISH_AFTER_ASSET_READY_REQUESTED",
        targetType: "Video",
        targetId: videoId,
        metadata: { requestedAt: now.toISOString() },
      }, tx);
    }
  });
  await setReadyVisibility(videoId, visibility, ctx);
}

export async function attemptPublishAfterAssetReady(videoId: string, ctx: AppContext, triggerProvider?: string): Promise<void> {
  const videoDelegate = (ctx.prisma as any).video;
  if (!videoDelegate?.findUnique) return;

  const current = await videoDelegate.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, publishAfterAssetReady: true, publishAfterAssetReadyCompletedAt: true },
  });
  if (!current?.publishAfterAssetReady || current.publishAfterAssetReadyCompletedAt || current.status === "PUBLISHED" || current.status === "UNLISTED") return;

  // Publication is gated on readiness (the encode worker calls this once the own-HLS asset is
  // READY and routed). Auto-publish and manual publish (publish-admin-video.use-case.ts) must never
  // diverge on what counts as "ready to publish": both go through VideoPolicy.getPublicationBlockers
  // against the exact same video shape here. If the only outstanding blockers are about the asset
  // not being playable yet, keep waiting quietly instead of recording an error; any other
  // (structural) blocker is treated as a real failure below. triggerProvider is informational only.
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(videoId, mainChannel.id);
  if (!video) return;

  const blockers = VideoPolicy.getPublicationBlockers(video);
  const structuralBlockers = blockers.filter((blocker) => !VideoPolicy.isAssetReadinessBlocker(blocker.code));
  if (blockers.length > 0 && structuralBlockers.length === 0) {
    // Still waiting for the asset to finish processing/become primary — not an error yet.
    return;
  }

  // "Niepubliczny" was chosen at creation: it becomes UNLISTED through the same blockers, never PUBLISHED.
  // A failed read must not fall back to PUBLISHED: an unlisted video would leak onto the lists. Wait and retry.
  const target = await getReadyVisibility(videoId, ctx).catch(() => null);
  if (!target) return;
  const result = target === "UNLISTED" ? await unlistAdminVideo(videoId, ctx) : await publishAdminVideo(videoId, ctx);
  if (result.ok) {
    await recordAuditEvent(ctx, {
      action: "VIDEO_PUBLISH_AFTER_ASSET_READY_COMPLETED",
      targetType: "Video",
      targetId: videoId,
      metadata: { completedAt: new Date().toISOString(), triggeredByProvider: triggerProvider ?? null, visibility: target },
    }).catch(() => undefined);
    return;
  }

  const message = result.error?.message || "Automatyczna publikacja po READY nie powiodła się.";
  const currentStatus = await videoDelegate.findUnique({
    where: { id: videoId },
    select: { publishAfterAssetReadyError: true },
  });

  if (currentStatus?.publishAfterAssetReadyError === message) {
    return;
  }

  await (ctx.prisma as any).$transaction(async (tx: any) => {
    await tx.video.update({
      where: { id: videoId },
      data: { publishAfterAssetReadyError: message },
    });
    await recordAuditEvent(ctx, {
      action: "VIDEO_PUBLISH_AFTER_ASSET_READY_FAILED",
      targetType: "Video",
      targetId: videoId,
      metadata: { error: message, code: result.error?.code },
    }, tx);
  });
}
