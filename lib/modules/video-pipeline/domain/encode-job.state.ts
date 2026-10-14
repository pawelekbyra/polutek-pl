/**
 * State machine of an encode job (VideoEncodeJob). Pure: no I/O, so the rules are testable
 * without a database, ffmpeg or R2. The Prisma store (infrastructure) and the worker
 * (application/process-encode-job.ts) both go through these helpers.
 *
 *   QUEUED --claim--> RUNNING --ok--> SUCCEEDED
 *     ^                  |  \--cancel--> CANCELLED
 *     |                  \--transient failure, attempts left--> QUEUED (nextAttemptAt = backoff)
 *     |                  \--permanent failure / attempts exhausted--> FAILED
 *     \--cancel--> CANCELLED
 *   FAILED / CANCELLED / SUCCEEDED are terminal; "re-encode" creates a NEW job (new generation).
 */

export type EncodeJobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type EncodeStage = "QUEUED" | "DOWNLOADING" | "PROBING" | "ENCODING" | "UPLOADING" | "FINALIZING" | "DONE";

export const ACTIVE_ENCODE_STATUSES: readonly EncodeJobStatus[] = ["QUEUED", "RUNNING"];

/** A RUNNING job whose heartbeat is older than this is considered abandoned (worker crash/restart). */
export const STALE_HEARTBEAT_MS = 3 * 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 5 * 1000;
export const DEFAULT_MAX_ATTEMPTS = 3;

const TERMINAL: readonly EncodeJobStatus[] = ["SUCCEEDED", "FAILED", "CANCELLED"];

export function isTerminalStatus(status: EncodeJobStatus): boolean {
  return TERMINAL.includes(status);
}

export function isActiveStatus(status: EncodeJobStatus): boolean {
  return ACTIVE_ENCODE_STATUSES.includes(status);
}

/** Allowed status transitions; anything else is a bug (or a race the store must reject). */
const TRANSITIONS: Record<EncodeJobStatus, readonly EncodeJobStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED", "QUEUED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: EncodeJobStatus, to: EncodeJobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Error with a stable code and a verdict whether retrying can help. */
export class EncodeJobError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly permanent: boolean,
  ) {
    super(message);
    this.name = "EncodeJobError";
  }
}

/** Thrown inside the worker when the admin asked to cancel; never retried, never a failure. */
export class EncodeCancelledError extends Error {
  constructor() {
    super("Encode job cancelled");
    this.name = "EncodeCancelledError";
  }
}

export const PERMANENT = {
  NO_VIDEO_STREAM: "NO_VIDEO_STREAM",
  INVALID_MEDIA: "INVALID_MEDIA",
  TOO_LONG: "TOO_LONG",
  TOO_LARGE_FRAME: "TOO_LARGE_FRAME",
  ORIGINAL_MISSING: "ORIGINAL_MISSING",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  /** The source is longer than the channel's `ChannelQuota.maxVideoSeconds` (never retried: the file will not shrink). */
  CHANNEL_DURATION_LIMIT: "CHANNEL_DURATION_LIMIT",
} as const;

/** Hard bounds checked after ffprobe; they keep one bad file from monopolising the 2-vCPU server. */
export const ENCODE_LIMITS = {
  maxDurationSeconds: 6 * 60 * 60,
  maxWidth: 7680,
  maxHeight: 4320,
} as const;

/**
 * Whether a probed duration breaks a channel's length limit. The comparison is whole seconds: a container reports
 * 1800.04 s for a 30-minute film, so up to (but excluding) one full second over the limit still fits. `null`
 * limit = no per-channel limit (main channel, staff, legacy job).
 */
export function exceedsChannelDurationLimit(durationSeconds: number, limitSeconds: number | null): boolean {
  if (limitSeconds === null || !Number.isFinite(limitSeconds)) return false;
  return Math.floor(durationSeconds) > limitSeconds;
}

/** "1 h 5 min 3 s" style text for the Studio message (Polish abbreviations are the same in English). */
export function formatDurationText(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s || parts.length === 0) parts.push(`${s} s`);
  return parts.join(" ");
}

/** The creator-facing reason stored in `failureReason` (the Studio shows it as is). */
export function channelDurationLimitMessage(durationSeconds: number, limitSeconds: number): string {
  return `Film trwa ${formatDurationText(durationSeconds)}, a limit Twojego kanału to ${formatDurationText(limitSeconds)}. Skróć film i prześlij go ponownie albo poproś o wyższy limit.`;
}

export interface ClassifiedFailure {
  code: string;
  message: string;
  permanent: boolean;
}

/**
 * Turns anything thrown during a job into a stored failure. Unknown errors are treated as
 * transient (network, R2 5xx, ffmpeg killed by the OOM killer): they are retried with backoff
 * and only become FAILED when the attempts run out.
 */
export function classifyFailure(error: unknown): ClassifiedFailure {
  if (error instanceof EncodeJobError) {
    return { code: error.code, message: error.message, permanent: error.permanent };
  }
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  // ffmpeg/ffprobe say these when the file itself is broken (retrying cannot help).
  if (lower.includes("source has no video stream")) {
    return { code: PERMANENT.NO_VIDEO_STREAM, message: "Plik nie zawiera obrazu (sam dzwiek albo uszkodzony kontener).", permanent: true };
  }
  if (
    lower.includes("invalid data found when processing input") ||
    lower.includes("moov atom not found")
  ) {
    return { code: PERMANENT.INVALID_MEDIA, message: truncate(message), permanent: true };
  }
  const errorName = error instanceof Error ? error.name : "";
  if (errorName === "NoSuchKey" || lower.includes("nosuchkey") || lower.includes("the specified key does not exist")) {
    return { code: PERMANENT.ORIGINAL_MISSING, message: "Oryginal nie istnieje w R2.", permanent: true };
  }
  return { code: "TRANSIENT_ERROR", message: truncate(message), permanent: false };
}

function truncate(text: string, max = 1500): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/** 1 min, 5 min, 15 min, then 30 min. Attempt is the number of attempts already made (>= 1). */
export function retryDelayMs(attemptsMade: number): number {
  const schedule = [60_000, 300_000, 900_000, 1_800_000];
  return schedule[Math.min(Math.max(attemptsMade, 1), schedule.length) - 1];
}

export type FailureVerdict =
  | { next: "FAILED"; code: string; message: string }
  | { next: "QUEUED"; code: string; message: string; delayMs: number };

/** What happens to a RUNNING job that threw: retry later or give up. */
export function decideAfterFailure(
  job: { attemptCount: number; maxAttempts: number },
  failure: ClassifiedFailure,
): FailureVerdict {
  if (failure.permanent || job.attemptCount >= job.maxAttempts) {
    return { next: "FAILED", code: failure.code, message: failure.message };
  }
  return { next: "QUEUED", code: failure.code, message: failure.message, delayMs: retryDelayMs(job.attemptCount) };
}

export function isHeartbeatStale(heartbeatAt: Date | null, now: Date): boolean {
  if (!heartbeatAt) return true;
  return now.getTime() - heartbeatAt.getTime() > STALE_HEARTBEAT_MS;
}

/**
 * Overall percent for a stage and the fraction (0..1) done inside it. Stage weights are chosen
 * from the pilot: download is quick, encoding dominates, upload is mostly bounded by the uplink.
 */
const STAGE_RANGE: Record<EncodeStage, [number, number]> = {
  QUEUED: [0, 0],
  DOWNLOADING: [0, 8],
  PROBING: [8, 9],
  ENCODING: [9, 90],
  UPLOADING: [90, 99],
  FINALIZING: [99, 100],
  DONE: [100, 100],
};

export function overallProgress(stage: EncodeStage, fraction: number): number {
  const [from, to] = STAGE_RANGE[stage];
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return Math.round(from + (to - from) * f);
}

/**
 * ETA in seconds for the encoding stage from observed throughput. Returns null while there is
 * too little signal (under 3 % or under 10 s) so the UI shows "liczę..." instead of nonsense.
 */
export function estimateEtaSeconds(input: { stageElapsedMs: number; fraction: number; remainingStagesSeconds?: number }): number | null {
  const { stageElapsedMs, fraction } = input;
  if (!(fraction >= 0.03) || stageElapsedMs < 10_000) return null;
  const perFraction = stageElapsedMs / fraction;
  const remainingEncode = (perFraction * (1 - Math.min(fraction, 1))) / 1000;
  return Math.max(0, Math.round(remainingEncode + (input.remainingStagesSeconds ?? 0)));
}

/** "v3" -> 3; anything else -> 0. Used to pick the next HLS output generation. */
export function parseVersionNumber(value: string | null | undefined): number {
  const match = /(?:^|\/)v(\d+)$/.exec(value ?? "");
  return match ? Number(match[1]) : 0;
}
