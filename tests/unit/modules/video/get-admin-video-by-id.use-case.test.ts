import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminVideoById } from '@/lib/modules/video/application/get-admin-video-by-id.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { VideoNotFoundError } from '@/lib/modules/video/domain/video.errors';
import { MainChannelService } from '@/lib/modules/channel';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

describe('getAdminVideoById Use Case', () => {
  let mockPrisma: any;
  const mainChannel = { id: 'main-channel-id', slug: 'main' };

  beforeEach(() => {
    mockPrisma = {
      video: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    (MainChannelService.getRequired as any).mockResolvedValue(mainChannel);
  });

  it('returns AdminVideoDto for video on main channel', async () => {
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
    mockPrisma.video.findFirst.mockResolvedValue(video);

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await getAdminVideoById({ idOrSlug: 'v1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('v1');
      expect(result.data.videoUrl).toBe(video.videoUrl);
      expect(result.data.commentsCount).toBe(5);
    }
  });

  it('returns fail(VideoNotFoundError) when video belongs to another creator', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(null);

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await getAdminVideoById({ idOrSlug: 'v1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(VideoNotFoundError);
    }
  });
});
