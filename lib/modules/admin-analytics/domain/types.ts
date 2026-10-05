/** DTOs of the analytics screens: plain data, ready to render, no Date objects crossing into components. */
import type { QoeSummary, SampleLevel } from "./qoe";
import type { FunnelStep } from "./funnel";

export type Unavailable = { available: false; reason: string };

export type Annotation = { index: number; when: string; label: string; kind: "deploy" | "publish" };

export type TimeSeriesDto = {
  labels: string[];
  current: (number | null)[];
  /** Same length as `current`; null = comparison off. Buckets without measurement are null inside. */
  previous: (number | null)[] | null;
};

export type Freshness = {
  /** When the telemetry rollup last ran successfully (job_run), ISO; null = never recorded. */
  rollupAt: string | null;
  /** Warsaw day of the first telemetry row; null = no data at all. */
  firstDay: string | null;
  /** Whole days of data, for the "za mało danych" notes. */
  coverageDays: number;
};

export type KpiDto = {
  key: string;
  label: string;
  hint?: string;
  /** null = no measurement (rendered as "bez pomiaru", never 0). */
  value: number | null;
  previous: number | null;
  unit?: string;
  format: "int" | "pct" | "one";
  upIsGood: boolean;
};

export type RankedItem = { label: string; value: number; share: number; sub?: string };

export type TrafficOverview = {
  rangeLabel: string;
  compareLabel: string;
  granularity: "hour" | "day";
  freshness: Freshness;
  kpis: KpiDto[];
  visitors: TimeSeriesDto;
  pageviews: TimeSeriesDto;
  sources: RankedItem[];
  campaigns: RankedItem[];
  countries: RankedItem[];
  annotations: Annotation[];
  /** Plain-language notes about definitions and limits shown under the numbers. */
  notes: string[];
  edgeCheck: EdgeCheck;
};

export type EdgeCheck =
  | { available: false; reason: string }
  | { available: true; fetchedAt: string; ownPageviews: number; edgeRequests: number; deviationPct: number; withinTolerance: boolean; tolerancePct: number };

export type FunnelDto = {
  rangeLabel: string;
  steps: FunnelStep[];
  lossHint: string | null;
  tipsInPeriod: number;
  tipsPrevious: number | null;
  accounts: TimeSeriesDto;
  tips: TimeSeriesDto;
  sample: SampleLevel;
  attribution: { available: false; reason: string };
  notes: string[];
  freshness: Freshness;
};

export type VideoRow = {
  videoId: string;
  title: string;
  slug: string | null;
  starts: number;
  views: number;
  watchHours: number;
  avgWatchedPct: number | null;
  attempts: number;
  sample: SampleLevel;
};

export type RetentionDto = {
  videoId: string;
  title: string;
  starts: number;
  lowSample: boolean;
  percent: number[];
  avgWatchedPct: number;
  milestones: { at: number; pct: number }[];
  band: { lo: number[]; hi: number[]; videos: number } | null;
  biggestDrop: { at: number; drop: number } | null;
  durationSeconds: number | null;
};

export type WatchOverview = {
  rangeLabel: string;
  compareLabel: string;
  freshness: Freshness;
  kpis: KpiDto[];
  views: TimeSeriesDto;
  watchHours: TimeSeriesDto;
  videos: VideoRow[];
  /** Channel-wide mean share of a video that an attempt watched (weighted by starts); null = no data. */
  typicalAvgPct: number | null;
  retention: RetentionDto | null;
  annotations: Annotation[];
  notes: string[];
};

export type ErrorRow = { code: string; label: string; attempts: number; fatal: number; share: number };
export type LadderRow = { height: number; label: string; attempts: number; share: number };

export type QualityOverview = {
  rangeLabel: string;
  compareLabel: string;
  freshness: Freshness;
  summary: QoeSummary;
  previousSummary: QoeSummary | null;
  startupP50Ms: number | null;
  startupP95Ms: number | null;
  startupP95PreviousMs: number | null;
  startupN: number;
  startupP95Series: TimeSeriesDto;
  errorRateSeries: TimeSeriesDto;
  errors: ErrorRow[];
  ladder: LadderRow[];
  switchesPerAttempt: number | null;
  avgBitrateKbps: number | null;
  annotations: Annotation[];
  notes: string[];
};

export type EdgeSnapshot =
  | { available: false; reason: string }
  | {
      available: true;
      fetchedAt: string;
      day: string | null;
      workerRequests: number | null;
      workerLimit: number;
      workerHourly: { hour: string; requests: number }[];
      cacheHitPct: number | null;
      status403: number | null;
      status404: number | null;
      status5xx: number | null;
    };

export type VideoAnalytics = {
  videoId: string;
  title: string;
  rangeLabel: string;
  compareLabel: string;
  freshness: Freshness;
  kpis: KpiDto[];
  views: TimeSeriesDto;
  retention: RetentionDto | null;
  typicalAvgPct: number | null;
  annotations: Annotation[];
  notes: string[];
};

export type LiveSnapshot = {
  at: string;
  videoId: string | null;
  videoTitle: string | null;
  /** Distinct viewers who sent a playback beacon in the last 90 seconds; null = telemetry unavailable. */
  viewersNow: number | null;
  viewersPeak: number | null;
  startupP95Ms: number | null;
  startupN: number;
  errorsLastMinute: number | null;
  errorShare5mPct: number | null;
  pageviewsLastMinute: number | null;
  perMinute: { minute: string; viewers: number; starts: number; errors: number; pageviews: number }[];
  server: { cpuLoadPct: number | null; memUsedPct: number | null; swapUsedPct: number | null } | null;
  tips: { count: number; totalMinor: number; currency: string | null } | null;
  comments: { count: number } | null;
  workerForecast: { used: number; limit: number; reason: string } | null;
  notes: string[];
};
