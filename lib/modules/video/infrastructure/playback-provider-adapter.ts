import { StorageProvider } from "@prisma/client";

export type ProviderAssetStatus = {
  state: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  providerAssetId?: string | null;
  providerPlaybackId?: string | null;
  providerUploadId?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  failureReason?: string | null;
  raw?: unknown;
};

export type CreateAssetFromOriginalInput = {
  videoId: string;
  originalId: string;
  sourceUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateAssetFromOriginalResult = {
  providerAssetId: string;
  providerPlaybackId?: string | null;
  providerUploadId?: string | null;
  initialState: "PENDING" | "UPLOADING" | "PROCESSING" | "READY";
  raw?: unknown;
};

export interface PlaybackProviderAdapter {
  provider: StorageProvider;
  isConfigured(): boolean;
  createAssetFromOriginal(input: CreateAssetFromOriginalInput): Promise<CreateAssetFromOriginalResult>;
  getAssetStatus(input: { providerAssetId?: string | null; providerUploadId?: string | null }): Promise<ProviderAssetStatus>;
  deleteAsset?(input: { providerAssetId: string }): Promise<void>;
}
