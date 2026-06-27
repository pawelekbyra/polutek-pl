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
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
    mockCtx = {
      prisma: mockPrisma,
      actor: { type: "admin", userId: "admin-id" },
    };
  });

  describe("importLegacyVideoToCloudflare", () => {
    it("should propagate publishAfterAssetReady intent", async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: "video-id",
        creatorId: "main-channel-id",
        videoUrl: "https://legacy.url",
        status: VideoStatus.PUBLISHED,
      });
      mockPrisma.videoAsset.findFirst.mockResolvedValue(null);
      mockPrisma.videoAsset.findMany.mockResolvedValue([]);
      mockPrisma.video.findUnique.mockResolvedValue({ id: "video-id", status: VideoStatus.PUBLISHED });

      await importLegacyVideoToCloudflare({
        videoId: "video-id",
        publishAfterAssetReady: true
      }, mockCtx);

      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "video-id" },
        data: expect.objectContaining({ publishAfterAssetReady: true })
      }));
    });
  });

  describe("handleCloudflareStreamWebhook", () => {
    it("should set asset as primary and trigger auto-publish on READY", async () => {
      const asset = {
        id: "asset-id",
        videoId: "video-id",
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
        providerAssetId: "cf-uid",
      };

      mockPrisma.videoAsset.findFirst.mockResolvedValue(asset);
      mockPrisma.videoAsset.findUnique.mockResolvedValue(asset);
      mockPrisma.videoAsset.update.mockResolvedValue({ ...asset, processingState: VIDEO_ASSET_PROCESSING_STATE.READY, isPrimary: true });
      mockPrisma.video.update.mockResolvedValue({});

      const payload: any = {
        uid: "cf-uid",
        status: { state: "ready" },
        duration: 120,
        size: 1024 * 1024
      };

      const result = await handleCloudflareStreamWebhook(payload, mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "asset-id" },
        data: expect.objectContaining({
          processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
        })
      }));
    });
  });
});
