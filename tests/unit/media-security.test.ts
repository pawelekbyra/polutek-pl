import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGatedBlobResponse, isAllowedAvatarUrl, isAllowedCommentImageUrl, isAllowedMediaUrl, isAllowedThumbnailUrl, isAllowedVideoSourceUrl, parseMediaHosts } from '@/lib/blob';
import { buildMediaRateLimitKey } from '@/lib/media/rate-limit';
import { AccessPolicy } from '@/lib/access/access-policy';
import { logger } from '@/lib/logger';

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
    expect(isAllowedMediaUrl('https://fdn.example.com/video.mp4', { ALLOWED_MEDIA_HOSTS: 'fdn.example.com' })).toBe(true);
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


  it('blocks SSRF targets even when they are accidentally configured in the media allowlist', () => {
    const unsafeEnv = {
      ALLOWED_MEDIA_HOSTS: 'localhost,127.0.0.1,10.0.0.5,172.16.0.10,192.168.1.20,169.254.169.254,[::1],[fd00::1],[fe80::1]',
    };

    expect(isAllowedMediaUrl('https://localhost/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://app.localhost/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://127.0.0.1/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://10.0.0.5/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://172.16.0.10/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://192.168.1.20/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://169.254.169.254/latest/meta-data', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://[::1]/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://[fd00::1]/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedMediaUrl('https://[fe80::1]/video.mp4', unsafeEnv)).toBe(false);
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

describe('isAllowedVideoSourceUrl', () => {
  const env = { ALLOWED_MEDIA_HOSTS: 'cdn.example.com' };

  it('allows only supported youtube URL shapes', () => {
    expect(isAllowedVideoSourceUrl('https://www.youtube.com/watch?v=abc123', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://youtu.be/abc123', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://youtube.com/shorts/abc123', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://www.youtube.com/live/abc123', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://www.youtube.com/embed/abc123', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://www.youtube.com/channel/UCabc123', env)).toBe(false);
    expect(isAllowedVideoSourceUrl('https://www.youtube.com/redirect?q=https://evil.com/video.mp4', env)).toBe(false);
  });

  it('allows only supported vimeo URL shapes', () => {
    expect(isAllowedVideoSourceUrl('https://vimeo.com/123456', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://player.vimeo.com/video/123456', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://vimeo.com/channels/staffpicks/123456', env)).toBe(false);
    expect(isAllowedVideoSourceUrl('https://player.vimeo.com/event/123456', env)).toBe(false);
  });

  it('allows configured direct media and streaming manifest hosts', () => {
    expect(isAllowedVideoSourceUrl('https://cdn.example.com/video.mp4', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://cdn.example.com/video.m3u8', env)).toBe(true);
    expect(isAllowedVideoSourceUrl('https://cdn.example.com/manifest.mpd', env)).toBe(true);
  });

  it('blocks unsafe or malformed video source URLs', () => {
    expect(isAllowedVideoSourceUrl('http://youtube.com/watch?v=abc', env)).toBe(false);
    expect(isAllowedVideoSourceUrl('//youtube.com/watch?v=abc', env)).toBe(false);
    expect(isAllowedVideoSourceUrl('evil.com/video.mp4', env)).toBe(false);
    expect(isAllowedVideoSourceUrl('not-a-url', env)).toBe(false);
    expect(isAllowedVideoSourceUrl('https://malicious.com/video.mp4', env)).toBe(false);
  });


  it('blocks direct localhost, private IP and metadata endpoint sources even if configured', () => {
    const unsafeEnv = { ALLOWED_MEDIA_HOSTS: 'localhost,127.0.0.1,10.0.0.5,169.254.169.254' };

    expect(isAllowedVideoSourceUrl('https://localhost/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedVideoSourceUrl('https://127.0.0.1/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedVideoSourceUrl('https://10.0.0.5/video.mp4', unsafeEnv)).toBe(false);
    expect(isAllowedVideoSourceUrl('https://169.254.169.254/latest/meta-data', unsafeEnv)).toBe(false);
  });
});

describe('isAllowedThumbnailUrl', () => {
  const env = { ALLOWED_MEDIA_HOSTS: 'cdn.example.com' };

  it('allows safe local paths', () => {
    expect(isAllowedThumbnailUrl('/thumbnails/video.jpg', env)).toBe(true);
    expect(isAllowedThumbnailUrl('/images/thumb.jpg', env)).toBe(true);
  });

  it('blocks unsafe local or protocol-relative URLs', () => {
    expect(isAllowedThumbnailUrl('//malicious.com/img.jpg', env)).toBe(false);
    expect(isAllowedThumbnailUrl('/../secret', env)).toBe(false);
    expect(isAllowedThumbnailUrl('/%2e%2e/secret', env)).toBe(false);
  });

  it('allows default trusted thumbnail hosts', () => {
    expect(isAllowedThumbnailUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg', env)).toBe(true);
    expect(isAllowedThumbnailUrl('https://img.clerk.com/abc.jpg', env)).toBe(true);
  });

  it('blocks http and random external hosts', () => {
    expect(isAllowedThumbnailUrl('http://cdn.example.com/thumb.jpg', env)).toBe(false);
    expect(isAllowedThumbnailUrl('https://evil.com/thumb.jpg', env)).toBe(false);
  });
});

describe('comment image and avatar URL validation', () => {
  const env = {
    ALLOWED_COMMENT_IMAGE_HOSTS: 'comments.example.com',
    ALLOWED_AVATAR_HOSTS: 'avatars.example.com',
    ALLOWED_MEDIA_HOSTS: 'video-cdn.example.com',
  };

  it('uses dedicated comment image hosts instead of video media hosts', () => {
    expect(isAllowedCommentImageUrl('https://comments.example.com/comment.jpg', env)).toBe(true);
    expect(isAllowedCommentImageUrl('https://video-cdn.example.com/comment.jpg', env)).toBe(false);
    expect(isAllowedCommentImageUrl('http://comments.example.com/comment.jpg', env)).toBe(false);
    expect(isAllowedCommentImageUrl('not-a-url', env)).toBe(false);
  });

  it('uses dedicated avatar hosts and Clerk avatar hosts', () => {
    expect(isAllowedAvatarUrl('https://img.clerk.com/avatar.jpg', env)).toBe(true);
    expect(isAllowedAvatarUrl('https://images.clerk.com/avatar.jpg', env)).toBe(true);
    expect(isAllowedAvatarUrl('https://avatars.example.com/avatar.jpg', env)).toBe(true);
    expect(isAllowedAvatarUrl('https://video-cdn.example.com/avatar.jpg', env)).toBe(false);
    expect(isAllowedAvatarUrl('http://img.clerk.com/avatar.jpg', env)).toBe(false);
  });
});


describe('gated media proxy logging', () => {
  const previousAllowedMediaHosts = process.env.ALLOWED_MEDIA_HOSTS;

  afterEach(() => {
    process.env.ALLOWED_MEDIA_HOSTS = previousAllowedMediaHosts;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not log signed media URLs or token-bearing fetch error messages', async () => {
    process.env.ALLOWED_MEDIA_HOSTS = 'cdn.example.com';
    vi.spyOn(AccessPolicy, 'canViewVideo').mockResolvedValue({ allowed: true } as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      new Error('fetch failed for https://cdn.example.com/private/video.mp4?token=SECRET_TOKEN'),
    ));
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const response = await getGatedBlobResponse(
      'user_1',
      'video_1',
      'https://cdn.example.com/private/video.mp4?token=SECRET_TOKEN',
    );

    expect(response.status).toBe(500);
    const loggedPayload = JSON.stringify(errorSpy.mock.calls);
    expect(loggedPayload).not.toContain('SECRET_TOKEN');
    expect(loggedPayload).not.toContain('private/video.mp4');
    expect(loggedPayload).not.toContain('token=');
    expect(loggedPayload).toContain('Error accessing gated media');
  });
});
