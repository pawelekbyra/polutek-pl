import { describe, it, expect } from 'vitest';
import { MediaPolicy } from '@/lib/modules/media/domain/media.policy';
import { isBlockedPrivateHostname, isSafeLocalPath } from '@/lib/modules/media/domain/media-safety';

describe('Media Module Certification', () => {
  const env = {
    MEDIA_BUCKET_HOST: 'media.polutek.pl',
    NEXT_PUBLIC_BLOB_PUBLIC_HOST: 'blob.polutek.pl',
    ALLOWED_MEDIA_HOSTS: 'external.com',
    ALLOWED_THUMBNAIL_HOSTS: 'thumbnails.com',
    ALLOWED_AVATAR_HOSTS: 'avatars.com',
    ALLOWED_COMMENT_IMAGE_HOSTS: 'comments.com',
  };

  describe('General Media URLs', () => {
    it('accepts allowed hosts', () => {
      expect(MediaPolicy.isAllowedMediaUrl('https://media.polutek.pl/file.mp4', env)).toBe(true);
      expect(MediaPolicy.isAllowedMediaUrl('https://external.com/image.png', env)).toBe(true);
    });

    it('rejects unknown hosts', () => {
      expect(MediaPolicy.isAllowedMediaUrl('https://evil.com/malware.exe', env)).toBe(false);
    });

    it('rejects insecure http', () => {
      expect(MediaPolicy.isAllowedMediaUrl('http://media.polutek.pl/file.mp4', env)).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(MediaPolicy.isAllowedMediaUrl('not-a-url', env)).toBe(false);
    });

    it('rejects host spoofing', () => {
      expect(MediaPolicy.isAllowedMediaUrl('https://media.polutek.pl.evil.com/file.mp4', env)).toBe(false);
    });
  });

  describe('Private Host Blocking', () => {
    const privateHosts = [
      'localhost', '127.0.0.1', '0.0.0.0',
      '10.0.0.1', '172.16.0.1', '192.168.1.1',
      '169.254.169.254', '::1', '[::1]',
      'fc00::', 'fe80::1'
    ];

    privateHosts.forEach(host => {
      it(`blocks ${host}`, () => {
        expect(isBlockedPrivateHostname(host)).toBe(true);
        expect(MediaPolicy.isAllowedMediaUrl(`https://${host}/secret`, env)).toBe(false);
      });
    });
  });

  describe('Thumbnail Safety', () => {
    it('accepts safe local paths', () => {
      expect(MediaPolicy.isAllowedThumbnailUrl('/thumbnails/image.jpg', env)).toBe(true);
    });

    it('rejects protocol-relative URLs', () => {
      expect(MediaPolicy.isAllowedThumbnailUrl('//evil.com/image.jpg', env)).toBe(false);
    });

    it('rejects path traversal', () => {
      expect(MediaPolicy.isAllowedThumbnailUrl('/../etc/passwd', env)).toBe(false);
      expect(MediaPolicy.isAllowedThumbnailUrl('/%2e%2e/etc/passwd', env)).toBe(false);
    });

    it('accepts allowed thumbnail hosts', () => {
      expect(MediaPolicy.isAllowedThumbnailUrl('https://thumbnails.com/img.jpg', env)).toBe(true);
    });
  });

  describe('Video Source URLs', () => {
    it('accepts YouTube patterns', () => {
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://www.youtube.com/watch?v=123', env)).toBe(true);
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://youtu.be/123', env)).toBe(true);
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://www.youtube.com/shorts/123', env)).toBe(true);
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://www.youtube.com/embed/123', env)).toBe(true);
    });

    it('rejects bad YouTube patterns', () => {
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://www.youtube.com/user/channel', env)).toBe(false);
    });

    it('accepts Vimeo patterns', () => {
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://vimeo.com/123456', env)).toBe(true);
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://player.vimeo.com/video/123456', env)).toBe(true);
    });
  });

  describe('Avatar & Comment Images', () => {
    it('accepts Clerk avatars', () => {
      expect(MediaPolicy.isAllowedAvatarUrl('https://img.clerk.com/avatar.png', env)).toBe(true);
    });

    it('accepts allowed avatar hosts', () => {
      expect(MediaPolicy.isAllowedAvatarUrl('https://avatars.com/me.png', env)).toBe(true);
    });

    it('accepts allowed comment image hosts', () => {
      expect(MediaPolicy.isAllowedCommentImageUrl('https://comments.com/upload.png', env)).toBe(true);
    });

    it('rejects media host for comment images if not explicitly allowed', () => {
        expect(MediaPolicy.isAllowedCommentImageUrl('https://media.polutek.pl/img.png', env)).toBe(false);
    });
  });
});
