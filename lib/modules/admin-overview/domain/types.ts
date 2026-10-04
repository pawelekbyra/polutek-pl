/**
 * Read models of the admin panel's "Dzisiaj" and "System" screens (phase 1, read only).
 * Plain serialisable data: dates as ISO strings, money in minor units or rounded PLN, no secrets,
 * no tokens. Every externally measured value carries `measuredAt` + `source` (DESIGN-SYSTEM.md 1.2:
 * "panel nigdy nie jest ślepy"); a value we cannot read is an explicit `unavailable`, never a zero.
 */
import type { CompareKey, RangeKey } from "./time";

export type StateKind = "ok" | "warn" | "crit" | "info";

export type IconName =
  | "today" | "chart" | "film" | "users" | "coins" | "mail" | "server" | "shield" | "settings" | "live"
  | "search" | "ok" | "warn" | "crit" | "info" | "clock" | "flag" | "inbox" | "image" | "calendar"
  | "database" | "box" | "globe" | "zap" | "key" | "message" | "user-plus" | "deploy" | "note" | "refresh";

export type LinkDto = { label: string; href: string; external?: boolean };

export type KpiDto = {
  key: "tips" | "tipsCount" | "signups" | "comments" | "views" | "reports";
  label: string;
  value: number;
  previous: number | null;
  unit?: string;
  /** false when a rise is bad (reports). */
  upIsGood: boolean;
  spark: number[];
  hint?: string;
  format: "int" | "pln";
};

export type TriageItemDto = {
  id: string;
  kind: "warn" | "crit";
  icon: IconName;
  title: string;
  detail: string;
  link?: LinkDto;
};

export type ActivityItemDto = { id: string; at: string; icon: IconName; kind: StateKind | ""; title: string; detail: string };

export type EncodeJobDto = {
  id: string;
  videoTitle: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  stage: string;
  progress: number;
  attempt: number;
  maxAttempts: number;
  heartbeatAt: string | null;
  failure: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type UpcomingDto = { id: string; at: string | null; icon: IconName; kind: StateKind | ""; title: string; detail: string };

export type HealthCheckDto = {
  id: string;
  label: string;
  kind: StateKind;
  detail: string;
  /** ISO time of the measurement; null when nothing could be measured. */
  measuredAt: string | null;
  source: string;
  /** Expected refresh interval in minutes (staleness = older than twice this). */
  everyMin: number;
  link?: LinkDto;
};

export type HealthSummary = {
  kind: StateKind;
  word: string;
  headline: string;
  counts: { ok: number; warn: number; crit: number; info: number };
  checks: HealthCheckDto[];
  measuredAt: string;
};

export type Unavailable = { available: false; reason: string; source: string };

export type HostMetricsDto =
  | {
      available: true;
      measuredAt: string;
      source: string;
      cpuCount: number;
      load: [number, number, number];
      memTotalBytes: number;
      memAvailableBytes: number;
      swapTotalBytes: number;
      swapUsedBytes: number;
      diskTotalBytes: number;
      diskUsedBytes: number;
      uptimeSeconds: number;
    }
  | Unavailable;

export type ProcessMetricsDto = { rssBytes: number; heapUsedBytes: number; uptimeSeconds: number; nodeVersion: string; memoryLimitBytes: number | null };

export type ContainerDto = { name: string; state: string; health: string | null; memBytes: number | null; memLimitBytes: number | null; cpuPercent: number | null; restarts: number | null; image: string | null; startedAt: string | null };

export type JobDto = {
  name: string;
  kind: "timer" | "cron";
  schedule: string;
  purpose: string;
  lastRun: { at: string; ok: boolean; detail: string | null } | null;
  nextRun: string | null;
};

export type BackupDto = { latestAt: string | null; latestBytes: number | null; count: number; offsite: string };

export type QueueDto = { id: string; label: string; kind: StateKind; pending: number; detail: string; link?: LinkDto };

export type DomainFactDto = { name: string; kind: string; state: StateKind; note: string; source: string };
export type CostFactDto = { item: string; monthly: string; note: string };

export type LimitDto = {
  id: string;
  label: string;
  /** 0..100 for the meter; null when not measurable. */
  percent: number | null;
  valueText: string;
  warnAt: number;
  critAt: number;
  note: string;
  measuredAt: string | null;
  source: string;
};

export type TodayOverview = {
  generatedAt: string;
  range: RangeKey;
  compare: CompareKey;
  rangeLabel: string;
  compareLabel: string;
  kpis: KpiDto[];
  chart: { title: string; unit: string; labels: string[]; values: number[]; total: number };
  triage: TriageItemDto[];
  activity: ActivityItemDto[];
  encodeQueue: EncodeJobDto[];
  upcoming: UpcomingDto[];
  limits: LimitDto[];
  health: HealthSummary;
};

export type SystemOverview = {
  generatedAt: string;
  health: HealthSummary;
  host: HostMetricsDto;
  process: ProcessMetricsDto;
  containers: { available: true; measuredAt: string; items: ContainerDto[] } | Unavailable;
  jobs: { measuredAt: string | null; source: string; items: JobDto[] };
  backups: ({ available: true; measuredAt: string } & BackupDto) | Unavailable;
  queues: QueueDto[];
  database: { sizeBytes: number | null; connections: number | null; maxConnections: number | null; latencyMs: number | null; version: string | null };
  domains: DomainFactDto[];
  costs: CostFactDto[];
  factsAsOf: string;
};

export type NavCounts = { moderation: number; contentErrors: number; systemAlerts: number; systemKind: StateKind };
