import { describe, it, expect } from 'vitest';
import { MediaPolicy } from '@/lib/modules/media/domain/media.policy';

describe('Thumbnail Hosts Config', () => {
  const env = {
    ALLOWED_THUMBNAIL_HOSTS: 'i.ytimg.com,img.clerk.com',
  };

  it('allows i.ytimg.com thumbnails', () => {
    expect(MediaPolicy.isAllowedThumbnailUrl('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', env as any)).toBe(true);
  });

  it('allows images.unsplash.com by default', () => {
    expect(MediaPolicy.isAllowedThumbnailUrl('https://images.unsplash.com/photo-123', {} as any)).toBe(true);
  });

  it('denies unknown hosts', () => {
    expect(MediaPolicy.isAllowedThumbnailUrl('https://malicious.com/thumb.jpg', env as any)).toBe(false);
  });
});
