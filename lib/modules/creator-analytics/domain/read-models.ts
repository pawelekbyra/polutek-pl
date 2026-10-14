import type { AnalyticsPeriod } from "./period";
import { utcDayKey } from "./period";
import {
  addPlayback,
  audienceSplit,
  averagePctViewed,
  buildReachCurve,
  emptyPlayback,
  fillDays,
  msToSeconds,
  subscriberFlow,
  subscriberSeries,
} from "./aggregate";
import type { AnalyticsRepository } from "./ports";
import {
  MAX_VIDEO_ROWS,
  MIN_SAMPLE_VIEWS,
  type AnalyticsOverview,
  type AnalyticsVideoList,
  type Freshness,
  type PlaybackSum,
  type VideoDetail,
  type VideoStatsRow,
  type VideoRow,
} from "./types";

/** Read models: pure orchestration of repository calls and aggregation, no framework, no authorization. */

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

async function freshness(repo: AnalyticsRepository, channelId: string, now: Date): Promise<Freshness> {
  return { generatedAt: now.toISOString(), subscribersSnapshotDay: await repo.latestSnapshotDay(channelId) };
}

function windowOf(period: AnalyticsPeriod) {
  return { from: period.from.toISOString(), to: period.to.toISOString() };
}

export async function loadOverview(repo: AnalyticsRepository, channelId: string, period: AnalyticsPeriod): Promise<AnalyticsOverview | null> {
  const channel = await repo.channelFacts(channelId);
  if (!channel) return null;
  const { from, to, days } = period;
  const today = utcDayKey(to);
  const [views, playback, comments, gained, snaps, fresh] = await Promise.all([
    repo.viewsByDay(channelId, from, to),
    repo.playbackByDay(channelId, from, to),
    repo.commentCount(channelId, from, to),
    repo.newSubscriptions(channelId, from, to),
    repo.snapshots(channelId, period.baselineDay, today),
    freshness(repo, channelId, to),
  ]);

  const viewsPerDay = fillDays(days, views);
  const watchPerDay = fillDays(days, playback.map((p) => ({ day: p.day, value: p.watchMs })));
  const playbackTotal = playback.reduce<PlaybackSum>((acc, p) => addPlayback(acc, p), emptyPlayback());
  const avg = averagePctViewed(playbackTotal);
  const baseline = snaps.find((s) => s.day === period.baselineDay) ?? null;
  const subscribersPerDay = subscriberSeries(days, snaps, today, channel.subscribersCount);

  return {
    channelId,
    range: period.range,
    ...windowOf(period),
    freshness: fresh,
    totals: {
      views: sum(viewsPerDay),
      watchSeconds: msToSeconds(sum(watchPerDay)),
      avgPctViewed: avg.value,
      avgState: avg.state,
      comments,
    },
    subscribers: subscriberFlow({ current: channel.subscribersCount, baseline, gained }),
    daily: days.map((day, i) => ({
      day,
      views: viewsPerDay[i],
      watchSeconds: msToSeconds(watchPerDay[i]),
      subscribers: subscribersPerDay[i],
    })),
    minSample: MIN_SAMPLE_VIEWS,
  };
}

function toStatsRow(
  v: VideoRow,
  views: number,
  playback: PlaybackSum | undefined,
  comments: number,
  likes: number,
): VideoStatsRow {
  const p = playback ?? emptyPlayback();
  const avg = averagePctViewed(p);
  return {
    id: v.id,
    title: v.title,
    slug: v.slug,
    status: v.status,
    publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
    views,
    watchSeconds: msToSeconds(p.watchMs),
    avgPctViewed: avg.value,
    avgState: avg.state,
    comments,
    likes,
  };
}

export async function loadVideoList(
  repo: AnalyticsRepository,
  channelId: string,
  period: AnalyticsPeriod,
  limit: number = MAX_VIDEO_ROWS,
): Promise<AnalyticsVideoList> {
  const { from, to } = period;
  // One extra row tells us whether the list was cut.
  const [videos, views, playback, comments, likes, fresh] = await Promise.all([
    repo.channelVideos(channelId, limit + 1),
    repo.viewsByVideo(channelId, from, to),
    repo.playbackByVideo(channelId, from, to),
    repo.commentsByVideo(channelId, from, to),
    repo.likesByVideo(channelId, from, to),
    freshness(repo, channelId, to),
  ]);
  const viewMap = new Map(views.map((r) => [r.videoId, r.value]));
  const playbackMap = new Map(playback.map((r) => [r.videoId, r]));
  const commentMap = new Map(comments.map((r) => [r.videoId, r.value]));
  const likeMap = new Map(likes.map((r) => [r.videoId, r.value]));
  const truncated = videos.length > limit;
  const items = videos
    .slice(0, limit)
    .map((v) => toStatsRow(v, viewMap.get(v.id) ?? 0, playbackMap.get(v.id), commentMap.get(v.id) ?? 0, likeMap.get(v.id) ?? 0));
  return { channelId, range: period.range, ...windowOf(period), freshness: fresh, items, truncated, minSample: MIN_SAMPLE_VIEWS };
}

export async function loadVideoDetail(
  repo: AnalyticsRepository,
  channelId: string,
  videoId: string,
  period: AnalyticsPeriod,
): Promise<VideoDetail | null> {
  const video = await repo.video(channelId, videoId);
  if (!video) return null;
  const { from, to, days } = period;
  const [views, playback, buckets, audience, comments, likes, fresh] = await Promise.all([
    repo.viewsByDay(channelId, from, to, videoId),
    repo.playbackByDay(channelId, from, to, videoId),
    repo.retentionBuckets(channelId, videoId, from, to),
    repo.audience(channelId, videoId, from, to),
    repo.commentsByVideo(channelId, from, to),
    repo.likesByVideo(channelId, from, to),
    freshness(repo, channelId, to),
  ]);
  const viewsPerDay = fillDays(days, views);
  const watchPerDay = fillDays(days, playback.map((p) => ({ day: p.day, value: p.watchMs })));
  const playbackTotal = playback.reduce<PlaybackSum>((acc, p) => addPlayback(acc, p), emptyPlayback());
  const totals = toStatsRow(
    video,
    sum(viewsPerDay),
    playbackTotal,
    comments.find((c) => c.videoId === videoId)?.value ?? 0,
    likes.find((l) => l.videoId === videoId)?.value ?? 0,
  );
  const reach = buildReachCurve(buckets);
  return {
    channelId,
    range: period.range,
    ...windowOf(period),
    freshness: fresh,
    video: { id: video.id, title: video.title, slug: video.slug, status: video.status, publishedAt: totals.publishedAt },
    totals,
    daily: days.map((day, i) => ({ day, views: viewsPerDay[i], watchSeconds: msToSeconds(watchPerDay[i]) })),
    retention: reach,
    audience: audienceSplit(audience),
    minSample: MIN_SAMPLE_VIEWS,
  };
}
