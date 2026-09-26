import { VideoStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import {
  R2ThumbnailStorageClient,
  parsePrivateThumbnailStorageUrl,
  parsePublicThumbnailUrl,
} from "@/lib/modules/media";
import { createScopedLogger } from "@/lib/logger";

const logger = createScopedLogger("SyncPublicThumbnail");

const ORPHAN_GRACE_PERIOD_MS = 60 * 60 * 1000;

export type PublicThumbnailSyncAction = "promoted" | "demoted" | "unchanged" | "skipped";

type SyncableVideo = {
  id: string;
  status: VideoStatus | string;
  thumbnailUrl: string | null;
  thumbnailPublicUrl: string | null;
};

function env() {
  return process.env as Record<string, string | undefined>;
}

/** Deletes a public copy unless another video still advertises the same object. */
async function deletePublicCopyIfUnreferenced(
  ctx: AppContext,
  client: R2ThumbnailStorageClient,
  publicUrl: string,
  excludeVideoId: string | null,
): Promise<void> {
  const key = parsePublicThumbnailUrl(publicUrl, env());
  if (!key) return;

  const stillReferenced = await ctx.prisma.video.count({
    where: {
      thumbnailPublicUrl: publicUrl,
      ...(excludeVideoId ? { id: { not: excludeVideoId } } : {}),
    },
  });
  if (stillReferenced > 0) return;

  await client.deletePublic(key);
}

/**
 * Makes the public R2 bucket match one video's state:
 * - PUBLISHED + thumbnail in the private R2 bucket → copy it to the public bucket
 *   and record `thumbnailPublicUrl`.
 * - anything else → clear `thumbnailPublicUrl` first (DTOs stop advertising it),
 *   then delete the public object.
 *
 * Never throws: a failed sync only means the video keeps going through the
 * `/api/videos/[id]/thumbnail` proxy until the daily reconcile cron retries.
 */
export async function syncPublicThumbnail(
  video: SyncableVideo,
  ctx: AppContext,
): Promise<PublicThumbnailSyncAction> {
  const current = video.thumbnailPublicUrl;

  try {
    const privateKey = parsePrivateThumbnailStorageUrl(video.thumbnailUrl, env());
    const shouldBePublic = video.status === VideoStatus.PUBLISHED && Boolean(privateKey);

    if (!shouldBePublic) {
      if (!current) return "unchanged";
      await ctx.prisma.video.update({ where: { id: video.id }, data: { thumbnailPublicUrl: null } });
      if (R2ThumbnailStorageClient.isPublicServingConfigured()) {
        await deletePublicCopyIfUnreferenced(ctx, new R2ThumbnailStorageClient(), current, video.id);
      }
      return "demoted";
    }

    if (!R2ThumbnailStorageClient.isPublicServingConfigured()) return "skipped";
    if (current && parsePublicThumbnailUrl(current, env()) === privateKey) return "unchanged";

    const client = new R2ThumbnailStorageClient();
    const publicUrl = await client.copyToPublic(privateKey!);
    await ctx.prisma.video.update({ where: { id: video.id }, data: { thumbnailPublicUrl: publicUrl } });

    if (current && current !== publicUrl) {
      await deletePublicCopyIfUnreferenced(ctx, client, current, video.id);
    }
    return "promoted";
  } catch (error) {
    logger.error("Public thumbnail sync failed", { videoId: video.id, error });
    return "skipped";
  }
}

/** Loads the video and syncs it; a missing row is a no-op. */
export async function syncPublicThumbnailById(videoId: string, ctx: AppContext): Promise<PublicThumbnailSyncAction> {
  const video = await ctx.prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, thumbnailUrl: true, thumbnailPublicUrl: true },
  }).catch((error: unknown) => {
    logger.error("Public thumbnail sync lookup failed", { videoId, error });
    return null;
  });
  if (!video) return "skipped";
  return syncPublicThumbnail(video, ctx);
}

/** For a video row that was just deleted: remove its public copy, if any. */
export async function removePublicThumbnailCopy(publicUrl: string | null | undefined, ctx: AppContext): Promise<void> {
  if (!publicUrl || !R2ThumbnailStorageClient.isPublicServingConfigured()) return;
  try {
    await deletePublicCopyIfUnreferenced(ctx, new R2ThumbnailStorageClient(), publicUrl, null);
  } catch (error) {
    logger.error("Public thumbnail removal failed", { publicUrl, error });
  }
}

export interface ReconcilePublicThumbnailsResult {
  configured: boolean;
  scanned: number;
  promoted: number;
  demoted: number;
  orphansDeleted: number;
}

/**
 * Safety net for the per-use-case hooks: syncs every video, then deletes any
 * public-bucket object that no video advertises (e.g. a delete that failed
 * after the DB column was already cleared).
 */
export async function reconcilePublicThumbnails(ctx: AppContext): Promise<ReconcilePublicThumbnailsResult> {
  const result: ReconcilePublicThumbnailsResult = { configured: false, scanned: 0, promoted: 0, demoted: 0, orphansDeleted: 0 };
  if (!R2ThumbnailStorageClient.isPublicServingConfigured()) return result;
  result.configured = true;

  const videos: SyncableVideo[] = await ctx.prisma.video.findMany({
    select: { id: true, status: true, thumbnailUrl: true, thumbnailPublicUrl: true },
  });

  for (const video of videos) {
    result.scanned++;
    const action = await syncPublicThumbnail(video, ctx);
    if (action === "promoted") result.promoted++;
    if (action === "demoted") result.demoted++;
  }

  const advertised = await ctx.prisma.video.findMany({
    where: { thumbnailPublicUrl: { not: null } },
    select: { thumbnailPublicUrl: true },
  });
  const advertisedKeys = new Set(
    advertised
      .map((row: { thumbnailPublicUrl: string | null }) => parsePublicThumbnailUrl(row.thumbnailPublicUrl, env()))
      .filter((key: string | null): key is string => Boolean(key)),
  );

  // Objects younger than the grace period may belong to a promotion whose DB
  // write hasn't landed yet — leave them for the next run.
  const cutoff = Date.now() - ORPHAN_GRACE_PERIOD_MS;
  const client = new R2ThumbnailStorageClient();
  for (const { key, lastModified } of await client.listPublicObjects()) {
    if (advertisedKeys.has(key)) continue;
    if (!lastModified || lastModified.getTime() > cutoff) continue;
    await client.deletePublic(key);
    result.orphansDeleted++;
  }

  return result;
}
