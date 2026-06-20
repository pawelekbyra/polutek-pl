import { createScopedLogger } from "@/lib/logger";
import { CloudflareApiError, CloudflareConfigurationError } from "../domain/video.errors";

export interface CloudflareDirectUploadResponse {
  result: {
    uploadURL: string;
    uid: string;
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

export interface CloudflareImportByUrlResponse {
  result: {
    uid: string;
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

export class CloudflareStreamClient {
  private logger = createScopedLogger("CloudflareStreamClient");

  private get config() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      const missing = [
        !accountId ? "CLOUDFLARE_ACCOUNT_ID" : null,
        !apiToken ? "CLOUDFLARE_API_TOKEN" : null,
      ].filter(Boolean) as string[];
      this.logger.error("Missing Cloudflare Stream server configuration", { missing });
      throw new CloudflareConfigurationError(missing);
    }

    return { accountId, apiToken };
  }

  async createDirectUploadUrl(maxDurationSeconds: number = 3600): Promise<CloudflareDirectUploadResponse> {
    const { accountId, apiToken } = this.config;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds,
          // We can add more metadata here if needed
        }),
      }
    );

    if (!response.ok) {
      this.logger.error("Cloudflare API error", { status: response.status });
      throw new CloudflareApiError();
    }

    return await response.json();
  }

  async importVideoByUrl(url: string): Promise<CloudflareImportByUrlResponse> {
    const { accountId, apiToken } = this.config;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      }
    );

    if (!response.ok) {
      this.logger.error("Cloudflare API error (importVideoByUrl)", { status: response.status });
      throw new CloudflareApiError("Cloudflare Stream nie przyjął importu legacy URL. Spróbuj ponownie później.");
    }

    return await response.json();
  }

  async getAssetDetails(uid: string) {
      const { accountId, apiToken } = this.config;

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        this.logger.error("Cloudflare API error (getAssetDetails)", { status: response.status });
        throw new CloudflareApiError();
      }

      return await response.json();
  }

  async createSignedPlaybackToken(uid: string, expirationSeconds: number = 3600): Promise<{ token: string }> {
    const { accountId, apiToken } = this.config;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + expirationSeconds,
        }),
      }
    );

    if (!response.ok) {
      this.logger.error("Cloudflare API error (createSignedPlaybackToken)", { status: response.status });
      throw new CloudflareApiError();
    }

    const data = await response.json();
    return { token: data.result.token };
  }
}
