import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCloudflareUploadUrl } from '@/lib/modules/video/application/get-cloudflare-upload-url.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';

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
  } as unknown as AppContext;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'main-creator';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-123';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-123';
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'channel-1', slug: 'main-creator', isApproved: true, isPrimary: true });
  });

  it('successfully generates an upload URL', async () => {
    const videoId = 'video-1';
    mockPrisma.video.findFirst.mockResolvedValue({ id: videoId, creatorId: 'channel-1' });
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
    expect(mockPrisma.videoAsset.create).toHaveBeenCalled();
  });

  it('returns error when Cloudflare credentials are missing', async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    mockPrisma.video.findFirst.mockResolvedValue({ id: 'video-1', creatorId: 'channel-1' });

    const result = await getCloudflareUploadUrl({ videoId: 'video-1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Missing Cloudflare Stream credentials');
    }
  });
});
