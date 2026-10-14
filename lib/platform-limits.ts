/**
 * Default per-channel limits by trust level (CLAUDE.md 4.24). A `ChannelQuota` row overrides them per channel;
 * the owner's flagship channel keeps the historical global limits through its own row (stage 3 backfill).
 * Pure data and one pure function: enforcement lives in the upload use cases.
 */
const GIB = 1024 ** 3;

export interface ChannelLimits {
  maxStorageBytes: number;
  maxUploadBytes: number;
  maxVideoSeconds: number;
  maxUploadsPerDay: number;
  maxQueuedJobs: number;
}

/** Level 0 = a brand new channel; higher levels are granted by staff or by verification. */
export const TRUST_LEVEL_LIMITS: readonly ChannelLimits[] = [
  { maxStorageBytes: 20 * GIB, maxUploadBytes: 2 * GIB, maxVideoSeconds: 30 * 60, maxUploadsPerDay: 3, maxQueuedJobs: 2 },
  { maxStorageBytes: 100 * GIB, maxUploadBytes: 8 * GIB, maxVideoSeconds: 2 * 60 * 60, maxUploadsPerDay: 10, maxQueuedJobs: 5 },
  { maxStorageBytes: 500 * GIB, maxUploadBytes: 20 * GIB, maxVideoSeconds: 6 * 60 * 60, maxUploadsPerDay: 30, maxQueuedJobs: 10 },
];

export function defaultLimitsFor(trustLevel: number): ChannelLimits {
  const index = Math.min(Math.max(Math.trunc(trustLevel) || 0, 0), TRUST_LEVEL_LIMITS.length - 1);
  return TRUST_LEVEL_LIMITS[index];
}
