import { VideoStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import {
  R2ThumbnailStorageClient,
  buildPrivateThumbnailStorageUrl,
  getR2ThumbnailConfig,
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

/**
 * Deletes a public copy unless a video still references the same object:
 * another video advertising it (`thumbnailPublicUrl`), any video storing the
 * public URL itself in `thumbnailUrl` (bad data, but deleting would break its
 * image), or another PUBLISHED video whose private thumbnail has the same key.
 */
async function deletePublicCopyIfUnreferenced(
  ctx: AppContext,
  client: R2ThumbnailStorageClient,
  publicUrl: string,
  excludeVideoId: string | null,
): Promise<void> {
  const key = parsePublicThumbnailUrl(publicUrl, env());
  if (!key) return;

  const notExcluded = excludeVideoId ? { id: { not: excludeVideoId } } : {};
  const { accountId, privateBucket } = getR2ThumbnailConfig(env());
  const privateUrl = accountId && privateBucket ? buildPrivateThumbnailStorageUrl(accountId, privateBucket, key) : null;

  const stillReferenced = await ctx.prisma.video.count({
    where: {
      OR: [
        { thumbnailPublicUrl: publicUrl, ...notExcluded },
        { thumbnailUrl: publicUrl },
        ...(privateUrl ? [{ thumbnailUrl: privateUrl, status: VideoStatus.PUBLISHED, ...notExcluded }] : []),
      ],
    },
  });
  if (stillReferenced > 0) {
    logger.warn("Kept public thumbnail object that is still referenced", { key, excludeVideoId });
    return;
  }

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
    // A public-host URL stored in thumbnailUrl is corrupt data (a derived src saved
    // back, see isDerivedThumbnailUrl). Demoting would delete the very object it
    // points at, so leave everything alone until it is repaired.
    if (parsePublicThumbnailUrl(video.thumbnailUrl, env())) {
      logger.error("Video.thumbnailUrl holds a public thumbnail URL; skipping public sync", { videoId: video.id });
      return "skipped";
    }

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
  dryRun: boolean;
  scanned: number;
  promoted: number;
  demoted: number;
  /** Public objects deleted (or, in dry-run, that would be deleted). */
  orphansDeleted: number;
  /** Unadvertised public objects kept because a video still references their key. */
  orphansKeptReferenced: number;
  /** Videos whose thumbnailUrl is a public-host URL (corrupt; needs repair). */
  publicUrlInThumbnailUrl: number;
}

export interface ReconcilePublicThumbnailsOptions {
  /** Report what would change without writing to the DB or deleting objects. */
  dryRun?: boolean;
}

/**
 * Safety net for the per-use-case hooks: syncs every video, then deletes any
 * public-bucket object that no video advertises (e.g. a delete that failed
 * after the DB column was already cleared).
 *
 * An object is never deleted while a video still references its key: as
 * `thumbnailPublicUrl`, as a public URL stored in `thumbnailUrl`, or as the
 * private key of a PUBLISHED video's `thumbnailUrl` (its copy just isn't
 * recorded yet). A draft's private key does not protect a public object:
 * drafts must never have a public copy.
 */
export async function reconcilePublicThumbnails(
  ctx: AppContext,
  options: ReconcilePublicThumbnailsOptions = {},
): Promise<ReconcilePublicThumbnailsResult> {
  const dryRun = options.dryRun === true;
  const result: ReconcilePublicThumbnailsResult = {
    configured: false, dryRun, scanned: 0, promoted: 0, demoted: 0,
    orphansDeleted: 0, orphansKeptReferenced: 0, publicUrlInThumbnailUrl: 0,
  };
  if (!R2ThumbnailStorageClient.isPublicServingConfigured()) return result;
  result.configured = true;

  const videos: SyncableVideo[] = await ctx.prisma.video.findMany({
    select: { id: true, status: true, thumbnailUrl: true, thumbnailPublicUrl: true },
  });

  for (const video of videos) {
    result.scanned++;
    if (parsePublicThumbnailUrl(video.thumbnailUrl, env())) result.publicUrlInThumbnailUrl++;
    if (dryRun) continue;
    const action = await syncPublicThumbnail(video, ctx);
    if (action === "promoted") result.promoted++;
    if (action === "demoted") result.demoted++;
  }

  // Re-read after the sync above (it may have promoted/demoted rows).
  const rows: SyncableVideo[] = dryRun ? videos : await ctx.prisma.video.findMany({
    select: { id: true, status: true, thumbnailUrl: true, thumbnailPublicUrl: true },
  });
  const advertisedKeys = new Set<string>();
  const referencedKeys = new Set<string>();
  for (const row of rows) {
    const advertised = parsePublicThumbnailUrl(row.thumbnailPublicUrl, env());
    if (advertised) advertisedKeys.add(advertised);
    const storedPublic = parsePublicThumbnailUrl(row.thumbnailUrl, env());
    if (storedPublic) referencedKeys.add(storedPublic);
    if (row.status === VideoStatus.PUBLISHED) {
      const privateKey = parsePrivateThumbnailStorageUrl(row.thumbnailUrl, env());
      if (privateKey) referencedKeys.add(privateKey);
    }
  }

  // Objects younger than the grace period may belong to a promotion whose DB
  // write hasn't landed yet: leave them for the next run.
  const cutoff = Date.now() - ORPHAN_GRACE_PERIOD_MS;
  const client = new R2ThumbnailStorageClient();
  for (const { key, lastModified } of await client.listPublicObjects()) {
    if (advertisedKeys.has(key)) continue;
    // Subtitle files (videos/<id>/subtitles/*.vtt, admin panel) share the public bucket; their lifecycle is
    // managed by the subtitle upload/remove and video delete use cases, never by this thumbnail sweep.
    if (key.includes("/subtitles/")) continue;
    if (!lastModified || lastModified.getTime() > cutoff) continue;
    if (referencedKeys.has(key)) {
      result.orphansKeptReferenced++;
      logger.warn("Kept unadvertised public thumbnail still referenced by a video", { key });
      continue;
    }
    if (!dryRun) await client.deletePublic(key);
    result.orphansDeleted++;
  }

  if (result.publicUrlInThumbnailUrl > 0) {
    logger.error("Videos store a public thumbnail URL in thumbnailUrl; repair needed", { count: result.publicUrlInThumbnailUrl });
  }

  return result;
}
