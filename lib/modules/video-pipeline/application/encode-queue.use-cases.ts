import type { PrismaClient, VideoAsset, VideoEncodeJob, VideoOriginal } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { assetSizeToNumber } from "@/lib/modules/video/domain/asset-size";
import { EncodeJobError, STALE_HEARTBEAT_MS, isActiveStatus, parseVersionNumber, type EncodeJobStatus, type EncodeStage } from "../domain/encode-job.state";
import { EncodeJobRepository } from "../infrastructure/encode-job.repository";
import { actorId, requireVideo } from "./video-guard";

/** AppSetting key the worker refreshes every ~30 s so the admin can tell "queued" from "no worker". */
export const WORKER_HEARTBEAT_SETTING = "video_worker_heartbeat";
const WORKER_ALIVE_MS = 2 * 60 * 1000;

export interface EncodeJobDto {
  id: string;
  status: EncodeJobStatus;
  stage: EncodeStage;
  progressPercent: number;
  etaSeconds: number | null;
  attemptCount: number;
  maxAttempts: number;
  versionNumber: number;
  originalId: string;
  assetId: string | null;
  cancelRequested: boolean;
  failureCode: string | null;
  failureReason: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** True while RUNNING and the heartbeat is fresh. */
  heartbeatFresh: boolean;
}

export type PipelineSummary = "NO_ORIGINAL" | "UPLOADING" | "QUEUED" | "ENCODING" | "READY" | "FAILED" | "CANCELLED" | "UPLOAD_FAILED";

export interface PipelineStateDto {
  summary: PipelineSummary;
  workerAlive: boolean;
  original: { id: string; status: string; fileName: string | null; sizeBytes: string | null; version: number; failureReason: string | null; uploadCompletedAt: string | null } | null;
  job: EncodeJobDto | null;
  assets: Array<{ id: string; objectKey: string; versionNumber: number; isActive: boolean; sizeBytes: number | null; createdAt: string }>;
  hasCompetingSource: boolean;
}

export function toEncodeJobDto(job: VideoEncodeJob, now: Date): EncodeJobDto {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progressPercent: job.progressPercent,
    etaSeconds: job.etaSeconds,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    versionNumber: job.versionNumber,
    originalId: job.originalId,
    assetId: job.assetId,
    cancelRequested: job.cancelRequested,
    failureCode: job.failureCode,
    failureReason: job.failureReason,
    nextAttemptAt: job.nextAttemptAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    heartbeatFresh: job.status === "RUNNING" && job.heartbeatAt !== null && now.getTime() - job.heartbeatAt.getTime() <= STALE_HEARTBEAT_MS,
  };
}

function repo(ctx: AppContext) {
  return new EncodeJobRepository(ctx.prisma as PrismaClient);
}

/**
 * Starts (or re-starts = "re-encode") encoding for a video. Uses the given original, else the
 * active one, else the newest READY one. Idempotent: an already queued/running job for the same
 * original is returned unchanged.
 */
export async function enqueueEncode(
  input: { videoId: string; originalId?: string; auditAction?: string },
  ctx: AppContext,
): Promise<UseCaseResult<EncodeJobDto, AppError>> {
  try {
    const video = await requireVideo(input.videoId, ctx);
    const original = input.originalId
      ? await ctx.prisma.videoOriginal.findFirst({ where: { id: input.originalId, videoId: video.id } })
      : video.activeOriginalId
        ? await ctx.prisma.videoOriginal.findFirst({ where: { id: video.activeOriginalId, videoId: video.id } })
        : await ctx.prisma.videoOriginal.findFirst({ where: { videoId: video.id, status: "READY" }, orderBy: { version: "desc" } });
    if (!original) return fail(new AppError("Film nie ma wgranego pliku zrodlowego.", 409, "ORIGINAL_MISSING"));
    if (original.status !== "READY") return fail(new AppError("Plik zrodlowy nie jest gotowy (upload nie zostal ukonczony).", 409, "ORIGINAL_NOT_READY"));

    const { job, created } = await repo(ctx).enqueue({ videoId: video.id, originalId: original.id, requestedById: actorId(ctx) });
    if (created) {
      await recordAuditEvent(ctx, {
        action: input.auditAction ?? "VIDEO_ENCODE_ENQUEUED",
        targetType: "Video",
        targetId: video.id,
        metadata: { jobId: job.id, originalId: original.id, versionNumber: job.versionNumber },
      });
    }
    return ok(toEncodeJobDto(job, ctx.now()));
  } catch (error) {
    if (error instanceof EncodeJobError) return fail(new AppError(error.message, 409, error.code));
    if (error instanceof AppError) return fail(error);
    throw error;
  }
}

export async function cancelEncode(input: { videoId: string; jobId: string }, ctx: AppContext): Promise<UseCaseResult<{ result: string }, AppError>> {
  try {
    const video = await requireVideo(input.videoId, ctx);
    const result = await repo(ctx).requestCancel(input.jobId, video.id);
    if (result === "not_found") return fail(new AppError("Zadanie nie istnieje.", 404, "ENCODE_JOB_NOT_FOUND"));
    if (result === "terminal") return fail(new AppError("Zadanie jest juz zakonczone.", 409, "ENCODE_JOB_FINISHED"));
    await recordAuditEvent(ctx, { action: "VIDEO_ENCODE_CANCEL_REQUESTED", targetType: "Video", targetId: video.id, metadata: { jobId: input.jobId, result } });
    return ok({ result });
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }
}

export async function getPipelineState(input: { videoId: string }, ctx: AppContext): Promise<UseCaseResult<PipelineStateDto, AppError>> {
  try {
    const video = await ctx.prisma.video.findFirst({
      where: { id: input.videoId },
      select: { id: true, creatorId: true, activeOriginalId: true, activePlaybackRouteId: true },
    });
    const channel = await MainChannelService.getRequired(ctx);
    if (!video || video.creatorId !== channel.id) return fail(new AppError("Film nie istnieje.", 404, "VIDEO_NOT_FOUND"));
    const now = ctx.now();

    const [original, latestJob, selfAssets, otherAssets, heartbeat] = await Promise.all([
      ctx.prisma.videoOriginal.findFirst({ where: { videoId: video.id, status: { not: "SUPERSEDED" } }, orderBy: { version: "desc" } }),
      repo(ctx).listForVideo(video.id, 1).then((rows) => rows[0] ?? null),
      ctx.prisma.videoAsset.findMany({ where: { videoId: video.id, provider: "SELF_HLS" }, orderBy: { createdAt: "desc" } }),
      ctx.prisma.videoAsset.count({ where: { videoId: video.id, provider: { not: "SELF_HLS" } } }),
      ctx.prisma.appSetting.findUnique({ where: { key: WORKER_HEARTBEAT_SETTING } }),
    ]);

    const activeRoute = video.activePlaybackRouteId
      ? await ctx.prisma.videoPlaybackRoute.findUnique({ where: { id: video.activePlaybackRouteId }, select: { assetId: true } })
      : null;

    const beat = heartbeat ? Date.parse(heartbeat.value) : NaN;
    const workerAlive = Number.isFinite(beat) && now.getTime() - beat <= WORKER_ALIVE_MS;

    return ok({
      summary: summarize(original, latestJob, selfAssets.length > 0),
      workerAlive,
      original: original ? toOriginalDto(original) : null,
      job: latestJob ? toEncodeJobDto(latestJob, now) : null,
      assets: selfAssets.map((a: VideoAsset) => ({
        id: a.id,
        objectKey: a.objectKey,
        versionNumber: parseVersionNumber(a.objectKey),
        isActive: a.id === activeRoute?.assetId,
        sizeBytes: assetSizeToNumber(a.sizeBytes),
        createdAt: a.createdAt.toISOString(),
      })),
      hasCompetingSource: otherAssets > 0,
    });
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }
}

function toOriginalDto(o: VideoOriginal) {
  return {
    id: o.id,
    status: o.status,
    fileName: o.originalFileName,
    sizeBytes: o.sizeBytes === null ? null : o.sizeBytes.toString(),
    version: o.version,
    failureReason: o.failureReason,
    uploadCompletedAt: o.uploadCompletedAt?.toISOString() ?? null,
  };
}

export function summarize(original: VideoOriginal | null, job: VideoEncodeJob | null, hasOutput: boolean): PipelineSummary {
  if (job && isActiveStatus(job.status)) return job.status === "QUEUED" ? "QUEUED" : "ENCODING";
  // A failed (re-)encode is shown as failed even when an older output still plays: the admin must see it.
  if (job?.status === "FAILED") return "FAILED";
  if (job?.status === "CANCELLED" && !hasOutput) return "CANCELLED";
  if (hasOutput) return "READY";
  if (!original) return "NO_ORIGINAL";
  if (original.status === "UPLOADING" || original.status === "PROVISIONING") return "UPLOADING";
  if (original.status === "FAILED" || original.status === "ABANDONED") return "UPLOAD_FAILED";
  return "QUEUED";
}
