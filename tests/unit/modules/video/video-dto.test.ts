import { describe, it, expect } from 'vitest';
import { toPublicVideoDto, toAdminVideoDto } from '@/lib/modules/video/domain/video.dto';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('Video DTOs', () => {
  const mockVideo = {
    id: 'v1',
    slug: 'video-1',
    title: 'Video 1',
    videoUrl: 'https://example.com/video.mp4',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    tier: AccessTier.PUBLIC,
    status: VideoStatus.PUBLISHED,
    creatorId: 'c1',
    views: 100,
    likesCount: 10,
    dislikesCount: 1,
    publishedAt: new Date(),
    isMainFeatured: false,
    showInSidebar: true,
    sidebarOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { comments: 5 }
  };

  it('toPublicVideoDto should not contain videoUrl', () => {
    const dto = toPublicVideoDto(mockVideo);
    expect((dto as any).videoUrl).toBeUndefined();
    expect(dto.id).toBe('v1');
    expect(dto.title).toBe('Video 1');
  });

  it('toAdminVideoDto should contain videoUrl', () => {
    const dto = toAdminVideoDto(mockVideo);
    expect(dto.videoUrl).toBe('https://example.com/video.mp4');
    expect(dto.status).toBe(VideoStatus.PUBLISHED);
    expect(dto.commentsCount).toBe(5);
  });
});
