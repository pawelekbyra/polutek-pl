import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminVideoDiagnostics } from '@/lib/modules/video/application/get-admin-video-diagnostics.use-case';
import { getAdminVideoDetails } from '@/lib/modules/video/application/get-admin-video-details.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { VideoStatus, AccessTier } from '@prisma/client';
import { MainChannelService } from '@/lib/modules/channel';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

describe('Admin Video Details & Diagnostics', () => {
  let mockPrisma: any;
  const mainChannel = { id: 'main-channel-id', slug: 'main' };

  beforeEach(() => {
    mockPrisma = {
      video: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
      },
    };
    (MainChannelService.getRequired as any).mockResolvedValue(mainChannel);
  });

  describe('getAdminVideoDiagnostics', () => {
    it('returns issues for incomplete video', async () => {
      const video = {
        id: 'v1',
        title: '',
        slug: '',
        status: VideoStatus.DRAFT,
        tier: AccessTier.PUBLIC,
      };
      mockPrisma.video.findUnique.mockResolvedValue(video);
      mockPrisma.video.count.mockResolvedValue(0);

      const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
      const result = await getAdminVideoDiagnostics({ videoId: 'v1' }, ctx);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.some(i => i.field === 'title')).toBe(true);
        expect(result.data.some(i => i.field === 'slug')).toBe(true);
      }
    });

    it('returns error for duplicate slug', async () => {
        const video = {
          id: 'v1',
          title: 'Title',
          slug: 'duplicate',
          status: VideoStatus.DRAFT,
          tier: AccessTier.PUBLIC,
        };
        mockPrisma.video.findUnique.mockResolvedValue(video);
        mockPrisma.video.count.mockResolvedValue(1); // Duplicate found

        const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
        const result = await getAdminVideoDiagnostics({ videoId: 'v1' }, ctx);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.some(i => i.message.includes('Slug jest już używany'))).toBe(true);
        }
      });
  });

  describe('getAdminVideoDetails', () => {
    it('consolidates video, diagnostics and audit logs', async () => {
        const video = {
            id: 'v1',
            slug: 'v1-slug',
            title: 'Video',
            creatorId: mainChannel.id,
            videoUrl: 'https://example.com/video.mp4',
            status: 'PUBLISHED',
            tier: 'PUBLIC',
            views: 0,
            likesCount: 0,
            dislikesCount: 0,
            publishedAt: new Date(),
            isMainFeatured: false,
            showInSidebar: true,
            sidebarOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { comments: 5 }
          };
          mockPrisma.video.findFirst.mockResolvedValue(video); // for getAdminVideoById
          mockPrisma.video.findUnique.mockResolvedValue(video); // for diagnostics
          mockPrisma.video.count.mockResolvedValue(0);
          mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }]);

          const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
          const result = await getAdminVideoDetails({ idOrSlug: 'v1' }, ctx);

          expect(result.ok).toBe(true);
          if (result.ok) {
              expect(result.data.id).toBe('v1');
              expect(result.data.diagnostics).toBeDefined();
              expect(result.data.auditLogs).toHaveLength(1);
          }
    });
  });
});
