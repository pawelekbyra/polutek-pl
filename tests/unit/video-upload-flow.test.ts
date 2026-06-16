import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminVideo } from '../../lib/modules/video/application/create-admin-video.use-case';
import { provisionCloudflareUpload } from '../../lib/modules/video/application/provision-cloudflare-upload.use-case';
import { publishAdminVideo } from '../../lib/modules/video/application/publish-admin-video.use-case';
import { handleCloudflareStreamWebhook } from '../../lib/modules/video/application/handle-cloudflare-webhook.use-case';
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
            expect(result.error.code).toBe('VIDEO_NOT_READY_FOR_PUBLICATION');
        }
      });
  });
});
