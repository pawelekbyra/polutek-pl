import { Prisma } from "@prisma/client";
import type { ReadDb } from "@/lib/modules/shared/db";
import { dayKeyToDate, utcDayKey } from "../domain/period";
import type { AnalyticsRepository } from "../domain/ports";
import type {
  AudienceCounts,
  ChannelFacts,
  DayCount,
  DayPlayback,
  RetentionBucket,
  SnapshotRow,
  VideoPlayback,
  VideoRow,
} from "../domain/types";

/**
 * Prisma implementation. Every query is bounded by the channel (through `Video.creatorId`) and a time window, and
 * selects only counts and sums: no user id, IP hash or session id ever leaves this file.
 *
 * What counts as watching: sessions with `countedAsView = true` and `isAdminPreview = false`. Sessions that never
 * became a view are pruned after 30 days (prune-playback-sessions cron), so they are left out of every period to keep
 * 7, 28 and 90 days comparable.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** A Postgres `date` arrives as a Date at UTC midnight (or already as text in some drivers). */
const dayKey = (v: unknown): string => (v instanceof Date ? utcDayKey(v) : String(v).slice(0, 10));

const sessionVideo = (videoId?: string) => (videoId ? Prisma.sql`AND s."videoId" = ${videoId}` : Prisma.empty);
const viewVideo = (videoId?: string) => (videoId ? Prisma.sql`AND v."videoId" = ${videoId}` : Prisma.empty);

type PlaybackRow = { sessions: unknown; watch_ms: unknown; pct_n: unknown; pct_sum: unknown };

const playbackSums = (r: PlaybackRow) => ({
  sessions: num(r.sessions),
  watchMs: num(r.watch_ms),
  pctSessions: num(r.pct_n),
  pctSum: num(r.pct_sum),
});

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly db: ReadDb) {}

  async channelFacts(channelId: string): Promise<ChannelFacts | null> {
    const row = await this.db.creator.findUnique({
      where: { id: channelId },
      select: { id: true, name: true, handle: true, subscribersCount: true, deletedAt: true },
    });
    if (!row || row.deletedAt) return null;
    return { id: row.id, name: row.name, handle: row.handle, subscribersCount: row.subscribersCount ?? 0 };
  }

  async viewsByDay(channelId: string, from: Date, to: Date, videoId?: string): Promise<DayCount[]> {
    const rows = await this.db.$queryRaw<{ day: unknown; n: unknown }[]>(Prisma.sql`
      SELECT CAST(v."createdAt" AS date) AS day, COUNT(*) AS n
      FROM "VideoView" v JOIN "Video" vi ON vi."id" = v."videoId"
      WHERE vi."creatorId" = ${channelId} AND v."createdAt" >= ${from} AND v."createdAt" <= ${to} ${viewVideo(videoId)}
      GROUP BY 1 ORDER BY 1`);
    return rows.map((r) => ({ day: dayKey(r.day), value: num(r.n) }));
  }

  async playbackByDay(channelId: string, from: Date, to: Date, videoId?: string): Promise<DayPlayback[]> {
    const rows = await this.db.$queryRaw<(PlaybackRow & { day: unknown })[]>(Prisma.sql`
      SELECT CAST(s."startedAt" AS date) AS day,
             COUNT(*) AS sessions,
             COALESCE(SUM(s."totalWatchMs"), 0) AS watch_ms,
             COUNT(*) FILTER (WHERE s."durationMs" > 0) AS pct_n,
             COALESCE(SUM(LEAST(1.0, s."totalWatchMs"::float8 / NULLIF(s."durationMs", 0))) FILTER (WHERE s."durationMs" > 0), 0) AS pct_sum
      FROM "VideoPlaybackSession" s JOIN "Video" vi ON vi."id" = s."videoId"
      WHERE vi."creatorId" = ${channelId} AND s."countedAsView" = true AND s."isAdminPreview" = false
        AND s."startedAt" >= ${from} AND s."startedAt" <= ${to} ${sessionVideo(videoId)}
      GROUP BY 1 ORDER BY 1`);
    return rows.map((r) => ({ day: dayKey(r.day), ...playbackSums(r) }));
  }

  async viewsByVideo(channelId: string, from: Date, to: Date) {
    const rows = await this.db.videoView.groupBy({
      by: ["videoId"],
      where: { createdAt: { gte: from, lte: to }, video: { creatorId: channelId } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ videoId: r.videoId, value: r._count._all }));
  }

  async playbackByVideo(channelId: string, from: Date, to: Date): Promise<VideoPlayback[]> {
    const rows = await this.db.$queryRaw<(PlaybackRow & { video_id: string })[]>(Prisma.sql`
      SELECT s."videoId" AS video_id,
             COUNT(*) AS sessions,
             COALESCE(SUM(s."totalWatchMs"), 0) AS watch_ms,
             COUNT(*) FILTER (WHERE s."durationMs" > 0) AS pct_n,
             COALESCE(SUM(LEAST(1.0, s."totalWatchMs"::float8 / NULLIF(s."durationMs", 0))) FILTER (WHERE s."durationMs" > 0), 0) AS pct_sum
      FROM "VideoPlaybackSession" s JOIN "Video" vi ON vi."id" = s."videoId"
      WHERE vi."creatorId" = ${channelId} AND s."countedAsView" = true AND s."isAdminPreview" = false
        AND s."startedAt" >= ${from} AND s."startedAt" <= ${to}
      GROUP BY 1`);
    return rows.map((r) => ({ videoId: r.video_id, ...playbackSums(r) }));
  }

  async commentsByVideo(channelId: string, from: Date, to: Date) {
    const rows = await this.db.comment.groupBy({
      by: ["videoId"],
      where: { createdAt: { gte: from, lte: to }, status: "VISIBLE", video: { creatorId: channelId } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ videoId: r.videoId, value: r._count._all }));
  }

  async likesByVideo(channelId: string, from: Date, to: Date) {
    const rows = await this.db.videoLike.groupBy({
      by: ["videoId"],
      where: { createdAt: { gte: from, lte: to }, video: { creatorId: channelId } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ videoId: r.videoId, value: r._count._all }));
  }

  commentCount(channelId: string, from: Date, to: Date): Promise<number> {
    return this.db.comment.count({
      where: { createdAt: { gte: from, lte: to }, status: "VISIBLE", video: { creatorId: channelId } },
    });
  }

  newSubscriptions(channelId: string, from: Date, to: Date): Promise<number> {
    return this.db.subscription.count({ where: { creatorId: channelId, createdAt: { gte: from, lte: to } } });
  }

  async snapshots(channelId: string, fromDay: string, toDay: string): Promise<SnapshotRow[]> {
    const rows = await this.db.subscriberSnapshot.findMany({
      where: { channelId, day: { gte: dayKeyToDate(fromDay), lte: dayKeyToDate(toDay) } },
      orderBy: { day: "asc" },
      select: { day: true, subscribers: true },
      take: 400,
    });
    return rows.map((r) => ({ day: utcDayKey(r.day), subscribers: r.subscribers }));
  }

  async latestSnapshotDay(channelId: string): Promise<string | null> {
    const row = await this.db.subscriberSnapshot.findFirst({
      where: { channelId },
      orderBy: { day: "desc" },
      select: { day: true },
    });
    return row ? utcDayKey(row.day) : null;
  }

  channelVideos(channelId: string, limit: number): Promise<VideoRow[]> {
    return this.db.video.findMany({
      where: { creatorId: channelId, status: { not: "DRAFT" } },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: { id: true, title: true, slug: true, status: true, publishedAt: true },
      take: limit,
    });
  }

  video(channelId: string, videoId: string): Promise<VideoRow | null> {
    return this.db.video.findFirst({
      where: { id: videoId, creatorId: channelId },
      select: { id: true, title: true, slug: true, status: true, publishedAt: true },
    });
  }

  async retentionBuckets(channelId: string, videoId: string, from: Date, to: Date): Promise<RetentionBucket[]> {
    const rows = await this.db.$queryRaw<{ bucket: unknown; n: unknown }[]>(Prisma.sql`
      SELECT FLOOR(LEAST(1.0, s."maxProgressMs"::float8 / s."durationMs") * 20)::int AS bucket, COUNT(*) AS n
      FROM "VideoPlaybackSession" s JOIN "Video" vi ON vi."id" = s."videoId"
      WHERE vi."creatorId" = ${channelId} AND s."videoId" = ${videoId}
        AND s."countedAsView" = true AND s."isAdminPreview" = false AND s."durationMs" > 0
        AND s."startedAt" >= ${from} AND s."startedAt" <= ${to}
      GROUP BY 1`);
    return rows.map((r) => ({ bucket: num(r.bucket), sessions: num(r.n) }));
  }

  async audience(channelId: string, videoId: string, from: Date, to: Date): Promise<AudienceCounts> {
    const rows = await this.db.$queryRaw<{ views: unknown; signed_in: unknown; subscribers: unknown }[]>(Prisma.sql`
      SELECT COUNT(*) AS views,
             COUNT(*) FILTER (WHERE v."userId" IS NOT NULL) AS signed_in,
             COUNT(*) FILTER (WHERE v."userId" IS NOT NULL AND EXISTS (
               SELECT 1 FROM "Subscription" sub WHERE sub."userId" = v."userId" AND sub."creatorId" = ${channelId}
             )) AS subscribers
      FROM "VideoView" v JOIN "Video" vi ON vi."id" = v."videoId"
      WHERE vi."creatorId" = ${channelId} AND v."videoId" = ${videoId}
        AND v."createdAt" >= ${from} AND v."createdAt" <= ${to}`);
    const r = rows[0];
    return { views: num(r?.views), signedIn: num(r?.signed_in), subscribers: num(r?.subscribers) };
  }
}
