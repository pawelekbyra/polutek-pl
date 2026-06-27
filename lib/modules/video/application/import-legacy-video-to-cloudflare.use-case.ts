import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { WriteTx } from "@/lib/modules/shared/db";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoRepository } from "../infrastructure/video.repository";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { VideoNotFoundError } from "../domain/video.errors";
import { withPrimaryAsset } from "../domain/video-asset-selection";

export interface ImportLegacyVideoToCloudflareInput {
  videoId: string;
  publishAfterAssetReady?: boolean;
}

type TransactionRunner = {
  $transaction: <T>(fn: (tx: WriteTx) => Promise<T>) => Promise<T>;
};

function hasTransactionRunner(db: unknown): db is TransactionRunner {
  if (typeof db !== "object" || db === null || !("$transaction" in db)) return false;
  return typeof (db as Record<string, unknown>).$transaction === "function";
}

export class LegacyVideoUrlRequiredError extends AppError {
  constructor() {
    super("Legacy video URL is required before importing to Cloudflare Stream.", 400, "LEGACY_VIDEO_URL_REQUIRED");
  }
}

export class CloudflareAssetAlreadyExistsError extends AppError {
  constructor() {
    super("Cloudflare Stream asset is already attached or import is already in progress for this video.", 409, "CLOUDFLARE_ASSET_ALREADY_EXISTS");
  }
}

export class CloudflareAssetInUseError extends AppError {
  constructor(uid: string) {
    super(`Cloudflare Stream asset with UID ${uid} is already used by another video.`, 409, "CLOUDFLARE_ASSET_IN_USE");
  }
}

export class CloudflareLegacyImportError extends AppError {
  constructor() {
    super("Cloudflare Stream could not start the legacy video import. Check provider configuration and legacy source availability.", 502, "CLOUDFLARE_LEGACY_IMPORT_FAILED");
  }
}

export async function importLegacyVideoToCloudflare(
  input: ImportLegacyVideoToCloudflareInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | LegacyVideoUrlRequiredError | CloudflareAssetAlreadyExistsError | CloudflareLegacyImportError | CloudflareAssetInUseError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const legacyVideoUrl = video.videoUrl?.trim();
  if (!legacyVideoUrl) return fail(new LegacyVideoUrlRequiredError());

  if (video.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM) {
    return fail(new CloudflareAssetAlreadyExistsError());
  }

  const client = new CloudflareStreamClient();

  let providerAssetId: string;
  try {
    const importResponse = await client.importVideoByUrl(legacyVideoUrl);
    providerAssetId = importResponse.result.uid;
  } catch (error) {
    return fail(new CloudflareLegacyImportError());
  }

  let updatedVideo: unknown;

  const runImportTransaction = async (tx: WriteTx) => {
    const loadedCurrent = await tx.video.findFirst({
      where: { id: input.videoId, creatorId: mainChannel.id },
      include: { assets: true, _count: { select: { comments: true } } }
    });
    const current = withPrimaryAsset(loadedCurrent);

    if (!current) throw new VideoNotFoundError(input.videoId);
    if (current.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM) {
      throw new CloudflareAssetAlreadyExistsError();
    }

    // Ensure UID is not already in use by another video
    const existingAssetWithUid = await repository.findAssetByProviderId(VIDEO_PROVIDER.CLOUDFLARE_STREAM, providerAssetId);
    if (existingAssetWithUid && existingAssetWithUid.videoId !== current.id) {
      throw new CloudflareAssetInUseError(providerAssetId);
    }

    // Handle publishAfterAssetReady intent
    const pendingPublishRequested = input.publishAfterAssetReady === true;
    if (pendingPublishRequested) {
      await tx.video.update({
        where: { id: current.id },
        data: {
          publishAfterAssetReady: true,
          publishAfterAssetReadyRequestedAt: current.publishAfterAssetReadyRequestedAt || new Date(),
          publishAfterAssetReadyCompletedAt: null,
          publishAfterAssetReadyError: null,
        },
      });

      if (!current.publishAfterAssetReady) {
        await recordAuditEvent(ctx, {
          action: "VIDEO_PUBLISH_AFTER_ASSET_READY_REQUESTED",
          targetType: "Video",
          targetId: current.id,
          metadata: { source: "import-legacy-video-to-cloudflare" },
        }, tx);
      }
    }

    await repository.upsertAsset(current.id, {
      provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
      objectKey: `cloudflare-stream/${providerAssetId}`,
      bucket: null,
      providerAssetId,
      providerPlaybackId: providerAssetId,
      processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
      isPrimary: false,
      failureReason: null,
      providerSyncedAt: new Date(),
      processingStartedAt: new Date(),
      processingEndedAt: null,
    }, tx);

    await recordAuditEvent(ctx, {
      action: "VIDEO_CLOUDFLARE_LEGACY_IMPORT_STARTED",
      targetType: "Video",
      targetId: current.id,
      metadata: {
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId,
        legacyUrlPreserved: true,
        importedAssetIsPrimary: false,
        publishAfterAssetReady: pendingPublishRequested
      }
    }, tx);

    return await tx.video.findFirst({
      where: { id: current.id, creatorId: mainChannel.id },
      include: { assets: true, _count: { select: { comments: true } } }
    });
  };

  try {
    if (ctx.db?.writeTransaction) {
      updatedVideo = await ctx.db.writeTransaction(runImportTransaction);
    } else if (hasTransactionRunner(ctx.prisma)) {
      updatedVideo = await ctx.prisma.$transaction(runImportTransaction);
    } else {
      updatedVideo = await runImportTransaction(ctx.prisma as WriteTx);
    }
  } catch (error) {
    if (error instanceof VideoNotFoundError || error instanceof CloudflareAssetAlreadyExistsError || error instanceof CloudflareAssetInUseError) {
      return fail(error);
    }
    throw error;
  }

  if (!updatedVideo) return fail(new VideoNotFoundError(input.videoId));

  return ok(toAdminVideoDto(updatedVideo));
}
