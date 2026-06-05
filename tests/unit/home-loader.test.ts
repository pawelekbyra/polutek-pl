import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadHomeContent } from '@/lib/services/home-content.loader';
import { ContentService } from '@/lib/services/content.service';
import { VideoStatus, AccessTier } from '@prisma/client';

const mockFeatureFlags = vi.hoisted(() => ({
  flags: {
    demoFallbacks: false,
    multiCreator: false,
    mainCreatorSlug: 'main-channel',
  },
}));

vi.mock('@/lib/feature-flags', () => mockFeatureFlags);

vi.mock('@/lib/services/content.service', () => ({
  ContentService: {
    getCreatorBySlug: vi.fn(),
    getConfiguredOrDefaultCreator: vi.fn(),
    getAllVideos: vi.fn(),
    getMainFeaturedVideo: vi.fn(),
  }
}));

describe('loadHomeContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.flags.demoFallbacks = false;
    mockFeatureFlags.flags.multiCreator = false;
    mockFeatureFlags.flags.mainCreatorSlug = 'main-channel';
  });

  it('returns ready status with videos scoped to the main creator in single-creator mode', async () => {
    const mockVideos = [{ id: '1', title: 'Video 1', status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC, isMainFeatured: true }];
    vi.mocked(ContentService.getConfiguredOrDefaultCreator).mockResolvedValue({ id: 'c1', name: 'Main Channel', slug: 'main-channel', videos: mockVideos, subscribersCount: 0 } as any);

    const result = await loadHomeContent();

    expect(ContentService.getConfiguredOrDefaultCreator).toHaveBeenCalled();
    expect(ContentService.getAllVideos).not.toHaveBeenCalled();
    expect(ContentService.getMainFeaturedVideo).not.toHaveBeenCalled();
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.allVideos).toHaveLength(1);
      expect(result.mainVideo?.id).toBe('1');
      expect(result.creator?.slug).toBe('main-channel');
    }
  });

  it('falls back to the first creator video as main video in single-creator mode when none is featured', async () => {
    const mockVideos = [
      { id: 'first', title: 'First Video', status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC, isMainFeatured: false },
      { id: 'second', title: 'Second Video', status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC, isMainFeatured: false },
    ];
    vi.mocked(ContentService.getConfiguredOrDefaultCreator).mockResolvedValue({ id: 'c1', name: 'Main Channel', slug: 'main-channel', videos: mockVideos, subscribersCount: 0 } as any);

    const result = await loadHomeContent();

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.mainVideo?.id).toBe('first');
    }
  });



  it('falls back to the default approved creator when MAIN_CREATOR_SLUG is not configured', async () => {
    mockFeatureFlags.flags.mainCreatorSlug = '';
    const mockVideos = [
      { id: 'db-video', title: 'DB Video', status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC, isMainFeatured: true },
    ];
    vi.mocked(ContentService.getConfiguredOrDefaultCreator).mockResolvedValue({
      id: 'primary-creator',
      name: 'Configured in DB',
      slug: 'db-creator',
      videos: mockVideos,
      subscribersCount: 0,
    } as any);

    const result = await loadHomeContent();

    expect(ContentService.getConfiguredOrDefaultCreator).toHaveBeenCalled();
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.creator?.slug).toBe('db-creator');
      expect(result.mainVideo?.id).toBe('db-video');
      expect(result.allVideos).toHaveLength(1);
    }
  });

  it('returns empty status when the main creator has no videos in single-creator mode', async () => {
    vi.mocked(ContentService.getConfiguredOrDefaultCreator).mockResolvedValue({ id: 'c1', name: 'Main Channel', slug: 'main-channel', videos: [], subscribersCount: 0 } as any);

    const result = await loadHomeContent();

    expect(result.status).toBe('empty');
    if (result.status === 'empty') {
      expect(result.allVideos).toHaveLength(0);
      expect(result.mainVideo).toBeNull();
    }
  });

  it('returns error status when a fatal global fetch error occurs in multi-creator mode', async () => {
    mockFeatureFlags.flags.multiCreator = true;
    vi.mocked(ContentService.getConfiguredOrDefaultCreator).mockResolvedValue(null);
    vi.mocked(ContentService.getAllVideos).mockRejectedValue(new Error('DB Connection Failed'));

    const result = await loadHomeContent();

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.publicMessage).toContain('Nie udało się wczytać materiałów');
      expect(result.debug?.stage).toBe('loading_all_videos');
    }
  });

  it('returns ready status in multi-creator mode even if creator fetch fails', async () => {
    mockFeatureFlags.flags.multiCreator = true;
    const mockVideos = [{ id: '1', title: 'Video 1', status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC }];
    vi.mocked(ContentService.getConfiguredOrDefaultCreator).mockRejectedValue(new Error('Creator Fetch Failed'));
    vi.mocked(ContentService.getAllVideos).mockResolvedValue(mockVideos as any);
    vi.mocked(ContentService.getMainFeaturedVideo).mockResolvedValue(mockVideos[0] as any);

    const result = await loadHomeContent();

    expect(ContentService.getAllVideos).toHaveBeenCalled();
    expect(ContentService.getMainFeaturedVideo).toHaveBeenCalled();
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.creator).toBeNull();
      expect(result.debug?.creatorSuccess).toBe(false);
    }
  });
});
