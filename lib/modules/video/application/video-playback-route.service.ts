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
      return created;
    });

    await recordAuditEvent(ctx, {
      action: "VIDEO_PLAYBACK_ROUTE_ACTIVATED",
      targetType: "Video",
      targetId: input.videoId,
      metadata: { routeId: route.id, assetId: input.assetId, activatedBy: input.activatedBy, reason: input.reason ?? null },
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
