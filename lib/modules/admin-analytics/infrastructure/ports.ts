/**
 * Read ports of the analytics module. The telemetry port is implemented over the read-only role
 * (pp_analytics_ro, schema `telemetry`), the app port over the site's database (Prisma, read only).
 * Everything is bounded by a time window or a limit; implementations never write.
 */
export type TrafficHourRow = { hour: Date; pageviews: number; visitors: number };
export type TrafficDayRow = { day: string; pageviews: number; visitors: number };
export type TrafficExtraRow = { day: string; visitors: number; singleViewVisitors: number };
export type DimensionRow = { value: string; pageviews: number; visitors: number };
/** First Warsaw day a country code appears in the traffic rollups (all retained history, 25 months). */
export type CountryFirstSeenRow = { code: string; firstDay: string };

/** Everything the playback screens need for one day (channel-wide or one video), summed over the selection. */
export type PlaybackDayRow = {
  day: string;
  attempts: number;
  started: number;
  exitsBeforeStart: number;
  errors: number;
  fatalErrors: number;
  watchMs: number;
  rebufferMs: number;
  rebufferCount: number;
  visitors: number;
  views: number;
  rebufferedAttempts: number;
  switches: number;
  bitrateSum: number;
  bitrateN: number;
  startupN: number;
  startupScoreSum: number;
  smoothnessSum: number;
  smoothnessN: number;
  startupHist: number[];
};

export type PlaybackHourRow = {
  hour: Date;
  attempts: number;
  started: number;
  views: number;
  exitsBeforeStart: number;
  errors: number;
  fatalErrors: number;
  watchMs: number;
  rebufferMs: number;
  visitors: number;
};

export type VideoTotalsRow = {
  videoId: string;
  attempts: number;
  started: number;
  views: number;
  watchMs: number;
  /** Sum over days of the sum of the 100 retention counts: mean watched share = retentionSum / (100 * started). */
  retentionSum: number;
};

export type RetentionDayRow = { day: string; started: number; retention: number[] };
export type RetentionCurveRow = { videoId: string; started: number; retention: number[] };
export type ErrorClassRow = { code: string; attempts: number; fatal: number };
export type LadderClassRow = { height: number; attempts: number };

export type DeployRow = { at: Date; job: string; detail: string | null };

export type SnapshotRow = { fetchedAt: Date; payload: unknown };

export type LiveMinuteRow = { minute: Date; viewers: number; starts: number; errors: number };

export type LiveNow = {
  viewers90s: number;
  startupP95Ms: number | null;
  startupN: number;
  attempts5m: number;
  errorAttempts5m: number;
  perMinute: LiveMinuteRow[];
  pageviewsPerMinute: { minute: Date; pageviews: number }[];
};

export interface TelemetryRepository {
  /** Warsaw day of the first row of r_traffic_daily, the time of the last successful rollup. */
  coverage(): Promise<{ firstDay: string | null; rollupAt: Date | null }>;
  trafficHourly(from: Date, to: Date): Promise<TrafficHourRow[]>;
  trafficDaily(fromDay: string, toDay: string): Promise<TrafficDayRow[]>;
  trafficExtra(fromDay: string, toDay: string): Promise<TrafficExtraRow[]>;
  /** Top values of a traffic dimension summed over the days (visitors = sum of daily uniques). */
  trafficDimension(dimension: "referrer" | "country" | "utm_source", fromDay: string, toDay: string, limit: number): Promise<DimensionRow[]>;
  /** Every country of the period (no top-N cut), visitors = sum of daily uniques; "??" = unknown. */
  countryTotals(fromDay: string, toDay: string): Promise<DimensionRow[]>;
  /** First day each country was seen, over all retained daily rollups. */
  countryFirstSeen(): Promise<CountryFirstSeenRow[]>;
  playbackDaily(fromDay: string, toDay: string, videoId?: string): Promise<PlaybackDayRow[]>;
  playbackHourly(from: Date, to: Date, videoId?: string): Promise<PlaybackHourRow[]>;
  videoTotals(fromDay: string, toDay: string, limit: number): Promise<VideoTotalsRow[]>;
  retentionDays(videoId: string, fromDay: string, toDay: string): Promise<RetentionDayRow[]>;
  retentionByVideo(fromDay: string, toDay: string, limit: number): Promise<RetentionCurveRow[]>;
  errorClasses(fromDay: string, toDay: string, videoId: string | undefined, limit: number): Promise<ErrorClassRow[]>;
  ladder(fromDay: string, toDay: string, videoId?: string): Promise<LadderClassRow[]>;
  deploys(from: Date, to: Date, limit: number): Promise<DeployRow[]>;
  latestSnapshot(source: string, kind: string): Promise<SnapshotRow | null>;
  /** Raw, short-window queries for the live premiere mode. */
  live(now: Date, videoId?: string): Promise<LiveNow>;
}

export type VideoInfo = { id: string; title: string; slug: string; durationSeconds: number | null };
export type PremiereInfo = { id: string; title: string; slug: string; premiereAt: Date };

export interface AppRepository {
  videosByIds(ids: string[]): Promise<VideoInfo[]>;
  videoBySlugOrId(key: string): Promise<VideoInfo | null>;
  accountsCreatedAt(from: Date, to: Date): Promise<Date[]>;
  paymentsCreatedAt(from: Date, to: Date): Promise<Date[]>;
  /** Accounts created in the window and how many of them ever commented / ever tipped. */
  accountCohort(from: Date, to: Date): Promise<{ accounts: number; commenters: number; tippers: number }>;
  publishedVideos(from: Date, to: Date, limit: number): Promise<{ at: Date; title: string }[]>;
  /** The premiere closest to `now` within +-24 h, or null. */
  activePremiere(now: Date): Promise<PremiereInfo | null>;
  tipsSince(since: Date): Promise<{ count: number; totalMinor: number; currency: string | null }>;
  commentsSince(since: Date): Promise<number>;
}
