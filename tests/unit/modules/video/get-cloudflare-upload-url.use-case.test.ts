import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoStatus } from '@prisma/client';
import { getCloudflareUploadUrl } from '@/lib/modules/video/application/get-cloudflare-upload-url.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from '@/lib/modules/video/domain/video-asset.constants';

// Mock fetch for Cloudflare API
global.fetch = vi.fn();

describe('getCloudflareUploadUrl', () => {
  const mockPrisma = {
    creator: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    video: {
      findFirst: vi.fn(),
    },
    videoAsset: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  };

  const ctx = {
    prisma: mockPrisma,
    actor: { type: 'ADMIN', userId: 'admin-1' },
    db: {
      read: mockPrisma,
      writeTransaction: (cb: any) => cb(mockPrisma),
    },
  } as unknown as AppContext;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'main-creator';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-123';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-123';
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'channel-1', slug: 'main-creator', isApproved: true, isPrimary: true });
  });

  it('rejects creating an upload URL for a non-draft video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({
      id: 'video-1',
      creatorId: 'channel-1',
      status: VideoStatus.PUBLISHED,
      asset: null,
    });

    const result = await getCloudflareUploadUrl({ videoId: 'video-1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_NOT_DRAFT');
    }
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockPrisma.videoAsset.create).not.toHaveBeenCalled();
    expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects replacing an existing ready primary Cloudflare asset', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({
      id: 'video-1',
      creatorId: 'channel-1',
      status: VideoStatus.DRAFT,
      asset: {
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
        isPrimary: true,
      },
    });

    const result = await getCloudflareUploadUrl({ videoId: 'video-1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_HAS_READY_ASSET');
    }
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockPrisma.videoAsset.create).not.toHaveBeenCalled();
    expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('successfully generates an upload URL', async () => {
    const videoId = 'video-1';
    mockPrisma.video.findFirst.mockResolvedValue({ id: videoId, creatorId: 'channel-1', status: VideoStatus.DRAFT, asset: null });
    mockPrisma.videoAsset.findUnique.mockResolvedValue(null);

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: {
          uploadURL: 'https://upload.cloudflare.com/123',
          uid: 'cf-uid-456'
        }
      })
    });

    const result = await getCloudflareUploadUrl({ videoId }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.uploadUrl).toBe('https://upload.cloudflare.com/123');
      expect(result.data.providerAssetId).toBe('cf-uid-456');
    }
    expect(mockPrisma.videoAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: false,
        processingStartedAt: expect.any(Date),
        processingEndedAt: null,
        failureReason: null,
      })
    }));
  });

  it('returns error when Cloudflare credentials are missing', async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    mockPrisma.video.findFirst.mockResolvedValue({ id: 'video-1', creatorId: 'channel-1', status: VideoStatus.DRAFT, asset: null });

    const result = await getCloudflareUploadUrl({ videoId: 'video-1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CLOUDFLARE_NOT_CONFIGURED');
      expect(result.error.message).toContain('Cloudflare Stream nie jest skonfigurowany');
    }
  });
});
