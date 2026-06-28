import { createScopedLogger } from "@/lib/logger";

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
}
