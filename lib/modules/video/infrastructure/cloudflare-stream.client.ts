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

type CloudflareErrorItem = {
  code?: string | number | null;
  message?: string | null;
};

function formatCloudflareErrors(payload: any): string {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const messages = errors
    .map((error: CloudflareErrorItem) => {
      const code = error?.code ? `code ${error.code}` : null;
      const message = typeof error?.message === "string" ? error.message : null;
      return [code, message].filter(Boolean).join(": ");
    })
    .filter(Boolean);

  if (messages.length > 0) return messages.slice(0, 2).join("; ");

  if (typeof payload?.message === "string") return payload.message;
  return "No Cloudflare error body returned.";
}

async function readCloudflareError(response: Response): Promise<{ status: number; details: string; payload: any }> {
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 500) };
  }

  return {
    status: response.status,
    details: formatCloudflareErrors(payload),
    payload,
  };
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
        }),
      }
    );

    if (!response.ok) {
      const cloudflareError = await readCloudflareError(response);
      this.logger.error("Cloudflare API error", {
        status: cloudflareError.status,
        details: cloudflareError.details,
        payload: cloudflareError.payload,
      });
      throw new CloudflareApiError(
        `Cloudflare Stream odrzucił przygotowanie uploadu (HTTP ${cloudflareError.status}): ${cloudflareError.details}`
      );
    }

    const data = await response.json();
    if (!data?.success || !data?.result?.uploadURL || !data?.result?.uid) {
      this.logger.error("Cloudflare API returned unexpected direct upload response", { data });
      throw new CloudflareApiError("Cloudflare Stream zwrócił nieoczekiwaną odpowiedź podczas przygotowania uploadu.");
    }

    return data;
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
      const cloudflareError = await readCloudflareError(response);
      this.logger.error("Cloudflare API error (importVideoByUrl)", {
        status: cloudflareError.status,
        details: cloudflareError.details,
        payload: cloudflareError.payload,
      });
      throw new CloudflareApiError(
        `Cloudflare Stream nie przyjął importu legacy URL (HTTP ${cloudflareError.status}): ${cloudflareError.details}`
      );
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
        const cloudflareError = await readCloudflareError(response);
        this.logger.error("Cloudflare API error (getAssetDetails)", {
          status: cloudflareError.status,
          details: cloudflareError.details,
        });
        throw new CloudflareApiError(
          `Cloudflare Stream nie zwrócił danych assetu (HTTP ${cloudflareError.status}): ${cloudflareError.details}`
        );
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
      const cloudflareError = await readCloudflareError(response);
      this.logger.error("Cloudflare API error (createSignedPlaybackToken)", {
        status: cloudflareError.status,
        details: cloudflareError.details,
      });
      throw new CloudflareApiError(
        `Cloudflare Stream nie utworzył tokenu odtwarzania (HTTP ${cloudflareError.status}): ${cloudflareError.details}`
      );
    }

    const data = await response.json();
    return { token: data.result.token };
  }
}
