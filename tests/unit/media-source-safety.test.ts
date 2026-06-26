import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackService } from '@/lib/services/playback/playback.service';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { prisma } from '@/lib/prisma';
import { StorageService } from '@/lib/services/storage/storage.service';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: vi.fn(),
    },
    videoPlaybackSession: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/blob', () => ({
    isAllowedVideoSourceUrl: vi.fn().mockReturnValue(true)
}));

vi.mock('@/lib/services/storage/storage.service', () => ({
  StorageService: {
    getPresignedUrl: vi.fn(),
  },
}));

const { mockCreateSignedPlaybackToken, mockIsConfigured } = vi.hoisted(() => ({
  mockCreateSignedPlaybackToken: vi.fn(),
  mockIsConfigured: vi.fn(() => true),
}));
vi.mock('@/lib/services/playback/cloudflare-signed-playback-token.service', () => ({
  CloudflareSignedPlaybackTokenService: {
    isConfigured: mockIsConfigured,
    createSignedPlaybackToken: mockCreateSignedPlaybackToken,
  },
}));

const baseVideo = {
  id: 'v1',
  title: 'Secret Video',
  videoUrl: 'https://s3.amazonaws.com/bucket/secret.mp4',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  tier: 'PATRON',
};

describe('PlaybackService Safety Diagnostics', () => {
  const ctx = createAppContext({
    actor: { type: 'user', userId: 'user-1', isPatron: false },
    prisma: prisma as any,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
  });

  it('returns ERROR status when Cloudflare signing is not configured', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: {
        provider: 'CLOUDFLARE_STREAM',
        providerPlaybackId: 'cf-1',
        isPrimary: true,
        processingState: 'READY',
      },
    } as any);

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true, reason: 'ALLOWED' },
    } as any);

    mockIsConfigured.mockReturnValue(false);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('ERROR');
    expect(plan.canPlay).toBe(false);
    expect(plan.diagnostics.warnings).toContain('Cloudflare Stream signing is not configured');
    expect(mockCreateSignedPlaybackToken).not.toHaveBeenCalled();
  });
});
