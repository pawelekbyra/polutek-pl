/**
 * Creator analytics (Studio): per-channel read models over data the site already collects
 * (VideoView, VideoPlaybackSession, Comment, VideoLike, Subscription, SubscriberSnapshot).
 * Nothing here identifies a viewer: only counts, sums and shares leave the module.
 */

/** Periods a creator may choose (days, UTC calendar days including today). */
export const ANALYTICS_RANGES = [7, 28, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const DEFAULT_RANGE: AnalyticsRange = 28;

/** Below this many counted views a share, an average or a curve is shown as "not enough data". */
export const MIN_SAMPLE_VIEWS = 10;

/** Retention is reported every 5 % of the video length: 0 %, 5 %, ... 100 % (21 points). */
export const RETENTION_STEP_PCT = 5;
export const RETENTION_POINTS = 100 / RETENTION_STEP_PCT + 1;

/** Upper bounds, so a request can never ask for an unbounded result. */
export const MAX_VIDEO_ROWS = 200;
export const MAX_EXPORT_ROWS = 5000;

export type SampleState = "ok" | "low_sample" | "no_data";

/** A (UTC day, value) row as returned by the repository; `day` is `YYYY-MM-DD`. */
export interface DayCount {
  day: string;
  value: number;
}

/** Counted playback sessions of one UTC day or one video, summed. */
export interface PlaybackSum {
  sessions: number;
  watchMs: number;
  /** Sessions with a known video length (the denominator of the average share). */
  pctSessions: number;
  /** Sum of min(1, watched / length) over those sessions. */
  pctSum: number;
}

export interface DayPlayback extends PlaybackSum {
  day: string;
}

export interface VideoPlayback extends PlaybackSum {
  videoId: string;
}

export interface ChannelFacts {
  id: string;
  name: string;
  handle: string | null;
  subscribersCount: number;
}

export interface VideoRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: Date | null;
}

export interface SnapshotRow {
  day: string;
  subscribers: number;
}

export interface RetentionBucket {
  /** Index of the 5 % step the furthest position fell into, 0..20 (20 = reached the end). */
  bucket: number;
  sessions: number;
}

export interface AudienceCounts {
  views: number;
  signedIn: number;
  subscribers: number;
}

/** Everything the UI needs to print "Data as of ...". */
export interface Freshness {
  generatedAt: string;
  /** UTC day of the newest subscriber snapshot, null when the cron has not written one yet. */
  subscribersSnapshotDay: string | null;
}

export interface OverviewTotals {
  views: number;
  watchSeconds: number;
  /** Average share of a video watched per counted view, 0..100; null unless `avgState` is "ok". */
  avgPctViewed: number | null;
  avgState: SampleState;
  comments: number;
}

export interface SubscriberFlow {
  current: number;
  /** Count at the end of the day before the period; null when no snapshot exists for it. */
  baseline: number | null;
  baselineDay: string | null;
  /** current - baseline. */
  net: number | null;
  /** Subscriptions created in the period that still exist. */
  gained: number;
  /** Subscribers from before the period who left: gained - net. Null when `net` is unknown. */
  lost: number | null;
}

export interface OverviewDay {
  day: string;
  views: number;
  watchSeconds: number;
  /** Channel subscribers at the end of that day; null = no snapshot (never invented). */
  subscribers: number | null;
}

export interface AnalyticsOverview {
  channelId: string;
  range: AnalyticsRange;
  from: string;
  to: string;
  freshness: Freshness;
  totals: OverviewTotals;
  subscribers: SubscriberFlow;
  daily: OverviewDay[];
  minSample: number;
}

export interface VideoStatsRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  views: number;
  watchSeconds: number;
  avgPctViewed: number | null;
  avgState: SampleState;
  comments: number;
  likes: number;
}

export interface AnalyticsVideoList {
  channelId: string;
  range: AnalyticsRange;
  from: string;
  to: string;
  freshness: Freshness;
  items: VideoStatsRow[];
  truncated: boolean;
  minSample: number;
}

export interface RetentionPoint {
  /** Position in the video, percent of its length. */
  atPct: number;
  /** Share (0..100) of counted views whose furthest position reached at least `atPct`. */
  reachedPct: number;
}

export interface VideoDetail {
  channelId: string;
  range: AnalyticsRange;
  from: string;
  to: string;
  freshness: Freshness;
  video: { id: string; title: string; slug: string; status: string; publishedAt: string | null };
  totals: VideoStatsRow;
  daily: { day: string; views: number; watchSeconds: number }[];
  retention: { state: SampleState; sessions: number; points: RetentionPoint[] | null };
  audience: { state: SampleState; views: number; guestViews: number | null; signedInViews: number | null; subscriberViews: number | null };
  minSample: number;
}
