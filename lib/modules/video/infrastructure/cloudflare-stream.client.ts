import { createScopedLogger } from "@/lib/logger";
import { CloudflareApiError, CloudflareConfigurationError, CloudflareNotFoundError } from "../domain/video.errors";

export interface CloudflareDirectUploadResponse {
  result: {
    uploadURL: string;
    uid: string;
  };
  success: boolean;
  errors: unknown[];
  messages: unknown[];
}

export interface CloudflareImportByUrlResponse {
  result: {
    uid: string;
  };
  success: boolean;
  errors: unknown[];
  messages: unknown[];
}

function formatCloudflareErrors(payload: unknown): string {
  const source = payload && typeof payload === "object" ? payload as { errors?: unknown[]; message?: unknown } : null;
  const errors = Array.isArray(source?.errors) ? source.errors : [];
  const messages = errors
    .map((error) => {
      const item = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : null;
      const code = item?.code ? `code ${String(item.code)}` : null;
      const message = typeof item?.message === "string" ? item.message : null;
      return [code, message].filter(Boolean).join(": ");
    })
    .filter(Boolean);

  if (messages.length > 0) return messages.slice(0, 2).join("; ");

  if (typeof source?.message === "string") return source.message;
  return "No Cloudflare error body returned.";
}

async function readCloudflareError(response: Response): Promise<{ status: number; details: string; payload: unknown }> {
  const text = await response.text();
  let payload: unknown = null;
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

function encodeTusMetadataValue(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function appendTusMetadataValue(metadata: string | null | undefined, key: string, value: string): string {
  const existing = metadata?.trim() ?? "";
  const entries = existing ? existing.split(",").map((entry) => entry.trim()).filter(Boolean) : [];
  const hasKey = entries.some((entry) => entry.split(/\s+/)[0] === key);
  if (!hasKey) entries.push(`${key} ${encodeTusMetadataValue(value)}`);
  return entries.join(",");
}

function extractStreamUidFromUploadLocation(location: string): string | null {
  try {
    const url = new URL(location);
    const lastSegment = url.pathname.split("/").filter(Boolean).pop();
    return lastSegment || null;
  } catch {
    const lastSegment = location.split("/").filter(Boolean).pop();
    return lastSegment || null;
  }
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

  async createTusDirectUploadUrl(input: {
    uploadLength: string;
    uploadMetadata?: string | null;
    maxDurationSeconds?: number;
  }): Promise<CloudflareDirectUploadResponse> {
    const { accountId, apiToken } = this.config;
    const maxDurationSeconds = input.maxDurationSeconds ?? 3600;
    const uploadMetadata = appendTusMetadataValue(
      input.uploadMetadata,
      "maxDurationSeconds",
      String(maxDurationSeconds)
    );

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": input.uploadLength,
          "Upload-Metadata": uploadMetadata,
        },
      }
    );

    const uploadURL = response.headers.get("Location");
    const uid = uploadURL ? extractStreamUidFromUploadLocation(uploadURL) : null;

    if (!response.ok || !uploadURL || !uid) {
      const cloudflareError = await readCloudflareError(response);
      this.logger.error("Cloudflare TUS direct upload API error", {
        status: cloudflareError.status,
        details: cloudflareError.details,
        payload: cloudflareError.payload,
        hasLocation: Boolean(uploadURL),
      });
      throw new CloudflareApiError(
        `Cloudflare Stream odrzucił przygotowanie uploadu TUS (HTTP ${cloudflareError.status}): ${cloudflareError.details}`
      );
    }

    return {
      result: { uploadURL, uid },
      success: true,
      errors: [],
      messages: [],
    };
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
        if (response.status === 404) {
          throw new CloudflareNotFoundError(uid);
        }
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

}
