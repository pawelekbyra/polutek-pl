import { describe, it, expect } from 'vitest';
import { MediaPolicy, isBlockedPrivateHostname, isSafeLocalPath, isHlsOrDashManifest, isDirectMediaSource } from '@/lib/modules/media';

describe('Media Module', () => {
  const env = {
    MEDIA_BUCKET_HOST: 'media.example.com',
    ALLOWED_MEDIA_HOSTS: 'cdn.example.com',
    NEXT_PUBLIC_BLOB_PUBLIC_HOST: 'blob.example.com',
    ALLOWED_AVATAR_HOSTS: 'avatars.com',
    ALLOWED_COMMENT_IMAGE_HOSTS: 'comments.com',
  };

  describe('isBlockedPrivateHostname', () => {
    it('should block localhost and private IPs', () => {
      expect(isBlockedPrivateHostname('localhost')).toBe(true);
      expect(isBlockedPrivateHostname('127.0.0.1')).toBe(true);
      expect(isBlockedPrivateHostname('192.168.1.1')).toBe(true);
      expect(isBlockedPrivateHostname('10.0.0.1')).toBe(true);
      expect(isBlockedPrivateHostname('::1')).toBe(true);
    });

    it('should allow public hostnames', () => {
      expect(isBlockedPrivateHostname('example.com')).toBe(false);
      expect(isBlockedPrivateHostname('google.com')).toBe(false);
    });
  });

  describe('MediaPolicy.isAllowedMediaUrl', () => {
    it('should allow URLs from allowed hosts', () => {
      expect(MediaPolicy.isAllowedMediaUrl('https://media.example.com/video.mp4', env)).toBe(true);
      expect(MediaPolicy.isAllowedMediaUrl('https://cdn.example.com/file.jpg', env)).toBe(true);
    });

    it('should block URLs from unauthorized hosts', () => {
      expect(MediaPolicy.isAllowedMediaUrl('https://unauthorized.com/video.mp4', env)).toBe(false);
    });

    it('should block non-https URLs', () => {
      expect(MediaPolicy.isAllowedMediaUrl('http://media.example.com/video.mp4', env)).toBe(false);
    });
  });

  describe('MediaPolicy.isAllowedVideoSourceUrl', () => {
    it('should allow YouTube and Vimeo URLs', () => {
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', env)).toBe(true);
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://vimeo.com/123456789', env)).toBe(true);
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://player.vimeo.com/video/123456789', env)).toBe(true);
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://vimeo.com/channels/staffpicks/123456789', env)).toBe(true);
    });

    it('should allow URLs from allowed media hosts', () => {
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://media.example.com/video.m3u8', env)).toBe(true);
    });

    it('should block malformed or non-https YouTube/Vimeo URLs', () => {
      expect(MediaPolicy.isAllowedVideoSourceUrl('http://vimeo.com/123', env)).toBe(false);
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://vimeo.com/abc', env)).toBe(false);
    });
  });

  describe('isSafeLocalPath', () => {
    it('should allow safe local paths', () => {
      expect(isSafeLocalPath('/images/thumb.jpg')).toBe(true);
    });

    it('should block unsafe local paths', () => {
      expect(isSafeLocalPath('../etc/passwd')).toBe(false);
      expect(isSafeLocalPath('//external.com')).toBe(false);
    });
  });

  describe('isHlsOrDashManifest', () => {
    it('should detect HLS and DASH manifests', () => {
      expect(isHlsOrDashManifest('https://example.com/video.m3u8')).toBe(true);
      expect(isHlsOrDashManifest('https://example.com/video.mpd')).toBe(true);
      expect(isHlsOrDashManifest('https://example.com/video.mp4')).toBe(false);
    });
  });

  describe('isDirectMediaSource', () => {
    it('should detect direct media files', () => {
      expect(isDirectMediaSource('https://example.com/video.mp4')).toBe(true);
      expect(isDirectMediaSource('https://example.com/video.webm')).toBe(true);
      expect(isDirectMediaSource('https://example.com/audio.mp3')).toBe(true);
      expect(isDirectMediaSource('https://example.com/video.m3u8')).toBe(false);
    });
  });

  describe('MediaPolicy.isAllowedAvatarUrl', () => {
    it('should allow Clerk and allowed avatar hosts', () => {
      expect(MediaPolicy.isAllowedAvatarUrl('https://img.clerk.com/abc', env)).toBe(true);
      expect(MediaPolicy.isAllowedAvatarUrl('https://any.clerk.com/abc', env)).toBe(true);
      expect(MediaPolicy.isAllowedAvatarUrl('https://avatars.com/me.jpg', env)).toBe(true);
      expect(MediaPolicy.isAllowedAvatarUrl('https://blob.example.com/me.jpg', env)).toBe(true);
    });

    it('should block unauthorized avatar hosts', () => {
      expect(MediaPolicy.isAllowedAvatarUrl('https://evil.com/me.jpg', env)).toBe(false);
    });
  });

  describe('MediaPolicy.isAllowedCommentImageUrl', () => {
    it('should allow allowed comment image hosts', () => {
      expect(MediaPolicy.isAllowedCommentImageUrl('https://comments.com/img.jpg', env)).toBe(true);
      expect(MediaPolicy.isAllowedCommentImageUrl('https://blob.example.com/img.jpg', env)).toBe(true);
    });

    it('should block unauthorized hosts', () => {
      expect(MediaPolicy.isAllowedCommentImageUrl('https://evil.com/img.jpg', env)).toBe(false);
    });
  });
});
