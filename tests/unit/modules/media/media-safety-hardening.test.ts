import { describe, it, expect } from 'vitest';
import { MediaPolicy } from '@/lib/modules/media';
import { UnsafePublicMediaDtoError, RawVideoUrlExposedError } from '@/lib/modules/media/domain/media.errors';

describe('Media Safety Hardening', () => {
  describe('isProbablyRawMediaUrl', () => {
    it('detects S3 and storage URLs as raw', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('https://my-bucket.s3.amazonaws.com/video.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://my-bucket.s3.eu-central-1.amazonaws.com/video.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://my-bucket.s3.eu-central-1.amazonaws.com/video.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://account.blob.core.windows.net/container/video.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://bucket.r2.cloudflarestorage.com/video.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://kraufanding-media.s3.amazonaws.com/video.mp4')).toBe(true);
    });

    it('detects signed URLs with tokens as raw', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('https://cdn.example.com/video.mp4?token=secret')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://cdn.example.com/video.mp4?X-Amz-Signature=123')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://cdn.example.com/video.mp4?sig=abc')).toBe(true);
    });

    it('detects direct media extensions on unknown hosts as raw', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('https://untrusted-cdn.com/movie.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://untrusted-cdn.com/playlist.m3u8')).toBe(true);
    });

    it('allows gated API routes', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('/api/media/video-123')).toBe(false);
      expect(MediaPolicy.isProbablyRawMediaUrl('/api/media-source/video-123')).toBe(false);
    });

    it('should detect raw media extensions in full URLs', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('https://other-host.com/video.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://other-host.com/video.m3u8')).toBe(true);
    });

    it('should allow YouTube and Vimeo as safe hosts (handled elsewhere)', () => {
        // isProbablyRawMediaUrl is a heuristic, specific hosts are allowed in isAllowedVideoSourceUrl
        // But isProbablyRawMediaUrl should generally return true for external .mp4 etc.
        expect(MediaPolicy.isProbablyRawMediaUrl('https://www.youtube.com/watch?v=123')).toBe(false);
    });
  });

  describe('assertPublicVideoDtoSafe', () => {
    it('should throw if forbidden fields are present', () => {
        expect(() => MediaPolicy.assertPublicVideoDtoSafe({ id: '1', videoUrl: 'leak' })).toThrow();
        expect(() => MediaPolicy.assertPublicVideoDtoSafe({ id: '1', sourceUrl: 'leak' })).toThrow();
        expect(() => MediaPolicy.assertPublicVideoDtoSafe({ id: '1', rawUrl: 'leak' })).toThrow();
        expect(() => MediaPolicy.assertPublicVideoDtoSafe({ id: '1', internalAssetProviderUrl: 'leak' })).toThrow();
    });

    it('should not throw for safe DTOs', () => {
        expect(() => MediaPolicy.assertPublicVideoDtoSafe({ id: '1', title: 'Safe' })).not.toThrow();
    });
  });

  describe('assertPublicMediaDescriptorSafe', () => {
    it('allows safe descriptor', () => {
      expect(() => MediaPolicy.assertPublicMediaDescriptorSafe({
        videoId: 'v1',
        playbackUrl: '/api/media/v1'
      })).not.toThrow();
    });

    it('rejects descriptor with forbidden fields', () => {
      expect(() => MediaPolicy.assertPublicMediaDescriptorSafe({
        videoId: 'v1',
        playbackUrl: '/api/media/v1',
        videoUrl: 'https://s3.amazonaws.com/v1.mp4'
      } as any)).toThrow(UnsafePublicMediaDtoError);

      expect(() => MediaPolicy.assertPublicMediaDescriptorSafe({
        videoId: 'v1',
        playbackUrl: '/api/media/v1',
        signedUrl: 'https://cdn.com/v1.mp4?token=123'
      } as any)).toThrow(UnsafePublicMediaDtoError);
    });

    it('rejects descriptor with raw playbackUrl', () => {
      expect(() => MediaPolicy.assertPublicMediaDescriptorSafe({
        videoId: 'v1',
        playbackUrl: 'https://s3.amazonaws.com/v1.mp4'
      })).toThrow(RawVideoUrlExposedError);
    });
  });

  describe('redactInternalMediaSource', () => {
    it('transforms internal source to safe public descriptor', () => {
      const internal = {
        videoId: 'v1',
        sourceUrl: 'https://s3.amazonaws.com/v1.mp4',
        provider: 's3' as const
      };
      const publicDto = MediaPolicy.redactInternalMediaSource(internal);

      expect(publicDto).toEqual({
        videoId: 'v1',
        playbackUrl: '/api/media/v1'
      });
      expect((publicDto as any).sourceUrl).toBeUndefined();
    });
  });

  describe('createGatedMediaReference', () => {
    it('creates correct gated reference', () => {
      const ref = MediaPolicy.createGatedMediaReference('v1');
      expect(ref).toEqual({
        videoId: 'v1',
        endpoint: '/api/media-source/v1',
        requiresAccessCheck: true
      });
    });
  });
});
