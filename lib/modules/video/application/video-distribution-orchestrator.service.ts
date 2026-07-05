import { StorageProvider, VideoAsset, VideoPlaybackRouteActivatedBy } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { getProviderCostOrder } from "../domain/video-distribution.constants";
import { VideoPlaybackRouteService } from "./video-playback-route.service";

export type VideoDistributionDecision = {
  videoId: string;
  planId: string | null;
  reason: string;
  activeRouteChanged: boolean;
  activatedAssetId: string | null;
  activatedProvider: string | null;
  publishAttempted: boolean;
  publishCompleted: boolean;
  warnings: string[];
};

type ReconcileReason = "UPLOAD_COMPLETED" | "JOB_UPDATED" | "WEBHOOK" | "ADMIN_RETRY" | "CRON_RECONCILE" | "MANUAL";
type ReadyTarget = { target: any; asset: VideoAsset };

function readyAssetForTarget(target: any): VideoAsset | null {
  return (target.providerAssets ?? [])
    .filter((asset: VideoAsset) => asset.processingState === "READY")
    .sort((a: VideoAsset, b: VideoAsset) => {
      const aTime = (a.processingEndedAt ?? a.updatedAt).getTime();
      const bTime = (b.processingEndedAt ?? b.updatedAt).getTime();
      return aTime - bTime || a.updatedAt.getTime() - b.updatedAt.getTime() || target.updatedAt.getTime() - target.updatedAt.getTime();
    })[0] ?? null;
}

function sortFirstReady(a: ReadyTarget, b: ReadyTarget): number {
  const aTime = (a.asset.processingEndedAt ?? a.asset.updatedAt).getTime();
  const bTime = (b.asset.processingEndedAt ?? b.asset.updatedAt).getTime();
  return aTime - bTime || a.asset.updatedAt.getTime() - b.asset.updatedAt.getTime() || a.target.updatedAt.getTime() - b.target.updatedAt.getTime();
}

export class VideoDistributionOrchestratorService {
  constructor(private readonly routeService = new VideoPlaybackRouteService()) {}

  async reconcileVideoDistribution(input: { videoId: string; planId?: string; reason: ReconcileReason }, ctx: AppContext): Promise<VideoDistributionDecision> {
    const video = await ctx.prisma.video.findUnique({
      where: { id: input.videoId },
      include: {
        activePlaybackRoute: { include: { asset: true } },
        distributionPlans: {
          where: input.planId ? { id: input.planId } : { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            targets: {
              include: {
                providerAssets: { orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }] },
                providerJobs: { orderBy: { updatedAt: "desc" } },
              },
            },
          },
        },
      },
    });

    const plan = video?.distributionPlans[0] ?? null;
    const warnings: string[] = [];
    if (!video || !plan) return { videoId: input.videoId, planId: plan?.id ?? null, reason: input.reason, activeRouteChanged: false, activatedAssetId: null, activatedProvider: null, publishAttempted: false, publishCompleted: false, warnings: video ? ["No active distribution plan found."] : ["Video not found."] };

    const readyTargets: ReadyTarget[] = [];
    for (const target of plan.targets) {
      const readyAsset = readyAssetForTarget(target);
      if (readyAsset) {
        readyTargets.push({ target, asset: readyAsset });
        if (target.status !== "READY") await ctx.prisma.videoDistributionTarget.update({ where: { id: target.id }, data: { status: "READY", lastStatusAt: new Date() } });
      } else if ((target.providerJobs ?? []).length > 0 && target.providerJobs.every((job: any) => job.status === "FAILED" || job.status === "ABANDONED" || job.status === "CANCELLED") && target.status !== "DISABLED" && target.status !== "CANCELLED") {
        await ctx.prisma.videoDistributionTarget.update({ where: { id: target.id }, data: { status: "FAILED", lastError: target.providerJobs[0]?.lastError ?? target.lastError, lastStatusAt: new Date() } });
      }
    }

    const currentRouteReady = Boolean(video.activePlaybackRoute?.asset?.processingState === "READY");
    const currentRouteIsAdmin = video.activePlaybackRoute?.activatedBy === "ADMIN";
    let selected: ReadyTarget | null = null;

    if (plan.selectionPolicy === "MANUAL") {
      warnings.push("Manual selection policy: no automatic playback route activation.");
    } else if (plan.selectionPolicy === "PREFER_SELECTED") {
      const preferredReady = plan.preferredProvider ? readyTargets.find((item) => item.target.provider === plan.preferredProvider) ?? null : null;
      if (preferredReady && !currentRouteIsAdmin && video.activePlaybackRoute?.assetId !== preferredReady.asset.id) selected = preferredReady;
      else if (!currentRouteReady) selected = readyTargets.sort(sortFirstReady)[0] ?? null;
    } else if (plan.selectionPolicy === "LOWEST_COST") {
      const order = getProviderCostOrder();
      selected = readyTargets.sort((a, b) => {
        const ai = order.indexOf(a.target.provider as StorageProvider);
        const bi = order.indexOf(b.target.provider as StorageProvider);
        return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi) || sortFirstReady(a, b);
      })[0] ?? null;
      if (currentRouteReady && selected && video.activePlaybackRoute?.assetId === selected.asset.id) selected = null;
    } else {
      // BEST_HEALTH currently behaves like FIRST_READY. Future health scoring belongs here.
      if (!currentRouteReady) selected = readyTargets.sort(sortFirstReady)[0] ?? null;
    }

    let activeRouteChanged = false;
    let activatedAssetId: string | null = null;
    let activatedProvider: string | null = null;
    if (selected) {
      const activatedBy = input.reason === "ADMIN_RETRY" ? "RECONCILER" : "POLICY";
      const route = await this.routeService.activateRoute({ videoId: video.id, assetId: selected.asset.id, planId: plan.id, activatedBy: activatedBy as VideoPlaybackRouteActivatedBy, reason: `distribution-${input.reason.toLowerCase()}` }, ctx);
      activeRouteChanged = true;
      activatedAssetId = route.assetId;
      activatedProvider = route.provider;
    }

    const hasRoute = activeRouteChanged || currentRouteReady;
    const publishAttempted = plan.autopublishPolicy !== "NEVER";
    if (publishAttempted) warnings.push("Autopublish policy evaluated as no-op in this milestone; publishing remains handled by existing admin/publish flows.");

    return { videoId: video.id, planId: plan.id, reason: input.reason, activeRouteChanged, activatedAssetId, activatedProvider, publishAttempted, publishCompleted: false, warnings: hasRoute ? warnings : warnings };
  }
}
