import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import type { Actor } from '@/lib/modules/shared/actor';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

/**
 * Scheduled premieres (CLAUDE.md "Premieres"): until premiereAt, the playback plan
 * is denied for everyone but admins — guests get LOGIN_REQUIRED, signed-in viewers
 * COMING_SOON — and nothing playable (source, provider ids, tokens, session) is made.
 */
describe('PlaybackService premiere gate', () => {
  const prisma = {
    video: { findUnique: vi.fn() },
    videoPlaybackSession: { create: vi.fn() },
  };

  const premiereAt = new Date(Date.now() + 2 * 86_400_000);

  function video(overrides: Record<string, unknown> = {}) {
    return {
      id: 'video-1',
      title: 'Premiere film',
      thumbnailUrl: '/thumb.jpg',
      tier: 'PUBLIC',
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 86_400_000),
      premiereAt,
      videoUrl: null,
      activePlaybackRoute: null,
      assets: [
        {
          id: 'asset-1',
          provider: 'YOUTUBE',
          processingState: 'READY',
          isPrimary: true,
          externalVideoId: 'yt-secret-id',
          providerAssetId: null,
          providerPlaybackId: null,
          fallbackPriority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      ...overrides,
    };
  }

  const plan = (actor: Actor) =>
    PlaybackService.createPlaybackPlanWithContext('video-1', createAppContext({ actor, prisma: prisma as never }));

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.video.findUnique.mockResolvedValue(video());
    prisma.videoPlaybackSession.create.mockResolvedValue({ id: 'session-1' });
    // Even a full access grant must not let an upcoming premiere through.
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } } as never);
  });

  it('gives a guest LOGIN_REQUIRED with no source and no session', async () => {
    const result = await plan({ type: 'guest' });

    expect(result.status).toBe('LOGIN_REQUIRED');
    expect(result.canPlay).toBe(false);
    expect(result.access.allowed).toBe(false);
    expect(result.source).toBeUndefined();
    expect(result.premiereAt).toBeUndefined();
    expect(result.tracking.playbackSessionId).toBe('');
    expect(JSON.stringify(result)).not.toContain('yt-secret-id');
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('gives a signed-in user COMING_SOON with the premiere time and nothing playable', async () => {
    const result = await plan({ type: 'user', userId: 'user-1' });

    expect(result.status).toBe('COMING_SOON');
    expect(result.premiereAt).toBe(premiereAt.toISOString());
    expect(result.canPlay).toBe(false);
    expect(result.access.allowed).toBe(false);
    expect(result.source).toBeUndefined();
    expect(result.tracking.playbackSessionId).toBe('');
    expect(JSON.stringify(result)).not.toContain('yt-secret-id');
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('gates every tier, not only PATRON', async () => {
    for (const tier of ['PUBLIC', 'LOGGED_IN', 'PATRON']) {
      prisma.video.findUnique.mockResolvedValue(video({ tier }));
      expect((await plan({ type: 'user', userId: 'user-1' })).status).toBe('COMING_SOON');
    }
  });

  it('plays normally once the premiere has passed', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ premiereAt: new Date(Date.now() - 60_000) }));

    const result = await plan({ type: 'guest' });

    expect(result.status).toBe('READY');
    expect(result.canPlay).toBe(true);
    expect(prisma.videoPlaybackSession.create).toHaveBeenCalledTimes(1);
  });

  it('lets an admin preview an upcoming premiere, marked as a preview session', async () => {
    const result = await plan({ type: 'admin', userId: 'admin-1' });

    expect(result.status).toBe('READY');
    expect(prisma.videoPlaybackSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isAdminPreview: true }) }),
    );
  });
});
