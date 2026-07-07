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

const activateFirstReadyAssetIfNoneActive = vi.fn().mockResolvedValue({ id: 'route-id' });
vi.mock('@/lib/modules/video/application/video-playback-route.service', () => ({
  VideoPlaybackRouteService: vi.fn().mockImplementation(function (this: any) {
    this.activateFirstReadyAssetIfNoneActive = activateFirstReadyAssetIfNoneActive;
  }),
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
        uid: 'cf-uid-123',
        status: { state: 'processing' as const }
      };

      const result = await handleCloudflareStreamWebhook(payload, ctx);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe('no-change');
      }
      expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
    });

    it('READY metadata refresh is idempotent and allowed', async () => {
      const asset = {
        id: 'asset-1',
        videoId: 'video-1',
        processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
        sizeBytes: 1000
      };
      mockPrisma.videoAsset.findFirst.mockResolvedValue(asset);
      mockPrisma.videoAsset.update.mockResolvedValue({ ...asset, sizeBytes: 2000 });
      mockPrisma.video.update.mockResolvedValue({});

      const payload = {
        uid: 'cf-uid-123',
        status: { state: 'ready' as const },
        size: 2000
      };

      const result = await handleCloudflareStreamWebhook(payload, ctx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ sizeBytes: 2000 })
      }));
    });

    it('READY promotion demotes sibling assets', async () => {
      const asset = {
        id: 'asset-1',
        videoId: 'video-1',
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING
      };
      // Only one findFirst call happens now: findAssetByProviderId. The "is there already a
      // READY primary" check moved into VideoPlaybackRouteService.activateFirstReadyAssetIfNoneActive
      // (mocked above), so no second queued value is consumed here.
      mockPrisma.videoAsset.findFirst.mockResolvedValueOnce(asset);
      mockPrisma.videoAsset.update.mockResolvedValue({ ...asset, processingState: 'READY' });
      mockPrisma.video.update.mockResolvedValue({});

      const payload = {
        uid: 'cf-uid-123',
        status: { state: 'ready' as const }
      };

      await handleCloudflareStreamWebhook(payload, ctx);

      // Primary/sibling demotion now happens inside VideoPlaybackRouteService.activateRoute(),
      // reached via activateFirstReadyAssetIfNoneActive() — the single write path for
      // isPrimary/activePlaybackRouteId — not via a raw updateMany in the webhook handler.
      expect(activateFirstReadyAssetIfNoneActive).toHaveBeenCalledWith(
        { videoId: 'video-1', assetId: 'asset-1', reason: 'cloudflare-sync-ready' },
        ctx,
      );
    });
  });

  describe('syncCloudflareStatus hardening', () => {
    it('confirmed Cloudflare 404 marks asset FAILED', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({
        id: 'video-1',
        asset: {
          id: 'asset-1',
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          providerAssetId: 'cf-uid-123',
          processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING
        }
      });

      const mockClient = {
        getAssetDetails: vi.fn().mockRejectedValue(new CloudflareNotFoundError('cf-uid-123'))
      };
      (CloudflareStreamClient as any).mockImplementation(function() { return mockClient; });

      mockPrisma.videoAsset.findFirst.mockResolvedValue({
          id: 'asset-1', videoId: 'video-1', provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING
      });
      mockPrisma.videoAsset.update.mockResolvedValue({ id: 'asset-1', processingState: 'FAILED' });

      const result = await syncCloudflareStatus('video-1', ctx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            processingState: VIDEO_ASSET_PROCESSING_STATE.FAILED,
            failureReason: expect.stringContaining('404')
        })
      }));
    });

    it('transient API error does not mark asset FAILED', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({
        id: 'video-1',
        asset: {
          id: 'asset-1',
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          providerAssetId: 'cf-uid-123',
          processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING
        }
      });

      const mockClient = {
        getAssetDetails: vi.fn().mockRejectedValue(new Error('Network error'))
      };
      (CloudflareStreamClient as any).mockImplementation(function() { return mockClient; });

      const result = await syncCloudflareStatus('video-1', ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CLOUDFLARE_API_ERROR');
      }
      expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
    });
  });
});
