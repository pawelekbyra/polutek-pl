import { StorageProvider } from "@prisma/client";
import { redactSignedUrl } from "../application/original-source-url.service";
import { CloudflareStreamClient } from "./cloudflare-stream.client";
import { CreateAssetFromOriginalInput, CreateAssetFromOriginalResult, PlaybackProviderAdapter, ProviderAssetStatus } from "./playback-provider-adapter";

function mapCloudflareState(details: any): ProviderAssetStatus["state"] {
  const state = String(details?.result?.status?.state ?? details?.status?.state ?? "").toLowerCase();
  if (state === "ready") return "READY";
  if (state === "error" || state === "failed") return "FAILED";
  return "PROCESSING";
}

export class CloudflareStreamProviderAdapter implements PlaybackProviderAdapter {
  provider = StorageProvider.CLOUDFLARE_STREAM;

  constructor(private readonly client = new CloudflareStreamClient()) {}

  isConfigured(): boolean {
    return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  }

  async createAssetFromOriginal(input: CreateAssetFromOriginalInput): Promise<CreateAssetFromOriginalResult> {
    try {
      const result = await this.client.importVideoByUrl(input.sourceUrl);
      const uid = result.result?.uid;
      if (!uid) throw new Error("Cloudflare importVideoByUrl returned no UID");
      return { providerAssetId: uid, providerPlaybackId: uid, initialState: "PROCESSING", raw: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(redactSignedUrl(message));
    }
  }

  async getAssetStatus(input: { providerAssetId?: string | null }): Promise<ProviderAssetStatus> {
    if (!input.providerAssetId) return { state: "PENDING" };
    const details = await this.client.getAssetDetails(input.providerAssetId);
    const state = mapCloudflareState(details);
    return {
      state,
      providerAssetId: input.providerAssetId,
      providerPlaybackId: input.providerAssetId,
      failureReason: state === "FAILED" ? "Cloudflare Stream reported processing failure" : null,
      raw: details,
    };
  }
}
