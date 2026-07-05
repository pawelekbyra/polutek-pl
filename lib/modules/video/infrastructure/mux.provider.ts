import { StorageProvider } from "@prisma/client";
import { redactSignedUrl } from "../application/original-source-url.service";
import { MuxAsset, MuxClient } from "./mux.client";
import { CreateAssetFromOriginalInput, CreateAssetFromOriginalResult, PlaybackProviderAdapter, ProviderAssetStatus } from "./playback-provider-adapter";

function pickPlaybackId(asset: MuxAsset): string | null {
  return asset.playback_ids?.find((playback) => playback.policy === "signed")?.id
    ?? asset.playback_ids?.find((playback) => playback.policy === "public")?.id
    ?? null;
}

function mapMuxState(status: string): ProviderAssetStatus["state"] {
  if (status === "ready") return "READY";
  if (status === "errored") return "FAILED";
  return "PROCESSING";
}

export class MuxProviderAdapter implements PlaybackProviderAdapter {
  provider = StorageProvider.MUX;

  constructor(private readonly client = new MuxClient()) {}

  isConfigured(): boolean {
    return MuxClient.isConfigured();
  }

  async createAssetFromOriginal(input: CreateAssetFromOriginalInput): Promise<CreateAssetFromOriginalResult> {
    try {
      const asset = await this.client.createAssetFromUrl({ url: input.sourceUrl });
      return {
        providerAssetId: asset.id,
        providerPlaybackId: pickPlaybackId(asset),
        initialState: mapMuxState(asset.status) === "READY" ? "READY" : "PROCESSING",
        raw: asset,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(redactSignedUrl(message));
    }
  }

  async getAssetStatus(input: { providerAssetId?: string | null; providerUploadId?: string | null }): Promise<ProviderAssetStatus> {
    let assetId = input.providerAssetId ?? null;
    let upload = null as Awaited<ReturnType<MuxClient["getUpload"]>> | null;
    if (!assetId && input.providerUploadId) {
      upload = await this.client.getUpload(input.providerUploadId);
      assetId = upload.asset_id ?? null;
    }
    if (!assetId) return { state: "PENDING", providerUploadId: input.providerUploadId ?? upload?.id ?? null };

    const asset = await this.client.getAsset(assetId);
    return {
      state: mapMuxState(asset.status),
      providerAssetId: asset.id,
      providerPlaybackId: pickPlaybackId(asset),
      providerUploadId: input.providerUploadId ?? upload?.id ?? null,
      durationSeconds: asset.duration ?? null,
      failureReason: asset.errors?.messages?.join("; ") ?? null,
      raw: asset,
    };
  }
}
