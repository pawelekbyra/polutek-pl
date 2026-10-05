import { describe, it, expect } from 'vitest';
import { toPublicVideoDto, toAdminVideoDto, toAdminVideoAssetDto } from '@/lib/modules/video/domain/video.dto';
import { AccessTier, StorageProvider, VideoAssetProcessingState, VideoStatus } from '@prisma/client';

const mockVideo = {
  id: 'v1',
  slug: 'video-1',
  title: 'Video 1',
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

  it('toAdminVideoDto no longer carries the legacy videoUrl', () => {
    const dto = toAdminVideoDto(mockVideo);
    expect((dto as any).videoUrl).toBeUndefined();
    expect(dto.status).toBe(VideoStatus.PUBLISHED);
    expect(dto.commentsCount).toBe(5);
    expect(dto.asset).toBeNull();
  });

  it('toAdminVideoAssetDto represents an own-HLS asset without playback runtime fields', () => {
    const syncedAt = new Date('2026-06-11T00:00:00Z');
    const asset = {
      id: 'asset-1',
      videoId: 'v1',
      provider: StorageProvider.SELF_HLS,
      objectKey: 'videos/v1/v/v1',
      bucket: 'polutek-hls',
      processingState: VideoAssetProcessingState.PROCESSING,
      isPrimary: true,
      failureReason: null,
      processingEndedAt: null,
      mimeType: 'video/mp4',
      sizeBytes: 1234,
      createdAt: syncedAt,
      updatedAt: syncedAt,
      playbackUrl: 'https://video.example/leak',
      playbackToken: 'secret-token',
      signedUrl: 'https://signed.example/leak',
    };

    const dto = toAdminVideoAssetDto(asset)!;

    expect(dto.provider).toBe('SELF_HLS');
    expect(dto.processingState).toBe('PROCESSING');
    expect(dto.status).toBe('PROCESSING');
    expect(dto.isPrimary).toBe(true);
    expect(dto.requiresSignedUrl).toBe(true);
    expect(dto.sourceMode).toBe('SELF_HLS');
    expect(dto.isPlayable).toBe(false);
    expect(dto).not.toHaveProperty('lastSyncAt');
    expect(dto).not.toHaveProperty('providerSyncedAt');
    expect(dto.sizeBytes).toBe(1234);
    expect((dto as any).playbackUrl).toBeUndefined();
    expect((dto as any).playbackToken).toBeUndefined();
    expect((dto as any).signedUrl).toBeUndefined();
  });

  it('toAdminVideoAssetDto preserves legacy object-storage assets as representable migration states', () => {
    const createdAt = new Date('2026-06-11T00:00:00Z');

    for (const provider of [StorageProvider.R2, StorageProvider.S3, StorageProvider.VERCEL_BLOB]) {
      const dto = toAdminVideoAssetDto({
        id: `asset-${provider}`,
        videoId: 'v1',
        provider,
        objectKey: `legacy/${provider}/video.mp4`,
        bucket: 'legacy-bucket',
        processingState: VideoAssetProcessingState.READY,
        isPrimary: true,
        failureReason: null,
        processingEndedAt: null,
        mimeType: 'video/mp4',
        sizeBytes: 100,
        createdAt,
        updatedAt: createdAt,
      })!;

      expect(dto.provider).toBe(provider);
      expect(dto.objectKey).toContain('legacy');
      expect(dto.processingState).toBe('READY');
      expect(dto).not.toHaveProperty('providerAssetId');
      expect(dto.requiresSignedUrl).toBe(false);
      expect(dto.sourceMode).toBe('LEGACY_PROVIDER_ASSET');
    }
  });

  it('toPublicVideoDto still does not expose playback behavior while an own-HLS encode is pending', () => {
    const dto = toPublicVideoDto({
      ...mockVideo,
      asset: {
        provider: StorageProvider.SELF_HLS,
        objectKey: 'videos/v1/v/v1',
        processingState: VideoAssetProcessingState.PENDING,
      },
      playbackUrl: 'https://video.example/leak',
      playbackToken: 'token-leak',
    });

    expect((dto as any).videoUrl).toBeUndefined();
    expect((dto as any).playbackUrl).toBeUndefined();
    expect((dto as any).playbackToken).toBeUndefined();
    expect((dto as any).asset).toBeUndefined();
  });

  it('toAdminVideoDto still represents a leftover legacy-provider asset (Mux) without playback/upload behavior', () => {
    const providerSyncedAt = new Date('2026-06-11T00:00:00Z');
    const dto = toAdminVideoDto({
      ...mockVideo,
      asset: {
        id: 'asset-mux-design-compatible',
        videoId: 'v1',
        provider: StorageProvider.MUX,
        objectKey: 'mux/mux-asset-id',
        bucket: null,
        processingState: VideoAssetProcessingState.FAILED,
        isPrimary: true,
        failureReason: 'provider fixture failure',
        processingEndedAt: providerSyncedAt,
        mimeType: null,
        sizeBytes: null,
        createdAt: providerSyncedAt,
        updatedAt: providerSyncedAt,
        uploadUrl: 'https://uploads.example/should-not-map',
      },
    });

    expect(dto.asset?.provider).toBe('MUX');
    expect(dto.asset).not.toHaveProperty('providerAssetId');
    expect(dto.asset).not.toHaveProperty('providerPlaybackId');
    expect(dto.asset?.failureReason).toBe('provider fixture failure');
    expect((dto.asset as any).uploadUrl).toBeUndefined();
    expect((dto.asset as any).playbackUrl).toBeUndefined();
    expect((dto.asset as any).playbackToken).toBeUndefined();
  });

  it('toAdminVideoDto exposes safe diagnostics for a failed own-HLS encode', () => {
    const updatedAt = new Date('2026-06-26T00:00:00Z');
    const dto = toAdminVideoDto({
      ...mockVideo,
      asset: {
        id: 'asset-failed',
        videoId: 'v1',
        provider: StorageProvider.SELF_HLS,
        objectKey: 'videos/v1/v/v2',
        bucket: 'polutek-hls',
        processingState: VideoAssetProcessingState.FAILED,
        isPrimary: true,
        failureReason: 'transcode failed',
        processingEndedAt: updatedAt,
        mimeType: 'video/mp4',
        sizeBytes: 100,
        createdAt: updatedAt,
        updatedAt,
        playbackToken: 'secret-token',
      },
    });

    expect(dto.asset?.provider).toBe('SELF_HLS');
    expect(dto.asset?.status).toBe('FAILED');
    expect(dto.asset?.failureReason).toBe('transcode failed');
    expect(dto.asset?.requiresSignedUrl).toBe(true);
    expect(dto.asset?.sourceMode).toBe('SELF_HLS');
    expect((dto.asset as any).playbackToken).toBeUndefined();
  });

  describe('migrationStatus calculation', () => {
    it('READY when the own-HLS asset is READY', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider: StorageProvider.SELF_HLS, processingState: VideoAssetProcessingState.READY }
      });
      expect(dto.migrationStatus).toBe('READY');
    });

    it('MIGRATION_REQUIRED when using R2 asset', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider: StorageProvider.R2, processingState: VideoAssetProcessingState.READY }
      });
      expect(dto.migrationStatus).toBe('MIGRATION_REQUIRED');
    });

    it.each([StorageProvider.CLOUDFLARE_STREAM, StorageProvider.MUX, StorageProvider.YOUTUBE, StorageProvider.VIMEO])('MIGRATION_REQUIRED (upload again) for a leftover %s asset', (provider) => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider, processingState: VideoAssetProcessingState.READY }
      });
      expect(dto.migrationStatus).toBe('MIGRATION_REQUIRED');
    });

    it('PROCESSING when the own-HLS asset is PROCESSING', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider: StorageProvider.SELF_HLS, processingState: VideoAssetProcessingState.PROCESSING }
      });
      expect(dto.migrationStatus).toBe('PROCESSING');
    });

    it('FAILED when the own-HLS asset is FAILED', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        asset: { provider: StorageProvider.SELF_HLS, processingState: VideoAssetProcessingState.FAILED }
      });
      expect(dto.migrationStatus).toBe('FAILED');
    });

    it('MISSING_SOURCE when there is no asset (a legacy videoUrl is never a source)', () => {
      const dto = toAdminVideoDto({
        ...mockVideo,
        videoUrl: 'https://example.com/video.mp4',
        asset: null
      } as never);
      expect(dto.migrationStatus).toBe('MISSING_SOURCE');
    });
  });
});
