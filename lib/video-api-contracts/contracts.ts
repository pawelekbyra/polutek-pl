import { z } from "zod";
import type { PlaybackPlan } from "@/lib/modules/playback/domain/playback.dto";

/** Pure browser/server boundary contracts. Keep this module free of application and infrastructure imports. */
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();
const nullableString = z.string().nullable();

export const MultipartStartResponseSchema = z.object({
  originalId: z.string().min(1),
  partSize: positiveInt,
  partCount: positiveInt,
  fileSize: positiveInt.optional(),
}).passthrough();

export const MultipartPartsResponseSchema = z.object({
  originalId: z.string().min(1).optional(),
  partSize: positiveInt,
  partCount: positiveInt,
  parts: z.array(z.object({ partNumber: positiveInt, etag: z.string().min(1) }).passthrough()),
}).passthrough();

export const MultipartPresignResponseSchema = z.object({
  urls: z.array(z.object({ partNumber: positiveInt, url: z.string().url() }).passthrough()),
  expiresAt: z.string().optional(),
}).passthrough();

export const MultipartCompleteResponseSchema = z.object({
  originalId: z.string().min(1),
  job: z.object({ id: z.string().min(1) }).passthrough(),
}).passthrough();

export const EncodeJobResponseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
  stage: z.enum(["QUEUED", "DOWNLOADING", "PROBING", "ENCODING", "UPLOADING", "FINALIZING", "DONE"]),
  progressPercent: z.number().int().min(0).max(100),
  etaSeconds: nonNegativeInt.nullable(),
  attemptCount: nonNegativeInt,
  maxAttempts: positiveInt,
  versionNumber: positiveInt,
  originalId: z.string().min(1),
  assetId: nullableString,
  cancelRequested: z.boolean(),
  failureCode: nullableString,
  failureReason: nullableString,
  nextAttemptAt: nullableString,
  createdAt: z.string().min(1),
  startedAt: nullableString,
  finishedAt: nullableString,
  heartbeatFresh: z.boolean(),
}).passthrough();

export const PipelineStateResponseSchema = z.object({
  summary: z.enum(["NO_ORIGINAL", "UPLOADING", "QUEUED", "ENCODING", "READY", "FAILED", "CANCELLED", "UPLOAD_FAILED"]),
  workerAlive: z.boolean(),
  original: z.object({
    id: z.string().min(1),
    status: z.enum(["PROVISIONING", "UPLOADING", "UPLOADED", "VERIFYING", "READY", "FAILED", "SUPERSEDED", "ABANDONED"]),
    fileName: nullableString,
    sizeBytes: nullableString,
    version: positiveInt,
    failureReason: nullableString,
    uploadCompletedAt: nullableString,
  }).passthrough().nullable(),
  job: EncodeJobResponseSchema.nullable(),
  assets: z.array(z.object({
    id: z.string().min(1),
    objectKey: z.string().min(1),
    versionNumber: positiveInt,
    isActive: z.boolean(),
    sizeBytes: nonNegativeInt.nullable(),
    createdAt: z.string().min(1),
  }).passthrough()),
  hasCompetingSource: z.boolean(),
}).passthrough();

/** The Studio route intentionally removes private identifiers and object keys from the panel DTO. */
export const StudioPipelineStateResponseSchema = z.object({
  summary: PipelineStateResponseSchema.shape.summary,
  workerAlive: z.boolean(),
  original: z.object({
    status: z.enum(["PROVISIONING", "UPLOADING", "UPLOADED", "VERIFYING", "READY", "FAILED", "SUPERSEDED", "ABANDONED"]),
    fileName: nullableString,
    sizeBytes: nullableString,
    failureReason: nullableString,
  }).passthrough().nullable(),
  job: EncodeJobResponseSchema.nullable(),
  assets: z.array(z.object({
    versionNumber: positiveInt,
    isActive: z.boolean(),
    sizeBytes: nonNegativeInt.nullable(),
    createdAt: z.string().min(1),
  }).passthrough()),
  hasCompetingSource: z.boolean(),
}).passthrough();

const PlaybackAssetSchema = z.object({
  provider: z.string().min(1),
  processingState: z.string().optional(),
  isPrimary: z.boolean(),
  mimeType: nullableString.optional(),
  sizeBytes: nonNegativeInt.nullable().optional(),
}).passthrough();

const ChapterSchema = z.object({
  startSeconds: nonNegativeInt,
  title: z.string(),
  titleEn: z.string().optional(),
}).passthrough();

export const PlaybackPlanResponseSchema = z.object({
  videoId: z.string().min(1),
  status: z.enum(["READY", "LOGIN_REQUIRED", "COMING_SOON", "PASS_REQUIRED", "VIDEO_NOT_READY", "NO_PRIMARY_ASSET", "PROCESSING", "UNAVAILABLE", "ERROR"]),
  canPlay: z.boolean(),
  premiereAt: z.string().optional(),
  access: z.object({
    allowed: z.boolean(),
    reason: z.string().optional(),
    requiredTier: z.string().optional(),
    offer: z.record(z.unknown()).optional(),
    premiumPassUntil: z.string().optional(),
  }).passthrough(),
  source: z.object({
    provider: z.string().min(1),
    kind: z.string().min(1),
    playbackUrl: z.string().min(1).optional(),
    posterUrl: z.string().min(1).optional(),
    mimeType: z.string().optional(),
    isSignedUrl: z.boolean(),
    expiresAt: z.string().optional(),
    asset: PlaybackAssetSchema.optional(),
  }).passthrough().optional(),
  player: z.object({
    autoplayAllowed: z.boolean(),
    mutedAutoplay: z.boolean(),
    controls: z.boolean(),
    poster: z.string(),
    title: z.string(),
    textTracks: z.array(z.object({ src: z.string(), label: z.string(), language: z.string(), kind: z.enum(["subtitles", "captions"]), default: z.boolean().optional() }).passthrough()).optional(),
    chapters: z.array(ChapterSchema).optional(),
  }).passthrough(),
  diagnostics: z.object({
    warnings: z.array(z.string()),
    sourceConfidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    providerResolutionAllowed: z.boolean(),
    providerResolutionAttempted: z.boolean(),
    sourceMode: z.enum(["PROVIDER_ASSET", "LEGACY_URL", "NONE"]).optional(),
    asset: PlaybackAssetSchema.optional(),
  }).passthrough(),
  tracking: z.object({ playbackSessionId: z.string(), heartbeatIntervalSeconds: nonNegativeInt }).passthrough(),
  hasAccess: z.boolean(),
  kind: z.string().optional(),
  playbackUrl: z.string().min(1).optional(),
}).passthrough();

export type MultipartStartResponse = z.infer<typeof MultipartStartResponseSchema>;
export type MultipartPartsResponse = z.infer<typeof MultipartPartsResponseSchema>;
export type MultipartPresignResponse = z.infer<typeof MultipartPresignResponseSchema>;
export type MultipartCompleteResponse = z.infer<typeof MultipartCompleteResponseSchema>;
export type PipelineStateResponse = z.infer<typeof PipelineStateResponseSchema>;
export type StudioPipelineStateResponse = z.infer<typeof StudioPipelineStateResponseSchema>;
export type PlaybackPlanResponse = z.infer<typeof PlaybackPlanResponseSchema>;

export class ApiContractError extends Error {
  readonly code = "API_CONTRACT_MISMATCH";
  readonly status = 502;

  constructor(readonly contract: string) {
    super(`Odpowiedź serwera nie spełnia kontraktu: ${contract}.`);
    this.name = "ApiContractError";
  }
}

export function parseApiContract<T>(schema: z.ZodType<T>, value: unknown, contract: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiContractError(contract);
  return parsed.data;
}

/** Runtime-validated compatibility bridge to the established domain DTO type. */
export function readPlaybackPlan(value: unknown): PlaybackPlan | null {
  return PlaybackPlanResponseSchema.safeParse(value).success ? value as PlaybackPlan : null;
}
