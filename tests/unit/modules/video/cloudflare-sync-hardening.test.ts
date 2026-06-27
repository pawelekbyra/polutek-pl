import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCloudflareStreamWebhook } from '@/lib/modules/video/application/handle-cloudflare-webhook.use-case';
import { syncCloudflareStatus } from '@/lib/modules/video/application/sync-cloudflare-status.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from '@/lib/modules/video/domain/video-asset.constants';
import { CloudflareStreamClient } from '@/lib/modules/video/infrastructure/cloudflare-stream.client';
import { CloudflareNotFoundError } from '@/lib/modules/video/domain/video.errors';

vi.mock('@/lib/modules/video/infrastructure/cloudflare-stream.client');
vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({})
}));
vi.mock('@/lib/modules/video/application/publish-after-asset-ready.use-case', () => ({
  attemptPublishAfterAssetReady: vi.fn().mockResolvedValue({})
}));

describe('Cloudflare Sync Hardening', () => {
  const mockPrisma: any = {
    videoAsset: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    video: {
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  };

  const ctx = {
    prisma: mockPrisma,
    actor: { type: 'system', reason: 'Cloudflare Stream Webhook' },
  } as unknown as AppContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleCloudflareStreamWebhook hardening', () => {
    it('delayed processing webhook after READY does not regress the asset', async () => {
      const asset = {
        id: 'asset-1',
        videoId: 'video-1',
        processingState: VIDEO_ASSET_PROCESSING_STATE.READY
      };
      mockPrisma.videoAsset.findFirst.mockResolvedValue(asset);

      const payload = {
        uid: 'cf-uid-1',
        status: { state: 'processing' }
      };

      const result = await handleCloudflareStreamWebhook(payload as any, ctx);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.status).toBe('no-change');
      expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
    });

    it('READY metadata refresh is idempotent and allowed', async () => {
      const asset = {
        id: 'asset-1',
        videoId: 'video-1',
        processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
        isPrimary: true
      };
      mockPrisma.videoAsset.findFirst.mockResolvedValue(asset);
      mockPrisma.videoAsset.findUnique.mockResolvedValue(asset);
      mockPrisma.videoAsset.update.mockResolvedValue({ ...asset, sizeBytes: 5000 });

      const payload = {
        uid: 'cf-uid-1',
        status: { state: 'ready' },
        size: 5000
      };

      const result = await handleCloudflareStreamWebhook(payload as any, ctx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ sizeBytes: 5000 })
      }));
    });

    it('READY promotion demotes sibling assets', async () => {
      const asset = {
        id: 'asset-1',
        videoId: 'video-1',
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
        isPrimary: false
      };
      mockPrisma.videoAsset.findFirst
        .mockResolvedValueOnce(asset) // For repository.findAssetByProviderId
        .mockResolvedValueOnce(null); // For tx.videoAsset.findFirst (existingReadyPrimary)

      mockPrisma.videoAsset.findUnique.mockResolvedValue(asset);
      mockPrisma.videoAsset.update.mockResolvedValue({ ...asset, processingState: VIDEO_ASSET_PROCESSING_STATE.READY, isPrimary: true });

      const payload = {
        uid: 'cf-uid-1',
        status: { state: 'ready' }
      };

      await handleCloudflareStreamWebhook(payload as any, ctx);

      expect(mockPrisma.videoAsset.updateMany).toHaveBeenCalledWith({
        where: { videoId: 'video-1', id: { not: 'asset-1' } },
        data: { isPrimary: false }
      });
    });
  });

  describe('syncCloudflareStatus hardening', () => {
    it('confirmed Cloudflare 404 marks asset FAILED', async () => {
      const asset = {
        id: 'asset-1',
        videoId: 'video-1',
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: 'cf-uid-1'
      };

      mockPrisma.video.findUnique.mockResolvedValue({
        id: 'video-1',
        asset: asset
      });

      const mockGetAssetDetails = vi.fn().mockRejectedValue(new CloudflareNotFoundError('cf-uid-1'));
      (CloudflareStreamClient as any).mockImplementation(function(this: any) {
        this.getAssetDetails = mockGetAssetDetails;
      });

      // handleCloudflareStreamWebhook mocks
      mockPrisma.videoAsset.findFirst.mockResolvedValue(asset);
      mockPrisma.videoAsset.findUnique.mockResolvedValue(asset);
      mockPrisma.videoAsset.update.mockResolvedValue({ ...asset, processingState: VIDEO_ASSET_PROCESSING_STATE.FAILED });

      await syncCloudflareStatus('video-1', ctx);

      expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'asset-1' },
        data: expect.objectContaining({ processingState: VIDEO_ASSET_PROCESSING_STATE.FAILED })
      }));
    });

    it('transient API error does not mark asset FAILED', async () => {
      const asset = {
        id: 'asset-1',
        videoId: 'video-1',
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: 'cf-uid-1'
      };

      mockPrisma.video.findUnique.mockResolvedValue({
        id: 'video-1',
        asset: asset
      });

      const mockGetAssetDetails = vi.fn().mockRejectedValue(new Error('Network error'));
      (CloudflareStreamClient as any).mockImplementation(function(this: any) {
        this.getAssetDetails = mockGetAssetDetails;
      });

      const result = await syncCloudflareStatus('video-1', ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('CLOUDFLARE_API_ERROR');
      expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
    });
  });
});
