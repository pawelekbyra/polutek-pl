import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { CloudflareSignedPlaybackTokenService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/modules/playback', () => ({
  CloudflareSignedPlaybackTokenService: {
    isConfigured: vi.fn(),
    createSignedPlaybackToken: vi.fn(),
  },
}));

describe('PlaybackService Cloudflare resolution error', () => {
  const mockPrisma = {
    video: {
      findUnique: vi.fn(),
    },
    videoPlaybackSession: {
        create: vi.fn(),
    }
  };

  const ctx = createAppContext({
    actor: { type: 'user', userId: 'user-1' },
    prisma: mockPrisma as any,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ERROR status when Cloudflare resolution fails unexpectedly', async () => {
    const videoId = 'video-1';
    mockPrisma.video.findUnique.mockResolvedValue({
      id: videoId,
      title: 'Test Video',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      asset: {
        provider: 'CLOUDFLARE_STREAM',
        providerPlaybackId: 'cf-1',
        isPrimary: true,
        processingState: 'READY',
      },
    });

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true, reason: 'ALLOWED' },
    } as any);

    vi.mocked(CloudflareSignedPlaybackTokenService.isConfigured).mockReturnValue(true);
    vi.mocked(CloudflareSignedPlaybackTokenService.createSignedPlaybackToken).mockImplementation(() => {
      throw new Error('Unexpected Cloudflare API error');
    });

    const plan = await PlaybackService.createPlaybackPlanWithContext(videoId, ctx);

    expect(plan.status).toBe('ERROR');
    expect(plan.canPlay).toBe(false);
    expect(plan.diagnostics.warnings).toContain('Failed to resolve secure playback source');
  });
});
