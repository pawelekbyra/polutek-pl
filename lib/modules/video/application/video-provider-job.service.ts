import { Prisma, StorageProvider, VideoAssetProcessingState, VideoProviderJob, VideoProviderJobStatus, VideoProviderJobType } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { isAutomaticFilePlaybackProvider } from "../domain/video-provider-capabilities";
import { OriginalSourceUrlService, redactSignedUrl } from "./original-source-url.service";
import { createDefaultPlaybackProviderRegistry, PlaybackProviderRegistry } from "../infrastructure/playback-provider-registry";

const PROCESSING_JOB_STATES = new Set<VideoProviderJobStatus>([
  VideoProviderJobStatus.QUEUED,
  VideoProviderJobStatus.RUNNING,
  VideoProviderJobStatus.WAITING_PROVIDER,
]);

function idempotencyKey(input: { videoId: string; planId: string; provider: StorageProvider; originalId: string }) {
  return `video:${input.videoId}:plan:${input.planId}:target:${input.provider}:original:${input.originalId}:import`;
}

function toAssetState(state: "PENDING" | "UPLOADING" | "PROCESSING" | "READY"): VideoAssetProcessingState {
  if (state === "READY") return VideoAssetProcessingState.READY;
  if (state === "UPLOADING") return VideoAssetProcessingState.UPLOADING;
  if (state === "PROCESSING") return VideoAssetProcessingState.PROCESSING;
  return VideoAssetProcessingState.PENDING;
}

function toJobState(state: "PENDING" | "UPLOADING" | "PROCESSING" | "READY"): VideoProviderJobStatus {
  return state === "READY" ? VideoProviderJobStatus.READY : VideoProviderJobStatus.WAITING_PROVIDER;
}

export class VideoProviderJobService {
  constructor(
    private readonly registry: PlaybackProviderRegistry = createDefaultPlaybackProviderRegistry(),
    private readonly sourceUrls = new OriginalSourceUrlService(),
  ) {}

  async enqueueImportJobsForPlan(input: { planId: string }, ctx: AppContext): Promise<VideoProviderJob[]> {
    const plan = await ctx.prisma.videoDistributionPlan.findUnique({
      where: { id: input.planId },
      include: { targets: true },
    });
    if (!plan || !plan.isActive || !plan.originalId || plan.mode === "MANUAL") return [];

    const jobs: VideoProviderJob[] = [];
    for (const target of plan.targets) {
      if (!isAutomaticFilePlaybackProvider(target.provider)) continue;
      const key = idempotencyKey({ videoId: plan.videoId, planId: plan.id, provider: target.provider, originalId: plan.originalId });
      const job = await ctx.prisma.videoProviderJob.upsert({
        where: { idempotencyKey: key },
        create: {
          videoId: plan.videoId,
          planId: plan.id,
          targetId: target.id,
          originalId: plan.originalId,
          provider: target.provider,
          type: VideoProviderJobType.IMPORT_FROM_ORIGINAL,
          status: VideoProviderJobStatus.QUEUED,
          idempotencyKey: key,
        },
        update: {},
      });
      await ctx.prisma.videoDistributionTarget.update({
        where: { id: target.id },
        data: { status: "QUEUED", lastStatusAt: new Date() },
      });
      jobs.push(job);
    }
    return jobs;
  }

  async startQueuedJob(input: { jobId: string }, ctx: AppContext): Promise<void> {
    const job = await ctx.prisma.videoProviderJob.findUnique({
      where: { id: input.jobId },
      include: { target: true, plan: true, original: true, asset: true },
    });
    if (!job || job.type !== VideoProviderJobType.IMPORT_FROM_ORIGINAL) return;
    if (!PROCESSING_JOB_STATES.has(job.status)) return;
    if (!job.target || !job.plan || !job.original) {
      await this.failJob(ctx, job.id, job.targetId, `${job.provider} import job is missing plan, target, or original`);
      return;
    }

    const adapter = this.registry.get(job.provider);
    if (!adapter.isConfigured()) {
      await this.failJob(ctx, job.id, job.target.id, `${job.provider} not configured`);
      return;
    }

    await ctx.prisma.videoProviderJob.update({
      where: { id: job.id },
      data: { status: VideoProviderJobStatus.RUNNING, startedAt: new Date(), attemptCount: { increment: job.status === VideoProviderJobStatus.QUEUED ? 1 : 0 } },
    });
    await ctx.prisma.videoDistributionTarget.update({ where: { id: job.target.id }, data: { status: "STARTING", lastStatusAt: new Date() } });

    let assetId = job.assetId;
    try {
      const source = await this.sourceUrls.createProviderImportUrl({ originalId: job.original.id }, ctx);
      const asset = assetId
        ? await ctx.prisma.videoAsset.update({
            where: { id: assetId },
            data: { processingState: VideoAssetProcessingState.PENDING, failureReason: null, processingStartedAt: new Date() },
          })
        : await ctx.prisma.videoAsset.create({
            data: {
              videoId: job.videoId,
              distributionTargetId: job.target.id,
              provider: job.provider,
              objectKey: `${job.provider.toLowerCase()}:pending:${job.original.id}`,
              processingState: VideoAssetProcessingState.PENDING,
              isPrimary: false,
              pendingPrimaryIntent: job.target.desiredPrimary,
              fallbackPriority: job.target.desiredPrimary ? 10 : 20,
              mirrorSourceOriginalId: job.original.id,
              mirrorRequestedAt: new Date(),
              processingStartedAt: new Date(),
            },
          });
      assetId = asset.id;
      await ctx.prisma.videoProviderJob.update({ where: { id: job.id }, data: { assetId } });

      const result = await adapter.createAssetFromOriginal({
        videoId: job.videoId,
        originalId: job.original.id,
        sourceUrl: source.url,
        fileName: job.original.originalFileName,
        mimeType: job.original.mimeType,
        metadata: { planId: job.plan.id, targetId: job.target.id },
      });

      const assetState = toAssetState(result.initialState);
      const jobState = toJobState(result.initialState);
      await ctx.prisma.videoAsset.update({
        where: { id: assetId },
        data: {
          objectKey: `${job.provider.toLowerCase()}:asset:${result.providerAssetId}`,
          providerAssetId: result.providerAssetId,
          providerPlaybackId: result.providerPlaybackId ?? null,
          muxUploadId: result.providerUploadId ?? null,
          processingState: assetState,
          processingEndedAt: assetState === VideoAssetProcessingState.READY ? new Date() : null,
          failureReason: null,
        },
      });
      await ctx.prisma.videoProviderJob.update({
        where: { id: job.id },
        data: {
          status: jobState,
          providerAssetId: result.providerAssetId,
          providerPlaybackId: result.providerPlaybackId ?? null,
          providerUploadId: result.providerUploadId ?? null,
          completedAt: jobState === VideoProviderJobStatus.READY ? new Date() : null,
          lastError: null,
          metadata: Prisma.DbNull,
        },
      });
      await ctx.prisma.videoDistributionTarget.update({
        where: { id: job.target.id },
        data: { status: jobState === VideoProviderJobStatus.READY ? "READY" : "WAITING_PROVIDER", lastError: null, lastStatusAt: new Date() },
      });
    } catch (error) {
      const safeMessage = redactSignedUrl(error instanceof Error ? error.message : String(error));
      if (assetId) {
        await ctx.prisma.videoAsset.update({ where: { id: assetId }, data: { processingState: VideoAssetProcessingState.FAILED, failureReason: safeMessage, processingEndedAt: new Date() } });
      }
      await this.failJob(ctx, job.id, job.target.id, safeMessage);
    }
  }

  async retryJob(input: { jobId: string; requestedByAdminId?: string; force?: boolean }, ctx: AppContext): Promise<void> {
    const job = await ctx.prisma.videoProviderJob.findUnique({ where: { id: input.jobId } });
    if (!job) throw new AppError("Provider job not found.", 404, "VIDEO_PROVIDER_JOB_NOT_FOUND");
    const retryable = job.status === VideoProviderJobStatus.FAILED || job.status === VideoProviderJobStatus.ABANDONED || (input.force && job.status === VideoProviderJobStatus.CANCELLED);
    if (!retryable) throw new AppError("Provider job is not retryable.", 409, "VIDEO_PROVIDER_JOB_NOT_RETRYABLE");
    if (!input.force && job.attemptCount >= job.maxAttempts) {
      throw new AppError("Provider job has reached max attempts.", 409, "VIDEO_PROVIDER_JOB_MAX_ATTEMPTS");
    }

    await ctx.prisma.videoProviderJob.update({
      where: { id: job.id },
      data: { status: VideoProviderJobStatus.QUEUED, lastError: null, lastErrorCode: null, nextAttemptAt: null, metadata: Prisma.DbNull },
    });
    if (job.targetId) {
      await ctx.prisma.videoDistributionTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED", lastError: null, lastStatusAt: new Date() } });
    }
    await this.startQueuedJob({ jobId: job.id }, ctx);
  }

  private async failJob(ctx: AppContext, jobId: string, targetId: string | null, message: string) {
    await ctx.prisma.videoProviderJob.update({
      where: { id: jobId },
      data: { status: VideoProviderJobStatus.FAILED, lastError: message, completedAt: new Date(), metadata: Prisma.DbNull },
    });
    if (targetId) {
      await ctx.prisma.videoDistributionTarget.update({ where: { id: targetId }, data: { status: "FAILED", lastError: message, lastStatusAt: new Date() } });
    }
  }
}
