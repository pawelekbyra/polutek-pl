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

  // Mark original READY + fetch existing assets in one transaction
  const [, existingAssets] = await Promise.all([
    ctx.prisma.videoOriginal.update({
      where: { id: original.id },
      data: {
        status: "READY",
        uploadCompletedAt: new Date(),
        sizeBytes: meta.sizeBytes ? BigInt(meta.sizeBytes) : original.sizeBytes,
        mimeType: meta.contentType ?? original.mimeType,
      },
    }),
    ctx.prisma.videoAsset.findMany({ where: { videoId: video.id } }),
  ]);

  const plan: MirrorPlan = {
    mux: true,
    cloudflare: true,
    ...input.mirrorPlan,
  };

  const mirrorsStarted: string[] = [];
  const mirrorPromises: Promise<void>[] = [];

  // Generate one signed GET URL shared by all mirrors
  const signedSourceUrl = await r2.createPresignedGetUrl({
    objectKey: original.objectKey,
    expiresInSeconds: 3600,
  });

  if (plan.mux && MuxClient.isConfigured()) {
    const hasMux = existingAssets.some(
      (a) => a.provider === VIDEO_PROVIDER.MUX && a.processingState !== VIDEO_ASSET_PROCESSING_STATE.FAILED
    );
    if (!hasMux) {
      mirrorsStarted.push("MUX");
      mirrorPromises.push(startMuxMirror(video.id, original.id, signedSourceUrl, existingAssets.length === 0, ctx));
    }
  }

  if (plan.cloudflare && CloudflareStreamClient.isConfigured()) {
    const hasCF = existingAssets.some(
      (a) => a.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM && a.processingState !== VIDEO_ASSET_PROCESSING_STATE.FAILED
    );
    if (!hasCF) {
      mirrorsStarted.push("CLOUDFLARE_STREAM");
      mirrorPromises.push(startCloudflareMirror(video.id, original.id, signedSourceUrl, ctx));
    }
  }

  const runMirrors = Promise.allSettled(mirrorPromises).then((results) => {
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Mirror ${mirrorsStarted[i]} failed:`, r.reason);
      }
    });
  });

  if (ctx.waitUntil) {
    ctx.waitUntil(runMirrors);
  } else {
    void runMirrors;
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
  signedSourceUrl: string,
  primaryIntent: boolean,
  ctx: AppContext
): Promise<void> {
  const mux = new MuxClient();
  // Create DB row first — if Mux API fails after, we have no orphan
  const asset = await ctx.prisma.videoAsset.create({
    data: {
      videoId,
      provider: VIDEO_PROVIDER.MUX,
      objectKey: `mux:pending:${originalId}`,
      processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
      isPrimary: false,
      pendingPrimaryIntent: primaryIntent,
      fallbackPriority: 10,
      mirrorSourceOriginalId: originalId,
      mirrorRequestedAt: new Date(),
      processingStartedAt: new Date(),
    },
  });

  try {
    const muxAsset = await mux.createAssetFromUrl({ url: signedSourceUrl, primaryIntent });
    await ctx.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        objectKey: `mux:asset:${muxAsset.id}`,
        providerAssetId: muxAsset.id,
        providerPlaybackId: muxAsset.playback_ids?.[0]?.id ?? null,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
      },
    });
  } catch (err) {
    await ctx.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        processingState: VIDEO_ASSET_PROCESSING_STATE.FAILED,
        failureReason: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

async function startCloudflareMirror(
  videoId: string,
  originalId: string,
  signedSourceUrl: string,
  ctx: AppContext
): Promise<void> {
  const cf = new CloudflareStreamClient();
  const asset = await ctx.prisma.videoAsset.create({
    data: {
      videoId,
      provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
      objectKey: `cf:pending:${originalId}`,
      processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
      isPrimary: false,
      pendingPrimaryIntent: false,
      fallbackPriority: 20,
      mirrorSourceOriginalId: originalId,
      mirrorRequestedAt: new Date(),
      processingStartedAt: new Date(),
    },
  });

  try {
    const result = await cf.importVideoByUrl(signedSourceUrl);
    const uid = result.result?.uid;
    if (!uid) throw new Error("Cloudflare importVideoByUrl returned no UID");

    await ctx.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        objectKey: `cf:${uid}`,
        providerAssetId: uid,
        providerPlaybackId: uid,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
      },
    });
  } catch (err) {
    await ctx.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        processingState: VIDEO_ASSET_PROCESSING_STATE.FAILED,
        failureReason: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
