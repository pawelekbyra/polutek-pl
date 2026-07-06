import { StorageProvider } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { isAutomaticFilePlaybackProvider } from "../domain/video-provider-capabilities";
import { VideoPlaybackRouteService } from "./video-playback-route.service";
import { VideoDistributionPlanService } from "./video-distribution-plan.service";
import type { AutomaticFilePlaybackProvider, VideoDistributionStrategyInput } from "../domain/video-distribution.types";

export type BackfillVideoDistributionResult = { scannedVideos: number; updatedVideos: number; createdPlans: number; createdTargets: number; createdRoutes: number; skippedVideos: number; errors: Array<{ videoId: string; error: string }> };

type BackfillAssetCandidate = {
  provider: StorageProvider;
  processingState: string;
  isPrimary: boolean;
};

function toAutomaticFileProvider(provider: StorageProvider): AutomaticFilePlaybackProvider | null {
  if (provider === StorageProvider.CLOUDFLARE_STREAM) return "CLOUDFLARE_STREAM";
  if (provider === StorageProvider.MUX) return "MUX";
  return null;
}

function inferStrategy(assets: BackfillAssetCandidate[]): VideoDistributionStrategyInput | null {
  const providers = Array.from(new Set(assets
    .filter((asset) => asset.processingState === "READY" && isAutomaticFilePlaybackProvider(asset.provider))
    .map((asset) => toAutomaticFileProvider(asset.provider))
    .filter((provider): provider is AutomaticFilePlaybackProvider => provider !== null)));
  if (providers.length === 0) return null;
  if (providers.length === 1) return { mode: "SINGLE_PROVIDER", provider: providers[0] };
  const preferredAsset = assets.find((asset) => {
    const provider = toAutomaticFileProvider(asset.provider);
    return asset.isPrimary && provider !== null && providers.includes(provider);
  });
  const preferred = preferredAsset ? toAutomaticFileProvider(preferredAsset.provider) : null;
  return { mode: "MULTI_PROVIDER", providers, ...(preferred ? { preferredProvider: preferred } : { selectionPolicy: "FIRST_READY" as const }) };
}

export class VideoDistributionBackfillService {
  constructor(private readonly routeService = new VideoPlaybackRouteService(), private readonly planService = new VideoDistributionPlanService()) {}

  async backfillExistingVideos(input: { limit?: number; dryRun?: boolean; videoId?: string }, ctx: AppContext): Promise<BackfillVideoDistributionResult> {
    const result: BackfillVideoDistributionResult = { scannedVideos: 0, updatedVideos: 0, createdPlans: 0, createdTargets: 0, createdRoutes: 0, skippedVideos: 0, errors: [] };
    const videos = await ctx.prisma.video.findMany({
      where: { ...(input.videoId ? { id: input.videoId } : {}), assets: { some: {} } },
      take: Math.min(input.limit ?? 25, 200),
      include: { assets: true, originals: { orderBy: { version: "desc" } }, distributionPlans: { where: { isActive: true }, include: { targets: true } }, activePlaybackRoute: true },
    });
    for (const video of videos) {
      result.scannedVideos++;
      try {
        if (input.dryRun) { result.skippedVideos++; continue; }
        const activeOriginal = video.activeOriginalId ? null : video.originals.find((original) => original.status === "READY" || original.status === "UPLOADED") ?? null;
        if (activeOriginal) { await ctx.prisma.video.update({ where: { id: video.id }, data: { activeOriginalId: activeOriginal.id } }); result.updatedVideos++; }
        let activePlan = video.distributionPlans[0] ?? null;
        if (!activePlan) {
          const strategy = inferStrategy(video.assets);
          if (!strategy) { result.skippedVideos++; continue; }
          activePlan = await this.planService.createOrReplaceActivePlan({ videoId: video.id, originalId: activeOriginal?.id ?? video.activeOriginalId, strategy, createdByAdminId: ctx.actor.type === "admin" ? ctx.actor.userId : undefined }, ctx);
          result.createdPlans++;
          result.createdTargets += activePlan.targets.length;
          for (const target of activePlan.targets) {
            const asset = video.assets.find((candidate) => candidate.provider === target.provider && candidate.processingState === "READY");
            if (asset) await ctx.prisma.videoAsset.update({ where: { id: asset.id }, data: { distributionTargetId: target.id } });
          }
        }
        if (video.activePlaybackRoute) await this.routeService.repairLegacyPrimaryFromRoute(video.id, ctx);
        else {
          const primary = video.assets.find((asset) => asset.isPrimary && asset.processingState === "READY" && isAutomaticFilePlaybackProvider(asset.provider));
          if (primary) { await this.routeService.activateRoute({ videoId: video.id, assetId: primary.id, planId: activePlan.id, activatedBy: "MIGRATION", reason: "legacy-primary-backfill" }, ctx); result.createdRoutes++; }
        }
      } catch (error) { result.errors.push({ videoId: video.id, error: error instanceof Error ? error.message : String(error) }); }
    }
    return result;
  }
}
