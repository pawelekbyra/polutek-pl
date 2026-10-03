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

    it('treats former provider delivery URLs (Cloudflare Stream, Mux) as raw: they must never reach the browser', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('https://videodelivery.net/signed-token/manifest/video.m3u8')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://customer.cloudflarestream.com/signed-token/manifest/video.mpd')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://stream.mux.com/playback-id.m3u8?token=abc')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://videodelivery.net/signed-token/downloads/default.mp4')).toBe(true);
    });

    it('allows only our own signed HLS delivery URL on the configured delivery host', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('https://video.pawelperfect.com/h/1790000000.sig/video-id-0001/v1/master.m3u8')).toBe(false);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://video.pawelperfect.com/clip.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://evil.example/h/1790000000.sig/video-id-0001/v1/master.m3u8')).toBe(true);
    });

    it('allows gated API routes', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('/api/media-source/video-123')).toBe(false);
    });

    it('should detect raw media extensions in full URLs', () => {
      expect(MediaPolicy.isProbablyRawMediaUrl('https://other-host.com/video.mp4')).toBe(true);
      expect(MediaPolicy.isProbablyRawMediaUrl('https://other-host.com/video.m3u8')).toBe(true);
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

    it('allows our own signed HLS URL as the playback descriptor, rejects former provider manifests', () => {
      expect(() => MediaPolicy.assertPublicMediaDescriptorSafe({
        videoId: 'v1',
        playbackUrl: 'https://video.pawelperfect.com/h/1790000000.sig/video-id-0001/v1/master.m3u8'
      })).not.toThrow();
      expect(() => MediaPolicy.assertPublicMediaDescriptorSafe({
        videoId: 'v1',
        playbackUrl: 'https://videodelivery.net/signed-token/manifest/video.m3u8'
      })).toThrow();
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
