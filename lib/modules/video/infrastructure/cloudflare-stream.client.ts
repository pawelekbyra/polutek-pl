import { createScopedLogger } from "@/lib/logger";

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
      this.logger.error("Missing Cloudflare credentials", { accountId: !!accountId, apiToken: !!apiToken });
      throw new Error("Missing Cloudflare Stream credentials. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
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
      const errorText = await response.text();
      this.logger.error("Cloudflare API error", { status: response.status, errorText });
      throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
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
      throw new Error(`Cloudflare Stream import failed with status ${response.status}`);
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
        const errorText = await response.text();
        this.logger.error("Cloudflare API error (getAssetDetails)", { status: response.status, errorText });
        throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
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
      const errorText = await response.text();
      this.logger.error("Cloudflare API error (createSignedPlaybackToken)", { status: response.status, errorText });
      throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return { token: data.result.token };
  }
}
