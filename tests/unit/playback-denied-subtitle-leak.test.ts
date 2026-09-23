import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

describe('PlaybackService denied plans never leak subtitle URLs', () => {
  const mockPrisma = {
    video: {
      findUnique: vi.fn(),
    },
  };

  const ctx = createAppContext({
    actor: { type: 'guest' },
    prisma: mockPrisma as any,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits subtitle text tracks from a LOGIN_REQUIRED denied plan', async () => {
    const videoId = 'video-1';
    mockPrisma.video.findUnique.mockResolvedValue({
      id: videoId,
      title: 'Patron-only video',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      subtitleUrlPl: 'https://example.com/private-pl.vtt',
      subtitleUrlEn: 'https://example.com/private-en.vtt',
    });

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'LOGIN_REQUIRED' },
    } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext(videoId, ctx);

    expect(plan.canPlay).toBe(false);
    expect(plan.access.allowed).toBe(false);
    expect(plan.player.textTracks).toBeUndefined();
  });

  it('omits subtitle text tracks from a PATRON_REQUIRED denied plan', async () => {
    const videoId = 'video-2';
    mockPrisma.video.findUnique.mockResolvedValue({
      id: videoId,
      title: 'Patron-only video',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      subtitleUrlPl: 'https://example.com/private-pl.vtt',
      subtitleUrlEn: 'https://example.com/private-en.vtt',
    });

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' },
    } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext(videoId, ctx);

    expect(plan.canPlay).toBe(false);
    expect(plan.access.allowed).toBe(false);
    expect(plan.player.textTracks).toBeUndefined();
  });

  it('omits subtitle text tracks from the internal FORBIDDEN error plan', async () => {
    const videoId = 'video-3';
    mockPrisma.video.findUnique.mockResolvedValue({
      id: videoId,
      title: 'Patron-only video',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      subtitleUrlPl: 'https://example.com/private-pl.vtt',
      subtitleUrlEn: 'https://example.com/private-en.vtt',
    });

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL', message: 'boom' },
    } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext(videoId, ctx);

    expect(plan.canPlay).toBe(false);
    expect(plan.access.allowed).toBe(false);
    expect(plan.player.textTracks).toBeUndefined();
  });
});
