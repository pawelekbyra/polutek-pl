import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadHomeContent } from '@/lib/modules/channel/application/home-content.loader';
import { CreatorContentService } from '@/lib/modules/channel/infrastructure/creator-content.service';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';

vi.mock('@/lib/modules/channel/infrastructure/creator-content.service', () => ({
  CreatorContentService: {
    getConfiguredCreatorSummary: vi.fn(),
  },
}));

vi.mock('@/lib/modules/video/infrastructure/video-content.service', () => ({
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
    const mockCreator = { id: 'c1', name: 'Kanał', slug: 'kanal', bio: 'Bio' };
    const mockVideos = [{ id: 'v1' }];

    vi.mocked(CreatorContentService.getConfiguredCreatorSummary).mockResolvedValue(mockCreator as any);
    vi.mocked(VideoContentService.getAllVideos).mockResolvedValue(mockVideos as any);
    vi.mocked(VideoContentService.getMainFeaturedVideo).mockResolvedValue(mockVideos[0] as any);

    const result = await loadHomeContent();

    expect(result.status).toBe('ready');
    expect(result.creator).toEqual(mockCreator);
    expect(result.allVideos).toEqual(mockVideos);
    expect(result.mainVideo).toEqual(mockVideos[0]);
  });

  it('handles creator failure gracefully', async () => {
    vi.mocked(CreatorContentService.getConfiguredCreatorSummary).mockRejectedValue(new Error('DB FAIL'));
    vi.mocked(VideoContentService.getAllVideos).mockResolvedValue([]);
    vi.mocked(VideoContentService.getMainFeaturedVideo).mockResolvedValue(null);

    const result = await loadHomeContent();

    expect(result.status).toBe('empty');
    expect(result.creator).toBeNull();
  });

  it('fails if video loading fails', async () => {
    vi.mocked(VideoContentService.getAllVideos).mockRejectedValue(new Error('VID FAIL'));

    const result = await loadHomeContent();

    expect(result.status).toBe('empty');
    expect(result.publicMessage).toBe('Brak dostępnych materiałów.');
  });

  it('starts the channel, video list and featured video reads together, not one after another', async () => {
    const started: string[] = [];
    const deferred = <T,>(name: string, value: T) =>
      () => { started.push(name); return new Promise<T>((resolve) => setTimeout(() => resolve(value), 5)); };
    vi.mocked(CreatorContentService.getConfiguredCreatorSummary).mockImplementation(deferred('creator', null) as any);
    vi.mocked(VideoContentService.getAllVideos).mockImplementation(deferred('videos', [{ id: 'v1' }]) as any);
    vi.mocked(VideoContentService.getMainFeaturedVideo).mockImplementation(deferred('featured', null) as any);

    const pending = loadHomeContent();
    await Promise.resolve();
    expect(started.sort()).toEqual(['creator', 'featured', 'videos']);

    const result = await pending;
    expect(result.status).toBe('ready');
    expect(result.mainVideo).toEqual({ id: 'v1' });
  });

  it('keeps the video list when only the featured video fails', async () => {
    vi.mocked(CreatorContentService.getConfiguredCreatorSummary).mockResolvedValue(null);
    vi.mocked(VideoContentService.getAllVideos).mockResolvedValue([{ id: 'v1' }, { id: 'v2' }] as any);
    vi.mocked(VideoContentService.getMainFeaturedVideo).mockRejectedValue(new Error('FEATURED FAIL'));

    const result = await loadHomeContent();

    expect(result.status).toBe('ready');
    expect(result.mainVideo).toEqual({ id: 'v1' });
  });
});
