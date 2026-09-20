import { describe, it, expect, vi, afterEach } from 'vitest';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';
import { MediaPolicy } from '@/lib/modules/media';
import { AccessTier, VideoStatus } from '@prisma/client';

// Regression coverage for MEDIA-DTO-SAFETY-ASSERTS-WIRING-001: mapToPublicVideoDTO is the single
// place every PublicVideoDTO in the app is built (sitemap, channel/creator content, search), so
// this is the one call site that must actually invoke the tested MediaPolicy safety assert rather
// than only exercising it in isolation.

function buildRawVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    creatorId: 'c1',
    title: 'Video',
    slug: 'video',
    thumbnailUrl: 'ignored-legacy-field',
    tier: AccessTier.PUBLIC,
    status: VideoStatus.PUBLISHED,
    views: 0,
    likesCount: 0,
    dislikesCount: 0,
    isMainFeatured: false,
    sidebarOrder: 0,
    publishedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('VideoContentService.mapToPublicVideoDTO safety wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls MediaPolicy.assertPublicVideoDtoSafe with the exact DTO it returns', () => {
    const assertSpy = vi.spyOn(MediaPolicy, 'assertPublicVideoDtoSafe');

    const dto = VideoContentService.mapToPublicVideoDTO(buildRawVideo());

    expect(assertSpy).toHaveBeenCalledTimes(1);
    expect(assertSpy).toHaveBeenCalledWith(dto);
  });

  it('does not throw and returns the normal DTO shape for a correctly-built video', () => {
    const dto = VideoContentService.mapToPublicVideoDTO(buildRawVideo());

    expect(dto).toMatchObject({
      id: 'v1',
      creatorId: 'c1',
      title: 'Video',
      slug: 'video',
      thumbnailUrl: '/api/videos/v1/thumbnail',
      tier: AccessTier.PUBLIC,
    });
    expect((dto as any).videoUrl).toBeUndefined();
  });

  it('propagates the safety assertion instead of swallowing it, proving this is a real fail-safe', () => {
    vi.spyOn(MediaPolicy, 'assertPublicVideoDtoSafe').mockImplementation(() => {
      throw new Error('simulated unsafe DTO');
    });

    expect(() => VideoContentService.mapToPublicVideoDTO(buildRawVideo())).toThrow('simulated unsafe DTO');
  });
});
