import { describe, it, expect } from 'vitest';
import { toPublicVideoDto, toAdminVideoDto, toAdminVideoAssetDto } from '@/lib/modules/video/domain/video.dto';
import { AccessTier, VideoStatus } from '@prisma/client';

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

describe('Video DTOs', () => {
  it('toPublicVideoDto should not contain videoUrl or other raw fields', () => {
    const dto = toPublicVideoDto({
        ...mockVideo,
        sourceUrl: 'https://example.com/raw.mp4',
        rawUrl: 'https://example.com/raw.mp4',
        signedUrl: 'https://example.com/raw.mp4?sig=123',
    });
    expect((dto as any).videoUrl).toBeUndefined();
    expect((dto as any).sourceUrl).toBeUndefined();
    expect((dto as any).rawUrl).toBeUndefined();
    expect((dto as any).signedUrl).toBeUndefined();
    expect(dto.id).toBe('v1');
    expect(dto.title).toBe('Video 1');
  });

  it('toAdminVideoDto should contain videoUrl', () => {
    const dto = toAdminVideoDto(mockVideo);
    expect(dto.videoUrl).toBe('https://example.com/video.mp4');
    expect(dto.status).toBe(VideoStatus.PUBLISHED);
    expect(dto.commentsCount).toBe(5);
    expect(dto.asset).toBeNull();
  });

  it('toAdminVideoAssetDto represents a Cloudflare Stream asset without playback runtime fields', () => {
    const syncedAt = new Date('2026-06-11T00:00:00Z');
    const asset = {
      id: 'asset-1',
      videoId: 'v1',
      provider: 'CLOUDFLARE_STREAM',
      objectKey: 'cloudflare-stream/cf-video-uid',
      bucket: null,
      providerAssetId: 'cf-video-uid',
      providerPlaybackId: 'cf-playback-uid',
      processingState: 'PROCESSING',
      isPrimary: true,
      failureReason: null,
      providerSyncedAt: syncedAt,
      processingStartedAt: syncedAt,
      processingEndedAt: null,
      mimeType: 'video/mp4',
      sizeBytes: 1234,
      createdAt: syncedAt,
      updatedAt: syncedAt,
      playbackUrl: 'https://customer.cloudflarestream.com/leak',
      playbackToken: 'secret-token',
      signedUrl: 'https://signed.example/leak',
    };

    const dto = toAdminVideoAssetDto(asset)!;

    expect(dto.provider).toBe('CLOUDFLARE_STREAM');
    expect(dto.providerAssetId).toBe('cf-video-uid');
    expect(dto.providerPlaybackId).toBe('cf-playback-uid');
    expect(dto.processingState).toBe('PROCESSING');
    expect(dto.isPrimary).toBe(true);
    expect(dto.providerSyncedAt).toBe(syncedAt);
    expect((dto as any).playbackUrl).toBeUndefined();
    expect((dto as any).playbackToken).toBeUndefined();
    expect((dto as any).signedUrl).toBeUndefined();
  });

  it('toAdminVideoAssetDto preserves legacy object-storage assets as representable migration states', () => {
    const createdAt = new Date('2026-06-11T00:00:00Z');

    for (const provider of ['R2', 'S3', 'VERCEL_BLOB']) {
      const dto = toAdminVideoAssetDto({
        id: `asset-${provider}`,
        videoId: 'v1',
        provider,
        objectKey: `legacy/${provider}/video.mp4`,
        bucket: 'legacy-bucket',
        providerAssetId: null,
        providerPlaybackId: null,
        processingState: 'READY',
        isPrimary: true,
        failureReason: null,
        providerSyncedAt: null,
        processingStartedAt: null,
        processingEndedAt: null,
        mimeType: 'video/mp4',
        sizeBytes: 100,
        createdAt,
        updatedAt: createdAt,
      })!;

      expect(dto.provider).toBe(provider);
      expect(dto.objectKey).toContain('legacy');
      expect(dto.processingState).toBe('READY');
      expect(dto.providerAssetId).toBeNull();
      expect(dto.providerPlaybackId).toBeNull();
    }
  });

  it('toAdminVideoDto includes asset metadata but does not introduce playback/upload behavior', () => {
    const providerSyncedAt = new Date('2026-06-11T00:00:00Z');
    const dto = toAdminVideoDto({
      ...mockVideo,
      asset: {
        id: 'asset-mux-design-compatible',
        videoId: 'v1',
        provider: 'MUX',
        objectKey: 'mux/mux-asset-id',
        bucket: null,
        providerAssetId: 'mux-asset-id',
        providerPlaybackId: 'mux-playback-id',
        processingState: 'FAILED',
        isPrimary: true,
        failureReason: 'provider fixture failure',
        providerSyncedAt,
        processingStartedAt: providerSyncedAt,
        processingEndedAt: providerSyncedAt,
        mimeType: null,
        sizeBytes: null,
        createdAt: providerSyncedAt,
        updatedAt: providerSyncedAt,
        uploadUrl: 'https://uploads.example/should-not-map',
      },
    });

    expect(dto.asset?.provider).toBe('MUX');
    expect(dto.asset?.providerAssetId).toBe('mux-asset-id');
    expect(dto.asset?.providerPlaybackId).toBe('mux-playback-id');
    expect(dto.asset?.failureReason).toBe('provider fixture failure');
    expect((dto.asset as any).uploadUrl).toBeUndefined();
    expect((dto.asset as any).playbackUrl).toBeUndefined();
    expect((dto.asset as any).playbackToken).toBeUndefined();
  });

  describe('migrationStatus calculation', () => {
    it('READY when Cloudflare Stream asset is READY', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider: 'CLOUDFLARE_STREAM', processingState: 'READY' }
      });
      expect(dto.migrationStatus).toBe('READY');
    });

    it('MIGRATION_REQUIRED when using R2 asset', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider: 'R2', processingState: 'READY' }
      });
      expect(dto.migrationStatus).toBe('MIGRATION_REQUIRED');
    });

    it('MIGRATION_REQUIRED when no asset but has videoUrl', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        videoUrl: 'https://example.com/video.mp4',
        asset: null
      });
      expect(dto.migrationStatus).toBe('MIGRATION_REQUIRED');
    });

    it('PROCESSING when Cloudflare Stream asset is PROCESSING', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider: 'CLOUDFLARE_STREAM', processingState: 'PROCESSING' }
      });
      expect(dto.migrationStatus).toBe('PROCESSING');
    });

    it('FAILED when Cloudflare Stream asset is FAILED', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider: 'CLOUDFLARE_STREAM', processingState: 'FAILED' }
      });
      expect(dto.migrationStatus).toBe('FAILED');
    });

    it('MISSING_SOURCE when no asset and no videoUrl', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        videoUrl: '',
        asset: null
      });
      expect(dto.migrationStatus).toBe('MISSING_SOURCE');
    });
  });
});
