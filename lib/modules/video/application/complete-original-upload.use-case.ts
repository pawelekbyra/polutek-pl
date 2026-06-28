import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoRepository } from "../infrastructure/video.repository";
import { R2OriginalStorageClient } from "../infrastructure/r2-original-storage.client";
import { MuxClient } from "../infrastructure/mux.client";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";

export interface MirrorPlan {
  mux: boolean;
  cloudflare: boolean;
  vimeo: boolean;
  youtube: boolean;
}

export interface CompleteOriginalUploadInput {
  videoId: string;
  originalId: string;
  mirrorPlan?: Partial<MirrorPlan>;
}

export interface CompleteOriginalUploadDto {
  originalId: string;
  mirrorsStarted: string[];
}

type Failure = VideoNotFoundError | AppError;

export async function completeOriginalUpload(
  input: CompleteOriginalUploadInput,
  ctx: AppContext
): Promise<UseCaseResult<CompleteOriginalUploadDto, Failure>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const original = await ctx.prisma.videoOriginal.findFirst({
    where: { id: input.originalId, videoId: video.id },
  });
  if (!original) {
    return fail(new AppError("Original not found.", 404, "ORIGINAL_NOT_FOUND"));
  }

  // Verify object exists in R2
  const r2 = new R2OriginalStorageClient();
  const meta = await r2.getObjectMeta(original.objectKey);
  if (!meta.exists) {
    return fail(new AppError("Upload not found in R2. Complete the upload before calling this endpoint.", 400, "R2_OBJECT_MISSING"));
  }

  // Mark original as READY
  await ctx.prisma.videoOriginal.update({
    where: { id: original.id },
    data: {
      status: "READY",
      uploadCompletedAt: new Date(),
      sizeBytes: meta.sizeBytes ? BigInt(meta.sizeBytes) : original.sizeBytes,
      mimeType: meta.contentType ?? original.mimeType,
    },
  });

  const plan: MirrorPlan = {
    mux: true,
    cloudflare: true,
    vimeo: false,
    youtube: false,
    ...input.mirrorPlan,
  };

  const mirrorsStarted: string[] = [];
  const existingAssets = await ctx.prisma.videoAsset.findMany({ where: { videoId: video.id } });

  // Fire mirrors asynchronously — do not await, let them process in background
  const mirrorPromises: Promise<void>[] = [];

  if (plan.mux && MuxClient.isConfigured()) {
    const hasMux = existingAssets.some(
      (a) => a.provider === VIDEO_PROVIDER.MUX && a.processingState !== VIDEO_ASSET_PROCESSING_STATE.FAILED
    );
    if (!hasMux) {
      mirrorsStarted.push("MUX");
      mirrorPromises.push(startMuxMirror(video.id, original.id, original.objectKey, existingAssets.length === 0, ctx));
    }
  }

  if (plan.cloudflare) {
    const hasCF = existingAssets.some(
      (a) => a.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM && a.processingState !== VIDEO_ASSET_PROCESSING_STATE.FAILED
    );
    if (!hasCF) {
      mirrorsStarted.push("CLOUDFLARE_STREAM");
      mirrorPromises.push(startCloudflareMirror(video.id, original.id, original.objectKey, ctx));
    }
  }

  // Run mirrors in background — on Vercel use waitUntil if available
  const runMirrors = Promise.allSettled(mirrorPromises).then((results) => {
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Mirror ${mirrorsStarted[i]} failed:`, r.reason);
      }
    });
  });

  if (typeof (globalThis as any)[Symbol.for("__vercel_waitUntil")] === "function") {
    (globalThis as any)[Symbol.for("__vercel_waitUntil")](runMirrors);
  } else {
    runMirrors.catch(() => {});
  }

  await recordAuditEvent(ctx, {
    action: "VIDEO_ORIGINAL_UPLOAD_COMPLETED",
    targetType: "Video",
    targetId: video.id,
    metadata: { originalId: original.id, mirrorsStarted },
  });

  return ok({ originalId: original.id, mirrorsStarted });
}

async function startMuxMirror(
  videoId: string,
  originalId: string,
  objectKey: string,
  primaryIntent: boolean,
  ctx: AppContext
): Promise<void> {
  const r2 = new R2OriginalStorageClient();
  const signedUrl = await r2.createPresignedGetUrl({ objectKey, expiresInSeconds: 3600 });

  const mux = new MuxClient();
  const asset = await mux.createAssetFromUrl({ url: signedUrl, primaryIntent });

  await ctx.prisma.videoAsset.create({
    data: {
      videoId,
      provider: VIDEO_PROVIDER.MUX,
      objectKey: `mux:asset:${asset.id}`,
      providerAssetId: asset.id,
      providerPlaybackId: asset.playback_ids?.[0]?.id ?? null,
      processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
      isPrimary: false,
      pendingPrimaryIntent: primaryIntent,
      fallbackPriority: 10,
      mirrorSourceOriginalId: originalId,
      mirrorRequestedAt: new Date(),
      processingStartedAt: new Date(),
    },
  });
}

async function startCloudflareMirror(
  videoId: string,
  originalId: string,
  objectKey: string,
  ctx: AppContext
): Promise<void> {
  const r2 = new R2OriginalStorageClient();
  const signedUrl = await r2.createPresignedGetUrl({ objectKey, expiresInSeconds: 3600 });

  const cf = new CloudflareStreamClient();
  const result = await cf.importVideoByUrl(signedUrl);
  const uid = result.result?.uid;
  if (!uid) throw new Error("Cloudflare importVideoByUrl returned no UID");

  await ctx.prisma.videoAsset.create({
    data: {
      videoId,
      provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
      objectKey: `cf:${uid}`,
      providerAssetId: uid,
      providerPlaybackId: uid,
      processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
      isPrimary: false,
      pendingPrimaryIntent: false,
      fallbackPriority: 20,
      mirrorSourceOriginalId: originalId,
      mirrorRequestedAt: new Date(),
      processingStartedAt: new Date(),
    },
  });
}
