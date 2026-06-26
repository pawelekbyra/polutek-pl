import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminVideo } from '../../lib/modules/video/application/create-admin-video.use-case';
import { provisionCloudflareUpload } from '../../lib/modules/video/application/provision-cloudflare-upload.use-case';
import { publishAdminVideo } from '../../lib/modules/video/application/publish-admin-video.use-case';
import { handleCloudflareStreamWebhook } from '../../lib/modules/video/application/handle-cloudflare-webhook.use-case';
import { attachCloudflareAsset } from '../../lib/modules/video/application/attach-cloudflare-asset.use-case';
import { syncCloudflareStatus } from '../../lib/modules/video/application/sync-cloudflare-status.use-case';
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from '../../lib/modules/video/domain/video-asset.constants';
import { AccessTier, VideoStatus } from '@prisma/client';

// Mocking dependencies
vi.mock('../../lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: 'main-channel-id' })
  }
}));

vi.mock('../../lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({})
}));

vi.mock('../../lib/modules/video/infrastructure/cloudflare-stream.client', () => {
  return {
    CloudflareStreamClient: vi.fn().mockImplementation(function() {
      return {
        createDirectUploadUrl: vi.fn().mockResolvedValue({
          result: { uid: 'cf-uid-123', uploadURL: 'https://upload.cloudflare.com/123' }
        }),
        getAssetDetails: vi.fn().mockResolvedValue({
            success: true,
            result: {
                uid: 'cf-uid-123',
                status: { state: 'ready' }
            }
        })
      };
    })
  };
});

const mockPrisma: any = {
  video: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  videoAsset: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  $transaction: vi.fn((cb) => cb(mockPrisma))
};

const mockCtx: any = {
  prisma: mockPrisma,
  db: { writeTransaction: vi.fn((cb) => cb(mockPrisma)) },
  actor: { type: 'admin', userId: 'admin-id' }
};

describe('Video Upload Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAdminVideo', () => {
    it('should create a draft with secure defaults', async () => {
      mockPrisma.video.create.mockResolvedValue({
        id: 'new-video-id',
        title: 'Test Video',
        slug: 'test-video',
        status: 'DRAFT',
        showInSidebar: false,
        isMainFeatured: false,
        publishedAt: null,
        creatorId: 'main-channel-id'
      });

      const result = await createAdminVideo({
        title: 'Test Video',
        slug: 'test-video',
        thumbnailUrl: 'https://thumb.com',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED // Should be overridden
      }, mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          showInSidebar: false,
          isMainFeatured: false,
          publishedAt: null
        })
      }));
    });
  });

  describe('provisionCloudflareUpload', () => {
    it('should provision upload for DRAFT video', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'draft-id',
        status: 'DRAFT',
        creatorId: 'main-channel-id',
        asset: null
      });
      mockPrisma.videoAsset.findUnique.mockResolvedValue(null);
      mockPrisma.videoAsset.create.mockResolvedValue({ id: 'asset-id' });

      const result = await provisionCloudflareUpload({ videoId: 'draft-id' }, mockCtx);

      expect(result.ok).toBe(true);
      if (result.ok) {
          expect(result.data.providerAssetId).toBe('cf-uid-123');
      }
    });

    it('create with upload and publish intent stores pending publish', async () => {
      mockPrisma.video.create.mockResolvedValue({
        id: 'new-video-id', title: 'Test Video', slug: 'test-video', status: 'DRAFT',
        publishAfterAssetReady: true, publishAfterAssetReadyRequestedAt: new Date(), publishAfterAssetReadyError: null,
        creatorId: 'main-channel-id'
      });

      const result = await createAdminVideo({
        title: 'Test Video', slug: 'test-video', thumbnailUrl: 'https://thumb.com',
        tier: AccessTier.PUBLIC, publishAfterAssetReady: true,
      }, mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          publishAfterAssetReady: true,
          publishAfterAssetReadyRequestedAt: expect.any(Date),
        })
      }));
    });

    it('should fail if video is already PUBLISHED', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'pub-id',
        status: 'PUBLISHED',
        creatorId: 'main-channel-id'
      });

      const result = await provisionCloudflareUpload({ videoId: 'pub-id' }, mockCtx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
          expect(result.error.code).toBe('VIDEO_NOT_DRAFT');
      }
    });
  });

  describe('handleCloudflareStreamWebhook', () => {
    it('should update asset to READY and make it primary', async () => {
      mockPrisma.videoAsset.findFirst.mockResolvedValue({
        id: 'asset-id',
        videoId: 'video-id',
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING
      });
      mockPrisma.videoAsset.update.mockResolvedValue({ id: 'asset-id', processingState: 'READY' });

      const result = await handleCloudflareStreamWebhook({
        uid: 'cf-uid-123',
        status: { state: 'ready' }
      }, mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.videoAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({ videoId: 'video-id', id: { not: 'asset-id' } }),
          data: { isPrimary: false }
      }));
      expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'asset-id' },
          data: expect.objectContaining({ isPrimary: true, processingState: 'READY' })
      }));
    });

    it('publishes video with pending publish intent when Cloudflare webhook reaches READY', async () => {
      mockPrisma.videoAsset.findFirst.mockResolvedValue({
        id: 'asset-id', videoId: 'video-id', provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING
      });
      mockPrisma.videoAsset.update.mockResolvedValue({ id: 'asset-id', videoId: 'video-id', processingState: 'READY' });
      mockPrisma.video.findUnique.mockResolvedValue({ id: 'video-id', status: 'DRAFT', publishAfterAssetReady: true, publishAfterAssetReadyCompletedAt: null });
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id', title: 'Ready', slug: 'ready', tier: AccessTier.PUBLIC, status: 'DRAFT',
        publishAfterAssetReady: true, asset: { isPrimary: true, provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.READY, providerAssetId: 'cf-uid-123' }
      });
      mockPrisma.video.update.mockResolvedValue({ id: 'video-id', status: 'PUBLISHED' });

      const result = await handleCloudflareStreamWebhook({ uid: 'cf-uid-123', status: { state: 'ready' } }, mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'video-id' },
        data: expect.objectContaining({ status: 'PUBLISHED', publishAfterAssetReady: false })
      }));
    });

    it('webhook READY is idempotent for repeated calls', async () => {
      mockPrisma.videoAsset.findFirst.mockResolvedValue({ id: 'asset-id', videoId: 'video-id', processingState: VIDEO_ASSET_PROCESSING_STATE.READY });
      mockPrisma.video.findUnique.mockResolvedValue({ id: 'video-id', status: 'PUBLISHED', publishAfterAssetReady: false, publishAfterAssetReadyCompletedAt: new Date() });

      const result = await handleCloudflareStreamWebhook({ uid: 'cf-uid-123', status: { state: 'ready' } }, mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
    });
  });

  describe('existing Cloudflare asset pending publish', () => {
    it('non-READY existing asset leaves pending publish and later READY sync publishes', async () => {
      mockPrisma.video.findFirst.mockResolvedValueOnce({
        id: 'video-id', status: 'DRAFT', creatorId: 'main-channel-id', asset: null, publishAfterAssetReady: false, publishAfterAssetReadyRequestedAt: null
      }).mockResolvedValueOnce({ id: 'video-id', status: 'DRAFT', creatorId: 'main-channel-id', asset: { id: 'asset-id' }, publishAfterAssetReady: true });
      mockPrisma.videoAsset.findUnique.mockResolvedValue(null);
      mockPrisma.videoAsset.create.mockResolvedValue({ id: 'asset-id' });
      mockPrisma.video.findUnique.mockResolvedValueOnce({ id: 'video-id', asset: { provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, providerAssetId: 'cf-uid-123' } });

      const attachResult = await attachCloudflareAsset({ videoId: 'video-id', providerAssetId: 'cf-uid-123', publishAfterAssetReady: true }, mockCtx);

      expect(attachResult.ok).toBe(true);
      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'video-id' },
        data: expect.objectContaining({ publishAfterAssetReady: true })
      }));

      mockPrisma.videoAsset.findFirst.mockResolvedValue({ id: 'asset-id', videoId: 'video-id', processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING });
      mockPrisma.videoAsset.update.mockResolvedValue({ id: 'asset-id', videoId: 'video-id', processingState: VIDEO_ASSET_PROCESSING_STATE.READY });
      mockPrisma.video.findUnique.mockResolvedValue({ id: 'video-id', status: 'DRAFT', publishAfterAssetReady: true, publishAfterAssetReadyCompletedAt: null });
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id', title: 'Ready', slug: 'ready', tier: AccessTier.PUBLIC, status: 'DRAFT', publishAfterAssetReady: true,
        asset: { isPrimary: true, provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.READY, providerAssetId: 'cf-uid-123' }
      });
      mockPrisma.video.update.mockClear();
      mockPrisma.video.update.mockResolvedValue({ id: 'video-id', status: 'PUBLISHED' });

      const syncResult = await syncCloudflareStatus('video-id', mockCtx);

      expect(syncResult.ok).toBe(true);
      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PUBLISHED' })
      }));
    });
  });

  describe('publishAdminVideo', () => {
    it('should publish if primary asset is READY', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id',
        title: 'Ready Video',
        slug: 'ready-video',
        tier: AccessTier.PUBLIC,
        asset: {
          isPrimary: true,
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
          providerAssetId: 'uid'
        }
      });
      mockPrisma.video.update.mockResolvedValue({ id: 'video-id', status: 'PUBLISHED' });

      const result = await publishAdminVideo('video-id', mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'video-id' },
          data: expect.objectContaining({ status: 'PUBLISHED' })
      }));
    });

    it('preserves first publishedAt across republish', async () => {
      const firstPublishedAt = new Date('2026-06-01T10:00:00.000Z');
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id', title: 'Republish', slug: 'republish', tier: AccessTier.PUBLIC, status: VideoStatus.DRAFT, publishedAt: firstPublishedAt,
        asset: { isPrimary: true, provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.READY, providerAssetId: 'uid' }
      });
      mockPrisma.video.update.mockResolvedValue({ id: 'video-id', status: 'PUBLISHED', publishedAt: firstPublishedAt });

      const result = await publishAdminVideo('video-id', mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ publishedAt: firstPublishedAt })
      }));
    });

    it('should fail if asset is not READY', async () => {
        mockPrisma.video.findFirst.mockResolvedValue({
          id: 'video-id',
          title: 'Not Ready',
          slug: 'not-ready',
          tier: AccessTier.PUBLIC,
          asset: {
            isPrimary: true,
            provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
            processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
            providerAssetId: 'uid'
          }
        });

        const result = await publishAdminVideo('video-id', mockCtx);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('VIDEO_PUBLICATION_ASSET_NOT_READY');
        }
      });

    it('should fail if primary asset is not Cloudflare READY', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id', title: 'Bad Provider', slug: 'bad-provider', tier: AccessTier.PUBLIC,
        asset: { isPrimary: true, provider: VIDEO_PROVIDER.S3, processingState: VIDEO_ASSET_PROCESSING_STATE.READY, providerAssetId: 'uid' }
      });

      const result = await publishAdminVideo('video-id', mockCtx);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VIDEO_PUBLICATION_NON_CLOUDFLARE_ASSET');
    });
  });
});
