import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadHomeContent } from '@/lib/services/home-content.loader';
import { CreatorContentService, VideoContentService } from '@/lib/services/content.service';

vi.mock('@/lib/services/content.service', () => ({
  CreatorContentService: {
    getConfiguredOrDefaultCreator: vi.fn(),
  },
  VideoContentService: {
    getAllVideos: vi.fn(),
    getMainFeaturedVideo: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('home-content.loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads content for the configured creator', async () => {
    const mockCreator = { id: 'c1', videos: [] };
    const mockVideos = [{ id: 'v1' }];

    vi.mocked(CreatorContentService.getConfiguredOrDefaultCreator).mockResolvedValue(mockCreator as any);
    vi.mocked(VideoContentService.getAllVideos).mockResolvedValue(mockVideos as any);
    vi.mocked(VideoContentService.getMainFeaturedVideo).mockResolvedValue(mockVideos[0] as any);

    const result = await loadHomeContent();

    expect(result.status).toBe('ready');
    expect(result.creator).toEqual(mockCreator);
    expect(result.allVideos).toEqual(mockVideos);
    expect(result.mainVideo).toEqual(mockVideos[0]);
  });

  it('handles creator failure gracefully', async () => {
    vi.mocked(CreatorContentService.getConfiguredOrDefaultCreator).mockRejectedValue(new Error('DB FAIL'));
    vi.mocked(VideoContentService.getAllVideos).mockResolvedValue([]);
    vi.mocked(VideoContentService.getMainFeaturedVideo).mockResolvedValue(null);

    const result = await loadHomeContent();

    expect(result.status).toBe('empty');
    expect(result.creator).toBeNull();
  });

  it('fails if video loading fails', async () => {
    vi.mocked(VideoContentService.getAllVideos).mockRejectedValue(new Error('VID FAIL'));

    const result = await loadHomeContent();

    expect(result.status).toBe('error');
    expect(result.error).toBe('GLOBAL_FAILURE');
  });
});
