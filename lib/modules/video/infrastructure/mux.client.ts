import { createScopedLogger } from "@/lib/logger";
import { MUX_VIDEO_QUALITY } from "../domain/mux-delivery.policy";

export interface MuxDirectUploadResponse {
  id: string;
  url: string;
  asset_id?: string;
  timeout: number;
}

export interface MuxAsset {
  id: string;
  status: "preparing" | "ready" | "errored";
  playback_ids?: Array<{ id: string; policy: "public" | "signed" }>;
  duration?: number;
  max_stored_resolution?: string;
  errors?: { type: string; messages: string[] };
}

export class MuxClient {
  private logger = createScopedLogger("MuxClient");

  private get config() {
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;

    if (!tokenId || !tokenSecret) {
      throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables are required.");
    }

    return { tokenId, tokenSecret };
  }

  private get auth() {
    const { tokenId, tokenSecret } = this.config;
    return `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
  }

  static isConfigured(): boolean {
    return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
  }

  async createDirectUpload(corsOrigin?: string): Promise<MuxDirectUploadResponse> {
    const body: Record<string, unknown> = {
      new_asset_settings: {
        playback_policy: [
          process.env.MUX_SIGNING_KEY_ID ? "signed" : "public",
        ],
        mp4_support: "none",
        // "basic" is free to encode and plenty for this catalogue's use case. Set explicitly
        // rather than left as the account default, which someone could change in the Mux
        // dashboard for an unrelated reason and unknowingly start billing us for pricier encodes.
        video_quality: MUX_VIDEO_QUALITY,
      },
      cors_origin: corsOrigin || process.env.NEXT_PUBLIC_APP_URL || "*",
    };

    const response = await fetch("https://api.mux.com/video/v1/uploads", {
      method: "POST",
      headers: {
        Authorization: this.auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      this.logger.error("Mux direct upload creation failed", { status: response.status, body: text });
      throw new Error(`Mux upload creation failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.data as MuxDirectUploadResponse;
  }

  async getAsset(assetId: string): Promise<MuxAsset> {
    const response = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
      headers: { Authorization: this.auth },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Mux getAsset failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.data as MuxAsset;
  }

  async getUpload(uploadId: string): Promise<{ id: string; status: string; asset_id?: string }> {
    const response = await fetch(`https://api.mux.com/video/v1/uploads/${uploadId}`, {
      headers: { Authorization: this.auth },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Mux getUpload failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.data;
  }

  /** Create a signed playback token JWT for a given playback ID. */
  createSignedPlaybackToken(playbackId: string, expiresInSeconds = 3600): string {
    const keyId = process.env.MUX_SIGNING_KEY_ID;
    const privateKey = process.env.MUX_SIGNING_PRIVATE_KEY;

    if (!keyId || !privateKey) {
      throw new Error("MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY are required for signed playback.");
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      sub: playbackId,
      aud: "v",
      exp: now + expiresInSeconds,
      kid: keyId,
    })).toString("base64url");

    const { createSign } = require("crypto");
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${payload}`);
    const signature = signer.sign(
      { key: Buffer.from(privateKey, "base64").toString("utf8"), format: "pem" },
      "base64url"
    );

    return `${header}.${payload}.${signature}`;
  }

  async createAssetFromUrl(input: {
    url: string;
    primaryIntent?: boolean;
  }): Promise<MuxAsset & { id: string }> {
    const body = {
      input: [{ url: input.url }],
      playback_policy: [process.env.MUX_SIGNING_KEY_ID ? "signed" : "public"],
      mp4_support: "none",
      // See the matching comment in createDirectUpload(): explicit "basic" quality so an
      // unrelated Mux dashboard change to the account default can't silently raise encoding cost.
      video_quality: MUX_VIDEO_QUALITY,
    };

    const response = await fetch("https://api.mux.com/video/v1/assets", {
      method: "POST",
      headers: {
        Authorization: this.auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      this.logger.error("Mux createAssetFromUrl failed", { status: response.status, body: text });
      throw new Error(`Mux asset creation from URL failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.data as MuxAsset & { id: string };
  }

  static isSigningConfigured(): boolean {
    return Boolean(process.env.MUX_SIGNING_KEY_ID && process.env.MUX_SIGNING_PRIVATE_KEY);
  }

  /**
   * Lists the daily usage export CSVs Mux generates (input/storage/delivery usage per asset).
   * Requires "Usage Exports" to be enabled for the Mux account by contacting Mux support first —
   * see lib/modules/video/application/check-mux-usage-budget.use-case.ts for how this is used and
   * what to verify before trusting its numbers.
   */
  async listUsageExports(params: { sinceEpochSeconds: number; untilEpochSeconds: number }): Promise<
    Array<{ date: string; download_url: string }>
  > {
    const url = new URL("https://api.mux.com/system/v1/usage/exports");
    url.searchParams.append("timeframe[]", String(params.sinceEpochSeconds));
    url.searchParams.append("timeframe[]", String(params.untilEpochSeconds));
    url.searchParams.set("limit", "100");

    const response = await fetch(url.toString(), {
      headers: { Authorization: this.auth },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Mux listUsageExports failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return (data.data || []) as Array<{ date: string; download_url: string }>;
  }
}
