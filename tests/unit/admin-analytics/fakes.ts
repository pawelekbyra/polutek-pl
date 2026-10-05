import type {
  AnalyticsDeps,
} from "@/lib/modules/admin-analytics";
import { emptyHist } from "@/lib/modules/admin-analytics";
import type {
  AppRepository, DeployRow, DimensionRow, ErrorClassRow, LadderClassRow, LiveNow, PlaybackDayRow, PlaybackHourRow, RetentionCurveRow, RetentionDayRow,
  SnapshotRow, TelemetryRepository, TrafficDayRow, TrafficExtraRow, TrafficHourRow, VideoInfo, VideoTotalsRow, PremiereInfo,
} from "@/lib/modules/admin-analytics/infrastructure/ports";

/** Monday 2026-10-05 12:00 in Warsaw (UTC+2). */
export const NOW = new Date("2026-10-05T10:00:00Z");

export const inDays = (from: string, to: string) => (d: string) => d >= from && d <= to;

export type TelemetryData = Partial<{
  firstDay: string | null;
  rollupAt: Date | null;
  trafficHourly: TrafficHourRow[];
  trafficDaily: TrafficDayRow[];
  trafficExtra: TrafficExtraRow[];
  dimensions: Record<string, DimensionRow[]>;
  playbackDaily: (PlaybackDayRow & { videoId?: string })[];
  playbackHourly: (PlaybackHourRow & { videoId?: string })[];
  videoTotals: VideoTotalsRow[];
  retentionDays: (RetentionDayRow & { videoId: string })[];
  retentionByVideo: RetentionCurveRow[];
  errors: ErrorClassRow[];
  ladder: LadderClassRow[];
  deploys: DeployRow[];
  snapshots: Record<string, SnapshotRow>;
  live: LiveNow;
}>;

export function playbackDay(day: string, p: Partial<PlaybackDayRow> = {}): PlaybackDayRow & { videoId?: string } {
  return {
    day, attempts: 0, started: 0, exitsBeforeStart: 0, errors: 0, fatalErrors: 0, watchMs: 0, rebufferMs: 0, rebufferCount: 0, visitors: 0, views: 0,
    rebufferedAttempts: 0, switches: 0, bitrateSum: 0, bitrateN: 0, startupN: 0, startupScoreSum: 0, smoothnessSum: 0, smoothnessN: 0, startupHist: emptyHist(), ...p,
  };
}

export function fakeTelemetry(d: TelemetryData = {}): TelemetryRepository & { calls: string[] } {
  const calls: string[] = [];
  const t = {
    calls,
    async coverage() {
      calls.push("coverage");
      return { firstDay: d.firstDay === undefined ? "2026-09-01" : d.firstDay, rollupAt: d.rollupAt === undefined ? new Date("2026-10-05T09:55:00Z") : d.rollupAt };
    },
    async trafficHourly(from: Date, to: Date) {
      calls.push("trafficHourly");
      return (d.trafficHourly ?? []).filter((r) => r.hour >= from && r.hour < to);
    },
    async trafficDaily(a: string, b: string) {
      calls.push("trafficDaily");
      return (d.trafficDaily ?? []).filter((r) => inDays(a, b)(r.day));
    },
    async trafficExtra(a: string, b: string) {
      return (d.trafficExtra ?? []).filter((r) => inDays(a, b)(r.day));
    },
    async trafficDimension(dim: string) {
      return d.dimensions?.[dim] ?? [];
    },
    async playbackDaily(a: string, b: string, videoId?: string) {
      calls.push(`playbackDaily:${videoId ?? "*"}`);
      return (d.playbackDaily ?? []).filter((r) => inDays(a, b)(r.day) && (!videoId || r.videoId === videoId));
    },
    async playbackHourly(from: Date, to: Date, videoId?: string) {
      return (d.playbackHourly ?? []).filter((r) => r.hour >= from && r.hour < to && (!videoId || r.videoId === videoId));
    },
    async videoTotals() {
      return d.videoTotals ?? [];
    },
    async retentionDays(videoId: string, a: string, b: string) {
      return (d.retentionDays ?? []).filter((r) => r.videoId === videoId && inDays(a, b)(r.day));
    },
    async retentionByVideo() {
      return d.retentionByVideo ?? [];
    },
    async errorClasses() {
      return d.errors ?? [];
    },
    async ladder() {
      return d.ladder ?? [];
    },
    async deploys(from: Date, to: Date) {
      return (d.deploys ?? []).filter((r) => r.at >= from && r.at <= to);
    },
    async latestSnapshot(source: string, kind: string) {
      return d.snapshots?.[`${source}:${kind}`] ?? null;
    },
    async live() {
      return d.live ?? { viewers90s: 0, startupP95Ms: null, startupN: 0, attempts5m: 0, errorAttempts5m: 0, perMinute: [], pageviewsPerMinute: [] };
    },
  };
  return t as unknown as TelemetryRepository & { calls: string[] };
}

export type AppData = Partial<{
  videos: VideoInfo[];
  accounts: Date[];
  payments: Date[];
  cohort: { accounts: number; commenters: number; tippers: number };
  published: { at: Date; title: string }[];
  premiere: PremiereInfo | null;
  tips: { count: number; totalMinor: number; currency: string | null };
  comments: number;
}>;

export function fakeApp(d: AppData = {}): AppRepository {
  const videos = d.videos ?? [];
  return {
    videosByIds: async (ids) => videos.filter((v) => ids.includes(v.id)),
    videoBySlugOrId: async (k) => videos.find((v) => v.slug === k || v.id === k) ?? null,
    accountsCreatedAt: async (a, b) => (d.accounts ?? []).filter((x) => x >= a && x <= b),
    paymentsCreatedAt: async (a, b) => (d.payments ?? []).filter((x) => x >= a && x <= b),
    accountCohort: async () => d.cohort ?? { accounts: 0, commenters: 0, tippers: 0 },
    publishedVideos: async (a, b) => (d.published ?? []).filter((x) => x.at >= a && x.at <= b),
    activePremiere: async () => d.premiere ?? null,
    tipsSince: async () => d.tips ?? { count: 0, totalMinor: 0, currency: null },
    commentsSince: async () => d.comments ?? 0,
  };
}

export function deps(t: TelemetryRepository | null, a: AppRepository = fakeApp(), over: Partial<AnalyticsDeps> = {}): AnalyticsDeps {
  return { telemetry: t, app: a, now: () => NOW, config: { edgeTolerancePct: 30, workerDailyLimit: 100_000 }, ...over };
}

export const VIDEO_A: VideoInfo = { id: "va", title: "Cześć", slug: "czesc", durationSeconds: 600 };
export const VIDEO_B: VideoInfo = { id: "vb", title: "Kulisy", slug: "kulisy", durationSeconds: 300 };
