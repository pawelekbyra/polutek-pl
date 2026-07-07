import { StorageProvider, VideoAssetProcessingState, VideoPlaybackRoute, VideoPlaybackRouteActivatedBy, VideoPlaybackRouteStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEvent } from "@/lib/modules/audit";
import { canProviderServeTier, isPlaybackProvider } from "../domain/video-provider-capabilities";

export class VideoPlaybackRouteService {
  async activateRoute(input: {
    videoId: string;
    assetId: string;
    planId?: string | null;
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
    if (!isPlaybackProvider(asset.provider as StorageProvider) || !canProviderServeTier(asset.provider as StorageProvider, video.tier)) {
      throw new AppError(`${asset.provider} cannot be activated for ${video.tier} playback.`, 400, "PROVIDER_CANNOT_SERVE_TIER");
    }

    const route = await ctx.db.writeTransaction(async (tx) => {
      await tx.videoPlaybackRoute.updateMany({
        where: { videoId: input.videoId, status: VideoPlaybackRouteStatus.ACTIVE },
        data: { status: VideoPlaybackRouteStatus.PREVIOUS, deactivatedAt: new Date() },
      });
      const created = await tx.videoPlaybackRoute.create({
        data: {
          videoId: input.videoId,
          planId: input.planId ?? null,
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
      metadata: { routeId: route.id, assetId: input.assetId, planId: input.planId ?? null, activatedBy: input.activatedBy, reason: input.reason ?? null },
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

  async repairLegacyPrimaryFromRoute(videoId: string, ctx: AppContext): Promise<void> {
    const video = await ctx.prisma.video.findUnique({ where: { id: videoId }, include: { activePlaybackRoute: true } });
    if (!video?.activePlaybackRoute) return;
    await ctx.db.writeTransaction(async (tx) => {
      await tx.videoAsset.updateMany({ where: { videoId }, data: { isPrimary: false } });
      await tx.videoAsset.update({ where: { id: video.activePlaybackRoute!.assetId }, data: { isPrimary: true } });
    });
  }

  /**
   * Ingestion/webhook entry point for "a single-asset (plan-less) video's asset just
   * became READY — should it become the playback source?" This is the guarded on-ramp
   * that keeps `activateRoute()` the sole write path for `isPrimary`/`activePlaybackRouteId`
   * outside admin- or plan-driven activation: it only activates when the video has no
   * active route yet AND no other asset is already the READY primary, mirroring the
   * legacy "first ready asset wins" rule. Returns the created route, or null if a route/
   * primary already exists (no-op) or the asset turns out not to be eligible.
   */
  async activateFirstReadyAssetIfNoneActive(
    input: { videoId: string; assetId: string; reason?: string },
    ctx: AppContext,
  ): Promise<VideoPlaybackRoute | null> {
    const [existingActiveRoute, existingReadyPrimary] = await Promise.all([
      this.getActiveRoute(input.videoId, ctx),
      ctx.prisma.videoAsset.findFirst({
        where: {
          videoId: input.videoId,
          isPrimary: true,
          processingState: VideoAssetProcessingState.READY,
          id: { not: input.assetId },
        },
      }),
    ]);
    if (existingActiveRoute || existingReadyPrimary) return null;

    try {
      return await this.activateRoute(
        { videoId: input.videoId, assetId: input.assetId, activatedBy: "POLICY", reason: input.reason ?? "first-ready-asset" },
        ctx,
      );
    } catch {
      // Not eligible (e.g. provider can't serve this video's tier, or the asset
      // turned out not to be READY) — legacy primary-asset fallback still covers playback.
      return null;
    }
  }
}
