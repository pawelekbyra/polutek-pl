import { StorageProvider, VideoAssetProcessingState, VideoPlaybackRoute, VideoPlaybackRouteActivatedBy, VideoPlaybackRouteStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEvent } from "@/lib/modules/audit";

/**
 * The active playback route says which asset plays a video. Own HLS (SELF_HLS) is the
 * only provider that can be routed (CLAUDE.md 4.17); the encode worker activates the
 * route when it finishes (finalize-self-hls.ts).
 */
export class VideoPlaybackRouteService {
  async activateRoute(input: {
    videoId: string;
    assetId: string;
    activatedBy: "ADMIN" | "POLICY" | "FALLBACK" | "MIGRATION" | "RECONCILER";
    reason?: string;
    encodeClaim?: { jobId: string; workerId: string; attemptId: string | null };
  }, ctx: AppContext): Promise<VideoPlaybackRoute> {
    const [video, asset] = await Promise.all([
      ctx.prisma.video.findUnique({ where: { id: input.videoId }, select: { id: true, tier: true } }),
      ctx.prisma.videoAsset.findUnique({ where: { id: input.assetId } }),
    ]);
    if (!video) throw new AppError("Video not found.", 404, "VIDEO_NOT_FOUND");
    if (!asset || asset.videoId !== input.videoId) throw new AppError("Asset does not belong to this video.", 400, "VIDEO_ASSET_MISMATCH");
    if (asset.processingState !== VideoAssetProcessingState.READY) throw new AppError("Only READY assets can be activated.", 409, "VIDEO_ASSET_NOT_READY");
    if (asset.provider !== StorageProvider.SELF_HLS) {
      throw new AppError(`${asset.provider} cannot be activated: only own HLS is supported.`, 400, "PROVIDER_CANNOT_SERVE_TIER");
    }

    const route = await ctx.db.writeTransaction(async (tx) => {
      if (input.encodeClaim) {
        const claim = input.encodeClaim;
        const owned = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "VideoEncodeJob"
          WHERE "id" = ${claim.jobId}
            AND "status" = 'RUNNING'
            AND "workerId" = ${claim.workerId}
            AND "attemptId" IS NOT DISTINCT FROM ${claim.attemptId}
          FOR UPDATE
        `;
        if (owned.length !== 1) throw new AppError("Encode attempt no longer owns this job.", 409, "ENCODE_ATTEMPT_LOST");
        // Refresh the lease while holding the job row lock, so a concurrent stale sweep cannot take over mid-finalize.
        await tx.videoEncodeJob.update({ where: { id: claim.jobId }, data: { heartbeatAt: new Date() } });
      }
      await tx.videoPlaybackRoute.updateMany({
        where: { videoId: input.videoId, status: VideoPlaybackRouteStatus.ACTIVE },
        data: { status: VideoPlaybackRouteStatus.PREVIOUS, deactivatedAt: new Date() },
      });
      const created = await tx.videoPlaybackRoute.create({
        data: {
          videoId: input.videoId,
          assetId: input.assetId,
          provider: asset.provider,
          status: VideoPlaybackRouteStatus.ACTIVE,
          activatedBy: input.activatedBy as VideoPlaybackRouteActivatedBy,
          activationReason: input.reason,
        },
      });
      await tx.video.update({ where: { id: input.videoId }, data: { activePlaybackRouteId: created.id } });
      await tx.videoAsset.updateMany({ where: { videoId: input.videoId }, data: { isPrimary: false } });
      await tx.videoAsset.update({ where: { id: input.assetId }, data: { isPrimary: true } });
      await recordAuditEvent(ctx, {
        action: "VIDEO_PLAYBACK_ROUTE_ACTIVATED",
        targetType: "Video",
        targetId: input.videoId,
        metadata: { routeId: created.id, assetId: input.assetId, activatedBy: input.activatedBy, reason: input.reason ?? null },
      }, tx);
      return created;
    });
    return route;
  }

  async deactivateRoute(input: { videoId: string; routeId?: string; reason?: string }, ctx: AppContext): Promise<void> {
    const route = input.routeId
      ? await ctx.prisma.videoPlaybackRoute.findFirst({ where: { id: input.routeId, videoId: input.videoId } })
      : await this.getActiveRoute(input.videoId, ctx);
    if (!route) return;
    await ctx.db.writeTransaction(async (tx) => {
      await tx.videoPlaybackRoute.update({ where: { id: route.id }, data: { status: VideoPlaybackRouteStatus.DISABLED, deactivatedAt: new Date(), activationReason: input.reason ?? route.activationReason } });
      await tx.video.updateMany({ where: { id: input.videoId, activePlaybackRouteId: route.id }, data: { activePlaybackRouteId: null } });
    });
  }

  async getActiveRoute(videoId: string, ctx: AppContext): Promise<VideoPlaybackRoute | null> {
    const video = await ctx.prisma.video.findUnique({ where: { id: videoId }, include: { activePlaybackRoute: true } });
    return video?.activePlaybackRoute ?? null;
  }
}
