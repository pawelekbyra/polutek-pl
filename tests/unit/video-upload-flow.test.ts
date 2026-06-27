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
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  auditLog: {
    create: vi.fn()
  },
  $transaction: vi.fn((cb) => cb(mockPrisma))
};

const mockCtx: any = {
  prisma: mockPrisma,
  db: {
    read: mockPrisma,
    writeTransaction: vi.fn((cb) => cb(mockPrisma))
  },
  actor: { type: 'admin', userId: 'admin-id' }
};

describe('Video Upload Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAdminVideo', () => {
    it('should create a draft with secure defaults', async () => {
      mockPrisma.video.create.mockResolvedValue({ id: 'video-1' });

      const result = await createAdminVideo({
        title: 'New Video',
        slug: 'new-video',
        tier: 'PUBLIC'
      }, mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          isMainFeatured: false,
          showInSidebar: false
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
        assets: []
      });
      mockPrisma.videoAsset.findFirst.mockResolvedValue(null);
      mockPrisma.videoAsset.findMany.mockResolvedValue([]);
      mockPrisma.videoAsset.create.mockResolvedValue({ id: 'asset-id', providerAssetId: 'cf-uid-123' });

      const result = await provisionCloudflareUpload({ videoId: 'draft-id' }, mockCtx);

      expect(result.ok).toBe(true);
      if (result.ok) {
          expect(result.data.providerAssetId).toBe('cf-uid-123');
      }
    });
  });

  describe('handleCloudflareStreamWebhook', () => {
    it('should update asset to READY and make it primary', async () => {
      mockPrisma.videoAsset.findFirst.mockResolvedValueOnce({
        id: 'asset-id',
        videoId: 'video-id',
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING
      }).mockResolvedValueOnce(null); // for existingReadyPrimary check

      mockPrisma.videoAsset.findUnique.mockResolvedValue({ id: 'asset-id' });
      mockPrisma.videoAsset.update.mockResolvedValue({ id: 'asset-id', processingState: 'READY', isPrimary: true });

      const result = await handleCloudflareStreamWebhook({
        uid: 'cf-uid-123',
        status: { state: 'ready' }
      }, mockCtx);

      expect(result.ok).toBe(true);
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
        title: 'Title',
        slug: 'slug',
        tier: 'PUBLIC',
        status: 'DRAFT',
        creatorId: 'main-channel-id',
        asset: { id: 'asset-id', processingState: 'READY', isPrimary: true, provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, providerAssetId: 'uid' },
        assets: [
          { id: 'asset-id', processingState: 'READY', isPrimary: true, provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, providerAssetId: 'uid' }
        ]
      });
      mockPrisma.video.update.mockResolvedValue({ id: 'video-id', status: 'PUBLISHED' });

      const result = await publishAdminVideo('video-id', mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'video-id' },
          data: expect.objectContaining({ status: 'PUBLISHED' })
      }));
    });
  });
});
