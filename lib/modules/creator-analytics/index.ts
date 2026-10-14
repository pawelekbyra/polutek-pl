/**
 * Creator analytics for the Studio (CLAUDE.md 4.23): per-channel read models
 * (overview, video table, video detail with reach curve, CSV export) and the daily subscriber snapshot job.
 * Every query use case authorizes `channel.view_analytics` on the context channel; nothing here imports next/*.
 */
export * from "./domain/types";
export { buildPeriod, parseRange, utcDayKey } from "./domain/period";
export type { AnalyticsPeriod } from "./domain/period";
export { sampleState, averagePctViewed, subscriberFlow, buildReachCurve } from "./domain/aggregate";
export { getChannelAnalyticsOverview } from "./application/get-overview.use-case";
export { getChannelVideoAnalytics } from "./application/get-video-list.use-case";
export { getChannelVideoDetail } from "./application/get-video-detail.use-case";
export { exportChannelAnalyticsCsv } from "./application/export-csv.use-case";
export type { AnalyticsCsv, AnalyticsExportKind } from "./application/export-csv.use-case";
export { snapshotSubscriberCounts } from "./application/snapshot-subscribers.use-case";
export type { SnapshotSubscribersOutput } from "./application/snapshot-subscribers.use-case";
