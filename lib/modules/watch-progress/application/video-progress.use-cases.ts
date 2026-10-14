import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { checkVideoAccess } from "@/lib/modules/access";
import { publiclyVisibleChannelWhere } from "@/lib/modules/channel";
import { resolvePublicThumbnailSrc } from "@/lib/modules/media";
import {
  CONTINUE_WATCHING_LIMIT,
  pickContinueWatching,
  toContinueWatchingItem,
  type ContinueWatchingItem,
} from "../domain/continue-watching";
import { decideProgressWrite, isResumablePosition, parseDurationText } from "../domain/progress-rules";

export type SaveVideoProgressInput = {
  videoId: string;
  positionSeconds: number;
  /** Length reported by the player; the video's own stored length wins when it has one. */
  durationSeconds?: number | null;
};

export type SaveVideoProgressStatus = "saved" | "cleared" | "ignored";

function viewerId(ctx: AppContext): string | null {
  const { actor } = ctx;
  return actor.type === "user" || actor.type === "admin" ? actor.userId : null;
}

/**
 * Stores the signed-in viewer's position in a video (CLAUDE.md "Wznawianie oglądania"). Guests have no
 * server row (the player keeps their position in the browser). The write is allowed only where
 * `checkVideoAccess` lets the viewer watch, so a position can never confirm that a hidden video exists:
 * no access and not found look the same (404). Positions below 5 s are ignored; past 95 % the row is removed.
 */
export async function saveVideoProgress(
  input: SaveVideoProgressInput,
  ctx: AppContext,
): Promise<UseCaseResult<{ status: SaveVideoProgressStatus }, AppError>> {
  const userId = viewerId(ctx);
  if (!userId) return fail(new AppError("Unauthorized", 401, "UNAUTHORIZED"));

  const access = await checkVideoAccess({ videoIdOrSlug: input.videoId }, ctx);
  if (!access.ok || !access.data.hasAccess) {
    return fail(new AppError("Video not found", 404, "NOT_FOUND"));
  }
  // An upcoming premiere has nothing to resume (the playback plan refuses it as well).
  if (access.data.premiereAt) return fail(new AppError("Video not found", 404, "NOT_FOUND"));

  const videoId = access.data.videoId ?? input.videoId;
  const video = await ctx.prisma.video.findUnique({ where: { id: videoId }, select: { duration: true } });
  if (!video) return fail(new AppError("Video not found", 404, "NOT_FOUND"));

  const decision = decideProgressWrite({
    positionSeconds: input.positionSeconds,
    durationSeconds: parseDurationText(video.duration) ?? input.durationSeconds ?? null,
  });

  if (decision.action === "ignore") return ok({ status: "ignored" as const });

  if (decision.action === "clear") {
    await ctx.prisma.videoProgress.deleteMany({ where: { userId, videoId } });
    return ok({ status: "cleared" as const });
  }

  await ctx.prisma.videoProgress.upsert({
    where: { userId_videoId: { userId, videoId } },
    create: {
      userId,
      videoId,
      positionSeconds: decision.positionSeconds,
      durationSeconds: decision.durationSeconds,
    },
    update: {
      positionSeconds: decision.positionSeconds,
      durationSeconds: decision.durationSeconds,
    },
  });
  return ok({ status: "saved" as const });
}

/**
 * The signed-in viewer's own saved position in one video, or null when there is none worth resuming.
 * A read of the viewer's own row only: it needs no access check (it reveals nothing about the video).
 */
export async function getVideoProgressSeconds(
  userId: string,
  videoId: string,
  ctx: Pick<AppContext, "prisma">,
): Promise<number | null> {
  const row = await ctx.prisma.videoProgress.findUnique({
    where: { userId_videoId: { userId, videoId } },
    select: { positionSeconds: true, durationSeconds: true, video: { select: { duration: true } } },
  });
  if (!row) return null;
  const duration = parseDurationText(row.video?.duration) ?? row.durationSeconds;
  return isResumablePosition(row.positionSeconds, duration) ? row.positionSeconds : null;
}

/** How many of the newest rows are read before the visibility filter picks the shelf (headroom for hidden ones). */
const SHELF_CANDIDATE_ROWS = 30;

/**
 * The viewer's "Continue watching" shelf: up to 6 unfinished videos, newest first. Only videos the
 * viewer could open now (see `isContinueWatchingEligible`); a video opened by link (UNLISTED) is allowed
 * because the shelf is the viewer's own list, never a public one.
 */
export async function listContinueWatching(
  userId: string,
  ctx: Pick<AppContext, "prisma" | "now">,
  limit: number = CONTINUE_WATCHING_LIMIT,
): Promise<ContinueWatchingItem[]> {
  const now = ctx.now();
  const rows = await ctx.prisma.videoProgress.findMany({
    where: {
      userId,
      video: {
        status: { in: ["PUBLISHED", "UNLISTED"] },
        moderationStatus: { not: "REMOVED" },
        creator: publiclyVisibleChannelWhere(),
      },
    },
    orderBy: { updatedAt: "desc" },
    take: SHELF_CANDIDATE_ROWS,
    select: {
      positionSeconds: true,
      durationSeconds: true,
      updatedAt: true,
      video: {
        select: {
          id: true,
          slug: true,
          title: true,
          titleEn: true,
          status: true,
          tier: true,
          moderationStatus: true,
          publishedAt: true,
          premiereAt: true,
          duration: true,
          thumbnailUrl: true,
          thumbnailPublicUrl: true,
          creator: { select: { name: true, status: true, deletedAt: true } },
        },
      },
    },
  });

  const candidates = rows.map((row) => ({
    positionSeconds: row.positionSeconds,
    durationSeconds: row.durationSeconds,
    updatedAt: row.updatedAt,
    video: { ...row.video, tier: String(row.video.tier), moderationStatus: row.video.moderationStatus as string | null },
  }));

  return pickContinueWatching(candidates, now, limit).map((candidate) =>
    toContinueWatchingItem(
      candidate,
      resolvePublicThumbnailSrc(
        {
          id: candidate.video.id,
          status: candidate.video.status,
          thumbnailUrl: candidate.video.thumbnailUrl,
          thumbnailPublicUrl: candidate.video.thumbnailPublicUrl,
        },
        process.env,
      ),
    ),
  );
}
