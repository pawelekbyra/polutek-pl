import { createScopedLogger } from "@/lib/logger";
import { CloudflareApiError, CloudflareConfigurationError } from "../domain/video.errors";

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

export interface DeleteCloudflareStreamAssetResult {
  uid: string;
  alreadyDeleted: boolean;
}

export class CloudflareStreamDeleteClient {
  private logger = createScopedLogger("CloudflareStreamDeleteClient");

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

  async deleteAsset(uid: string): Promise<DeleteCloudflareStreamAssetResult> {
    const normalizedUid = uid.trim();
    if (!normalizedUid) {
      throw new CloudflareApiError("Nie można usunąć assetu Cloudflare Stream bez UID.");
    }

    const { accountId, apiToken } = this.config;
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(normalizedUid)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 404) {
      this.logger.warn("Cloudflare Stream asset was already missing during delete", { uid: normalizedUid });
      return { uid: normalizedUid, alreadyDeleted: true };
    }

    if (!response.ok) {
      const cloudflareError = await readCloudflareError(response);
      this.logger.error("Cloudflare API error (deleteAsset)", {
        uid: normalizedUid,
        status: cloudflareError.status,
        details: cloudflareError.details,
        payload: cloudflareError.payload,
      });
      throw new CloudflareApiError(
        `Cloudflare Stream nie usunął assetu (HTTP ${cloudflareError.status}): ${cloudflareError.details}`
      );
    }

    return { uid: normalizedUid, alreadyDeleted: false };
  }
}
