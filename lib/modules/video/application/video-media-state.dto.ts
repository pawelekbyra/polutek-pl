export type AdminVideoAssetDto = {
  id: string;
  provider: string;
  processingState: string;
  isPrimary: boolean;
  providerAssetId: string | null;
  providerPlaybackId: string | null;
  externalVideoId: string | null;
  externalUrl: string | null;
  failureReason: string | null;
  providerSyncedAt: string | null;
  processingStartedAt: string | null;
  processingEndedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminVideoMediaSummaryState =
  | "NO_ORIGINAL"
  | "WAITING_UPLOAD"
  | "ORIGINAL_READY"
  | "CREATING_SOURCES"
  | "PARTIALLY_READY"
  | "READY"
  | "LEGACY_FALLBACK"
  | "FAILED"
  | "MANUAL_ACTION_REQUIRED";

export type AdminVideoMediaDto = {
  videoId: string;
  original: {
    id: string;
    status: string;
    version: number;
    fileName: string | null;
    sizeBytes: string | null;
    uploadedAt: string | null;
  } | null;
  activePlan: {
    id: string;
    mode: string;
    selectionPolicy: string;
    autopublishPolicy: string;
    preferredProvider: string | null;
    targets: Array<{
      id: string;
      provider: string;
      required: boolean;
      role: string;
      desiredPrimary: boolean;
      status: string;
      lastError: string | null;
      asset: AdminVideoAssetDto | null;
      job: {
        id: string;
        status: string;
        attemptCount: number;
        maxAttempts: number;
        lastError: string | null;
        nextAttemptAt: string | null;
      } | null;
    }>;
  } | null;
  activeRoute: {
    id: string;
    provider: string;
    assetId: string;
    activatedBy: string;
    activationReason: string | null;
    activatedAt: string;
  } | null;
  legacyAssets: AdminVideoAssetDto[];
  summary: {
    state: AdminVideoMediaSummaryState;
    canPublish: boolean;
    canPlay: boolean;
    warnings: string[];
  };
};

type DateLike = Date | string | null | undefined;

type MediaAssetLike = {
  id: string;
  provider: string;
  processingState: string;
  isPrimary: boolean;
  providerAssetId?: string | null;
  providerPlaybackId?: string | null;
  externalVideoId?: string | null;
  externalUrl?: string | null;
  failureReason?: string | null;
  providerSyncedAt?: DateLike;
  processingStartedAt?: DateLike;
  processingEndedAt?: DateLike;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type MediaOriginalLike = {
  id: string;
  status: string;
  version: number;
  originalFileName?: string | null;
  sizeBytes?: bigint | number | string | null;
  uploadCompletedAt?: DateLike;
  createdAt?: DateLike;
};

type MediaJobLike = {
  id: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string | null;
  nextAttemptAt?: DateLike;
  createdAt?: Date | string;
};

type MediaTargetLike = {
  id: string;
  provider: string;
  required: boolean;
  role: string;
  desiredPrimary: boolean;
  status: string;
  lastError?: string | null;
  providerAssets?: MediaAssetLike[];
  providerJobs?: MediaJobLike[];
};

type MediaPlanLike = {
  id: string;
  mode: string;
  selectionPolicy: string;
  autopublishPolicy: string;
  preferredProvider?: string | null;
  targets?: MediaTargetLike[];
};

type MediaRouteLike = {
  id: string;
  provider: string;
  assetId: string;
  activatedBy: string;
  activationReason?: string | null;
  activatedAt: Date | string;
  asset?: MediaAssetLike | null;
};

export type BuildAdminVideoMediaDtoInput = {
  videoId: string;
  activeOriginal?: MediaOriginalLike | null;
  originals?: MediaOriginalLike[];
  activePlan?: MediaPlanLike | null;
  activeRoute?: MediaRouteLike | null;
  legacyAssets?: MediaAssetLike[];
};

function toIsoString(value: DateLike): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAssetDto(asset: MediaAssetLike): AdminVideoAssetDto {
  return {
    id: asset.id,
    provider: asset.provider,
    processingState: asset.processingState,
    isPrimary: asset.isPrimary,
    providerAssetId: asset.providerAssetId ?? null,
    providerPlaybackId: asset.providerPlaybackId ?? null,
    externalVideoId: asset.externalVideoId ?? null,
    externalUrl: asset.externalUrl ?? null,
    failureReason: asset.failureReason ?? null,
    providerSyncedAt: toIsoString(asset.providerSyncedAt),
    processingStartedAt: toIsoString(asset.processingStartedAt),
    processingEndedAt: toIsoString(asset.processingEndedAt),
    createdAt: toIsoString(asset.createdAt)!,
    updatedAt: toIsoString(asset.updatedAt)!,
  };
}

function toOriginalDto(original: MediaOriginalLike): AdminVideoMediaDto["original"] {
  return {
    id: original.id,
    status: original.status,
    version: original.version,
    fileName: original.originalFileName ?? null,
    sizeBytes: original.sizeBytes == null ? null : original.sizeBytes.toString(),
    uploadedAt: toIsoString(original.uploadCompletedAt),
  };
}

function latestOriginal(originals: MediaOriginalLike[] = []): MediaOriginalLike | null {
  return [...originals].sort((a, b) => b.version - a.version)[0] ?? null;
}

function latestJob(jobs: MediaJobLike[] = []): MediaJobLike | null {
  return [...jobs].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  })[0] ?? null;
}

const IN_PROGRESS_STATUSES = new Set(["REQUESTED", "QUEUED", "STARTING", "WAITING_PROVIDER", "RUNNING"]);
const READY_STATUS = "READY";
const FAILED_STATUSES = new Set(["FAILED", "CANCELLED", "ABANDONED"]);
const WAITING_ORIGINAL_STATUSES = new Set(["PROVISIONING", "UPLOADING", "UPLOADED", "VERIFYING"]);

export function buildAdminVideoMediaDto(input: BuildAdminVideoMediaDtoInput): AdminVideoMediaDto {
  const warnings: string[] = [];
  const original = input.activeOriginal ?? latestOriginal(input.originals);
  if (!input.activeOriginal && original) {
    warnings.push("No active original found; using latest original version.");
  }

  const legacyAssets = input.legacyAssets ?? [];
  const legacyPrimaryAsset = legacyAssets.find((asset) => asset.isPrimary && asset.processingState === READY_STATUS) ?? null;
  if (!input.activeRoute && legacyPrimaryAsset) {
    warnings.push("No active playback route found; using legacy primary asset selection.");
  }

  const activePlan = input.activePlan
    ? {
        id: input.activePlan.id,
        mode: input.activePlan.mode,
        selectionPolicy: input.activePlan.selectionPolicy,
        autopublishPolicy: input.activePlan.autopublishPolicy,
        preferredProvider: input.activePlan.preferredProvider ?? null,
        targets: (input.activePlan.targets ?? []).map((target) => {
          const asset = target.providerAssets?.[0] ?? null;
          const job = latestJob(target.providerJobs);
          return {
            id: target.id,
            provider: target.provider,
            required: target.required,
            role: target.role,
            desiredPrimary: target.desiredPrimary,
            status: target.status,
            lastError: target.lastError ?? null,
            asset: asset ? toAssetDto(asset) : null,
            job: job
              ? {
                  id: job.id,
                  status: job.status,
                  attemptCount: job.attemptCount,
                  maxAttempts: job.maxAttempts,
                  lastError: job.lastError ?? null,
                  nextAttemptAt: toIsoString(job.nextAttemptAt),
                }
              : null,
          };
        }),
      }
    : null;

  const activeRoute = input.activeRoute
    ? {
        id: input.activeRoute.id,
        provider: input.activeRoute.provider,
        assetId: input.activeRoute.assetId,
        activatedBy: input.activeRoute.activatedBy,
        activationReason: input.activeRoute.activationReason ?? null,
        activatedAt: toIsoString(input.activeRoute.activatedAt)!,
      }
    : null;

  const activeRouteReady = Boolean(input.activeRoute?.asset?.processingState === READY_STATUS);
  const canPlay = activeRouteReady || Boolean(legacyPrimaryAsset);
  const targets = activePlan?.targets ?? [];
  const requiredTargets = targets.filter((target) => target.required);
  const hasInProgressWork = targets.some((target) => IN_PROGRESS_STATUSES.has(target.status) || (target.job && IN_PROGRESS_STATUSES.has(target.job.status)));
  const hasReadyTarget = targets.some((target) => target.status === READY_STATUS || target.asset?.processingState === READY_STATUS);
  const allRequiredTargetsReady = requiredTargets.length > 0 && requiredTargets.every((target) => target.status === READY_STATUS || target.asset?.processingState === READY_STATUS);
  const allKnownWorkFailed = targets.length > 0 && targets.every((target) => FAILED_STATUSES.has(target.status) || (target.job && FAILED_STATUSES.has(target.job.status)));

  let state: AdminVideoMediaSummaryState;
  if (!original) {
    state = "NO_ORIGINAL";
  } else if (WAITING_ORIGINAL_STATUSES.has(original.status)) {
    state = "WAITING_UPLOAD";
  } else if (activeRouteReady) {
    state = "READY";
  } else if (legacyPrimaryAsset) {
    // Playable, but only via the legacy primary-asset fallback (no VideoPlaybackRoute).
    // Surfaced distinctly so admins can find and fix these videos.
    state = "LEGACY_FALLBACK";
  } else if (activePlan?.mode === "MANUAL") {
    state = "MANUAL_ACTION_REQUIRED";
  } else if (hasInProgressWork) {
    state = "CREATING_SOURCES";
  } else if (hasReadyTarget && !allRequiredTargetsReady) {
    state = "PARTIALLY_READY";
  } else if (allKnownWorkFailed && !canPlay) {
    state = "FAILED";
  } else if (!activePlan) {
    state = original.status === READY_STATUS ? "ORIGINAL_READY" : "MANUAL_ACTION_REQUIRED";
  } else {
    state = original.status === READY_STATUS ? "ORIGINAL_READY" : "MANUAL_ACTION_REQUIRED";
  }

  return {
    videoId: input.videoId,
    original: original ? toOriginalDto(original) : null,
    activePlan,
    activeRoute,
    legacyAssets: legacyAssets.map(toAssetDto),
    summary: {
      state,
      // A genuine active READY playback route is required to consider a video
      // "cleanly" publishable from this admin diagnostics view. Legacy-fallback
      // playback still works (canPlay), but should be fixed by activating a
      // real route rather than relied on going forward.
      canPublish: activeRouteReady,
      canPlay,
      warnings,
    },
  };
}
