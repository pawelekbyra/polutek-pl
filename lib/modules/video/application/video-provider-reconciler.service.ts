import { Prisma, StorageProvider, VideoAssetProcessingState, VideoProviderJobStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { createDefaultPlaybackProviderRegistry, PlaybackProviderRegistry } from "../infrastructure/playback-provider-registry";
import { redactSignedUrl } from "./original-source-url.service";
import { VideoDistributionOrchestratorService } from "./video-distribution-orchestrator.service";
import { VideoProviderJobService } from "./video-provider-job.service";

export type ReconcileProviderJobsResult = { scannedJobs: number; syncedJobs: number; readyJobs: number; failedJobs: number; retriedJobs: number; skippedJobs: number; errors: Array<{ jobId: string; provider: string; error: string }> };
function toAssetState(state: string): VideoAssetProcessingState { return state === "READY" ? VideoAssetProcessingState.READY : state === "FAILED" ? VideoAssetProcessingState.FAILED : VideoAssetProcessingState.PROCESSING; }
function toJobState(state: string): VideoProviderJobStatus { return state === "READY" ? VideoProviderJobStatus.READY : state === "FAILED" ? VideoProviderJobStatus.FAILED : VideoProviderJobStatus.WAITING_PROVIDER; }

export class VideoProviderReconcilerService {
  constructor(private readonly registry: PlaybackProviderRegistry = createDefaultPlaybackProviderRegistry(), private readonly orchestrator = new VideoDistributionOrchestratorService(), private readonly jobService = new VideoProviderJobService(registry)) {}

  async reconcilePendingProviderJobs(input: { limit?: number; olderThanSeconds?: number; provider?: StorageProvider; dryRun?: boolean }, ctx: AppContext): Promise<ReconcileProviderJobsResult> {
    const result: ReconcileProviderJobsResult = { scannedJobs: 0, syncedJobs: 0, readyJobs: 0, failedJobs: 0, retriedJobs: 0, skippedJobs: 0, errors: [] };
    const olderThan = new Date(Date.now() - (input.olderThanSeconds ?? 60) * 1000);
    const jobs = await ctx.prisma.videoProviderJob.findMany({
      where: { provider: input.provider, OR: [{ status: "WAITING_PROVIDER" }, { status: "RUNNING" }, { status: "QUEUED", updatedAt: { lte: olderThan } }, { status: "FAILED", nextAttemptAt: { lte: new Date() } }] },
      take: input.limit ?? 50,
      orderBy: { updatedAt: "asc" },
      include: { asset: true, target: true, plan: true },
    });
    for (const job of jobs) {
      result.scannedJobs++;
      try {
        if (job.status === "FAILED") {
          if (job.attemptCount < job.maxAttempts && job.plan?.isActive && !input.dryRun) { await this.jobService.retryJob({ jobId: job.id }, ctx); result.retriedJobs++; }
          else result.skippedJobs++;
          continue;
        }
        const adapter = this.registry.get(job.provider);
        if (!adapter.isConfigured()) throw new Error(`${job.provider} not configured`);
        const status = await adapter.getAssetStatus({ providerAssetId: job.providerAssetId, providerUploadId: job.providerUploadId });
        if (input.dryRun) { result.syncedJobs++; continue; }
        const assetState = toAssetState(status.state);
        const jobState = toJobState(status.state);
        if (job.assetId) await ctx.prisma.videoAsset.update({ where: { id: job.assetId }, data: { processingState: assetState, providerAssetId: status.providerAssetId ?? job.providerAssetId, providerPlaybackId: status.providerPlaybackId ?? job.providerPlaybackId, providerSyncedAt: new Date(), processingEndedAt: assetState === "READY" || assetState === "FAILED" ? new Date() : job.asset?.processingEndedAt, failureReason: assetState === "FAILED" ? redactSignedUrl(status.failureReason ?? "Provider reported failure") : null } });
        await ctx.prisma.videoProviderJob.update({ where: { id: job.id }, data: { status: jobState, providerAssetId: status.providerAssetId ?? job.providerAssetId, providerPlaybackId: status.providerPlaybackId ?? job.providerPlaybackId, providerUploadId: status.providerUploadId ?? job.providerUploadId, lastReconciledAt: new Date(), completedAt: jobState === "READY" || jobState === "FAILED" ? new Date() : job.completedAt, lastError: jobState === "FAILED" ? redactSignedUrl(status.failureReason ?? "Provider reported failure") : null, metadata: Prisma.DbNull } });
        if (job.targetId) await ctx.prisma.videoDistributionTarget.update({ where: { id: job.targetId }, data: { status: status.state === "READY" ? "READY" : status.state === "FAILED" ? "FAILED" : "WAITING_PROVIDER", lastError: status.state === "FAILED" ? redactSignedUrl(status.failureReason ?? "Provider reported failure") : null, lastStatusAt: new Date() } });
        if (status.state === "READY") result.readyJobs++; else if (status.state === "FAILED") result.failedJobs++;
        result.syncedJobs++;
        await this.orchestrator.reconcileVideoDistribution({ videoId: job.videoId, planId: job.planId ?? undefined, reason: "CRON_RECONCILE" }, ctx);
      } catch (error) {
        const safe = redactSignedUrl(error instanceof Error ? error.message : String(error));
        result.errors.push({ jobId: job.id, provider: job.provider, error: safe });
        result.skippedJobs++;
        if (!input.dryRun) await ctx.prisma.videoProviderJob.update({ where: { id: job.id }, data: { lastError: safe, lastReconciledAt: new Date(), metadata: Prisma.DbNull } });
      }
    }
    return result;
  }
}
