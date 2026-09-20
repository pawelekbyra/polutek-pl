import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { StorageProvider } from "@prisma/client";
import { CloudflareStreamProviderAdapter } from "@/lib/modules/video/infrastructure/cloudflare-stream.provider";
import { CloudflareStreamClient } from "@/lib/modules/video/infrastructure/cloudflare-stream.client";

const ORIGINAL_ENV = process.env;

function setCloudflareEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    CLOUDFLARE_ACCOUNT_ID: "account-1",
    CLOUDFLARE_API_TOKEN: "token-1",
    ...overrides,
  };
}

function makeClientStub(overrides: Partial<CloudflareStreamClient> = {}): CloudflareStreamClient {
  return {
    importVideoByUrl: vi.fn(),
    getAssetDetails: vi.fn(),
    ...overrides,
  } as unknown as CloudflareStreamClient;
}

describe("CloudflareStreamProviderAdapter", () => {
  beforeEach(() => {
    setCloudflareEnv();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("carries the CLOUDFLARE_STREAM provider identity", () => {
    const adapter = new CloudflareStreamProviderAdapter(makeClientStub());
    expect(adapter.provider).toBe(StorageProvider.CLOUDFLARE_STREAM);
  });

  describe("isConfigured", () => {
    it("is true when both env vars are set", () => {
      const adapter = new CloudflareStreamProviderAdapter(makeClientStub());
      expect(adapter.isConfigured()).toBe(true);
    });

    it("is false when an env var is missing", () => {
      setCloudflareEnv({ CLOUDFLARE_API_TOKEN: "" });
      const adapter = new CloudflareStreamProviderAdapter(makeClientStub());
      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe("createAssetFromOriginal", () => {
    it("maps the returned uid to both the asset and playback id", async () => {
      const client = makeClientStub({
        importVideoByUrl: vi.fn().mockResolvedValue({ result: { uid: "cf-uid-1" }, success: true, errors: [], messages: [] }),
      });
      const adapter = new CloudflareStreamProviderAdapter(client);

      const result = await adapter.createAssetFromOriginal({
        videoId: "video-1",
        originalId: "original-1",
        sourceUrl: "https://example.com/video.mp4",
      });

      expect(result).toEqual({
        providerAssetId: "cf-uid-1",
        providerPlaybackId: "cf-uid-1",
        initialState: "PROCESSING",
        raw: expect.objectContaining({ result: { uid: "cf-uid-1" } }),
      });
      expect(client.importVideoByUrl).toHaveBeenCalledWith("https://example.com/video.mp4");
    });

    it("throws when Cloudflare returns no uid", async () => {
      const client = makeClientStub({
        importVideoByUrl: vi.fn().mockResolvedValue({ result: {}, success: true, errors: [], messages: [] }),
      });
      const adapter = new CloudflareStreamProviderAdapter(client);

      await expect(
        adapter.createAssetFromOriginal({
          videoId: "video-1",
          originalId: "original-1",
          sourceUrl: "https://example.com/video.mp4",
        }),
      ).rejects.toThrow("Cloudflare importVideoByUrl returned no UID");
    });

    it("redacts a presigned source URL from a thrown error message", async () => {
      const client = makeClientStub({
        importVideoByUrl: vi
          .fn()
          .mockRejectedValue(
            new Error(
              "Cloudflare rejected https://r2.example.com/video.mp4?X-Amz-Signature=super-secret&X-Amz-Date=today",
            ),
          ),
      });
      const adapter = new CloudflareStreamProviderAdapter(client);

      await expect(
        adapter.createAssetFromOriginal({
          videoId: "video-1",
          originalId: "original-1",
          sourceUrl: "https://r2.example.com/video.mp4?X-Amz-Signature=super-secret&X-Amz-Date=today",
        }),
      ).rejects.toThrow(/X-Amz-Signature=\[REDACTED\]/);
    });
  });

  describe("getAssetStatus", () => {
    it("returns PENDING when no providerAssetId is given", async () => {
      const client = makeClientStub();
      const adapter = new CloudflareStreamProviderAdapter(client);

      const result = await adapter.getAssetStatus({});

      expect(result).toEqual({ state: "PENDING" });
      expect(client.getAssetDetails).not.toHaveBeenCalled();
    });

    it("maps a ready result state to READY", async () => {
      const client = makeClientStub({
        getAssetDetails: vi.fn().mockResolvedValue({ result: { status: { state: "ready" } } }),
      });
      const adapter = new CloudflareStreamProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerAssetId: "cf-uid-1" });

      expect(client.getAssetDetails).toHaveBeenCalledWith("cf-uid-1");
      expect(result.state).toBe("READY");
      expect(result.providerAssetId).toBe("cf-uid-1");
      expect(result.providerPlaybackId).toBe("cf-uid-1");
      expect(result.failureReason).toBeNull();
    });

    it("maps an error result state to FAILED with a fixed failure reason", async () => {
      const client = makeClientStub({
        getAssetDetails: vi.fn().mockResolvedValue({ result: { status: { state: "error" } } }),
      });
      const adapter = new CloudflareStreamProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerAssetId: "cf-uid-1" });

      expect(result.state).toBe("FAILED");
      expect(result.failureReason).toBe("Cloudflare Stream reported processing failure");
    });

    it("maps a failed result state to FAILED as well", async () => {
      const client = makeClientStub({
        getAssetDetails: vi.fn().mockResolvedValue({ result: { status: { state: "failed" } } }),
      });
      const adapter = new CloudflareStreamProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerAssetId: "cf-uid-1" });

      expect(result.state).toBe("FAILED");
    });

    it("maps any other status to PROCESSING", async () => {
      const client = makeClientStub({
        getAssetDetails: vi.fn().mockResolvedValue({ result: { status: { state: "inprogress" } } }),
      });
      const adapter = new CloudflareStreamProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerAssetId: "cf-uid-1" });

      expect(result.state).toBe("PROCESSING");
      expect(result.failureReason).toBeNull();
    });

    it("also reads a top-level status field when result.status is absent", async () => {
      const client = makeClientStub({
        getAssetDetails: vi.fn().mockResolvedValue({ status: { state: "ready" } }),
      });
      const adapter = new CloudflareStreamProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerAssetId: "cf-uid-1" });

      expect(result.state).toBe("READY");
    });
  });
});
