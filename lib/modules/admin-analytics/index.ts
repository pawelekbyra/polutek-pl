/**
 * Read models of the admin panel analytics (apps/admin, phase A): traffic, funnel, watching, playback quality,
 * per-film analytics, live premiere snapshot, morning report. Read only over telemetry (pp_analytics_ro) and the
 * site's database. docs/architecture/admin-phaseA.md.
 */
export * from "./domain/types";
export * from "./domain/histogram";
export * from "./domain/qoe";
export * from "./domain/retention";
export * from "./domain/funnel";
export * from "./domain/world";
export { previousBuckets, seriesOf, totalOf, coveredTotal, bucketRowKey, hourRowKey } from "./domain/series";
export { createAnalyticsDeps, TELEMETRY_OFF_REASON, type AnalyticsDeps, type HostLoad } from "./application/deps";
export { getTrafficOverview, countryLabel, sourceLabel } from "./application/traffic";
export { getFunnel } from "./application/funnel";
export { getWorldOverview, HOME_COUNTRY } from "./application/world";
export { getWatchOverview } from "./application/watch";
export { getQualityOverview } from "./application/quality";
export { getVideoAnalytics, getVideoInfo } from "./application/video";
export { getEdgeSnapshot, workerLimitForecast, isSnapshotStale } from "./application/edge";
export { getLiveSnapshot, resolveLiveTarget, fillMinutes, LIVE_WINDOW_MINUTES, type LiveTarget } from "./application/live";
export { createLiveHub, type LiveHub } from "./application/live-hub";
export { buildMorningReport, runMorningReport, morningReportConfig, type MorningMailer, type MorningReport, type MorningReportResult } from "./application/morning-report";
export { makePeriod, dailyRange, type Period } from "./application/period";
export type { Availability } from "./application/common";
export { parseDurationText } from "./infrastructure/app.repository";
export { createSwrCache, type SwrCache } from "./infrastructure/swr-cache";
export type { AppRepository, TelemetryRepository, VideoInfo, PremiereInfo, LiveNow, CountryFirstSeenRow } from "./infrastructure/ports";
