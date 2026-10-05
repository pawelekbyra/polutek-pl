import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminVideo } from '../../lib/modules/video/application/create-admin-video.use-case';
import { publishAdminVideo } from '../../lib/modules/video/application/publish-admin-video.use-case';
import { AccessTier, VideoStatus } from '@prisma/client';

// Admin video flow after the move to own HLS only (CLAUDE.md 4.17): a draft is created without
// any source, the encode worker later creates the SELF_HLS asset + route, and publication is
// gated on that route. Legacy provider routes can never publish.

vi.mock('../../lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: 'main-channel-id' })
  }
}));

vi.mock('../../lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({}),
  recordAuditEventSafe: vi.fn().mockResolvedValue(undefined)
}));

const mockPrisma: any = {
  video: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  videoAsset: {
    findMany: vi.fn(),
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

const ownHlsAsset = (processingState: string) => ({
  isPrimary: true,
  provider: 'SELF_HLS',
  processingState,
  objectKey: 'videos/video-id/v/v1',
});

describe('Video admin flow (own HLS only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.videoAsset.findMany?.mockResolvedValue([]);
  });

  describe('createAdminVideo', () => {
    it('should create a draft with secure defaults and no video source', async () => {
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
      const data = mockPrisma.video.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ status: 'DRAFT', showInSidebar: false, isMainFeatured: false, publishedAt: null });
      expect('videoUrl' in data).toBe(false);
    });

    it('ignores a videoUrl in the input: external video URLs are not accepted any more', async () => {
      mockPrisma.video.create.mockResolvedValue({ id: 'v', title: 'T', slug: 's', status: 'DRAFT', creatorId: 'main-channel-id' });

      await createAdminVideo({
        title: 'T',
        slug: 's',
        thumbnailUrl: 'https://thumb.com',
        tier: AccessTier.PUBLIC,
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      } as never, mockCtx);

      const data = mockPrisma.video.create.mock.calls[0][0].data;
      expect(JSON.stringify(data)).not.toContain('youtube');
    });
  });

  describe('publishAdminVideo', () => {
    it('should publish if the own-HLS route asset is READY', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id',
        title: 'Ready Video',
        slug: 'ready-video',
        tier: AccessTier.PUBLIC,
        asset: ownHlsAsset('READY'),
        activePlaybackRoute: { asset: ownHlsAsset('READY') }
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
        asset: ownHlsAsset('READY'),
        activePlaybackRoute: { asset: ownHlsAsset('READY') }
      });
      mockPrisma.video.update.mockResolvedValue({ id: 'video-id', status: 'PUBLISHED', publishedAt: firstPublishedAt });

      const result = await publishAdminVideo('video-id', mockCtx);

      expect(result.ok).toBe(true);
      expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ publishedAt: firstPublishedAt })
      }));
    });

    it('should fail while the asset is still encoding', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id',
        title: 'Not Ready',
        slug: 'not-ready',
        tier: AccessTier.PUBLIC,
        asset: ownHlsAsset('PROCESSING'),
        activePlaybackRoute: { asset: ownHlsAsset('PROCESSING') }
      });

      const result = await publishAdminVideo('video-id', mockCtx);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VIDEO_PUBLICATION_ASSET_NOT_READY');
      expect(mockPrisma.video.update).not.toHaveBeenCalled();
    });

    it('should fail without an active route', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id', title: 'No route', slug: 'no-route', tier: AccessTier.PUBLIC,
        asset: ownHlsAsset('READY'),
        activePlaybackRoute: null
      });

      const result = await publishAdminVideo('video-id', mockCtx);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE');
    });

    it.each(['CLOUDFLARE_STREAM', 'MUX', 'YOUTUBE', 'VIMEO', 'S3'])('should fail when the active route still points at a legacy %s asset', async (provider) => {
      const legacy = { isPrimary: true, provider, processingState: 'READY', objectKey: 'k' };
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'video-id', title: 'Bad Provider', slug: 'bad-provider', tier: AccessTier.PUBLIC,
        asset: legacy,
        activePlaybackRoute: { asset: legacy }
      });

      const result = await publishAdminVideo('video-id', mockCtx);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VIDEO_PUBLICATION_NON_PLAYABLE_PROVIDER');
    });
  });
});
