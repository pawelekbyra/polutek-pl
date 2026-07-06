import { StorageProvider } from "@prisma/client";

export type NormalizedProviderWebhook = {
  provider: StorageProvider;
  externalEventId?: string | null;
  eventType: string;
  providerAssetId?: string | null;
  providerUploadId?: string | null;
  providerPlaybackId?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  state: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "IGNORED";
  failureReason?: string | null;
  raw: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function str(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }
function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function num(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function playbackId(value: unknown): string | null {
  const items = Array.isArray(value) ? value : [];
  const signed = items.find((item) => str(record(item).policy) === "signed");
  const anyItem = signed ?? items[0];
  return str(record(anyItem).id);
}

export function normalizeCloudflareStreamWebhook(payload: unknown): NormalizedProviderWebhook {
  const root = record(payload);
  const result = record(root.result);
  const status = record(root.status ?? result.status);
  const providerAssetId = str(root.uid) ?? str(root.id) ?? str(result.uid) ?? str(result.id);
  const providerPlaybackId = str(result.playbackId) ?? str(root.playbackId) ?? providerAssetId;
  const eventType = str(root.type) ?? str(root.eventType) ?? str(root.name) ?? str(status.state) ?? "cloudflare.stream.unknown";
  const stateRaw = String(status.state ?? root.state ?? eventType).toLowerCase();
  let state: NormalizedProviderWebhook["state"] = providerAssetId ? "PROCESSING" : "IGNORED";
  if (["ready", "completed", "complete"].includes(stateRaw)) state = "READY";
  else if (["error", "errored", "failed", "failure"].includes(stateRaw)) state = "FAILED";
  else if (["pendingupload", "queued", "downloading", "inprogress", "processing"].includes(stateRaw)) state = "PROCESSING";
  return { provider: StorageProvider.CLOUDFLARE_STREAM, externalEventId: str(root.id) ?? str(root.eventId) ?? null, eventType, providerAssetId, providerPlaybackId, durationSeconds: num(result.duration) ?? num(root.duration), sizeBytes: num(result.size) ?? num(root.size), state, failureReason: str(status.errorReasonText) ?? str(root.error) ?? null, raw: payload };
}

export function normalizeMuxWebhook(payload: unknown): NormalizedProviderWebhook {
  const root = record(payload);
  const data = record(root.data);
  const object = record(data.object);
  const eventType = str(root.type) ?? "mux.unknown";
  const isUpload = eventType.startsWith("video.upload");
  const providerUploadId = str(data.upload_id) ?? (isUpload ? str(data.id) : null) ?? str(object.upload_id);
  const providerAssetId = str(data.asset_id) ?? (!isUpload ? str(data.id) : null) ?? str(object.id) ?? str(object.asset_id);
  const providerPlaybackId = playbackId(data.playback_ids) ?? playbackId(object.playback_ids);
  let state: NormalizedProviderWebhook["state"] = providerAssetId || providerUploadId ? "PROCESSING" : "IGNORED";
  if (eventType === "video.asset.ready") state = "READY";
  else if (eventType === "video.asset.errored" || eventType === "video.upload.cancelled" || eventType === "video.upload.errored") state = "FAILED";
  else if (["video.asset.created", "video.asset.preparing", "video.asset.processing", "video.upload.asset_created"].includes(eventType)) state = "PROCESSING";
  const errors = record(data.errors);
  const errorMessages = stringList(errors.messages).join("; ");
  const failureReason = str(data.error) ?? (errorMessages || null);
  return { provider: StorageProvider.MUX, externalEventId: str(root.id) ?? null, eventType, providerAssetId, providerUploadId, providerPlaybackId, durationSeconds: num(data.duration) ?? num(object.duration), state, failureReason, raw: payload };
}
