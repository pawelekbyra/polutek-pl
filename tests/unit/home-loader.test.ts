import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadHomeContent } from '@/lib/services/home-content.loader';
import { ContentService } from '@/lib/services/content.service';
import { VideoStatus, AccessTier } from '@prisma/client';

vi.mock('@/lib/services/content.service', () => ({
  ContentService: {
    getCreatorBySlug: vi.fn(),
    getAllVideos: vi.fn(),
    getMainFeaturedVideo: vi.fn(),
  }
}));

describe('loadHomeContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ready status when content is loaded successfully', async () => {
    const mockVideos = [{ id: '1', title: 'Video 1', status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC }];
    vi.mocked(ContentService.getCreatorBySlug).mockResolvedValue({ id: 'c1', name: 'Polutek', slug: 'polutek', videos: [], subscribersCount: 0 } as any);
    vi.mocked(ContentService.getAllVideos).mockResolvedValue(mockVideos as any);
    vi.mocked(ContentService.getMainFeaturedVideo).mockResolvedValue(mockVideos[0] as any);

    const result = await loadHomeContent();

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.allVideos).toHaveLength(1);
      expect(result.mainVideo?.id).toBe('1');
      expect(result.creator?.slug).toBe('polutek');
    }
  });

  it('returns empty status when no videos are found', async () => {
    vi.mocked(ContentService.getCreatorBySlug).mockResolvedValue({ id: 'c1', name: 'Polutek', slug: 'polutek', videos: [], subscribersCount: 0 } as any);
    vi.mocked(ContentService.getAllVideos).mockResolvedValue([]);
    vi.mocked(ContentService.getMainFeaturedVideo).mockResolvedValue(null);

    const result = await loadHomeContent();

    expect(result.status).toBe('empty');
    if (result.status === 'empty') {
      expect(result.allVideos).toHaveLength(0);
      expect(result.mainVideo).toBeNull();
    }
  });

  it('returns empty status instead of error when a fetch error occurs (resilience)', async () => {
    vi.mocked(ContentService.getAllVideos).mockRejectedValue(new Error('DB Connection Failed'));

    const result = await loadHomeContent();

    // Now resilient: failures return empty state to allow page rendering with fix instructions
    expect(result.status).toBe('empty');
  });

  it('returns ready status even if creator fetch fails (not fatal)', async () => {
    const mockVideos = [{ id: '1', title: 'Video 1', status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC }];
    vi.mocked(ContentService.getCreatorBySlug).mockRejectedValue(new Error('Creator Fetch Failed'));
    vi.mocked(ContentService.getAllVideos).mockResolvedValue(mockVideos as any);
    vi.mocked(ContentService.getMainFeaturedVideo).mockResolvedValue(mockVideos[0] as any);

    const result = await loadHomeContent();

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.creator).toBeNull();
      expect(result.debug?.creatorSuccess).toBe(false);
    }
  });
});
