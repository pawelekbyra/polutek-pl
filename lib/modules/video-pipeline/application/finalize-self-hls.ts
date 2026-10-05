import { readFile } from "node:fs/promises";
import { PrismaClient, VideoEncodeJob } from "@prisma/client";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { R2ThumbnailStorageClient } from "@/lib/modules/media";
import { VideoPlaybackRouteService, attemptPublishAfterAssetReady, syncPublicThumbnailById } from "@/lib/modules/video";
import { createScopedLogger } from "@/lib/logger";
import type { FinalizeInput, ProcessorPorts } from "./process-encode-job";

const logger = createScopedLogger("FinalizeSelfHls");

const DEFAULT_THUMBNAIL = "/logo.png";

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * The only place an encode job becomes visible to viewers. It runs after every HLS object is
 * verified in R2: it creates the SELF_HLS asset (READY), moves the active playback route to it
 * (the publication blockers read that route), fills in a poster thumbnail only when the video
 * has none, and finally asks for the pending auto-publish. Idempotent on the asset key.
 */
export function createSelfHlsFinalizer(prisma: PrismaClient): ProcessorPorts["finalizer"] {
  const ctx = createAppContext({ prisma, actor: { type: "system", reason: "video_encode_worker" } });

  return {
    async findExisting(job: VideoEncodeJob, assetKey: string) {
      const asset = await prisma.videoAsset.findFirst({
        where: { videoId: job.videoId, provider: "SELF_HLS", objectKey: assetKey, processingState: "READY" },
        select: { id: true, playbackRoutes: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } },
      });
      return asset && asset.playbackRoutes.length > 0 ? asset.id : null;
    },

    async finalize(input: FinalizeInput) {
      const { job, assetKey } = input;
      const created = await prisma.videoAsset.findFirst({
        where: { videoId: job.videoId, provider: "SELF_HLS", objectKey: assetKey },
        select: { id: true },
      });
      const assetId =
        created?.id ??
        (
          await prisma.videoAsset.create({
            data: {
              videoId: job.videoId,
              provider: "SELF_HLS",
              objectKey: assetKey,
              bucket: input.hlsBucket,
              mimeType: "application/x-mpegURL",
              processingState: "READY",
              processingEndedAt: new Date(),
              isPrimary: false,
              sizeBytes: Number.isFinite(input.totalBytes) && input.totalBytes >= 0 ? BigInt(Math.trunc(input.totalBytes)) : null,
            },
            select: { id: true },
          })
        ).id;

      try {
        await new VideoPlaybackRouteService().activateRoute(
          { videoId: job.videoId, assetId, activatedBy: "POLICY", reason: `own HLS encode job ${job.id}` },
          ctx,
        );
      } catch (error) {
        // Never leave a READY asset that no route can use; the retry creates it again.
        if (!created) await prisma.videoAsset.delete({ where: { id: assetId } }).catch(() => undefined);
        throw error;
      }

      await applyVideoDetails(prisma, input).catch((error: unknown) => logger.warn("poster/duration step failed (non-fatal)", { jobId: job.id, error: String(error) }));

      try {
        await attemptPublishAfterAssetReady(job.videoId, ctx, "SELF_HLS");
      } catch (error) {
        logger.warn("auto-publish after encode failed (non-fatal)", { jobId: job.id, error: String(error) });
      }
      return { assetId };
    },
  };

  async function applyVideoDetails(db: PrismaClient, input: FinalizeInput) {
    const video = await db.video.findUnique({ where: { id: input.job.videoId }, select: { id: true, status: true, thumbnailUrl: true, duration: true } });
    if (!video) return;
    const data: { duration?: string; thumbnailUrl?: string } = {};
    const durationSeconds = Number((input.meta.source as { durationSeconds?: number } | undefined)?.durationSeconds);
    if (!video.duration && Number.isFinite(durationSeconds) && durationSeconds > 0) data.duration = formatDuration(durationSeconds);

    const hasThumbnail = Boolean(video.thumbnailUrl) && video.thumbnailUrl !== DEFAULT_THUMBNAIL;
    if (!hasThumbnail && R2ThumbnailStorageClient.isConfigured()) {
      const bytes = new Uint8Array(await readFile(input.posterPath));
      const { storageUrl } = await new R2ThumbnailStorageClient().putPrivate({
        scope: `videos/${video.id}/covers`,
        bytes,
        contentType: "image/jpeg",
        extension: "jpg",
      });
      data.thumbnailUrl = storageUrl;
    }
    if (Object.keys(data).length === 0) return;
    await db.video.update({ where: { id: video.id }, data });
    if (data.thumbnailUrl && video.status === "PUBLISHED") await syncPublicThumbnailById(video.id, ctx);
  }
}
