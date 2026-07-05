import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoRepository } from "../infrastructure/video.repository";
import { R2OriginalStorageClient } from "../infrastructure/r2-original-storage.client";
import { DEFAULT_DISTRIBUTION_STRATEGY } from "../domain/video-distribution.constants";
import { normalizeLegacyMirrorPlan, VideoDistributionStrategyInput } from "../domain/video-distribution.types";
import { AdminVideoMediaDto } from "./video-media-state.dto";
import { getAdminVideoMediaState } from "./get-admin-video-media-state.use-case";
import { VideoDistributionPlanService } from "./video-distribution-plan.service";
import { VideoProviderJobService } from "./video-provider-job.service";

export interface MirrorPlan {
  mux: boolean;
  cloudflare: boolean;
}

export interface CompleteOriginalUploadInput {
  videoId: string;
  originalId: string;
  strategy?: VideoDistributionStrategyInput;
  publishAfterReady?: boolean;
  mirrorPlan?: Partial<MirrorPlan>;
  preferredProvider?: string;
}

type Failure = VideoNotFoundError | AppError;

function resolveStrategy(input: CompleteOriginalUploadInput): VideoDistributionStrategyInput {
  if (input.strategy) return input.strategy;
  if (input.mirrorPlan) {
    return normalizeLegacyMirrorPlan({
      mirrorPlan: input.mirrorPlan,
      preferredProvider: input.preferredProvider,
      publishAfterReady: input.publishAfterReady,
    });
  }
  return DEFAULT_DISTRIBUTION_STRATEGY;
}

export async function completeOriginalUpload(
  input: CompleteOriginalUploadInput,
  ctx: AppContext,
): Promise<UseCaseResult<AdminVideoMediaDto, Failure>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const original = await ctx.prisma.videoOriginal.findFirst({ where: { id: input.originalId, videoId: video.id } });
  if (!original) return fail(new AppError("Original not found.", 404, "ORIGINAL_NOT_FOUND"));

  const r2 = new R2OriginalStorageClient();
  const meta = await r2.getObjectMeta(original.objectKey);
  if (!meta.exists) {
    return fail(new AppError("Upload not found in R2. Complete the upload before calling this endpoint.", 400, "R2_OBJECT_MISSING"));
  }

  await ctx.prisma.videoOriginal.update({
    where: { id: original.id },
    data: {
      status: "READY",
      uploadCompletedAt: new Date(),
      verifiedAt: new Date(),
      sizeBytes: meta.sizeBytes ? BigInt(meta.sizeBytes) : original.sizeBytes,
      mimeType: meta.contentType ?? original.mimeType,
    },
  });
  await ctx.prisma.video.update({ where: { id: video.id }, data: { activeOriginalId: original.id } });

  const planService = new VideoDistributionPlanService();
  const plan = await planService.createOrReplaceActivePlan({
    videoId: video.id,
    originalId: original.id,
    strategy: resolveStrategy(input),
    publishAfterReady: input.publishAfterReady,
    createdByAdminId: ctx.actor.type === "admin" ? ctx.actor.userId : undefined,
  }, ctx);

  const jobService = new VideoProviderJobService();
  const jobs = await jobService.enqueueImportJobsForPlan({ planId: plan.id }, ctx);
  for (const job of jobs) {
    await jobService.startQueuedJob({ jobId: job.id }, ctx);
  }

  await recordAuditEvent(ctx, {
    action: "VIDEO_ORIGINAL_UPLOAD_COMPLETED",
    targetType: "Video",
    targetId: video.id,
    metadata: { originalId: original.id, planId: plan.id, jobsCreated: jobs.length },
  });

  const mediaState = await getAdminVideoMediaState({ videoId: video.id }, ctx);
  if (!mediaState.ok) return fail(mediaState.error);
  return ok(mediaState.data);
}
