import { Prisma, StorageProvider, VideoAssetProcessingState, VideoProviderJobStatus, VideoProviderWebhookStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { redactSignedUrl } from "./original-source-url.service";
import { VideoDistributionOrchestratorService } from "./video-distribution-orchestrator.service";

export type IngestProviderWebhookInput = {
  provider: StorageProvider;
  externalEventId?: string | null;
  eventType: string;
  providerAssetId?: string | null;
  providerUploadId?: string | null;
  providerPlaybackId?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  state?: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "IGNORED";
  failureReason?: string | null;
  payload: unknown;
};

export type IngestProviderWebhookResult = {
  eventId: string;
  deduped: boolean;
  matchedAssetId: string | null;
  matchedJobId: string | null;
  videoId: string | null;
  planId: string | null;
  action: "PROCESSED" | "IGNORED" | "FAILED";
};

function toAssetState(state: string | undefined): VideoAssetProcessingState | null {
  if (state === "READY") return VideoAssetProcessingState.READY;
  if (state === "FAILED") return VideoAssetProcessingState.FAILED;
  if (state === "UPLOADING") return VideoAssetProcessingState.UPLOADING;
  if (state === "PENDING") return VideoAssetProcessingState.PENDING;
  if (state === "PROCESSING") return VideoAssetProcessingState.PROCESSING;
  return null;
}
function toJobState(state: string | undefined): VideoProviderJobStatus | null {
  if (state === "READY") return VideoProviderJobStatus.READY;
  if (state === "FAILED") return VideoProviderJobStatus.FAILED;
  if (state === "PROCESSING" || state === "PENDING" || state === "UPLOADING") return VideoProviderJobStatus.WAITING_PROVIDER;
  return null;
}

export class VideoProviderWebhookService {
  constructor(private readonly orchestrator = new VideoDistributionOrchestratorService()) {}

  async ingestProviderWebhook(input: IngestProviderWebhookInput, ctx: AppContext): Promise<IngestProviderWebhookResult> {
    let event;
    let deduped = false;
    if (input.externalEventId) {
      const existing = await ctx.prisma.videoProviderWebhookEvent.findUnique({ where: { provider_externalEventId: { provider: input.provider, externalEventId: input.externalEventId } } });
      if (existing) {
        return { eventId: existing.id, deduped: true, matchedAssetId: null, matchedJobId: null, videoId: null, planId: null, action: existing.status === "PROCESSED" ? "PROCESSED" : existing.status === "FAILED" ? "FAILED" : "IGNORED" };
      }
    }
    event = await ctx.prisma.videoProviderWebhookEvent.create({
      data: { provider: input.provider, externalEventId: input.externalEventId ?? null, eventType: input.eventType, providerAssetId: input.providerAssetId ?? null, providerUploadId: input.providerUploadId ?? null, payload: input.payload as Prisma.InputJsonValue },
    });

    const asset = input.providerAssetId ? await ctx.prisma.videoAsset.findFirst({ where: { provider: input.provider, providerAssetId: input.providerAssetId } }) : null;
    const jobMatchers = [input.providerAssetId ? { providerAssetId: input.providerAssetId } : {}, input.providerUploadId ? { providerUploadId: input.providerUploadId } : {}].filter((item) => Object.keys(item).length > 0);
    const job = jobMatchers.length > 0 ? await ctx.prisma.videoProviderJob.findFirst({
      where: { provider: input.provider, OR: jobMatchers },
    }) : null;
    const matchedAsset = asset ?? (job?.assetId ? await ctx.prisma.videoAsset.findUnique({ where: { id: job.assetId } }) : null);
    const targetId = job?.targetId ?? matchedAsset?.distributionTargetId ?? null;
    const target = !job?.planId && targetId ? await ctx.prisma.videoDistributionTarget.findUnique({ where: { id: targetId }, select: { planId: true } }) : null;
    const videoId = matchedAsset?.videoId ?? job?.videoId ?? null;
    const planId = job?.planId ?? target?.planId ?? null;

    if (input.state === "IGNORED" || (!matchedAsset && !job)) {
      await ctx.prisma.videoProviderWebhookEvent.update({ where: { id: event.id }, data: { status: VideoProviderWebhookStatus.IGNORED, processedAt: new Date() } });
      return { eventId: event.id, deduped, matchedAssetId: null, matchedJobId: null, videoId, planId, action: "IGNORED" };
    }

    const safeError = input.failureReason ? redactSignedUrl(input.failureReason) : null;
    const assetState = toAssetState(input.state);
    const jobState = toJobState(input.state);
    if (matchedAsset && assetState) {
      const currentReady = matchedAsset.processingState === VideoAssetProcessingState.READY;
      const nextAssetState = currentReady && assetState !== VideoAssetProcessingState.FAILED ? VideoAssetProcessingState.READY : assetState;
      await ctx.prisma.videoAsset.update({
        where: { id: matchedAsset.id },
        data: {
          processingState: nextAssetState,
          providerAssetId: input.providerAssetId ?? matchedAsset.providerAssetId,
          providerPlaybackId: input.providerPlaybackId ?? matchedAsset.providerPlaybackId,
          sizeBytes: input.sizeBytes ?? matchedAsset.sizeBytes,
          providerSyncedAt: new Date(),
          processingEndedAt: nextAssetState === "READY" || nextAssetState === "FAILED" ? new Date() : matchedAsset.processingEndedAt,
          failureReason: nextAssetState === "FAILED" ? safeError : null,
        },
      });
    }
    if (job && jobState) {
      const nextJobState = job.status === VideoProviderJobStatus.READY && jobState !== VideoProviderJobStatus.FAILED ? VideoProviderJobStatus.READY : jobState;
      await ctx.prisma.videoProviderJob.update({ where: { id: job.id }, data: { status: nextJobState, providerAssetId: input.providerAssetId ?? job.providerAssetId, providerPlaybackId: input.providerPlaybackId ?? job.providerPlaybackId, lastWebhookAt: new Date(), completedAt: nextJobState === "READY" || nextJobState === "FAILED" ? new Date() : job.completedAt, lastError: nextJobState === "FAILED" ? safeError : null, metadata: Prisma.DbNull } });
    }
    if (targetId && input.state) {
      await ctx.prisma.videoDistributionTarget.update({ where: { id: targetId }, data: { status: input.state === "READY" ? "READY" : input.state === "FAILED" ? "FAILED" : "WAITING_PROVIDER", lastError: input.state === "FAILED" ? safeError : null, lastStatusAt: new Date() } });
    }
    await ctx.prisma.videoProviderWebhookEvent.update({ where: { id: event.id }, data: { status: VideoProviderWebhookStatus.PROCESSED, processedAt: new Date() } });
    if (videoId) await this.orchestrator.reconcileVideoDistribution({ videoId, planId: planId ?? undefined, reason: "WEBHOOK" }, ctx);
    return { eventId: event.id, deduped, matchedAssetId: matchedAsset?.id ?? null, matchedJobId: job?.id ?? null, videoId, planId, action: "PROCESSED" };
  }
}
