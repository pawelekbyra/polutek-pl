import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "crypto";
import { MuxClient } from "@/lib/modules/video/infrastructure/mux.client";

const ORIGINAL_ENV = process.env;
const TOKEN_ID = "mux_test_token_id";
const TOKEN_SECRET = "mux_test_token_secret";

function setMuxEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    MUX_TOKEN_ID: TOKEN_ID,
    MUX_TOKEN_SECRET: TOKEN_SECRET,
    // Explicitly cleared (not just omitted) so these tests are deterministic
    // regardless of ambient MUX_SIGNING_* env vars in the host environment
    // (e.g. CI sets them for other test files) — callers opt back in via overrides.
    MUX_SIGNING_KEY_ID: "",
    MUX_SIGNING_PRIVATE_KEY: "",
    ...overrides,
  };
}

describe("MuxClient", () => {
  beforeEach(() => {
    setMuxEnv();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  describe("isConfigured", () => {
    it("is true when both token env vars are set", () => {
      expect(MuxClient.isConfigured()).toBe(true);
    });

    it("is false when a token env var is missing", () => {
      setMuxEnv({ MUX_TOKEN_SECRET: "" });
      expect(MuxClient.isConfigured()).toBe(false);
    });
  });

  describe("isSigningConfigured", () => {
    it("is false without signing env vars", () => {
      expect(MuxClient.isSigningConfigured()).toBe(false);
    });

    it("is true when both signing env vars are set", () => {
      setMuxEnv({ MUX_SIGNING_KEY_ID: "kid", MUX_SIGNING_PRIVATE_KEY: "pk" });
      expect(MuxClient.isSigningConfigured()).toBe(true);
    });
  });

  describe("createDirectUpload", () => {
    it("throws when MUX_TOKEN_ID/MUX_TOKEN_SECRET are missing", async () => {
      setMuxEnv({ MUX_TOKEN_ID: "", MUX_TOKEN_SECRET: "" });
      const client = new MuxClient();

      await expect(client.createDirectUpload()).rejects.toThrow(
        "MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables are required.",
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("posts basic-auth request and returns the upload payload on success", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "upload-1", url: "https://mux.example/upload", timeout: 3600 } }), {
          status: 200,
        }),
      );
      const client = new MuxClient();

      const result = await client.createDirectUpload("https://app.example");

      expect(result).toEqual({ id: "upload-1", url: "https://mux.example/upload", timeout: 3600 });
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe("https://api.mux.com/video/v1/uploads");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe(
        `Basic ${Buffer.from(`${TOKEN_ID}:${TOKEN_SECRET}`).toString("base64")}`,
      );
      const body = JSON.parse(init?.body as string);
      expect(body.cors_origin).toBe("https://app.example");
      expect(body.new_asset_settings.playback_policy).toEqual(["public"]);
    });

    it("uses signed playback policy when signing is configured", async () => {
      setMuxEnv({ MUX_SIGNING_KEY_ID: "kid" });
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "upload-1", url: "u", timeout: 3600 } }), { status: 200 }),
      );
      const client = new MuxClient();

      await client.createDirectUpload();

      const [, init] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(init?.body as string);
      expect(body.new_asset_settings.playback_policy).toEqual(["signed"]);
    });

    it("throws with a truncated response body on a non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("x".repeat(500), { status: 500 }));
      const client = new MuxClient();

      await expect(client.createDirectUpload()).rejects.toThrow(/Mux upload creation failed \(HTTP 500\)/);
    });
  });

  describe("getAsset", () => {
    it("returns the asset payload on success", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "asset-1", status: "ready" } }), { status: 200 }),
      );
      const client = new MuxClient();

      const result = await client.getAsset("asset-1");

      expect(result).toEqual({ id: "asset-1", status: "ready" });
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe("https://api.mux.com/video/v1/assets/asset-1");
      expect((init?.headers as Record<string, string>).Authorization).toContain("Basic ");
    });

    it("throws on a non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("not found", { status: 404 }));
      const client = new MuxClient();

      await expect(client.getAsset("missing")).rejects.toThrow(/Mux getAsset failed \(HTTP 404\)/);
    });
  });

  describe("getUpload", () => {
    it("returns the upload payload on success", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "upload-1", status: "asset_created", asset_id: "asset-1" } }), {
          status: 200,
        }),
      );
      const client = new MuxClient();

      const result = await client.getUpload("upload-1");

      expect(result).toEqual({ id: "upload-1", status: "asset_created", asset_id: "asset-1" });
    });

    it("throws on a non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
      const client = new MuxClient();

      await expect(client.getUpload("upload-1")).rejects.toThrow(/Mux getUpload failed \(HTTP 500\)/);
    });
  });

  describe("createAssetFromUrl", () => {
    it("posts the source URL and returns the asset payload on success", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "asset-1", status: "preparing" } }), { status: 200 }),
      );
      const client = new MuxClient();

      const result = await client.createAssetFromUrl({ url: "https://example.com/video.mp4" });

      expect(result).toEqual({ id: "asset-1", status: "preparing" });
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe("https://api.mux.com/video/v1/assets");
      const body = JSON.parse(init?.body as string);
      expect(body.input).toEqual([{ url: "https://example.com/video.mp4" }]);
    });

    it("throws on a non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("bad request", { status: 400 }));
      const client = new MuxClient();

      await expect(client.createAssetFromUrl({ url: "https://example.com/video.mp4" })).rejects.toThrow(
        /Mux asset creation from URL failed \(HTTP 400\)/,
      );
    });
  });

  describe("createSignedPlaybackToken", () => {
    it("throws when signing env vars are missing", () => {
      const client = new MuxClient();

      expect(() => client.createSignedPlaybackToken("playback-1")).toThrow(
        "MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY are required for signed playback.",
      );
    });

    it("returns a three-segment JWT signed with the configured RSA key", () => {
      const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
      const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
      const base64Key = Buffer.from(pem, "utf8").toString("base64");
      setMuxEnv({ MUX_SIGNING_KEY_ID: "kid-1", MUX_SIGNING_PRIVATE_KEY: base64Key });
      const client = new MuxClient();

      const token = client.createSignedPlaybackToken("playback-1", 120);

      const parts = token.split(".");
      expect(parts).toHaveLength(3);
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      expect(header).toEqual({ alg: "RS256", typ: "JWT", kid: "kid-1" });
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      expect(payload.sub).toBe("playback-1");
      expect(payload.aud).toBe("v");
      expect(payload.kid).toBe("kid-1");
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });
});
