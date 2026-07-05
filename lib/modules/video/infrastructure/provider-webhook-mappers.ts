import { StorageProvider } from "@prisma/client";

export type NormalizedProviderWebhook = {
  provider: StorageProvider;
  externalEventId?: string | null;
  eventType: string;
  providerAssetId?: string | null;
  providerUploadId?: string | null;
  state: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "IGNORED";
  failureReason?: string | null;
  raw: unknown;
};

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}
function str(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }

export function normalizeCloudflareStreamWebhook(payload: unknown): NormalizedProviderWebhook {
  const root = record(payload);
  const result = record(root.result);
  const status = record(root.status ?? result.status);
  const providerAssetId = str(root.uid) ?? str(root.id) ?? str(result.uid) ?? str(result.id);
  const eventType = str(root.type) ?? str(root.eventType) ?? str(root.name) ?? str(status.state) ?? "cloudflare.stream.unknown";
  const stateRaw = String(status.state ?? root.state ?? eventType).toLowerCase();
  let state: NormalizedProviderWebhook["state"] = providerAssetId ? "PROCESSING" : "IGNORED";
  if (["ready", "completed", "complete"].includes(stateRaw)) state = "READY";
  else if (["error", "errored", "failed", "failure"].includes(stateRaw)) state = "FAILED";
  else if (["pendingupload", "queued", "downloading", "inprogress", "processing"].includes(stateRaw)) state = "PROCESSING";
  return { provider: StorageProvider.CLOUDFLARE_STREAM, externalEventId: str(root.id) ?? str(root.eventId) ?? null, eventType, providerAssetId, state, failureReason: str(status.errorReasonText) ?? str(root.error) ?? null, raw: payload };
}

export function normalizeMuxWebhook(payload: unknown): NormalizedProviderWebhook {
  const root = record(payload);
  const data = record(root.data);
  const object = record(data.object);
  const eventType = str(root.type) ?? "mux.unknown";
  const isUpload = eventType.startsWith("video.upload");
  const providerUploadId = str(data.upload_id) ?? (isUpload ? str(data.id) : null) ?? str(object.upload_id);
  const providerAssetId = str(data.asset_id) ?? (!isUpload ? str(data.id) : null) ?? str(object.id) ?? str(object.asset_id);
  let state: NormalizedProviderWebhook["state"] = providerAssetId || providerUploadId ? "PROCESSING" : "IGNORED";
  if (eventType === "video.asset.ready") state = "READY";
  else if (eventType === "video.asset.errored" || eventType === "video.upload.cancelled" || eventType === "video.upload.errored") state = "FAILED";
  else if (["video.asset.created", "video.asset.preparing", "video.asset.processing", "video.upload.asset_created"].includes(eventType)) state = "PROCESSING";
  return { provider: StorageProvider.MUX, externalEventId: str(root.id) ?? null, eventType, providerAssetId, providerUploadId, state, failureReason: str(data.error) ?? str(data.errors?.messages?.join?.("; ")) ?? null, raw: payload };
}
