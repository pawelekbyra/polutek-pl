import { describe, it, expect, vi, beforeEach } from "vitest";
import { importLegacyVideoToCloudflare } from "@/lib/modules/video/application/import-legacy-video-to-cloudflare.use-case";
import { attachCloudflareAsset } from "@/lib/modules/video/application/attach-cloudflare-asset.use-case";
import { handleCloudflareStreamWebhook } from "@/lib/modules/video/application/handle-cloudflare-webhook.use-case";
import { VIDEO_PROVIDER, VIDEO_ASSET_PROCESSING_STATE } from "@/lib/modules/video/domain/video-asset.constants";
import { VideoStatus } from "@prisma/client";

// Mock dependencies
vi.mock("@/lib/modules/channel", () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: "main-channel-id" }),
  },
}));

vi.mock("@/lib/modules/audit", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/modules/video/infrastructure/cloudflare-stream.client", () => {
  return {
    CloudflareStreamClient: vi.fn().mockImplementation(function(this: any) {
      this.importVideoByUrl = vi.fn().mockResolvedValue({ result: { uid: "new-cf-uid" } });
    }),
  };
});

vi.mock("@/lib/modules/video/application/publish-after-asset-ready.use-case", () => ({
  attemptPublishAfterAssetReady: vi.fn().mockResolvedValue(undefined),
}));

const activateFirstReadyAssetIfNoneActive = vi.fn().mockResolvedValue({ id: "route-id" });
vi.mock("@/lib/modules/video/application/video-playback-route.service", () => ({
  VideoPlaybackRouteService: vi.fn().mockImplementation(function (this: any) {
    this.activateFirstReadyAssetIfNoneActive = activateFirstReadyAssetIfNoneActive;
  }),
}));

describe("Cloudflare Lifecycle Hardening", () => {
  let mockPrisma: any;
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      video: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      videoAsset: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
    mockPrisma.videoAsset.findMany.mockResolvedValue([]);
    mockCtx = { prisma: mockPrisma, actor: { type: "admin", userId: "admin-id" } };
  });

  describe("importLegacyVideoToCloudflare", () => {
    it("should propagate publishAfterAssetReady intent", async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: "video-id",
        creatorId: "main-channel-id",
        videoUrl: "https://legacy.url/video.mp4",
        publishAfterAssetReady: false,
      });
      mockPrisma.videoAsset.findFirst.mockResolvedValue(null);

      const result = await importLegacyVideoToCloudflare(
        { videoId: "video-id", publishAfterAssetReady: true },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "video-id" },
        data: expect.objectContaining({ publishAfterAssetReady: true }),
      }));
    });

    it("should fail if Cloudflare UID is already in use by another video", async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: "video-id",
        creatorId: "main-channel-id",
        videoUrl: "https://legacy.url/video.mp4",
      });
      mockPrisma.videoAsset.findFirst.mockResolvedValue({
        id: "other-asset-id",
        videoId: "other-video-id",
        providerAssetId: "new-cf-uid",
      });

      const result = await importLegacyVideoToCloudflare(
        { videoId: "video-id" },
        mockCtx
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CLOUDFLARE_ASSET_IN_USE");
      }
    });
  });

  describe("attachCloudflareAsset", () => {
    it("should be idempotent if same UID is already attached", async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: "video-id",
        creatorId: "main-channel-id",
        publishAfterAssetReady: true,
        asset: {
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          providerAssetId: "existing-uid",
        },
      });

      const result = await attachCloudflareAsset(
        { videoId: "video-id", providerAssetId: "existing-uid" },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(mockPrisma.videoAsset.create).not.toHaveBeenCalled();
    });

    it("should update publish intent during idempotent attach if requested", async () => {
        mockPrisma.video.findFirst.mockResolvedValue({
          id: "video-id",
          creatorId: "main-channel-id",
          publishAfterAssetReady: false,
          asset: {
            provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
            providerAssetId: "existing-uid",
          },
        });

        const result = await attachCloudflareAsset(
          { videoId: "video-id", providerAssetId: "existing-uid", publishAfterAssetReady: true },
          mockCtx
        );

        expect(result.ok).toBe(true);
        expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "video-id" },
            data: expect.objectContaining({ publishAfterAssetReady: true })
        }));
      });

    it("should fail if UID is in use by another video", async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: "video-id",
        creatorId: "main-channel-id",
      });
      mockPrisma.videoAsset.findFirst.mockResolvedValue({
        videoId: "other-video-id",
        providerAssetId: "some-uid",
      });

      const result = await attachCloudflareAsset(
        { videoId: "video-id", providerAssetId: "some-uid" },
        mockCtx
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CLOUDFLARE_ASSET_IN_USE");
      }
    });
  });

  describe("handleCloudflareStreamWebhook", () => {
    it("should set asset as primary and trigger auto-publish on READY", async () => {
      // Only one findFirst call happens now: findAssetByProviderId. The "is there already a
      // READY primary" check moved into VideoPlaybackRouteService.activateFirstReadyAssetIfNoneActive
      // (mocked above).
      mockPrisma.videoAsset.findFirst.mockResolvedValueOnce({
        id: "asset-id",
        videoId: "video-id",
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
      });

      mockPrisma.videoAsset.update.mockResolvedValue({
        id: "asset-id",
        videoId: "video-id",
        processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
      });

      const result = await handleCloudflareStreamWebhook(
        {
          uid: "cf-uid",
          status: { state: "ready" },
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "asset-id" },
        data: expect.objectContaining({
          processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
        }),
      }));

      // Primary promotion now happens via VideoPlaybackRouteService.activateFirstReadyAssetIfNoneActive(),
      // the single write path for isPrimary/activePlaybackRouteId, not inline in the update above.
      expect(activateFirstReadyAssetIfNoneActive).toHaveBeenCalledWith(
        { videoId: "video-id", assetId: "asset-id", reason: "cloudflare-sync-ready" },
        mockCtx,
      );

      const { attemptPublishAfterAssetReady } = await import("@/lib/modules/video/application/publish-after-asset-ready.use-case");
      expect(attemptPublishAfterAssetReady).toHaveBeenCalledWith("video-id", mockCtx, VIDEO_PROVIDER.CLOUDFLARE_STREAM);
    });
  });
});
