import { describe, it, expect } from 'vitest';
import { MediaPolicy, isBlockedPrivateHostname, isSafeLocalPath, isHlsOrDashManifest } from '@/lib/modules/media';

describe('Media Module', () => {
  const env = {
    MEDIA_BUCKET_HOST: 'media.example.com',
    ALLOWED_MEDIA_HOSTS: 'cdn.example.com',
    NEXT_PUBLIC_BLOB_PUBLIC_HOST: 'blob.example.com',
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
    });

    it('should allow URLs from allowed media hosts', () => {
      expect(MediaPolicy.isAllowedVideoSourceUrl('https://media.example.com/video.m3u8', env)).toBe(true);
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
});
