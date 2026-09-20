import { describe, expect, it, vi } from "vitest";
import { StorageProvider } from "@prisma/client";
import { MuxProviderAdapter } from "@/lib/modules/video/infrastructure/mux.provider";
import { MuxClient } from "@/lib/modules/video/infrastructure/mux.client";

function makeClientStub(overrides: Partial<MuxClient> = {}): MuxClient {
  return {
    createAssetFromUrl: vi.fn(),
    getAsset: vi.fn(),
    getUpload: vi.fn(),
    ...overrides,
  } as unknown as MuxClient;
}

describe("MuxProviderAdapter", () => {
  it("carries the MUX provider identity", () => {
    const adapter = new MuxProviderAdapter(makeClientStub());
    expect(adapter.provider).toBe(StorageProvider.MUX);
  });

  describe("isConfigured", () => {
    it("delegates to MuxClient.isConfigured", () => {
      const spy = vi.spyOn(MuxClient, "isConfigured").mockReturnValue(true);
      const adapter = new MuxProviderAdapter(makeClientStub());

      expect(adapter.isConfigured()).toBe(true);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("createAssetFromOriginal", () => {
    it("prefers a signed playback id over a public one", async () => {
      const client = makeClientStub({
        createAssetFromUrl: vi.fn().mockResolvedValue({
          id: "asset-1",
          status: "preparing",
          playback_ids: [
            { id: "public-1", policy: "public" },
            { id: "signed-1", policy: "signed" },
          ],
        }),
      });
      const adapter = new MuxProviderAdapter(client);

      const result = await adapter.createAssetFromOriginal({
        videoId: "video-1",
        originalId: "original-1",
        sourceUrl: "https://example.com/video.mp4",
      });

      expect(result).toEqual({
        providerAssetId: "asset-1",
        providerPlaybackId: "signed-1",
        initialState: "PROCESSING",
        raw: expect.objectContaining({ id: "asset-1" }),
      });
    });

    it("falls back to a public playback id when no signed one exists", async () => {
      const client = makeClientStub({
        createAssetFromUrl: vi.fn().mockResolvedValue({
          id: "asset-1",
          status: "ready",
          playback_ids: [{ id: "public-1", policy: "public" }],
        }),
      });
      const adapter = new MuxProviderAdapter(client);

      const result = await adapter.createAssetFromOriginal({
        videoId: "video-1",
        originalId: "original-1",
        sourceUrl: "https://example.com/video.mp4",
      });

      expect(result.providerPlaybackId).toBe("public-1");
      expect(result.initialState).toBe("READY");
    });

    it("returns a null playback id when the asset has none yet", async () => {
      const client = makeClientStub({
        createAssetFromUrl: vi.fn().mockResolvedValue({ id: "asset-1", status: "preparing" }),
      });
      const adapter = new MuxProviderAdapter(client);

      const result = await adapter.createAssetFromOriginal({
        videoId: "video-1",
        originalId: "original-1",
        sourceUrl: "https://example.com/video.mp4",
      });

      expect(result.providerPlaybackId).toBeNull();
    });

    it("redacts a presigned source URL from a thrown error message", async () => {
      const client = makeClientStub({
        createAssetFromUrl: vi
          .fn()
          .mockRejectedValue(
            new Error(
              "Mux rejected https://r2.example.com/video.mp4?X-Amz-Signature=super-secret&X-Amz-Date=today",
            ),
          ),
      });
      const adapter = new MuxProviderAdapter(client);

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
    it("returns PENDING when neither providerAssetId nor providerUploadId is given", async () => {
      const client = makeClientStub();
      const adapter = new MuxProviderAdapter(client);

      const result = await adapter.getAssetStatus({});

      expect(result).toEqual({ state: "PENDING", providerUploadId: null });
      expect(client.getAsset).not.toHaveBeenCalled();
      expect(client.getUpload).not.toHaveBeenCalled();
    });

    it("resolves the asset id from the upload when only providerUploadId is given", async () => {
      const client = makeClientStub({
        getUpload: vi.fn().mockResolvedValue({ id: "upload-1", status: "asset_created", asset_id: "asset-1" }),
        getAsset: vi.fn().mockResolvedValue({ id: "asset-1", status: "ready", duration: 42 }),
      });
      const adapter = new MuxProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerUploadId: "upload-1" });

      expect(client.getUpload).toHaveBeenCalledWith("upload-1");
      expect(client.getAsset).toHaveBeenCalledWith("asset-1");
      expect(result.state).toBe("READY");
      expect(result.providerUploadId).toBe("upload-1");
      expect(result.durationSeconds).toBe(42);
    });

    it("returns PENDING with the upload id when the upload has no asset yet", async () => {
      const client = makeClientStub({
        getUpload: vi.fn().mockResolvedValue({ id: "upload-1", status: "waiting" }),
      });
      const adapter = new MuxProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerUploadId: "upload-1" });

      expect(result).toEqual({ state: "PENDING", providerUploadId: "upload-1" });
      expect(client.getAsset).not.toHaveBeenCalled();
    });

    it("maps an errored asset to FAILED with a joined failure reason", async () => {
      const client = makeClientStub({
        getAsset: vi.fn().mockResolvedValue({
          id: "asset-1",
          status: "errored",
          errors: { type: "invalid_input", messages: ["bad codec", "bad container"] },
        }),
      });
      const adapter = new MuxProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerAssetId: "asset-1" });

      expect(result.state).toBe("FAILED");
      expect(result.failureReason).toBe("bad codec; bad container");
    });

    it("maps any other status to PROCESSING", async () => {
      const client = makeClientStub({
        getAsset: vi.fn().mockResolvedValue({ id: "asset-1", status: "preparing" }),
      });
      const adapter = new MuxProviderAdapter(client);

      const result = await adapter.getAssetStatus({ providerAssetId: "asset-1" });

      expect(result.state).toBe("PROCESSING");
      expect(result.failureReason).toBeNull();
    });
  });
});
