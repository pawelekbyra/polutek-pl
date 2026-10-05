/**
 * Read models of the admin panel (apps/admin), phase 1: "Dzisiaj" and "System". Read only.
 * docs/architecture/admin-panel.md.
 */
export * from "./domain/types";
export * from "./domain/time";
export * from "./domain/format";
export { STATE_WORD, REVENUE_STATUSES, minorToPln, netMinor, isStale, summarizeHealth, levelFor, LIMITS } from "./domain/rules";
export { FACTS_AS_OF, SCHEDULED_JOBS, DOMAIN_FACTS, COST_FACTS } from "./domain/facts";
export { createOverviewDeps, type OverviewDeps } from "./application/deps";
export { getTodayOverview, buildTriage, buildActivity, hostLimits } from "./application/get-today-overview";
export { getSystemOverview, getShellStatus, unresolvedFailedVideos, buildJobs, buildQueues } from "./application/get-system-overview";
export { buildHealthChecks, encoderCheck } from "./application/collect-health";
export { searchAdminObjects, type SearchHit } from "./application/search-objects";
export { parseMeminfo } from "./infrastructure/host-metrics";
export { parseHostStatus, hostStatusSchema, type HostStatus, type HostStatusRead } from "./infrastructure/host-status-file";
export { cachedProbe, clearProbeCache, probeHlsWorker, probePublicApp, probeRedis, type ProbeResult } from "./infrastructure/probes";
export type { OverviewRepository, EncodeJobRow, RevenueRow, ActivityRows } from "./infrastructure/overview.repository";
export { SERVER_CAPACITY, type ServerCapacity } from "./domain/server-capacity.config";
export { computeServerHeadroom, usageKind, dailyViewsAt, recommendationFor, HEADROOM_WARN_AT, HEADROOM_CRIT_AT, type ServerHeadroom, type TelemetryPeaks, type PeakWindow } from "./domain/server-headroom";
export { getServerHeadroom } from "./application/get-server-headroom";
export { type TelemetryPeaksRead, clearTelemetryPeaksCache } from "./infrastructure/telemetry-peaks";
export { getAlertThresholds, saveAlertThresholds, resetAlertThresholds, ThresholdValidationError, type StoredThresholds } from "./application/alert-thresholds";
export { THRESHOLD_FIELDS, DEFAULT_LIMIT_THRESHOLDS, ALERT_THRESHOLDS_SETTING_KEY, validateThresholds, parseStoredThresholds, type LimitThresholds, type Threshold, type ThresholdKey } from "./domain/alert-thresholds";
export { getIntegrationStatus, buildIntegrationChecks, stripeKeyFacts, type IntegrationCheck, type IntegrationLast } from "./application/integrations";
