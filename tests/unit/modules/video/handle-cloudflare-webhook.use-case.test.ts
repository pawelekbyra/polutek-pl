import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCloudflareStreamWebhook } from '@/lib/modules/video/application/handle-cloudflare-webhook.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { StorageProvider, VideoAssetProcessingState } from '@prisma/client';

describe('handleCloudflareStreamWebhook', () => {
  const mockPrisma = {
    videoAsset: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  };

  const ctx = {
    prisma: mockPrisma,
    actor: { type: 'system', reason: 'Cloudflare Stream Webhook' },
  } as unknown as AppContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates asset state to READY when cloudflare status is ready', async () => {
    const asset = {
      id: 'asset-1',
      videoId: 'video-1',
      processingState: VideoAssetProcessingState.PROCESSING
    };
    mockPrisma.videoAsset.findFirst.mockResolvedValue(asset);
    mockPrisma.videoAsset.update.mockResolvedValue({ ...asset, processingState: VideoAssetProcessingState.READY });

    const payload = {
      uid: 'cf-uid-123',
      status: { state: 'ready' as const }
    };

    const result = await handleCloudflareStreamWebhook(payload, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe(VideoAssetProcessingState.READY);
    }
    expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'asset-1' },
      data: expect.objectContaining({
        processingState: VideoAssetProcessingState.READY,
        processingEndedAt: expect.any(Date)
      })
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('updates asset state to FAILED when cloudflare status is error', async () => {
    const asset = {
      id: 'asset-1',
      videoId: 'video-1',
      processingState: VideoAssetProcessingState.PROCESSING
    };
    mockPrisma.videoAsset.findFirst.mockResolvedValue(asset);
    mockPrisma.videoAsset.update.mockResolvedValue({ ...asset, processingState: VideoAssetProcessingState.FAILED });

    const payload = {
      uid: 'cf-uid-123',
      status: {
        state: 'error' as const,
        errorReasonText: 'Transcoding failed'
      }
    };

    const result = await handleCloudflareStreamWebhook(payload, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe(VideoAssetProcessingState.FAILED);
    }
    expect(mockPrisma.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        processingState: VideoAssetProcessingState.FAILED,
        failureReason: 'Transcoding failed'
      })
    }));
  });

  it('handles idempotency - no update if state is already READY', async () => {
    const asset = {
      id: 'asset-1',
      videoId: 'video-1',
      processingState: VideoAssetProcessingState.READY
    };
    mockPrisma.videoAsset.findFirst.mockResolvedValue(asset);

    const payload = {
      uid: 'cf-uid-123',
      status: { state: 'processing' as const }
    };

    const result = await handleCloudflareStreamWebhook(payload, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('no-change');
    }
    expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
  });

  it('returns ignored if asset is not found', async () => {
    mockPrisma.videoAsset.findFirst.mockResolvedValue(null);

    const payload = {
      uid: 'unknown-uid',
      status: { state: 'ready' as const }
    };

    const result = await handleCloudflareStreamWebhook(payload, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('ignored');
    }
    expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
  });
});
