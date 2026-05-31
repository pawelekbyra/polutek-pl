import { describe, expect, it } from 'vitest';
import { isAllowedMediaUrl, parseMediaHosts } from '@/lib/blob';
import { buildMediaRateLimitKey } from '@/lib/media/rate-limit';

describe('media host validation', () => {
  const env = {
    MEDIA_BUCKET_HOST: 'https://media.example.com/path',
    NEXT_PUBLIC_R2_PUBLIC_HOST: 'bucket.example.r2.dev',
    NEXT_PUBLIC_BLOB_PUBLIC_HOST: 'blob.example.com',
    ALLOWED_MEDIA_HOSTS: 'cdn.example.com,assets.example.com',
  };

  it('parses hosts from URLs and comma-separated host lists', () => {
    expect(parseMediaHosts('https://cdn.example.com/path, bucket.example.com')).toEqual([
      'cdn.example.com',
      'bucket.example.com',
    ]);
  });

  it('allows exactly configured https hosts', () => {
    expect(isAllowedMediaUrl('https://media.example.com/video.mp4', env)).toBe(true);
    expect(isAllowedMediaUrl('https://bucket.example.r2.dev/video.mp4', env)).toBe(true);
    expect(isAllowedMediaUrl('https://cdn.example.com/video.mp4', env)).toBe(true);
  });

  it('rejects broad/default external hosts and malformed URLs', () => {
    expect(isAllowedMediaUrl('https://images.unsplash.com/photo.jpg', {})).toBe(false);
    expect(isAllowedMediaUrl('https://polutek.pl/video.mp4', {})).toBe(false);
    expect(isAllowedMediaUrl('https://r2.dev/video.mp4', {})).toBe(false);
    expect(isAllowedMediaUrl('https://vercel-storage.com/video.mp4', {})).toBe(false);
    expect(isAllowedMediaUrl('not-a-url', env)).toBe(false);
  });

  it('requires https and exact hosts', () => {
    expect(isAllowedMediaUrl('http://media.example.com/video.mp4', env)).toBe(false);
    expect(isAllowedMediaUrl('https://sub.media.example.com/video.mp4', env)).toBe(false);
  });
});

describe('media rate limit key', () => {
  it('uses user id when present', () => {
    expect(buildMediaRateLimitKey({ userId: 'user_1', ip: '203.0.113.10', mediaId: 'video-1' }))
      .toBe('media:user:user_1:video-1');
  });

  it('falls back to ip for anonymous requests', () => {
    expect(buildMediaRateLimitKey({ userId: null, ip: '203.0.113.10', mediaId: 'video-1' }))
      .toBe('media:ip:203.0.113.10:video-1');
  });
});
